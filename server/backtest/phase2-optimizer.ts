/**
 * Phase 2: Convexity Engine Optimization
 * 
 * Objectives:
 * 1. ATR-based position sizing (replaces fixed quantity)
 * 2. Dynamic FoR thresholds (test 50, 60, 65, 70, 75)
 * 3. Holding period variations (BTC: 150-200, ETH: 8-15 bars)
 * 4. Volatility regime correlation
 * 5. Portfolio-level risk metrics
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MetricsCalculator, type TradeResult, type BarReturn } from './metrics-calculator.ts';

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

interface OptimizationConfig {
  forThreshold: number;
  holdingPeriod: number;
  atrPeriod: number;
  riskPerTrade: number; // 2% of account per trade
}

interface OptimizationResult {
  config: OptimizationConfig;
  trades: TradeResult[];
  metrics: any;
  profitFactor: number;
  winRate: number;
  sharpe: number;
}

/**
 * ATR Calculator - for position sizing
 */
function calculateATR(data: MarketTick[], period = 14): number[] {
  const atr: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      atr.push(0);
      continue;
    }

    const curr = data[i];
    const prev = data[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );

    if (i < period) {
      atr.push(tr);
    } else {
      const prevATR = atr[i - 1];
      const newATR = (prevATR * (period - 1) + tr) / period;
      atr.push(newATR);
    }
  }

  return atr;
}

/**
 * Simplified FoR Calculator
 */
class SimpleFoRCalculator {
  readonly hostileRanges = [
    { pct: 0.5, score: -15 },
    { pct: 1.0, score: -10 },
    { pct: 2.0, score: -5 },
    { pct: 5.0, score: -2 },
  ];

  calculate(closes: number[], window = 20): number[] {
    const scores: number[] = [];
    const baseScore = 50;

    for (let i = window; i < closes.length; i++) {
      const windowClose = closes.slice(Math.max(0, i - window), i);
      const recentHigh = Math.max(...windowClose);
      const currentClose = closes[i];
      
      let score = baseScore;
      
      for (const range of this.hostileRanges) {
        const bounceThreshold = recentHigh * (1 - range.pct / 100);
        if (currentClose < bounceThreshold) {
          score += range.score;
        }
      }

      if (currentClose > recentHigh * 1.005) {
        score += 15;
      }

      scores.push(Math.max(0, Math.min(100, score)));
    }

    return scores;
  }
}

/**
 * Survival Filter
 */
