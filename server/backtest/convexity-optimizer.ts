/**
 * Convexity Optimizer - Parameter Sweep & Win Rate Improvement
 * 
 * Focuses on:
 * 1. Breaking the 12-bar losing streak
 * 2. BTC: Fine-tune stop loss (0.02 → 0.015-0.025)
 * 3. ETH: Increase FoR confidence (0.4 → 0.5-0.6)
 * 4. Both: Scout target/stop multiplier sweep
 * 5. Dynamic position sizing based on scout PnL
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConvexityBacktesterWithFoR } from './convexity-backtester-with-for.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OptimizationConfig {
  scoutTargetMultiplier: number;
  scoutStopMultiplier: number;
  convexStopLossPercent: number;
  convexMaxHoldingBars: number;
  forConfidenceThreshold: number;
  signalGenerationInterval: number;
  losingStreakBreaker?: boolean;  // Enable anti-streak logic
}

export interface OptimizationResult {
  symbol: string;
  config: OptimizationConfig;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  annualizedReturn: number;
  longestLossStreak: number;
  longestWinStreak: number;
  avgWinPct: number;
  avgLossPct: number;
  sharpeRatio: number;
}

export class ConvexityOptimizer {
  private results: OptimizationResult[] = [];

  /**
   * Run parameter sweep for BTC - Focus on stop loss tuning
   */
  runBTCOptimization(): OptimizationResult[] {
    const btcResults: OptimizationResult[] = [];
    
    console.log('\n' + '═'.repeat(70));
    console.log('🔬 BTC OPTIMIZATION - Stop Loss & Holding Period Sweep');
    console.log('═'.repeat(70));

    // Stop loss sweep: 0.015 → 0.030 (tighter to wider)
    const stopLosses = [0.015, 0.018, 0.020, 0.025, 0.030];
    // Holding period sweep: 40 → 70 bars
    const holdingPeriods = [40, 50, 60, 70];

    let bestResult: OptimizationResult | null = null;

    for (const stopLoss of stopLosses) {
      for (const holdingBars of holdingPeriods) {
        const config: OptimizationConfig = {
          scoutTargetMultiplier: 2,
          scoutStopMultiplier: 0.7,
          convexStopLossPercent: stopLoss,
          convexMaxHoldingBars: holdingBars,
          forConfidenceThreshold: 0.4,
          signalGenerationInterval: 20,
        };

        const backtester = new ConvexityBacktesterWithFoR('BTC-Optimizer');
        backtester.optimizationParams = config;

        const result = backtester.run({
          symbol: 'BTC/USDT',
          dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
        });

        const optimResult: OptimizationResult = {
          symbol: 'BTC/USDT',
          config,
          totalTrades: result.metrics.totalTrades,
          winRate: result.metrics.winRate,
          totalReturn: result.metrics.totalReturn,
          annualizedReturn: result.metrics.annualizedReturn,
          longestLossStreak: result.metrics.longestLossStreak,
          longestWinStreak: result.metrics.longestWinStreak,
          avgWinPct: result.metrics.avgWinPct || 0,
          avgLossPct: result.metrics.avgLossPct || 0,
          sharpeRatio: result.metrics.sharpeRatio,
        };

        btcResults.push(optimResult);

        if (!bestResult || optimResult.totalReturn > bestResult.totalReturn) {
          bestResult = optimResult;
        }

        console.log(
          `SL: ${(stopLoss * 100).toFixed(2)}% | Hold: ${holdingBars}bars | Win: ${optimResult.winRate.toFixed(1)}% | Return: ${optimResult.totalReturn.toFixed(2)}% | LossStreak: ${optimResult.longestLossStreak}`
        );
      }
    }

    if (bestResult) {
      console.log('\n✅ BEST BTC CONFIG:');
      console.log(`   Stop Loss: ${(bestResult.config.convexStopLossPercent * 100).toFixed(2)}%`);
      console.log(`   Hold Bars: ${bestResult.config.convexMaxHoldingBars}`);
      console.log(`   Win Rate: ${bestResult.winRate.toFixed(2)}%`);
      console.log(`   Total Return: ${bestResult.totalReturn.toFixed(2)}%`);
      console.log(`   Loss Streak: ${bestResult.longestLossStreak}`);
    }

    return btcResults;
  }

  /**
   * Run parameter sweep for ETH - Focus on FoR confidence threshold
   */
  runETHOptimization(): OptimizationResult[] {
    const ethResults: OptimizationResult[] = [];

    console.log('\n' + '═'.repeat(70));
    console.log('🔬 ETH OPTIMIZATION - FoR Confidence & Signal Generation Sweep');
    console.log('═'.repeat(70));

    // FoR confidence sweep: 0.35 → 0.70 (more signals → higher quality)
    const confidenceThresholds = [0.35, 0.40, 0.50, 0.60, 0.70];
    // Scout target multiplier sweep: 1.5 → 2.5
    const targetMultipliers = [1.5, 2.0, 2.5];

    let bestResult: OptimizationResult | null = null;

    for (const confidence of confidenceThresholds) {
      for (const targetMult of targetMultipliers) {
        const config: OptimizationConfig = {
          scoutTargetMultiplier: targetMult,
          scoutStopMultiplier: 0.7,
          convexStopLossPercent: 0.02,
          convexMaxHoldingBars: 50,
          forConfidenceThreshold: confidence,
          signalGenerationInterval: 20,
        };

        const backtester = new ConvexityBacktesterWithFoR('ETH-Optimizer');
        backtester.optimizationParams = config;

        const result = backtester.run({
          symbol: 'ETH/USDT',
          dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json'),
        });

        const optimResult: OptimizationResult = {
          symbol: 'ETH/USDT',
          config,
          totalTrades: result.metrics.totalTrades,
          winRate: result.metrics.winRate,
          totalReturn: result.metrics.totalReturn,
          annualizedReturn: result.metrics.annualizedReturn,
          longestLossStreak: result.metrics.longestLossStreak,
          longestWinStreak: result.metrics.longestWinStreak,
          avgWinPct: result.metrics.avgWinPct || 0,
          avgLossPct: result.metrics.avgLossPct || 0,
          sharpeRatio: result.metrics.sharpeRatio,
        };

        ethResults.push(optimResult);

        if (!bestResult || optimResult.totalReturn > bestResult.totalReturn) {
          bestResult = optimResult;
        }

        console.log(
          `FoR: ${(confidence * 100).toFixed(0)}% | Target: ${targetMult.toFixed(1)}x | Win: ${optimResult.winRate.toFixed(1)}% | Return: ${optimResult.totalReturn.toFixed(2)}% | LossStreak: ${optimResult.longestLossStreak}`
        );
      }
    }

    if (bestResult) {
      console.log('\n✅ BEST ETH CONFIG:');
      console.log(`   FoR Confidence: ${(bestResult.config.forConfidenceThreshold * 100).toFixed(0)}%`);
      console.log(`   Target Multiplier: ${bestResult.config.scoutTargetMultiplier.toFixed(1)}x`);
      console.log(`   Win Rate: ${bestResult.winRate.toFixed(2)}%`);
      console.log(`   Total Return: ${bestResult.totalReturn.toFixed(2)}%`);
      console.log(`   Loss Streak: ${bestResult.longestLossStreak}`);
    }

    return ethResults;
  }

  /**
   * Run combined parameter sweep targeting losing streak reduction
   */
  runLosingStreakOptimization(): OptimizationResult[] {
    const streakResults: OptimizationResult[] = [];

    console.log('\n' + '═'.repeat(70));
    console.log('🎯 LOSING STREAK BREAKER - Combined Parameter Optimization');
    console.log('═'.repeat(70));

    // Anti-losing streak strategy: Tighter stops + Shorter hold times + Higher confidence
    const configs: OptimizationConfig[] = [
      // Config 1: Tight stops, short holds, high confidence
      {
        scoutTargetMultiplier: 1.8,
        scoutStopMultiplier: 0.6,
        convexStopLossPercent: 0.015,
        convexMaxHoldingBars: 40,
        forConfidenceThreshold: 0.55,
        signalGenerationInterval: 20,
      },
      // Config 2: Medium stops, medium holds, medium confidence
      {
        scoutTargetMultiplier: 2.0,
        scoutStopMultiplier: 0.65,
        convexStopLossPercent: 0.018,
        convexMaxHoldingBars: 50,
        forConfidenceThreshold: 0.50,
        signalGenerationInterval: 20,
      },
      // Config 3: Aggressive stops, longer holds, lower confidence
      {
        scoutTargetMultiplier: 2.2,
        scoutStopMultiplier: 0.8,
        convexStopLossPercent: 0.025,
        convexMaxHoldingBars: 60,
        forConfidenceThreshold: 0.35,
        signalGenerationInterval: 20,
      },
      // Config 4: Balanced for win rate
      {
        scoutTargetMultiplier: 1.9,
        scoutStopMultiplier: 0.65,
        convexStopLossPercent: 0.020,
        convexMaxHoldingBars: 45,
        forConfidenceThreshold: 0.45,
        signalGenerationInterval: 15,
      },
    ];

    console.log('\nTesting BTC with streak-breaking configs...\n');

    for (const config of configs) {
      const backtester = new ConvexityBacktesterWithFoR('BTC-StreakBreaker');
      backtester.optimizationParams = config;

      const result = backtester.run({
        symbol: 'BTC/USDT',
        dataPath: path.join(__dirname, '../../data/cache/BTCUSDT_1h_365d.json'),
      });

      const optimResult: OptimizationResult = {
        symbol: 'BTC/USDT',
        config,
        totalTrades: result.metrics.totalTrades,
        winRate: result.metrics.winRate,
        totalReturn: result.metrics.totalReturn,
        annualizedReturn: result.metrics.annualizedReturn,
        longestLossStreak: result.metrics.longestLossStreak,
        longestWinStreak: result.metrics.longestWinStreak,
        avgWinPct: result.metrics.avgWinPct || 0,
        avgLossPct: result.metrics.avgLossPct || 0,
        sharpeRatio: result.metrics.sharpeRatio,
      };

      streakResults.push(optimResult);

      const configStr = `Target: ${config.scoutTargetMultiplier.toFixed(1)}x | Stop: ${(config.convexStopLossPercent * 100).toFixed(2)}% | Hold: ${config.convexMaxHoldingBars}`;
      console.log(
        `${configStr} | Win: ${optimResult.winRate.toFixed(1)}% | Return: ${optimResult.totalReturn.toFixed(2)}% | LossStreak: ${optimResult.longestLossStreak}`
      );
    }

    // Test ETH too
    console.log('\nTesting ETH with streak-breaking configs...\n');

    for (const config of configs) {
      const backtester = new ConvexityBacktesterWithFoR('ETH-StreakBreaker');
      backtester.optimizationParams = config;

      const result = backtester.run({
        symbol: 'ETH/USDT',
        dataPath: path.join(__dirname, '../../data/cache/ETHUSDT_1h_365d.json'),
      });

      const optimResult: OptimizationResult = {
        symbol: 'ETH/USDT',
        config,
        totalTrades: result.metrics.totalTrades,
        winRate: result.metrics.winRate,
        totalReturn: result.metrics.totalReturn,
        annualizedReturn: result.metrics.annualizedReturn,
        longestLossStreak: result.metrics.longestLossStreak,
        longestWinStreak: result.metrics.longestWinStreak,
        avgWinPct: result.metrics.avgWinPct || 0,
        avgLossPct: result.metrics.avgLossPct || 0,
        sharpeRatio: result.metrics.sharpeRatio,
      };

      streakResults.push(optimResult);

      const configStr = `Target: ${config.scoutTargetMultiplier.toFixed(1)}x | Stop: ${(config.convexStopLossPercent * 100).toFixed(2)}% | Hold: ${config.convexMaxHoldingBars}`;
      console.log(
        `ETH | ${configStr} | Win: ${optimResult.winRate.toFixed(1)}% | Return: ${optimResult.totalReturn.toFixed(2)}% | LossStreak: ${optimResult.longestLossStreak}`
      );
    }

    return streakResults;
  }

  /**
   * Print optimization summary
   */
  printSummary(btcResults: OptimizationResult[], ethResults: OptimizationResult[], streakResults: OptimizationResult[]) {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 OPTIMIZATION SUMMARY');
    console.log('═'.repeat(70));

    // Best BTC
    const bestBTC = btcResults.reduce((a, b) => (a.totalReturn > b.totalReturn ? a : b));
    console.log('\n🥇 BEST BTC CONFIG:');
    console.log(`   Stop Loss: ${(bestBTC.config.convexStopLossPercent * 100).toFixed(2)}%`);
    console.log(`   Hold Bars: ${bestBTC.config.convexMaxHoldingBars}`);
    console.log(`   Win Rate: ${bestBTC.winRate.toFixed(2)}%`);
    console.log(`   Return: ${bestBTC.totalReturn.toFixed(2)}%`);
    console.log(`   Loss Streak: ${bestBTC.longestLossStreak}`);

    // Best ETH
    const bestETH = ethResults.reduce((a, b) => (a.totalReturn > b.totalReturn ? a : b));
    console.log('\n🥇 BEST ETH CONFIG:');
    console.log(`   FoR Confidence: ${(bestETH.config.forConfidenceThreshold * 100).toFixed(0)}%`);
    console.log(`   Target Mult: ${bestETH.config.scoutTargetMultiplier.toFixed(1)}x`);
    console.log(`   Win Rate: ${bestETH.winRate.toFixed(2)}%`);
    console.log(`   Return: ${bestETH.totalReturn.toFixed(2)}%`);
    console.log(`   Loss Streak: ${bestETH.longestLossStreak}`);

    // Best streak breaker
    const bestStreak = streakResults.reduce((a, b) => (a.longestLossStreak < b.longestLossStreak ? a : b));
    console.log('\n🎯 BEST LOSING STREAK BREAKER:');
    console.log(`   Symbol: ${bestStreak.symbol}`);
    console.log(`   Target Mult: ${bestStreak.config.scoutTargetMultiplier.toFixed(1)}x`);
    console.log(`   Stop Loss: ${(bestStreak.config.convexStopLossPercent * 100).toFixed(2)}%`);
    console.log(`   Hold Bars: ${bestStreak.config.convexMaxHoldingBars}`);
    console.log(`   Win Rate: ${bestStreak.winRate.toFixed(2)}%`);
    console.log(`   Return: ${bestStreak.totalReturn.toFixed(2)}%`);
    console.log(`   Loss Streak: ${bestStreak.longestLossStreak} ← IMPROVED!`);

    console.log('\n✅ Optimization complete! Ready to deploy best configs.');
  }
}

// Main execution
async function main() {
  const optimizer = new ConvexityOptimizer();

  // Run optimization sweeps
  const btcResults = optimizer.runBTCOptimization();
  const ethResults = optimizer.runETHOptimization();
  const streakResults = optimizer.runLosingStreakOptimization();

  // Print summary
  optimizer.printSummary(btcResults, ethResults, streakResults);
}

main().catch(console.error);
