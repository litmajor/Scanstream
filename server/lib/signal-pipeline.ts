/**
 * SCANSTREAM Signal Pipeline
 * Unified data flow: Gateway → Scanner → RL/ML → Quality Engine → Presentation
 * 
 * Architecture:
 * 1. GATEWAY LAYER: Raw market data (prices, volume, order flow)
 * 2. SCANNER LAYER: Pattern detection (technical analysis, flow-field)
 * 3. RL/ML LAYER: Advanced predictions (reinforcement learning, neural networks)
 * 4. QUALITY LAYER: Confidence adjustment + historical accuracy
 * 5. PRESENTATION: Optimized frontend response with caching
 */

import { SignalAccuracyEngine } from './signal-accuracy';
import { assetCorrelationAnalyzer } from '../services/asset-correlation-analyzer';
import { executionOptimizer } from '../services/execution-optimizer';
import { tradeClassifier, TradeClassification } from '../services/trade-classifier';
import { getAssetBySymbol, getAssetsByCategory } from '@shared/tracked-assets';
import { getAssetThresholds, meetsQualityThreshold, getMaxPositionForCategory } from '../config/asset-thresholds';
import memoize from 'memoizee';

// ============================================================================
// DATA STRUCTURES - Optimized for performance and frontend consumption
// ============================================================================

export interface RawMarketData {
  symbol: string;
  timestamp: number;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prevPrice: number;
  prevVolume: number;
}

export interface ScannerOutput {
  symbol: string;
  timeframe: string;
  patterns: Array<{
    type: string;
    confidence: number;
    strength: number;
    reasoning: string;
  }>;
  technicalScore: number; // 0-100
  flowFieldScore: number; // 0-100
}

export interface MLPrediction {
  symbol: string;
  timeframe: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  probability: number; // 0-1
  models: {
    lstm: number;
    transformer: number;
    ensemble: number;
  };
}

export interface RLDecision {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  qValue: number;
  explorationRate: number;
  episodeRewards: number[];
}

export interface AggregatedSignal {
  id: string;
  symbol: string;
  timestamp: number;
  type: 'BUY' | 'SELL' | 'HOLD';
  
  // Classification with accuracy boost
  classifications: string[];
  primaryClassification: string;
  confidence: number; // Accuracy-adjusted
  strength: number;
  
  // Source contributions (transparency)
  sources: {
    scanner: { confidence: number; patterns: string[] };
    ml: { confidence: number; model: string };
    rl: { confidence: number; qValue: number };
  };
  
  // Quality metrics
  quality: {
    score: number; // 0-100
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    reasons: string[];
  };
  
  // Entry/Exit
  price: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  
  // Pattern details
  patternDetails: Array<{
    pattern: string;
    accuracy: number;
    levels: Array<{ name: string; value: number }>;
  }>;
  
  // Timeframe alignment
  timeframes: {
    '1m': number;
    '5m': number;
    '15m': number;
    '1h': number;
    '4h': number;
    '1d': number;
  };
  
  // Position sizing
  agreementScore?: number; // 0-100, how much sources agree
  positionSize?: number; // 0-1 scale, position sizing multiplier
  
  // Correlation analysis
  correlationBoost?: number; // Confidence boost from correlated assets (-0.15 to +0.15)
  correlatedSignals?: string[]; // Which correlated assets show aligned signals
  
  // Execution optimization
  executionMetrics?: {
    slippagePercentage: number; // Expected slippage
    totalFeesPercentage: number; // Slippage + exchange fee
    realExecutionPrice: number; // Actual price including slippage
    profitLeakage: number; // % loss from fees/slippage
    recommendedStrategy: 'all-at-once' | 'pyramid-3' | 'pyramid-5';
    executionRecommendation: string;
  };

  // Adaptive holding period classification
  tradeClassification?: TradeClassification & {
    adjustedStopLoss: number; // Calculated from trade type
    adjustedTakeProfit: number; // Calculated from trade type
  };
}

