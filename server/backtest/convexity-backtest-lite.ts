/**
 * Convexity Agent Lite Backtest
 * Simplified version that avoids complex module dependencies
 * Tests Failure of Reversion (FoR) engine with survival filter
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MetricsCalculator, type TradeResult } from './metrics-calculator.ts';

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

/**
 * Simplified FoR Calculator (Failure of Reversion)
 * Core mechanism: Score drops when uptrend bounces back within X% of recent high
 * Shows strength when price refuses to revert
 */
class SimpleFoRCalculator {
  // FoR drops when price bounces back within these ranges
  readonly hostileRanges = [
    { pct: 0.5, score: -15 },   // Bounced back 0.5% from high
    { pct: 1.0, score: -10 },   // Bounced back 1% from high
    { pct: 2.0, score: -5 },    // Bounced back 2% from high
    { pct: 5.0, score: -2 },    // Bounced back 5% from high
  ];

  calculate(closes: number[], window = 20): number[] {
    const scores: number[] = [];
    const baseScore = 50; // Neutral start

    for (let i = window; i < closes.length; i++) {
      const windowClose = closes.slice(Math.max(0, i - window), i);
      const recentHigh = Math.max(...windowClose);
      const currentClose = closes[i];
      
      let score = baseScore;
      
      // Penalty: bounced back toward old high
      for (const range of this.hostileRanges) {
        const bounceThreshold = recentHigh * (1 - range.pct / 100);
        if (currentClose < bounceThreshold) {
          score += range.score;
        }
      }

      // Bonus: price stayed above recent high (true conviction)
      if (currentClose > recentHigh * 1.005) {
        score += 15;
      }

      scores.push(Math.max(0, Math.min(100, score))); // Clamp 0-100
    }

    return scores;
  }
}

/**
 * Simple entry logic: FoR > 60 + survived 5 bars
 */
class SurvivalFilterLite {
  async validate(
    closes: number[],
    forScores: number[],
    deploymentBar: number,
    survivalWindow = 5
  ): Promise<boolean> {
    // Check if 5 bars past deployment have all been above entry
    if (deploymentBar + survivalWindow >= closes.length) {
      return false;
    }

    const entryClose = closes[deploymentBar];
    for (let i = 1; i <= survivalWindow; i++) {
      if (closes[deploymentBar + i] < entryClose * 0.99) {
        return false; // Dropped 1% below entry
      }
    }

    return true;
  }
}

async function runBacktest() {
  const dataDir = path.join(__dirname, '../../data/cache');
  
  // Load cached data
  const btcPath = path.join(dataDir, 'BTCUSDT_1h_365d.json');
  const ethPath = path.join(dataDir, 'ETHUSDT_1h_365d.json');

  if (!fs.existsSync(btcPath) || !fs.existsSync(ethPath)) {
    console.error('❌ Data files not found');
    console.error(`  BTC: ${btcPath}`);
    console.error(`  ETH: ${ethPath}`);
    process.exit(1);
  }

  const btcRaw = JSON.parse(fs.readFileSync(btcPath, 'utf-8')) as any;
  const ethRaw = JSON.parse(fs.readFileSync(ethPath, 'utf-8')) as any;
  
  // Handle both formats: {data: [...]} and [...]
  const btcData = (Array.isArray(btcRaw) ? btcRaw : btcRaw.data) as MarketTick[];
  const ethData = (Array.isArray(ethRaw) ? ethRaw : ethRaw.data) as MarketTick[];

  console.log('\n🔬 CONVEXITY ENGINE LITE BACKTEST');
  console.log('================================\n');
  
  const assets = [
    { name: 'BTC/USDT', data: btcData },
    { name: 'ETH/USDT', data: ethData }
  ];

  for (const asset of assets) {
    console.log(`\n📊 ${asset.name}`);
    console.log('-'.repeat(60));

    const closes = asset.data.map(tick => tick.close);
    const volumes = asset.data.map(tick => tick.volume);

    // Step 1: Calculate FoR scores
    const forCalc = new SimpleFoRCalculator();
    const forScores = forCalc.calculate(closes, 20);

    // Step 2: Find potential deployments (FoR > 60)
    const potentialDeploys: number[] = [];
    for (let i = 0; i < forScores.length; i++) {
      if (forScores[i] > 60) {
        potentialDeploys.push(i);
      }
    }

    // Step 3: Filter deployments by survival (must survive 5 bars)
    const filter = new SurvivalFilterLite();
    const validDeploys: number[] = [];
    for (const deployBar of potentialDeploys) {
      const survived = await filter.validate(closes, forScores, deployBar, 5);
      if (survived) {
        validDeploys.push(deployBar);
      }
    }

    // Step 4: Simulate trades
    const trades: TradeResult[] = [];
    let i = 0;
    while (i < validDeploys.length) {
      const deployBar = validDeploys[i];
      const entryPrice = closes[deployBar];

      // Exit logic: 2% target or 1% stop loss
      const target = entryPrice * 1.02;
      const stop = entryPrice * 0.99;

      let exitPrice = 0;
      let exitBar = deployBar;
      let hitTarget = false;

      // Scan forward max 50 bars
      for (let bar = deployBar + 1; bar < Math.min(deployBar + 50, closes.length); bar++) {
        const high = asset.data[bar].high;
        const low = asset.data[bar].low;

        if (high >= target) {
          exitPrice = target;
          exitBar = bar;
          hitTarget = true;
          break;
        }
        if (low <= stop) {
          exitPrice = stop;
          exitBar = bar;
          break;
        }
      }

      if (exitPrice === 0) {
        exitPrice = closes[closes.length - 1]; // Close on last bar
        exitBar = closes.length - 1;
      }

      const pnlAbs = exitPrice - entryPrice;
      const pnlPct = (pnlAbs / entryPrice) * 100;

      trades.push({
        entryPrice,
        exitPrice,
        quantity: 1,
        entryBar: deployBar,
        exitBar,
        pnlPct,
        pnlAbs,
        status: hitTarget ? 'WIN' : 'LOSS',
        exitReason: hitTarget ? 'TARGET_HIT' : 'END_OF_DATA'
      });

      // Skip overlapping trades
      i = validDeploys.findIndex((d, idx) => idx > i && d > exitBar);
      if (i === -1) break;
    }

    // Step 5: Calculate metrics
    const barReturns = closes.map((close, idx) => ({
      bar: idx,
      timestamp: asset.data[idx].timestamp,
      dailyReturn: idx === 0 ? 0 : ((close - closes[idx - 1]) / closes[idx - 1]) * 100,
      cumulativeReturn: idx === 0 ? 0 : ((close - closes[0]) / closes[0]) * 100
    }));
    const metrics = MetricsCalculator.calculate(trades, barReturns, closes.length);

    console.log(`Bars analyzed: ${closes.length.toLocaleString()}`);
    console.log(`FoR > 60 signals: ${potentialDeploys.length}`);
    console.log(`Valid deployments (survived 5 bars): ${validDeploys.length}`);
    console.log(`Trades executed: ${trades.length}`);
    
    if (trades.length === 0) {
      console.log('No trades - metrics unavailable');
      continue;
    }

    console.log('\n📈 PERFORMANCE METRICS');
    console.log(MetricsCalculator.formatMetrics(metrics));
  }

  console.log('\n✅ Backtest complete');
}

runBacktest().catch(err => {
  console.error('Backtest error:', err);
  process.exit(1);
});
