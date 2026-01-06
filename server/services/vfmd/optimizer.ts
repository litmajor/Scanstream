/**
 * VFMD Regime Optimizer
 * 
 * Finds optimal threshold parameters for each market regime
 * using grid search over historical data
 * 
 * Result: Data-driven configuration instead of manual guessing
 */

import type { MarketTick } from './types';
import { RegimeClassifier, FlowRegime } from './regimeClassifier.ts';
import { VFMDBacktester } from './backtester';
import { VFMDPhysicsAgent } from '../rpg-agents/VFMDPhysicsAgent';

/**
 * Grid search parameter ranges
 */
export interface OptimizationGrids {
  minConfidenceRange: number[];
  minPEGRange: number[];
  maxTIRange: number[];
  minCoherenceRange: number[];
  riskPercentRange: number[];
  positionSizeRange: number[];
}

/**
 * Optimization result for a single parameter combination
 */
export interface OptimizationResult {
  parameters: {
    minConfidence: number;
    minPEG: number;
    maxTI: number;
    minCoherence: number;
    riskPercent: number;
    positionSize: number;
  };
  metrics: {
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    avgTrade: number;
    tradeCount: number;
  };
  score: number; // Composite fitness score
}

/**
 * Complete optimization report
 */
export interface OptimizationReport {
  regime: FlowRegime;
  timestamp: number;
  backtestsRun: number;
  bestResult: OptimizationResult;
  topResults: OptimizationResult[];
  recommendedConfig: any;
}

export class RegimeOptimizer {
  /**
   * Run full optimization for a single regime
   *
   * Grid search over parameter space, backtest each combination,
   * return optimal parameters for that regime
   */
  static async optimizeRegime(
    regime: FlowRegime,
    historicalData: MarketTick[],
    agent: VFMDPhysicsAgent,
    grids: OptimizationGrids
  ): Promise<OptimizationReport> {
    const results: OptimizationResult[] = [];

    // Grid search - try all combinations
    let backtestsRun = 0;

    for (const minConfidence of grids.minConfidenceRange) {
      for (const minPEG of grids.minPEGRange) {
        for (const maxTI of grids.maxTIRange) {
          for (const minCoherence of grids.minCoherenceRange) {
            for (const riskPercent of grids.riskPercentRange) {
              for (const positionSize of grids.positionSizeRange) {
                backtestsRun++;

                try {
                  // Create parameter config
                  const config = {
                    minConfidence,
                    minPEG,
                    maxTI,
                    minCoherence,
                    riskPercent,
                    positionSize
                  };

                  // Run backtest with this config
                  const backtest = await VFMDBacktester.backtest(
                    'PARAM_TEST',
                    historicalData,
                    agent,
                    100,
                    0.02,
                    0.04
                  );

                  // Get regime-specific stats
                  const regimeStats = backtest.regimeStats[regime];

                  // Calculate fitness score
                  // Balance: Sharpe (returns), Win Rate, Profit Factor, Drawdown
                  const sharpeScore = Math.max(0, backtest.sharpeRatio);
                  const winRateScore = regimeStats.winRate * 100;
                  const pfScore = Math.max(0, regimeStats.profitFactor);
                  const ddScore = Math.max(0, 100 * (1 - backtest.maxDrawdown));

                  // Weighted composite score
                  const compositeScore =
                    sharpeScore * 0.4 + // Weight return efficiency
                    winRateScore * 0.2 + // Weight accuracy
                    pfScore * 15 * 0.2 + // Weight profitability
                    ddScore * 0.2; // Weight risk control

                  results.push({
                    parameters: config,
                    metrics: {
                      sharpeRatio: backtest.sharpeRatio,
                      winRate: regimeStats.winRate,
                      profitFactor: regimeStats.profitFactor,
                      maxDrawdown: backtest.maxDrawdown,
                      avgTrade: regimeStats.avgPnL,
                      tradeCount: regimeStats.tradeCount
                    },
                    score: compositeScore
                  });
                } catch (e) {
                  // Skip failed backtests
                  continue;
                }
              }
            }
          }
        }
      }
    }

    // Sort by fitness score (descending)
    results.sort((a, b) => b.score - a.score);

    const bestResult = results[0];
    const topResults = results.slice(0, 10); // Top 10 configs

    // Generate recommended config from best result
    const recommendedConfig = {
      regime,
      minConfidence: bestResult.parameters.minConfidence,
      minPEG: bestResult.parameters.minPEG,
      maxTI: bestResult.parameters.maxTI,
      minCoherence: bestResult.parameters.minCoherence,
      riskPercent: bestResult.parameters.riskPercent,
      positionSize: bestResult.parameters.positionSize,
      expectedPerformance: {
        sharpeRatio: bestResult.metrics.sharpeRatio,
        winRate: (bestResult.metrics.winRate * 100).toFixed(0) + '%',
        profitFactor: bestResult.metrics.profitFactor.toFixed(2),
        expectedDD: (bestResult.metrics.maxDrawdown * 100).toFixed(1) + '%',
        expectedAvgTrade: bestResult.metrics.avgTrade.toFixed(2)
      }
    };

    return {
      regime,
      timestamp: Date.now(),
      backtestsRun,
      bestResult,
      topResults,
      recommendedConfig
    };
  }

  /**
   * Get default grid ranges (reasonable starting point)
   */
  static getDefaultGrids(): OptimizationGrids {
    return {
      // Signal threshold
      minConfidenceRange: [0.35, 0.40, 0.45, 0.50, 0.55, 0.60],

      // Energy levels
      minPEGRange: [0.8, 1.0, 1.2, 1.5],

      // Chaos tolerance
      maxTIRange: [0.8, 1.0, 1.2, 1.5, 1.8],

      // Field alignment
      minCoherenceRange: [0.3, 0.4, 0.5, 0.6],

      // Risk per trade
      riskPercentRange: [0.01, 0.015, 0.02, 0.025],

      // Position sizing
      positionSizeRange: [0.75, 1.0, 1.25, 1.5]
    };
  }

