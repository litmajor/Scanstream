import Database from 'better-sqlite3';
import { VFMDPhysicsAgent } from '../services/vfmd/VFMDPhysicsAgent';
import { Pool } from 'pg';

const db = new Database('neon.db');
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'scanstream',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password'
});

interface ThresholdResult {
  threshold: number;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  tradeCount: number;
  finalCapital: number;
  profit: number;
  profitPercent: number;
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
}

async function testThreshold(asset: string, threshold: number): Promise<ThresholdResult> {
  console.log(`\n========== Testing BTC with threshold ${threshold} ==========`);
  
  // Fetch BTC data
  const query = `
    SELECT date, open, high, low, close, volume
    FROM candles_${asset.toLowerCase()}
    WHERE date >= NOW() - INTERVAL '365 days'
    ORDER BY date ASC
  `;

  const candles = db.prepare(query).all() as any[];
  console.log(`Loaded ${candles.length} candles for ${asset}`);

  let capital = 1000;
  let position: 'long' | 'short' | null = null;
  let entryPrice = 0;
  const trades: any[] = [];
  let buySignalCount = 0;
  let sellSignalCount = 0;
  let holdSignalCount = 0;

  const agent = new VFMDPhysicsAgent(asset);
  agent.profitScoreThresholds[asset] = threshold;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const lookback = candles.slice(Math.max(0, i - 99), i + 1);

    if (lookback.length < 100) continue;

    const signal = await agent.analyzePattern(lookback);

    if (!signal) {
      holdSignalCount++;
      continue;
    }

    // Count signal types
    if (signal.action === 'BUY') {
      buySignalCount++;
      if (position === null) {
        position = 'long';
        entryPrice = candle.close;
        trades.push({
          type: 'BUY',
          price: entryPrice,
          date: candle.date,
          confidence: signal.confidence
        });
      }
    } else if (signal.action === 'SELL') {
      sellSignalCount++;
      if (position === 'long') {
        const profit = (candle.close - entryPrice) / entryPrice;
        capital *= 1 + profit;
        trades.push({
          type: 'SELL',
          price: candle.close,
          date: candle.date,
          profit,
          pnl: capital - 1000
        });
        position = null;
      }
    } else {
      holdSignalCount++;
    }
  }

  // Close any open position
  if (position === 'long' && candles.length > 0) {
    const profit = (candles[candles.length - 1].close - entryPrice) / entryPrice;
    capital *= 1 + profit;
    trades.push({
      type: 'SELL (close)',
      price: candles[candles.length - 1].close,
      profit,
      pnl: capital - 1000
    });
  }

  // Calculate metrics
  const closedTrades = trades.filter((t, i) => {
    if (t.type !== 'SELL' && t.type !== 'SELL (close)') return false;
    const entryIdx = trades.findIndex((tr, j) => j < i && tr.type === 'BUY');
    return entryIdx >= 0;
  });

  const winningTrades = closedTrades.filter(t => t.profit && t.profit > 0).length;
  const winRate = closedTrades.length > 0 ? winningTrades / closedTrades.length : 0;

  // Calculate Sharpe (simplified)
  const returns = closedTrades
    .filter(t => t.profit !== undefined)
    .map(t => t.profit || 0);
  
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1 
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

  // Calculate profit factor
  const profits = closedTrades.filter(t => t.profit && t.profit > 0).reduce((sum, t) => sum + (t.profit || 0), 0);
  const losses = Math.abs(closedTrades.filter(t => t.profit && t.profit < 0).reduce((sum, t) => sum + (t.profit || 0), 0));
  const profitFactor = losses > 0 ? profits / losses : (profits > 0 ? 999 : 0);

  // Simplified max drawdown
  let peak = 1000;
  let maxDD = 0;
  let runningCapital = 1000;
  for (const trade of trades) {
    if (trade.pnl !== undefined) {
      runningCapital = 1000 + trade.pnl;
      if (runningCapital > peak) peak = runningCapital;
      const dd = (peak - runningCapital) / peak;
      if (dd > maxDD) maxDD = dd;
    }
  }

  const result: ThresholdResult = {
    threshold,
    totalSignals: buySignalCount + sellSignalCount + holdSignalCount,
    buySignals: buySignalCount,
    sellSignals: sellSignalCount,
    holdSignals: holdSignalCount,
    tradeCount: closedTrades.length,
    finalCapital: capital,
    profit: capital - 1000,
    profitPercent: ((capital - 1000) / 1000) * 100,
    winRate: winRate * 100,
    sharpeRatio,
    profitFactor,
    maxDrawdown: maxDD * 100
  };

  console.log(`\n📊 Results for threshold ${threshold}:`);
  console.log(`  Trades: ${result.tradeCount} | Win Rate: ${result.winRate.toFixed(1)}%`);
  console.log(`  Capital: $${result.finalCapital.toFixed(2)} (+${result.profitPercent.toFixed(2)}%)`);
  console.log(`  Sharpe: ${result.sharpeRatio.toFixed(2)} | PF: ${result.profitFactor.toFixed(2)} | DD: ${result.maxDrawdown.toFixed(1)}%`);

  return result;
}

async function main() {
  console.log('🔍 BTC Threshold Optimization Analysis');
  console.log('Testing different profit score thresholds...\n');

  const thresholds = [45, 50, 55, 60, 65];
  const results: ThresholdResult[] = [];

  for (const threshold of thresholds) {
    const result = await testThreshold('BTC', threshold);
    results.push(result);
  }

  console.log('\n\n========== COMPARISON TABLE ==========');
  console.log(
    ['Threshold', 'Trades', 'Win%', 'Capital', 'Profit%', 'Sharpe', 'PF', 'DD%']
      .map(h => h.padEnd(12))
      .join('│')
  );
  console.log('-'.repeat(100));

  for (const result of results) {
    console.log(
      [
        result.threshold.toString(),
        result.tradeCount.toString(),
        result.winRate.toFixed(1),
        `$${result.finalCapital.toFixed(0)}`,
        `${result.profitPercent.toFixed(2)}%`,
        result.sharpeRatio.toFixed(2),
        result.profitFactor.toFixed(2),
        result.maxDrawdown.toFixed(1)
      ]
        .map(v => v.padEnd(12))
        .join('│')
    );
  }

  // Find optimal threshold
  const optimal = results.reduce((best, curr) => 
    curr.profitPercent > best.profitPercent ? curr : best
  );

  console.log(`\n\n🎯 Optimal Threshold: ${optimal.threshold}`);
  console.log(`   Profit: ${optimal.profitPercent.toFixed(2)}% | Win Rate: ${optimal.winRate.toFixed(1)}% | Sharpe: ${optimal.sharpeRatio.toFixed(2)}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
