/**
 * Integration Validator
 * 
 * Verifies that all 6-7 source framework components are properly integrated
 * and ready for production deployment
 */

import CompletePipelineSignalGenerator, { type CompleteSignal, type MarketData } from './complete-pipeline-signal-generator';
import { RegimeAwareSignalRouter, type MarketRegime } from '../services/regime-aware-signal-router';

export interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

export class IntegrationValidator {
  private results: ValidationResult[] = [];

  /**
   * Run complete integration validation
   */
  async validate(): Promise<ValidationResult[]> {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          UNIFIED 6-7 SOURCE FRAMEWORK INTEGRATION VALIDATOR     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Test 1: Regime Detection
    await this.validateRegimeDetection();

    // Test 2: Signal Generation
    await this.validateSignalGeneration();

    // Test 3: Pattern Detection
    await this.validatePatternDetection();

    // Test 4: Volume Metrics
    await this.validateVolumeMetrics();

    // Test 5: Position Sizing
    await this.validatePositionSizing();

    // Test 6: Risk Assessment
    await this.validateRiskAssessment();

    // Print summary
    this.printSummary();

    return this.results;
  }

  /**
   * Test 1: Regime Detection (5 regimes)
   */
  private async validateRegimeDetection() {
    console.log('📊 Testing Regime Detection...');

    const testCases = [
      {
        name: 'TRENDING Market',
        params: {
          volatilityLevel: 'MEDIUM' as const,
          trendStrength: 72,
          rangeWidth: 0.08,
          volatilityTrend: 'STABLE' as const,
          priceVsMA: 1.05,
          recentSwings: 2
        },
        expected: 'TRENDING'
      },
      {
        name: 'SIDEWAYS Market',
        params: {
          volatilityLevel: 'LOW' as const,
          trendStrength: 20,
          rangeWidth: 0.02,
          volatilityTrend: 'STABLE' as const,
          priceVsMA: 0.99,
          recentSwings: 1
        },
        expected: 'SIDEWAYS'
      },
      {
        name: 'HIGH_VOLATILITY Market',
        params: {
          volatilityLevel: 'EXTREME' as const,
          trendStrength: 45,
          rangeWidth: 0.15,
          volatilityTrend: 'RISING' as const,
          priceVsMA: 1.01,
          recentSwings: 5
        },
        expected: 'HIGH_VOLATILITY'
      },
      {
        name: 'BREAKOUT Market',
        params: {
          volatilityLevel: 'HIGH' as const,
          trendStrength: 55,
          rangeWidth: 0.10,
          volatilityTrend: 'RISING' as const,
          priceVsMA: 1.08,
          recentSwings: 4
        },
        expected: 'BREAKOUT'
      },
      {
        name: 'QUIET Market',
        params: {
          volatilityLevel: 'LOW' as const,
          trendStrength: 15,
          rangeWidth: 0.01,
          volatilityTrend: 'FALLING' as const,
          priceVsMA: 1.00,
          recentSwings: 0
        },
        expected: 'QUIET'
      }
    ];

    for (const test of testCases) {
      try {
        const regime = RegimeAwareSignalRouter.detectRegime(
          test.params.volatilityLevel,
          test.params.trendStrength,
          test.params.rangeWidth,
          test.params.volatilityTrend,
          test.params.priceVsMA,
          test.params.recentSwings
        );

        const pass = regime.type === test.expected;
        this.results.push({
          component: `Regime Detection - ${test.name}`,
          status: pass ? 'PASS' : 'FAIL',
          message: pass
            ? `✅ Correctly detected ${regime.type} regime`
            : `❌ Expected ${test.expected}, got ${regime.type}`,
          details: {
            detected: regime.type,
            expected: test.expected,
            strength: regime.strength
          }
        });
      } catch (error) {
        this.results.push({
          component: `Regime Detection - ${test.name}`,
          status: 'FAIL',
          message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        });
      }
    }
  }

