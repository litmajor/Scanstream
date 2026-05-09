/**
 * REGIME MIGRATION VALIDATOR - PHASE 2 SUPPORT
 * 
 * Validates that existing detector systems produce consistent results.
 * Generates compatibility reports and identifies divergence patterns.
 * 
 * Run with: node build/unified-regime-validator.js --detector=<detectorName> --period=7d
 */

import {
  UnifiedRegimeDetector,
  type UnifiedRegimeType,
  type RegimeDetectionResult,
} from './unified-regime-system';
import { RegimeConsolidationBridge } from './regime-consolidation-bridge';

export interface DetectorSample {
  timestamp: number;
  detector: string;
  regime: string;
  confidence?: number;
  signal?: any;
}

export interface ValidationReport {
  detector: string;
  period: string;
  totalSamples: number;
  mappedAccuracy: number;
  consistencyScore: number;
  divergences: {
    timestamp: number;
    expected: string;
    actual: string;
    confidence: number;
    reason?: string;
  }[];
  characteristics: {
    regime: string;
    avgConfidence: number;
    frequency: number;
  }[];
  recommendations: string[];
}

export class RegimeMigrationValidator {
  private static readonly MINIMUM_CONFIDENCE = 0.6;
  private static readonly ACCURACY_THRESHOLD = 0.95;

  /**
   * Validate detector output against unified system expectations
   */
  static validateDetectorOutput(
    samples: DetectorSample[],
    detectorName: string
  ): ValidationReport {
    const divergences: ValidationReport['divergences'] = [];
    const regimeStats = new Map<string, { count: number; totalConfidence: number }>();
    let mappedCorrectly = 0;

    // System name to detector type mapping
    const source = this.normalizeDetectorName(detectorName);

    for (const sample of samples) {
      try {
        // Map legacy regime to unified
        const unified = UnifiedRegimeDetector.mapToUnified(sample.regime, source);

        // Simulate detection with the unified system
        // In real scenario, would have actual market data
        if (sample.regime !== unified && sample.confidence !== undefined) {
          if (sample.confidence >= this.MINIMUM_CONFIDENCE) {
            mappedCorrectly++;
          } else {
            divergences.push({
              timestamp: sample.timestamp,
              expected: sample.regime,
              actual: unified,
              confidence: sample.confidence || 0,
              reason: `Low confidence mapping: ${sample.regime} → ${unified}`,
            });
          }
        } else {
          mappedCorrectly++;
        }

        // Track regime frequency and average confidence
        const key = unified;
        const stat = regimeStats.get(key) || { count: 0, totalConfidence: 0 };
        stat.count++;
        stat.totalConfidence += sample.confidence || 0.5;
        regimeStats.set(key, stat);
      } catch (error) {
        divergences.push({
          timestamp: sample.timestamp,
          expected: sample.regime,
          actual: 'ERROR',
          confidence: 0,
          reason: `Mapping error: ${String(error)}`,
        });
      }
    }

    const mappedAccuracy = samples.length > 0 ? mappedCorrectly / samples.length : 0;
    const consistencyScore = this.calculateConsistencyScore(samples);
    const characteristics = this.buildCharacteristicsReport(regimeStats);
    const recommendations = this.generateRecommendations(
      mappedAccuracy,
      consistencyScore,
      divergences,
      detectorName
    );

    return {
      detector: detectorName,
      period: this.formatPeriod(samples),
      totalSamples: samples.length,
      mappedAccuracy,
      consistencyScore,
      divergences,
      characteristics,
      recommendations,
    };
  }

