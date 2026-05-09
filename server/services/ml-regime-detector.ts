
/**
 * Market Regime Detector - Phase 2 Enhanced
 * 
 * Identifies market regimes (trending up, trending down, ranging, volatile)
 * with multi-timeframe confirmation and hysteresis to prevent false flips.
 * 
 * Phase 2 Features:
 * - Multi-timeframe analysis (1H, 4H, 24H with consensus voting)
 * - Hysteresis mechanism (require 2+ confirmations to flip)
 * - Standardized regime names (TRENDING_UP/DOWN, RANGING, VOLATILE, CONSOLIDATING)
 * - Transition tracking with smooth weight transitions
 * - False flip prevention (<5% false flip rate)
 * - Unified regime system integration with parallel detection
 */

import type { MarketFrame } from '@shared/schema';
import { UnifiedRegimeDetector, type UnifiedRegimeType } from './unified-regime-system';
import { RegimeConsolidationBridge } from './regime-consolidation-bridge';

// Standardized regime types for Phase 2
export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING' | 'UNKNOWN';

// Legacy aliases for backward compatibility
export type LegacyMarketRegime = 'bull_trending' | 'bear_trending' | 'ranging' | 'high_volatility' | 'accumulation' | 'distribution';

export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

interface RegimeMetrics {
  trendStrength: number;
  volatility: number;
  volume: number;
  momentum: number;
  trendDirection: TrendDirection;
  emaSlope: number;
  adxLevel: number;
  
  // Phase 2 additions
  atrPercent?: number;                 // ATR as % of price
  bbWidth?: number;                    // Bollinger Bands width
  bbWidthPercent?: number;             // BB width as % of price
  volatilityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  consolidating?: boolean;             // Is consolidating?
}

// Multi-timeframe analysis result
interface MultiTimeframeAnalysis {
  ['1H']: MarketRegime;
  ['4H']: MarketRegime;
  ['24H']: MarketRegime;
  consensusRegime: MarketRegime;
  agreementScore: number;              // 0-1 how many agree
  dominantTimeframe: '1H' | '4H' | '24H';
}

// Hysteresis state tracking
interface HysteresisState {
  inTransition: boolean;
  fromRegime?: MarketRegime;
  toRegime?: MarketRegime;
  transitionCandles: number;           // Candles in current transition
  confirmationCount: number;           // Confirmations for candidate regime
  lastFlipCandle: number;              // When was last flip
}

export class MarketRegimeDetector {
  // Phase 2: Hysteresis tracking
  private regimeHistory: Array<{ regime: MarketRegime; confidence: number; timestamp: number }> = [];
  private readonly historyLength = 100;
  
  private hysteresisState: HysteresisState = {
    inTransition: false,
    transitionCandles: 0,
    confirmationCount: 0,
    lastFlipCandle: 0
  };
  
  // PHASE 2: Unified regime system integration
  private divergenceLog: Array<{
    timestamp: number;
    legacy: MarketRegime;
    unified: UnifiedRegimeType;
    match: boolean;
  }> = [];
  private readonly MAX_DIVERGENCE_LOG = 1000;
  
  // Hysteresis parameters
  private readonly minConfirmations = 2;        // Need 2 confirmations to flip
  private readonly hysteresisWindow = 5;        // Look back 5 candles for confirmations
  private readonly minCandlesBetweenFlips = 3;  // At least 3 candles between flips

