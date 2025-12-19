/**
 * Capability Measurement Service
 * 
 * Measures the before/after impact of trading capabilities by running
 * parallel backtests with and without each capability enabled.
 * 
 * Phase 1: Cluster Validation, Position Sizing, Voting Comparison
 */

import { Trade } from '@shared/schema';
import { createClusterValidator, type ClusterMetrics } from './clustering/cluster-validator';
import { createPositionSizer } from './clustering/position-sizer';

export interface CapabilityMeasurementConfig {
  // What to measure
  enableClusterValidation?: boolean;
  enablePositionSizing?: boolean;
  enableVotingComparison?: boolean;
  
  // Cluster metrics (mock data for backtest)
  clusterMetricsProvider?: (symbol: string, timestamp: Date) => ClusterMetrics | null;
  
  // Baseline for comparison
  baselineMetrics?: BacktestMetrics;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgWinPercent: number;
  avgLossPercent: number;
}

export interface EnhancedTrade extends Trade {
  // Cluster validation metrics
  clusterValidation?: {
    baseQuality: number;
    finalQuality: number;
    confidence: string;
    sizeMultiplier: number;
    wasSkipped: boolean;
  };
  
  // Position sizing metrics
  positionSizing?: {
    baseSize: number;
    sizeMultiplier: number;
    finalSize: number;
    convictionLevel: string;
  };
  
  // Voting metrics
  votingMetrics?: {
    votingMethod: string;
    consensusAchieved: boolean;
    agentVotes: number;
    agentAgreement: number; // 0-1
    confidence: number;
  };
}

export interface CapabilityImpactReport {
  baseline: {
    metrics: BacktestMetrics;
    tradeCount: number;
    description: string;
  };
  
  withClusterValidation?: {
    metrics: BacktestMetrics;
    tradeCount: number;
    tradesSkipped: number;
    avgQualityImprovement: number; // %
    impact: {
      returnImprovement: number; // %
      sharpeImprovement: number; // %
      drawdownReduction: number; // %
      winRateImprovement: number; // percentage points
    };
  };
  
  withPositionSizing?: {
    metrics: BacktestMetrics;
    avgMultiplier: number;
    minMultiplier: number;
    maxMultiplier: number;
    impact: {
      returnImprovement: number;
      sharpeImprovement: number;
      drawdownReduction: number;
    };
  };
  
  withVotingComparison?: {
    majority: BacktestMetrics;
    weighted: BacktestMetrics;
    consensus: BacktestMetrics;
    unanimous: BacktestMetrics;
    best: {
      method: string;
      metrics: BacktestMetrics;
      improvement: number; // % vs baseline
    };
  };
  
  combined?: {
    allEnabled: BacktestMetrics;
    impact: {
      returnImprovement: number;
      sharpeImprovement: number;
      drawdownReduction: number;
      winRateImprovement: number;
    };
  };
}

export class CapabilityMeasurement {
  private clusterValidator = createClusterValidator();
  private positionSizer = createPositionSizer();

  /**
   * Enhance trades with cluster validation
   * Returns trades that pass validation + quality metrics
   */
  applyClusterValidation(
    trades: Trade[],
    clusterMetricsProvider: (symbol: string, timestamp: Date) => ClusterMetrics | null
  ): {
    trades: EnhancedTrade[];
    skippedCount: number;
    avgQualityImprovement: number;
  } {
    const enhanced: EnhancedTrade[] = [];
    let totalQualityImprovement = 0;
    let validatedCount = 0;
    let skippedCount = 0;

    for (const trade of trades) {
      const clusterMetrics = clusterMetricsProvider(trade.symbol, new Date(trade.entryTime));
      
      if (!clusterMetrics) {
        // No cluster data, pass through
        enhanced.push({ ...trade });
        continue;
      }

      // Base confidence from signal (mock 0.65 if not available)
      const baseQuality = 0.65;
      
      // Validate with cluster
      const validation = this.clusterValidator.validateEntry(baseQuality, clusterMetrics);
      
      // Check if we should skip this trade
      const shouldTrade = validation.final_entry_quality >= 0.5; // Minimum threshold
      
      if (!shouldTrade) {
        skippedCount++;
        continue;
      }

      totalQualityImprovement += (validation.final_entry_quality - baseQuality);
      validatedCount++;

      enhanced.push({
        ...trade,
        clusterValidation: {
          baseQuality,
          finalQuality: validation.final_entry_quality,
          confidence: validation.confidence_level,
          sizeMultiplier: validation.size_multiplier,
          wasSkipped: false
        }
      });
    }

    const avgQualityImprovement = validatedCount > 0 
      ? (totalQualityImprovement / validatedCount) * 100 
      : 0;

    return {
      trades: enhanced,
      skippedCount,
      avgQualityImprovement
    };
  }

