/**
 * VFMD Early Entry Detector
 * Specializes in identifying high-probability entry opportunities before major moves
 */

import type { MarketTick, VectorField, EarlyEntrySignal, PhysicsMetrics } from './types';
import { FieldConstructor, FieldAnalyzer } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

export interface EarlyEntryContext {
  metrics: PhysicsMetrics;
  prices: number[];
  volumes: number[];
  currentPrice: number;
  volatility: number;
}

export class EarlyEntryDetector {
  private fieldConstructor: FieldConstructor;

  constructor(
    spatialBins: number = 50,
    temporalWindow: number = 100
  ) {
    this.fieldConstructor = new FieldConstructor(spatialBins, temporalWindow);
  }

  /**
   * Analyze market for early entry opportunities
   * Returns interpretable signal with entry/target/stop
   */
  analyzeForEntry(ticks: MarketTick[]): EarlyEntrySignal {
    if (ticks.length < 100) {
      return this.neutralSignal('Insufficient data');
    }

    // Build field from price data
    const prices = ticks.map(t => t.close);
    const field = this.fieldConstructor.constructField(prices);

    // Compute physics metrics
    const metrics = PhysicsCalculator.computeAllMetrics(field);

    // Calculate volatility
    const returns = this.calculateReturns(prices);
    const volatility = this.calculateStdDev(returns);
    const recentTrend = this.calculateTrend(prices);

    const context: EarlyEntryContext = {
      metrics,
      prices,
      volumes: ticks.map(t => t.volume),
      currentPrice: prices[prices.length - 1],
      volatility
    };

    // Detect early entry setup
    return this.detectEarlyEntry(context, recentTrend);
  }

  /**
   * Main detection logic: find early entries by analyzing field state
   */
  private detectEarlyEntry(
    context: EarlyEntryContext,
    recentTrend: number
  ): EarlyEntrySignal {
    const {
      metrics,
      prices,
      volumes,
      currentPrice,
      volatility
    } = context;

    // Determine volatility regime
    const volatilityRegime = this.classifyVolatility(volatility);

    // Calculate order flow imbalance
    const imbalanceScore = this.calculateImbalanceScore(volumes);

    // Pressure gradient: rate of change of field energy
    const pressureGradient = this.calculatePressureGradient(metrics);

    // Flow momentum: normalized coherence and angle
    const flowMomentum = this.calculateFlowMomentum(metrics);

    // Decision logic based on field state
    let signal = this.neutralSignal('No early entry signal');

    // **BULLISH EARLY ENTRY CONDITIONS**
    if (
      metrics.recentDivergence > 0.05 && // Accumulation (source)
      metrics.turbulenceIndex < 1.5 && // Low turbulence (clean flow)
      imbalanceScore > 0.1 && // Buy pressure building
      pressureGradient > 0 && // Energy accelerating
      volatilityRegime !== 'high' // Not in panic
    ) {
      signal = this.createBullishEntry(
        'bullish',
        currentPrice,
        volatility,
        imbalanceScore,
        pressureGradient,
        flowMomentum,
        metrics
      );
    }

    // **BEARISH EARLY ENTRY CONDITIONS**
    else if (
      metrics.recentDivergence < -0.05 && // Distribution (sink)
      metrics.turbulenceIndex < 1.5 && // Low turbulence
      imbalanceScore < -0.1 && // Sell pressure building
      pressureGradient > 0 && // Energy accelerating downward
      volatilityRegime !== 'high'
    ) {
      signal = this.createBearishEntry(
        'bearish',
        currentPrice,
        volatility,
        imbalanceScore,
        pressureGradient,
        flowMomentum,
        metrics
      );
    }

    // **EARLY ENTRY PREMIUM: Combine multiple confirmations**
    if (signal.type !== 'neutral') {
      // Boost confidence if multiple factors align
      const alignmentCount = [
        metrics.coherenceScore > 0.6,
        Math.abs(pressureGradient) > 0.02,
        metrics.peg > 0.05,
        imbalanceScore !== 0 && Math.abs(imbalanceScore) > 0.15
      ].filter(Boolean).length;

      signal.strength = Math.min(1, 0.5 + alignmentCount * 0.15);
      signal.confidence = Math.min(1, signal.confidence + alignmentCount * 0.1);

      // Add interpretable reason
      signal.factors = this.buildExplanation(metrics, imbalanceScore, pressureGradient);
    }

    signal.volatilityRegime = volatilityRegime;
    signal.imbalanceScore = imbalanceScore;
    signal.pressureGradient = pressureGradient;
    signal.flowMomentum = flowMomentum;

    return signal;
  }

  /**
   * Create bullish early entry signal
   */
  private createBullishEntry(
    type: 'bullish' | 'bearish',
    currentPrice: number,
    volatility: number,
    imbalance: number,
    gradient: number,
    momentum: number,
    metrics: PhysicsMetrics
  ): EarlyEntrySignal {
    // Risk sizing based on volatility
    const atrEquiv = volatility * currentPrice; // Approximate ATR
    const riskPercent = Math.min(0.04, volatility * 2); // 2-4% risk

    const entry = currentPrice;
    const target = currentPrice + atrEquiv * (2 + imbalance); // 2-3 ATR profit target
    const stop = currentPrice - atrEquiv * 0.7; // 0.7 ATR stop

    // Base confidence from divergence strength
    let confidence = Math.min(0.9, Math.abs(metrics.recentDivergence) * 3);
    confidence *= 1 - Math.min(0.3, metrics.turbulenceIndex * 0.2); // Penalize turbulence

    return {
      type,
      confidence,
      strength: Math.min(1, Math.abs(metrics.recentDivergence) * 2),
      volatilityRegime: 'medium',
      imbalanceScore: imbalance,
      pressureGradient: gradient,
      flowMomentum: momentum,
      suggestedEntry: entry,
      suggestedTarget: target,
      suggestedStop: stop,
      reason: 'Early accumulation detected - bullish setup',
      factors: []
    };
  }