// ============================================================================
// SIGNAL PIPELINE - Orchestrates data flow through all layers
// ============================================================================

export class SignalPipeline {
  private accuracyEngine: SignalAccuracyEngine;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 30000; // 30 seconds

  constructor() {
    this.accuracyEngine = new SignalAccuracyEngine();
  }

  /**
   * Main pipeline: Aggregate all signal sources into unified output
   */
  async aggregateSignals(
    symbol: string,
    marketData: RawMarketData,
    scannerOutput: ScannerOutput,
    mlPredictions: MLPrediction[],
    rlDecision: RLDecision
  ): Promise<AggregatedSignal> {
    const cacheKey = `${symbol}-${Math.floor(Date.now() / 10000)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Step 1: Determine signal type from consensus
    const signalType = this.determineSignalType(scannerOutput, mlPredictions, rlDecision);

    // Step 2: Extract classifications from scanner
    const classifications = scannerOutput.patterns.map(p => p.type);
    const primaryClassification = classifications[0] || 'CONFLUENCE';

    // Step 3: Calculate base confidence from sources
    const baseConfidence = this.calculateBaseConfidence(
      scannerOutput,
      mlPredictions,
      rlDecision
    );

    // Step 4: Adjust confidence using historical accuracy
    const accuracy = this.accuracyEngine.adjustConfidenceByAccuracy(
      baseConfidence,
      primaryClassification as any,
      scannerOutput.timeframe
    );

    // Step 4.5: VOLATILITY NORMALIZATION - Adjust confidence by asset volatility
    const volatilityMultiplier = this.calculateVolatilityMultiplier(marketData);
    const volatilityAdjustedConfidence = accuracy.adjustedConfidence * (1 + volatilityMultiplier);
    
    // Step 4.6: MARKET REGIME DETECTION - Detect trending vs ranging vs volatile markets
    // This uses scanner patterns to build frame data for regime analysis
    const regimeAnalysis = this.detectMarketRegime(
      Array.isArray(scannerOutput.patterns) && scannerOutput.patterns.length > 0 
        ? [marketData] // Use market data as frame
        : []
    );

    const volatilityAdjustedAccuracy = {
      ...accuracy,
      adjustedConfidence: Math.min(1, Math.max(0, volatilityAdjustedConfidence)),
      volatilityMultiplier,
      marketRegime: regimeAnalysis.regime,
      regimeStrength: regimeAnalysis.strength
    };

    // Step 5: Calculate quality score
    const quality = this.calculateQualityScore(
      scannerOutput,
      volatilityAdjustedAccuracy,
      mlPredictions,
      rlDecision
    );

    // Step 6: Extract source contribution (for transparency)
    const sources = {
      scanner: {
        confidence: scannerOutput.technicalScore / 100,
        patterns: classifications
      },
      ml: {
        confidence: Math.max(...mlPredictions.map(m => m.probability)),
        model: 'ensemble'
      },
      rl: {
        confidence: Math.abs(rlDecision.qValue) > 0.5 ? 0.7 : 0.4,
        qValue: rlDecision.qValue
      }
    };

    // Step 7: Calculate position targets
    const positions = this.calculatePositionTargets(marketData);

    // Step 7.5: Calculate agreement score (how much sources agree)
    // 3/3 agreement = 100 × avgConfidence, 2/3 = 65 × avgConfidence, 1/3 = 30 × avgConfidence
    const avgSourceConfidence = (
      (scannerOutput.technicalScore / 100) +
      Math.max(...mlPredictions.map(m => m.probability)) +
      Math.min(Math.abs(rlDecision.qValue), 1)
    ) / 3;
    
    // Determine agreement type from signal consensus
    let agreementBase = 30; // Conservative default
    const scannerDir = scannerOutput.technicalScore > 65 ? 'BUY' : scannerOutput.technicalScore < 35 ? 'SELL' : 'HOLD';
    const mlDir = mlPredictions[0]?.direction || 'HOLD';
    const rlDir = rlDecision.qValue > 0.2 ? 'BUY' : rlDecision.qValue < -0.2 ? 'SELL' : 'HOLD';
    
    if (scannerDir === mlDir && mlDir === rlDir) {
      agreementBase = 100; // 3/3 agreement
    } else if (
      (scannerDir === mlDir) ||
      (mlDir === rlDir) ||
      (scannerDir === rlDir)
    ) {
      agreementBase = 65; // 2/3 agreement
    }
    
    const agreementScore = Math.round(Math.min(100, agreementBase * avgSourceConfidence));

    // Step 8: Calculate position size based on quality, agreement, and asset category
    const asset = getAssetBySymbol(symbol);
    const assetCategory = asset?.category || 'fundamental';
    const positionSize = this.calculatePositionSize(symbol, quality.score, agreementScore, assetCategory);

    // Step 8.5: Apply correlation boost if correlated assets show aligned signals
    const correlationBoost = await assetCorrelationAnalyzer.getCorrelationBoost(
      symbol,
      signalType,
      volatilityAdjustedAccuracy.adjustedConfidence
    );

    // Track this signal for future correlation analysis
    assetCorrelationAnalyzer.trackSignal(symbol, signalType, correlationBoost.boostedConfidence);

    // Use boosted confidence if available
    const finalConfidence = correlationBoost.boostedConfidence;

    // Step 8.7: Classify trade type + VELOCITY-BASED PROFIT TARGETS (only for BUY/SELL signals)
    let classification: any = null;
    let adjustedStopLoss = positions.stopLoss;
    let adjustedTakeProfit = positions.takeProfit;

    if (signalType !== 'HOLD') {
      classification = tradeClassifier.classifyTrade({
        volatilityRatio: Math.max(0.5, Math.min(2.5, ((marketData.high - marketData.low) / marketData.price) * 10)),
        adx: Math.max(20, Math.min(80, scannerOutput.technicalScore)),
        volumeRatio: marketData.volume > 0 && marketData.prevVolume > 0 ? marketData.volume / marketData.prevVolume : 1.0,
        patternType: primaryClassification,
        assetCategory: assetCategory,
        marketRegime: (accuracy as any).marketRegime || 'RANGING'
      }, marketData.price); // PASS ENTRY PRICE for velocity-based targets

      // Use velocity-based targets if available, otherwise fall back to percent-based
      adjustedStopLoss = classification.stopLossDollar || tradeClassifier.calculateStopLoss(
        marketData.price,
        classification.stopLossPercent,
        signalType as 'BUY' | 'SELL'
      );

      adjustedTakeProfit = classification.profitTargetDollar || tradeClassifier.calculateTakeProfit(
        marketData.price,
        classification.profitTargetPercent,
        signalType as 'BUY' | 'SELL'
      );
    }

    // Step 8.8: Optimize execution (model slippage, fees, entry timing)
    const executionOpt = executionOptimizer.optimizeExecution({
      symbol,
      entryPrice: marketData.price,
      positionSize,
      marketVolume24h: marketData.volume * 24, // Estimate 24h from current candle
      orderType: classification.pyramidStrategy,
      exchangeFeePercentage: 0.1 // Standard exchange fee
    });

    // Step 9: Build pattern details for frontend
    const patternDetails = scannerOutput.patterns.map(p => {
      const stats = this.accuracyEngine.getPatternStats(p.type as any);
      return {
        pattern: p.type,
        accuracy: stats?.winRate ?? 0.5,
        levels: [
          { name: 'Support', value: marketData.low },
          { name: 'Resistance', value: marketData.high },
          { name: 'Adaptive Stop Loss', value: adjustedStopLoss },
          { name: 'Adaptive Take Profit', value: adjustedTakeProfit }
        ]
      };
    });

    // Step 10: Assemble aggregated signal with adaptive trade classification
    const signal: AggregatedSignal = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      timestamp: marketData.timestamp,
      type: signalType,
      classifications,
      primaryClassification,
      confidence: finalConfidence,
      strength: scannerOutput.technicalScore,
      sources,
      quality,
      price: marketData.price,
      stopLoss: adjustedStopLoss, // Use adaptive stops
      takeProfit: adjustedTakeProfit, // Use adaptive targets
      riskRewardRatio: (adjustedTakeProfit - marketData.price) / (marketData.price - adjustedStopLoss),
      patternDetails,
      timeframes: this.estimateTimeframeAlignment(marketData, scannerOutput),
      agreementScore,
      positionSize,
      correlationBoost: correlationBoost.correlationBoost,
      correlatedSignals: correlationBoost.alignedAssets,
      executionMetrics: {
        slippagePercentage: executionOpt.slippagePercentage,
        totalFeesPercentage: executionOpt.totalFeesPercentage,
        realExecutionPrice: executionOpt.realExecutionPrice,
        profitLeakage: executionOpt.profitLeakage,
        recommendedStrategy: executionOpt.recommendedStrategy,
        executionRecommendation: executionOpt.recommendation
      },
      ...(classification && {
        tradeClassification: {
          ...classification,
          adjustedStopLoss,
          adjustedTakeProfit
        }
      })
    };

    // Cache result
    this.cache.set(cacheKey, { data: signal, timestamp: Date.now() });

    return signal;
  }

  /**
   * Determine signal type from consensus of three sources
   */
  private determineSignalType(
    scanner: ScannerOutput,
    ml: MLPrediction[],
    rl: RLDecision
  ): 'BUY' | 'SELL' | 'HOLD' {
    let votes = { BUY: 0, SELL: 0, HOLD: 0 };

    // ADAPTIVE WEIGHTS: Use recent performance instead of static 40/35/25
    const { signalPerformanceTracker } = require('../services/signal-performance-tracker');
    const recentWinRates = signalPerformanceTracker.getRecentWinRates(20);
    const total = recentWinRates.scanner + recentWinRates.ml + recentWinRates.rl;
    const weights = {
      scanner: recentWinRates.scanner / total,
      ml: recentWinRates.ml / total,
      rl: recentWinRates.rl / total
    };

    // Scanner vote (weighted by technical score + adaptive weight)
    if (scanner.technicalScore > 65) {
      votes.BUY += (scanner.technicalScore / 100) * weights.scanner;
    } else if (scanner.technicalScore < 35) {
      votes.SELL += ((100 - scanner.technicalScore) / 100) * weights.scanner;
    } else {
      votes.HOLD += 0.5 * weights.scanner;
    }

    // ML vote (weighted by probability + adaptive weight)
    const bestML = ml.reduce((prev, curr) =>
      curr.probability > prev.probability ? curr : prev
    );
    if (bestML.direction === 'BUY') votes.BUY += bestML.probability * weights.ml;
    else if (bestML.direction === 'SELL') votes.SELL += bestML.probability * weights.ml;
    else votes.HOLD += bestML.probability * weights.ml;

    // RL vote (weighted by Q-value + adaptive weight)
    if (rl.qValue > 0.2) votes.BUY += Math.min(rl.qValue, 1) * weights.rl;
    else if (rl.qValue < -0.2) votes.SELL += Math.min(Math.abs(rl.qValue), 1) * weights.rl;
    else votes.HOLD += 0.5 * weights.rl;

    // Determine majority
    if (votes.BUY > votes.SELL && votes.BUY > votes.HOLD) return 'BUY';
    if (votes.SELL > votes.BUY && votes.SELL > votes.HOLD) return 'SELL';
    return 'HOLD';
  }

  /**
   * Calculate base confidence as weighted average of sources
   */
  private calculateBaseConfidence(
    scanner: ScannerOutput,
    ml: MLPrediction[],
    rl: RLDecision
  ): number {
    const scannerConf = scanner.technicalScore / 100 * 0.4;
    const mlConf = Math.max(...ml.map(m => m.probability)) * 0.35;
    const rlConf = Math.min(Math.abs(rl.qValue), 1) * 0.25;
    return scannerConf + mlConf + rlConf;
  }

  /**
   * Calculate quality score (0-100)
   */
  private calculateQualityScore(
    scanner: ScannerOutput,
    accuracy: any,
    ml: MLPrediction[],
    rl: RLDecision
  ): { score: number; rating: 'excellent' | 'good' | 'fair' | 'poor'; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Technical score contribution (40 points max)
    if (scanner.technicalScore >= 80) {
      score += 40;
      reasons.push('Excellent technical confirmation');
    } else if (scanner.technicalScore >= 65) {
      score += 30;
      reasons.push('Strong technical signals');
    } else if (scanner.technicalScore >= 50) {
      score += 20;
      reasons.push('Moderate technical signals');
    }

    // ML contribution (30 points max)
    const bestML = ml.reduce((prev, curr) =>
      curr.probability > prev.probability ? curr : prev
    );
    if (bestML.probability >= 0.85) {
      score += 30;
      reasons.push(`ML high confidence: ${(bestML.probability * 100).toFixed(1)}%`);
    } else if (bestML.probability >= 0.70) {
      score += 20;
      reasons.push(`ML confidence: ${(bestML.probability * 100).toFixed(1)}%`);
    } else if (bestML.probability >= 0.55) {
      score += 10;
      reasons.push(`ML weak signal: ${(bestML.probability * 100).toFixed(1)}%`);
    }

    // Accuracy contribution (20 points max)
    if (accuracy.patternAccuracy >= 0.75) {
      score += 20;
      reasons.push(`Pattern accuracy: ${(accuracy.patternAccuracy * 100).toFixed(1)}%`);
    } else if (accuracy.patternAccuracy >= 0.60) {
      score += 12;
      reasons.push(`Pattern accuracy: ${(accuracy.patternAccuracy * 100).toFixed(1)}%`);
    } else if (accuracy.patternAccuracy >= 0.50) {
      score += 6;
    }

    // Volatility contribution
    const volMult = (accuracy as any).volatilityMultiplier || 0;
    if (volMult > 0.05) {
      score += 8;
      reasons.push(`Low volatility boost: +${(volMult * 100).toFixed(1)}%`);
    } else if (volMult < -0.1) {
      score -= Math.round(Math.abs(volMult) * 5);
      reasons.push(`High volatility penalty: ${(volMult * 100).toFixed(1)}%`);
    }

    // Market regime contribution
    const regime = (accuracy as any).marketRegime;
    const regimeStrength = (accuracy as any).regimeStrength || 0;
    if (regime === 'TRENDING' && regimeStrength > 0.6) {
      score += 12;
      reasons.push(`Trending market regime boost: +${(regimeStrength * 10).toFixed(0)} points`);
    } else if (regime === 'CONSOLIDATING') {
      score -= 5;
      reasons.push(`Consolidation period: reduced confidence`);
    } else if (regime === 'VOLATILE') {
      score = Math.round(score * 0.85);
      reasons.push(`High volatility regime: confidence scaled down 15%`);
    }

    // RL convergence (10 points max)
    if (Math.abs(rl.qValue) > 0.7) {
      score += 10;
      reasons.push('RL strongly converged');
    } else if (Math.abs(rl.qValue) > 0.3) {
      score += 5;
      reasons.push('RL moderately converged');
    }

    const rating: 'excellent' | 'good' | 'fair' | 'poor' =
      score >= 85 ? 'excellent' :
      score >= 70 ? 'good' :
      score >= 50 ? 'fair' : 'poor';

    return { score, rating, reasons };
  }

  /**
   * VOLATILITY NORMALIZATION
   * Calculate volatility multiplier: high volatility → negative multiplier (downgrade)
   * Low volatility → positive multiplier (upgrade)
   * Range: -0.3 (downgrade high vol) to +0.2 (upgrade low vol)
   */
  private calculateVolatilityMultiplier(market: RawMarketData): number {
    const range = market.high - market.low;
    const volatility = range / market.price;
    const multiplier = (0.05 - volatility) * 2;
    return Math.max(-0.3, Math.min(0.2, multiplier));
  }

  /**
   * MARKET REGIME DETECTION - Advanced multi-factor analysis
   * Determines TRENDING, RANGING, VOLATILE, or CONSOLIDATING regimes
   * Returns regime-specific pattern weights for adaptive signal generation
   */
  private detectMarketRegime(frames: any[]): {
    regime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
    strength: number; // 0-1 confidence in regime classification
    indicators: {
      adx: number; // Trend strength
      trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
      volatility: number; // Annualized volatility estimate
      rangeWidth: number; // Current range vs historical
      momentumScore: number; // -1 to +1, momentum direction/strength
      volumeProfile: 'HEAVY' | 'NORMAL' | 'LIGHT';
    };
    patternWeights: Record<string, number>; // Regime-specific pattern adjustments
  } {
    if (frames.length < 50) {
      return {
        regime: 'CONSOLIDATING',
        strength: 0.3,
        indicators: {
          adx: 20,
          trendDirection: 'SIDEWAYS',
          volatility: 0.02,
          rangeWidth: 1,
          momentumScore: 0,
          volumeProfile: 'NORMAL'
        },
        patternWeights: {
          BREAKOUT: 1.0,
          REVERSAL: 1.0,
          TREND_CONFIRMATION: 0.8,
          SUPPORT_BOUNCE: 0.9
        }
      };
    }

    const prices = frames.map((f: any) => (f.price?.close || f.close) as number).filter(p => !isNaN(p));
    const volumes = frames.map((f: any) => (f.volume || 0) as number);
    const highs = frames.map((f: any) => (f.price?.high || f.high) as number).filter(h => !isNaN(h));
    const lows = frames.map((f: any) => (f.price?.low || f.low) as number).filter(l => !isNaN(l));

    // 1. TREND STRENGTH (ADX-like calculation)
    const ema14 = this.calculateEMA(prices, 14);
    const ema30 = this.calculateEMA(prices, 30);
    const trendAlignment = Math.abs(ema14 - ema30) / ema30; // Higher = stronger trend
    const adx = Math.min(100, trendAlignment * 200); // Normalize to 0-100 scale

    // 2. TREND DIRECTION
    const priceVsEma14 = prices[prices.length - 1] > ema14 ? 1 : -1;
    const ema14VsEma30 = ema14 > ema30 ? 1 : -1;
    const trendDirection = (priceVsEma14 + ema14VsEma30) > 0 ? 'UP' : (priceVsEma14 + ema14VsEma30) < 0 ? 'DOWN' : 'SIDEWAYS';

    // 3. VOLATILITY ANALYSIS
    const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVolatility = stdDev * Math.sqrt(252); // 252 trading days

    // 4. RANGE WIDTH (consolidation detection)
    const last20High = Math.max(...highs.slice(-20));
    const last20Low = Math.min(...lows.slice(-20));
    const last50High = Math.max(...highs.slice(-50));
    const last50Low = Math.min(...lows.slice(-50));
    const rangeWidth = (last20High - last20Low) / (last50High - last50Low + 0.001);

    // 5. MOMENTUM SCORE (RSI-based)
    const gains = returns.filter(r => r > 0).reduce((sum, r) => sum + r, 0);
    const losses = Math.abs(returns.filter(r => r < 0).reduce((sum, r) => sum + r, 0));
    const rs = gains / (losses + 0.001);
    const rsi = 100 - (100 / (1 + rs));
    const momentumScore = (rsi - 50) / 50; // -1 to +1 scale

    // 6. VOLUME PROFILE
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / (avgVolume + 0.001);
    const volumeProfile: 'HEAVY' | 'NORMAL' | 'LIGHT' = volumeRatio > 1.3 ? 'HEAVY' : volumeRatio < 0.7 ? 'LIGHT' : 'NORMAL';

    // REGIME CLASSIFICATION LOGIC
    let regime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
    let strength = 0;

    if (adx > 40 && rangeWidth > 0.7) {
      // Strong trend with wide range
      regime = 'TRENDING';
      strength = Math.min(1, (adx - 40) / 40);
    } else if (adx < 25 && rangeWidth < 0.5) {
      // Weak trend, tight range = consolidation
      regime = 'CONSOLIDATING';
      strength = 1 - (adx / 25);
    } else if (annualizedVolatility > 0.03 && adx < 35) {
      // High volatility without strong trend
      regime = 'VOLATILE';
      strength = Math.min(1, annualizedVolatility / 0.05);
    } else {
      // Range-bound market
      regime = 'RANGING';
      strength = 1 - (adx / 50);
    }

    // REGIME-SPECIFIC PATTERN WEIGHTS
    const patternWeights: Record<string, number> = {};
    
    if (regime === 'TRENDING') {
      patternWeights.BREAKOUT = 1.3;
      patternWeights.TREND_CONFIRMATION = 1.2;
      patternWeights.TREND_ESTABLISHMENT = 1.3;
      patternWeights.MA_CROSSOVER = 1.2;
      patternWeights.CONTINUATION = 1.1;
      patternWeights.REVERSAL = 0.6;
      patternWeights.SUPPORT_BOUNCE = 0.8;
      patternWeights.RANGING = 0.3;
    } else if (regime === 'RANGING') {
      patternWeights.BREAKOUT = 0.7;
      patternWeights.REVERSAL = 1.3;
      patternWeights.SUPPORT_BOUNCE = 1.2;
      patternWeights.RESISTANCE_BREAK = 1.1;
      patternWeights.TREND_CONFIRMATION = 0.6;
      patternWeights.MA_CROSSOVER = 0.8;
      patternWeights.RANGING = 1.2;
    } else if (regime === 'VOLATILE') {
      patternWeights.BREAKOUT = 0.8;
      patternWeights.REVERSAL = 0.9;
      patternWeights.SPIKE = 1.4;
      patternWeights.CONSOLIDATION_BREAK = 1.2;
      patternWeights.TREND_CONFIRMATION = 0.7;
      patternWeights.SUPPORT_BOUNCE = 0.7;
    } else {
      // CONSOLIDATING
      patternWeights.CONSOLIDATION_BREAK = 1.3;
      patternWeights.BREAKOUT = 1.1;
      patternWeights.REVERSAL = 1.0;
      patternWeights.RANGING = 1.2;
      patternWeights.TREND_CONFIRMATION = 0.5;
      patternWeights.MA_CROSSOVER = 0.7;
    }

    return {
      regime,
      strength,
      indicators: {
        adx: Math.round(adx),
        trendDirection,
        volatility: Math.round(annualizedVolatility * 10000) / 10000,
        rangeWidth: Math.round(rangeWidth * 100) / 100,
        momentumScore: Math.round(momentumScore * 100) / 100,
        volumeProfile
      },
      patternWeights
    };
  }

  /**
   * Helper: Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }
    return ema;
  }

  /**
   * Calculate stop loss and take profit targets
   */
  private calculatePositionTargets(market: RawMarketData) {
    const atr = Math.abs(market.high - market.low) * 1.5; // Simplified ATR

    return {
      stopLoss: market.price - atr,
      takeProfit: market.price + (atr * 2),
      riskRewardRatio: (market.price + (atr * 2)) / (market.price - atr)
    };
  }

  /**
   * Calculate position size based on quality, agreement, and asset category
   * Position = maxPosition × (quality_score / 100) × agreement_multiplier
   * maxPosition varies by asset class:
   * - Tier-1: 1.0% (most liquid)
   * - Fundamental: 0.8% (strong fundamentals)
   * - Meme: 0.5% (high volatility)
   * - AI/ML: 0.6% (emerging, moderate liquidity)
   * - RWA: 0.6% (emerging, moderate liquidity)
   */
  private calculatePositionSize(symbol: string, qualityScore: number, agreementScore: number, category: string): number {
    const MAX_POSITION = getMaxPositionForCategory(category);
    
    // Agreement multiplier: 3/3 = 1.0x, 2/3 = 0.7x, 1/3 = 0.3x
    let agreementMultiplier = 0.3; // Default: low agreement
    if (agreementScore >= 95) {
      agreementMultiplier = 1.0; // 3/3 unanimous with high confidence
    } else if (agreementScore >= 60) {
      agreementMultiplier = 0.7; // 2/3 agreement
    } else if (agreementScore >= 35) {
      agreementMultiplier = 0.5; // Weak 2/3 agreement
    }

    // Quality score contribution (0-100 → 0-1 scale)
    const qualityMultiplier = Math.max(0.3, qualityScore / 100); // Minimum 0.3 (30% of max)

    // Final position size: max × quality × agreement
    const positionSize = (MAX_POSITION * qualityMultiplier * agreementMultiplier) / 100;

    // Return as percentage (0-1 scale)
    return Math.min(MAX_POSITION, Math.max(0.001, positionSize * 100)) / 100;
  }

  /**
   * Estimate timeframe alignment (how well signal works across timeframes)
   */
  private estimateTimeframeAlignment(market: RawMarketData, scanner: ScannerOutput) {
    const baseAlignment = scanner.technicalScore / 100;
    return {
      '1m': baseAlignment * 0.6,
      '5m': baseAlignment * 0.7,
      '15m': baseAlignment * 0.8,
      '1h': baseAlignment * 0.9,
      '4h': baseAlignment * 0.95,
      '1d': baseAlignment * 1.0
    };
  }
}

// ============================================================================
// OPTIMIZED RESPONSE BUILDER - For frontend consumption
// ============================================================================

export interface SignalsPageResponse {
  signals: AggregatedSignal[];
  summary: {
    totalSignals: number;
    buySignals: number;
    sellSignals: number;
    avgQuality: number;
    topPatterns: Array<{ pattern: string; count: number; accuracy: number }>;
  };
  metadata: {
    timestamp: number;
    dataFreshness: 'real-time' | 'recent' | 'stale';
    sources: string[];
  };
}

export const buildSignalsPageResponse = memoize(
  (signals: AggregatedSignal[]): SignalsPageResponse => {
    const summary = {
      totalSignals: signals.length,
      buySignals: signals.filter(s => s.type === 'BUY').length,
      sellSignals: signals.filter(s => s.type === 'SELL').length,
      avgQuality: signals.reduce((sum, s) => sum + s.quality.score, 0) / Math.max(signals.length, 1),
      topPatterns: getTopPatterns(signals)
    };

    return {
      signals: signals.slice(0, 50), // Limit to 50 for performance
      summary,
      metadata: {
        timestamp: Date.now(),
        dataFreshness: getDataFreshness(signals),
        sources: ['gateway', 'scanner', 'ml', 'rl']
      }
    };
  },
  { maxAge: 10000 } // Cache for 10 seconds
);

function getTopPatterns(signals: AggregatedSignal[]) {
  const patterns: Record<string, { count: number; accuracy: number }> = {};

  signals.forEach(signal => {
    signal.classifications.forEach(cls => {
      if (!patterns[cls]) patterns[cls] = { count: 0, accuracy: 0 };
      patterns[cls].count++;
    });
  });

  return Object.entries(patterns)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      accuracy: data.accuracy
    }));
}

function getDataFreshness(signals: AggregatedSignal[]): 'real-time' | 'recent' | 'stale' {
  if (signals.length === 0) return 'stale';
  const oldest = Math.min(...signals.map(s => s.timestamp));
  const age = Date.now() - oldest;
  if (age < 60000) return 'real-time';
  if (age < 300000) return 'recent';
  return 'stale';
}