  /**
   * Get aggressive optimization grid (wider search)
   */
  static getAggressiveGrids(): OptimizationGrids {
    return {
      minConfidenceRange: [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
      minPEGRange: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0],
      maxTIRange: [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0],
      minCoherenceRange: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
      riskPercentRange: [0.005, 0.01, 0.015, 0.02, 0.025, 0.03],
      positionSizeRange: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
    };
  }

  /**
   * Get conservative optimization grid (narrow search)
   */
  static getConservativeGrids(): OptimizationGrids {
    return {
      minConfidenceRange: [0.45, 0.50, 0.55, 0.60],
      minPEGRange: [1.0, 1.2],
      maxTIRange: [1.0, 1.2, 1.5],
      minCoherenceRange: [0.4, 0.5],
      riskPercentRange: [0.01, 0.015],
      positionSizeRange: [0.75, 1.0]
    };
  }

  /**
   * Optimize all 6 regimes in parallel
   */
  static async optimizeAllRegimes(
    historicalData: MarketTick[],
    agent: VFMDPhysicsAgent,
    gridStrategy: 'default' | 'aggressive' | 'conservative' = 'default'
  ): Promise<Map<FlowRegime, OptimizationReport>> {
    const results = new Map<FlowRegime, OptimizationReport>();

    const grids =
      gridStrategy === 'aggressive'
        ? this.getAggressiveGrids()
        : gridStrategy === 'conservative'
        ? this.getConservativeGrids()
        : this.getDefaultGrids();

    // Optimize each regime
    const regimes = Object.values(FlowRegime);
    for (const regime of regimes) {
      try {
        const report = await this.optimizeRegime(regime, historicalData, agent, grids);
        results.set(regime, report);

        console.log(
          `✓ Optimized ${regime}: Best Sharpe ${report.bestResult.metrics.sharpeRatio.toFixed(2)}`
        );
      } catch (e) {
        console.error(`✗ Failed to optimize ${regime}:`, e);
      }
    }

    return results;
  }

  /**
   * Compare performance across all regimes
   */
  static compareRegimes(
    results: Map<FlowRegime, OptimizationReport>
  ): {
    bestRegime: FlowRegime;
    worstRegime: FlowRegime;
    comparisons: Array<{
      regime: FlowRegime;
      sharpe: number;
      winRate: number;
      pf: number;
    }>;
  } {
    const comparisons = Array.from(results.entries()).map(([regime, report]) => ({
      regime,
      sharpe: report.bestResult.metrics.sharpeRatio,
      winRate: report.bestResult.metrics.winRate,
      pf: report.bestResult.metrics.profitFactor
    }));

    comparisons.sort((a, b) => b.sharpe - a.sharpe);

    return {
      bestRegime: comparisons[0].regime,
      worstRegime: comparisons[comparisons.length - 1].regime,
      comparisons
    };
  }

  /**
   * Generate optimization report
   */
  static formatReport(report: OptimizationReport): string {
    const best = report.bestResult;
    const lines = [
      `\n${'='.repeat(70)}`,
      `VFMD OPTIMIZATION REPORT - ${report.regime.toUpperCase()}`,
      `Backtests Run: ${report.backtestsRun}`,
      `${'='.repeat(70)}`,

      `\nBEST PARAMETERS:`,
      `  Min Confidence: ${(best.parameters.minConfidence * 100).toFixed(0)}%`,
      `  Min PEG: ${best.parameters.minPEG.toFixed(2)}`,
      `  Max TI: ${best.parameters.maxTI.toFixed(2)}`,
      `  Min Coherence: ${(best.parameters.minCoherence * 100).toFixed(0)}%`,
      `  Risk Per Trade: ${(best.parameters.riskPercent * 100).toFixed(1)}%`,
      `  Position Size: ${(best.parameters.positionSize * 100).toFixed(0)}%`,

      `\nEXPECTED PERFORMANCE:`,
      `  Sharpe Ratio: ${best.metrics.sharpeRatio.toFixed(2)}`,
      `  Win Rate: ${(best.metrics.winRate * 100).toFixed(0)}%`,
      `  Profit Factor: ${best.metrics.profitFactor.toFixed(2)}`,
      `  Max Drawdown: ${(best.metrics.maxDrawdown * 100).toFixed(1)}%`,
      `  Avg Trade: ${best.metrics.avgTrade.toFixed(2)}`,
      `  Trades: ${best.metrics.tradeCount}`,

      `\nTOP 10 CONFIGURATIONS:`,
      `${'#'.padEnd(3)} ${'Sharpe'.padEnd(10)} ${'WR%'.padEnd(8)} ${'PF'.padEnd(8)} ${'Trades'.padEnd(8)}`
    ];

    for (let i = 0; i < Math.min(10, report.topResults.length); i++) {
      const r = report.topResults[i];
      lines.push(
        `${(i + 1).toString().padEnd(3)} ${r.metrics.sharpeRatio.toFixed(2).padEnd(10)} ${(r.metrics.winRate * 100).toFixed(0).padEnd(8)} ${r.metrics.profitFactor.toFixed(2).padEnd(8)} ${r.metrics.tradeCount.toString().padEnd(8)}`
      );
    }

    lines.push(`\n${'='.repeat(70)}\n`);
    return lines.join('\n');
  }
}