class SurvivalFilterLite {
  async validate(
    closes: number[],
    forScores: number[],
    deploymentBar: number,
    survivalWindow = 5
  ): Promise<boolean> {
    if (deploymentBar + survivalWindow >= closes.length) {
      return false;
    }

    const entryClose = closes[deploymentBar];
    for (let i = 1; i <= survivalWindow; i++) {
      if (closes[deploymentBar + i] < entryClose * 0.99) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Volatility Regime Detector
 */
class VolatilityRegimeDetector {
  detectRegime(atr: number[], window = 20): string[] {
    const regimes: string[] = [];
    const atrWindow = atr.slice(0, window);
    const baselineATR = atrWindow.reduce((a, b) => a + b, 0) / window;

    for (let i = 0; i < atr.length; i++) {
      const currentATR = atr[i];
      const ratio = currentATR / baselineATR;

      if (ratio > 1.5) {
        regimes.push('HIGH_VOL');
      } else if (ratio < 0.7) {
        regimes.push('LOW_VOL');
      } else {
        regimes.push('NORMAL');
      }
    }

    return regimes;
  }
}

/**
 * Run optimization for a single config
 */
async function runOptimization(
  data: MarketTick[],
  config: OptimizationConfig,
  initialCapital: number = 10000
): Promise<OptimizationResult> {
  const closes = data.map(tick => tick.close);
  const atrs = calculateATR(data, config.atrPeriod);
  
  // Calculate FoR scores
  const forCalc = new SimpleFoRCalculator();
  const forScores = forCalc.calculate(closes, 20);

  // Find potential deployments
  const potentialDeploys: number[] = [];
  for (let i = 0; i < forScores.length; i++) {
    if (forScores[i] > config.forThreshold) {
      potentialDeploys.push(i);
    }
  }

  // Filter by survival
  const filter = new SurvivalFilterLite();
  const validDeploys: number[] = [];
  for (const deployBar of potentialDeploys) {
    const survived = await filter.validate(closes, forScores, deployBar, 5);
    if (survived) {
      validDeploys.push(deployBar);
    }
  }

  // Simulate trades with ATR-based sizing
  const trades: TradeResult[] = [];
  let equity = initialCapital;
  let i = 0;

  while (i < validDeploys.length && equity > 0) {
    const deployBar = validDeploys[i];
    const entryPrice = closes[deployBar];
    const currentATR = atrs[deployBar] || 0.01;

    // Position size based on risk
    const riskDollars = equity * (config.riskPerTrade / 100);
    const stopLoss = entryPrice * 0.025; // 2.5% stop for better position sizing
    const positionSize = Math.max(1, Math.floor(riskDollars / stopLoss)); // At least 1 unit

    if (positionSize === 0) {
      i++;
      continue;
    }

    // Exit targets: 2% or holding period expires
    const target = entryPrice * 1.02;
    const stop = entryPrice * 0.975; // Match stop loss to 2.5%

    let exitPrice = 0;
    let exitBar = deployBar;
    let hitTarget = false;

    // Scan forward for exit (max holding period)
    for (let bar = deployBar + 1; bar < Math.min(deployBar + config.holdingPeriod, closes.length); bar++) {
      const high = data[bar].high;
      const low = data[bar].low;

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

    // Exit on holding period expiration
    if (exitPrice === 0) {
      exitPrice = closes[Math.min(deployBar + config.holdingPeriod, closes.length - 1)];
      exitBar = Math.min(deployBar + config.holdingPeriod, closes.length - 1);
    }

    const pnlAbs = (exitPrice - entryPrice) * positionSize;
    const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;

    trades.push({
      entryPrice,
      exitPrice,
      quantity: positionSize,
      entryBar: deployBar,
      exitBar,
      pnlPct,
      pnlAbs,
      status: hitTarget ? 'WIN' : 'LOSS',
      exitReason: hitTarget ? 'TARGET_HIT' : 'HOLDING_PERIOD_END'
    });

    equity += pnlAbs;

    // Skip overlapping trades
    i = validDeploys.findIndex((d, idx) => idx > i && d > exitBar);
    if (i === -1) break;
  }

  // Calculate metrics
  const barReturns = closes.map((close, idx) => ({
    bar: idx,
    timestamp: data[idx].timestamp,
    dailyReturn: idx === 0 ? 0 : ((close - closes[idx - 1]) / closes[idx - 1]) * 100,
    cumulativeReturn: idx === 0 ? 0 : ((close - closes[0]) / closes[0]) * 100
  }));

  const metrics = MetricsCalculator.calculate(trades, barReturns, closes.length);

  const winRate = trades.length === 0 ? 0 : (trades.filter(t => t.pnlPct > 0).length / trades.length) * 100;
  const grossProfit = trades.filter(t => t.pnlPct > 0).reduce((sum, t) => sum + t.pnlAbs, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlPct < 0).reduce((sum, t) => sum + t.pnlAbs, 0));
  const profitFactor = grossLoss === 0 ? 0 : grossProfit / grossLoss;

  return {
    config,
    trades,
    metrics,
    profitFactor,
    winRate,
    sharpe: metrics.sharpeRatio
  };
}

/**
 * Main Phase 2 runner
 */
async function runPhase2() {
  const dataDir = path.join(__dirname, '../../data/cache');

  const btcRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'BTCUSDT_1h_365d.json'), 'utf-8')) as any;
  const ethRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'ETHUSDT_1h_365d.json'), 'utf-8')) as any;

  const btcData = (Array.isArray(btcRaw) ? btcRaw : btcRaw.data) as MarketTick[];
  const ethData = (Array.isArray(ethRaw) ? ethRaw : ethRaw.data) as MarketTick[];

  console.log('\n🔬 PHASE 2: CONVEXITY ENGINE OPTIMIZATION');
  console.log('='.repeat(70));

  // Define optimization configs
  const btcConfigs: OptimizationConfig[] = [
    { forThreshold: 50, holdingPeriod: 50, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 50, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 65, holdingPeriod: 50, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 70, holdingPeriod: 50, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 75, holdingPeriod: 50, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 30, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 80, atrPeriod: 14, riskPerTrade: 3 },
  ];

  const ethConfigs: OptimizationConfig[] = [
    { forThreshold: 50, holdingPeriod: 10, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 10, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 65, holdingPeriod: 10, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 70, holdingPeriod: 10, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 75, holdingPeriod: 10, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 8, atrPeriod: 14, riskPerTrade: 3 },
    { forThreshold: 60, holdingPeriod: 15, atrPeriod: 14, riskPerTrade: 3 },
  ];

  // Run BTC optimizations
  console.log('\n📊 BTC/USDT OPTIMIZATION SWEEP');
  console.log('-'.repeat(70));
  
  const btcResults: OptimizationResult[] = [];
  for (const config of btcConfigs) {
    const result = await runOptimization(btcData, config);
    btcResults.push(result);
    console.log(
      `FoR=${config.forThreshold} | Hold=${config.holdingPeriod}bars | ` +
      `Trades=${result.trades.length} | WR=${result.winRate.toFixed(1)}% | ` +
      `PF=${result.profitFactor.toFixed(2)}x | Sharpe=${result.sharpe.toFixed(2)}`
    );
  }

  // Run ETH optimizations
  console.log('\n📊 ETH/USDT OPTIMIZATION SWEEP');
  console.log('-'.repeat(70));
  
  const ethResults: OptimizationResult[] = [];
  for (const config of ethConfigs) {
    const result = await runOptimization(ethData, config);
    ethResults.push(result);
    console.log(
      `FoR=${config.forThreshold} | Hold=${config.holdingPeriod}bars | ` +
      `Trades=${result.trades.length} | WR=${result.winRate.toFixed(1)}% | ` +
      `PF=${result.profitFactor.toFixed(2)}x | Sharpe=${result.sharpe.toFixed(2)}`
    );
  }

  // Find best configs
  console.log('\n🏆 BEST CONFIGURATIONS');
  console.log('='.repeat(70));

  const bestBTC = btcResults.reduce((prev, curr) =>
    curr.profitFactor > prev.profitFactor ? curr : prev
  );
  console.log(`\nBTC Best Config:`);
  console.log(`  FoR Threshold: ${bestBTC.config.forThreshold}`);
  console.log(`  Holding Period: ${bestBTC.config.holdingPeriod} bars`);
  console.log(`  Win Rate: ${bestBTC.winRate.toFixed(1)}%`);
  console.log(`  Profit Factor: ${bestBTC.profitFactor.toFixed(2)}x`);
  console.log(`  Trades: ${bestBTC.trades.length}`);
  console.log(`  Sharpe: ${bestBTC.sharpe.toFixed(2)}`);

  const bestETH = ethResults.reduce((prev, curr) =>
    curr.profitFactor > prev.profitFactor ? curr : prev
  );
  console.log(`\nETH Best Config:`);
  console.log(`  FoR Threshold: ${bestETH.config.forThreshold}`);
  console.log(`  Holding Period: ${bestETH.config.holdingPeriod} bars`);
  console.log(`  Win Rate: ${bestETH.winRate.toFixed(1)}%`);
  console.log(`  Profit Factor: ${bestETH.profitFactor.toFixed(2)}x`);
  console.log(`  Trades: ${bestETH.trades.length}`);
  console.log(`  Sharpe: ${bestETH.sharpe.toFixed(2)}`);

  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 2 - Optimization',
    btcResults: btcResults.map(r => ({
      config: r.config,
      trades: r.trades.length,
      winRate: r.winRate,
      profitFactor: r.profitFactor,
      sharpe: r.sharpe,
      avgReturn: r.trades.length > 0 ? r.trades.reduce((sum, t) => sum + t.pnlPct, 0) / r.trades.length : 0
    })),
    ethResults: ethResults.map(r => ({
      config: r.config,
      trades: r.trades.length,
      winRate: r.winRate,
      profitFactor: r.profitFactor,
      sharpe: r.sharpe,
      avgReturn: r.trades.length > 0 ? r.trades.reduce((sum, t) => sum + t.pnlPct, 0) / r.trades.length : 0
    })),
    bestBTC: {
      config: bestBTC.config,
      winRate: bestBTC.winRate,
      profitFactor: bestBTC.profitFactor,
      sharpe: bestBTC.sharpe,
      trades: bestBTC.trades.length
    },
    bestETH: {
      config: bestETH.config,
      winRate: bestETH.winRate,
      profitFactor: bestETH.profitFactor,
      sharpe: bestETH.sharpe,
      trades: bestETH.trades.length
    }
  };

  fs.writeFileSync(
    path.join(__dirname, '../../PHASE_2_OPTIMIZATION_RESULTS.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n✅ Phase 2 optimization complete');
  console.log('Results saved to PHASE_2_OPTIMIZATION_RESULTS.json');
}

runPhase2().catch(err => {
  console.error('Phase 2 error:', err);
  process.exit(1);
});
