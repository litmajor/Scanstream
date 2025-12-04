/**
 * Unified 6-7 Source Framework - Complete Integration Examples
 * 
 * Shows how all components work together:
 * - Pattern Detection Engine (technical patterns)
 * - Volume Metrics Engine (volume as signal)
 * - Regime-Aware Router (dynamic weighting)
 * - Complete Pipeline (orchestrator)
 * - Backtest Framework (validation)
 */

import { CompletePipelineSignalGenerator, type MarketData } from './complete-pipeline-6source';
import { PatternDetectionEngine } from './pattern-detection-contribution';
import { VolumeMetricsEngine } from './volume-metrics-contribution';
import { RegimeAwareSignalRouter } from './regime-aware-signal-router';
import { UnifiedFramework } from './unified-framework-6source';
import { UnifiedFrameworkBacktester } from './unified-framework-backtest';

export class UnifiedFrameworkExamples {
  /**
   * EXAMPLE 1: Trending Market with Pattern Confluence
   * 
   * Scenario: Strong uptrend, multiple bullish patterns align,
   * volume confirms continuation
   */
  static trendingMarketExample(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXAMPLE 1: TRENDING MARKET WITH PATTERN CONFLUENCE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const marketData: MarketData = {
      // Price movement
      currentPrice: 100.50,
      prevPrice: 99.80,
      highestPrice: 102.00,
      lowestPrice: 98.50,

      // Volume
      currentVolume: 2500000,
      avgVolume: 2000000,
      prevVolume: 2100000,

      // Technical indicators
      rsi: 58,
      macd: 0.85,
      macdSignal: 0.65,
      ema20: 99.20,
      ema50: 97.50,
      sma200: 95.80,
      atr: 1.50,
      volatility: 1.8,
      bollingerBands: {
        upper: 103.50,
        lower: 97.50,
        basis: 100.50
      },

      // Structure
      support: 98.00,
      resistance: 102.50,
      supplyZone: 105.00,
      demandZone: 96.50,

      // Regime
      adx: 72,
      volatilityLevel: 'MEDIUM',
      volatilityTrend: 'STABLE',
      priceVsMA: 0.8, // Well above moving averages
      recentSwings: 2,
      rangeWidth: 0.035
    };

    // STEP 1: Detect pattern
    const patternResult = PatternDetectionEngine.detectPatterns(
      marketData.currentPrice,
      marketData.prevPrice,
      marketData.support,
      marketData.resistance,
      marketData.currentVolume,
      marketData.prevVolume,
      marketData.rsi,
      marketData.macd,
      marketData.ema20,
      marketData.ema50,
      marketData.sma200,
      marketData.bollingerBands,
      marketData.atr,
      marketData.volatility
    );

    console.log('PATTERN DETECTION:');
    console.log(`  Primary Pattern: ${patternResult.primaryPattern}`);
    console.log(`  Confluence Count: ${patternResult.confluenceCount}`);
    console.log(`  Pattern Confidence: ${(patternResult.confidence * 100).toFixed(0)}%`);
    console.log(`  Detected Patterns:`);
    patternResult.detectedPatterns.forEach(p => {
      console.log(`    • ${p.type}: confidence ${(p.confidence * 100).toFixed(0)}%`);
    });

    // STEP 2: Analyze volume
    const volumeResult = VolumeMetricsEngine.analyzeVolume(
      marketData.currentVolume,
      marketData.avgVolume,
      marketData.prevVolume,
      0.70, // +0.70% price move
      'BULLISH',
      marketData.highestPrice,
      marketData.lowestPrice,
      marketData.currentPrice
    );

    console.log('\nVOLUME ANALYSIS:');
    console.log(`  Volume Ratio: ${(volumeResult.volumeRatio * 100).toFixed(0)}%`);
    console.log(`  Volume Strength: ${volumeResult.strength}`);
    console.log(`  Bullish Signal: ${(volumeResult.bullishVolume * 100).toFixed(0)}%`);
    console.log(`  Confirms Trend: ${volumeResult.confirmation ? 'YES ✓' : 'NO'}`);

    // STEP 3: Generate complete signal
    const signal = CompletePipelineSignalGenerator.generateSignal(marketData);

    console.log('\nCOMPLETE UNIFIED SIGNAL:');
    console.log(`  Direction: ${signal.direction}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Regime: ${signal.regime}`);
    console.log(`  Sources: ${signal.sourceCount} integrated`);
    console.log('\nTop Contributors:');
    signal.primarySources.forEach(source => {
      console.log(`  • ${source}`);
    });

    console.log('\n' + UnifiedFramework.getSummary(signal.framework));
  }

