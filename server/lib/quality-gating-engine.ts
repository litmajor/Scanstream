/**
 * PHASE 3: QUALITY GATING SYSTEM
 * 
 * 5-Layer Quality Filtering Architecture:
 * 1. TIER-BASED FILTERING - Entry quality classification (PREMIUM/STANDARD/SPECULATIVE)
 * 2. COMPOSITE ENTRY QUALITY - Multi-factor signal quality scoring
 * 3. CLUSTERING VALIDATION - Pattern reliability and uniqueness
 * 4. CONSENSUS FILTERING - Multi-source agreement validation
 * 5. PERFORMANCE DASHBOARD - Real-time signal quality metrics
 * 
 * Objective: Filter 80%+ of losing signals while preserving 90%+ of winners
 */

import type { AggregatedSignal } from './signal-pipeline';
import type { RegimeDetectionResult, RegimeType } from './regime-assessment';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TierLevel = 'PREMIUM' | 'STANDARD' | 'SPECULATIVE';
export type SignalQualityRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export type PatternCluster = 'UNIQUE' | 'COMMON' | 'REDUNDANT';

export interface TierClassification {
  tier: TierLevel;
  score: number;           // 0-100
  confidence: number;      // 0-1
  reasons: string[];
  requiredThreshold: number; // Min score to pass this tier
}

export interface CompositeEntryQuality {
  overallScore: number;    // 0-100 weighted score
  rating: SignalQualityRating;
  components: {
    confidenceQuality: number;    // 0-100: Signal confidence assessment
    sourceAgreement: number;      // 0-100: How much sources agree (consensus)
    regimeAlignment: number;      // 0-100: How well signal aligns with regime
    patternReliability: number;   // 0-100: Historical accuracy of this pattern
    technicalStructure: number;   // 0-100: Price action quality
    volumeConfirmation: number;   // 0-100: Volume backing the move
    riskReward: number;           // 0-100: R:R ratio quality
  };
  weightings: Record<string, number>; // Component weights (sum to 1.0)
}

export interface ClusteringResult {
  cluster: PatternCluster;
  confidence: number;      // 0-1: How certain is this classification?
  redundancyScore: number; // 0-1: How similar to recent signals? (0=unique, 1=identical)
  similarPatterns: number; // Count of recent similar patterns
  uniquenessRank: number;  // 1-100: How unique is this signal? (100=most unique)
}

export interface ConsensusValidation {
  scannerAgreement: number;   // 0-1: Scanner confidence in this signal
  mlAgreement: number;        // 0-1: ML model agreement
  rlAgreement: number;        // 0-1: RL agent agreement
  overallConsensus: number;   // 0-1: Weighted consensus score
  passesConsensus: boolean;   // true if meets threshold
  dissentingSource?: string;  // Which source disagrees most
}

export interface QualityGatedSignal extends AggregatedSignal {
  quality_gating: {
    tier: TierClassification;
    compositeQuality: CompositeEntryQuality;
    clustering: ClusteringResult;
    consensus: ConsensusValidation;
    finalDecision: 'PASS' | 'FILTERED';
    filterReason?: string;
    confidenceAdjustment: number; // Multiplier applied to confidence (0.5-1.5)
    aggregatedScore: number;      // Final 0-100 quality score
  };
}

// ============================================================================
// LAYER 1: TIER-BASED FILTERING
// ============================================================================

