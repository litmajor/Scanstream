/**
 * PEG Volatility Debugger
 * 
 * Your PEG volatility prediction has 0% accuracy (71/71 false positives).
 * This debugger identifies WHY the calculation is failing.
 * 
 * Possible bugs:
 * 1. Volatility calculation is wrong
 * 2. Baseline window is too short/long
 * 3. Future window doesn't capture volatility spikes
 * 4. Threshold (1.5x) is wrong for daily data
 * 5. PEG values are inverted or normalized incorrectly
 */

import { MarketTick } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

interface VolatilityDebugResult {
  index: number;
  timestamp: number;
  peg: number;
  baselineVol: number;
  futureVol: number;
  volRatio: number;
  expected: boolean; // Should volatility spike?
  actual: boolean;   // Did volatility spike?
  error: string;     // Why it failed
}

export class PEGVolatilityDebugger {
  private fieldConstructor: FieldConstructor;

  constructor() {
    this.fieldConstructor = new FieldConstructor(50, 100);
  }

  /**
   * Deep dive into PEG volatility failures
   * 
   * For each PEG spike, diagnose why volatility didn't follow
   */
  async debugVolatilityFailures(
    ticks: MarketTick[],
    pegThreshold: number = 2.0,
    volThreshold: number = 1.5
  ): Promise<{
    failures: VolatilityDebugResult[];
    rootCause: string;
    recommendations: string[];
  }> {
    
    console.log('🔍 DEBUGGING PEG VOLATILITY FAILURES...');
    console.log('='.repeat(70));
    console.log(`PEG Threshold: ${pegThreshold}`);
    console.log(`Volatility Threshold: ${volThreshold}x`);
    console.log('');

    const failures: VolatilityDebugResult[] = [];

    for (let i = 100; i < ticks.length - 20; i++) {
      const window = ticks.slice(i - 100, i);
      const prices = window.map(t => t.close);
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);
      
      // Check if PEG triggered
      if (metrics.peg > pegThreshold) {
        // Calculate baseline volatility
        const baselineVol = this.calculateVolatility(
          ticks.slice(i - 20, i)
        );
        
        // Calculate future volatility
        const futureVol = this.calculateVolatility(
          ticks.slice(i, i + 10)
        );
        
        const volRatio = futureVol / (baselineVol + 1e-8);
        const expected = true; // PEG says vol should spike
        const actual = volRatio > volThreshold;
        
        if (!actual) {
          // This is a failure - diagnose why
          const error = this.diagnoseFailure(
            metrics.peg,
            baselineVol,
            futureVol,
            volRatio,
            ticks.slice(i - 10, i + 10)
          );
          
          failures.push({
            index: i,
            timestamp: ticks[i].timestamp,
            peg: metrics.peg,
            baselineVol,
            futureVol,
            volRatio,
            expected,
            actual,
            error
          });
        }
      }
    }

    // Analyze failure patterns
    const rootCause = this.identifyRootCause(failures);
    const recommendations = this.generateRecommendations(rootCause, failures);

    this.printDebugReport(failures, rootCause, recommendations);

