import Database from 'better-sqlite3';
import { VFMDPhysicsAgent } from '../services/vfmd/VFMDPhysicsAgent';
import * as fs from 'fs';

const db = new Database('neon.db');

interface BacktestResult {
  threshold: number;
  trades: number;
  finalCapital: number;
  profit: number;
  profitPercent: number;
  wins: number;
  losses: number;
  winRate: number;
}

async function runBacktest(asset: string, threshold: number): Promise<BacktestResult> {
  const query = `
    SELECT date, open, high, low, close, volume
    FROM candles_${asset.toLowerCase()}
    WHERE date >= datetime('now', '-365 days')
    ORDER BY date ASC
    LIMIT 9000
  `;

  const candles = (db.prepare(query).all() as any[]) || [];
  console.log(`Testing ${asset} with threshold ${threshold} (${candles.length} candles)...`);

  let capital = 1000;
  let position: 'long' | null = null;
  let entryPrice = 0;
  let wins = 0;
  let losses = 0;
  let trades = 0;

  const agent = new VFMDPhysicsAgent(asset);
  agent.profitScoreThresholds[asset] = threshold;

  for (let i = 100; i < candles.length; i++) {
    const lookback = candles.slice(i - 100, i + 1);
    const signal = await agent.analyzePattern(lookback);

    if (!signal) continue;

    const currentPrice = candles[i].close;

    if (signal.action === 'BUY' && !position) {
      position = 'long';
      entryPrice = currentPrice;
    } else if (signal.action === 'SELL' && position) {
      const pnl = (currentPrice - entryPrice) / entryPrice;
      capital *= 1 + pnl;
      if (pnl > 0) wins++;
      else losses++;
      trades++;
      position = null;
    }
  }

  // Close any open position
  if (position && candles.length > 0) {
    const pnl = (candles[candles.length - 1].close - entryPrice) / entryPrice;
    capital *= 1 + pnl;
    if (pnl > 0) wins++;
    else losses++;
    trades++;
  }

  const profit = capital - 1000;
  const profitPercent = (profit / 1000) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  console.log(`  ✓ ${trades} trades | ${profitPercent.toFixed(2)}% | WR: ${winRate.toFixed(1)}%`);

  return {
    threshold,
    trades,
    finalCapital: capital,
    profit,
    profitPercent,
    wins,
    losses,
    winRate
  };
}

async function main() {
  console.log('\n🔍 BTC THRESHOLD OPTIMIZATION TEST');
  console.log('='.repeat(50));

  const thresholds = [45, 50, 55, 60];
  const results: BacktestResult[] = [];

  for (const threshold of thresholds) {
    const result = await runBacktest('BTC', threshold);
    results.push(result);
  }

  console.log('\n📊 COMPARISON RESULTS:');
  console.log('─'.repeat(70));
  console.log('Threshold  │  Trades  │  Profit  │  Profit% │  Win Rate');
  console.log('─'.repeat(70));

  for (const r of results) {
    const threshold = `${r.threshold}`.padEnd(10);
    const trades = `${r.trades}`.padEnd(8);
    const profit = `$${r.profit.toFixed(2)}`.padEnd(8);
    const profitPct = `${r.profitPercent.toFixed(2)}%`.padEnd(8);
    const winRate = `${r.winRate.toFixed(1)}%`;

    console.log(`${threshold}│${trades}│${profit}│${profitPct}│${winRate}`);
  }

  const best = results.reduce((a, b) => (a.profitPercent > b.profitPercent ? a : b));
  console.log('\n🎯 OPTIMAL: Threshold ' + best.threshold + ' (' + best.profitPercent.toFixed(2) + '%)');

  // Save results
  const summary = {
    timestamp: new Date().toISOString(),
    asset: 'BTC',
    results,
    optimal: best
  };

  fs.writeFileSync('threshold-results.json', JSON.stringify(summary, null, 2));
  console.log('\n✅ Results saved to threshold-results.json\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
