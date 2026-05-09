/**
 * Pressure-Fragility Signal Optimizer  v2
 *
 * CRITICAL FIX from v1 optimizer run:
 *
 *   Distribution analysis showed:
 *     PEG z-score when moves happen:   -0.0944   ← BELOW average
 *     PEG z-score when nothing happens: +0.0885  ← ABOVE average
 *
 *   Conclusion: PEG is INVERTED. High PEG = energy already spent.
 *               Low PEG = energy still coiling = move incoming.
 *
 *   v1 was testing: pegZscore > threshold  (wrong direction)
 *   v2 now tests:   pegZscore < -threshold (correct — below-average PEG)
 *
 *   ΔPEG fix: solo ΔPEG was near-random (precision ≈ base rate).
 *             ΔPEG is only meaningful FROM A LOW BASELINE.
 *             Signal: pegZscore < 0 AND deltaPeg > 0
 *             = spring was coiling AND just started to pressurize.
 *
 *   Vacuum fix: rangeTightness denominator 0.5 was too tight for BTC 1h.
 *               Changed to 0.85 so the score has meaningful range.
 *
 * The 3-variable model (correctly oriented):
 *   1. Low PEG z-score   — energy hasn't been spent (coiling phase)
 *   2. ΔPEG turning up   — pressure starting to build (from low baseline)
 *   3. Vacuum score      — structure is fragile (compression + volume)
 */

import { MarketTick } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedMetrics {
  peg: number;
  pegZscore: number;
  pegLow: number;          // clamp(-pegZscore/3, 0, 1) — HIGH when PEG is below avg
  deltaPeg: number;
  delta2Peg: number;
  deltaPegFromLow: number; // deltaPeg clamped to [0,1] only when pegZscore < 0

  atrShort: number;
  atrLong: number;
  volatilityRatio: number;
  compressionScore: number;
  rangeTightness: number;
  volumeContraction: number;
  vacuumScore: number;

  coherenceNorm: number;
}

interface ThresholdResult {
  variable: string;
  threshold: number;
  direction: '>' | '<';
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  totalSignals: number;
  signalRate: number;
  liftOverBase: number;
}

interface ComboResult {
  description: string;
  precision: number;
  recall: number;
  f1Score: number;
  totalSignals: number;
  signalRate: number;
  liftOverBase: number;
}

interface CompositeWeightResult {
  weights: { pegLow: number; deltaPegFromLow: number; vacuum: number; coherence: number };
  cutoff: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalSignals: number;
  liftOverBase: number;
}

