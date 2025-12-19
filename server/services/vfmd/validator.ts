/**
 * VFMD Validator - Quantitative Proof System
 * 
 * Validates that core physics calculations actually predict market behavior
 * Critical: If validation FAILS, your field construction is broken
 */

import type { MarketTick, PhysicsMetrics } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

/**
 * Validation results for each critical test
 */
export interface ValidationResult {
  testName: string;
  passed: boolean;
  confidence: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  metrics: Record<string, number>;
  description: string;
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  timestamp: number;
  totalTests: number;
  passedTests: number;
  overallStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  confidence: number; // 0-1, how confident we are in the system
  results: ValidationResult[];
}

/**
 * Breakdown of performance by regime
 */
export interface RegimePerformance {
  regime: string;
  occurrences: number;
  avgMetric: number;
  minMetric: number;
  maxMetric: number;
  predictiveness: number; // 0-1, correlation with outcome
}

export class VFMDValidator {
  /**
   * CRITICAL TEST 1: PEG Predictiveness
   *
   * Does PEG spike 5-15 bars BEFORE breakouts?
   * This is the fundamental claim of VFMD
   *
   * Validation: Find historical breakouts, check if PEG peaked beforehand
   */
  static validatePEGPredictiveness(
    historicalData: MarketTick[],
    knownBreakouts: { barIndex: number; direction: 'up' | 'down' }[]
  ): ValidationResult {
    if (knownBreakouts.length === 0) {
      return {
        testName: 'PEG Predictiveness',
        passed: false,
        confidence: 'INCONCLUSIVE',
        metrics: { breakoutsAnalyzed: 0 },
        description: 'No known breakouts provided for validation'
      };
    }

    const results: {
      leadBars: number[];
      pegSpiked: boolean[];
      magnitude: number[];
    } = {
      leadBars: [],
      pegSpiked: [],
      magnitude: []
    };

    // Analyze each known breakout
    for (const breakout of knownBreakouts) {
      if (breakout.barIndex < 50) continue; // Need history

      // Get 50 bars before breakout for PEG analysis
      const window = historicalData.slice(
        Math.max(0, breakout.barIndex - 50),
        breakout.barIndex
      );

      if (window.length < 30) continue;

      try {
        // Compute PEG for each bar in lead-up
        const pegValues: { bar: number; peg: number }[] = [];

        for (let i = 20; i < window.length; i++) {
          const subwindow = window.slice(0, i + 1);
          const closes = subwindow.map(t => t.close);
          const field = FieldConstructor.constructField(closes);
          const peg = PhysicsCalculator.computePEG(field, 10);
          pegValues.push({
            bar: i,
            peg
          });
        }

        if (pegValues.length === 0) continue;

        // Find peak PEG in lead-up
        const maxPEG = Math.max(...pegValues.map(p => p.peg));
        const maxPegBar = pegValues.findIndex(p => p.peg === maxPEG);
        const barsToPeak = pegValues.length - maxPegBar;

        // Expected: PEG peaks 5-15 bars before breakout
        const peakInExpectedRange = barsToPeak >= 5 && barsToPeak <= 15;
        const pegSpikeFactor = maxPEG / (pegValues[0]?.peg || 1);

        results.leadBars.push(barsToPeak);
        results.pegSpiked.push(pegSpikeFactor > 1.5); // At least 50% spike
        results.magnitude.push(pegSpikeFactor);
      } catch (e) {
        // Skip malformed data
        continue;
      }
    }

    if (results.leadBars.length === 0) {
      return {
        testName: 'PEG Predictiveness',
        passed: false,
        confidence: 'INCONCLUSIVE',
        metrics: {
          breakoutsAnalyzed: knownBreakouts.length,
          validBreakouts: 0
        },
        description: 'Unable to analyze any breakouts (insufficient data)'
      };
    }

    // Calculate statistics
    const successRate = results.pegSpiked.filter(x => x).length / results.pegSpiked.length;
    const avgLeadBars = results.leadBars.reduce((a, b) => a + b, 0) / results.leadBars.length;
    const avgMagnitude = results.magnitude.reduce((a, b) => a + b, 0) / results.magnitude.length;

    const passed = successRate > 0.65 && avgLeadBars > 4 && avgLeadBars < 20;

    return {
      testName: 'PEG Predictiveness',
      passed,
      confidence: passed ? 'PASS' : successRate > 0.55 ? 'INCONCLUSIVE' : 'FAIL',
      metrics: {
        successRate: Number(successRate.toFixed(2)),
        avgLeadBars: Number(avgLeadBars.toFixed(1)),
        avgMagnitude: Number(avgMagnitude.toFixed(2)),
        breakoutsAnalyzed: results.pegSpiked.length
      },
      description: `PEG peaks ${(successRate * 100).toFixed(0)}% of time, ${avgLeadBars.toFixed(1)} bars before breakout (expect 5-15)`
    };
  }

