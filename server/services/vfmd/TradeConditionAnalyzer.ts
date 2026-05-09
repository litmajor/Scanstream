/**
 * Trade Condition Analyzer
 *
 * Analyzes conditions on REAL trades from backtest logs, not synthetic signals.
 *
 * CORRECT EXPERIMENT:
 *   Input: Trade log from backtest with enriched metadata
 *     {timestamp, symbol, direction, pnlPct, winner, exitReason,
 *      peg, pegZscore, ti, coherence, regime, volBias, mtf4h}
 *
 *   Q: Within the 65% WR signal set, which conditions separate winners from losers?
 *   A: Slice by conditions, measure WR lift vs baseline
 *
 * WHAT THIS MEASURES:
 *   ✓ Signal quality (do certain regimes/coherence levels have better WR?)
 *   ✓ Exit quality (which conditions lead to stop_hit vs time_stop?)
 *   ✓ Entry timing (do high-PEG entries get stopped more often?)
 *   ✓ Combinations (regime + coherence + volBias, etc)
 *
 * OUTPUT:
 *   Ranked filters by WR lift over baseline
 *   Conditions to INCLUDE (high WR) and EXCLUDE (low WR with high stop_hit rate)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichedTrade {
  timestamp: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  exitCandles: number;
  pnlPct: number;
  winner: boolean;
  exitReason: 'time_stop' | 'stop_hit' | 'energy_decay' | 'opposite_signal' | 'trailing';
  
  // Signal conditions at entry
  peg: number;
  pegZscore: number;
  pegBucket: 'coiling' | 'neutral' | 'spent';
  ti: number;  // turbulence index
  coherence: number;
  regime: 'consolidation' | 'turbulent' | 'unknown';
  volBias: number;  // [0, 1]
  mtf4h: 'up' | 'down' | 'flat';
  mtfAgreement: boolean;
  
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

interface ConditionSlice {
  label: string;
  trades: number;
  winners: number;
  losers: number;
  stopHits: number;  // exits on stop_hit (subset of losers)
  timeStops: number; // exits on time_stop (subset of winners)
  
  winRate: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  
  liftVsBaseline: number;  // WR / baseline WR
  stopHitRate: number;     // what % of these got stopped? (risk of poor entry timing)
}

interface TradeConditionReport {
  summary: {
    totalTrades: number;
    symbol: string;
    dateRange: string;
    baselineWR: number;
    baselineAvgPnL: number;
    baselineStopHitRate: number;
  };
  
  byRegime: Record<string, ConditionSlice>;
  byCoherence: Record<string, ConditionSlice>;
  byPegBucket: Record<string, ConditionSlice>;
  byVolBias: Record<string, ConditionSlice>;
  byMTFAgreement: Record<string, ConditionSlice>;
  byExitReason: Record<string, ConditionSlice>;
  
  topFilters: Array<{
    name: string;
    trades: number;
    winRate: number;
    liftVsBaseline: number;
    avgPnL: number;
    stopHitRate: number;
    recommendation: 'INCLUDE' | 'EXCLUDE' | 'NEUTRAL';
  }>;
  
  recommendation: {
    includeFilters: string[];
    excludeFilters: string[];
    expectedWR: number;
    expectedAvgPnL: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analyzer
// ─────────────────────────────────────────────────────────────────────────────

export class TradeConditionAnalyzer {
  async run(trades: EnrichedTrade[]): Promise<TradeConditionReport> {
    console.log('\n📊 TRADE CONDITION ANALYZER (Real Backtest Data)');
    console.log('='.repeat(80));
    console.log(`Analyzing ${trades.length} real trades from backtest`);
    console.log('');

    // ── Baseline ────────────────────────────────────────────────────────────
    const baseline = this.buildSlice('ALL TRADES (baseline)', trades);
    console.log(`Baseline: ${(baseline.winRate*100).toFixed(1)}% WR | ${(baseline.avgPnl*100).toFixed(3)}% avg PnL`);
    console.log(`          ${(baseline.stopHitRate*100).toFixed(1)}% of trades hit stop (risk metric)\n`);

    // ── Single conditions ───────────────────────────────────────────────────
    console.log('📈 Slicing by conditions...\n');

    const byRegime = this.sliceBy(trades, baseline.winRate,
      t => t.regime,
      ['consolidation', 'turbulent', 'unknown']
    );

    const byCoherence = this.sliceBy(trades, baseline.winRate,
      t => t.coherence >= 0.008 ? 'high(≥0.008)' : t.coherence >= 0.004 ? 'med(0.004-0.008)' : 'low(<0.004)',
      ['high(≥0.008)', 'med(0.004-0.008)', 'low(<0.004)']
    );

    const byPegBucket = this.sliceBy(trades, baseline.winRate,
      t => t.pegBucket,
      ['coiling', 'neutral', 'spent']
    );

    const byVolBias = this.sliceBy(trades, baseline.winRate,
      t => t.volBias >= 0.60 ? 'bullish(≥60%)' : t.volBias <= 0.40 ? 'bearish(≤40%)' : 'neutral',
      ['bullish(≥60%)', 'neutral', 'bearish(≤40%)']
    );

    const byMTFAgreement = this.sliceBy(trades, baseline.winRate,
      t => t.mtfAgreement ? 'MTF_agree' : 'MTF_disagree',
      ['MTF_agree', 'MTF_disagree']
    );

    const byExitReason = this.sliceBy(trades, baseline.winRate,
      t => t.exitReason,
      ['time_stop', 'stop_hit', 'energy_decay', 'opposite_signal', 'trailing']
    );

    // ── Print results ───────────────────────────────────────────────────────
    this.printSlices('REGIME', byRegime);
    this.printSlices('COHERENCE', byCoherence);
    this.printSlices('PEG BUCKET', byPegBucket);
    this.printSlices('VOLUME BIAS', byVolBias);
    this.printSlices('MTF AGREEMENT', byMTFAgreement);
    this.printSlices('EXIT REASON', byExitReason);

    // ── Build recommendations ───────────────────────────────────────────────
    const topFilters = this.rankFilters(
      byRegime, byCoherence, byPegBucket, byVolBias, byMTFAgreement, byExitReason,
      baseline
    );

    this.printTopFilters(topFilters);

    const recommendation = this.buildRecommendation(topFilters, baseline);
    this.printRecommendation(recommendation, baseline);

    return {
      summary: {
        totalTrades: trades.length,
        symbol: trades[0]?.symbol ?? 'UNKNOWN',
        dateRange: trades.length > 0
          ? `${trades[0].timestamp} to ${trades[trades.length-1].timestamp}`
          : 'N/A',
        baselineWR: baseline.winRate,
        baselineAvgPnL: baseline.avgPnl,
        baselineStopHitRate: baseline.stopHitRate,
      },
      byRegime, byCoherence, byPegBucket, byVolBias, byMTFAgreement, byExitReason,
      topFilters,
      recommendation,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  private buildSlice(label: string, trades: EnrichedTrade[]): ConditionSlice {
    if (trades.length === 0) return {
      label,
      trades: 0, winners: 0, losers: 0, stopHits: 0, timeStops: 0,
      winRate: 0, avgPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
      liftVsBaseline: 0, stopHitRate: 0,
    };

    const winners = trades.filter(t => t.winner);
    const losers = trades.filter(t => !t.winner);
    const stopHits = trades.filter(t => t.exitReason === 'stop_hit');
    const timeStops = trades.filter(t => t.exitReason === 'time_stop');

    const winRate = winners.length / trades.length;
    const avgPnl = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0;

    const grossWin = winners.reduce((s, t) => s + Math.abs(t.pnlPct), 0);
    const grossLoss = losers.reduce((s, t) => s + Math.abs(t.pnlPct), 0);

    return {
      label,
      trades: trades.length,
      winners: winners.length,
      losers: losers.length,
      stopHits: stopHits.length,
      timeStops: timeStops.length,
      winRate,
      avgPnl,
      avgWin,
      avgLoss,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : 99,
      liftVsBaseline: 0,  // filled by caller
      stopHitRate: trades.length > 0 ? stopHits.length / trades.length : 0,
    };
  }

  private sliceBy(
    trades: EnrichedTrade[],
    baselineWR: number,
    getLabel: (t: EnrichedTrade) => string,
    order: string[],
  ): Record<string, ConditionSlice> {
    const groups: Record<string, EnrichedTrade[]> = {};
    for (const label of order) groups[label] = [];
    for (const t of trades) {
      const label = getLabel(t);
      if (label in groups) groups[label].push(t);
    }

    const result: Record<string, ConditionSlice> = {};
    for (const [label, slice] of Object.entries(groups)) {
      const condition = this.buildSlice(label, slice);
      condition.liftVsBaseline = baselineWR > 0 ? condition.winRate / baselineWR : 0;
      result[label] = condition;
    }
    return result;
  }

  private rankFilters(
    byRegime: Record<string, ConditionSlice>,
    byCoherence: Record<string, ConditionSlice>,
    byPegBucket: Record<string, ConditionSlice>,
    byVolBias: Record<string, ConditionSlice>,
    byMTFAgreement: Record<string, ConditionSlice>,
    byExitReason: Record<string, ConditionSlice>,
    baseline: ConditionSlice,
  ): TradeConditionReport['topFilters'] {
    const filters: TradeConditionReport['topFilters'] = [];

    for (const [name, slice] of Object.entries(byRegime)) {
      filters.push({
        name: `regime=${name}`,
        trades: slice.trades,
        winRate: slice.winRate,
        liftVsBaseline: slice.liftVsBaseline,
        avgPnL: slice.avgPnl,
        stopHitRate: slice.stopHitRate,
        recommendation: this.getRecommendation(slice, baseline),
      });
    }

    for (const [name, slice] of Object.entries(byCoherence)) {
      filters.push({
        name: `coherence=${name}`,
        trades: slice.trades,
        winRate: slice.winRate,
        liftVsBaseline: slice.liftVsBaseline,
        avgPnL: slice.avgPnl,
        stopHitRate: slice.stopHitRate,
        recommendation: this.getRecommendation(slice, baseline),
      });
    }

    for (const [name, slice] of Object.entries(byPegBucket)) {
      filters.push({
        name: `peg=${name}`,
        trades: slice.trades,
        winRate: slice.winRate,
        liftVsBaseline: slice.liftVsBaseline,
        avgPnL: slice.avgPnl,
        stopHitRate: slice.stopHitRate,
        recommendation: this.getRecommendation(slice, baseline),
      });
    }

    for (const [name, slice] of Object.entries(byVolBias)) {
      filters.push({
        name: `volBias=${name}`,
        trades: slice.trades,
        winRate: slice.winRate,
        liftVsBaseline: slice.liftVsBaseline,
        avgPnL: slice.avgPnl,
        stopHitRate: slice.stopHitRate,
        recommendation: this.getRecommendation(slice, baseline),
      });
    }

    for (const [name, slice] of Object.entries(byMTFAgreement)) {
      filters.push({
        name: `mtf=${name}`,
        trades: slice.trades,
        winRate: slice.winRate,
        liftVsBaseline: slice.liftVsBaseline,
        avgPnL: slice.avgPnl,
        stopHitRate: slice.stopHitRate,
        recommendation: this.getRecommendation(slice, baseline),
      });
    }

    return filters.sort((a, b) => b.liftVsBaseline - a.liftVsBaseline);
  }

  private getRecommendation(
    slice: ConditionSlice,
    baseline: ConditionSlice,
  ): 'INCLUDE' | 'EXCLUDE' | 'NEUTRAL' {
    // INCLUDE: ≥10% more trades AND higher WR AND lower stop_hit rate
    if (
      slice.trades >= baseline.trades * 0.1 &&
      slice.winRate >= baseline.winRate * 1.05 &&
      slice.stopHitRate <= baseline.stopHitRate * 1.1
    ) {
      return 'INCLUDE';
    }

    // EXCLUDE: significantly lower WR OR much higher stop_hit rate
    if (
      slice.winRate < baseline.winRate * 0.95 &&
      slice.stopHitRate > baseline.stopHitRate * 1.5
    ) {
      return 'EXCLUDE';
    }

    return 'NEUTRAL';
  }

  private buildRecommendation(
    filters: TradeConditionReport['topFilters'],
    baseline: ConditionSlice,
  ): TradeConditionReport['recommendation'] {
    const includes = filters
      .filter(f => f.recommendation === 'INCLUDE' && f.trades >= 20)
      .slice(0, 3)
      .map(f => f.name);

    const excludes = filters
      .filter(f => f.recommendation === 'EXCLUDE' && f.trades >= 20)
      .slice(0, 3)
      .map(f => f.name);

    // Expected performance if we filter
    const expectedWR = includes.length > 0
      ? filters.filter(f => includes.some(inc => f.name.includes(inc)))
          .reduce((sum, f) => sum + f.winRate, 0) / includes.length
      : baseline.winRate;

    const expectedAvgPnL = includes.length > 0
      ? filters.filter(f => includes.some(inc => f.name.includes(inc)))
          .reduce((sum, f) => sum + f.avgPnL, 0) / includes.length
      : baseline.avgPnl;

    return {
      includeFilters: includes.length > 0 ? includes : ['none (keep baseline)'],
      excludeFilters: excludes.length > 0 ? excludes : ['none'],
      expectedWR,
      expectedAvgPnL,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  private printSlices(title: string, slices: Record<string, ConditionSlice>) {
    console.log(`── ${title}`);
    const header = 'Label                 | Trades | WR      | Avg PnL | PF    | Lift  | Stop%';
    const line = '─'.repeat(82);
    console.log(header);
    console.log(line);

    for (const [, slice] of Object.entries(slices)) {
      const icon = slice.liftVsBaseline > 1.10 ? '✅' : slice.liftVsBaseline < 0.90 ? '❌' : '➖';
      const label = slice.label.padEnd(18);
      console.log(
        `${icon} ${label} | ${slice.trades.toString().padStart(6)} | ${(slice.winRate*100).toFixed(1)}% | ` +
        `${(slice.avgPnl*100).toFixed(3)}%  | ${slice.profitFactor.toFixed(2)} | ${slice.liftVsBaseline.toFixed(2)}x | ${(slice.stopHitRate*100).toFixed(0)}%`
      );
    }
    console.log('');
  }

  private printTopFilters(filters: TradeConditionReport['topFilters']) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 TOP FILTERS (ranked by directional lift)');
    console.log('='.repeat(80));
    const header = 'Rank | Filter                        | Trades | WR     | Lift  | Avg PnL | Stop% | Action';
    const line = '─'.repeat(96);
    console.log(header);
    console.log(line);

    filters.slice(0, 15).forEach((f, i) => {
      const icon = f.recommendation === 'INCLUDE' ? '✅' : f.recommendation === 'EXCLUDE' ? '❌' : '➖';
      const name = f.name.substring(0, 26).padEnd(26);
      console.log(
        `${(i+1).toString().padStart(2)}  | ${name} | ${f.trades.toString().padStart(6)} | ${(f.winRate*100).toFixed(1)}% | ` +
        `${f.liftVsBaseline.toFixed(2)}x | ${(f.avgPnL*100).toFixed(3)}%  | ${(f.stopHitRate*100).toFixed(0)}% | ${f.recommendation}`
      );
    });
  }

  private printRecommendation(r: TradeConditionReport['recommendation'], baseline: ConditionSlice) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDATION');
    console.log('='.repeat(80));
    console.log('\n🟢 INCLUDE (higher WR, lower stop_hit rate):');
    r.includeFilters.forEach(f => console.log(`   • ${f}`));
    console.log('\n🔴 EXCLUDE (lower WR, higher stop_hit rate):');
    r.excludeFilters.forEach(f => console.log(`   • ${f}`));
    console.log('\n📊 Expected Performance (with filters):');
    console.log(`   Win Rate: ${(r.expectedWR*100).toFixed(1)}% (baseline: ${(baseline.winRate*100).toFixed(1)}%)`);
    console.log(`   Avg PnL: ${(r.expectedAvgPnL*100).toFixed(3)}% (baseline: ${(baseline.avgPnl*100).toFixed(3)}%)`);
  }
}

export default TradeConditionAnalyzer;