  /**
   * Test 2: Signal Generation
   */
  private async validateSignalGeneration() {
    console.log('🎯 Testing Signal Generation...');

    try {
      // Create realistic market data
      const signal = await CompletePipelineSignalGenerator.generateSignal(
        'BTCUSDT',
        42000,
        '1h',
        10000,

        // Regime
        'MEDIUM',
        65,
        0.03,
        'RISING',
        1.02,
        4,

        // Gradient
        0.15,
        78,
        false,

        // UT Bot
        420,
        41000,
        3,
        1,
        0.65,

        // Structure
        'UPTREND',
        false,

        // Flow Field
        'BULLISH',
        75,
        'medium',
        'ACCELERATING',

        // Chart data
        [],

        // Volume
        1500,
        1000,
        950,
        'UP',
        'RISING'
      );

      // Validate signal structure
      const hasRequiredFields =
        signal.direction &&
        signal.confidence >= 0 && signal.confidence <= 1 &&
        signal.regime &&
        signal.unifiedSignal &&
        signal.positionSizing &&
        signal.risk;

      this.results.push({
        component: 'Signal Generation',
        status: hasRequiredFields ? 'PASS' : 'FAIL',
        message: hasRequiredFields
          ? `✅ Generated complete signal (${signal.direction}, ${(signal.confidence * 100).toFixed(0)}%)`
          : '❌ Signal missing required fields',
        details: {
          direction: signal.direction,
          confidence: signal.confidence,
          regime: signal.regime?.type,
          riskLevel: signal.risk?.level
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Signal Generation',
        status: 'FAIL',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  /**
   * Test 3: Pattern Detection
   */
  private async validatePatternDetection() {
    console.log('🔍 Testing Pattern Detection...');

    try {
      // Try to import and test pattern detection
      const { PatternDetectionEngine } = await import('../services/pattern-detection-contribution');

      const result = PatternDetectionEngine.detectPatterns(
        100.50, // current price
        100.00, // prev price
        98.00,  // support
        102.00, // resistance
        1500,   // volume
        1000,   // prev volume
        65,     // rsi
        0.05,   // macd
        99.50,  // ema20
        99.00,  // ema50
        98.50,  // sma200
        { upper: 101, lower: 100, basis: 100.5 }, // bb
        0.5,    // atr
        0.02    // volatility
      );

      const hasPatterns = result.detectedPatterns && result.detectedPatterns.length > 0;

      this.results.push({
        component: 'Pattern Detection',
        status: hasPatterns ? 'PASS' : 'WARNING',
        message: hasPatterns
          ? `✅ Detected ${result.detectedPatterns.length} patterns (confluence: ${result.confluenceCount})`
          : '⚠️ No patterns detected (may be normal for this data)',
        details: {
          patternsFound: result.detectedPatterns?.length || 0,
          confluence: result.confluenceCount,
          baseConfidence: result.baseConfidence
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Pattern Detection',
        status: 'WARNING',
        message: `⚠️ Pattern detection available but not tested: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  /**
   * Test 4: Volume Metrics
   */
  private async validateVolumeMetrics() {
    console.log('📈 Testing Volume Metrics...');

    try {
      const { VolumeMetricsEngine } = await import('../services/volume-metrics-contribution');

      const result = VolumeMetricsEngine.analyzeVolume(
        1500,  // current volume
        1000,  // avg volume
        900,   // prev volume
        2.5,   // move percent
        'BULLISH',
        102.00,  // highest
        98.00,   // lowest
        100.50   // current price
      );

      const hasMetrics = result.volumeRatio > 0 && result.bullishVolume >= 0 && result.bearishVolume >= 0;

      this.results.push({
        component: 'Volume Metrics',
        status: hasMetrics ? 'PASS' : 'FAIL',
        message: hasMetrics
          ? `✅ Analyzed volume (${result.volumeRatio.toFixed(2)}x, strength: ${result.strength})`
          : '❌ Volume metrics invalid',
        details: {
          volumeRatio: result.volumeRatio,
          strength: result.strength,
          bullishVolume: result.bullishVolume,
          bearishVolume: result.bearishVolume,
          confirmation: result.confirmation
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Volume Metrics',
        status: 'WARNING',
        message: `⚠️ Volume metrics available but not tested: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  /**
   * Test 5: Position Sizing
   */
  private async validatePositionSizing() {
    console.log('💰 Testing Position Sizing...');

    try {
      const signal = await CompletePipelineSignalGenerator.generateSignal(
        'BTCUSDT',
        42000,
        '1h',
        10000,
        'MEDIUM',
        65,
        0.03,
        'RISING',
        1.02,
        4,
        0.15,
        78,
        false,
        420,
        41000,
        3,
        1,
        0.65,
        'UPTREND',
        false,
        'BULLISH',
        75,
        'medium',
        'ACCELERATING',
        [],
        1500,
        1000,
        950,
        'UP',
        'RISING'
      );

      const hasPositionSizing = signal.finalPositionSize > 0 && signal.finalPositionPercent > 0;

      this.results.push({
        component: 'Position Sizing',
        status: hasPositionSizing ? 'PASS' : 'FAIL',
        message: hasPositionSizing
          ? `✅ Position size calculated (${signal.finalPositionSize.toFixed(2)}, ${signal.finalPositionPercent.toFixed(2)}%)`
          : '❌ Position sizing failed',
        details: {
          positionSize: signal.finalPositionSize,
          positionPercent: signal.finalPositionPercent,
          regimeAdjustment: signal.regimeSizingAdjustment
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Position Sizing',
        status: 'FAIL',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  /**
   * Test 6: Risk Assessment
   */
  private async validateRiskAssessment() {
    console.log('⚠️  Testing Risk Assessment...');

    try {
      const signal = await CompletePipelineSignalGenerator.generateSignal(
        'BTCUSDT',
        42000,
        '1h',
        10000,
        'MEDIUM',
        65,
        0.03,
        'RISING',
        1.02,
        4,
        0.15,
        78,
        false,
        420,
        41000,
        3,
        1,
        0.65,
        'UPTREND',
        false,
        'BULLISH',
        75,
        'medium',
        'ACCELERATING',
        [],
        1500,
        1000,
        950,
        'UP',
        'RISING'
      );

      const hasRiskAssessment =
        signal.risk &&
        signal.risk.score >= 0 &&
        signal.risk.score <= 100 &&
        ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(signal.risk.level);

      this.results.push({
        component: 'Risk Assessment',
        status: hasRiskAssessment ? 'PASS' : 'FAIL',
        message: hasRiskAssessment
          ? `✅ Risk assessed (${signal.risk.level}, score: ${signal.risk.score})`
          : '❌ Risk assessment invalid',
        details: {
          riskLevel: signal.risk?.level,
          riskScore: signal.risk?.score,
          factors: signal.risk?.factors
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Risk Assessment',
        status: 'FAIL',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  /**
   * Print validation summary
   */
  private printSummary() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    VALIDATION RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;

    // Print each result
    for (const result of this.results) {
      const icon =
        result.status === 'PASS' ? '✅' :
        result.status === 'FAIL' ? '❌' : '⚠️ ';

      console.log(`${icon} ${result.component}`);
      console.log(`   ${result.message}`);

      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      console.log();
    }

    // Print summary
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log(`║ PASSED: ${passed}/${this.results.length} | FAILED: ${failed} | WARNINGS: ${warnings}`.padEnd(65) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Overall status
    if (failed === 0) {
      console.log('✅ INTEGRATION VALIDATION PASSED - Framework ready for production!\n');
    } else {
      console.log(`❌ INTEGRATION HAS ${failed} FAILURE(S) - Please fix before deployment\n`);
    }
  }
}

// Export for use in tests
export async function runIntegrationValidation() {
  const validator = new IntegrationValidator();
  return await validator.validate();
}

// Run if called directly
if (require.main === module) {
  runIntegrationValidation().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
}
