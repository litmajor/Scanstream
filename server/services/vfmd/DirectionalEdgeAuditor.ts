/**
 * Directional Trade Simulator & Edge Auditor
 *
 * PROBLEM WITH PREVIOUS OPTIMIZER:
 *   Measured: "does abs(price_move) >= 1.5% happen in 15 hours?"
 *   Base rate: 45.5% — BTC moves 1.5% constantly, unpredictable.
 *   Result: 1.26x lift maximum. Not useful.
 *
 * THIS OPTIMIZER MEASURES:
 *   "When system says LONG, does price go UP? When SHORT, does price go DOWN?"
 *   Sliced by: pegZscore bucket, regime, vol_bias, MTF momentum agreement
 *   Output: avg PnL per trade at each condition combination
 *
 * THE REAL EDGE HIERARCHY (from backtest data):
 *   1. Regime filter       → Consolidation PF 1.97  (keeps you OUT of noise)
 *   2. Direction signal    → TI + coherence drive LONG vs SHORT
 *   3. Exit timing         → time_stop 65% WR  (WHEN you exit is the edge)
 *   4. PEG                 → regime CONDITION, not directional predictor
 *
 * VARIABLES TESTED FOR DIRECTIONAL LIFT:
 *   A. Multi-timeframe momentum  (4h trend vs 1h signal agreement)
 *   B. Volume bias               (bull vol / total vol last 8 bars)
 *   C. VWAP deviation            (price vs VWAP + direction)
 *   D. PEG z-score bucket        (as regime gate, not directional predictor)
 *   E. Regime type               (consolidation vs turbulent)
 *   F. All combinations          (which combo maximizes avg PnL/trade)
 */

import { MarketTick } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Direction = 'LONG' | 'SHORT';
type RegimeBucket = 'consolidation' | 'turbulent' | 'unknown';

interface TradeCandidate {
  index: number;
  direction: Direction;

  // Condition values at entry
  pegZscore: number;
  pegBucket: 'coiling' | 'neutral' | 'spent';    // <-0.5 / -0.5 to 0.5 / >0.5
  volBias: number;             // [0,1] proportion of volume on bull side
  mtfAgreement: boolean;       // 4h trend agrees with 1h signal direction
  vwapDeviation: number;       // (price - vwap) / vwap  signed
  vwapDirectionGood: boolean;  // price broke VWAP in signal direction
  regime: RegimeBucket;
  ti: number;                  // turbulence index
  coherence: number;
  compressionScore: number;
  vacuumScore: number;

  // Trade outcome (simulated)
  entryPrice: number;
  exitPrice: number;
  exitCandle: number;           // how many candles held
  exitReason: 'time_stop' | 'stop_hit' | 'trailing';
  pnlPct: number;               // signed: positive = winner
  winner: boolean;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

interface ConditionSlice {
  label: string;
  trades: number;
  winners: number;
  winRate: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgMFE: number;
  avgMAE: number;
  liftVsBaseline: number;   // winRate / baseline_winRate
  edgeScore: number;        // avgPnl × sqrt(trades) — significance-weighted
}

interface EdgeAuditReport {
  // Baseline (all trades, no filter)
  baseline: ConditionSlice;

  // Single-variable slices
  byPegBucket:     Record<string, ConditionSlice>;
  byVolBias:       Record<string, ConditionSlice>;
  byMTFAgreement:  Record<string, ConditionSlice>;
  byVwapDirection: Record<string, ConditionSlice>;
  byRegime:        Record<string, ConditionSlice>;

  // Combination slices (top 20 by edgeScore)
  topCombinations: Array<ConditionSlice & { filter: string }>;

  // Feature importance ranking
  featureImportance: Array<{ feature: string; liftVsBaseline: number; tradeCount: number }>;