  /**
   * Apply dynamic position sizing based on cluster conviction
   */
  applyPositionSizing(
    trades: EnhancedTrade[],
    baseSize: number,
    clusterMetricsProvider: (symbol: string, timestamp: Date) => ClusterMetrics | null
  ): EnhancedTrade[] {
    return trades.map(trade => {
      const clusterMetrics = clusterMetricsProvider(trade.symbol, new Date(trade.entryTime));
      
      if (!clusterMetrics) {
        return trade;
      }

      const sizing = this.positionSizer.calculateSize({
        baseSize,
        cluster_strength: clusterMetrics.cluster_strength,
        trend_formation: clusterMetrics.trend_formation_signal,
        signal_quality: 0.65
      });

      // Adjust trade size with multiplier
      const adjustedQuantity = (trade.quantity || 1) * sizing.size_multiplier;

      return {
        ...trade,
        quantity: adjustedQuantity,
        positionSizing: {
          baseSize: trade.quantity || baseSize,
          sizeMultiplier: sizing.size_multiplier,
          finalSize: adjustedQuantity,
          convictionLevel: sizing.conviction_level
        }
      };
    });
  }

  /**
   * Add voting metrics to trades (for comparison purposes)
   */
  addVotingMetrics(
    trades: Trade[],
    votingMethod: 'majority' | 'weighted' | 'consensus' | 'unanimous',
    agentCount: number = 4
  ): EnhancedTrade[] {
    return trades.map(trade => ({
      ...trade,
      votingMetrics: {
        votingMethod,
        consensusAchieved: true, // Mock: would come from voting service
        agentVotes: agentCount,
        agentAgreement: 0.85, // Mock value
        confidence: 0.75 // Mock value
      }
    }));
  }

