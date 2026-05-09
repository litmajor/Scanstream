/**
 * Quick BTC Threshold Test
 * Directly modifies threshold in the backtest to find optimal value
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

async function main() {
  console.log('\n🔍 BTC THRESHOLD OPTIMIZATION (Quick Test)');
  console.log('='.repeat(60));

  // Load data once
  const cacheFile = `./data/cache/BTCUSDT_1h_365d.json`;
  let ticks: MarketTick[];

  if (fs.existsSync(cacheFile)) {
    console.log('\n✅ Loading cached BTC data...');
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    console.log('\n📥 Fetching BTC data from Binance...');
    const fetcher = new BinanceDataFetcher();
    ticks = await fetcher.fetchHistoricalData('BTCUSDT', 365, '1h');
    fs.mkdirSync('./data/cache', { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
  }

  console.log(`✅ Loaded ${ticks.length} candles\n`);

  const results: any[] = [];
  const thresholds = [45, 50, 55, 60];

  for (const threshold of thresholds) {
    console.log(`  Testing threshold ${threshold}...`);

    const agent = new VFMDPhysicsAgent('backtest', 'balanced');
    agent.setAsset('BTC');
    
    // Access and override private field via casting
    (agent as any).profitScoreThresholds['BTC'] = threshold;

    let capital = 1000;
    let position: 'long' | null = null;
    let entryPrice = 0;
    let trades = 0;
    let wins = 0;
    let losses = 0;
    const returns: number[] = [];

    for (let i = 100; i < ticks.length; i++) {
      const lookback = ticks.slice(i - 100, i + 1);
      let signal: any = null;

      try {
        signal = agent.generateSignal(lookback);
      } catch (e) {
        continue;
      }

      if (!signal) continue;

      const currentPrice = ticks[i].close;

      if (signal.action === 'BUY' && !position) {
        position = 'long';
        entryPrice = currentPrice;
      } else if ((signal.action === 'SELL' || signal.action === 'HOLD') && position) {
        const pnl = (currentPrice - entryPrice) / entryPrice;
        capital *= 1 + pnl;
        returns.push(pnl);
        if (pnl > 0) wins++;
        else losses++;
        trades++;
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
    }

    const profit = capital - 1000;
    const profitPercent = (profit / 1000) * 100;
    const winRate = trades > 0 ? (wins / trades) * 100 : 0;

    // Sharpe calculation
    let sharpe = 0;
    if (returns.length > 1) {
      const mean = returns.reduce((a, b) => a + b) / returns.length;
      const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
    }

    const result = {
      threshold,
      trades,
      finalCapital: capital,
      profitPercent,
      winRate,
      sharpeRatio: sharpe
    };

    results.push(result);
    console.log(`    ✓ ${trades} trades | +${profitPercent.toFixed(2)}% | WR: ${winRate.toFixed(1)}%`);
  }

  console.log('\n📊 COMPARISON:');
  console.log('─'.repeat(70));
  console.log('Threshold │ Trades │ Profit% │  Win% │ Sharpe');
  console.log('─'.repeat(70));

  for (const r of results) {
    console.log(
      `${String(r.threshold).padEnd(9)} │ ${String(r.trades).padEnd(6)} │ ${r.profitPercent.toFixed(2).padEnd(7)}% │ ${r.winRate.toFixed(1).padEnd(5)}% │ ${r.sharpeRatio.toFixed(2)}`
    );
  }

  const best = results.reduce((a, b) => a.profitPercent > b.profitPercent ? a : b);
  console.log('\n🎯 OPTIMAL: Threshold ' + best.threshold + ' (+' + best.profitPercent.toFixed(2) + '%)\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
