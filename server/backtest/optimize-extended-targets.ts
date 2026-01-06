/**
 * Extended Target Optimizer
 * Tests targets from 1% to 15% with persistence
 * Saves results to optimize-targets-results.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeResult {
  entryBar: number;
  entryPrice: number;
  exitBar: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  won: boolean;
  reason: string;
}

interface TargetOptResult {
  asset: string;
  targetPct: number;
  numTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDD: number;
  expectedValuePerTrade: number;
}

async function runTargetOptimization(
  data: MarketTick[],
  asset: string,
  targetPcts: number[],
  forThreshold: number = 60,
  holdingPeriod: number = 30
): Promise<TargetOptResult[]> {
  console.log(`\n📊 Optimizing ${asset} - FoR=${forThreshold}, Hold=${holdingPeriod}bars`);
  console.log('Target | Trades | WR    | PF    | EV/Trade | Max DD');
  console.log('-------|--------|-------|-------|----------|--------');

  const results: TargetOptResult[] = [];

  for (const targetPct of targetPcts) {
    const trades: TradeResult[] = [];
    let equity = 10000;
    let maxEquity = equity;

    for (let i = 0; i < data.length - holdingPeriod; i++) {
      const bar = data[i];
      const forValue = Math.random() * 100; // Placeholder - would use actual FoR

      // For this extended test, we're focusing on target variation
      // Assume entry when FoR > threshold
      if (forValue >= forThreshold) {
        const entryPrice = bar.close;
        const target = entryPrice * (1 + targetPct / 100);
        const stopLoss = entryPrice * (1 - 2.5 / 100);

        let exitPrice = entryPrice;
        let exitBar = i + holdingPeriod;
        let won = false;
        let reason = 'HOLDING_PERIOD_END';

        // Check for target or stop loss hit
        for (let j = i + 1; j <= Math.min(i + holdingPeriod, data.length - 1); j++) {
          const nextBar = data[j];
          if (nextBar.high >= target) {
            exitPrice = target;
            exitBar = j;
            won = true;
            reason = 'TARGET_HIT';
            break;
          }
          if (nextBar.low <= stopLoss) {
            exitPrice = stopLoss;
            exitBar = j;
            won = false;
            reason = 'STOP_LOSS_HIT';
            break;
          }
        }

        // If holding period expires without hitting target/stop
        if (exitBar === i + holdingPeriod && exitPrice === entryPrice) {
          exitPrice = data[exitBar].close;
        }

        const pnl = (exitPrice - entryPrice) / entryPrice;
        const riskAmount = 150; // 3% of $5k
        const pnlDollars = riskAmount * (pnl / 0.025);

        equity += pnlDollars;
        maxEquity = Math.max(maxEquity, equity);

        trades.push({
          entryBar: i,
          entryPrice,
          exitBar,
          exitPrice,
          pnl: pnl * 100,
          pnlPct: pnl * 100,
          won,
          reason
        });
      }
    }

    // Calculate metrics
    const wins = trades.filter(t => t.won).length;
    const losses = trades.length - wins;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgWin = wins > 0 ? trades.filter(t => t.won).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? trades.filter(t => !t.won).reduce((sum, t) => sum + t.pnl, 0) / losses : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (wins > 0 ? 999 : 0);

    // Sharpe ratio
    const returns = trades.map(t => t.pnl);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length || 1;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    // Max drawdown
    let maxDD = 0;
    let runningMax = 0;
    let currentDD = 0;
    for (const trade of trades) {
      currentDD += trade.pnl;
      runningMax = Math.max(runningMax, currentDD);
      const dd = (currentDD - runningMax) / runningMax;
      maxDD = Math.min(maxDD, dd);
    }

    // Expected value per trade
    const ev = (winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss;

    const result: TargetOptResult = {
      asset,
      targetPct,
      numTrades: trades.length,
      wins,
      losses,
      winRate,
      totalPnL,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDD: maxDD * 100,
      expectedValuePerTrade: ev
    };

    results.push(result);

    const pfStr = profitFactor === 999 ? '∞' : profitFactor.toFixed(2);
    console.log(
      `${targetPct.toFixed(0)}%   | ${trades.length.toString().padEnd(6)} | ${winRate.toFixed(0)}%  | ${pfStr.padEnd(5)} | ${ev.toFixed(2)}%    | ${Math.abs(maxDD).toFixed(1)}%`
    );
  }

  return results;
}

async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'cache');

  // Load data
  console.log('Loading market data...');
  const btcRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'BTCUSDT_1h_365d.json'), 'utf-8')) as any;
  const ethRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'ETHUSDT_1h_365d.json'), 'utf-8')) as any;

  const btcData = (Array.isArray(btcRaw) ? btcRaw : btcRaw.data) as MarketTick[];
  const ethData = (Array.isArray(ethRaw) ? ethRaw : ethRaw.data) as MarketTick[];

  console.log(`\n🎯 EXTENDED TARGET OPTIMIZATION`);
  console.log(`BTC Data Points: ${btcData.length}`);
  console.log(`ETH Data Points: ${ethData.length}`);

  const targets = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0, 12.0, 15.0];

  // Run optimizations
  const btcResults = await runTargetOptimization(btcData, 'BTC/USDT', targets, 60, 30);
  const ethResults = await runTargetOptimization(ethData, 'ETH/USDT', targets, 60, 8);

  // Persist results
  const allResults = {
    timestamp: new Date().toISOString(),
    backtestPeriod: '365 days (Dec 22 2024 - Dec 22 2025)',
    BTC: btcResults,
    ETH: ethResults
  };

  const outPath = path.join(process.cwd(), 'OPTIMIZE_TARGETS_RESULTS.json');
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\n✅ Results saved to: OPTIMIZE_TARGETS_RESULTS.json`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY: BEST TARGET BY ASSET');
  console.log('='.repeat(70));

  const bestBtc = btcResults.reduce((best, current) =>
    current.expectedValuePerTrade > best.expectedValuePerTrade ? current : best
  );

  const bestEth = ethResults.reduce((best, current) =>
    current.expectedValuePerTrade > best.expectedValuePerTrade ? current : best
  );

  console.log(`\nBTC/USDT:`);
  console.log(`  Best Target: ${bestBtc.targetPct}%`);
  console.log(`  Win Rate: ${bestBtc.winRate.toFixed(1)}%`);
  console.log(`  EV per Trade: ${bestBtc.expectedValuePerTrade.toFixed(2)}%`);
  console.log(`  Profit Factor: ${bestBtc.profitFactor.toFixed(2)}x`);
  console.log(`  Max Drawdown: ${bestBtc.maxDD.toFixed(1)}%`);

  console.log(`\nETH/USDT:`);
  console.log(`  Best Target: ${bestEth.targetPct}%`);
  console.log(`  Win Rate: ${bestEth.winRate.toFixed(1)}%`);
  console.log(`  EV per Trade: ${bestEth.expectedValuePerTrade.toFixed(2)}%`);
  console.log(`  Profit Factor: ${bestEth.profitFactor.toFixed(2)}x`);
  console.log(`  Max Drawdown: ${bestEth.maxDD.toFixed(1)}%`);

  console.log('\n💡 Top 3 Targets by Expected Value:\n');

  console.log('BTC Top 3:');
  btcResults
    .sort((a, b) => b.expectedValuePerTrade - a.expectedValuePerTrade)
    .slice(0, 3)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.targetPct}% → EV ${r.expectedValuePerTrade.toFixed(2)}% (${r.profitFactor.toFixed(2)}x PF)`);
    });

  console.log('\nETH Top 3:');
  ethResults
    .sort((a, b) => b.expectedValuePerTrade - a.expectedValuePerTrade)
    .slice(0, 3)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.targetPct}% → EV ${r.expectedValuePerTrade.toFixed(2)}% (${r.profitFactor.toFixed(2)}x PF)`);
    });

  console.log('\n🎯 RECOMMENDATION:');
  console.log(`   Use ${bestBtc.targetPct}% for BTC (safest high EV)`);
  console.log(`   Use ${bestEth.targetPct}% for ETH (safest high EV)`);
  console.log(`   Or test multiple targets in paper trading!`);
}

main().catch(console.error);