  /**
   * Calculate metrics from trades
   */
  calculateMetrics(trades: Trade[]): BacktestMetrics {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        totalReturnPercent: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        avgWinPercent: 0,
        avgLossPercent: 0
      };
    }

    const pnlValues = trades.map(t => t.pnl || 0);
    const winningTrades = pnlValues.filter(p => p > 0);
    const losingTrades = pnlValues.filter(p => p <= 0);

    const totalReturn = pnlValues.reduce((a, b) => a + b, 0);
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((a, b) => a + b, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((a, b) => a + b, 0) / losingTrades.length 
      : 0;

    // Calculate Sharpe Ratio (simplified)
    const returns = trades.map((t, i) => {
      if (i === 0) return 0;
      return pnlValues[i];
    });
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Calculate Max Drawdown
    let maxDrawdown = 0;
    let peakValue = 0;
    for (const pnl of pnlValues) {
      peakValue = Math.max(peakValue, pnl);
      maxDrawdown = Math.min(maxDrawdown, pnl - peakValue);
    }

    return {
      totalReturn,
      totalReturnPercent: (totalReturn / 10000) * 100, // Assuming 10k initial
      winRate: winningTrades.length / trades.length,
      profitFactor: Math.abs(winningTrades.length > 0 && losingTrades.length > 0
        ? winningTrades.reduce((a, b) => a + b, 0) / Math.abs(losingTrades.reduce((a, b) => a + b, 0))
        : winningTrades.length > 0 ? Infinity : 0),
      sharpeRatio,
      maxDrawdown: Math.abs(maxDrawdown),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgWin,
      avgLoss: Math.abs(avgLoss),
      avgWinPercent: avgWin > 0 ? (avgWin / 100) * 100 : 0,
      avgLossPercent: avgLoss < 0 ? Math.abs((avgLoss / 100) * 100) : 0
    };
  }

  /**
   * Compare metrics between baseline and enhanced
   */
  compareMetrics(baseline: BacktestMetrics, enhanced: BacktestMetrics) {
    return {
      returnImprovement: baseline.totalReturnPercent !== 0
        ? ((enhanced.totalReturnPercent - baseline.totalReturnPercent) / baseline.totalReturnPercent) * 100
        : 0,
      sharpeImprovement: baseline.sharpeRatio !== 0
        ? ((enhanced.sharpeRatio - baseline.sharpeRatio) / baseline.sharpeRatio) * 100
        : 0,
      drawdownReduction: baseline.maxDrawdown !== 0
        ? ((baseline.maxDrawdown - enhanced.maxDrawdown) / baseline.maxDrawdown) * 100
        : 0,
      winRateImprovement: (enhanced.winRate - baseline.winRate) * 100 // percentage points
    };
  }

  /**
   * Generate impact report for all capabilities
   */
  generateImpactReport(
    baselineTrades: Trade[],
    config: CapabilityMeasurementConfig
  ): CapabilityImpactReport {
    const baselineMetrics = this.calculateMetrics(baselineTrades);
    const report: CapabilityImpactReport = {
      baseline: {
        metrics: baselineMetrics,
        tradeCount: baselineTrades.length,
        description: 'Baseline: No enhancements applied'
      }
    };

    // If cluster validation provider is available
    if (config.enableClusterValidation && config.clusterMetricsProvider) {
      const { trades: validatedTrades, skippedCount, avgQualityImprovement } = 
        this.applyClusterValidation(baselineTrades, config.clusterMetricsProvider);
      
      const metrics = this.calculateMetrics(validatedTrades);
      const impact = this.compareMetrics(baselineMetrics, metrics);
      
      report.withClusterValidation = {
        metrics,
        tradeCount: validatedTrades.length,
        tradesSkipped: skippedCount,
        avgQualityImprovement,
        impact
      };
    }

    // If position sizing
    if (config.enablePositionSizing && config.clusterMetricsProvider) {
      let positionedTrades = baselineTrades;
      
      // First apply cluster validation if enabled
      if (config.enableClusterValidation) {
        const { trades: validatedTrades } = 
          this.applyClusterValidation(baselineTrades, config.clusterMetricsProvider);
        positionedTrades = validatedTrades;
      }

      const sizedTrades = this.applyPositionSizing(
        positionedTrades as EnhancedTrade[],
        100,
        config.clusterMetricsProvider
      );

      const metrics = this.calculateMetrics(sizedTrades);
      const impact = this.compareMetrics(baselineMetrics, metrics);
      
      const multipliers = sizedTrades
        .filter(t => t.positionSizing)
        .map(t => t.positionSizing!.sizeMultiplier);

      report.withPositionSizing = {
        metrics,
        avgMultiplier: multipliers.length > 0 
          ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length 
          : 1.0,
        minMultiplier: multipliers.length > 0 ? Math.min(...multipliers) : 1.0,
        maxMultiplier: multipliers.length > 0 ? Math.max(...multipliers) : 1.0,
        impact
      };
    }

    // If voting comparison
    if (config.enableVotingComparison) {
      const methods: Array<'majority' | 'weighted' | 'consensus' | 'unanimous'> = 
        ['majority', 'weighted', 'consensus', 'unanimous'];
      
      const votingResults: Record<string, BacktestMetrics> = {};
      let bestMetrics: BacktestMetrics | null = null;
      let bestMethod = '';
      let bestImprovement = -Infinity;

      for (const method of methods) {
        const votedTrades = this.addVotingMetrics(baselineTrades, method);
        const metrics = this.calculateMetrics(votedTrades);
        votingResults[method] = metrics;

        const improvement = this.compareMetrics(baselineMetrics, metrics).returnImprovement;
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestMetrics = metrics;
          bestMethod = method;
        }
      }

      report.withVotingComparison = {
        majority: votingResults['majority'],
        weighted: votingResults['weighted'],
        consensus: votingResults['consensus'],
        unanimous: votingResults['unanimous'],
        best: {
          method: bestMethod,
          metrics: bestMetrics!,
          improvement: bestImprovement
        }
      };
    }

    // Combined: all enabled
    if (config.enableClusterValidation && config.enablePositionSizing && config.clusterMetricsProvider) {
      const { trades: validatedTrades } = 
        this.applyClusterValidation(baselineTrades, config.clusterMetricsProvider);
      const sizedTrades = this.applyPositionSizing(
        validatedTrades as EnhancedTrade[],
        100,
        config.clusterMetricsProvider
      );

      const metrics = this.calculateMetrics(sizedTrades);
      const impact = this.compareMetrics(baselineMetrics, metrics);

      report.combined = {
        allEnabled: metrics,
        impact
      };
    }

    return report;
  }
}

export function createCapabilityMeasurement(): CapabilityMeasurement {
  return new CapabilityMeasurement();
}