  // Final recommendation
  recommendation: {
    bestSingleFilter: string;
    bestCombinationFilter: string;
    expectedWinRate: number;
    expectedAvgPnl: number;
    expectedTradesPerYear: number;
    featureRanking: string[];
    gatesToImplement: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling helpers
// ─────────────────────────────────────────────────────────────────────────────

class RollingStats {
  private buf: number[] = [];
  constructor(private w = 168) {}
  push(v: number) {
    this.buf.push(v);
    if (this.buf.length > this.w) this.buf.shift();
    const n    = this.buf.length;
    const mean = this.buf.reduce((s, x) => s + x, 0) / n;
    const std  = Math.sqrt(this.buf.reduce((s, x) => s + (x-mean)**2, 0)/n) + 1e-8;
    return { mean, std, zscore: (v - mean) / std };
  }
}

function computeATR(ticks: MarketTick[], end: number, period: number): number {
  const start = end - period;
  if (start < 1) return 0;
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum += Math.max(
      ticks[i].high - ticks[i].low,
      Math.abs(ticks[i].high - ticks[i-1].close),
      Math.abs(ticks[i].low  - ticks[i-1].close)
    );
  }
  return sum / period;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute multi-timeframe regime (4h from 1h candles)
// ─────────────────────────────────────────────────────────────────────────────

function compute4hTrend(ticks: MarketTick[], i: number): 'up' | 'down' | 'flat' {
  // Synthesize 4h candles from last 48 × 1h candles → 12 × 4h candles
  // Use EMA(12) vs EMA(26) on the 4h closes
  const barSize = 4;
  const barsNeeded = 26 * barSize;
  if (i < barsNeeded + barSize) return 'flat';

  const closes4h: number[] = [];
  for (let b = i - barsNeeded; b <= i; b += barSize) {
    closes4h.push(ticks[Math.min(b + barSize - 1, ticks.length - 1)].close);
  }

  // EMA helper
  const ema = (prices: number[], period: number): number => {
    const k = 2 / (period + 1);
    let e = prices[0];
    for (let j = 1; j < prices.length; j++) e = prices[j] * k + e * (1 - k);
    return e;
  };

  const ema12 = ema(closes4h, 12);
  const ema26 = ema(closes4h, 26);
  const diff  = (ema12 - ema26) / ema26;

  if (diff >  0.003) return 'up';
  if (diff < -0.003) return 'down';
  return 'flat';
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute VWAP (rolling 24h session)
// ─────────────────────────────────────────────────────────────────────────────

function computeVWAP(ticks: MarketTick[], i: number, period = 24): number {
  const start = Math.max(0, i - period);
  let cumPV = 0, cumVol = 0;
  for (let j = start; j <= i; j++) {
    const typical = (ticks[j].high + ticks[j].low + ticks[j].close) / 3;
    const vol = ticks[j].volume ?? 1;
    cumPV  += typical * vol;
    cumVol += vol;
  }
  return cumVol > 0 ? cumPV / cumVol : ticks[i].close;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute volume bias (bull vol / total vol last N bars)
// ─────────────────────────────────────────────────────────────────────────────

function computeVolBias(ticks: MarketTick[], i: number, period = 8): number {
  const start = Math.max(0, i - period);
  let bullVol = 0, bearVol = 0;
  for (let j = start; j <= i; j++) {
    const vol = ticks[j].volume ?? 1;
    if (ticks[j].close >= ticks[j].open) bullVol += vol;
    else bearVol += vol;
  }
  const total = bullVol + bearVol;
  return total > 0 ? bullVol / total : 0.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulate a single trade (enter at index, apply stop/time logic)
// ─────────────────────────────────────────────────────────────────────────────

function simulateTrade(
  ticks: MarketTick[],
  entryIndex: number,
  direction: Direction,
  atrLong: number,
  maxCandles = 8,
  stopMultiplier = 1.5,   // stop = entry ± stopMultiplier × ATR
): { exitPrice: number; exitCandle: number; exitReason: TradeCandidate['exitReason']; pnlPct: number; mfe: number; mae: number } {

  const entryPrice  = ticks[entryIndex].close;
  const stopDist    = atrLong * stopMultiplier;
  const stopPrice   = direction === 'LONG'
    ? entryPrice - stopDist
    : entryPrice + stopDist;

  let mfe = 0;   // max favorable excursion
  let mae = 0;   // max adverse excursion

  for (let c = 1; c <= maxCandles; c++) {
    const idx = entryIndex + c;
    if (idx >= ticks.length) break;

    const bar = ticks[idx];

    // Track excursions
    if (direction === 'LONG') {
      mfe = Math.max(mfe, (bar.high  - entryPrice) / entryPrice);
      mae = Math.max(mae, (entryPrice - bar.low)   / entryPrice);
      if (bar.low <= stopPrice) {
        return { exitPrice: stopPrice, exitCandle: c, exitReason: 'stop_hit',
          pnlPct: (stopPrice - entryPrice) / entryPrice, mfe, mae };
      }
    } else {
      mfe = Math.max(mfe, (entryPrice - bar.low)  / entryPrice);
      mae = Math.max(mae, (bar.high - entryPrice)  / entryPrice);
      if (bar.high >= stopPrice) {
        return { exitPrice: stopPrice, exitCandle: c, exitReason: 'stop_hit',
          pnlPct: (entryPrice - stopPrice) / entryPrice, mfe, mae };
      }
    }

    // Time stop — exit at close of final candle
    if (c === maxCandles) {
      const pnlPct = direction === 'LONG'
        ? (bar.close - entryPrice) / entryPrice
        : (entryPrice - bar.close) / entryPrice;
      return { exitPrice: bar.close, exitCandle: c, exitReason: 'time_stop', pnlPct, mfe, mae };
    }
  }

  return { exitPrice: entryPrice, exitCandle: 0, exitReason: 'time_stop', pnlPct: 0, mfe: 0, mae: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regime detection from physics
// ─────────────────────────────────────────────────────────────────────────────

function detectRegime(ti: number, peg: number, pegZscore: number): RegimeBucket {
  if (ti > 2.0) return 'turbulent';
  if (pegZscore < -0.5 || peg < 0.22) return 'consolidation';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Slice builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSlice(label: string, trades: TradeCandidate[], baselineWR: number): ConditionSlice {
  if (trades.length === 0) return {
    label, trades: 0, winners: 0, winRate: 0, avgPnl: 0, avgWin: 0,
    avgLoss: 0, profitFactor: 0, avgMFE: 0, avgMAE: 0,
    liftVsBaseline: 0, edgeScore: 0,
  };

  const winners = trades.filter(t => t.winner);
  const losers  = trades.filter(t => !t.winner);
  const winRate = winners.length / trades.length;
  const avgPnl  = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
  const avgWin  = winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0;
  const avgLoss = losers.length  > 0 ? losers.reduce((s, t)  => s + t.pnlPct, 0) / losers.length  : 0;
  const grossWin  = winners.reduce((s, t) => s + Math.abs(t.pnlPct), 0);
  const grossLoss = losers.reduce((s, t)  => s + Math.abs(t.pnlPct), 0);
  const avgMFE = trades.reduce((s, t) => s + t.maxFavorableExcursion, 0) / trades.length;
  const avgMAE = trades.reduce((s, t) => s + t.maxAdverseExcursion,   0) / trades.length;

  return {
    label,
    trades: trades.length,
    winners: winners.length,
    winRate,
    avgPnl,
    avgWin,
    avgLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    avgMFE,
    avgMAE,
    liftVsBaseline: baselineWR > 0 ? winRate / baselineWR : 0,
    edgeScore: avgPnl * Math.sqrt(trades.length),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Simulator
// ─────────────────────────────────────────────────────────────────────────────

export class DirectionalEdgeAuditor {
  private fc: FieldConstructor;
  constructor() { this.fc = new FieldConstructor(50, 100); }

  async run(
    ticks: MarketTick[],
    maxCandles  = 8,
    stopMultiplier = 1.5,
    feeRtPct = 0.0014,     // 0.07% per leg × 2 = 0.14% round trip
  ): Promise<EdgeAuditReport> {

    console.log('\n🎯 DIRECTIONAL EDGE AUDITOR');
    console.log('='.repeat(70));
    console.log(`Data: ${ticks.length} candles`);
    console.log(`Trade sim: ${maxCandles} candle max hold | stop=${stopMultiplier}×ATR | fee=${(feeRtPct*100).toFixed(2)}% RT`);
    console.log('Measuring: directional accuracy + avg PnL per trade condition');
    console.log('');

    // ── Step 1: Generate trade candidates ──────────────────────
    console.log('⚙️  Generating trade candidates...');
    const candidates = await this.generateCandidates(ticks, maxCandles, stopMultiplier, feeRtPct);
    console.log(`   Generated: ${candidates.length} simulated trades`);

    // ── Step 2: Baseline ────────────────────────────────────────
    const baseline = buildSlice('ALL TRADES (baseline)', candidates, 0);
    baseline.liftVsBaseline = 1.0;
    console.log(`   Baseline WR: ${(baseline.winRate*100).toFixed(1)}% | Avg PnL: ${(baseline.avgPnl*100).toFixed(3)}% | PF: ${baseline.profitFactor.toFixed(2)}`);

    // ── Step 3: Single-variable slices ─────────────────────────
    console.log('\n📊 Slicing by single conditions...');

    const byPegBucket = this.sliceBy(candidates, baseline.winRate,
      t => t.pegBucket,
      ['coiling', 'neutral', 'spent']
    );

    const byVolBias = this.sliceBy(candidates, baseline.winRate,
      t => t.volBias >= 0.65 ? 'bullish(≥65%)' : t.volBias <= 0.35 ? 'bearish(≤35%)' : 'neutral',
      ['bullish(≥65%)', 'neutral', 'bearish(≤35%)']
    );

    const byMTFAgreement = this.sliceBy(candidates, baseline.winRate,
      t => t.mtfAgreement ? 'MTF_agree' : 'MTF_disagree',
      ['MTF_agree', 'MTF_disagree']
    );

    const byVwapDirection = this.sliceBy(candidates, baseline.winRate,
      t => t.vwapDirectionGood ? 'vwap_aligned' : 'vwap_opposed',
      ['vwap_aligned', 'vwap_opposed']
    );

    const byRegime = this.sliceBy(candidates, baseline.winRate,
      t => t.regime,
      ['consolidation', 'turbulent', 'unknown']
    );

    // ── Step 4: Combination slices ──────────────────────────────
    console.log('\n🔬 Testing combination filters...');
    const topCombinations = this.testCombinations(candidates, baseline.winRate);

    // ── Step 5: Feature importance ──────────────────────────────
    const featureImportance = this.rankFeatures(
      byPegBucket, byVolBias, byMTFAgreement, byVwapDirection, byRegime, baseline
    );

    // ── Step 6: Print results ───────────────────────────────────
    this.printBaseline(baseline, feeRtPct);
    this.printSingleSlices(byPegBucket, byVolBias, byMTFAgreement, byVwapDirection, byRegime);
    this.printCombinations(topCombinations, feeRtPct);
    this.printFeatureImportance(featureImportance);

    // ── Step 7: Build recommendation ───────────────────────────
    const recommendation = this.buildRecommendation(
      baseline, topCombinations, featureImportance, candidates.length
    );
    this.printRecommendation(recommendation, baseline);

    return {
      baseline, byPegBucket, byVolBias, byMTFAgreement, byVwapDirection, byRegime,
      topCombinations, featureImportance, recommendation,
    };
  }

  // ─── Generate all trade candidates ───────────────────────────────────────

  private async generateCandidates(
    ticks: MarketTick[],
    maxCandles: number,
    stopMultiplier: number,
    feeRtPct: number,
  ): Promise<TradeCandidate[]> {

    const candidates: TradeCandidate[] = [];
    const pegStats = new RollingStats(168);
    const pegHistory: number[] = [];
    const MIN = 150;  // warmup

    for (let i = MIN; i < ticks.length - maxCandles - 1; i++) {
      // ── Physics ────────────────────────────────────────────────
      const window  = ticks.slice(Math.max(0, i - 100), i);
      const field   = this.fc.constructField(window.map(t => t.close));
      const physics = PhysicsCalculator.computeAllMetrics(field);
      const peg     = physics.peg;
      const ti      = physics.turbulenceIndex ?? 0;
      const coherence = physics.coherenceScore ?? 0;

      const { zscore: pegZscore } = pegStats.push(peg);

      pegHistory.push(peg);
      if (pegHistory.length > 5) pegHistory.shift();

      // Skip if not enough PEG history to compute derivatives
      if (pegHistory.length < 3) continue;

      // ── Direction: use TI + coherence + divergence ─────────────
      // Positive divergence = price moving up relative to field → LONG
      // Negative divergence = price moving down → SHORT
      const divergence = physics.divergenceScore ?? 0;
      const direction: Direction = divergence >= 0 ? 'LONG' : 'SHORT';

      // ── Conditions ────────────────────────────────────────────
      const pegBucket: TradeCandidate['pegBucket'] =
        pegZscore < -0.5 ? 'coiling' :
        pegZscore >  0.5 ? 'spent'   : 'neutral';

      const volBias       = computeVolBias(ticks, i, 8);
      const trend4h       = compute4hTrend(ticks, i);
      const mtfAgreement  = (direction === 'LONG'  && trend4h === 'up')   ||
                            (direction === 'SHORT' && trend4h === 'down') ||
                            trend4h === 'flat';  // flat = don't filter

      const vwap          = computeVWAP(ticks, i, 24);
      const vwapDev       = (ticks[i].close - vwap) / vwap;
      const vwapDirectionGood =
        (direction === 'LONG'  && ticks[i].close > vwap) ||
        (direction === 'SHORT' && ticks[i].close < vwap);

      const atrLong   = computeATR(ticks, i, 24);
      const atrShort  = computeATR(ticks, i, 8);
      const volRatio  = atrLong > 0 ? atrShort / atrLong : 1;
      const compressionScore = Math.max(0, 1 - Math.min(volRatio, 1.3) / 1.3);

      const rangeNow = ticks[i].high - ticks[i].low;
      const rangeTightness = atrLong > 0
        ? Math.max(0, 1 - (rangeNow / atrLong) / 0.85) : 0;
      const vol8  = ticks.slice(Math.max(0, i-8),  i).reduce((s,c) => s+(c.volume??0), 0)/8;
      const vol24 = ticks.slice(Math.max(0, i-24), i).reduce((s,c) => s+(c.volume??0), 0)/24;
      const volContraction = vol24 > 0 ? Math.max(0, 1 - Math.min(vol8/vol24, 1.3)/1.3) : 0;
      const vacuumScore = 0.40*compressionScore + 0.30*rangeTightness + 0.20*volContraction;

      const regime = detectRegime(ti, peg, pegZscore);

      // ── Simulate trade ─────────────────────────────────────────
      const sim = simulateTrade(ticks, i, direction, atrLong, maxCandles, stopMultiplier);
      const pnlAfterFees = sim.pnlPct - feeRtPct;

      candidates.push({
        index: i, direction,
        pegZscore, pegBucket, volBias, mtfAgreement,
        vwapDeviation: vwapDev, vwapDirectionGood,
        regime, ti, coherence, compressionScore, vacuumScore,
        entryPrice: ticks[i].close,
        exitPrice: sim.exitPrice, exitCandle: sim.exitCandle,
        exitReason: sim.exitReason,
        pnlPct: pnlAfterFees,
        winner: pnlAfterFees > 0,
        maxFavorableExcursion: sim.mfe,
        maxAdverseExcursion: sim.mae,
      });
    }

    return candidates;
  }

  // ─── Slice by label ────────────────────────────────────────────────────────

  private sliceBy(
    candidates: TradeCandidate[],
    baselineWR: number,
    getLabel: (t: TradeCandidate) => string,
    order: string[],
  ): Record<string, ConditionSlice> {
    const groups: Record<string, TradeCandidate[]> = {};
    for (const label of order) groups[label] = [];
    for (const t of candidates) {
      const l = getLabel(t);
      if (!groups[l]) groups[l] = [];
      groups[l].push(t);
    }
    const result: Record<string, ConditionSlice> = {};
    for (const [label, trades] of Object.entries(groups)) {
      result[label] = buildSlice(label, trades, baselineWR);
    }
    return result;
  }

  // ─── Combination tests ─────────────────────────────────────────────────────

  private testCombinations(
    candidates: TradeCandidate[],
    baselineWR: number,
  ): Array<ConditionSlice & { filter: string }> {

    const filters: Array<{ name: string; fn: (t: TradeCandidate) => boolean }> = [

      // ── Single conditions ──────────────────────────────────────
      { name: 'regime=consolidation',                fn: t => t.regime === 'consolidation' },
      { name: 'regime=turbulent',                    fn: t => t.regime === 'turbulent' },
      { name: 'MTF_agree',                           fn: t => t.mtfAgreement },
      { name: 'volBias_aligned(LONG≥0.55|SHORT≤0.45)', fn: t =>
          (t.direction === 'LONG'  && t.volBias >= 0.55) ||
          (t.direction === 'SHORT' && t.volBias <= 0.45) },
      { name: 'vwap_aligned',                        fn: t => t.vwapDirectionGood },
      { name: 'peg=coiling',                         fn: t => t.pegBucket === 'coiling' },
      { name: 'peg=spent',                           fn: t => t.pegBucket === 'spent' },

      // ── Double conditions ──────────────────────────────────────
      { name: 'consolidation + MTF_agree',           fn: t => t.regime === 'consolidation' && t.mtfAgreement },
      { name: 'consolidation + vwap_aligned',        fn: t => t.regime === 'consolidation' && t.vwapDirectionGood },
      { name: 'consolidation + volBias_aligned',     fn: t =>
          t.regime === 'consolidation' &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'MTF_agree + vwap_aligned',            fn: t => t.mtfAgreement && t.vwapDirectionGood },
      { name: 'MTF_agree + volBias_aligned',         fn: t =>
          t.mtfAgreement &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'peg=coiling + MTF_agree',             fn: t => t.pegBucket === 'coiling' && t.mtfAgreement },
      { name: 'peg=coiling + volBias_aligned',       fn: t =>
          t.pegBucket === 'coiling' &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'turbulent + MTF_agree',               fn: t => t.regime === 'turbulent' && t.mtfAgreement },
      { name: 'turbulent + volBias_aligned',         fn: t =>
          t.regime === 'turbulent' &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'highCoherence(≥0.005) + MTF_agree',  fn: t => t.coherence >= 0.005 && t.mtfAgreement },
      { name: 'highCoherence(≥0.005) + consolidation', fn: t => t.coherence >= 0.005 && t.regime === 'consolidation' },

      // ── Triple conditions ──────────────────────────────────────
      { name: 'consolidation + MTF_agree + vwap_aligned',
        fn: t => t.regime === 'consolidation' && t.mtfAgreement && t.vwapDirectionGood },
      { name: 'consolidation + MTF_agree + volBias_aligned',
        fn: t => t.regime === 'consolidation' && t.mtfAgreement &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'consolidation + vwap_aligned + volBias_aligned',
        fn: t => t.regime === 'consolidation' && t.vwapDirectionGood &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'MTF_agree + vwap_aligned + volBias_aligned',
        fn: t => t.mtfAgreement && t.vwapDirectionGood &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'peg=coiling + MTF_agree + vwap_aligned',
        fn: t => t.pegBucket === 'coiling' && t.mtfAgreement && t.vwapDirectionGood },
      { name: 'turbulent + MTF_agree + volBias_aligned',
        fn: t => t.regime === 'turbulent' && t.mtfAgreement &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },

      // ── Quad conditions ───────────────────────────────────────
      { name: 'consolidation + MTF_agree + vwap_aligned + volBias_aligned',
        fn: t => t.regime === 'consolidation' && t.mtfAgreement && t.vwapDirectionGood &&
          ((t.direction === 'LONG' && t.volBias >= 0.55) || (t.direction === 'SHORT' && t.volBias <= 0.45)) },
      { name: 'peg=coiling + consolidation + MTF_agree + vwap_aligned',
        fn: t => t.pegBucket === 'coiling' && t.regime === 'consolidation' && t.mtfAgreement && t.vwapDirectionGood },
      { name: 'highCoherence + consolidation + MTF_agree + vwap_aligned',
        fn: t => t.coherence >= 0.005 && t.regime === 'consolidation' && t.mtfAgreement && t.vwapDirectionGood },
    ];

    return filters
      .map(({ name, fn }) => {
        const subset = candidates.filter(fn);
        const slice  = buildSlice(name, subset, baselineWR);
        return { ...slice, filter: name };
      })
      .sort((a, b) => b.edgeScore - a.edgeScore);
  }

  // ─── Feature importance ────────────────────────────────────────────────────

  private rankFeatures(
    byPeg: Record<string, ConditionSlice>,
    byVol: Record<string, ConditionSlice>,
    byMTF: Record<string, ConditionSlice>,
    byVwap: Record<string, ConditionSlice>,
    byRegime: Record<string, ConditionSlice>,
    baseline: ConditionSlice,
  ) {
    const features = [
      { feature: 'MTF agreement',         liftVsBaseline: byMTF['MTF_agree']?.liftVsBaseline ?? 1,      tradeCount: byMTF['MTF_agree']?.trades ?? 0 },
      { feature: 'VWAP aligned',          liftVsBaseline: byVwap['vwap_aligned']?.liftVsBaseline ?? 1,   tradeCount: byVwap['vwap_aligned']?.trades ?? 0 },
      { feature: 'Volume bias aligned',   liftVsBaseline: byVol['bullish(≥65%)']?.liftVsBaseline ?? 1,   tradeCount: byVol['bullish(≥65%)']?.trades ?? 0 },
      { feature: 'PEG coiling',           liftVsBaseline: byPeg['coiling']?.liftVsBaseline ?? 1,         tradeCount: byPeg['coiling']?.trades ?? 0 },
      { feature: 'PEG spent',             liftVsBaseline: byPeg['spent']?.liftVsBaseline ?? 1,           tradeCount: byPeg['spent']?.trades ?? 0 },
      { feature: 'Regime=consolidation',  liftVsBaseline: byRegime['consolidation']?.liftVsBaseline ?? 1, tradeCount: byRegime['consolidation']?.trades ?? 0 },
      { feature: 'Regime=turbulent',      liftVsBaseline: byRegime['turbulent']?.liftVsBaseline ?? 1,     tradeCount: byRegime['turbulent']?.trades ?? 0 },
    ];
    return features.sort((a, b) => b.liftVsBaseline - a.liftVsBaseline);
  }

  // ─── Build recommendation ─────────────────────────────────────────────────

  private buildRecommendation(
    baseline: ConditionSlice,
    combos: Array<ConditionSlice & { filter: string }>,
    features: ReturnType<typeof this.rankFeatures>,
    totalSimCandidates: number,
  ): EdgeAuditReport['recommendation'] {

    // Best single filter: highest edgeScore with ≥100 trades
    const bestSingle = combos
      .filter(c => c.trades >= 100 && !c.filter.includes('+'))
      .sort((a, b) => b.edgeScore - a.edgeScore)[0];

    // Best combo: highest edgeScore with ≥50 trades
    const bestCombo = combos
      .filter(c => c.trades >= 50)
      .sort((a, b) => b.edgeScore - a.edgeScore)[0];

    const dataYears = totalSimCandidates / 8760;
    const expectedTPY = dataYears > 0
      ? Math.round((bestCombo?.trades ?? 0) / dataYears)
      : 0;

    const gates = features
      .filter(f => f.liftVsBaseline > 1.05)
      .map(f => f.feature);

    return {
      bestSingleFilter:    bestSingle?.filter ?? 'regime=consolidation',
      bestCombinationFilter: bestCombo?.filter ?? '',
      expectedWinRate:     bestCombo?.winRate ?? baseline.winRate,
      expectedAvgPnl:      bestCombo?.avgPnl  ?? baseline.avgPnl,
      expectedTradesPerYear: expectedTPY,
      featureRanking:      features.map(f => `${f.feature} (${f.liftVsBaseline.toFixed(2)}x)`),
      gatesToImplement:    gates,
    };
  }

  // ─── Print helpers ─────────────────────────────────────────────────────────

  private printBaseline(b: ConditionSlice, feeRtPct: number) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 BASELINE — ALL TRADES (no filter)');
    console.log('='.repeat(70));
    console.log(`  Trades:        ${b.trades}`);
    console.log(`  Win Rate:      ${(b.winRate*100).toFixed(1)}%`);
    console.log(`  Avg PnL/trade: ${(b.avgPnl*100).toFixed(3)}%   (after ${(feeRtPct*100).toFixed(2)}% RT fees)`);
    console.log(`  Avg Win:       ${(b.avgWin*100).toFixed(3)}%`);
    console.log(`  Avg Loss:      ${(b.avgLoss*100).toFixed(3)}%`);
    console.log(`  Profit Factor: ${b.profitFactor.toFixed(3)}`);
    console.log(`  Avg MFE:       ${(b.avgMFE*100).toFixed(3)}%`);
    console.log(`  Avg MAE:       ${(b.avgMAE*100).toFixed(3)}%`);
  }

  private printSingleSlices(
    byPeg: Record<string, ConditionSlice>,
    byVol: Record<string, ConditionSlice>,
    byMTF: Record<string, ConditionSlice>,
    byVwap: Record<string, ConditionSlice>,
    byRegime: Record<string, ConditionSlice>,
  ) {
    const header = '  Label                    | Trades | WR     | AvgPnL  | PF     | Lift  ';
    const line   = '  ' + '─'.repeat(72);

    const printGroup = (title: string, slices: Record<string, ConditionSlice>) => {
      console.log(`\n  ── ${title}`);
      console.log(header); console.log(line);
      for (const s of Object.values(slices)) {
        const lift = s.liftVsBaseline;
        const icon = lift > 1.15 ? '🟢' : lift > 1.05 ? '🟡' : lift < 0.95 ? '🔴' : '⚪';
        console.log(
          `  ${icon} ${s.label.padEnd(23)} | ${s.trades.toString().padStart(6)} | ` +
          `${(s.winRate*100).toFixed(1).padStart(5)}% | ` +
          `${(s.avgPnl*100).toFixed(3).padStart(7)}% | ` +
          `${s.profitFactor.toFixed(2).padStart(6)} | ` +
          `${s.liftVsBaseline.toFixed(2).padStart(4)}x`
        );
      }
    };

    printGroup('PEG Z-Score Bucket',       byPeg);
    printGroup('Volume Bias',              byVol);
    printGroup('Multi-Timeframe Momentum', byMTF);
    printGroup('VWAP Direction Alignment', byVwap);
    printGroup('Regime',                   byRegime);
  }

  private printCombinations(
    combos: Array<ConditionSlice & { filter: string }>,
    feeRtPct: number,
  ) {
    console.log('\n' + '='.repeat(70));
    console.log('🔬 TOP COMBINATIONS (by edge score = avgPnl × √trades)');
    console.log('='.repeat(70));
    console.log('  Rank | Trades | WR     | AvgPnL  | PF     | Lift  | Filter');
    console.log('  ' + '─'.repeat(80));

    combos.slice(0, 20).forEach((c, i) => {
      const icon = c.avgPnl > 0 && c.liftVsBaseline > 1.10 ? '✅' :
                   c.avgPnl > 0                             ? '⚠️ ' : '❌';
      console.log(
        `  ${icon} ${(i+1).toString().padStart(2)}  | ` +
        `${c.trades.toString().padStart(6)} | ` +
        `${(c.winRate*100).toFixed(1).padStart(5)}% | ` +
        `${(c.avgPnl*100).toFixed(3).padStart(7)}% | ` +
        `${c.profitFactor.toFixed(2).padStart(6)} | ` +
        `${c.liftVsBaseline.toFixed(2).padStart(4)}x | ` +
        c.filter
      );
    });

    console.log(`\n  Note: fees=${(feeRtPct*100).toFixed(2)}% RT already deducted from PnL`);
  }

  private printFeatureImportance(features: ReturnType<typeof this.rankFeatures>) {
    console.log('\n' + '='.repeat(70));
    console.log('📈 FEATURE IMPORTANCE (by directional lift over baseline)');
    console.log('='.repeat(70));
    features.forEach((f, i) => {
      const bar  = '█'.repeat(Math.max(0, Math.round((f.liftVsBaseline - 1) * 40)));
      const icon = f.liftVsBaseline > 1.15 ? '🔥' : f.liftVsBaseline > 1.05 ? '✅' : f.liftVsBaseline < 0.95 ? '❌' : '➖';
      console.log(`  ${icon} ${(i+1)}. ${f.feature.padEnd(22)} ${f.liftVsBaseline.toFixed(3)}x  ${bar}  (${f.tradeCount} trades)`);
    });
  }

  private printRecommendation(r: EdgeAuditReport['recommendation'], baseline: ConditionSlice) {
    const pnlImprovement = baseline.avgPnl > 0
      ? ((r.expectedAvgPnl - baseline.avgPnl) / Math.abs(baseline.avgPnl) * 100)
      : 0;

    console.log('\n' + '='.repeat(70));
    console.log('🎯 RECOMMENDATION — Implement these gates');
    console.log('='.repeat(70));
    console.log('');
    console.log(`Best single filter:      ${r.bestSingleFilter}`);
    console.log(`Best combination:        ${r.bestCombinationFilter}`);
    console.log('');
    console.log(`Expected win rate:       ${(r.expectedWinRate*100).toFixed(1)}%  (was ${(baseline.winRate*100).toFixed(1)}%)`);
    console.log(`Expected avg PnL/trade:  ${(r.expectedAvgPnl*100).toFixed(3)}%  (was ${(baseline.avgPnl*100).toFixed(3)}%)`);
    console.log(`Expected trades/year:    ~${r.expectedTradesPerYear.toLocaleString()}`);
    console.log('');
    console.log('Feature ranking:');
    r.featureRanking.forEach((f, i) => console.log(`  ${i+1}. ${f}`));
    console.log('');
    console.log('Gates to implement (highest lift first):');
    r.gatesToImplement.forEach((g, i) => console.log(`  ${i+1}. ${g}`));
    console.log('='.repeat(70));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function runDirectionalEdgeAudit(
  ticks: MarketTick[],
  maxCandles     = 8,
  stopMultiplier = 1.5,
  feeRtPct       = 0.0014,
): Promise<EdgeAuditReport> {
  return new DirectionalEdgeAuditor().run(ticks, maxCandles, stopMultiplier, feeRtPct);
}

export default DirectionalEdgeAuditor;