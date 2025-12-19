/**
 * Scanner Signal Service
 * 
 * Orchestrates the generation of complete scanner signals with risk management targets.
 * Combines MomentumScanner.computeScore with RiskManagement calculations to produce
 * unified signals ready for execution.
 */

import { MomentumScanner } from './momentum-scanner';
import RiskManagement from './risk-management';
import type {
  ScannerSignal,
  ScannerSignalTargets,
  ComputeScannerSignalRequest,
  ComputeScannerSignalResponse,
  BatchComputeScannerSignalRequest,
  BatchComputeScannerSignalResponse,
  SignalStatistics,
} from './scanner-signal';
import type { MarketFrame } from './continuous-scanner';

interface SignalCache {
  signal: ScannerSignal;
  timestamp: number;
}

/**
 * Service for computing and managing scanner signals with targets
 */
export class ScannerSignalService {
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private static signalCache = new Map<string, SignalCache>();
  private static readonly VERSION = '2.0.0';

  /**
   * Compute a scanner signal with risk management targets
   */
  static computeSignal(req: ComputeScannerSignalRequest): ComputeScannerSignalResponse {
    const startTime = performance.now();

    try {
      // Build market frames from request data
      const frames = this.buildMarketFrames(req);
      
      if (!frames || frames.length < 5) {
        return {
          success: false,
          error: 'Insufficient market data. Minimum 5 candles required.',
          signal: null as any,
        };
      }

      // Step 1: Compute momentum signal
      const momentumResult = MomentumScanner.computeScore(frames);

      // Step 2: Extract current price
      const currentPrice = frames[frames.length - 1].price.close;

      // Step 3: Calculate risk targets
      const targets = this.calculateTargets(
        currentPrice,
        momentumResult.signal,
        frames,
        req
      );

      // Step 4: Build complete signal
      const signal: ScannerSignal = {
        ...momentumResult,
        symbol: req.symbol,
        timestamp: req.marketData.timestamp?.[req.marketData.timestamp.length - 1] || Date.now(),
        timeframe: req.timeframe,
        source: 'momentum',
        version: this.VERSION,
        executionTimeMs: Math.round(performance.now() - startTime),
        targets,
      };

      // Cache the signal
      this.cacheSignal(req.symbol, req.timeframe, signal);

      return {
        signal,
        success: true,
        warnings: this.validateSignal(signal),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        signal: null as any,
      };
    }
  }