  /**
   * Create bearish early entry signal
   */
  private createBearishEntry(
    type: 'bullish' | 'bearish',
    currentPrice: number,
    volatility: number,
    imbalance: number,
    gradient: number,
    momentum: number,
    metrics: PhysicsMetrics
  ): EarlyEntrySignal {
    const atrEquiv = volatility * currentPrice;
    const riskPercent = Math.min(0.04, volatility * 2);

    const entry = currentPrice;
    const target = currentPrice - atrEquiv * (2 + Math.abs(imbalance));
    const stop = currentPrice + atrEquiv * 0.7;

    let confidence = Math.min(0.9, Math.abs(metrics.recentDivergence) * 3);
    confidence *= 1 - Math.min(0.3, metrics.turbulenceIndex * 0.2);

    return {
      type,
      confidence,
      strength: Math.min(1, Math.abs(metrics.recentDivergence) * 2),
      volatilityRegime: 'medium',
      imbalanceScore: imbalance,
      pressureGradient: gradient,
      flowMomentum: momentum,
      suggestedEntry: entry,
      suggestedTarget: target,
      suggestedStop: stop,
      reason: 'Early distribution detected - bearish setup',
      factors: []
    };
  }

  /**
   * Neutral signal when no setup detected
   */
  private neutralSignal(reason: string): EarlyEntrySignal {
    return {
      type: 'neutral',
      confidence: 0,
      strength: 0,
      volatilityRegime: 'medium',
      imbalanceScore: 0,
      pressureGradient: 0,
      flowMomentum: 0,
      suggestedEntry: 0,
      suggestedTarget: 0,
      suggestedStop: 0,
      reason,
      factors: []
    };
  }

  /**
   * Classify volatility regime
   */
  private classifyVolatility(vol: number): 'low' | 'medium' | 'high' {
    if (vol < 0.005) return 'low';
    if (vol < 0.015) return 'medium';
    return 'high';
  }

  /**
   * Calculate imbalance from volume data
   */
  private calculateImbalanceScore(volumes: number[]): number {
    if (volumes.length < 10) return 0;

    const recent = volumes.slice(-10);
    const avgVolume = recent.reduce((a, b) => a + b, 0) / recent.length;

    // Volume acceleration: recent volume relative to average
    const volumeAccel = (recent[recent.length - 1] / avgVolume - 1) * 0.5;

    // Score ranges from -1 to +1
    return Math.max(-1, Math.min(1, volumeAccel));
  }

  /**
   * Pressure gradient: how fast is energy accumulating
   */
  private calculatePressureGradient(metrics: PhysicsMetrics): number {
    // Higher PEG = more energy accumulation
    // Positive divergence = sources (accumulation)
    const pegInfluence = Math.min(0.5, metrics.peg / 0.5);
    const divInfluence = Math.max(-0.5, Math.min(0.5, metrics.recentDivergence));

    return (pegInfluence + divInfluence) / 2;
  }

  /**
   * Flow momentum: coherence and directional alignment
   */
  private calculateFlowMomentum(metrics: PhysicsMetrics): number {
    // Convert angle to directional bias (-1 to +1)
    const angleInfluence = Math.sin(metrics.dominantAngle);

    // Coherence amplifies direction
    const momentum = angleInfluence * metrics.coherenceScore;

    return Math.max(-1, Math.min(1, momentum));
  }

  /**
   * Build human-readable explanation of signal
   */
  private buildExplanation(
    metrics: PhysicsMetrics,
    imbalance: number,
    gradient: number
  ): string[] {
    const factors: string[] = [];

    if (metrics.peg > 0.1) {
      factors.push(`High energy accumulation (PEG=${metrics.peg.toFixed(2)})`);
    }

    if (metrics.turbulenceIndex < 1.0) {
      factors.push('Clean directional flow');
    }

    if (Math.abs(imbalance) > 0.2) {
      const direction = imbalance > 0 ? 'buy' : 'sell';
      factors.push(`Strong ${direction} pressure building`);
    }

    if (gradient > 0.02) {
      factors.push('Energy accelerating upward');
    } else if (gradient < -0.02) {
      factors.push('Energy accelerating downward');
    }

    if (metrics.coherenceScore > 0.7) {
      factors.push('Highly coherent directional flow');
    }

    return factors.length > 0
      ? factors
      : ['Mixed signals - monitor for confirmation'];
  }

  // Utility methods
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  private calculateTrend(prices: number[]): number {
    if (prices.length < 20) return 0;
    const recent = prices.slice(-20);
    const first = recent[0];
    const last = recent[recent.length - 1];
    return (last - first) / first;
  }
}
