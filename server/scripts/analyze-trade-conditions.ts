/**
 * Trade Condition Analyzer
 * 
 * Analyzes enriched real trade logs to find which conditions separate winners from losers
 * 
 * PROBLEM SOLVED:
 *   Previous DirectionalEdgeAuditor measured synthetic signals from noise (39.6% WR)
 *   Real system achieves 65% WR - that 25% gap is the entire filtering pipeline
 * 
 * NEW APPROACH:
 *   Analyze the 6,500+ REAL trades where the signal already fired
 *   Find conditions that identify the 35% losers → become exclusion filters
 *   Don't rebuild from synthetic data, analyze what worked
 * 
 * ANALYSIS SLICES:
 *   - PEG z-score buckets (coiling, neutral, spent)
 *   - Turbulence index ranges
 *   - Coherence levels
 *   - Volume bias (bull/bear/neutral)
 *   - Regime type
 *   - Combinations of above
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/analyze-trade-conditions.ts [symbol] [logfile]
 *   
 * Examples:
 *   pnpm exec tsx server/scripts/analyze-trade-conditions.ts BTC
 *     (uses most recent BTC trade log)
 *   pnpm exec tsx server/scripts/analyze-trade-conditions.ts ETH ./data/trade-logs/ETH_trades_2026-03-12T07.csv
 */

import * as fs from 'fs';
import * as path from 'path';

interface TradeRecord {
  entryTime: string;
  exitTime: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  winner: boolean;
  exitReason: string;
  exitMethod: string;
  regimeAtEntry: string;
  regimeAtExit: string;
  signalPEG: string | number;
  signalPEGZscore: string | number;
  signalTurbulenceIndex: string | number;
  signalCoherence: string | number;
  signalVolBias: string | number;
  signalStrength: string | number;
  signalConfidenceAtEntry: string | number;
  riskRewardRatio: string | number;
}

interface ConditionSlice {
  label: string;
  trades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  stopHitTrades: number;
  stopHitWR: number;
  dataQuality: number; // % of trades with valid data for this condition
}

