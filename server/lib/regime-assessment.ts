/**
 * REGIME ASSESSMENT ENGINE
 * 
 * Comprehensive multi-timeframe regime detection with:
 * - Advanced indicator calculations (ADX, ATR, Bollinger Bands, momentum)
 * - Multi-timeframe consensus (1H, 4H, 24H)
 * - Hysteresis mechanism (prevent false flips)
 * - Confidence scoring and transition tracking
 * - Real-time regime assessment reports
 */

import type { MarketFrame } from '@shared/schema';
import type { Candle } from '../types/market-data';

// Export Candle type for external use
export type { Candle };

// Type alias for compatibility
type OHLCV = Candle;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RegimeType = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';
export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface RegimeIndicators {
  // Trend metrics
  adx: number;                         // 0-100: ADX trend strength
  trendDirection: TrendDirection;      // UP, DOWN, SIDEWAYS
  ema10: number;                       // Exponential Moving Average 10
  ema20: number;                       // Exponential Moving Average 20
  ema50: number;                       // Exponential Moving Average 50
  ema200: number;                      // Exponential Moving Average 200
  
  // Volatility metrics
  atr: number;                         // Average True Range (raw)
  atrPercent: number;                  // ATR as % of price
  bbWidth: number;                     // Bollinger Bands width (0-1)
  bbWidthPercent: number;              // BB width as % of price
  volatilityTrend: 'RISING' | 'STABLE' | 'FALLING';
  volatilityLevel: VolatilityLevel;
  
  // Momentum metrics
  momentum: number;                    // -1 to +1 (direction + strength)
  momentum14: number;                  // 14-period momentum
  rsi: number;                         // RSI (0-100)
  macdHistogram: number;               // MACD histogram value
  
  // Structure metrics
  priceVsMA: number;                   // Price position vs 20-MA (-1 to +1)
  rangeHigh: number;                   // Current range high
  rangeLow: number;                    // Current range low
  rangeWidth: number;                  // (high-low)/close (0-1)
  
  // Volume metrics
  volumeProfile: 'HEAVY' | 'NORMAL' | 'LIGHT';
  volumeRatio: number;                 // Recent vol / avg vol
  volumeTrend: 'RISING' | 'STABLE' | 'FALLING';
  
  // Pattern recognition
  consecutiveHL: number;               // Count of consecutive Higher Highs/Lows
  consolidating: boolean;              // BB width < 2% AND ATR falling
  breakoutSetup: boolean;              // Compression phase complete
}

export interface RegimeDetectionResult {
  // Regime identification
  regime: RegimeType;
  regimeStrength: number;              // 0-1 confidence in regime
  direction: TrendDirection;           // Current trend direction
  volatilityLevel: VolatilityLevel;    // Current volatility
  
  // Multi-timeframe
  timeframeConsensus: {
    '1H': RegimeType;
    '4H': RegimeType;
    '24H': RegimeType;
    agreementScore: number;            // 0-1 how many agree
    dominantTimeframe: '1H' | '4H' | '24H';
  };
  
  // Transition tracking
  isTransitioning: boolean;
  transitionProgress: number;          // 0-1 (0=none, 1=complete)
  transitionFrom?: RegimeType;
  transitionTo?: RegimeType;
  
  // Metadata
  indicators: RegimeIndicators;
  description: string;
  confidence: number;                  // 0-1 overall confidence
  tradingImplications: string[];
  
  // Reliability metrics
  dataQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  canUpdateRegime: boolean;            // Can safely use for trading
  lastRegimeFlip: number;              // Candles since last flip
  falseFlipRisk: number;               // 0-1 risk of false flip
}

export interface MultiTimeframeAssessment {
  ['1H']: RegimeDetectionResult;
  ['4H']: RegimeDetectionResult;
  ['24H']: RegimeDetectionResult;
  consensusRegime: RegimeType;
  consensusStrength: number;
  conflictWarning?: string;
  recommendation: string;
}

// ============================================================================
// REGIME ASSESSMENT ENGINE CLASS
// ============================================================================

export class RegimeAssessmentEngine {
  // Hysteresis tracking
  private regimeHistory: Array<{
    regime: RegimeType;
    timestamp: number;
    confidence: number;
  }> = [];
  
  private transitionState: {
    inTransition: boolean;
    fromRegime?: RegimeType;
    toRegime?: RegimeType;
    startCandle: number;
    duration: number;
  } = {
    inTransition: false,
    startCandle: 0,
    duration: 0
  };
  
  private hysteresisWindow = 5;        // Require 2+ confirmations in last 5 candles
  private minConfirmations = 2;        // Need 2 consecutive confirmations

