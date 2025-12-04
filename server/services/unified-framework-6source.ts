/**
 * Unified 6-Source Signal Framework
 * 
 * Combines all signal sources into single coherent system:
 * 1. Gradient Direction (Trend following)
 * 2. UT Bot Volatility (Range trading)
 * 3. Market Structure (Swing analysis)
 * 4. Flow Field Energy (Energy/pressure)
 * 5. ML Predictions (Neural networks)
 * 6. Pattern Detection (Technical patterns + volume)
 * 
 * With dynamic weighting by market regime
 */

import type { StrategyContribution } from './unified-signal-aggregator';
import type { PatternDetectionResult } from './pattern-detection-contribution';

export interface UnifiedSignalFramework {
  // 6 Core Sources
  sources: {
    gradient: StrategyContribution;
    utBot: StrategyContribution;
    structure: StrategyContribution;
    flowField: StrategyContribution;
    mlPredictions: StrategyContribution;
    patterns: StrategyContribution;
  };

  // Aggregated metrics
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;

  // Regime-aware weighting
  regime: string;
  weights: {
    gradient: number;
    utBot: number;
    structure: number;
    flowField: number;
    mlPredictions: number;
    patterns: number;
  };

  // Volume validation
  volumeMetrics: {
    ratio: number;
    confirmed: boolean;
    strength: 'weak' | 'normal' | 'strong' | 'extreme';
  };

  // Pattern analysis
  primaryPattern?: string;
  patternConfluence: number;
  multiplePatterns: boolean;

  // Risk assessment
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

  // Full transparency
  reasoning: string;
  contributionBreakdown: Record<string, number>;
}

export class UnifiedFramework {
  /**
   * Merge all 6 sources with dynamic weighting
   */
  static mergeAllSources(
    gradient: StrategyContribution,
    utBot: StrategyContribution,
    structure: StrategyContribution,
    flowField: StrategyContribution,
    mlPredictions: StrategyContribution,
    patterns: StrategyContribution,
    regime: string,
    volumeRatio: number = 1.0,
    patternResult?: PatternDetectionResult
  ): UnifiedSignalFramework {
    // ========== GET REGIME-SPECIFIC WEIGHTS ==========
    const weights = this.getRegimeWeights(regime);

    // ========== VOLUME VALIDATION ==========
    const volumeStrength =
      volumeRatio > 2.0 ? 'extreme' : volumeRatio > 1.5 ? 'strong' : volumeRatio > 1.2 ? 'normal' : 'weak';
    const volumeConfirmed = volumeRatio >= 1.2;

    // ========== WEIGHTED VOTING ==========
    let bullishScore = 0;
    let bearishScore = 0;
    let totalWeight = 0;

    const sources = [
      { source: gradient, weight: weights.gradient },
      { source: utBot, weight: weights.utBot },
      { source: structure, weight: weights.structure },
      { source: flowField, weight: weights.flowField },
      { source: mlPredictions, weight: weights.mlPredictions },
      { source: patterns, weight: weights.patterns }
    ];

    sources.forEach(({ source, weight }) => {
      totalWeight += weight;
      if (source.trend === 'BULLISH') {
        bullishScore += source.confidence * weight;
      } else if (source.trend === 'BEARISH') {
        bearishScore += source.confidence * weight;
      }
    });

    // ========== DETERMINE DIRECTION ==========
    const bullishPercent = totalWeight > 0 ? bullishScore / totalWeight : 0;
    const bearishPercent = totalWeight > 0 ? bearishScore / totalWeight : 0;

    let direction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    if (bullishPercent > 0.6) {
      direction = 'BUY';
      confidence = bullishPercent;
    } else if (bearishPercent > 0.6) {
      direction = 'SELL';
      confidence = bearishPercent;
    } else {
      direction = 'HOLD';
      confidence = Math.max(bullishPercent, bearishPercent);
    }

    // ========== APPLY VOLUME BOOST ==========
    // Strong volume confirmation adds confidence
    if (volumeConfirmed && (direction === 'BUY' || direction === 'SELL')) {
      confidence = Math.min(1.0, confidence * 1.1 + 0.05);
    } else if (!volumeConfirmed) {
      // Weak volume reduces confidence
      confidence = Math.max(0.3, confidence * 0.9 - 0.05);
    }

    // ========== PATTERN CONFLUENCE BOOST ==========
    const patternConfluence = patternResult?.confluenceCount || 0;
    if (patternConfluence >= 3) {
      // Multiple patterns aligning = high confidence boost
      confidence = Math.min(1.0, confidence * 1.15 + 0.10);
    } else if (patternConfluence >= 2) {
      confidence = Math.min(1.0, confidence * 1.05);
    }

    // ========== CALCULATE OVERALL STRENGTH ==========
    const sourceStrengths = sources.map(s => s.source.strength || 50);
    const avgStrength = sourceStrengths.reduce((a, b) => a + b, 0) / sourceStrengths.length;
    const strength = Math.min(100, avgStrength * (1 + patternConfluence * 0.1));

    // ========== RISK ASSESSMENT ==========
    let riskScore = 50;

    // Higher risk if volume not confirmed
    if (!volumeConfirmed) riskScore += 15;

    // Lower risk if patterns confluent
    if (patternConfluence >= 3) riskScore -= 20;
    else if (patternConfluence >= 2) riskScore -= 10;

    // Higher risk if flow field shows deceleration
    if (flowField.energyTrend === 'DECELERATING') riskScore += 15;

    // Lower risk in trending with clear structure
    if (regime === 'TRENDING' && structure.confidence > 0.7) riskScore -= 15;

    riskScore = Math.max(0, Math.min(100, riskScore));

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' =
      riskScore < 35 ? 'LOW' : riskScore < 60 ? 'MEDIUM' : riskScore < 80 ? 'HIGH' : 'EXTREME';

    // ========== BUILD REASONING ==========
    const sourceReasons: string[] = [];
    if (gradient.reason) sourceReasons.push(`Gradient: ${gradient.reason}`);
    if (utBot.reason) sourceReasons.push(`UT Bot: ${utBot.reason}`);
    if (structure.reason) sourceReasons.push(`Structure: ${structure.reason}`);
    if (flowField.reason) sourceReasons.push(`Flow: ${flowField.reason}`);
    if (mlPredictions.reason) sourceReasons.push(`ML: ${mlPredictions.reason}`);
    if (patterns.reason) sourceReasons.push(`Pattern: ${patterns.reason}`);

    const reasoning = `
[${regime}] ${direction} (${(confidence * 100).toFixed(0)}% confidence)
Volume: ${volumeStrength.toUpperCase()} (${volumeRatio.toFixed(2)}x)
Patterns: ${patternConfluence} confluent
Risk: ${riskLevel} (${riskScore.toFixed(0)}/100)
Reasons: ${sourceReasons.join(' | ')}
`.trim();

    // ========== BUILD CONTRIBUTION BREAKDOWN ==========
    const contributionBreakdown = {
      gradient: gradient.confidence * weights.gradient,
      utBot: utBot.confidence * weights.utBot,
      structure: structure.confidence * weights.structure,
      flowField: flowField.confidence * weights.flowField,
      mlPredictions: mlPredictions.confidence * weights.mlPredictions,
      patterns: patterns.confidence * weights.patterns
    };

    return {
      sources: {
        gradient,
        utBot,
        structure,
        flowField,
        mlPredictions,
        patterns
      },
      direction,
      confidence,
      strength,
      regime,
      weights,
      volumeMetrics: {
        ratio: volumeRatio,
        confirmed: volumeConfirmed,
        strength: volumeStrength as 'weak' | 'normal' | 'strong' | 'extreme'
      },
      primaryPattern: patternResult?.primaryPattern,
      patternConfluence,
      multiplePatterns: patternConfluence >= 2,
      riskScore,
      riskLevel,
      reasoning,
      contributionBreakdown
    };
  }

