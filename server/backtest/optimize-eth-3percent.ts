/**
 * Focused ETH Optimization: 3% Target with 1.75% SL
 * 
 * Tests: FoR thresholds (40%, 50%, 60%) × Holding Periods (4-16 bars)
 * Fixed: Target = 3%, Stop Loss = 1.75%
 * Total: 3 × 7 = 21 configurations
 */

import fs from 'fs';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestConfig {
  forThreshold: number;
  target: number;
  stopLoss: number;
  holdingBars: number;
}

interface BacktestResult {
  config: BacktestConfig;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectedValue: number;
  sharpeRatio: number;
}

function calculateATR(candles: Candle[], period: number, index: number): number {
  if (index < period) return 0;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - (i > 0 ? candles[i - 1].close : candles[i].close)),
      Math.abs(candles[i].low - (i > 0 ? candles[i - 1].close : candles[i].close))
    );
    sum += tr;
  }
  return sum / period;
}

function calculateSMA(candles: Candle[], period: number, index: number): number {
  if (index < period - 1) return 0;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += candles[i].close;
  }
  return sum / period;
}

function runBacktest(
  candles: Candle[],
  config: BacktestConfig
): BacktestResult {
  const forCalculator = new FailureOfReversionCalculator();
  let trades: Array<{ entry: number; exit: number; type: 'win' | 'loss'; pnl: number }> = [];
  let activeTrade: { entry: number; entryBar: number } | null = null;

  let targetPrice = 0;
  let stopPrice = 0;

  for (let i = 10; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const fairPrice = calculateSMA(candles, 50, i);
    const atr = calculateATR(candles, 14, i);

    if (fairPrice === 0) continue;

    forCalculator.processTick(candles[i], fairPrice, currentPrice, atr);
    const forState = forCalculator.calculateFoR(currentPrice, fairPrice, atr);
    const forScorePct = forState.forScore * 100;

    // Entry: FoR > threshold AND no active trade
    if (forScorePct > config.forThreshold && !activeTrade) {
      activeTrade = {
        entry: currentPrice,
        entryBar: i
      };
      targetPrice = currentPrice * (1 + config.target / 100);
      stopPrice = currentPrice * (1 - config.stopLoss / 100);
    }

    // Exit
    if (activeTrade) {
      const barHeld = i - activeTrade.entryBar;
      const pnl = currentPrice - activeTrade.entry;
      const pnlPct = (pnl / activeTrade.entry) * 100;

      let shouldExit = false;
      let exitType: 'win' | 'loss' = 'loss';

      if (currentPrice >= targetPrice) {
        shouldExit = true;
        exitType = 'win';
      }
      else if (currentPrice <= stopPrice) {
        shouldExit = true;
        exitType = 'loss';
      }
      else if (barHeld >= config.holdingBars) {
        shouldExit = true;
        exitType = pnlPct > 0 ? 'win' : 'loss';
      }

      if (shouldExit) {
        trades.push({
          entry: activeTrade.entry,
          exit: currentPrice,
          type: exitType,
          pnl: (currentPrice - activeTrade.entry) / activeTrade.entry * 100
        });
        activeTrade = null;
      }
    }
  }

  const wins = trades.filter(t => t.type === 'win').length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? wins / trades.length : 0;

  const winTrades = trades.filter(t => t.type === 'win');
  const lossTrades = trades.filter(t => t.type === 'loss');

  const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length : 0;

  const grossWins = winTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));

  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 999 : 0);
  const expectedValue = avgWin * winRate + avgLoss * (1 - winRate);

  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const variance = returns.length > 0 
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  return {
    config,
    trades: trades.length,
    wins,
    losses,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectedValue,
    sharpeRatio
  };
}

