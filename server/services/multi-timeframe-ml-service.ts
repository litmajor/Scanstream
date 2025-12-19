/**
 * Multi-Timeframe ML Signal Integration Service
 * 
 * Integrates LSTM predictions across all timeframes into scanner consensus pipeline.
 * Provides:
 * - Multi-timeframe LSTM predictions (1m, 5m, 15m, 1h, 4h, 1d)
 * - Consensus weighting across timeframes
 * - LONG/SHORT prediction consolidation
 * - ML metrics aggregation for signals
 * - Backtest-ready prediction storage
 */

import { lstmInferenceEngine, LSTMPredictionInput, LSTMPredictionOutput } from './lstm-inference-engine';
import { ScannerSignalService } from './scanner/scanner-signal-service';

export interface MultiTimeframePrediction {
  symbol: string;
  timestamp: number;
  predictions: {
    [timeframe: string]: LSTMPredictionOutput | null;
  };
  consensus: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // NEUTRAL if conflicting
    confidence: number; // 0-1, weighted average
    strength: number; // 0-100
    timeframesAgree: number; // Count of timeframes with consensus direction
  };
  weights: {
    [timeframe: string]: number; // 0-1, confidence weight per timeframe
  };
  aggregatedMetrics: {
    avgRiskScore: number;
    maxVolatility: 'low' | 'medium' | 'high' | 'extreme';
    shortestRegimeDuration: string;
    profitTargetWeighted: number;
    velocityConfidenceAvg: number;
  };
}

export interface MLSignalEnhancedOutput {
  // Original scanner signal
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;

  // ML enhancements
  mlConsensus: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    strength: number;
  };

  mlAlignment: {
    aligned: boolean; // Scanner direction == ML direction
    conflictLevel: 'none' | 'low' | 'medium' | 'high'; // How many timeframes disagree
    recommendationStrength: 'weak' | 'moderate' | 'strong'; // Based on both sources
  };

  mlMetrics: {
    riskScore: number;
    profitTarget: number;
    regimeDuration: string;
    volatility: 'low' | 'medium' | 'high' | 'extreme';
    timeframesAnalyzed: string[];
  };

  combinedScore: number; // 0-100, blended ML + scanner + risk
}