  /**
   * EXAMPLE 2: Breakout with Volume Surge
   * 
   * Scenario: Structure break with extreme volume spike,
   * multiple confluence patterns, energy acceleration
   */
  static breakoutWithVolumeSurgeExample(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXAMPLE 2: BREAKOUT WITH EXTREME VOLUME SURGE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const marketData: MarketData = {
      // BREAKOUT: Price breaks resistance
      currentPrice: 105.20,
      prevPrice: 104.50,
      highestPrice: 105.50,
      lowestPrice: 103.00,

      // EXTREME VOLUME: 3x average (breakout confirmation)
      currentVolume: 6000000,
      avgVolume: 2000000,
      prevVolume: 2100000,

      // Technical
      rsi: 68,
      macd: 1.25,
      macdSignal: 0.85,
      ema20: 103.80,
      ema50: 102.50,
      sma200: 100.00,
      atr: 1.20,
      volatility: 2.2,
      bollingerBands: {
        upper: 105.00,
        lower: 100.50,
        basis: 102.75
      },

      // Structure: Breaking resistance
      support: 103.50,
      resistance: 105.00,
      supplyZone: 107.50,
      demandZone: 102.00,

      // Regime
      adx: 68,
      volatilityLevel: 'HIGH',
      volatilityTrend: 'RISING',
      priceVsMA: 0.85,
      recentSwings: 4, // Multiple structure breaks
      rangeWidth: 0.025
    };

    // PATTERN DETECTION
    const patternResult = PatternDetectionEngine.detectPatterns(
      marketData.currentPrice,
      marketData.prevPrice,
      marketData.support,
      marketData.resistance,
      marketData.currentVolume,
      marketData.prevVolume,
      marketData.rsi,
      marketData.macd,
      marketData.ema20,
      marketData.ema50,
      marketData.sma200,
      marketData.bollingerBands,
      marketData.atr,
      marketData.volatility
    );

    console.log('PATTERN ANALYSIS:');
    console.log(`  Pattern: ${patternResult.primaryPattern} (typical for breakouts)`);
    console.log(`  Confluence: ${patternResult.confluenceCount} patterns aligned`);

    // VOLUME ANALYSIS
    const volumeResult = VolumeMetricsEngine.analyzeVolume(
      marketData.currentVolume,
      marketData.avgVolume,
      marketData.prevVolume,
      0.70, // +0.70% move
      'BULLISH',
      marketData.highestPrice,
      marketData.lowestPrice,
      marketData.currentPrice
    );

    console.log('\nVOLUME SURGE CONFIRMATION:');
    console.log(`  Volume Spike: ${volumeResult.volumeSpike ? 'YES ✓ 3x average!' : 'NO'}`);
    console.log(`  Strength: ${volumeResult.strength}`);
    console.log(`  Market Activity: ${volumeResult.marketActivity}`);

    // REGIME DETECTION
    const regime = RegimeAwareSignalRouter.detectRegime(
      'HIGH',
      68,
      0.025,
      'RISING',
      0.85,
      4
    );

    console.log('\nREGIME ANALYSIS:');
    console.log(`  Type: ${regime.type}`);
    console.log(`  Strength: ${regime.strength}/100`);
    console.log(`  Characteristics: ${regime.characteristics.join(' | ')}`);

    // Get weights specific to BREAKOUT regime
    const weights = RegimeAwareSignalRouter.getRegimeAdjustedWeights(regime);
    console.log('\nBREAKOUT REGIME WEIGHTS:');
    console.log(`  Structure: ${(weights.marketStructure * 100).toFixed(0)}% (primary)`);
    console.log(`  Flow Energy: ${(weights.flowFieldEnergy * 100).toFixed(0)}%`);
    console.log(`  Volume Metrics: ${(weights.volumeMetrics * 100).toFixed(0)}% (HIGH!)`);
    console.log(`  Patterns: ${(weights.patternDetection * 100).toFixed(0)}%`);

    // COMPLETE SIGNAL
    const signal = CompletePipelineSignalGenerator.generateSignal(marketData);

    console.log('\nUNIFIED SIGNAL (ALL 6+ SOURCES):');
    console.log(`  Direction: ${signal.direction}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Risk Level: ${signal.framework.riskLevel}`);

    console.log('\n' + UnifiedFramework.getSummary(signal.framework));
  }