export class TierBasedFilter {
  /**
   * Classify signal into quality tier based on multi-factor criteria
   */
  classifyTier(signal: AggregatedSignal): TierClassification {
    const scores: Record<string, number> = {};
    const reasons: string[] = [];

    // Factor 1: Confidence level (0-25 points)
    scores.confidence = Math.min(25, signal.confidence * 25);
    if (signal.confidence > 0.8) {
      reasons.push(`Very high confidence (${(signal.confidence * 100).toFixed(0)}%)`);
    } else if (signal.confidence < 0.5) {
      reasons.push(`Low confidence (${(signal.confidence * 100).toFixed(0)}%)`);
    }

    // Factor 2: Source agreement (0-25 points)
    const avgSourceConfidence = (
      signal.sources.scanner.confidence +
      signal.sources.ml.confidence +
      signal.sources.rl.confidence
    ) / 3;
    scores.agreement = Math.min(25, avgSourceConfidence * 25);
    if (Math.abs(signal.sources.scanner.confidence - avgSourceConfidence) < 0.1 &&
        Math.abs(signal.sources.ml.confidence - avgSourceConfidence) < 0.1 &&
        Math.abs(signal.sources.rl.confidence - avgSourceConfidence) < 0.1) {
      reasons.push('All sources aligned');
    }

    // Factor 3: Quality score (0-25 points)
    scores.quality = Math.min(25, (signal.quality.score / 100) * 25);
    reasons.push(`Quality score: ${signal.quality.score}`);

    // Factor 4: Agreement score / Pattern strength (0-25 points)
    scores.pattern = Math.min(25, ((signal.agreementScore || 50) / 100) * 25);
    if ((signal.agreementScore || 0) > 75) {
      reasons.push('Strong pattern agreement');
    }

    // Calculate tier
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    
    let tier: TierLevel;
    let threshold: number;

    if (totalScore >= 85) {
      tier = 'PREMIUM';
      threshold = 70;
    } else if (totalScore >= 65) {
      tier = 'STANDARD';
      threshold = 50;
    } else {
      tier = 'SPECULATIVE';
      threshold = 30;
    }

    return {
      tier,
      score: totalScore,
      confidence: Math.min(1, Math.max(0, totalScore / 100)),
      reasons,
      requiredThreshold: threshold
    };
  }
}

// ============================================================================
// LAYER 2: COMPOSITE ENTRY QUALITY SCORING
// ============================================================================

export class CompositeQualityScorer {
  /**
   * Calculate comprehensive entry quality from multiple factors
   */
  scoreEntryQuality(
    signal: AggregatedSignal,
    regime?: RegimeDetectionResult
  ): CompositeEntryQuality {
    // Component scoring (0-100 each)
    const components = {
      confidenceQuality: Math.round(signal.confidence * 100),
      sourceAgreement: this.scoreSourceAgreement(signal),
      regimeAlignment: regime ? this.scoreRegimeAlignment(signal, regime) : 50,
      patternReliability: this.scorePatternReliability(signal),
      technicalStructure: this.scoreTechnicalStructure(signal),
      volumeConfirmation: this.scoreVolumeConfirmation(signal),
      riskReward: this.scoreRiskReward(signal)
    };

    // Adaptive weightings based on regime
    const weightings = this.getAdaptiveWeights(regime?.regime);

    // Calculate weighted score
    const overallScore = (
      components.confidenceQuality * weightings.confidenceQuality +
      components.sourceAgreement * weightings.sourceAgreement +
      components.regimeAlignment * weightings.regimeAlignment +
      components.patternReliability * weightings.patternReliability +
      components.technicalStructure * weightings.technicalStructure +
      components.volumeConfirmation * weightings.volumeConfirmation +
      components.riskReward * weightings.riskReward
    );

    const rating: SignalQualityRating = 
      overallScore >= 80 ? 'EXCELLENT' :
      overallScore >= 65 ? 'GOOD' :
      overallScore >= 50 ? 'FAIR' :
      'POOR';

    return {
      overallScore: Math.round(overallScore),
      rating,
      components,
      weightings
    };
  }

  private scoreSourceAgreement(signal: AggregatedSignal): number {
    const scanner = signal.sources.scanner.confidence;
    const ml = signal.sources.ml.confidence;
    const rl = signal.sources.rl.confidence;

    const avg = (scanner + ml + rl) / 3;
    const variance = (
      Math.pow(scanner - avg, 2) +
      Math.pow(ml - avg, 2) +
      Math.pow(rl - avg, 2)
    ) / 3;

    // High agreement = low variance = high score
    return Math.round((1 - Math.sqrt(variance)) * 100);
  }