  /**
   * CRITICAL TEST 2: Turbulence Index Detection
   *
   * Is TI high during choppy/ranging periods and low during trends?
   * This validates that TI actually measures market chaos
   */
  static validateTurbulenceDetection(
    historicalData: MarketTick[],
    chopPeriods: { startBar: number; endBar: number }[],
    trendPeriods: { startBar: number; endBar: number }[]
  ): ValidationResult {
    const results: {
      chopTI: number[];
      trendTI: number[];
    } = {
      chopTI: [],
      trendTI: []
    };

    // Analyze TI in choppy periods
    for (const period of chopPeriods) {
      if (period.endBar > historicalData.length || period.startBar < 20) continue;

      const window = historicalData.slice(period.startBar, period.endBar);
      const closes = window.map(t => t.close);

      try {
        const field = FieldConstructor.constructField(closes);
        const ti = PhysicsCalculator.computeTurbulenceIndex(field, 10);
        results.chopTI.push(ti);
      } catch (e) {
        continue;
      }
    }

    // Analyze TI in trending periods
    for (const period of trendPeriods) {
      if (period.endBar > historicalData.length || period.startBar < 20) continue;

      const window = historicalData.slice(period.startBar, period.endBar);
      const closes = window.map(t => t.close);

      try {
        const field = FieldConstructor.constructField(closes);
        const ti = PhysicsCalculator.computeTurbulenceIndex(field, 10);
        results.trendTI.push(ti);
      } catch (e) {
        continue;
      }
    }

    if (results.chopTI.length === 0 || results.trendTI.length === 0) {
      return {
        testName: 'Turbulence Detection',
        passed: false,
        confidence: 'INCONCLUSIVE',
        metrics: {
          chopPeriodsAnalyzed: results.chopTI.length,
          trendPeriodsAnalyzed: results.trendTI.length
        },
        description: 'Insufficient data to validate turbulence detection'
      };
    }

    const avgChopTI = results.chopTI.reduce((a, b) => a + b, 0) / results.chopTI.length;
    const avgTrendTI = results.trendTI.reduce((a, b) => a + b, 0) / results.trendTI.length;
    const ratio = avgChopTI / (avgTrendTI || 0.001);

    // Expected: Chop TI should be 2-3x trend TI
    const passed = ratio > 1.8 && avgChopTI > 1.0;

    return {
      testName: 'Turbulence Detection',
      passed,
      confidence: passed ? 'PASS' : ratio > 1.5 ? 'INCONCLUSIVE' : 'FAIL',
      metrics: {
        avgChopTI: Number(avgChopTI.toFixed(2)),
        avgTrendTI: Number(avgTrendTI.toFixed(2)),
        ratio: Number(ratio.toFixed(2)),
        chopPeriodsAnalyzed: results.chopTI.length,
        trendPeriodsAnalyzed: results.trendTI.length
      },
      description: `TI is ${ratio.toFixed(1)}x higher in chop vs trends (expect >1.8x)`
    };
  }