  /**
   * EXAMPLE 3: Sideways Market - Support Bounce
   * 
   * Scenario: Price bounces off support with volume spike,
   * multiple confluence patterns, ML confirmation
   */
  static supportBounceExample(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXAMPLE 3: SUPPORT BOUNCE WITH PATTERN CONFLUENCE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const marketData: MarketData = {
      // Bounce from support
      currentPrice: 98.50,
      prevPrice: 97.80,
      highestPrice: 101.00,
      lowestPrice: 97.50, // At support

      // Volume spike at support
      currentVolume: 3200000,
      avgVolume: 2000000,
      prevVolume: 1800000,

      // Technical
      rsi: 32, // Oversold (strong signal)
      macd: -0.15,
      macdSignal: -0.10,
      ema20: 99.50,
      ema50: 99.80,
      sma200: 100.50,
      atr: 1.80,
      volatility: 1.5,
      bollingerBands: {
        upper: 102.50,
        lower: 97.50,
        basis: 100.00
      },

      // Structure: At support
      support: 97.50,
      resistance: 102.00,
      supplyZone: 103.50,
      demandZone: 97.00,

      // Regime: Sideways
      adx: 32,
      volatilityLevel: 'MEDIUM',
      volatilityTrend: 'STABLE',
      priceVsMA: -0.05, // Near EMAs
      recentSwings: 6, // Many bounces = range
      rangeWidth: 0.045 // Wide range = sideways
    };

    // PATTERN: Support Bounce
    const patternResult = PatternDetectionEngine.detectPatterns(
      marketData.currentPrice,
      marketData.prevPrice,
      marketData.support,
      marketData.resistance,
      marketData.currentVolume,
      marketData.prevVolume,
      marketData.rsi,
      marketData.macd,
      marketData.ema20,
      marketData.ema50,
      marketData.sma200,
      marketData.bollingerBands,
      marketData.atr,
      marketData.volatility
    );

    console.log('SUPPORT BOUNCE DETECTION:');
    console.log(`  Pattern: ${patternResult.primaryPattern}`);
    console.log(`  Confluence: ${patternResult.confluenceCount} patterns`);
    console.log(`  RSI in oversold zone: YES (${marketData.rsi})`);

    // VOLUME CONFIRMATION
    const volumeResult = VolumeMetricsEngine.analyzeVolume(
      marketData.currentVolume,
      marketData.avgVolume,
      marketData.prevVolume,
      0.70, // +0.70% move
      'BULLISH',
      marketData.highestPrice,
      marketData.lowestPrice,
      marketData.currentPrice
    );

    console.log('\nVOLUME CONFIRMATION:');
    console.log(`  Volume Ratio: ${(volumeResult.volumeRatio * 100).toFixed(0)}%`);
    console.log(`  Volume-Price Agreement: ${volumeResult.confirmation ? 'YES ✓' : 'NO'}`);
    console.log(`  Confidence Boost: +0.10 (volume validated)`);

    // COMPLETE SIGNAL
    const signal = CompletePipelineSignalGenerator.generateSignal(marketData);

    console.log('\nUNIFIED SIGNAL (SIDEWAYS OPTIMIZED):');
    console.log(`  Direction: ${signal.direction}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Regime: ${signal.regime} (UT Bot leads in sideways)`);
    console.log(`  Pattern Quality: ${patternResult.confluenceCount >= 2 ? 'HIGH' : 'MODERATE'}`);

    console.log('\n' + UnifiedFramework.getSummary(signal.framework));
  }