  /**
   * Compare outputs from two detectors on same market data
   */
  static compareDetectors(
    samples1: DetectorSample[],
    samples2: DetectorSample[]
  ): {
    agreement: number;
    divergences: number;
    conflictDetails: Array<{
      timestamp: number;
      detector1Name: string;
      detector1Regime: string;
      detector2Name: string;
      detector2Regime: string;
      unifiedRegime: string;
    }>;
  } {
    const conflicts: Array<{
      timestamp: number;
      detector1Name: string;
      detector1Regime: string;
      detector2Name: string;
      detector2Regime: string;
      unifiedRegime: string;
    }> = [];

    let agreement = 0;
    let compared = 0;

    // Create map by timestamp for alignment
    const map1 = new Map(samples1.map((s) => [s.timestamp, s]));
    const map2 = new Map(samples2.map((s) => [s.timestamp, s]));

    for (const [timestamp, sample1] of map1) {
      const sample2 = map2.get(timestamp);
      if (!sample2) continue;

      const unified1 = UnifiedRegimeDetector.mapToUnified(
        sample1.regime,
        this.normalizeDetectorName(sample1.detector)
      );
      const unified2 = UnifiedRegimeDetector.mapToUnified(
        sample2.regime,
        this.normalizeDetectorName(sample2.detector)
      );

      compared++;

      if (unified1 === unified2) {
        agreement++;
      } else {
        conflicts.push({
          timestamp,
          detector1Name: sample1.detector,
          detector1Regime: sample1.regime,
          detector2Name: sample2.detector,
          detector2Regime: sample2.regime,
          unifiedRegime: unified1, // Report unified view
        });
      }
    }

    return {
      agreement: compared > 0 ? agreement / compared : 0,
      divergences: conflicts.length,
      conflictDetails: conflicts,
    };
  }

  /**
   * Generate side-by-side migration checklist
   */
  static generateMigrationChecklist(detectorName: string): string[] {
    const normalizedName = this.normalizeDetectorName(detectorName);

    const baseChecklist = [
      '✓ Create backup of original detector logic',
      '✓ Document all input parameters to detection method',
      '✓ Identify mapping from detector outputs to unified regimes',
      '✓ Set up parallel execution (old + new)',
      '✓ Run validation suite on historical data',
      '✓ Configure divergence threshold for alerts',
      '✓ Plan gradual rollout (start with read-only)',
    ];

    const detectorSpecific = this.getDetectorSpecificSteps(normalizedName);

    return [...baseChecklist, ...detectorSpecific];
  }

  /**
   * Generate pre-migration audit
   */
  static generatePreMigrationAudit(
    detectorName: string,
    recentSamples: DetectorSample[]
  ): {
    readiness: 'GO' | 'CAUTION' | 'NO_GO';
    score: number;
    issues: string[];
    ready: boolean;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check sample size
    if (recentSamples.length < 100) {
      issues.push(
        `Insufficient samples (${recentSamples.length} < 100). Need more historical data.`
      );
      score -= 20;
    }

    // Check confidence levels
    const avgConfidence =
      recentSamples.reduce((sum, s) => sum + (s.confidence || 0.5), 0) /
      recentSamples.length;
    if (avgConfidence < 0.7) {
      issues.push(
        `Low average confidence (${avgConfidence.toFixed(2)}). Consider threshold adjustment.`
      );
      score -= 15;
    }

    // Check regime diversity
    const regimes = new Set(recentSamples.map((s) => s.regime));
    if (regimes.size < 3) {
      issues.push(
        `Limited regime diversity (${regimes.size} regimes). Increase sample period.`
      );
      score -= 10;
    }

    // Validate all regimes can be mapped
    const unmappable = recentSamples.filter((s) => {
      try {
        const source = this.normalizeDetectorName(detectorName);
        UnifiedRegimeDetector.mapToUnified(s.regime, source);
        return false;
      } catch {
        return true;
      }
    });

    if (unmappable.length > 0) {
      issues.push(
        `${unmappable.length} samples cannot be mapped to unified system. Review mapping tables.`
      );
      score -= 25;
    }

    const readiness = score >= 80 ? 'GO' : score >= 60 ? 'CAUTION' : 'NO_GO';

    return {
      readiness,
      score,
      issues,
      ready: readiness === 'GO',
    };
  }

  // Private helper methods

  private static normalizeDetectorName(
    name: string
  ): 'vfmd' | 'scanner' | 'ml' | 'router' | 'velocity' | 'assessment' | 'generic' {
    const normalized = name.toLowerCase();

    if (normalized.includes('vfmd')) return 'vfmd';
    if (normalized.includes('scanner')) return 'scanner';
    if (normalized.includes('ml')) return 'ml';
    if (normalized.includes('router')) return 'router';
    if (normalized.includes('velocity')) return 'velocity';
    if (normalized.includes('assessment')) return 'assessment';

    return 'generic';
  }

