/**
 * SIMPLE TRADE ANALYZER
 * 
 * Analyzes real backtest trades using available CSV columns:
 * - timestamp, symbol, direction, entryPrice, exitPrice, pnlPct
 * - regime, exitMethod, winner, exitReason, entryIndex, exitIndex, pnl, confidence
 * 
 * Analysis goals:
 *   1. Find regime × exitMethod combinations that predict winners
 *   2. Identify which regimes have highest stop rates
 *   3. Find entry conditions (via regime + entryIndex patterns) that avoid losers
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/analyze-trades-simple.ts [symbol] [logfile]
 * 
 * Examples:
 *   pnpm exec tsx server/scripts/analyze-trades-simple.ts BTC
 *   pnpm exec tsx server/scripts/analyze-trades-simple.ts ETH ./data/trade-logs/ETH_1h_2026-03-12.csv
 */

import * as fs from 'fs';
import * as path from 'path';

interface Trade {
  timestamp: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnl: number;
  regime: string;
  exitMethod: string;
  winner: boolean;
  exitReason?: string;
  entryIndex: number;
  exitIndex: number;
  confidence: number;
}

interface Slice {
  label: string;
  trades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  improvement: number; // vs baseline
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

function parseCSV(filename: string): Trade[] {
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has only headers');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log(`  Headers: ${headers.join(', ')}`);
  console.log(`  Header count: ${headers.length}\n`);

  const trades: Trade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length < headers.length) continue;

    const record: any = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      const v = values[j] || '';

      if (['entryPrice', 'exitPrice', 'pnlPct', 'pnl', 'confidence'].includes(h)) {
        record[h] = parseFloat(v) || 0;
      } else if (['entryIndex', 'exitIndex'].includes(h)) {
        record[h] = parseInt(v) || 0;
      } else if (h === 'winner') {
        record[h] = v.toLowerCase() === 'true' || v === '1';
      } else {
        record[h] = v;
      }
    }

    trades.push(record as Trade);
  }

  return trades;
}

function buildSlice(label: string, trades: Trade[], baseline: Slice): Slice {
  if (trades.length === 0) {
    return {
      label,
      trades: 0,
      winners: 0,
      losers: 0,
      winRate: 0,
      avgPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      improvement: 0,
    };
  }

  const winners = trades.filter(t => t.winner);
  const losers = trades.filter(t => !t.winner);

  const winRate = winners.length / trades.length;
  const avgPnL = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0;
  const improvement = ((winRate - baseline.winRate) / baseline.winRate) * 100;

  return {
    label,
    trades: trades.length,
    winners: winners.length,
    losers: losers.length,
    winRate,
    avgPnL,
    avgWin,
    avgLoss,
    improvement,
  };
}

function formatSlice(s: Slice): string {
  const icon = s.winRate > 0.5 ? '🟢' : '🔴';
  const impStr = s.improvement > 0 ? `+${s.improvement.toFixed(1)}%` : `${s.improvement.toFixed(1)}%`;
  
  return `${icon} ${s.label.padEnd(25)} | ${s.trades.toString().padStart(4)} trades | ${s.winners.toString().padStart(3)} W/${s.losers.toString().padStart(3)} L | WR ${(s.winRate * 100).toFixed(1).padStart(5)}% (${impStr.padStart(7)}) | Avg PnL ${(s.avgPnL * 100).toFixed(3).padStart(7)}% | Avg W ${(s.avgWin * 100).toFixed(3).padStart(7)}% / Avg L ${(s.avgLoss * 100).toFixed(3).padStart(7)}%`;
}