  /**
   * EXAMPLE 4: High Volatility - Capital Preservation
   * 
   * Scenario: Extreme volatility regime,
   * UT Bot trailing stops prioritized, reduced position sizing
   */
  static highVolatilityExample(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXAMPLE 4: HIGH VOLATILITY - CAPITAL PRESERVATION MODE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const marketData: MarketData = {
      // High volatility
      currentPrice: 100.00,
      prevPrice: 99.50,
      highestPrice: 102.50,
      lowestPrice: 97.00, // Wide range

      // Volume elevated
      currentVolume: 4500000,
      avgVolume: 2000000,
      prevVolume: 4200000,

      // Technical: Noisy
      rsi: 55,
      macd: 0.05,
      macdSignal: 0.00,
      ema20: 99.80,
      ema50: 100.20,
      sma200: 101.00,
      atr: 2.50, // High ATR = high volatility
      volatility: 3.2,
      bollingerBands: {
        upper: 105.00,
        lower: 95.00,
        basis: 100.00
      },

      // Structure: Unclear
      support: 97.50,
      resistance: 102.50,
      supplyZone: 103.00,
      demandZone: 97.00,

      // Regime: Extreme volatility
      adx: 48,
      volatilityLevel: 'EXTREME',
      volatilityTrend: 'RISING',
      priceVsMA: 0.0, // At middle
      recentSwings: 8, // Lots of whipsaw
      rangeWidth: 0.055 // Very wide
    };

    // REGIME DETECTION
    const regime = RegimeAwareSignalRouter.detectRegime(
      'EXTREME',
      48,
      0.055,
      'RISING',
      0.0,
      8
    );

    console.log('VOLATILE MARKET DETECTION:');
    console.log(`  Regime: ${regime.type}`);
    console.log(`  Characteristics: ${regime.characteristics.join(' | ')}`);

    // REGIME-SPECIFIC RULES
    const rules = RegimeAwareSignalRouter.getRegimeRules(regime);
    const sizeMultiplier = RegimeAwareSignalRouter.getRegimeSizingMultiplier(regime);

    console.log('\nCAPITAL PRESERVATION RULES:');
    console.log(`  Entry Rule: ${rules.entryRule}`);
    console.log(`  Position Sizing: ${(sizeMultiplier * 100).toFixed(0)}% normal`);
    console.log(`  Stop Loss: ${rules.stoplossMultiplier}x ATR`);
    console.log(`  Take Profit: ${rules.takeprofitMultiplier}x ATR`);

    // WEIGHTS FOR HIGH VOL
    const weights = RegimeAwareSignalRouter.getRegimeAdjustedWeights(regime);
    console.log('\nHIGH VOLATILITY WEIGHTS:');
    console.log(`  UT Bot: ${(weights.utBotVolatility * 100).toFixed(0)}% (DOMINANT - trailing stops)`);
    console.log(`  Flow Field: ${(weights.flowFieldEnergy * 100).toFixed(0)}% (energy tracking)`);
    console.log(`  Patterns: ${(weights.patternDetection * 100).toFixed(0)}% (less reliable)`);

    // COMPLETE SIGNAL
    const signal = CompletePipelineSignalGenerator.generateSignal(marketData);

    console.log('\nUNIFIED SIGNAL (VOL-ADJUSTED):');
    console.log(`  Direction: ${signal.direction}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Risk: ${signal.framework.riskLevel}`);
    console.log(`  Action: ${sizeMultiplier < 0.8 ? 'REDUCE position size + tighter stops' : 'Normal sizing'}`);

    console.log('\n' + UnifiedFramework.getSummary(signal.framework));
  }