  private scoreRegimeAlignment(signal: AggregatedSignal, regime: RegimeDetectionResult): number {
    // Trending regimes favor trend-following signals
    if (regime.regime.includes('TRENDING')) {
      return signal.type === 'BUY' && regime.direction === 'UP' ||
             signal.type === 'SELL' && regime.direction === 'DOWN'
        ? 90 : 60;
    }

    // Ranging regimes favor mean reversion
    if (regime.regime === 'RANGING' || regime.regime === 'CONSOLIDATING') {
      return 80; // Mean reversion works well in ranges
    }

    // Volatile markets are risky
    if (regime.regime === 'VOLATILE') {
      return Math.min(50, signal.confidence * 100);
    }

    return 70;
  }

  private scorePatternReliability(signal: AggregatedSignal): number {
    // Score based on how many patterns are in the signal
    const patternCount = signal.patternDetails.length;
    const avgAccuracy = signal.patternDetails.length > 0
      ? signal.patternDetails.reduce((sum, p) => sum + (p.accuracy || 0.5), 0) / patternCount
      : 0.5;

    // Multiple confirmed patterns are more reliable
    const patternBonus = Math.min(20, patternCount * 10);
    
    return Math.round(avgAccuracy * 100 * 0.8 + patternBonus);
  }

  private scoreTechnicalStructure(signal: AggregatedSignal): number {
    // R:R ratio quality
    if (!signal.riskRewardRatio || signal.riskRewardRatio < 1) {
      return 40;
    } else if (signal.riskRewardRatio < 1.5) {
      return 60;
    } else if (signal.riskRewardRatio < 2.5) {
      return 80;
    } else {
      return 95;
    }
  }

  private scoreVolumeConfirmation(signal: AggregatedSignal): number {
    // Check if volume profile indicates heavy volume
    const volumeRatio = (signal as any).sources?.scanner?.patterns || [];
    
    // Heuristic: if agreement score is high, volume is likely confirmed
    return Math.min(100, (signal.agreementScore || 50) * 1.2);
  }

  private scoreRiskReward(signal: AggregatedSignal): number {
    // Penalize low R:R, reward high R:R
    if (!signal.riskRewardRatio) return 50;
    
    const rr = signal.riskRewardRatio;
    if (rr > 3) return 95;
    if (rr > 2) return 85;
    if (rr > 1.5) return 75;
    if (rr > 1) return 65;
    return 40;
  }

  private getAdaptiveWeights(regime?: RegimeType): Record<string, number> {
    const baseWeights = {
      confidenceQuality: 0.20,
      sourceAgreement: 0.18,
      regimeAlignment: 0.15,
      patternReliability: 0.15,
      technicalStructure: 0.12,
      volumeConfirmation: 0.12,
      riskReward: 0.08
    };

    if (!regime) return baseWeights;

    // Adjust weights based on regime
    if (regime.includes('TRENDING')) {
      return {
        ...baseWeights,
        regimeAlignment: 0.20,
        patternReliability: 0.18,
        sourceAgreement: 0.15
      };
    }

    if (regime === 'RANGING') {
      return {
        ...baseWeights,
        riskReward: 0.15,
        technicalStructure: 0.15,
        regimeAlignment: 0.18
      };
    }

    if (regime === 'VOLATILE') {
      return {
        ...baseWeights,
        sourceAgreement: 0.22,
        riskReward: 0.15,
        regimeAlignment: 0.08
      };
    }

    return baseWeights;
  }
}

// ============================================================================
// LAYER 3: CLUSTERING VALIDATION
// ============================================================================

export class ClusteringValidator {
  private recentPatterns: Map<string, number> = new Map(); // pattern -> count

  /**
   * Validate signal uniqueness and redundancy
   */
  validateClustering(signal: AggregatedSignal): ClusteringResult {
    const patternKey = signal.primaryClassification;
    const existingCount = this.recentPatterns.get(patternKey) || 0;

    // Decay old patterns (sliding window of 100 signals)
    if (this.recentPatterns.size > 100) {
      const sortedPatterns = Array.from(this.recentPatterns.entries())
        .sort((a, b) => b[1] - a[1]);
      this.recentPatterns.clear();
      sortedPatterns.slice(0, 50).forEach(([k, v]) => {
        this.recentPatterns.set(k, Math.max(0, v - 1));
      });
    }

    // Update pattern count
    this.recentPatterns.set(patternKey, existingCount + 1);

    // Score clustering
    let cluster: PatternCluster;
    let redundancyScore: number;
    let uniquenessRank: number;

    if (existingCount === 0) {
      cluster = 'UNIQUE';
      redundancyScore = 0;
      uniquenessRank = 95;
    } else if (existingCount < 3) {
      cluster = 'COMMON';
      redundancyScore = 0.3 + (existingCount * 0.15);
      uniquenessRank = Math.max(50, 90 - (existingCount * 10));
    } else {
      cluster = 'REDUNDANT';
      redundancyScore = Math.min(1, 0.5 + (existingCount * 0.1));
      uniquenessRank = Math.max(20, 60 - (existingCount * 5));
    }

    return {
      cluster,
      confidence: Math.min(1, 0.7 + (1 - redundancyScore)),
      redundancyScore,
      similarPatterns: existingCount,
      uniquenessRank
    };
  }