  /**
   * Assess market regime comprehensively
   */
  assessRegime(candles: Candle[]): RegimeDetectionResult {
    if (candles.length < 50) {
      return this.createPoorDataResult('Insufficient candles (< 50)');
    }

    // Calculate all indicators
    const indicators = this.calculateCompleteIndicators(candles);

    // Detect regime based on indicators
    const regime = this.detectRegimeFromIndicators(indicators);

    // Apply hysteresis to prevent false flips
    const regimeAfterHysteresis = this.applyHysteresis(regime);

    // Calculate confidence
    const confidence = this.calculateConfidence(indicators, regimeAfterHysteresis);

    // Determine transition state
    const transitionInfo = this.updateTransitionState(regimeAfterHysteresis, confidence);

    // Build result
    return {
      regime: regimeAfterHysteresis,
      regimeStrength: this.calculateRegimeStrength(indicators, regimeAfterHysteresis),
      direction: indicators.trendDirection,
      volatilityLevel: indicators.volatilityLevel,
      
      timeframeConsensus: {
        '1H': regime,
        '4H': regime,  // TODO: Add actual 4H/24H detection
        '24H': regime,
        agreementScore: 1.0,  // TODO: Calculate from multi-timeframe
        dominantTimeframe: '24H'
      },
      
      isTransitioning: transitionInfo.inTransition,
      transitionProgress: transitionInfo.progress,
      transitionFrom: transitionInfo.fromRegime,
      transitionTo: transitionInfo.toRegime,
      
      indicators,
      description: this.buildDescription(regimeAfterHysteresis, indicators),
      confidence,
      tradingImplications: this.buildTradingImplications(regimeAfterHysteresis, indicators),
      
      dataQuality: this.assessDataQuality(candles),
      canUpdateRegime: confidence > 0.65 && this.assessDataQuality(candles) !== 'POOR',
      lastRegimeFlip: this.getCandelessSinceLastFlip(),
      falseFlipRisk: this.calculateFalseFlipRisk(indicators)
    };
  }

  /**
   * Calculate all technical indicators comprehensively
   */
  private calculateCompleteIndicators(candles: OHLCV[]): RegimeIndicators {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // EMAs
    const ema10 = this.calculateEMA(closes, 10);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = candles.length >= 200 ? this.calculateEMA(closes, 200) : ema50;

    // ADX (Advanced trend strength)
    const { adx, trendDirection } = this.calculateADX(candles);

    // ATR and Bollinger Bands
    const { atr, atrPercent } = this.calculateATR(candles);
    const { bbWidth, bbWidthPercent } = this.calculateBollingerBands(closes);

    // Volatility analysis
    const volatilityMetrics = this.analyzeVolatility(atr, atrPercent, bbWidthPercent);

    // Momentum indicators
    const { momentum, momentum14 } = this.calculateMomentum(closes);
    const rsi = this.calculateRSI(closes);
    const macdHistogram = this.calculateMACD(closes);

    // Structure analysis
    const priceVsMA = (closes[closes.length - 1] - ema20) / ema20;
    const rangeWidth = (Math.max(...highs.slice(-20)) - Math.min(...lows.slice(-20))) / closes[closes.length - 1];
    const { consecutiveHL, consolidating } = this.analyzeStructure(candles, ema20);

    // Volume analysis
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const avgVolume = totalVolume / volumes.length;
    const recentVolumeTotal = volumes.slice(-5).reduce((a, b) => a + b, 0);
    const recentVolume = recentVolumeTotal / 5;
    const volumeRatio = recentVolume / avgVolume;
    const volumeTrend = this.analyzeVolumeTrend(volumes);
    const volumeProfile = this.classifyVolumeProfile(volumeRatio);

    return {
      adx,
      trendDirection,
      ema10,
      ema20,
      ema50,
      ema200,
      atr,
      atrPercent,
      bbWidth,
      bbWidthPercent,
      volatilityTrend: volatilityMetrics.trend,
      volatilityLevel: volatilityMetrics.level,
      momentum,
      momentum14,
      rsi,
      macdHistogram,
      priceVsMA,
      rangeHigh: Math.max(...highs.slice(-20)),
      rangeLow: Math.min(...lows.slice(-20)),
      rangeWidth,
      volumeProfile,
      volumeRatio,
      volumeTrend,
      consecutiveHL,
      consolidating,
      breakoutSetup: consolidating  // TODO: Add volume spike detection
    };
  }