function findLatestTradeLog(symbol: string): string {
  const logDir = './data/trade-logs';
  if (!fs.existsSync(logDir)) {
    throw new Error(`Trade log directory not found: ${logDir}`);
  }

  const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith(symbol) && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No trade logs found for ${symbol} in ${logDir}`);
  }

  return path.join(logDir, files[0]);
}

function parseCSV(filename: string): TradeRecord[] {
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has only headers');
  }

  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const records: TradeRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
    if (values.length !== headers.length) continue;

    const record: any = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      const v = values[j];

      // Parse numeric fields
      if (['entryPrice', 'exitPrice', 'pnlPct', 'riskRewardRatio'].includes(h)) {
        record[h] = parseFloat(v) || 0;
      } else if (['signalPEG', 'signalPEGZscore', 'signalTurbulenceIndex', 'signalCoherence', 'signalVolBias', 'signalStrength', 'signalConfidenceAtEntry'].includes(h)) {
        record[h] = v === '' ? null : parseFloat(v);
      } else if (h === 'winner') {
        record[h] = v === 'true';
      } else {
        record[h] = v;
      }
    }

    records.push(record as TradeRecord);
  }

  return records;
}

function buildSlice(label: string, trades: TradeRecord[]): ConditionSlice | null {
  if (trades.length === 0) return null;

  const winners = trades.filter(t => t.winner);
  const losers = trades.filter(t => !t.winner);
  const stopHits = trades.filter(t => t.exitReason === 'stop_hit');

  const winRate = winners.length / trades.length;
  const avgPnL = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0;

  // Data quality: what % have valid (non-empty) signal data
  const validData = trades.filter(t => t.signalPEGZscore !== null && t.signalPEGZscore !== undefined);
  const dataQuality = trades.length > 0 ? validData.length / trades.length : 0;

  return {
    label,
    trades: trades.length,
    winners: winners.length,
    losers: losers.length,
    winRate,
    avgPnL,
    avgWin,
    avgLoss,
    stopHitTrades: stopHits.length,
    stopHitWR: stopHits.length > 0 ? stopHits.filter(t => t.winner).length / stopHits.length : 0,
    dataQuality,
  };
}

function classifyPEGBucket(zscore: number | null): string | null {
  if (zscore === null || zscore === undefined) return null;
  if (zscore < -0.5) return 'coiling';
  if (zscore > 0.5) return 'spent';
  return 'neutral';
}

function classifyVolBias(bias: number | null): string | null {
  if (bias === null || bias === undefined) return null;
  if (bias >= 0.65) return 'bullish(≥65%)';
  if (bias <= 0.35) return 'bearish(≤35%)';
  return 'neutral';
}

function classifyCoherence(coh: number | null): string {
  if (coh === null || coh === undefined) return 'unknown';
  if (coh >= 0.005) return 'high(≥0.005)';
  if (coh >= 0.002) return 'medium(≥0.002)';
  return 'low(<0.002)';
}

function classifyTurbulenceIndex(ti: number | null): string {
  if (ti === null || ti === undefined) return 'unknown';
  if (ti > 2.0) return 'extreme(>2.0)';
  if (ti > 1.2) return 'high(1.2-2.0)';
  if (ti > 0.6) return 'moderate(0.6-1.2)';
  return 'low(<0.6)';
}

async function main() {
  try {
    console.log('📊 TRADE CONDITION ANALYZER');
    console.log('='.repeat(80));
    console.log('');

    const args = process.argv.slice(2);
    const symbol = args[0]?.toUpperCase() || 'BTC';
    let logfile = args[1];

    if (!logfile) {
      logfile = findLatestTradeLog(symbol);
      console.log(`📁 Using latest trade log: ${path.basename(logfile)}`);
    } else if (!fs.existsSync(logfile)) {
      console.error(`❌ Trade log not found: ${logfile}`);
      process.exit(1);
    }

    console.log(`📖 Loading trades from: ${logfile}\n`);

    // Parse trades
    const trades = parseCSV(logfile);
    console.log(`✅ Loaded ${trades.length} trades\n`);

    // Baseline
    const baseline = buildSlice('ALL TRADES (baseline)', trades);
    if (!baseline) {
      console.error('❌ No trades found in log');
      process.exit(1);
    }

    console.log('═'.repeat(80));
    console.log('📊 BASELINE — ALL TRADES (no filter)');
    console.log('═'.repeat(80));
    console.log(`  Trades:                ${baseline.trades}`);
    console.log(`  Win Rate:              ${(baseline.winRate * 100).toFixed(1)}%`);
    console.log(`  Avg PnL:               ${(baseline.avgPnL * 100).toFixed(3)}%`);
    console.log(`  Avg Win:               ${(baseline.avgWin * 100).toFixed(3)}%`);
    console.log(`  Avg Loss:              ${(baseline.avgLoss * 100).toFixed(3)}%`);
    console.log(`  Stop-hit trades:       ${baseline.stopHitTrades} (${(baseline.stopHitWR * 100).toFixed(1)}% WR)`);
    console.log(`  Data Quality:          ${(baseline.dataQuality * 100).toFixed(0)}%`);
    console.log('');

    // Slice by PEG z-score buckets
    console.log('═'.repeat(80));
    console.log('🔹 PEG Z-SCORE BUCKETS');
    console.log('═'.repeat(80));
    const byPegBucket: Record<string, ConditionSlice | null> = {};
    for (const bucket of ['coiling', 'neutral', 'spent']) {
      const filtered = trades.filter(t => classifyPEGBucket(typeof t.signalPEGZscore === 'string' ? Number(t.signalPEGZscore) : t.signalPEGZscore) === bucket);
      byPegBucket[bucket] = buildSlice(bucket, filtered);
      if (byPegBucket[bucket]) {
        const s = byPegBucket[bucket]!;
        const improvement = ((s.winRate - baseline.winRate) / baseline.winRate * 100);
        const icon = s.winRate > baseline.winRate ? '🟢' : '🔴';
        console.log(`${icon} ${s.label.padEnd(15)} | ${s.trades.toString().padStart(4)} trades | WR ${(s.winRate * 100).toFixed(1).padStart(5)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%) | Avg PnL ${(s.avgPnL * 100).toFixed(3)}%`);
      }
    }
    console.log('');

    // Slice by turbulence index
    console.log('═'.repeat(80));
    console.log('🔹 TURBULENCE INDEX RANGES');
    console.log('═'.repeat(80));
    const byTurbulence: Record<string, ConditionSlice | null> = {};
    for (const ti of ['extreme(>2.0)', 'high(1.2-2.0)', 'moderate(0.6-1.2)', 'low(<0.6)']) {
      const filtered = trades.filter(t => classifyTurbulenceIndex(typeof t.signalTurbulenceIndex === 'string' ? Number(t.signalTurbulenceIndex) : t.signalTurbulenceIndex) === ti);
      byTurbulence[ti] = buildSlice(ti, filtered);
      if (byTurbulence[ti]) {
        const s = byTurbulence[ti]!;
        const improvement = ((s.winRate - baseline.winRate) / baseline.winRate * 100);
        const icon = s.winRate > baseline.winRate ? '🟢' : '🔴';
        console.log(`${icon} ${s.label.padEnd(15)} | ${s.trades.toString().padStart(4)} trades | WR ${(s.winRate * 100).toFixed(1).padStart(5)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%) | Avg PnL ${(s.avgPnL * 100).toFixed(3)}%`);
      }
    }
    console.log('');

    // Slice by coherence
    console.log('═'.repeat(80));
    console.log('🔹 COHERENCE LEVELS');
    console.log('═'.repeat(80));
    const byCoherence: Record<string, ConditionSlice | null> = {};
    for (const coh of ['high(≥0.005)', 'medium(≥0.002)', 'low(<0.002)']) {
      const filtered = trades.filter(t => classifyCoherence(typeof t.signalCoherence === 'string' ? Number(t.signalCoherence) : t.signalCoherence) === coh);
      byCoherence[coh] = buildSlice(coh, filtered);
      if (byCoherence[coh]) {
        const s = byCoherence[coh]!;
        const improvement = ((s.winRate - baseline.winRate) / baseline.winRate * 100);
        const icon = s.winRate > baseline.winRate ? '🟢' : '🔴';
        console.log(`${icon} ${s.label.padEnd(15)} | ${s.trades.toString().padStart(4)} trades | WR ${(s.winRate * 100).toFixed(1).padStart(5)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%) | Avg PnL ${(s.avgPnL * 100).toFixed(3)}%`);
      }
    }
    console.log('');

    // Slice by volume bias
    console.log('═'.repeat(80));
    console.log('🔹 VOLUME BIAS');
    console.log('═'.repeat(80));
    const byVolBias: Record<string, ConditionSlice | null> = {};
    for (const bias of ['bullish(≥65%)', 'neutral', 'bearish(≤35%)']) {
      const filtered = trades.filter(t => classifyVolBias(typeof t.signalVolBias === 'string' ? Number(t.signalVolBias) : t.signalVolBias) === bias);
      byVolBias[bias] = buildSlice(bias, filtered);
      if (byVolBias[bias]) {
        const s = byVolBias[bias]!;
        const improvement = ((s.winRate - baseline.winRate) / baseline.winRate * 100);
        const icon = s.winRate > baseline.winRate ? '🟢' : '🔴';
        console.log(`${icon} ${s.label.padEnd(15)} | ${s.trades.toString().padStart(4)} trades | WR ${(s.winRate * 100).toFixed(1).padStart(5)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%) | Avg PnL ${(s.avgPnL * 100).toFixed(3)}%`);
      }
    }
    console.log('');

    // Stop-hit analysis (which conditions predict losers?)
    console.log('═'.repeat(80));
    console.log('🚨 STOP-HIT ANALYSIS (exit reason = stop_hit)');
    console.log('═'.repeat(80));
    console.log(`Total stop-hits: ${trades.filter(t => t.exitReason === 'stop_hit').length} / ${trades.length}`);
    console.log('Conditions that produce MOST stop-hits (potential exclusion filters):');
    console.log('');

    const stopHitsByPeg = trades.filter(t => t.exitReason === 'stop_hit' && t.signalPEGZscore !== null);
    const stopHitsByTI = trades.filter(t => t.exitReason === 'stop_hit' && t.signalTurbulenceIndex !== null);
    const stopHitsByCoherence = trades.filter(t => t.exitReason === 'stop_hit' && t.signalCoherence !== null);

    console.log(`  PEG coiling (when signal hit stop):   ${stopHitsByPeg.filter(t => classifyPEGBucket(typeof t.signalPEGZscore === 'string' ? Number(t.signalPEGZscore) : t.signalPEGZscore) === 'coiling').length} / ${stopHitsByPeg.length}`);
    console.log(`  TI extreme (when signal hit stop):    ${stopHitsByTI.filter(t => classifyTurbulenceIndex(typeof t.signalTurbulenceIndex === 'string' ? Number(t.signalTurbulenceIndex) : t.signalTurbulenceIndex) === 'extreme(>2.0)').length} / ${stopHitsByTI.length}`);
    console.log(`  Low coherence (when signal hit stop): ${stopHitsByCoherence.filter(t => classifyCoherence(typeof t.signalCoherence === 'string' ? Number(t.signalCoherence) : t.signalCoherence) === 'low(<0.002)').length} / ${stopHitsByCoherence.length}`);
    console.log('');

    console.log('═'.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('');
    console.log('KEY INSIGHTS:');
    console.log('  • Conditions with WR > baseline are ENTRY FILTERS (boost trades to use)');
    console.log('  • Conditions with low coherence/high TI may identify bad entries (SKIP)');
    console.log('  • Stop-hit analysis shows which conditions predict losers');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. If coherence REDUCES win rate → add "signalCoherence >= 0.005" filter');
    console.log('  2. If turbulence INCREASES stop-hits → reduce position size in high TI');
    console.log('  3. If PEG spent has high WR → bias entries toward end of compression');
    console.log('');

  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED:', error);
    process.exit(1);
  }
}

main();