async function main() {
  try {
    console.log('\n' + '═'.repeat(200));
    console.log('📊 TRADE CONDITION ANALYZER (Simple Mode)');
    console.log('═'.repeat(200));
    console.log('');

    const args = process.argv.slice(2);
    const symbol = args[0]?.toUpperCase() || 'BTC';
    let logfile = args[1];

    if (!logfile) {
      logfile = findLatestTradeLog(symbol);
      console.log(`📁 Using latest trade log for ${symbol}:`);
    } else if (!fs.existsSync(logfile)) {
      console.error(`❌ Trade log not found: ${logfile}`);
      process.exit(1);
    }

    console.log(`   ${path.basename(logfile)}`);
    console.log('');

    // Parse trades
    console.log('📖 CSV Structure:');
    const trades = parseCSV(logfile);
    console.log(`✅ Loaded ${trades.length} trades\n`);

    // Baseline
    const baseline = buildSlice('ALL TRADES (baseline)', trades, {
      label: 'N/A',
      trades: 0,
      winners: 0,
      losers: 0,
      winRate: 0,
      avgPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      improvement: 0,
    });

    console.log('\n' + '═'.repeat(200));
    console.log('📊 BASELINE — ALL TRADES');
    console.log('═'.repeat(200));
    console.log(formatSlice(baseline));
    console.log('');

    // Analyze by regime
    console.log('\n' + '═'.repeat(200));
    console.log('🔹 BREAKDOWN BY REGIME');
    console.log('═'.repeat(200));

    const regimes = [...new Set(trades.map(t => t.regime))].sort();
    const byRegime: Record<string, Slice> = {};

    for (const regime of regimes) {
      const filtered = trades.filter(t => t.regime === regime);
      byRegime[regime] = buildSlice(`${regime}`, filtered, baseline);
      console.log(formatSlice(byRegime[regime]));
    }

    // Analyze by exit method
    console.log('\n' + '═'.repeat(200));
    console.log('🔹 BREAKDOWN BY EXIT METHOD');
    console.log('═'.repeat(200));

    const exitMethods = [...new Set(trades.map(t => t.exitMethod))].sort();
    const byExitMethod: Record<string, Slice> = {};

    for (const exitMethod of exitMethods) {
      const filtered = trades.filter(t => t.exitMethod === exitMethod);
      byExitMethod[exitMethod] = buildSlice(`${exitMethod}`, filtered, baseline);
      console.log(formatSlice(byExitMethod[exitMethod]));
    }

    // Analyze by direction
    console.log('\n' + '═'.repeat(200));
    console.log('🔹 BREAKDOWN BY DIRECTION');
    console.log('═'.repeat(200));

    const byLong = buildSlice('LONG', trades.filter(t => t.direction.toUpperCase() === 'LONG'), baseline);
    const byShort = buildSlice('SHORT', trades.filter(t => t.direction.toUpperCase() === 'SHORT'), baseline);
    console.log(formatSlice(byLong));
    console.log(formatSlice(byShort));

    // Analyze combinations: regime × exit method
    console.log('\n' + '═'.repeat(200));
    console.log('🔹 REGIME × EXIT METHOD COMBINATIONS (Top 20)');
    console.log('═'.repeat(200));

    const combinations: Slice[] = [];
    for (const regime of regimes) {
      for (const exitMethod of exitMethods) {
        const filtered = trades.filter(t => t.regime === regime && t.exitMethod === exitMethod);
        if (filtered.length > 10) { // Only show combinations with 10+ trades
          combinations.push(buildSlice(`${regime} ← ${exitMethod}`, filtered, baseline));
        }
      }
    }

    combinations.sort((a, b) => b.improvement - a.improvement); // Sort by improvement
    for (let i = 0; i < Math.min(20, combinations.length); i++) {
      console.log(formatSlice(combinations[i]));
    }

    // Stop rate analysis
    console.log('\n' + '═'.repeat(200));
    console.log('🚨 STOP RATE BY REGIME (which regimes have most stops?)');
    console.log('═'.repeat(200));

    for (const regime of regimes) {
      const regimeTrades = trades.filter(t => t.regime === regime);
      const stops = regimeTrades.filter(t => t.exitMethod === 'stop' || t.exitReason === 'stop_hit');
      const stopRate = stops.length / regimeTrades.length;
      const icon = stopRate > 0.35 ? '🔴' : '🟢';
      console.log(`${icon} ${regime.padEnd(20)} | ${stops.length.toString().padStart(4)} stops / ${regimeTrades.length} trades = ${(stopRate * 100).toFixed(1).padStart(5)}%`);
    }

    // Entry index distribution
    console.log('\n' + '═'.repeat(200));
    console.log('📍 ENTRY INDEX DISTRIBUTION (are later entries worse?)');
    console.log('═'.repeat(200));

    const entryIndexBuckets = [
      { name: 'Early (0-100)', min: 0, max: 100 },
      { name: 'Mid (100-500)', min: 100, max: 500 },
      { name: 'Late (500+)', min: 500, max: Infinity },
    ];

    for (const bucket of entryIndexBuckets) {
      const filtered = trades.filter(t => t.entryIndex >= bucket.min && t.entryIndex < bucket.max);
      if (filtered.length > 0) {
        const slice = buildSlice(bucket.name, filtered, baseline);
        console.log(formatSlice(slice));
      }
    }

    // Confidence distribution
    console.log('\n' + '═'.repeat(200));
    console.log('💪 CONFIDENCE DISTRIBUTION');
    console.log('═'.repeat(200));

    const confBuckets = [
      { name: 'High (>1.0)', min: 1.0, max: Infinity },
      { name: 'Medium (0.5-1.0)', min: 0.5, max: 1.0 },
      { name: 'Low (<0.5)', min: -Infinity, max: 0.5 },
    ];

    for (const bucket of confBuckets) {
      const filtered = trades.filter(t => t.confidence >= bucket.min && t.confidence < bucket.max);
      if (filtered.length > 0) {
        const slice = buildSlice(bucket.name, filtered, baseline);
        console.log(formatSlice(slice));
      }
    }

    console.log('\n' + '═'.repeat(200));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('═'.repeat(200));
    console.log('\nKEY INSIGHTS:');
    console.log('  🟢 Regimes/methods with WR > 50% are QUALITY FILTERS (use these)');
    console.log('  🔴 Regimes/methods with high stop rate are RISK FACTORS (avoid these)');
    console.log('  📍 Entry index pattern shows if market timing is a factor');
    console.log('  💪 Confidence distribution reveals agent certainty levels');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. Identify worst regime/exit combinations, add as SKIP filters');
    console.log('  2. If late entries (high entryIndex) perform worse → reduce position size');
    console.log('  3. If low confidence has high stop rate → require confidence > threshold');
    console.log('  4. If certain regimes underperform → use dynamic position sizing');
    console.log('');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