  /**
   * Compute signals for multiple symbols/timeframes
   */
  static computeSignalsBatch(
    req: BatchComputeScannerSignalRequest
  ): BatchComputeScannerSignalResponse {
    const startTime = performance.now();
    const results: ComputeScannerSignalResponse[] = [];
    let failedCount = 0;

    for (const signalReq of req.signals) {
      try {
        const result = this.computeSignal(signalReq);
        results.push(result);
        
        if (!result.success) {
          failedCount++;
          if (req.options?.stopOnError) {
            break;
          }
        }
      } catch (error) {
        failedCount++;
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          signal: null as any,
        });
        
        if (req.options?.stopOnError) {
          break;
        }
      }
    }

    return {
      results,
      totalComputed: results.length,
      failedCount,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Get cached signal if available and not expired
   */
  static getCachedSignal(symbol: string, timeframe: string): ScannerSignal | null {
    const key = `${symbol}:${timeframe}`;
    const cached = this.signalCache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_DURATION_MS) {
      this.signalCache.delete(key);
      return null;
    }

    return cached.signal;
  }

  /**
   * Clear signal cache
   */
  static clearCache(symbol?: string): void {
    if (symbol) {
      const keysToDelete: string[] = [];
      for (const key of this.signalCache.keys()) {
        if (key.startsWith(symbol)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.signalCache.delete(key));
    } else {
      this.signalCache.clear();
    }
  }

  /**
   * Calculate risk management targets for a signal
   */
  private static calculateTargets(
    currentPrice: number,
    signal: string,
    frames: MarketFrame[],
    req: ComputeScannerSignalRequest
  ): ScannerSignalTargets {
    // Extract market data
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const closes = frames.map(f => f.price.close);

    // Calculate risk/reward targets
    const stopLossResult = RiskManagement.calculateStopLossTakeProfit(
      currentPrice,
      { high: highs, low: lows, close: closes },
      signal,
      req.atr,
      req.bbLower,
      req.bbUpper,
      req.supportLevel,
      req.resistanceLevel,
      req.riskRewardRatio || 2.5
    );

    // Calculate position sizing if account info provided
    let positionSizing = null;
    if (req.accountBalance && req.riskPerTradePct) {
      positionSizing = RiskManagement.calculatePositionSize(
        req.accountBalance,
        req.riskPerTradePct,
        currentPrice,
        stopLossResult.stopLoss,
        req.leverage || 1.0,
        req.feeRate || 0.001
      );
    }

    return {
      entryPrice: stopLossResult.entryPrice,
      entryPriceConfidence: 0.95, // Current price is reliable
      stopLoss: stopLossResult.stopLoss,
      takeProfit: stopLossResult.takeProfit,
      supportLevel: stopLossResult.supportLevel,
      resistanceLevel: stopLossResult.resistanceLevel,
      riskAmount: stopLossResult.riskAmount,
      rewardAmount: stopLossResult.rewardAmount,
      riskRewardRatio: stopLossResult.riskRewardRatio,
      stopLossPct: stopLossResult.stopLossPct,
      takeProfitPct: stopLossResult.takeProfitPct,
      recommendedPositionSize: positionSizing?.units,
      recommendedPositionValue: positionSizing?.positionValue,
      recommendedRiskPercentage: req.riskPerTradePct,
      marginRequired: positionSizing?.marginRequired,
      maximumLeverage: 10, // Default max leverage
      recommendedLeverage: req.leverage || 1,
      liquidationPrice: positionSizing?.liquidationPrice || null,
    };
  }

  /**
   * Build market frames from request data
   */
  private static buildMarketFrames(req: ComputeScannerSignalRequest): MarketFrame[] {
    const { marketData } = req;
    const frames: MarketFrame[] = [];

    const length = marketData.close.length;
    for (let i = 0; i < length; i++) {
      frames.push({
        timestamp: (marketData.timestamp?.[i] || Date.now() - (length - i) * 60000) as number,
        price: {
          open: marketData.open[i],
          high: marketData.high[i],
          low: marketData.low[i],
          close: marketData.close[i],
        },
        volume: marketData.volume?.[i] || 0,
        symbol: req.symbol,
      } as MarketFrame);
    }

    return frames;
  }

  /**
   * Cache a signal
   */
  private static cacheSignal(symbol: string, timeframe: string, signal: ScannerSignal): void {
    const key = `${symbol}:${timeframe}`;
    this.signalCache.set(key, {
      signal,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries if map gets too large
    if (this.signalCache.size > 10000) {
      const oldestKey = Array.from(this.signalCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.signalCache.delete(oldestKey);
    }
  }

  /**
   * Validate signal and return warnings
   */
  private static validateSignal(signal: ScannerSignal): string[] {
    const warnings: string[] = [];

    if (!signal.targets) {
      warnings.push('No targets calculated for signal');
    } else {
      // Check risk/reward ratio
      if (signal.targets.riskRewardRatio < 1) {
        warnings.push('Risk/reward ratio below 1:1 - unfavorable risk/reward');
      }

      // Check stop loss validity
      if (signal.targets.stopLoss === signal.targets.entryPrice) {
        warnings.push('Stop loss equals entry price - invalid target');
      }

      // Check take profit validity
      if (signal.targets.takeProfit === signal.targets.entryPrice) {
        warnings.push('Take profit equals entry price - invalid target');
      }

      // Check confidence
      if (signal.confidence < 0.5) {
        warnings.push('Low confidence signal (< 50%) - proceed with caution');
      }

      // Check quality gate
      if (signal.passesQualityGate === false) {
        warnings.push(`Quality gate failed: ${signal.qualityGateReason}`);
      }
    }

    return warnings;
  }

  /**
   * Generate statistics from multiple signals
   */
  static generateStatistics(signals: ScannerSignal[]): SignalStatistics {
    const startTime = Math.min(...signals.map(s => s.timestamp));
    const endTime = Math.max(...signals.map(s => s.timestamp));

    const buySignals = signals.filter(s => 
      ['Strong Buy', 'Buy', 'Weak Buy'].includes(s.signal)
    ).length;
    const sellSignals = signals.filter(s => 
      ['Strong Sell', 'Sell', 'Weak Sell'].includes(s.signal)
    ).length;
    const neutralSignals = signals.filter(s => s.signal === 'Neutral').length;
    const passedGateCount = signals.filter(s => s.passesQualityGate).length;

    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    const avgStrength = signals.reduce((sum, s) => sum + s.signalStrength, 0) / signals.length;
    const avgRR = signals.reduce((sum, s) => sum + (s.targets?.riskRewardRatio || 0), 0) / signals.length;

    return {
      symbol: signals[0]?.symbol || 'UNKNOWN',
      timeframe: signals[0]?.timeframe || 'UNKNOWN',
      periodStart: startTime,
      periodEnd: endTime,
      totalSignals: signals.length,
      buySignals,
      sellSignals,
      neutralSignals,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      averageSignalStrength: Math.round(avgStrength * 100) / 100,
      passedQualityGateCount: passedGateCount,
      qualityGatePassRate: Math.round((passedGateCount / signals.length) * 10000) / 100,
      averageRiskRewardRatio: Math.round(avgRR * 100) / 100,
      averageRiskPercentage: Math.round(
        signals.reduce((sum, s) => sum + Math.abs(s.targets?.stopLossPct || 0), 0) / signals.length * 100
      ) / 100,
      averageStopLossPct: Math.round(
        signals.reduce((sum, s) => sum + Math.abs(s.targets?.stopLossPct || 0), 0) / signals.length * 100
      ) / 100,
      averageTakeProfitPct: Math.round(
        signals.reduce((sum, s) => sum + (s.targets?.takeProfitPct || 0), 0) / signals.length * 100
      ) / 100,
    };
  }
}

export default ScannerSignalService;