export interface BacktestPrediction {
  symbol: string;
  timestamp: number;
  timeframe: string;
  direction: 'BULLISH' | 'BEARISH';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  priceAtCompletion?: number; // Set when backtest completes
  result?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  profitPercent?: number;
  holdCandles?: number;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const TIMEFRAME_WEIGHTS: { [key in Timeframe]: number } = {
  '1m': 0.05,   // Least reliable
  '5m': 0.10,
  '15m': 0.15,
  '1h': 0.20,   
  '4h': 0.25,
  '1d': 0.25,
};

/**
 * Multi-Timeframe ML Signal Integration Service
 */
export class MultiTimeframeMLService {
  private predictionCache = new Map<string, MultiTimeframePrediction>();
  private backtestPredictions: BacktestPrediction[] = [];
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get multi-timeframe predictions for a symbol
   */
  async getPredictions(symbol: string): Promise<MultiTimeframePrediction | null> {
    try {
      // Check cache
      const cached = this.predictionCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached;
      }

      // Fetch predictions for all timeframes in parallel
      const predictions: { [key in Timeframe]?: LSTMPredictionOutput | null } = {};
      const weights: { [key in Timeframe]?: number } = {};

      const predictionPromises = TIMEFRAMES.map(async (tf) => {
        try {
          const pred = await lstmInferenceEngine.predict({
            symbol,
            timeframe: tf as LSTMPredictionInput['timeframe'],
            lookbackCandles: 100,
          });

          predictions[tf as Timeframe] = pred;
          // Weight based on confidence and timeframe importance
          weights[tf as Timeframe] = (pred?.direction.confidence || 0.5) * TIMEFRAME_WEIGHTS[tf as Timeframe];
        } catch (error) {
          console.warn(`[ML Service] Failed to get prediction for ${symbol} on ${tf}:`, error);
          predictions[tf as Timeframe] = null;
          weights[tf as Timeframe] = 0;
        }
      });

      await Promise.all(predictionPromises);

      // Calculate consensus
      const result = this.calculateConsensus(symbol, predictions as any, weights as any);

      // Cache result
      this.predictionCache.set(symbol, result);

      return result;
    } catch (error) {
      console.error(`[ML Service] Error getting multi-timeframe predictions for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate consensus direction across timeframes
   */
  private calculateConsensus(
    symbol: string,
    predictions: { [key in Timeframe]: LSTMPredictionOutput | null },
    weights: { [key in Timeframe]: number }
  ): MultiTimeframePrediction {
    const bullishCount = Object.entries(predictions)
      .filter(([_, pred]) => pred?.direction.prediction === 'BULLISH')
      .length;

    const bearishCount = Object.entries(predictions)
      .filter(([_, pred]) => pred?.direction.prediction === 'BEARISH')
      .length;

    const totalValid = bullishCount + bearishCount;
    const timeframesAgree = Math.max(bullishCount, bearishCount);

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishCount > bearishCount * 1.5) {
      direction = 'BULLISH';
    } else if (bearishCount > bullishCount * 1.5) {
      direction = 'BEARISH';
    } else {
      direction = 'NEUTRAL';
    }

    // Weighted confidence calculation
    let totalWeight = 0;
    let weightedConfidence = 0;

    Object.entries(predictions).forEach(([timeframe, pred]) => {
      if (pred && pred.direction.prediction === direction) {
        const weight = weights[timeframe as Timeframe] || 0;
        weightedConfidence += pred.direction.confidence * weight;
        totalWeight += weight;
      }
    });

    const confidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0.5;

    // Aggregate metrics
    const validPredictions = Object.values(predictions).filter(p => p !== null) as LSTMPredictionOutput[];

    const aggregatedMetrics = {
      avgRiskScore: validPredictions.length > 0
        ? validPredictions.reduce((sum, p) => sum + p.riskAssessment.score, 0) / validPredictions.length
        : 50,

      maxVolatility: this.getMaxVolatility(validPredictions),

      shortestRegimeDuration: this.getShortestRegimeDuration(validPredictions),

      profitTargetWeighted: this.getWeightedProfitTarget(
        Object.entries(predictions) as any,
        Object.entries(weights) as any
      ),

      velocityConfidenceAvg: validPredictions.length > 0
        ? validPredictions.reduce((sum, p) => sum + p.trendMomentum.confidence, 0) / validPredictions.length
        : 0.5,
    };

    return {
      symbol,
      timestamp: Date.now(),
      predictions: predictions as any,
      consensus: {
        direction,
        confidence,
        strength: confidence * 100,
        timeframesAgree,
      },
      weights: weights as any,
      aggregatedMetrics,
    };
  }

  /**
   * Get maximum volatility level across predictions
   */
  private getMaxVolatility(predictions: LSTMPredictionOutput[]): 'low' | 'medium' | 'high' | 'extreme' {
    const levels = ['low', 'medium', 'high', 'extreme'] as const;
    const maxLevel = Math.max(...predictions.map(p => levels.indexOf(p.volatility.level)));
    return levels[maxLevel] || 'medium';
  }

  /**
   * Get shortest regime duration (imminent change)
   */
  private getShortestRegimeDuration(predictions: LSTMPredictionOutput[]): string {
    if (predictions.length === 0) return 'unknown';
    const shortest = predictions.reduce((min, p) => 
      p.regimeDuration.candles < min.regimeDuration.candles ? p : min
    );
    return shortest.regimeDuration.duration;
  }

  /**
   * Calculate weighted profit target
   */
  private getWeightedProfitTarget(
    predictions: [string, LSTMPredictionOutput | null][],
    weights: [string, number][]
  ): number {
    let totalTarget = 0;
    let totalWeight = 0;

    predictions.forEach(([_, pred]) => {
      if (pred) {
        const idx = predictions.findIndex(([tf, _]) => tf === Object.keys(pred)[0]);
        if (idx >= 0) {
          const weight = weights[idx]?.[1] || 0;
          totalTarget += pred.velocityProfile.profitTarget * weight;
          totalWeight += weight;
        }
      }
    });

    return totalWeight > 0 ? totalTarget / totalWeight : 0;
  }

  /**
   * Enhance scanner signal with ML metrics
   */
  async enhanceScannerSignal(
    symbol: string,
    scannerDirection: 'LONG' | 'SHORT',
    entry: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<MLSignalEnhancedOutput> {
    const mlPredictions = await this.getPredictions(symbol);

    if (!mlPredictions) {
      // Fallback: return scanner signal as-is
      return {
        symbol,
        direction: scannerDirection,
        entry,
        stopLoss,
        takeProfit,
        riskRewardRatio: (takeProfit - entry) / (entry - stopLoss),
        mlConsensus: { direction: 'NEUTRAL', confidence: 0, strength: 0 },
        mlAlignment: { aligned: false, conflictLevel: 'none', recommendationStrength: 'weak' },
        mlMetrics: {
          riskScore: 50,
          profitTarget: takeProfit,
          regimeDuration: 'unknown',
          volatility: 'medium',
          timeframesAnalyzed: [],
        },
        combinedScore: 50,
      };
    }

    const mlDirection = mlPredictions.consensus.direction === 'BULLISH' ? 'LONG' : 'SHORT';
    const aligned = scannerDirection === mlDirection;
    const conflictCount = TIMEFRAMES.length - mlPredictions.consensus.timeframesAgree;
    const conflictLevel = conflictCount === 0 ? 'none' : conflictCount <= 2 ? 'low' : conflictCount <= 4 ? 'medium' : 'high';

    const recommendationStrength =
      !aligned ? 'weak'
      : mlPredictions.consensus.confidence > 0.75 ? 'strong'
      : mlPredictions.consensus.confidence > 0.60 ? 'moderate'
      : 'weak';

    // Combined score: 40% scanner momentum + 40% ML consensus + 20% risk/volatility
    const scannerQuality = 75; // Placeholder from scanner-signal service
    const mlQuality = mlPredictions.consensus.confidence * 100;
    const riskQuality = Math.max(0, 100 - mlPredictions.aggregatedMetrics.avgRiskScore);

    const combinedScore = scannerQuality * 0.4 + mlQuality * 0.4 + riskQuality * 0.2;

    return {
      symbol,
      direction: scannerDirection,
      entry,
      stopLoss,
      takeProfit,
      riskRewardRatio: (takeProfit - entry) / (entry - stopLoss),

      mlConsensus: {
        direction: mlPredictions.consensus.direction,
        confidence: mlPredictions.consensus.confidence,
        strength: mlPredictions.consensus.strength,
      },

      mlAlignment: {
        aligned,
        conflictLevel,
        recommendationStrength,
      },

      mlMetrics: {
        riskScore: Math.round(mlPredictions.aggregatedMetrics.avgRiskScore),
        profitTarget: mlPredictions.aggregatedMetrics.profitTargetWeighted,
        regimeDuration: mlPredictions.aggregatedMetrics.shortestRegimeDuration,
        volatility: mlPredictions.aggregatedMetrics.maxVolatility,
        timeframesAnalyzed: [...TIMEFRAMES],
      },

      combinedScore: Math.round(combinedScore),
    };
  }

  /**
   * Record prediction for backtesting
   */
  recordBacktestPrediction(prediction: BacktestPrediction): void {
    this.backtestPredictions.push(prediction);
  }

  /**
   * Get backtested predictions for analysis
   */
  getBacktestedPredictions(
    symbol?: string,
    timeframe?: string,
    limit?: number
  ): BacktestPrediction[] {
    let results = this.backtestPredictions;

    if (symbol) {
      results = results.filter(p => p.symbol === symbol);
    }

    if (timeframe) {
      results = results.filter(p => p.timeframe === timeframe);
    }

    if (limit) {
      results = results.slice(-limit);
    }

    return results;
  }

  /**
   * Calculate backtest statistics
   */
  calculateBacktestStats(
    predictions: BacktestPrediction[]
  ): {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgProfitPercent: number;
    sharpeRatio: number;
    maxDrawdown: number;
    byTimeframe: { [key: string]: any };
  } {
    if (predictions.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgProfitPercent: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        byTimeframe: {},
      };
    }

    const completedTrades = predictions.filter(p => p.result);
    const wins = completedTrades.filter(p => p.result === 'WIN').length;
    const losses = completedTrades.filter(p => p.result === 'LOSS').length;

    const profits = completedTrades.map(p => p.profitPercent || 0);
    const avgProfit = profits.reduce((a, b) => a + b, 0) / Math.max(1, completedTrades.length);

    // Sharpe ratio (simplified: daily returns)
    const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / Math.max(1, completedTrades.length);
    const sharpe = Math.sqrt(variance) > 0 ? avgProfit / Math.sqrt(variance) : 0;

    // Max drawdown
    let peak = 0;
    let maxDD = 0;
    let cumProfit = 0;
    for (const p of profits) {
      cumProfit += p;
      peak = Math.max(peak, cumProfit);
      maxDD = Math.min(maxDD, cumProfit - peak);
    }

    // By timeframe
    const byTimeframe: { [key: string]: any } = {};
    for (const tf of TIMEFRAMES) {
      const tfPredictions = completedTrades.filter(p => p.timeframe === tf);
      if (tfPredictions.length > 0) {
        const tfWins = tfPredictions.filter(p => p.result === 'WIN').length;
        const tfProfits = tfPredictions.map(p => p.profitPercent || 0);
        byTimeframe[tf] = {
          trades: tfPredictions.length,
          wins: tfWins,
          winRate: tfWins / tfPredictions.length,
          avgProfit: tfProfits.reduce((a, b) => a + b, 0) / tfPredictions.length,
        };
      }
    }

    return {
      totalTrades: completedTrades.length,
      wins,
      losses,
      winRate: wins / Math.max(1, completedTrades.length),
      avgProfitPercent: avgProfit,
      sharpeRatio: sharpe,
      maxDrawdown: maxDD,
      byTimeframe,
    };
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.predictionCache.clear();
  }

  /**
   * Clear backtest data
   */
  clearBacktestData(): void {
    this.backtestPredictions = [];
  }
}

export const multiTimeframeMLService = new MultiTimeframeMLService();