  /**
   * Detect regime from indicators
   */
  private detectRegimeFromIndicators(indicators: RegimeIndicators): RegimeType {
    // TRENDING detection (ADX > 25)
    if (indicators.adx > 25) {
      if (indicators.trendDirection === 'UP') {
        return 'TRENDING_UP';
      } else if (indicators.trendDirection === 'DOWN') {
        return 'TRENDING_DOWN';
      }
    }

    // VOLATILE detection (ATR > 1.5x normal)
    if (indicators.atrPercent > 0.015) {
      return 'VOLATILE';
    }

    // CONSOLIDATING detection (compression setup)
    if (indicators.consolidating && indicators.volatilityTrend === 'FALLING') {
      return 'CONSOLIDATING';
    }

    // RANGING detection (low ADX, tight range)
    if (indicators.adx < 20 && indicators.rangeWidth < 0.03) {
      return 'RANGING';
    }

    // Default
    return 'RANGING';
  }

  /**
   * Apply hysteresis to prevent false flips
   */
  private applyHysteresis(detectedRegime: RegimeType): RegimeType {
    const lastRegime = this.getLastRegime();
    
    // If same as last, confirm it
    if (lastRegime === detectedRegime) {
      return detectedRegime;
    }

    // If different, check if confirmed by recent history
    const recentRegimes = this.regimeHistory.slice(-this.hysteresisWindow);
    const targetRegimeCount = recentRegimes.filter(r => r.regime === detectedRegime).length;
    
    // Need minimum confirmations
    if (targetRegimeCount >= this.minConfirmations) {
      return detectedRegime;  // Flip approved
    }

    // Else stay with previous regime
    return lastRegime || detectedRegime;
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(indicators: RegimeIndicators, regime: RegimeType): number {
    let confidence = 0.5;

    switch (regime) {
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        // High ADX + directional alignment = high confidence
        confidence = Math.min(1.0, 0.5 + (indicators.adx / 100) * 0.5);
        if (indicators.volumeProfile === 'HEAVY') confidence += 0.1;
        if (Math.abs(indicators.momentum) > 0.5) confidence += 0.1;
        break;

      case 'RANGING':
        // Low ADX + tight range = high confidence
        confidence = Math.min(1.0, 1.0 - (indicators.adx / 100) * 0.5);
        if (indicators.rangeWidth < 0.02) confidence += 0.1;
        break;

      case 'VOLATILE':
        // High ATR + volume = high confidence
        confidence = Math.min(1.0, 0.5 + (indicators.atrPercent / 0.03) * 0.5);
        if (indicators.volumeProfile === 'HEAVY') confidence += 0.1;
        break;

      case 'CONSOLIDATING':
        // BB width + volume = confidence
        confidence = Math.min(1.0, 0.6 + (0.02 - indicators.bbWidthPercent) / 0.02 * 0.4);
        break;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate regime strength (0-1)
   */
  private calculateRegimeStrength(indicators: RegimeIndicators, regime: RegimeType): number {
    switch (regime) {
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        return Math.min(1.0, indicators.adx / 100);
      case 'RANGING':
        return Math.min(1.0, 1.0 - indicators.adx / 100);
      case 'VOLATILE':
        return Math.min(1.0, indicators.atrPercent / 0.03);
      case 'CONSOLIDATING':
        return 1.0 - Math.min(1.0, indicators.bbWidthPercent / 0.03);
      default:
        return 0.5;
    }
  }

  /**
   * Calculate ADX (Wilder's Method approximation)
   */
  private calculateADX(candles: OHLCV[]): { adx: number; trendDirection: TrendDirection } {
    if (candles.length < 14) {
      return { adx: 0, trendDirection: 'SIDEWAYS' };
    }

    let upMoves = 0;
    let downMoves = 0;
    let trueRange = 0;
    const period = Math.min(14, candles.length);

    for (let i = 1; i < candles.length; i++) {
      const curr = candles[i];
      const prev = candles[i - 1];

      // True Range
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      trueRange += tr;

      // Directional Movement
      const upMove = curr.high - prev.high;
      const downMove = prev.low - curr.low;

      if (upMove > downMove && upMove > 0) upMoves += upMove;
      if (downMove > upMove && downMove > 0) downMoves += downMove;
    }

    const avgTR = trueRange / candles.length;
    const plusDI = (upMoves / avgTR) * 100 / candles.length;
    const minusDI = (downMoves / avgTR) * 100 / candles.length;
    const adx = Math.abs(plusDI - minusDI);

    const trendDirection: TrendDirection = plusDI > minusDI ? 'UP' : minusDI > plusDI ? 'DOWN' : 'SIDEWAYS';

    return {
      adx: Math.min(adx, 100),
      trendDirection
    };
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(candles: OHLCV[], period: number = 14): { atr: number; atrPercent: number } {
    if (candles.length < period) {
      const tr = candles[candles.length - 1].high - candles[candles.length - 1].low;
      const atrPercent = tr / candles[candles.length - 1].close;
      return { atr: tr, atrPercent };
    }

    let tr = 0;
    for (let i = 0; i < period; i++) {
      const curr = candles[candles.length - period + i];
      const prev = i === 0 ? candles[candles.length - period - 1] : candles[candles.length - period + i - 1];
      
      const trVal = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      tr += trVal;
    }

    const atr = tr / period;
    const atrPercent = atr / candles[candles.length - 1].close;
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
   * Analyze volatility trend
   */
  private analyzeVolatility(_atr: number, atrPercent: number, bbWidthPercent: number): { trend: 'RISING' | 'STABLE' | 'FALLING'; level: VolatilityLevel } {
    const level: VolatilityLevel = atrPercent > 0.025 ? 'EXTREME' : atrPercent > 0.015 ? 'HIGH' : atrPercent > 0.008 ? 'MEDIUM' : 'LOW';
    
    // Determine volatility trend: If BB width is increasing, volatility is rising
    const trend: 'RISING' | 'STABLE' | 'FALLING' = bbWidthPercent > 0.025 ? 'RISING' : bbWidthPercent < 0.015 ? 'FALLING' : 'STABLE';

    return { trend, level };
  }

  /**
   * Calculate momentum indicators
   */
  private calculateMomentum(closes: number[]): { momentum: number; momentum14: number } {
    const recentClose = closes[closes.length - 1];
    const prevClose = closes[0];
    const momentum = (recentClose - prevClose) / prevClose;
    
    const momentum14 = closes.length >= 14 ? (closes[closes.length - 1] - closes[closes.length - 14]) / closes[closes.length - 14] : momentum;

    return { momentum, momentum14 };
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 0.001);
    const rsi = 100 - 100 / (1 + rs);

    return Math.max(0, Math.min(100, rsi));
  }

  /**
   * Calculate MACD histogram
   */
  private calculateMACD(closes: number[]): number {
    if (closes.length < 26) return 0;

    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA(closes.slice(-9).map(() => macdLine), 9);
    return macdLine - signalLine;
  }

  /**
   * Analyze structure (consecutive HL, consolidation)
   */
  private analyzeStructure(candles: OHLCV[], ma: number): { consecutiveHL: number; consolidating: boolean } {
    let consecutiveHL = 0;
    let consolidating = false;

    // Count consecutive HH/LL
    for (let i = candles.length - 1; i > 0; i--) {
      const prevHigh = candles[i - 1].high;
      const currHigh = candles[i].high;
      
      if (currHigh > prevHigh) {
        consecutiveHL++;
      } else {
        break;
      }
    }

    // Check if consolidating (price near MA, falling volatility)
    const priceVsMA = Math.abs(candles[candles.length - 1].close - ma) / ma;
    const { bbWidthPercent } = this.calculateBollingerBands(candles.map(c => c.close));
    consolidating = priceVsMA < 0.01 && bbWidthPercent < 0.02;

    return { consecutiveHL, consolidating };
  }

  /**
   * Analyze volume metrics
   */
  private analyzeVolumeTrend(volumes: number[]): 'RISING' | 'STABLE' | 'FALLING' {
    if (volumes.length < 10) return 'STABLE';
    
    const avgOld = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    const avgNew = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    
    if (avgNew > avgOld * 1.1) return 'RISING';
    if (avgNew < avgOld * 0.9) return 'FALLING';
    return 'STABLE';
  }

  /**
   * Classify volume profile
   */
  private classifyVolumeProfile(volumeRatio: number): 'HEAVY' | 'NORMAL' | 'LIGHT' {
    if (volumeRatio > 1.3) return 'HEAVY';
    if (volumeRatio < 0.7) return 'LIGHT';
    return 'NORMAL';
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1];

    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }

    return ema;
  }

  /**
   * Update transition state
   */
  private updateTransitionState(regime: RegimeType, _confidence: number): { inTransition: boolean; progress: number; fromRegime?: RegimeType; toRegime?: RegimeType } {
    const lastRegime = this.getLastRegime();

    if (!lastRegime || lastRegime === regime) {
      return { inTransition: false, progress: 0 };
    }

    // Starting new transition
    this.transitionState = {
      inTransition: true,
      fromRegime: lastRegime,
      toRegime: regime,
      startCandle: this.regimeHistory.length,
      duration: 0
    };

    return {
      inTransition: true,
      progress: Math.min(1, (this.transitionState.duration + 1) / 5),  // 5-candle transition
      fromRegime: lastRegime,
      toRegime: regime
    };
  }

  /**
   * Build description
   */
  private buildDescription(regime: RegimeType, indicators: RegimeIndicators): string {
    const adxStr = `ADX: ${indicators.adx.toFixed(0)}`;
    const atrStr = `ATR: ${(indicators.atrPercent * 100).toFixed(2)}%`;

    switch (regime) {
      case 'TRENDING_UP':
        return `📈 Strong UPTREND (${adxStr}, ${indicators.trendDirection})`;
      case 'TRENDING_DOWN':
        return `📉 Strong DOWNTREND (${adxStr}, ${indicators.trendDirection})`;
      case 'RANGING':
        return `🔄 Ranging/Consolidating (${adxStr}, Range: ${(indicators.rangeWidth * 100).toFixed(1)}%)`;
      case 'VOLATILE':
        return `⚡ High Volatility (${atrStr}, ${indicators.volatilityLevel})`;
      case 'CONSOLIDATING':
        return `🔶 Consolidation Setup (BB Width: ${(indicators.bbWidthPercent * 100).toFixed(2)}%)`;
      default:
        return 'Unknown Regime';
    }
  }

  /**
   * Build trading implications
   */
  private buildTradingImplications(regime: RegimeType, indicators: RegimeIndicators): string[] {
    switch (regime) {
      case 'TRENDING_UP':
        return [
          '✅ Long bias, hold profitable trades',
          '🎯 Buy pullbacks at moving averages',
          '📊 Trail stops as trend continues',
          '⚠️ Reduce short positions'
        ];
      case 'TRENDING_DOWN':
        return [
          '❌ Short bias, avoid longs',
          '🎯 Sell rallies at moving averages',
          '📊 Trail stops downside',
          '⚠️ Close long positions'
        ];
      case 'RANGING':
        return [
          '🔄 Buy support, sell resistance',
          '💰 Take quick profits',
          '❌ Avoid breakout chasing',
          '📊 Reduce position sizes'
        ];
      case 'VOLATILE':
        return [
          '⚠️ Reduce position sizing',
          '🛡️ Use wider stops',
          '⚡ Scalp only',
          '❌ Avoid swing trades'
        ];
      case 'CONSOLIDATING':
        return [
          '👀 Watch for breakout',
          '🎯 Small accumulation position',
          '🔔 Monitor volume spike',
          '⏳ Prepare for big move'
        ];
      default:
        return [];
    }
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(candles: OHLCV[]): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    if (candles.length < 20) return 'POOR';
    if (candles.length < 50) return 'FAIR';
    if (candles.length < 100) return 'GOOD';
    return 'EXCELLENT';
  }

  /**
   * Calculate false flip risk
   */
  private calculateFalseFlipRisk(indicators: RegimeIndicators): number {
    // Risk if ADX is borderline (20-30 range = risky transitions)
    if (indicators.adx >= 20 && indicators.adx <= 30) {
      return Math.abs(indicators.adx - 25) / 5;  // 0-1 where 0.5 = highest risk
    }
    return 0;
  }

  /**
   * Get candles since last flip
   */
  private getCandelessSinceLastFlip(): number {
    if (this.regimeHistory.length < 2) return 0;

    for (let i = this.regimeHistory.length - 1; i > 0; i--) {
      if (this.regimeHistory[i].regime !== this.regimeHistory[i - 1].regime) {
        return this.regimeHistory.length - i;
      }
    }

    return this.regimeHistory.length;
  }

  /**
   * Get last regime
   */
  private getLastRegime(): RegimeType | undefined {
    return this.regimeHistory[this.regimeHistory.length - 1]?.regime;
  }

  /**
   * Create poor data result
   */
  private createPoorDataResult(reason: string): RegimeDetectionResult {
    return {
      regime: 'RANGING',
      regimeStrength: 0,
      direction: 'SIDEWAYS',
      volatilityLevel: 'MEDIUM',
      timeframeConsensus: {
        '1H': 'RANGING',
        '4H': 'RANGING',
        '24H': 'RANGING',
        agreementScore: 1.0,
        dominantTimeframe: '24H'
      },
      isTransitioning: false,
      transitionProgress: 0,
      indicators: {} as RegimeIndicators,
      description: `⚠️ ${reason}`,
      confidence: 0,
      tradingImplications: ['Insufficient data for regime detection'],
      dataQuality: 'POOR',
      canUpdateRegime: false,
      lastRegimeFlip: 0,
      falseFlipRisk: 1
    };
  }
}

// Export singleton instance
export const regimeAssessmentEngine = new RegimeAssessmentEngine();

export default regimeAssessmentEngine;