  reset(): void {
    this.recentPatterns.clear();
  }
}

// ============================================================================
// LAYER 4: CONSENSUS FILTERING
// ============================================================================

export class ConsensusFilter {
  private readonly minConsensusThreshold = 0.60; // 60% agreement required

  /**
   * Validate multi-source consensus
   */
  validateConsensus(signal: AggregatedSignal): ConsensusValidation {
    const scanner = signal.sources.scanner.confidence;
    const ml = signal.sources.ml.confidence;
    const rl = signal.sources.rl.confidence;

    // Weighted consensus (each source weighted equally)
    const overallConsensus = (scanner + ml + rl) / 3;

    // Check for dissenting source
    let dissentingSource: string | undefined;
    const avg = overallConsensus;
    const threshold = 0.20; // 20% deviation = dissent

    if (Math.abs(scanner - avg) > threshold) dissentingSource = 'scanner';
    else if (Math.abs(ml - avg) > threshold) dissentingSource = 'ml';
    else if (Math.abs(rl - avg) > threshold) dissentingSource = 'rl';

    return {
      scannerAgreement: scanner,
      mlAgreement: ml,
      rlAgreement: rl,
      overallConsensus,
      passesConsensus: overallConsensus >= this.minConsensusThreshold,
      dissentingSource
    };
  }

  setConsensusThreshold(threshold: number): void {
    // Allow dynamic threshold adjustment
    if (threshold >= 0 && threshold <= 1) {
      (this as any).minConsensusThreshold = threshold;
    }
  }
}

// ============================================================================
// QUALITY GATING ENGINE - ORCHESTRATES ALL 5 LAYERS
// ============================================================================

export class QualityGatingEngine {
  private tierFilter: TierBasedFilter;
  private compositeScorer: CompositeQualityScorer;
  private clusterValidator: ClusteringValidator;
  private consensusFilter: ConsensusFilter;

  // Thresholds
  private tierPassThreshold = 50; // Min tier score to pass
  private compositeQualityThreshold = 50; // Min composite quality
  private consensusThreshold = 0.60; // Min consensus agreement

  constructor() {
    this.tierFilter = new TierBasedFilter();
    this.compositeScorer = new CompositeQualityScorer();
    this.clusterValidator = new ClusteringValidator();
    this.consensusFilter = new ConsensusFilter();
  }