    return {
      failures,
      rootCause,
      recommendations
    };
  }

  /**
   * Diagnose why a single PEG signal failed
   */
  private diagnoseFailure(
    peg: number,
    baselineVol: number,
    futureVol: number,
    volRatio: number,
    context: MarketTick[]
  ): string {
    const errors: string[] = [];

    // Check 1: Is baseline volatility too high?
    if (baselineVol > 0.02) {
      errors.push('HIGH_BASELINE_VOL');
    }

    // Check 2: Is future volatility measured correctly?
    if (futureVol < 0.001) {
      errors.push('ZERO_FUTURE_VOL');
    }

    // Check 3: Is the price actually moving?
    const priceRange = Math.max(...context.map(t => t.high)) - 
                       Math.min(...context.map(t => t.low));
    const avgPrice = context.reduce((sum, t) => sum + t.close, 0) / context.length;
    const rangePct = priceRange / avgPrice;
    
    if (rangePct < 0.01) {
      errors.push('LOW_PRICE_MOVEMENT');
    }

    // Check 4: Is vol actually decreasing?
    if (futureVol < baselineVol) {
      errors.push('VOL_DECREASED');
    }

    // Check 5: Is PEG value reasonable?
    if (peg > 10) {
      errors.push('PEG_TOO_HIGH');
    }

    // Check 6: Vol ratio close to threshold?
    if (volRatio > 1.3 && volRatio < 1.5) {
      errors.push('NEAR_THRESHOLD');
    }

    return errors.join(', ') || 'UNKNOWN';
  }

  /**
   * Identify root cause from failure patterns
   */
  private identifyRootCause(failures: VolatilityDebugResult[]): string {
    if (failures.length === 0) {
      return 'NO_FAILURES';
    }

    // Count error types
    const errorCounts: Record<string, number> = {};
    
    for (const failure of failures) {
      const errors = failure.error.split(', ');
      for (const error of errors) {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }
    }

    // Find most common error
    const sortedErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1]);

    const [topError, count] = sortedErrors[0];
    const percentage = (count / failures.length * 100).toFixed(0);

    // Analyze average values
    const avgBaselineVol = this.average(failures.map(f => f.baselineVol));
    const avgFutureVol = this.average(failures.map(f => f.futureVol));
    const avgVolRatio = this.average(failures.map(f => f.volRatio));
    const avgPEG = this.average(failures.map(f => f.peg));

    console.log('\n📊 FAILURE STATISTICS:');
    console.log(`  Total failures: ${failures.length}`);
    console.log(`  Most common error: ${topError} (${percentage}%)`);
    console.log(`  Avg baseline vol: ${avgBaselineVol.toFixed(6)}`);
    console.log(`  Avg future vol: ${avgFutureVol.toFixed(6)}`);
    console.log(`  Avg vol ratio: ${avgVolRatio.toFixed(2)}x`);
    console.log(`  Avg PEG: ${avgPEG.toFixed(2)}`);
    console.log('');

    // Determine root cause
    if (topError === 'VOL_DECREASED' && count / failures.length > 0.6) {
      return 'VOLATILITY_ACTUALLY_DECREASED';
    } else if (topError === 'LOW_PRICE_MOVEMENT' && count / failures.length > 0.5) {
      return 'DAILY_DATA_TOO_SMOOTH';
    } else if (topError === 'HIGH_BASELINE_VOL') {
      return 'BASELINE_WINDOW_TOO_SHORT';
    } else if (topError === 'NEAR_THRESHOLD') {
      return 'THRESHOLD_TOO_STRICT';
    } else if (avgVolRatio < 1.2) {
      return 'PEG_NOT_PREDICTING_VOLATILITY';
    } else {
      return 'MULTIPLE_ISSUES';
    }
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    rootCause: string,
    failures: VolatilityDebugResult[]
  ): string[] {
    const recs: string[] = [];

    switch (rootCause) {
      case 'VOLATILITY_ACTUALLY_DECREASED':
        recs.push('❌ PEG is predicting volatility DECREASE, not increase');
        recs.push('🔧 Check if PEG formula is inverted');
        recs.push('🔧 Or flip logic: low PEG → high future vol');
        break;

      case 'DAILY_DATA_TOO_SMOOTH':
        recs.push('⚠️  Daily candles smooth out intraday volatility');
        recs.push('✅ Switch to 1-hour or 4-hour candles');
        recs.push('✅ This will capture volatility spikes VFMD detects');
        break;

      case 'BASELINE_WINDOW_TOO_SHORT':
        recs.push('⚠️  20-bar baseline is too short for daily data');
        recs.push('🔧 Try 50-bar baseline (2 months)');
        recs.push('🔧 Or use adaptive baseline (expanding window)');
        break;

      case 'THRESHOLD_TOO_STRICT':
        recs.push('⚠️  1.5x volatility threshold too high for daily data');
        recs.push('🔧 Try 1.2x threshold');
        recs.push('🔧 Or use standard deviation-based threshold');
        break;

      case 'PEG_NOT_PREDICTING_VOLATILITY':
        recs.push('❌ PEG values not correlated with future volatility');
        recs.push('🔧 Check PEG calculation formula');
        recs.push('🔧 Verify gradient magnitude computation');
        recs.push('🔧 Try normalizing PEG by price level');
        break;

      default:
        recs.push('⚠️  Multiple issues detected');
        recs.push('✅ Start with switching to intraday data (1h)');
        recs.push('🔧 Then adjust baseline window (50 bars)');
        recs.push('🔧 Then tune threshold (1.2x)');
    }

    return recs;
  }

  /**
   * Print debug report
   */
  private printDebugReport(
    failures: VolatilityDebugResult[],
    rootCause: string,
    recommendations: string[]
  ) {
    console.log('='.repeat(70));
    console.log('PEG VOLATILITY DEBUG REPORT');
    console.log('='.repeat(70));
    console.log('');
    
    console.log(`🔴 ROOT CAUSE: ${rootCause}`);
    console.log('');
    
    console.log('💡 RECOMMENDATIONS:');
    for (const rec of recommendations) {
      console.log(`  ${rec}`);
    }
    console.log('');
    
    // Show sample failures
    console.log('📋 SAMPLE FAILURES (first 5):');
    for (let i = 0; i < Math.min(5, failures.length); i++) {
      const f = failures[i];
      console.log(`  ${i + 1}. Index ${f.index}, PEG=${f.peg.toFixed(2)}, VolRatio=${f.volRatio.toFixed(2)}x`);
      console.log(`     Error: ${f.error}`);
    }
    console.log('');
    
    console.log('='.repeat(70));
  }

  /**
   * Calculate volatility using log returns
   */
  private calculateVolatility(ticks: MarketTick[]): number {
    if (ticks.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < ticks.length; i++) {
      const ret = Math.log(ticks[i].close / ticks[i - 1].close);
      returns.push(ret);
    }

    const mean = this.average(returns);
    const variance = this.average(returns.map(r => Math.pow(r - mean, 2)));
    
    return Math.sqrt(variance);
  }

  private average(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  /**
   * Test alternative volatility measures
   */
  async testAlternativeVolatilityMetrics(
    ticks: MarketTick[]
  ): Promise<{
    logReturns: number;
    parkinson: number;
    garmanKlass: number;
    recommendation: string;
  }> {
    console.log('🧪 TESTING ALTERNATIVE VOLATILITY METRICS...\n');

    // 1. Log returns (current method)
    const logReturnsVol = this.calculateVolatility(ticks);

    // 2. Parkinson (high-low range)
    const parkinsonVol = this.calculateParkinsonVolatility(ticks);

    // 3. Garman-Klass (OHLC-based)
    const garmanKlassVol = this.calculateGarmanKlassVolatility(ticks);

    console.log('Volatility Metrics Comparison:');
    console.log(`  Log Returns: ${logReturnsVol.toFixed(6)}`);
    console.log(`  Parkinson:   ${parkinsonVol.toFixed(6)}`);
    console.log(`  Garman-Klass: ${garmanKlassVol.toFixed(6)}`);
    console.log('');

    const recommendation = parkinsonVol > logReturnsVol * 1.5
      ? 'Use Parkinson estimator (captures intraday range better)'
      : 'Current log returns method is adequate';

    console.log(`💡 Recommendation: ${recommendation}\n`);

    return {
      logReturns: logReturnsVol,
      parkinson: parkinsonVol,
      garmanKlass: garmanKlassVol,
      recommendation
    };
  }

  private calculateParkinsonVolatility(ticks: MarketTick[]): number {
    if (ticks.length < 2) return 0;

    const values: number[] = [];
    for (const tick of ticks) {
      if (tick.high > 0 && tick.low > 0) {
        values.push(Math.pow(Math.log(tick.high / tick.low), 2));
      }
    }

    const mean = this.average(values);
    return Math.sqrt(mean / (4 * Math.log(2)));
  }

  private calculateGarmanKlassVolatility(ticks: MarketTick[]): number {
    if (ticks.length < 2) return 0;

    const values: number[] = [];
    for (const tick of ticks) {
      if (tick.high > 0 && tick.low > 0 && tick.close > 0 && tick.open > 0) {
        const term1 = 0.5 * Math.pow(Math.log(tick.high / tick.low), 2);
        const term2 = (2 * Math.log(2) - 1) * Math.pow(Math.log(tick.close / tick.open), 2);
        values.push(term1 - term2);
      }
    }

    const mean = this.average(values);
    return Math.sqrt(mean);
  }
}

export default PEGVolatilityDebugger;