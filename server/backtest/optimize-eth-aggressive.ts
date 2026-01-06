/**
 * Aggressive ETH Optimization (No RR constraint)
 * 
 * Tests: FoR thresholds (40%, 50%, 60%) × Targets (0.5-3%) × Stop Losses (0.5-2%) × Holding Periods (4-16 bars)
 * Total: 3 × 11 × 7 × 7 = 1,617 configurations
 * 
 * Allows small targets (0.5%, 0.75%, 1%) with proportional stops
 * No 1:2 RR requirement - just maximize EV
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
  totalReturn: number;
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

  // Calculate target and stop prices once entry is made
  let targetPrice = 0;
  let stopPrice = 0;

  for (let i = 10; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const fairPrice = calculateSMA(candles, 50, i);
    const atr = calculateATR(candles, 14, i);

    // Skip if insufficient data
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
      // Set target and stop based on entry price
      targetPrice = currentPrice * (1 + config.target / 100);
      stopPrice = currentPrice * (1 - config.stopLoss / 100);
    }

    // Exit: Check profit target, stop loss, or holding period
    if (activeTrade) {
      const barHeld = i - activeTrade.entryBar;
      const pnl = currentPrice - activeTrade.entry;
      const pnlPct = (pnl / activeTrade.entry) * 100;

      let shouldExit = false;
      let exitType: 'win' | 'loss' = 'loss';

      // Hit profit target
      if (currentPrice >= targetPrice) {
        shouldExit = true;
        exitType = 'win';
      }
      // Hit stop loss
      else if (currentPrice <= stopPrice) {
        shouldExit = true;
        exitType = 'loss';
      }
      // Holding period exceeded (exit at market)
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

  // Calculate metrics
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
  const totalReturn = (grossWins - grossLosses) / 100; // Rough annualization
  const expectedValue = avgWin * winRate + avgLoss * (1 - winRate);

  // Simplified Sharpe Ratio
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
    totalReturn,
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
  console.log('🔬 AGGRESSIVE ETH OPTIMIZATION (NO RR CONSTRAINT)');
  console.log('='.repeat(78));
  console.log(`📊 Loaded ${candles.length} ETH candles\n`);

  // Expanded target range (0.5% to 3%)
  const forThresholds = [40, 50, 60];
  const targets = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];  // 11 options
  const stopLosses = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];  // 7 options
  const holdingPeriods = [4, 6, 8, 10, 12, 14, 16];  // 7 options

  const results: BacktestResult[] = [];
  let completed = 0;
  const total = forThresholds.length * targets.length * stopLosses.length * holdingPeriods.length;

  console.log(`🧪 Testing ${total} configurations...\n`);

  for (const forThresh of forThresholds) {
    for (const target of targets) {
      for (const sl of stopLosses) {
        for (const hold of holdingPeriods) {
          const config: BacktestConfig = {
            forThreshold: forThresh,
            target,
            stopLoss: sl,
            holdingBars: hold
          };

          const result = runBacktest(candles, config);
          results.push(result);  // Include ALL results, profitable or not

          completed++;
          if (completed % 100 === 0) {
            process.stdout.write(`\r✓ ${completed}/${total} complete`);
          }
        }
      }
    }
  }

  console.log(`\r✓ ${total}/${total} complete!\n`);

  // Sort by Expected Value (descending)
  results.sort((a, b) => b.expectedValue - a.expectedValue);

  // Group by FoR threshold
  const byThreshold = forThresholds.map(thresh => ({
    threshold: thresh,
    profitable: results.filter(r => r.config.forThreshold === thresh && r.expectedValue > 0).length,
    avgEV: results
      .filter(r => r.config.forThreshold === thresh)
      .reduce((sum, r) => sum + r.expectedValue, 0) / (results.filter(r => r.config.forThreshold === thresh).length || 1),
    best: results.find(r => r.config.forThreshold === thresh)
  }));

  // Report
  console.log('='.repeat(78));
  console.log('📈 RESULTS: TOP CONFIGURATIONS BY EV');
  console.log('='.repeat(78));
  const profitableCount = results.filter(r => r.expectedValue > 0).length;
  console.log(`✅ ${profitableCount} out of ${results.length} configurations are profitable\n`);

  console.log('Top 25 by Expected Value:\n');
  for (let i = 0; i < Math.min(25, results.length); i++) {
    const r = results[i];
    const config = r.config;
    const ev = r.expectedValue * 100;
    const evStr = ev > 0 ? `+${ev.toFixed(4)}%` : `${ev.toFixed(4)}%`;
    const annual = ((r.expectedValue * 100) * 252).toFixed(1);
    console.log(
      `${(i + 1).toString().padStart(2)}. FoR>${config.forThreshold}% | Tgt:${config.target}% | SL:${config.stopLoss}% | Hold:${config.holdingBars}b`
    );
    console.log(
      `    Trades:${r.trades.toString().padStart(2)} | WR: ${(r.winRate * 100).toFixed(1).padStart(5)}% | PF:${r.profitFactor.toFixed(2)}x | EV: ${evStr.padStart(9)} | Annual: ${annual.padStart(6)}%  `
    );
  }

  console.log('\n' + '='.repeat(78));
  console.log('📊 ANALYSIS BY FoR THRESHOLD');
  console.log('='.repeat(78));
  for (const analysis of byThreshold) {
    console.log(
      `\nFoR > ${analysis.threshold}%:`
    );
    console.log(`  Configs tested: ${forThresholds.length * targets.length * stopLosses.length * holdingPeriods.length / forThresholds.length}`);
    console.log(`  Profitable: ${analysis.profitable}`);
    console.log(`  Avg EV: ${(analysis.avgEV * 100).toFixed(4)}%`);
    if (analysis.best) {
      const c = analysis.best.config;
      console.log(
        `  Best: ${c.target}% target / ${c.stopLoss}% SL / ${c.holdingBars} bars = ${(analysis.best.expectedValue * 100).toFixed(4)}% EV`
      );
    }
  }

  // Detailed analysis of best
  if (results.length > 0) {
    const best = results[0];
    const c = best.config;

    console.log('\n' + '='.repeat(78));
    console.log('🎯 BEST CONFIGURATION - DETAILED ANALYSIS');
    console.log('='.repeat(78));
    console.log(`\nFoR > ${c.forThreshold}% | Target: ${c.target}% | Stop Loss: ${c.stopLoss}% | Holding: ${c.holdingBars} bars\n`);

    console.log('Metrics:');
    console.log(`  Total Trades: ${best.trades}`);
    console.log(`  Wins: ${best.wins} (${(best.winRate * 100).toFixed(1)}%)`);
    console.log(`  Losses: ${best.losses}`);
    console.log(`  Avg Win: ${best.avgWin.toFixed(2)}%`);
    console.log(`  Avg Loss: ${best.avgLoss.toFixed(2)}%`);
    console.log(`  Profit Factor: ${best.profitFactor.toFixed(2)}x`);
    console.log(`  Expected Value: ${(best.expectedValue * 100).toFixed(4)}%`);
    console.log(`  Expected Annual Return: ${(best.expectedValue * 100 * 252).toFixed(1)}%`);
    console.log(`  Sharpe Ratio: ${best.sharpeRatio.toFixed(2)}`);

    console.log(`\n💰 Projected 1-Year Results:`);
    console.log(`  $1,000 → $${(1000 * Math.pow(1 + best.expectedValue, 252)).toFixed(0)}`);
    console.log(`  $5,000 → $${(5000 * Math.pow(1 + best.expectedValue, 252)).toFixed(0)}`);
  }

  // Save full results
  fs.writeFileSync(
    'ETH_AGGRESSIVE_OPTIMIZATION_RESULTS.json',
    JSON.stringify(results, null, 2)
  );

  console.log(`\n✅ Full results (all ${results.length} configs) saved to ETH_AGGRESSIVE_OPTIMIZATION_RESULTS.json`);
  console.log('='.repeat(78) + '\n');
}

optimize().catch(console.error);
