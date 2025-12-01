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

    // Step 5: Calculate quality score
    const quality = this.calculateQualityScore(
      scannerOutput,
      accuracy,
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

    // Step 8: Build pattern details for frontend
    const patternDetails = scannerOutput.patterns.map(p => {
      const stats = this.accuracyEngine.getPatternStats(p.type as any);
      return {
        pattern: p.type,
        accuracy: stats?.winRate ?? 0.5,
        levels: [
          { name: 'Support', value: marketData.low },
          { name: 'Resistance', value: marketData.high }
        ]
      };
    });

    // Step 9: Assemble aggregated signal
    const signal: AggregatedSignal = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      timestamp: marketData.timestamp,
      type: signalType,
      classifications,
      primaryClassification,
      confidence: accuracy.adjustedConfidence,
      strength: scannerOutput.technicalScore,
      sources,
      quality,
      price: marketData.price,
      stopLoss: positions.stopLoss,
      takeProfit: positions.takeProfit,
      riskRewardRatio: positions.riskRewardRatio,
      patternDetails,
      timeframes: this.estimateTimeframeAlignment(marketData, scannerOutput)
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

    // Scanner vote (weighted by technical score)
    if (scanner.technicalScore > 65) {
      votes.BUY += scanner.technicalScore / 100;
    } else if (scanner.technicalScore < 35) {
      votes.SELL += (100 - scanner.technicalScore) / 100;
    } else {
      votes.HOLD += 0.5;
    }

    // ML vote (weighted by probability)
    const bestML = ml.reduce((prev, curr) =>
      curr.probability > prev.probability ? curr : prev
    );
    if (bestML.direction === 'BUY') votes.BUY += bestML.probability;
    else if (bestML.direction === 'SELL') votes.SELL += bestML.probability;
    else votes.HOLD += bestML.probability;

    // RL vote (weighted by Q-value)
    if (rl.qValue > 0.2) votes.BUY += Math.min(rl.qValue, 1);
    else if (rl.qValue < -0.2) votes.SELL += Math.min(Math.abs(rl.qValue), 1);
    else votes.HOLD += 0.5;

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