  private static calculateConsistencyScore(samples: DetectorSample[]): number {
    if (samples.length < 2) return 0.5;

    let transitions = 0;
    let totalTransitions = 0;

    for (let i = 1; i < samples.length; i++) {
      if (samples[i].regime !== samples[i - 1].regime) {
        totalTransitions++;
        // Large transitions are less consistent
        const currConf = samples[i].confidence ?? 0.5;
        const prevConf = samples[i - 1].confidence ?? 0.5;
        if (Math.abs(currConf - prevConf) > 0.3) {
          transitions++;
        }
      }
    }

    // Score: fewer large conviction swings = higher consistency
    const swingRatio = transitions / Math.max(1, totalTransitions);
    return Math.max(0, 1 - swingRatio);
  }

  private static buildCharacteristicsReport(
    regimeStats: Map<string, { count: number; totalConfidence: number }>
  ): ValidationReport['characteristics'] {
    const report: ValidationReport['characteristics'] = [];

    for (const [regime, stat] of regimeStats) {
      report.push({
        regime,
        avgConfidence: stat.totalConfidence / stat.count,
        frequency: stat.count,
      });
    }

    return report.sort((a, b) => b.frequency - a.frequency);
  }

  private static generateRecommendations(
    accuracy: number,
    consistency: number,
    divergences: Array<any>,
    detector: string
  ): string[] {
    const recommendations: string[] = [];

    if (accuracy < 0.9) {
      recommendations.push(
        `⚠ Mapping accuracy is ${(accuracy * 100).toFixed(1)}%. Review divergence patterns.`
      );
    }

    if (consistency < 0.7) {
      recommendations.push(`⚠ Low consistency score (${consistency.toFixed(2)}). Expect signal noise.`);
    }

    if (divergences.length > 0) {
      recommendations.push(
        `📋 Found ${divergences.length} divergences. See details for patterns.`
      );

      // Analyze patterns
      const reasons = divergences
        .map((d) => d.reason)
        .filter((r) => r)
        .reduce(
          (acc, r) => {
            acc[r as string] = (acc[r as string] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      for (const [reason, count] of Object.entries(reasons)) {
        recommendations.push(`  → ${reason}: ${count} occurrences`);
      }
    }

    if (accuracy >= 0.95 && consistency >= 0.8) {
      recommendations.push(
        `✅ Ready for production migration. ${detector} maps cleanly to unified system.`
      );
    } else {
      recommendations.push(
        `🔄 Consider additional tuning before full migration. Run extended validation.`
      );
    }

    return recommendations;
  }

  private static getDetectorSpecificSteps(
    source: 'vfmd' | 'scanner' | 'ml' | 'router' | 'velocity' | 'assessment' | 'generic'
  ): string[] {
    switch (source) {
      case 'vfmd':
        return [
          '📊 Test VFMD compatibility wrapper in VFMDPhysicsAgent',
          '⚙ Verify LAMINAR_TREND/LOW_VOLUME mapping',
          '✓ Confirm backward compatibility output format',
        ];
      case 'scanner':
        return [
          '📊 Test scanner bull/bear/ranging mappings',
          '⚙ Verify signal integration with ScannerAgent',
          '✓ Check for any custom regime extensions',
        ];
      case 'ml':
        return [
          '📊 Test ML model predictions with unified regimes',
          '⚙ Verify confidence weighting still applicable',
          '✓ Ensure no model retraining required',
        ];
      case 'router':
        return [
          '📊 Test signal routing logic with new regime system',
          '⚙ Verify weighting formulas use unified regimes',
          '✓ Check threshold adjustments needed',
        ];
      case 'velocity':
        return [
          '📊 Test velocity signals with new regime mapping',
          '⚙ Verify momentum calculation still valid',
          '✓ Check for any velocity-specific extensions',
        ];
      case 'assessment':
        return [
          '📊 Test assessment scoring logic',
          '⚙ Verify all indicators map to unified system',
          '✓ Check for non-standard regime types',
        ];
      default:
        return ['📊 Generic detector - verify all mappings manually'];
    }
  }

  private static formatPeriod(samples: DetectorSample[]): string {
    if (samples.length === 0) return 'N/A';

    const timestamps = samples.map((s) => s.timestamp).sort((a, b) => a - b);
    const start = new Date(timestamps[0]);
    const end = new Date(timestamps[timestamps.length - 1]);
    const daysSpan = Math.round(
      (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
    );

    return `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (${daysSpan}d)`;
  }
}

/**
 * Export for CLI usage
 */
export default RegimeMigrationValidator;