async function optimize() {
  const dataPath = './data/cache/ETHUSDT_1h_365d.json';
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const candles: Candle[] = rawData.map((d: any) => ({
    timestamp: d.t || 0,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: d.v
  }));

  console.log('\n' + '='.repeat(78));
  console.log('🔬 ETH OPTIMIZATION: 3% TARGET / 1.75% SL');
  console.log('='.repeat(78));
  console.log(`📊 Loaded ${candles.length} ETH candles\n`);

  const forThresholds = [40, 50, 60];
  const holdingPeriods = [4, 6, 8, 10, 12, 14, 16];
  const TARGET = 3;
  const STOP_LOSS = 1.75;

  const results: BacktestResult[] = [];
  let completed = 0;
  const total = forThresholds.length * holdingPeriods.length;

  console.log(`🧪 Testing ${total} configurations (FoR thresholds × holding periods)...\n`);

  for (const forThresh of forThresholds) {
    for (const hold of holdingPeriods) {
      const config: BacktestConfig = {
        forThreshold: forThresh,
        target: TARGET,
        stopLoss: STOP_LOSS,
        holdingBars: hold
      };

      const result = runBacktest(candles, config);
      results.push(result);

      completed++;
      process.stdout.write(`\r✓ ${completed}/${total} complete`);
    }
  }

  console.log(`\r✓ ${total}/${total} complete!\n`);

  // Sort by Expected Value (descending)
  results.sort((a, b) => b.expectedValue - a.expectedValue);

  // Report
  console.log('='.repeat(78));
  console.log('📈 RESULTS: 3% TARGET / 1.75% SL ACROSS FoR THRESHOLDS');
  console.log('='.repeat(78));
  const profitableCount = results.filter(r => r.expectedValue > 0).length;
  console.log(`✅ ${profitableCount} out of ${total} configurations are profitable\n`);

  console.log('All configurations (sorted by EV):\n');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const config = r.config;
    const ev = r.expectedValue * 100;
    const evStr = ev > 0 ? `+${ev.toFixed(4)}%` : `${ev.toFixed(4)}%`;
    const annual = ((r.expectedValue * 100) * 252).toFixed(1);
    console.log(
      `${(i + 1).toString().padStart(2)}. FoR>${config.forThreshold}% | Hold:${config.holdingBars.toString().padStart(2)}b | Trades:${r.trades.toString().padStart(2)} | WR:${(r.winRate * 100).toFixed(1).padStart(5)}% | PF:${r.profitFactor.toFixed(2)}x | EV:${evStr.padStart(9)} | Annual:${annual.padStart(6)}%`
    );
  }

  console.log('\n' + '='.repeat(78));
  console.log('📊 SUMMARY BY FoR THRESHOLD');
  console.log('='.repeat(78));
  for (const forThresh of forThresholds) {
    const threshResults = results.filter(r => r.config.forThreshold === forThresh);
    const profitable = threshResults.filter(r => r.expectedValue > 0).length;
    const avgEV = threshResults.reduce((sum, r) => sum + r.expectedValue, 0) / threshResults.length;
    const best = threshResults[0];
    
    console.log(`\nFoR > ${forThresh}%:`);
    console.log(`  Configs: ${threshResults.length}`);
    console.log(`  Profitable: ${profitable}`);
    console.log(`  Avg EV: ${(avgEV * 100).toFixed(4)}%`);
    console.log(`  Best: ${best.trades} trades, ${(best.winRate * 100).toFixed(1)}% WR, ${(best.expectedValue * 100).toFixed(4)}% EV (${best.config.holdingBars} bars)`);
  }

  // Comparison with previous best
  console.log('\n' + '='.repeat(78));
  console.log('📊 COMPARISON: Previous Best vs 3% Target');
  console.log('='.repeat(78));
  console.log(`\nPrevious Best (FoR>50%, 2% target, 1.75% SL, 14 bars):`);
  console.log(`  Trades: 45 | WR: 55.6% | PF: 1.18x | EV: +0.1531% | Annual: +12.9%`);
  
  const best = results[0];
  console.log(`\n3% Target Best (FoR>${best.config.forThreshold}%, 3% target, 1.75% SL, ${best.config.holdingBars} bars):`);
  console.log(`  Trades: ${best.trades} | WR: ${(best.winRate * 100).toFixed(1)}% | PF: ${best.profitFactor.toFixed(2)}x | EV: ${(best.expectedValue * 100).toFixed(4)}% | Annual: ${((best.expectedValue * 100) * 252).toFixed(1)}%`);

  // Full details on best
  if (best.trades > 0) {
    console.log('\n' + '='.repeat(78));
    console.log('🎯 DETAILED ANALYSIS: BEST 3% TARGET CONFIG');
    console.log('='.repeat(78));
    console.log(`\nFoR > ${best.config.forThreshold}% | Target: ${best.config.target}% | Stop Loss: ${best.config.stopLoss}% | Holding: ${best.config.holdingBars} bars\n`);

    console.log('Metrics:');
    console.log(`  Total Trades: ${best.trades}`);
    console.log(`  Wins: ${best.wins} (${(best.winRate * 100).toFixed(1)}%)`);
    console.log(`  Losses: ${best.losses}`);
    console.log(`  Avg Win: ${best.avgWin.toFixed(2)}%`);
    console.log(`  Avg Loss: ${best.avgLoss.toFixed(2)}%`);
    console.log(`  Profit Factor: ${best.profitFactor.toFixed(2)}x`);
    console.log(`  Expected Value: ${(best.expectedValue * 100).toFixed(4)}%`);
    console.log(`  Expected Annual Return: ${((best.expectedValue * 100) * 252).toFixed(1)}%`);
    console.log(`  Sharpe Ratio: ${best.sharpeRatio.toFixed(2)}`);

    console.log(`\n💰 Projected 1-Year Results:`);
    console.log(`  $1,000 → $${(1000 * Math.pow(1 + best.expectedValue, 252)).toFixed(0)}`);
    console.log(`  $5,000 → $${(5000 * Math.pow(1 + best.expectedValue, 252)).toFixed(0)}`);
  }

  fs.writeFileSync(
    'ETH_3PERCENT_TARGET_RESULTS.json',
    JSON.stringify(results, null, 2)
  );

  console.log(`\n✅ Full results saved to ETH_3PERCENT_TARGET_RESULTS.json`);
  console.log('='.repeat(78) + '\n');
}

optimize().catch(console.error);