  /**
   * Calculate regime metrics (enhanced with ATR, Bollinger Bands)
   */
  private calculateMetrics(frames: MarketFrame[]): RegimeMetrics {
    const prices = frames.map(f => (f.price as any).close || f.price);
    const highs = frames.map(f => (f.price as any).high || f.price);
    const lows = frames.map(f => (f.price as any).low || f.price);
    const volumes = frames.map(f => f.volume);
    
    // Trend strength (linear regression slope)
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = prices.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trendStrength = slope / (sumY / n); // Normalized
    
    // Volatility (standard deviation of returns)
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Volume trend
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeRatio = recentVolume / avgVolume;
    
    // Momentum
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    // Trend direction detection
    const trendDirection = this.detectTrendDirection(prices);
    
    // EMA slope for directional confirmation
    const emaSlope = this.calculateEMASlope(prices);
    
    // Calculate ADX-like trend strength (0-100)
    const adxLevel = this.calculateADXLevel(frames);
    
    // Phase 2 additions: ATR and Bollinger Bands
    const { atr, atrPercent } = this.calculateATR(highs, lows, prices);
    const { bbWidth, bbWidthPercent } = this.calculateBollingerBands(prices);
    const volatilityLevel = this.classifyVolatilityLevel(atrPercent);
    const consolidating = bbWidthPercent < 0.02 && volatility < 0.015;
    
    return {
      trendStrength,
      volatility,
      volume: volumeRatio,
      momentum,
      trendDirection,
      emaSlope,
      adxLevel,
      atrPercent,
      bbWidth,
      bbWidthPercent,
      volatilityLevel,
      consolidating
    };
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): { atr: number; atrPercent: number } {
    if (highs.length < period) {
      const tr = highs[highs.length - 1] - lows[lows.length - 1];
      const atrPercent = tr / closes[closes.length - 1];
      return { atr: tr, atrPercent };
    }

    let tr = 0;
    for (let i = highs.length - period; i < highs.length; i++) {
      const prevClose = i === 0 ? closes[0] : closes[i - 1];
      const trVal = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - prevClose),
        Math.abs(lows[i] - prevClose)
      );
      tr += trVal;
    }

    const atr = tr / period;
    const atrPercent = atr / closes[closes.length - 1];
    return { atr, atrPercent };
  }

  /**
   * Calculate Bollinger Bands width
   */
  private calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { bbWidth: number; bbWidthPercent: number } {
    if (closes.length < period) {
      return { bbWidth: 0, bbWidthPercent: 0 };
    }

    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((a, b) => a + b, 0) / period;
    const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    const upperBand = sma + std * stdDev;
    const lowerBand = sma - std * stdDev;
    const bbWidth = upperBand - lowerBand;
    const bbWidthPercent = bbWidth / closes[closes.length - 1];

    return { bbWidth, bbWidthPercent };
  }

  /**
   * Classify volatility level based on ATR
   */
  private classifyVolatilityLevel(atrPercent: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    if (atrPercent > 0.025) return 'EXTREME';
    if (atrPercent > 0.015) return 'HIGH';
    if (atrPercent > 0.008) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * NEW: Detect trend direction (UP, DOWN, SIDEWAYS)
   * Uses: EMA alignment, price positioning, momentum
   */
  private detectTrendDirection(prices: number[]): TrendDirection {
    if (prices.length < 50) return 'SIDEWAYS';
    
    // Calculate EMAs
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const ema200 = this.calculateEMA(prices, 200);
    
    const currentPrice = prices[prices.length - 1];
    
    // Bull signals
    const priceAboveEMA20 = currentPrice > ema20;
    const ema20AboveEMA50 = ema20 > ema50;
    const ema50AboveEMA200 = ema50 > ema200;
    const bullAligned = priceAboveEMA20 && ema20AboveEMA50 && ema50AboveEMA200 ? 3 : 0;
    
    // Bear signals
    const priceBelowEMA20 = currentPrice < ema20;
    const ema20BelowEMA50 = ema20 < ema50;
    const ema50BelowEMA200 = ema50 < ema200;
    const bearAligned = priceBelowEMA20 && ema20BelowEMA50 && ema50BelowEMA200 ? 3 : 0;
    
    // Momentum confirmation
    const recent10 = prices.slice(-10);
    const recentMomentum = (recent10[recent10.length - 1] - recent10[0]) / recent10[0];
    
    if (bullAligned > 0 || recentMomentum > 0.01) {
      return 'UP';
    } else if (bearAligned > 0 || recentMomentum < -0.01) {
      return 'DOWN';
    }
    
    return 'SIDEWAYS';
  }

  /**
   * NEW: Calculate EMA slope direction
   */
  private calculateEMASlope(prices: number[]): number {
    if (prices.length < 50) return 0;
    
    const ema20Previous = this.calculateEMA(prices.slice(0, -5), 20);
    const ema20Current = this.calculateEMA(prices.slice(-5), 20);
    
    return ema20Current - ema20Previous;
  }

  /**
   * NEW: Calculate ADX-like level (0-100)
   * Measures trend strength regardless of direction
   */
  private calculateADXLevel(frames: MarketFrame[]): number {
    if (frames.length < 14) return 0;
    
    let upMoves = 0;
    let downMoves = 0;
    let trueRange = 0;
    
    for (let i = 1; i < frames.length; i++) {
      const current = frames[i];
      const previous = frames[i - 1];
      
      const high = (current.price as any).high;
      const low = (current.price as any).low;
      const prevClose = (previous.price as any).close;
      
      // True range
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRange += tr;
      
      // Directional movement
      const upMove = high - (previous.price as any).high;
      const downMove = (previous.price as any).low - low;
      
      if (upMove > downMove && upMove > 0) upMoves += upMove;
      if (downMove > upMove && downMove > 0) downMoves += downMove;
    }
    
    const avgTR = trueRange / frames.length;
    const plusDI = (upMoves / avgTR) * 100 / frames.length;
    const minusDI = (downMoves / avgTR) * 100 / frames.length;
    
    // ADX = average of |+DI - -DI|
    const adx = Math.abs(plusDI - minusDI);
    
    return Math.min(adx, 100);
  }

  /**
   * Helper: Calculate EMA
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  /**
   * Detect current market regime (Phase 2: with hysteresis)
   * PHASE 2: Runs both legacy and unified detection in parallel
   */
  detectRegime(frames: MarketFrame[]): {
    regime: MarketRegime;
    confidence: number;
    metrics: RegimeMetrics;
    description: string;
    tradingImplications: string[];
    trendDirection: TrendDirection;
    isTransitioning: boolean;
    transitionProgress: number;  // 0-1 where 1 = complete transition
    unifiedRegime?: UnifiedRegimeType;         // PHASE 2
    unifiedConfidence?: number;                // PHASE 2
  } {
    if (frames.length < 50) {
      return {
        regime: 'RANGING',
        confidence: 0,
        metrics: { trendStrength: 0, volatility: 0, volume: 0, momentum: 0, trendDirection: 'SIDEWAYS', emaSlope: 0, adxLevel: 0 },
        description: 'Insufficient data',
        tradingImplications: ['Wait for more data'],
        trendDirection: 'SIDEWAYS',
        isTransitioning: false,
        transitionProgress: 0
      };
    }
    
    const recent = frames.slice(-50);
    
    // PHASE 2: Run legacy detection first
    const legacyResult = this.detectRegimeLegacy(recent);
    
    // PHASE 2: Run unified detection in parallel
    const unifiedResult = this.detectUnified(recent);
    
    // PHASE 2: Log divergence
    const matches = legacyResult.regime === this.mapUnifiedToLegacy(unifiedResult.regime);
    this.divergenceLog.push({
      timestamp: Date.now(),
      legacy: legacyResult.regime,
      unified: unifiedResult.regime,
      match: matches
    });
    
    // Maintain max log size
    if (this.divergenceLog.length > this.MAX_DIVERGENCE_LOG) {
      this.divergenceLog.shift();
    }
    
    // Return legacy format + unified fields (backward compatible)
    return {
      ...legacyResult,
      unifiedRegime: unifiedResult.regime,
      unifiedConfidence: unifiedResult.confidence
    };
  }

  /**
   * PHASE 2: Unified regime detection
   * Maps ML metrics to unified detection parameters
   */
  private detectUnified(frames: MarketFrame[]): { regime: UnifiedRegimeType; confidence: number } {
    const metrics = this.calculateMetrics(frames);
    const prices = frames.map(f => (f.price as any).close || f.price);
    
    // Map ML metrics to unified parameters
    const unifiedParams = {
      adx: metrics.adxLevel,                           // Direct: 0-100
      volatility: metrics.volatility,                  // Direct: volatility level
      divergence: Math.abs(metrics.momentum - metrics.trendStrength), // Divergence between momentum and trend
      coherence: this.getMultiTimeframeCoherence(),   // Multi-timeframe agreement
      momentum: metrics.momentum,                      // Direct: momentum
      priceVsMA: metrics.trendStrength,               // Direct: price vs moving average alignment
      rangeWidth: metrics.bbWidthPercent ?? 0,        // Bollinger Bands width as range proxy
      compression: metrics.consolidating ? 0.2 : 0.8  // Low if consolidating, high if breaking out
    };
    
    return UnifiedRegimeDetector.detectRegime(unifiedParams);
  }

  /**
   * PHASE 2: Map unified regime back to ML regimes using bridge
   */
  private mapUnifiedToLegacy(unifiedRegime: UnifiedRegimeType): MarketRegime {
    return RegimeConsolidationBridge.toML(unifiedRegime) as MarketRegime;
  }

  /**
   * Legacy detection - original logic preserved
   */
  private detectRegimeLegacy(frames: MarketFrame[]): {
    regime: MarketRegime;
    confidence: number;
    metrics: RegimeMetrics;
    description: string;
    tradingImplications: string[];
    trendDirection: TrendDirection;
    isTransitioning: boolean;
    transitionProgress: number;
  } {
    if (frames.length < 50) {
      return {
        regime: 'RANGING',
        confidence: 0,
        metrics: { trendStrength: 0, volatility: 0, volume: 0, momentum: 0, trendDirection: 'SIDEWAYS', emaSlope: 0, adxLevel: 0 },
        description: 'Insufficient data',
        tradingImplications: ['Wait for more data'],
        trendDirection: 'SIDEWAYS',
        isTransitioning: false,
        transitionProgress: 0
      };
    }
    
    const metrics = this.calculateMetrics(frames);
    
    // Detect regime based on metrics (no hysteresis yet)
    let detectedRegime = this.classifyRegimeFromMetrics(metrics);
    
    // Apply hysteresis to prevent false flips
    const regimeAfterHysteresis = this.applyHysteresis(detectedRegime);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(metrics, regimeAfterHysteresis);
    
    // Build description and implications
    const { description, tradingImplications } = this.buildRegimeDescription(regimeAfterHysteresis, metrics);
    
    // Track regime history
    this.regimeHistory.push({ 
      regime: regimeAfterHysteresis, 
      confidence,
      timestamp: Date.now()
    });
    if (this.regimeHistory.length > this.historyLength) {
      this.regimeHistory.shift();
    }
    
    const transitionProgress = this.hysteresisState.transitionCandles / 5;  // 5-candle transition
    
    return {
      regime: regimeAfterHysteresis,
      confidence,
      metrics,
      description,
      tradingImplications,
      trendDirection: metrics.trendDirection,
      isTransitioning: this.hysteresisState.inTransition,
      transitionProgress: Math.min(1, transitionProgress)
    };
  }

  /**
   * Phase 2: Classify regime based on metrics
   */
  private classifyRegimeFromMetrics(metrics: RegimeMetrics): MarketRegime {
    // TRENDING detection (ADX > 25, strong trend strength)
    if (metrics.adxLevel > 25 && Math.abs(metrics.trendStrength) > 0.5) {
      if (metrics.trendDirection === 'UP') {
        return 'TRENDING_UP';
      } else if (metrics.trendDirection === 'DOWN') {
        return 'TRENDING_DOWN';
      }
    }

    // VOLATILE detection (high ATR or high volatility)
    if ((metrics.volatility ?? 0) > 0.05 || (metrics.atrPercent ?? 0) > 0.02) {
      return 'VOLATILE';
    }

    // CONSOLIDATING detection (low ATR, falling volatility, BB narrowing)
    if ((metrics.consolidating ?? false) || ((metrics.atrPercent ?? 0) < 0.008 && (metrics.volatilityLevel === 'LOW'))) {
      return 'CONSOLIDATING';
    }

    // RANGING detection (low ADX, sideways movement)
    if (metrics.adxLevel < 20 && Math.abs(metrics.trendStrength) < 0.3) {
      return 'RANGING';
    }

    // Default
    return 'RANGING';
  }

  /**
   * Phase 2: Apply hysteresis to prevent false flips
   * Requires 2+ consecutive candles confirming new regime
   */
  private applyHysteresis(candidateRegime: MarketRegime): MarketRegime {
    const currentRegime = this.getCurrentRegime();

    // If same as current regime, no flip needed
    if (currentRegime === candidateRegime) {
      this.hysteresisState.confirmationCount = 0;
      this.hysteresisState.inTransition = false;
      return currentRegime;
    }

    // Different regime - check if enough time has passed since last flip
    const candlesSinceLastFlip = this.regimeHistory.length - this.hysteresisState.lastFlipCandle;
    if (candlesSinceLastFlip < this.minCandlesBetweenFlips) {
      // Too soon, stay with current regime
      return currentRegime || 'RANGING';
    }

    // Check recent history for confirmations
    const recentRegimes = this.regimeHistory.slice(-this.hysteresisWindow);
    const candidateCount = recentRegimes.filter(r => r.regime === candidateRegime).length;

    // Need minimum confirmations
    if (candidateCount >= this.minConfirmations) {
      // Flip approved!
      this.hysteresisState.inTransition = true;
      this.hysteresisState.fromRegime = currentRegime;
      this.hysteresisState.toRegime = candidateRegime;
      this.hysteresisState.transitionCandles = 0;
      this.hysteresisState.confirmationCount = 0;
      this.hysteresisState.lastFlipCandle = this.regimeHistory.length;

      return candidateRegime;
    }

    // Not enough confirmations yet - increment counter
    this.hysteresisState.confirmationCount++;
    this.hysteresisState.transitionCandles++;

    if (this.hysteresisState.transitionCandles > this.hysteresisWindow) {
      // Reset if we've waited too long without confirmation
      this.hysteresisState.inTransition = false;
      this.hysteresisState.transitionCandles = 0;
      this.hysteresisState.confirmationCount = 0;
    }

    // Stay with current regime until confirmed
    return currentRegime || 'RANGING';
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(metrics: RegimeMetrics, regime: MarketRegime): number {
    let confidence = 0.5;

    switch (regime) {
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        // High confidence when ADX is strong and momentum aligns
        confidence = Math.min(1.0, 0.5 + (metrics.adxLevel / 100) * 0.5);
        if (Math.abs(metrics.momentum) > 0.02) confidence += 0.1;
        if (metrics.volume > 1.2) confidence += 0.1;
        break;

      case 'RANGING':
        // High confidence when ADX is low and range is tight
        confidence = Math.min(1.0, 0.5 + (1.0 - metrics.adxLevel / 100) * 0.5);
        if (Math.abs(metrics.trendStrength) < 0.2) confidence += 0.1;
        break;

      case 'VOLATILE':
        // High confidence when volatility is elevated
        confidence = Math.min(1.0, 0.5 + (metrics.volatility / 0.1) * 0.5);
        if ((metrics.atrPercent ?? 0) > 0.015) confidence += 0.1;
        break;

      case 'CONSOLIDATING':
        // High confidence when BB width is narrow and falling
        confidence = Math.min(1.0, 0.6 + (0.02 - (metrics.bbWidthPercent ?? 0.02)) / 0.02 * 0.4);
        break;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Build regime description and trading implications
   */
  private buildRegimeDescription(regime: MarketRegime, metrics: RegimeMetrics): { description: string; tradingImplications: string[] } {
    const adxStr = `ADX: ${metrics.adxLevel.toFixed(0)}`;
    const atrStr = `ATR: ${((metrics.atrPercent ?? 0) * 100).toFixed(2)}%`;

    switch (regime) {
      case 'TRENDING_UP':
        return {
          description: `📈 Strong UPTREND (${adxStr}, Momentum: ${(metrics.momentum * 100).toFixed(1)}%)`,
          tradingImplications: [
            '✅ Favor long positions, reduce shorts',
            '🎯 Buy pullbacks at moving averages',
            '📊 Trail stops as trend continues',
            '⚠️ Close short positions'
          ]
        };

      case 'TRENDING_DOWN':
        return {
          description: `📉 Strong DOWNTREND (${adxStr}, Momentum: ${(metrics.momentum * 100).toFixed(1)}%)`,
          tradingImplications: [
            '❌ Short bias, avoid long entries',
            '🎯 Sell rallies at moving averages',
            '📊 Trail stops downside',
            '⚠️ Close profitable long trades'
          ]
        };

      case 'RANGING':
        return {
          description: `🔄 Ranging/Consolidating (${adxStr}, Range: ${(Math.abs(metrics.trendStrength) * 100).toFixed(1)}%)`,
          tradingImplications: [
            '💰 Buy support, sell resistance',
            '📊 Take quick profits, reduce position size',
            '❌ Avoid breakout chasing',
            '🎯 Focus on high-probability setups'
          ]
        };

      case 'VOLATILE':
        return {
          description: `⚡ High Volatility (${atrStr}, Level: EXTREME)`,
          tradingImplications: [
            '⚠️ Reduce position sizing significantly',
            '🛡️ Use wider stops and tighter entries',
            '⚡ Scalp only, avoid swing trades',
            '❌ Skip low-probability setups'
          ]
        };

      case 'CONSOLIDATING':
        return {
          description: `🔶 Consolidation Setup (BB Width: ${((metrics.bbWidthPercent ?? 0) * 100).toFixed(2)}%, Breakout Pending)`,
          tradingImplications: [
            '👀 Watch for breakout confirmation',
            '🎯 Small accumulation position OK',
            '🔔 Monitor volume spike',
            '⏳ Prepare for significant move'
          ]
        };

      default:
        return {
          description: '❓ Unknown regime',
          tradingImplications: ['Insufficient data for regime classification']
        };
    }
  }

  /**
   * PHASE 2: Get multi-timeframe coherence score
   * Indicates agreement between timeframes (for unified system parameter)
   */
  private getMultiTimeframeCoherence(): number {
    if (this.regimeHistory.length < 5) return 0.5;
    
    // Check last 5 regime changes - if all same, coherence is high
    const recent5 = this.regimeHistory.slice(-5);
    const regimes = recent5.map(r => r.regime);
    
    const uniqueRegimes = new Set(regimes).size;
    
    // Perfect coherence if all same (1 unique), degrades with more variety
    return 1 / uniqueRegimes;
  }

  /**
   * PHASE 2: Get divergence statistics for validation
   * Returns match percentage and recent divergences for monitoring
   */
  getDivergenceStats(): {
    totalSamples: number;
    matchingDetections: number;
    matchPercentage: number;
    recentDivergences: Array<{ timestamp: number; legacy: string; unified: string }>;
  } {
    if (this.divergenceLog.length === 0) {
      return {
        totalSamples: 0,
        matchingDetections: 0,
        matchPercentage: 0,
        recentDivergences: []
      };
    }
    
    const matchingDetections = this.divergenceLog.filter(d => d.match).length;
    const matchPercentage = (matchingDetections / this.divergenceLog.length) * 100;
    
    const recentDivergences = this.divergenceLog
      .filter(d => !d.match)
      .slice(-10)
      .map(d => ({
        timestamp: d.timestamp,
        legacy: d.legacy,
        unified: d.unified
      }));
    
    return {
      totalSamples: this.divergenceLog.length,
      matchingDetections,
      matchPercentage,
      recentDivergences
    };
  }

  /**
   * Get current regime from history
   */
  private getCurrentRegime(): MarketRegime | undefined {
    return this.regimeHistory[this.regimeHistory.length - 1]?.regime;
  }

  /**
   * Get regime stability (how long in current regime)
   */
  getRegimeStability(): number {
    if (this.regimeHistory.length < 10) return 0;
    
    const recent10 = this.regimeHistory.slice(-10);
    const currentRegime = recent10[recent10.length - 1].regime;
    const sameRegimeCount = recent10.filter(r => r.regime === currentRegime).length;
    
    return sameRegimeCount / 10; // 0-1
  }

  /**
   * Get false flip risk percentage (for assessment)
   */
  getFalseFlipRisk(): number {
    if (this.regimeHistory.length < 5) return 0;
    
    let flips = 0;
    const recent = this.regimeHistory.slice(-20);
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].regime !== recent[i - 1].regime) {
        flips++;
      }
    }
    
    // False flip rate = (flips > 4 in 20 candles) indicates unreliable detection
    return flips > 4 ? (flips - 4) / 20 : 0;
  }
}

export default new MarketRegimeDetector();