  /**
   * Get regime-specific weights for all 6 sources
   */
  static getRegimeWeights(regime: string): Record<string, number> {
    const weights: Record<string, Record<string, number>> = {
      TRENDING: {
        gradient: 0.35,
        utBot: 0.12,
        structure: 0.25,
        flowField: 0.12,
        mlPredictions: 0.05,
        patterns: 0.11
      },
      SIDEWAYS: {
        gradient: 0.08,
        utBot: 0.35,
        structure: 0.18,
        flowField: 0.12,
        mlPredictions: 0.10,
        patterns: 0.17
      },
      HIGH_VOLATILITY: {
        gradient: 0.10,
        utBot: 0.35,
        structure: 0.08,
        flowField: 0.18,
        mlPredictions: 0.12,
        patterns: 0.17
      },
      BREAKOUT: {
        gradient: 0.12,
        utBot: 0.08,
        structure: 0.25,
        flowField: 0.20,
        mlPredictions: 0.04,
        patterns: 0.31 // Patterns critical for validating breakouts!
      },
      QUIET: {
        gradient: 0.20,
        utBot: 0.10,
        structure: 0.18,
        flowField: 0.12,
        mlPredictions: 0.20,
        patterns: 0.20
      }
    };

    return weights[regime] || weights.SIDEWAYS;
  }

  /**
   * Get summary for logging/display
   */
  static getSummary(framework: UnifiedSignalFramework): string {
    const topSource = Object.entries(framework.contributionBreakdown).sort(
      ([, a], [, b]) => b - a
    )[0];

    return `
╔════════════════════════════════════════════════════════════════╗
║ UNIFIED 6-SOURCE SIGNAL FRAMEWORK                             ║
╠════════════════════════════════════════════════════════════════╣
║ SIGNAL:    ${framework.direction} @ ${(framework.confidence * 100).toFixed(0)}% confidence ║
║ REGIME:    ${framework.regime.padEnd(47)} ║
║ PATTERNS:  ${framework.patternConfluence} confluent patterns              ║
║ VOLUME:    ${framework.volumeMetrics.strength.toUpperCase().padEnd(35)} (${framework.volumeMetrics.ratio.toFixed(2)}x) ║
║ RISK:      ${framework.riskLevel.padEnd(46)} ║
╠════════════════════════════════════════════════════════════════╣
║ SOURCE CONTRIBUTIONS:                                          ║
║  1. Gradient:     ${(framework.weights.gradient * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.gradient).toFixed(2)} contrib ║
║  2. UT Bot:       ${(framework.weights.utBot * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.utBot).toFixed(2)} contrib ║
║  3. Structure:    ${(framework.weights.structure * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.structure).toFixed(2)} contrib ║
║  4. Flow Field:   ${(framework.weights.flowField * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.flowField).toFixed(2)} contrib ║
║  5. ML:           ${(framework.weights.mlPredictions * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.mlPredictions).toFixed(2)} contrib ║
║  6. PATTERNS:     ${(framework.weights.patterns * 100).toFixed(0)}% weight │ ${(framework.contributionBreakdown.patterns).toFixed(2)} contrib ║
╠════════════════════════════════════════════════════════════════╣
║ TOP SOURCE: ${topSource[0].toUpperCase().padEnd(48)} ║
║ STRENGTH:   ${framework.strength.toFixed(0)}/100                                 ║
╚════════════════════════════════════════════════════════════════╝
`.trim();
  }
}

export default UnifiedFramework;