export interface OptimizationReport {
  baseRate: number;
  pegZscoreResults:    ThresholdResult[];
  deltaPegResults:     ThresholdResult[];
  vacuumResults:       ThresholdResult[];
  comboResults:        ComboResult[];
  bestComposite:       CompositeWeightResult;
  distribution: {
    pegZscore:    { moveAvg: number; noMoveAvg: number; separation: number };
    vacuumScore:  { moveAvg: number; noMoveAvg: number; separation: number };
    deltaPeg:     { moveAvg: number; noMoveAvg: number; separation: number };
  };
  recommendation: {
    pegZscoreGate: number;
    deltaPegGate: number;
    vacuumGate: number;
    compositeWeights: CompositeWeightResult['weights'];
    compositeCutoff: number;
    expectedTradesPerYear: number;
    expectedPrecision: number;
    expectedRecall: number;
    expectedLift: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling stats
// ─────────────────────────────────────────────────────────────────────────────

class RollingStats {
  private buffer: number[] = [];
  constructor(private readonly window: number = 168) {}
  push(v: number): { mean: number; std: number; zscore: number } {
    this.buffer.push(v);
    if (this.buffer.length > this.window) this.buffer.shift();
    const n    = this.buffer.length;
    const mean = this.buffer.reduce((s, x) => s + x, 0) / n;
    const std  = Math.sqrt(this.buffer.reduce((s, x) => s + (x - mean) ** 2, 0) / n) + 1e-8;
    return { mean, std, zscore: (v - mean) / std };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATR
// ─────────────────────────────────────────────────────────────────────────────

function computeATR(ticks: MarketTick[], end: number, period: number): number {
  const start = end - period;
  if (start < 1) return 0;
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum += Math.max(
      ticks[i].high - ticks[i].low,
      Math.abs(ticks[i].high - ticks[i - 1].close),
      Math.abs(ticks[i].low  - ticks[i - 1].close)
    );
  }
  return sum / period;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-candle metric computation
// ─────────────────────────────────────────────────────────────────────────────

function computeMetrics(
  ticks: MarketTick[],
  i: number,
  pegHistory: number[],
  pegStats: RollingStats,
  fc: FieldConstructor
): NormalizedMetrics {

  const window  = ticks.slice(Math.max(0, i - 100), i);
  const field   = fc.constructField(window.map(t => t.close));
  const physics = PhysicsCalculator.computeAllMetrics(field);
  const peg     = physics.peg;

  const { zscore: pegZscore, std: pegStd } = pegStats.push(peg);

  pegHistory.push(peg);
  if (pegHistory.length > 5) pegHistory.shift();

  let deltaPeg  = 0;
  let delta2Peg = 0;
  if (pegHistory.length >= 3) {
    const n  = pegHistory.length;
    const j0 = pegHistory[n - 3];
    const j1 = pegHistory[n - 2];
    const j2 = pegHistory[n - 1];
    deltaPeg  = j2 - j1;
    delta2Peg = (j2 - j1) - (j1 - j0);
  }

  // pegLow: high when PEG is BELOW its rolling average (coiling phase)
  const pegLow = Math.min(1, Math.max(0, -pegZscore / 3));

  // deltaPegFromLow: only credits positive acceleration from a coiling baseline
  const deltaPegFromLow = pegZscore < 0 && deltaPeg > 0
    ? Math.min(1, deltaPeg / (pegStd * 3 + 1e-8))
    : 0;

  const atrShort = computeATR(ticks, i, 8);
  const atrLong  = computeATR(ticks, i, 24);
  const volatilityRatio  = atrLong > 0 ? atrShort / atrLong : 1;
  const compressionScore = Math.max(0, 1 - Math.min(volatilityRatio, 1.3) / 1.3);

  // Fixed: denominator 0.85 (was 0.5 — too tight for BTC 1h hourly candles)
  const rangeNow = ticks[i].high - ticks[i].low;
  const rangeTightness = atrLong > 0
    ? Math.max(0, 1 - (rangeNow / atrLong) / 0.85)
    : 0;

  const vol8  = ticks.slice(Math.max(0, i - 8),  i).reduce((s, c) => s + (c.volume ?? 0), 0) / 8;
  const vol24 = ticks.slice(Math.max(0, i - 24), i).reduce((s, c) => s + (c.volume ?? 0), 0) / 24;
  const volumeContraction = vol24 > 0
    ? Math.max(0, 1 - Math.min(vol8 / vol24, 1.3) / 1.3)
    : 0;

  const vacuumScore =
    0.40 * compressionScore +
    0.30 * rangeTightness   +
    0.20 * volumeContraction;

  const coherenceNorm = Math.min(1, (physics.coherenceScore ?? 0) / 0.02);

  return {
    peg, pegZscore, pegLow, deltaPeg, delta2Peg, deltaPegFromLow,
    atrShort, atrLong, volatilityRatio, compressionScore,
    rangeTightness, volumeContraction, vacuumScore, coherenceNorm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimizer
// ─────────────────────────────────────────────────────────────────────────────

export class PressureFragilityOptimizer {
  private fc: FieldConstructor;
  constructor() { this.fc = new FieldConstructor(50, 100); }

  async optimize(
    ticks: MarketTick[],
    minMovePercent = 0.015,
    lookAhead      = 15,
  ): Promise<OptimizationReport> {

    console.log('\n🔬 PRESSURE-FRAGILITY SIGNAL OPTIMIZER  v2');
    console.log('='.repeat(70));
    console.log(`Data: ${ticks.length} candles | Min move: ${(minMovePercent*100).toFixed(1)}% | Look-ahead: ${lookAhead}`);
    console.log('KEY CHANGE: PEG gate is now INVERTED (low PEG = coiling = signal)');

    console.log('\n⚙️  Pre-computing metrics...');
    const { allMetrics, actualMoves } = await this.preCompute(ticks, minMovePercent, lookAhead);
    const N        = allMetrics.length;
    const movesN   = actualMoves.filter(Boolean).length;
    const baseRate = movesN / N;
    console.log(`   Candles: ${N} | Moves: ${movesN} (${(baseRate*100).toFixed(1)}% base rate)`);

    const distribution = this.analyzeDistribution(allMetrics, actualMoves);
    this.printDistribution(distribution, baseRate);

    console.log('\n📊 1/4 — PEG Z-Score (inverted: LOW = coiling)...');
    const pegZscoreResults = this.gridSearch(
      allMetrics, actualMoves, baseRate,
      m => m.pegZscore,
      [-0.10, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50],
      '<', 'PEG Z-Score coiling'
    );
    this.printThresholdTable(pegZscoreResults, 'PEG Z-SCORE  (gate: pegZscore < threshold)');

    console.log('\n📊 2/4 — ΔPEG from low-PEG baseline...');
    const deltaPegResults = this.gridSearch(
      allMetrics, actualMoves, baseRate,
      m => m.deltaPegFromLow,
      [0.001, 0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.10],
      '>', 'ΔPEG from low baseline'
    );
    this.printThresholdTable(deltaPegResults, 'ΔPEG FROM LOW BASELINE  (gate: deltaPegFromLow > threshold)');

    console.log('\n📊 3/4 — Vacuum score (fixed formula)...');
    const vacuumResults = this.gridSearch(
      allMetrics, actualMoves, baseRate,
      m => m.vacuumScore,
      [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50],
      '>', 'Vacuum score'
    );
    this.printThresholdTable(vacuumResults, 'VACUUM SCORE  (gate: vacuumScore > threshold)');

    console.log('\n📊 4/4 — Combination gate tests...');
    const comboResults = this.testCombinations(allMetrics, actualMoves, baseRate, N);
    this.printCombinations(comboResults);

    console.log('\n🧮 Composite weight grid search...');
    const bestComposite = this.compositeSearch(allMetrics, actualMoves, baseRate);
    this.printComposite(bestComposite, baseRate);

    const report = this.buildReport(
      baseRate, pegZscoreResults, deltaPegResults, vacuumResults,
      comboResults, bestComposite, distribution, N
    );
    this.printRecommendation(report);
    return report;
  }

  private async preCompute(ticks: MarketTick[], minMove: number, lookAhead: number) {
    const allMetrics: NormalizedMetrics[] = [];
    const actualMoves: boolean[] = [];
    const pegHistory: number[] = [];
    const pegStats = new RollingStats(168);
    const MIN = 124;

    for (let i = MIN; i < ticks.length - lookAhead; i++) {
      allMetrics.push(computeMetrics(ticks, i, pegHistory, pegStats, this.fc));
      const cur = ticks[i].close;
      let max = 0;
      for (let j = 1; j <= lookAhead; j++) {
        const m = Math.abs(ticks[i + j].close - cur) / cur;
        if (m > max) max = m;
      }
      actualMoves.push(max >= minMove);
    }
    return { allMetrics, actualMoves };
  }

  private analyzeDistribution(metrics: NormalizedMetrics[], moves: boolean[]) {
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
    const [mPeg, nmPeg, mVac, nmVac, mDelta, nmDelta] =
      [[], [], [], [], [], []] as number[][];
    for (let i = 0; i < metrics.length; i++) {
      (moves[i] ? mPeg   : nmPeg  ).push(metrics[i].pegZscore);
      (moves[i] ? mVac   : nmVac  ).push(metrics[i].vacuumScore);
      (moves[i] ? mDelta : nmDelta).push(metrics[i].deltaPeg);
    }
    return {
      pegZscore:   { moveAvg: avg(mPeg),   noMoveAvg: avg(nmPeg),   separation: avg(mPeg)   - avg(nmPeg)   },
      vacuumScore: { moveAvg: avg(mVac),   noMoveAvg: avg(nmVac),   separation: avg(mVac)   - avg(nmVac)   },
      deltaPeg:    { moveAvg: avg(mDelta), noMoveAvg: avg(nmDelta), separation: avg(mDelta) - avg(nmDelta) },
    };
  }

  private gridSearch(
    metrics: NormalizedMetrics[], moves: boolean[], baseRate: number,
    getValue: (m: NormalizedMetrics) => number,
    thresholds: number[], dir: '>' | '<', variable: string,
  ): ThresholdResult[] {
    return thresholds.map(threshold => {
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < metrics.length; i++) {
        const v     = getValue(metrics[i]);
        const fired = dir === '>' ? v > threshold : v < threshold;
        if (fired &&  moves[i]) tp++;
        if (fired && !moves[i]) fp++;
        if (!fired && moves[i]) fn++;
      }
      const precision = tp / (tp + fp) || 0;
      const recall    = tp / (tp + fn) || 0;
      const f1Score   = 2*precision*recall / (precision + recall) || 0;
      const total     = tp + fp;
      return {
        variable, threshold, direction: dir,
        precision, recall, f1Score,
        truePositives: tp, falsePositives: fp, falseNegatives: fn,
        totalSignals: total,
        signalRate: total / metrics.length,
        liftOverBase: baseRate > 0 ? precision / baseRate : 0,
      };
    }).sort((a, b) => b.f1Score - a.f1Score);
  }

  private testCombinations(
    metrics: NormalizedMetrics[], moves: boolean[], baseRate: number, N: number
  ): ComboResult[] {
    const combos: Array<{ desc: string; gate: (m: NormalizedMetrics) => boolean }> = [
      { desc: 'pegZscore < -0.5 AND deltaPeg > 0',
        gate: m => m.pegZscore < -0.5 && m.deltaPeg > 0 },
      { desc: 'pegZscore < -0.75 AND deltaPeg > 0',
        gate: m => m.pegZscore < -0.75 && m.deltaPeg > 0 },
      { desc: 'pegZscore < -0.5 AND deltaPeg > 0 AND vacuumScore > 0.20',
        gate: m => m.pegZscore < -0.5 && m.deltaPeg > 0 && m.vacuumScore > 0.20 },
      { desc: 'pegZscore < -0.5 AND deltaPeg > 0 AND vacuumScore > 0.25',
        gate: m => m.pegZscore < -0.5 && m.deltaPeg > 0 && m.vacuumScore > 0.25 },
      { desc: 'pegZscore < -1.0 AND deltaPeg > 0 AND vacuumScore > 0.20',
        gate: m => m.pegZscore < -1.0 && m.deltaPeg > 0 && m.vacuumScore > 0.20 },
      { desc: 'pegZscore < -0.5 AND delta2Peg > 0 AND vacuumScore > 0.20',
        gate: m => m.pegZscore < -0.5 && m.delta2Peg > 0 && m.vacuumScore > 0.20 },
      { desc: 'pegZscore < -0.5 AND deltaPeg > 0 AND delta2Peg > 0',
        gate: m => m.pegZscore < -0.5 && m.deltaPeg > 0 && m.delta2Peg > 0 },
      { desc: 'pegZscore < -0.5 AND deltaPeg > 0 AND delta2Peg > 0 AND vacuumScore > 0.20',
        gate: m => m.pegZscore < -0.5 && m.deltaPeg > 0 && m.delta2Peg > 0 && m.vacuumScore > 0.20 },
      { desc: 'compressionScore > 0.3 AND deltaPeg > 0 AND pegZscore < -0.25',
        gate: m => m.compressionScore > 0.3 && m.deltaPeg > 0 && m.pegZscore < -0.25 },
      { desc: 'compressionScore > 0.3 AND volumeContraction > 0.2 AND pegZscore < -0.25',
        gate: m => m.compressionScore > 0.3 && m.volumeContraction > 0.2 && m.pegZscore < -0.25 },
    ];
    return combos.map(({ desc, gate }) => {
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < metrics.length; i++) {
        const fired = gate(metrics[i]);
        if (fired &&  moves[i]) tp++;
        if (fired && !moves[i]) fp++;
        if (!fired && moves[i]) fn++;
      }
      const precision = tp / (tp + fp) || 0;
      const recall    = tp / (tp + fn) || 0;
      const f1Score   = 2*precision*recall / (precision + recall) || 0;
      return {
        description: desc, precision, recall, f1Score,
        totalSignals: tp + fp, signalRate: (tp + fp) / N,
        liftOverBase: baseRate > 0 ? precision / baseRate : 0,
      };
    }).sort((a, b) => b.f1Score - a.f1Score);
  }

  private compositeSearch(
    metrics: NormalizedMetrics[], moves: boolean[], baseRate: number
  ): CompositeWeightResult {
    const weightSets = [
      { pegLow: 0.40, deltaPegFromLow: 0.30, vacuum: 0.20, coherence: 0.10 },
      { pegLow: 0.35, deltaPegFromLow: 0.35, vacuum: 0.20, coherence: 0.10 },
      { pegLow: 0.35, deltaPegFromLow: 0.30, vacuum: 0.25, coherence: 0.10 },
      { pegLow: 0.30, deltaPegFromLow: 0.35, vacuum: 0.25, coherence: 0.10 },
      { pegLow: 0.40, deltaPegFromLow: 0.35, vacuum: 0.15, coherence: 0.10 },
      { pegLow: 0.45, deltaPegFromLow: 0.30, vacuum: 0.15, coherence: 0.10 },
      { pegLow: 0.30, deltaPegFromLow: 0.40, vacuum: 0.20, coherence: 0.10 },
      { pegLow: 0.50, deltaPegFromLow: 0.25, vacuum: 0.15, coherence: 0.10 },
      { pegLow: 0.40, deltaPegFromLow: 0.40, vacuum: 0.10, coherence: 0.10 },
      { pegLow: 0.55, deltaPegFromLow: 0.25, vacuum: 0.10, coherence: 0.10 },
    ];
    const cutoffs = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.58, 0.60, 0.65];
    let best: CompositeWeightResult | null = null;

    for (const w of weightSets) {
      for (const cutoff of cutoffs) {
        let tp = 0, fp = 0, fn = 0;
        for (let i = 0; i < metrics.length; i++) {
          const m     = metrics[i];
          const score = Math.min(1,
            w.pegLow          * m.pegLow          +
            w.deltaPegFromLow * m.deltaPegFromLow  +
            w.vacuum          * m.vacuumScore       +
            w.coherence       * m.coherenceNorm
          );
          const fired = score >= cutoff;
          if (fired &&  moves[i]) tp++;
          if (fired && !moves[i]) fp++;
          if (!fired && moves[i]) fn++;
        }
        const precision = tp / (tp + fp) || 0;
        const recall    = tp / (tp + fn) || 0;
        const f1Score   = 2*precision*recall / (precision + recall) || 0;
        const candidate: CompositeWeightResult = {
          weights: w, cutoff, precision, recall, f1Score,
          totalSignals: tp + fp,
          liftOverBase: baseRate > 0 ? precision / baseRate : 0,
        };
        if (!best || f1Score > best.f1Score) best = candidate;
      }
    }
    return best!;
  }

  private buildReport(
    baseRate: number,
    pegZ: ThresholdResult[], delta: ThresholdResult[], vac: ThresholdResult[],
    combos: ComboResult[], comp: CompositeWeightResult,
    dist: OptimizationReport['distribution'], N: number,
  ): OptimizationReport {
    return {
      baseRate, pegZscoreResults: pegZ, deltaPegResults: delta,
      vacuumResults: vac, comboResults: combos, bestComposite: comp, distribution: dist,
      recommendation: {
        pegZscoreGate:         pegZ[0].threshold,
        deltaPegGate:          delta[0].threshold,
        vacuumGate:            vac[0].threshold,
        compositeWeights:      comp.weights,
        compositeCutoff:       comp.cutoff,
        expectedTradesPerYear: Math.round(comp.totalSignals / N * 8760),
        expectedPrecision:     comp.precision,
        expectedRecall:        comp.recall,
        expectedLift:          comp.liftOverBase,
      },
    };
  }

  private printDistribution(d: OptimizationReport['distribution'], base: number) {
    console.log(`\n📈 DISTRIBUTION ANALYSIS  (base rate: ${(base*100).toFixed(1)}%)`);
    console.log('─'.repeat(74));
    console.log('Variable          | Move avg   | No-move avg | Separation | Signal direction');
    console.log('─'.repeat(74));
    for (const [name, v] of Object.entries(d)) {
      const sep = v.separation;
      const quality = Math.abs(sep) > 0.3 ? '✅ strong' : Math.abs(sep) > 0.1 ? '⚠️  moderate' : '❌ weak';
      const dir = sep < 0 ? '← INVERT (gate < threshold)' : '← gate > threshold';
      console.log(
        `${name.padEnd(17)} | ${v.moveAvg.toFixed(4).padStart(10)} | ${v.noMoveAvg.toFixed(4).padStart(11)} | ${sep.toFixed(4).padStart(10)} | ${quality} ${dir}`
      );
    }
    console.log('─'.repeat(74));
  }

  private printThresholdTable(results: ThresholdResult[], title: string) {
    console.log(`\n  ${title}`);
    console.log('  ' + '─'.repeat(76));
    console.log('  Threshold | Precision | Recall  | F1     | Signals | Lift  | Grade');
    console.log('  ' + '─'.repeat(76));
    for (const r of results) {
      const grade =
        r.liftOverBase > 1.5 && r.recall > 0.40 ? '🎯 excellent' :
        r.liftOverBase > 1.3 && r.recall > 0.25 ? '✅ good      ' :
        r.liftOverBase > 1.1                     ? '⚠️  marginal ' :
                                                   '❌ no edge   ';
      console.log(
        `  ${r.direction}${r.threshold.toFixed(3).padEnd(8)} | ` +
        `${(r.precision*100).toFixed(1).padStart(8)}% | ` +
        `${(r.recall*100).toFixed(1).padStart(6)}% | ` +
        `${(r.f1Score*100).toFixed(1).padStart(5)}% | ` +
        `${r.totalSignals.toString().padStart(7)} | ` +
        `${r.liftOverBase.toFixed(2).padStart(5)}x | ${grade}`
      );
    }
    console.log('  ' + '─'.repeat(76));
    console.log(`  ⭐ Best: ${results[0].direction}${results[0].threshold} | F1=${(results[0].f1Score*100).toFixed(1)}% | lift=${results[0].liftOverBase.toFixed(2)}x`);
  }

  private printCombinations(combos: ComboResult[]) {
    console.log('\n  COMBINATION GATE RESULTS (sorted by F1)');
    console.log('  ' + '─'.repeat(84));
    console.log('       Precision | Recall  | F1     | Signals | Lift  | Gate');
    console.log('  ' + '─'.repeat(84));
    for (const c of combos) {
      const icon = c.liftOverBase > 1.4 ? '✅' : c.liftOverBase > 1.1 ? '⚠️ ' : '❌';
      console.log(
        `  ${icon} ${(c.precision*100).toFixed(1).padStart(8)}% | ` +
        `${(c.recall*100).toFixed(1).padStart(6)}% | ` +
        `${(c.f1Score*100).toFixed(1).padStart(5)}% | ` +
        `${c.totalSignals.toString().padStart(7)} | ` +
        `${c.liftOverBase.toFixed(2).padStart(5)}x | ${c.description}`
      );
    }
  }

  private printComposite(r: CompositeWeightResult, base: number) {
    console.log(`\n  BEST COMPOSITE:`);
    console.log(`  Weights: pegLow=${r.weights.pegLow} | deltaPegFromLow=${r.weights.deltaPegFromLow} | vacuum=${r.weights.vacuum} | coherence=${r.weights.coherence}`);
    console.log(`  Cutoff: ${r.cutoff} | Precision: ${(r.precision*100).toFixed(1)}% (${r.liftOverBase.toFixed(2)}x lift) | Recall: ${(r.recall*100).toFixed(1)}% | F1: ${(r.f1Score*100).toFixed(1)}%`);
  }

  private printRecommendation(report: OptimizationReport) {
    const r = report.recommendation;
    console.log('\n' + '='.repeat(70));
    console.log('🎯 FINAL CONFIG — Copy into pressureFragilityEngine.ts');
    console.log('='.repeat(70));
    console.log('');
    console.log(`// PEG gate INVERTED: fire when PEG is coiling (below its rolling average)`);
    console.log(`const PEG_ZSCORE_GATE   = ${r.pegZscoreGate};   // pegZscore < this`);
    console.log(`const DELTA_PEG_GATE    = ${r.deltaPegGate};  // deltaPegFromLow > this`);
    console.log(`const VACUUM_GATE       = ${r.vacuumGate};   // vacuumScore > this`);
    console.log('');
    console.log('const COMPOSITE_WEIGHTS = {');
    console.log(`  pegLow:          ${r.compositeWeights.pegLow},`);
    console.log(`  deltaPegFromLow: ${r.compositeWeights.deltaPegFromLow},`);
    console.log(`  vacuum:          ${r.compositeWeights.vacuum},`);
    console.log(`  coherence:       ${r.compositeWeights.coherence},`);
    console.log('};');
    console.log(`const COMPOSITE_CUTOFF_EXPLOSIVE = ${(r.compositeCutoff + 0.10).toFixed(2)};`);
    console.log(`const COMPOSITE_CUTOFF_HIGH      = ${r.compositeCutoff.toFixed(2)};`);
    console.log(`const COMPOSITE_CUTOFF_MEDIUM    = ${Math.max(0.25, r.compositeCutoff - 0.08).toFixed(2)};`);
    console.log('');
    console.log('Expected:');
    console.log(`  Trades/year:  ~${r.expectedTradesPerYear.toLocaleString()}`);
    console.log(`  Precision:    ${(r.expectedPrecision*100).toFixed(1)}%  (${r.expectedLift.toFixed(2)}x lift)`);
    console.log(`  Recall:       ${(r.expectedRecall*100).toFixed(1)}%`);
    console.log('='.repeat(70));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export async function runPressureFragilityOptimization(
  ticks: MarketTick[],
  minMovePercent = 0.015,
  lookAhead      = 15,
): Promise<OptimizationReport> {
  return new PressureFragilityOptimizer().optimize(ticks, minMovePercent, lookAhead);
}

/** Legacy alias */
export async function runPEGOptimization(ticks: MarketTick[]) {
  const report = await runPressureFragilityOptimization(ticks);
  const r      = report.recommendation;
  return {
    results: [report.pegZscoreResults[0], report.deltaPegResults[0], report.vacuumResults[0]],
    recommendation: {
      threshold:             r.pegZscoreGate,
      precision:             r.expectedPrecision,
      recall:                r.expectedRecall,
      f1Score:               report.bestComposite.f1Score,
      deltaPegGate:          r.deltaPegGate,
      vacuumGate:            r.vacuumGate,
      compositeWeights:      r.compositeWeights,
      compositeCutoff:       r.compositeCutoff,
      expectedTradesPerYear: r.expectedTradesPerYear,
      liftOverBase:          r.expectedLift,
    },
  };
}

export default PressureFragilityOptimizer;