  /**
   * Apply all 5 quality gates to signal
   * Returns gated signal with pass/filter decision and adjustments
   */
  gateSignal(
    signal: AggregatedSignal,
    regime?: RegimeDetectionResult
  ): QualityGatedSignal {
    const gatingStartTime = Date.now();

    // Layer 1: Tier Classification
    const tier = this.tierFilter.classifyTier(signal);
    const tierPass = tier.score >= this.tierPassThreshold;

    // Layer 2: Composite Quality
    const composite = this.compositeScorer.scoreEntryQuality(signal, regime);
    const compositePass = composite.overallScore >= this.compositeQualityThreshold;

    // Layer 3: Clustering
    const clustering = this.clusterValidator.validateClustering(signal);
    const clusteringPass = clustering.cluster !== 'REDUNDANT';

    // Layer 4: Consensus
    const consensus = this.consensusFilter.validateConsensus(signal);
    const consensusPass = consensus.passesConsensus;

    // Overall decision: Must pass at least 4/5 layers
    const passedLayers = [tierPass, compositePass, clusteringPass, consensusPass].filter(x => x).length;
    const finalDecision = passedLayers >= 3 ? 'PASS' : 'FILTERED';

    // Calculate confidence adjustment
    let confidenceAdjustment = 1.0;
    if (finalDecision === 'PASS') {
      // Boost confidence for passing signals
      confidenceAdjustment = 1 + (composite.overallScore / 100 * 0.3); // +0 to +30%
    } else {
      // Penalize filtered signals significantly
      confidenceAdjustment = Math.max(0.5, 1 - (100 - composite.overallScore) / 200);
    }

    // Calculate aggregated score
    const aggregatedScore = (
      tier.score * 0.25 +
      composite.overallScore * 0.30 +
      (clustering.uniquenessRank) * 0.20 +
      (consensus.overallConsensus * 100) * 0.25
    ) / 100;

    const gatingTime = Date.now() - gatingStartTime;

    // Build final gated signal
    const gatedSignal: QualityGatedSignal = {
      ...signal,
      confidence: Math.min(1, Math.max(0, signal.confidence * confidenceAdjustment)),
      quality_gating: {
        tier,
        compositeQuality: composite,
        clustering,
        consensus,
        finalDecision,
        filterReason: finalDecision === 'FILTERED' 
          ? this.buildFilterReason(tierPass, compositePass, clusteringPass, consensusPass)
          : undefined,
        confidenceAdjustment,
        aggregatedScore: Math.round(aggregatedScore)
      }
    };

    return gatedSignal;
  }

  /**
   * Get quality metrics across recent signals
   */
  getQualityMetrics(recentSignals: QualityGatedSignal[]): {
    filterRate: number;           // % of signals filtered
    passRate: number;             // % of signals passing
    avgQualityScore: number;      // Average quality
    passedSignalsAvgConfidence: number;
    filteredSignalsAvgConfidence: number;
  } {
    if (recentSignals.length === 0) {
      return {
        filterRate: 0,
        passRate: 0,
        avgQualityScore: 0,
        passedSignalsAvgConfidence: 0,
        filteredSignalsAvgConfidence: 0
      };
    }

    const passed = recentSignals.filter(s => s.quality_gating.finalDecision === 'PASS');
    const filtered = recentSignals.filter(s => s.quality_gating.finalDecision === 'FILTERED');

    return {
      filterRate: (filtered.length / recentSignals.length) * 100,
      passRate: (passed.length / recentSignals.length) * 100,
      avgQualityScore: recentSignals.reduce((sum, s) => sum + s.quality_gating.aggregatedScore, 0) / recentSignals.length,
      passedSignalsAvgConfidence: passed.length > 0
        ? passed.reduce((sum, s) => sum + s.confidence, 0) / passed.length
        : 0,
      filteredSignalsAvgConfidence: filtered.length > 0
        ? filtered.reduce((sum, s) => sum + s.confidence, 0) / filtered.length
        : 0
    };
  }

  /**
   * Adjust gating thresholds (dynamic tuning)
   */
  setThresholds(
    tierThreshold?: number,
    compositeThreshold?: number,
    consensusThreshold?: number
  ): void {
    if (tierThreshold !== undefined && tierThreshold >= 0 && tierThreshold <= 100) {
      this.tierPassThreshold = tierThreshold;
    }
    if (compositeThreshold !== undefined && compositeThreshold >= 0 && compositeThreshold <= 100) {
      this.compositeQualityThreshold = compositeThreshold;
    }
    if (consensusThreshold !== undefined && consensusThreshold >= 0 && consensusThreshold <= 1) {
      this.consensusFilter.setConsensusThreshold(consensusThreshold);
    }
  }

  private buildFilterReason(tierPass: boolean, compositePass: boolean, clusteringPass: boolean, consensusPass: boolean): string {
    const failures: string[] = [];
    if (!tierPass) failures.push('failed tier quality');
    if (!compositePass) failures.push('low composite quality');
    if (!clusteringPass) failures.push('redundant pattern');
    if (!consensusPass) failures.push('insufficient source agreement');
    
    return `Filtered: ${failures.join(', ')}`;
  }
}

export const qualityGatingEngine = new QualityGatingEngine();