  /**
   * CRITICAL TEST 3: Coherence Detection
   *
   * Is coherence high during trends and low during ranges?
   * Validates field alignment measurement
   */
  static validateCoherence(
    historicalData: MarketTick[],
    trendPeriods: { startBar: number; endBar: number }[],
    rangePeriods: { startBar: number; endBar: number }[]
  ): ValidationResult {
    const results: {
      trendCoherence: number[];
      rangeCoherence: number[];
    } = {
      trendCoherence: [],
      rangeCoherence: []
    };

    // Analyze coherence in trending periods
    for (const period of trendPeriods) {
      if (period.endBar > historicalData.length || period.startBar < 20) continue;

      const window = historicalData.slice(period.startBar, period.endBar);
      const closes = window.map(t => t.close);

      try {
        const field = FieldConstructor.constructField(closes);
        const metrics = PhysicsCalculator.computeAllMetrics(field);
        results.trendCoherence.push(metrics.coherenceScore);
      } catch (e) {
        continue;
      }
    }

    // Analyze coherence in ranging periods
    for (const period of rangePeriods) {
      if (period.endBar > historicalData.length || period.startBar < 20) continue;

      const window = historicalData.slice(period.startBar, period.endBar);
      const closes = window.map(t => t.close);

      try {
        const field = FieldConstructor.constructField(closes);
        const metrics = PhysicsCalculator.computeAllMetrics(field);
        results.rangeCoherence.push(metrics.coherenceScore);
      } catch (e) {
        continue;
      }
    }

    if (results.trendCoherence.length === 0 || results.rangeCoherence.length === 0) {
      return {
        testName: 'Coherence Detection',
        passed: false,
        confidence: 'INCONCLUSIVE',
        metrics: {
          trendPeriodsAnalyzed: results.trendCoherence.length,
          rangePeriodsAnalyzed: results.rangeCoherence.length
        },
        description: 'Insufficient data to validate coherence detection'
      };
    }

    const avgTrendCoherence =
      results.trendCoherence.reduce((a, b) => a + b, 0) / results.trendCoherence.length;
    const avgRangeCoherence =
      results.rangeCoherence.reduce((a, b) => a + b, 0) / results.rangeCoherence.length;

    // Expected: Trend coherence > 0.6, Range coherence < 0.4
    const passed = avgTrendCoherence > 0.55 && avgRangeCoherence < 0.45;

    return {
      testName: 'Coherence Detection',
      passed,
      confidence: passed ? 'PASS' : avgTrendCoherence > 0.50 ? 'INCONCLUSIVE' : 'FAIL',
      metrics: {
        avgTrendCoherence: Number(avgTrendCoherence.toFixed(2)),
        avgRangeCoherence: Number(avgRangeCoherence.toFixed(2)),
        difference: Number((avgTrendCoherence - avgRangeCoherence).toFixed(2)),
        trendPeriodsAnalyzed: results.trendCoherence.length,
        rangePeriodsAnalyzed: results.rangeCoherence.length
      },
      description: `Trend coherence ${avgTrendCoherence.toFixed(2)} vs range ${avgRangeCoherence.toFixed(2)} (expect 0.6 vs 0.4)`
    };
  }

  /**
   * Run all validation tests
   */
  static async validateAll(
    historicalData: MarketTick[],
    knownBreakouts: { barIndex: number; direction: 'up' | 'down' }[],
    chopPeriods: { startBar: number; endBar: number }[],
    trendPeriods: { startBar: number; endBar: number }[],
    rangePeriods: { startBar: number; endBar: number }[]
  ): Promise<ValidationReport> {
    const results: ValidationResult[] = [];

    // Run critical tests
    results.push(this.validatePEGPredictiveness(historicalData, knownBreakouts));
    results.push(
      this.validateTurbulenceDetection(historicalData, chopPeriods, trendPeriods)
    );
    results.push(this.validateCoherence(historicalData, trendPeriods, rangePeriods));

    // Tally results
    const passedTests = results.filter(r => r.passed).length;
    const passCount = results.filter(r => r.confidence === 'PASS').length;
    const failCount = results.filter(r => r.confidence === 'FAIL').length;

    let overallStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
    let confidence: number;

    if (failCount > 0) {
      overallStatus = 'FAIL';
      confidence = 0.2;
    } else if (passCount === results.length) {
      overallStatus = 'PASS';
      confidence = 0.9;
    } else {
      overallStatus = 'INCONCLUSIVE';
      confidence = 0.5;
    }

    return {
      timestamp: Date.now(),
      totalTests: results.length,
      passedTests,
      overallStatus,
      confidence,
      results
    };
  }

  /**
   * Generate human-readable validation report
   */
  static formatReport(report: ValidationReport): string {
    const lines = [
      `\n${'='.repeat(60)}`,
      `VFMD VALIDATION REPORT - ${new Date(report.timestamp).toISOString()}`,
      `${'='.repeat(60)}`,
      `\nOverall Status: ${report.overallStatus}`,
      `Confidence: ${(report.confidence * 100).toFixed(0)}%`,
      `Tests Passed: ${report.passedTests}/${report.totalTests}`,
      `\n${'-'.repeat(60)}\nTEST RESULTS\n${'-'.repeat(60)}`
    ];

    for (const result of report.results) {
      lines.push(
        `\n✓ ${result.testName} [${result.confidence}]`,
        `  ${result.description}`,
        `  Metrics: ${JSON.stringify(result.metrics)}`
      );
    }

    lines.push(`\n${'='.repeat(60)}\n`);
    return lines.join('\n');
  }
}
