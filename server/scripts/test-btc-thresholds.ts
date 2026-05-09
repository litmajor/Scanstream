/**
 * BTC Threshold Optimization Test
 * Test different profit score thresholds to find optimal balance
 * between trade volume and profitability
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface ThresholdResult {
  threshold: number;
  trades: number;
  finalCapital: number;
  profit: number;
  profitPercent: number;
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
}

async function testThreshold(threshold: number): Promise<ThresholdResult> {
  console.log(`\n  [Testing threshold ${threshold}...]`);

  // Load BTC data
  const cacheFile = `./data/cache/BTCUSDT_1h_365d.json`;
  let ticks: MarketTick[];

  if (fs.existsSync(cacheFile)) {
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    const fetcher = new BinanceDataFetcher();
    ticks = await fetcher.fetchHistoricalData('BTCUSDT', 365, '1h');
    fs.mkdirSync('./data/cache', { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
  }

  if (ticks.length < 100) {
    throw new Error(`Insufficient data: ${ticks.length} candles, need 100+`);
  }

  // Create agent with specific threshold
  const agent = new VFMDPhysicsAgent('backtest', 'balanced');
  agent.setAsset('BTC');
  (agent as any).profitScoreThresholds['BTC'] = threshold; // Override threshold via type cast

  // Run backtest
  let capital = 1000;
  let position: 'long' | null = null;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  const returns: number[] = [];
  const capitalHistory: number[] = [1000];

  for (let i = 100; i < ticks.length; i++) {
    const lookback = ticks.slice(i - 100, i + 1);
    let signal: any = null;

    try {
      signal = agent.generateSignal(lookback);
    } catch (e) {
      // Skip if analysis fails
      continue;
    }

    if (!signal || signal.action === 'HOLD') continue;

    const currentPrice = ticks[i].close;

    if (signal.action === 'BUY' && !position) {
      position = 'long';
      entryPrice = currentPrice;
    } else if (signal.action === 'SELL' && position) {
      const pnl = (currentPrice - entryPrice) / entryPrice;
      capital *= 1 + pnl;
      returns.push(pnl);
      if (pnl > 0) wins++;
      else losses++;
      trades++;
      capitalHistory.push(capital);
      position = null;
    }
  }

  // Close any open position
  if (position && ticks.length > 0) {
    const finalPrice = ticks[ticks.length - 1].close;
    const pnl = (finalPrice - entryPrice) / entryPrice;
    capital *= 1 + pnl;
    returns.push(pnl);
    if (pnl > 0) wins++;
    else losses++;
    trades++;
    capitalHistory.push(capital);
  }

  // Calculate metrics
  const profit = capital - 1000;
  const profitPercent = (profit / 1000) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // Sharpe ratio (simplified - annualized)
  let sharpeRatio = 0;
  if (returns.length > 1) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;
  }

  // Profit factor
  const winSum = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const lossSum = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = lossSum > 0 ? winSum / lossSum : (winSum > 0 ? 999 : 0);

  return {
    threshold,
    trades,
    finalCapital: capital,
    profit,
    profitPercent,
    winRate,
    sharpeRatio,
    profitFactor
  };
}

async function main() {
  console.log('\n🔍 BTC PROFIT SCORE THRESHOLD OPTIMIZATION');
  console.log('='.repeat(60));

  const thresholds = [45, 50, 55, 60];
  const results: ThresholdResult[] = [];

  console.log(`\nTesting ${thresholds.length} threshold configurations...`);

  for (const threshold of thresholds) {
    try {
      const result = await testThreshold(threshold);
      results.push(result);
      console.log(`    ✓ Trades: ${result.trades} | Profit: ${result.profitPercent.toFixed(2)}% | WR: ${result.winRate.toFixed(1)}%`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err}`);
    }
  }

  // Display results
  console.log('\n📊 THRESHOLD COMPARISON RESULTS:');
  console.log('─'.repeat(90));
  console.log(
    'Threshold │ Trades │ Final $ │ Profit$ │ Profit% │ Win% │ Sharpe │ PF'
  );
  console.log('─'.repeat(90));

  for (const r of results) {
    const threshold = String(r.threshold).padEnd(9);
    const trades = String(r.trades).padEnd(7);
    const finalCap = `$${r.finalCapital.toFixed(0)}`.padEnd(8);
    const profit = `$${r.profit.toFixed(2)}`.padEnd(8);
    const profitPct = `${r.profitPercent.toFixed(2)}%`.padEnd(8);
    const winRate = `${r.winRate.toFixed(1)}%`.padEnd(6);
    const sharpe = r.sharpeRatio.toFixed(2).padEnd(7);
    const pf = r.profitFactor.toFixed(2);

    console.log(`${threshold}│${trades}│${finalCap}│${profit}│${profitPct}│${winRate}│${sharpe}│${pf}`);
  }

  // Find optimal
  if (results.length > 0) {
    const optimal = results.reduce((best, curr) => 
      curr.profitPercent > best.profitPercent ? curr : best
    );

    console.log('\n🎯 OPTIMAL THRESHOLD: ' + optimal.threshold);
    console.log(`   Profit: ${optimal.profitPercent.toFixed(2)}% | Win Rate: ${optimal.winRate.toFixed(1)}% | Sharpe: ${optimal.sharpeRatio.toFixed(2)}`);
    console.log(`   Recommendation: Update BTC threshold to ${optimal.threshold} in VFMDPhysicsAgent`);

    // Save results
    const summary = {
      timestamp: new Date().toISOString(),
      asset: 'BTC',
      interval: '1h',
      dataRange: '365 days',
      results,
      optimal
    };

    fs.writeFileSync('threshold-comparison-results.json', JSON.stringify(summary, null, 2));
    console.log('\n✅ Full results saved to threshold-comparison-results.json');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