  /**
   * EXAMPLE 5: Quiet Market - Waiting for Setup
   * 
   * Scenario: Low volatility, weak trend, waiting for breakout
   */
  static quietMarketExample(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXAMPLE 5: QUIET MARKET - AWAITING BREAKOUT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const marketData: MarketData = {
      // Low volatility, range-bound
      currentPrice: 100.00,
      prevPrice: 100.05,
      highestPrice: 100.50,
      lowestPrice: 99.50,

      // Decreasing volume
      currentVolume: 1200000,
      avgVolume: 2000000,
      prevVolume: 1300000,

      // Technical: Neutral
      rsi: 50,
      macd: 0.02,
      macdSignal: 0.01,
      ema20: 100.10,
      ema50: 100.05,
      sma200: 100.00,
      atr: 0.50,
      volatility: 0.6,
      bollingerBands: {
        upper: 100.80,
        lower: 99.20,
        basis: 100.00
      },

      // Structure: Consolidation
      support: 99.50,
      resistance: 100.50,
      supplyZone: 101.00,
      demandZone: 99.00,

      // Regime: Quiet
      adx: 25,
      volatilityLevel: 'LOW',
      volatilityTrend: 'FALLING',
      priceVsMA: 0.0, // At MA
      recentSwings: 0,
      rangeWidth: 0.010
    };

    // REGIME DETECTION
    const regime = RegimeAwareSignalRouter.detectRegime(
      'LOW',
      25,
      0.010,
      'FALLING',
      0.0,
      0
    );

    console.log('QUIET MARKET ANALYSIS:');
    console.log(`  Regime: ${regime.type}`);
    console.log(`  Characteristics: ${regime.characteristics.join(' | ')}`);

    // QUIET MARKET STRATEGY
    const minThreshold = RegimeAwareSignalRouter.getMinAgreementThreshold(regime);
    const sizeMultiplier = RegimeAwareSignalRouter.getRegimeSizingMultiplier(regime);

    console.log('\nQUIET MARKET STRATEGY:');
    console.log(`  Agreement Threshold: ${(minThreshold * 100).toFixed(0)}% (only best setups)`);
    console.log(`  Position Sizing: ${(sizeMultiplier * 100).toFixed(0)}% normal`);
    console.log(`  Action: WAIT for volume surge or regime shift`);
    console.log(`  Trading: Minimal activity expected`);

    // COMPLETE SIGNAL
    const signal = CompletePipelineSignalGenerator.generateSignal(marketData);

    console.log('\nUNIFIED SIGNAL (QUIET-OPTIMIZED):');
    console.log(`  Direction: ${signal.direction}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Regime: ${signal.regime}`);
    console.log(`  Recommendation: ${signal.confidence < minThreshold ? 'SKIP - no trade' : 'Consider entry'}`);

    console.log('\n' + UnifiedFramework.getSummary(signal.framework));
  }

  /**
   * BACKTEST COMPARISON
   */
  static showBacktestComparison(): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('BACKTEST FRAMEWORK: Expected Performance Improvements');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const expected = UnifiedFrameworkBacktester.getExpectedImprovement();

    console.log(expected.baseline);
    console.log('\n─────────────────────────────────────────────────────────────\n');
    console.log(expected.sixSourceImprovement);
    console.log('\n─────────────────────────────────────────────────────────────\n');
    console.log(expected.sevenSourceImprovement);
  }

  /**
   * Run all examples
   */
  static runAllExamples(): void {
    this.trendingMarketExample();
    this.breakoutWithVolumeSurgeExample();
    this.supportBounceExample();
    this.highVolatilityExample();
    this.quietMarketExample();
    this.showBacktestComparison();
  }
}

// Export for use
export default UnifiedFrameworkExamples;

// Uncomment to run examples:
// UnifiedFrameworkExamples.runAllExamples();
