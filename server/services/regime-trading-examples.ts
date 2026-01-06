/**
 * Regime-Based Trading System Examples
 * 
 * Shows how to use regimes in real trading scenarios
 * with complete setup generation and trade management
 */

import RegimeAwareTradingSystem from './regime-aware-trading-system';
import { RegimeClassifier, FlowRegime } from './vfmd/regimeClassifier';
import type { PhysicsMetrics } from './vfmd/types';

/**
 * EXAMPLE 1: Clean Bull Trend
 * 
 * Market conditions:
 * - Price trending up
 * - Coherence high (flow is aligned)
 * - Turbulence low (organized movement)
 * - Momentum scanner says BUY
 * 
 * Question: What's the trading setup?
 */
export function example1_cleanBullTrend() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 1: Clean Bull Trend (LAMINAR_TREND)');
  console.log('='.repeat(70));

  // Market physics
  const physicsMetrics: PhysicsMetrics = {
    peg: 800,
    turbulenceIndex: 0.6,
    coherenceScore: 0.75,
    dominantAngle: 45,
    divergenceScore: 0.1,
    recentDivergence: 0.05,
    curlScore: 0.2,
    recentCurl: 0.1,
    gradientMagnitude: 100,
  };

  // Signal from momentum scanner
  const signal = {
    trend: 'BULLISH' as const,
    confidence: 0.72,
    strength: 78,
  };

  // Analyze with regime system
  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  Physics: PEG=${physicsMetrics.peg}, TI=${physicsMetrics.turbulenceIndex}, Coherence=${physicsMetrics.coherenceScore}`);
  console.log(`  Signal: ${signal.trend} (${(signal.confidence * 100).toFixed(0)}% conf)`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}% below entry`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);
  console.log(`  Signal Confidence: ${(analysis.setup.confidence * 100).toFixed(0)}%`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n✅ VERDICT: ENTER TRADE');
  console.log('  Clean trend, good signal, full position size. Let trend develop.');
}

/**
 * EXAMPLE 2: Breakout Transition
 * 
 * Market conditions:
 * - Energy building (high PEG)
 * - Very calm market (low TI)
 * - Good alignment (coherence)
 * - Strong breakout signal
 * 
 * Question: How aggressive should we be?
 */
export function example2_breakoutTransition() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 2: Breakout Transition (BREAKOUT_TRANSITION)');
  console.log('='.repeat(70));

  const physicsMetrics: PhysicsMetrics = {
    peg: 1800,
    turbulenceIndex: 0.5,
    coherenceScore: 0.72,
    dominantAngle: 45,
    divergenceScore: 0.15,
    recentDivergence: 0.1,
    curlScore: 0.1,
    recentCurl: 0.05,
    gradientMagnitude: 200,
  };

  const signal = {
    trend: 'BULLISH' as const,
    confidence: 0.85, // Very confident
    strength: 92,
  };

  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  💥 PEG SPIKE: ${physicsMetrics.peg} (very high stored energy!)`);
  console.log(`  ✨ CALM: TI=${physicsMetrics.turbulenceIndex} (organized)`);
  console.log(`  Signal: ${signal.trend} (${(signal.confidence * 100).toFixed(0)}% conf) - STRONG`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`    → 130% of normal (AGGRESSIVE - hold the breakout!)`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}% below entry`);
  console.log(`    → Very tight (1% - don't let it stop you out)`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);
  console.log(`    → Explosive (4:1 - hold for big move!)`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n🚀 VERDICT: ENTER AGGRESSIVELY');
  console.log('  Rare setup: Energy built up + calm market = explosion coming.');
  console.log('  Tight stop protects, but target is far away. Hold for big move!');
}

/**
 * EXAMPLE 3: Consolidation / Ranging
 * 
 * Market conditions:
 * - Price in a range
 * - Unclear direction
 * - No extreme physics metrics
 * - Moderate signal confidence
 * 
 * Question: How should we manage risk?
 */
export function example3_consolidation() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 3: Consolidation / Ranging (CONSOLIDATION)');
  console.log('='.repeat(70));

  const physicsMetrics: PhysicsMetrics = {
    peg: 600,
    turbulenceIndex: 1.1,
    coherenceScore: 0.45,
    dominantAngle: 30,
    divergenceScore: 0.0,
    recentDivergence: 0.0,
    curlScore: 0.4,
    recentCurl: 0.3,
    gradientMagnitude: 80,
  };

  const signal = {
    trend: 'BULLISH' as const,
    confidence: 0.58, // Moderate
    strength: 55,
  };

  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  Physics: No extremes, all medium values`);
  console.log(`  Signal: ${signal.trend} (${(signal.confidence * 100).toFixed(0)}% conf) - moderate`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`    → 50% of normal (CONSERVATIVE - unclear direction)`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}% below entry`);
  console.log(`    → Very tight (1.5% - can't let range break against us)`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);
  console.log(`    → Poor odds (1:1 - quick scalp only)`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n⚠️  VERDICT: ENTER SMALL OR SKIP');
  console.log('  Range-bound market is unpredictable. Small size + tight stops only.');
  console.log('  Waiting for breakout is often better than trading the range.');
}

/**
 * EXAMPLE 4: Distribution / Selling Pressure
 * 
 * Market conditions:
 * - Price near high
 * - High volume (chaotic)
 * - Positive divergence (distribution signal)
 * - Bullish signal comes in
 * 
 * Question: Should we take the long signal?
 */
export function example4_distribution() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 4: Distribution / Selling Pressure (DISTRIBUTION)');
  console.log('='.repeat(70));

  const physicsMetrics: PhysicsMetrics = {
    peg: 1300,
    turbulenceIndex: 1.4,
    coherenceScore: 0.5,
    dominantAngle: 50,
    divergenceScore: 0.35,
    recentDivergence: 0.3,
    curlScore: 0.5,
    recentCurl: 0.4,
    gradientMagnitude: 150,
  };

  const signal = {
    trend: 'BULLISH' as const, // Bullish signal arrives
    confidence: 0.70,
    strength: 75,
  };

  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  ⚠️  Divergence: ${physicsMetrics.divergenceScore.toFixed(2)} (DISTRIBUTION!)`);
  console.log(`  ⚠️  Chaos: TI=${physicsMetrics.turbulenceIndex} (high, chaotic)`);
  console.log(`  Signal: ${signal.trend} (${(signal.confidence * 100).toFixed(0)}% conf) - BUT DISTRIBUTION ACTIVE`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  if (analysis.setup.action === 'SKIP') {
    console.log(`    → REJECT - Distribution regime rejects long signals`);
  }
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}% below entry`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n❌ VERDICT: SKIP OR SHORT ONLY');
  console.log('  Smart money is distributing (selling). Long trades will struggle.');
  console.log('  Consider going short or waiting for clear buy signal after pullback.');
}

/**
 * EXAMPLE 5: Turbulent Chop
 * 
 * Market conditions:
 * - Wild price swings
 * - Very high chaos
 * - Unpredictable
 * - Multiple signals contradict each other
 * 
 * Question: What do we do?
 */
export function example5_turbulentChop() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 5: Turbulent Chop / Chaos (TURBULENT_CHOP)');
  console.log('='.repeat(70));

  const physicsMetrics: PhysicsMetrics = {
    peg: 500,
    turbulenceIndex: 2.5,
    coherenceScore: 0.2,
    dominantAngle: 0,
    divergenceScore: 0.0,
    recentDivergence: 0.0,
    curlScore: 0.8,
    recentCurl: 0.8,
    gradientMagnitude: 50,
  };

  const signal = {
    trend: 'BULLISH' as const,
    confidence: 0.65, // Normally decent
    strength: 70,
  };

  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  🌪️  TURBULENCE: TI=${physicsMetrics.turbulenceIndex} (EXTREME!)`);
  console.log(`  🌀 Coherence: ${physicsMetrics.coherenceScore} (incoherent)`);
  console.log(`  Signal: ${signal.trend} - BUT MARKET IS TOO CHAOTIC`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  if (analysis.setup.action === 'SKIP') {
    console.log(`    → DO NOT TRADE - Market is too chaotic`);
  }
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}%`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n🛑 VERDICT: CLOSE ALL POSITIONS AND WAIT');
  console.log('  This market is IMPOSSIBLE to trade profitably.');
  console.log('  Close every open trade NOW. Preserve capital.');
  console.log('  Wait for TI to drop below 2.0 before considering new trades.');
}

/**
 * EXAMPLE 6: Accumulation - Building Pressure
 * 
 * Market conditions:
 * - Price quiet, not moving much
 * - Negative divergence (accumulation)
 * - Low turbulence (organized buying)
 * - Subtle bullish signal
 * 
 * Question: How to trade the accumulation?
 */
export function example6_accumulation() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 6: Accumulation Phase (ACCUMULATION)');
  console.log('='.repeat(70));

  const physicsMetrics: PhysicsMetrics = {
    peg: 800,
    turbulenceIndex: 0.7,
    coherenceScore: 0.55,
    dominantAngle: 35,
    divergenceScore: -0.35,
    recentDivergence: -0.3,
    curlScore: 0.15,
    recentCurl: 0.1,
    gradientMagnitude: 120,
  };

  const signal = {
    trend: 'BULLISH' as const,
    confidence: 0.62, // Subtle
    strength: 62,
  };

  const analysis = RegimeAwareTradingSystem.analyzeSignal(signal, physicsMetrics, 2.0);

  console.log('\n📊 Market Analysis:');
  console.log(`  Regime: ${analysis.regime}`);
  console.log(`  💤 Quiet market: TI=${physicsMetrics.turbulenceIndex}`);
  console.log(`  💡 Divergence: ${physicsMetrics.divergenceScore.toFixed(2)} (ACCUMULATION!)`);
  console.log(`  Signal: ${signal.trend} (${(signal.confidence * 100).toFixed(0)}% conf) - subtle but valid`);

  console.log('\n💼 Trading Setup:');
  console.log(`  Action: ${analysis.setup.action}`);
  console.log(`  Position Size: ${analysis.setup.positionSizePercent.toFixed(2)}% of account`);
  console.log(`    → 50% of normal (LAYER IN - this is accumulation phase)`);
  console.log(`  Stop Loss: ${analysis.setup.stopLossPercent.toFixed(1)}% below entry`);
  console.log(`    → Wide stop (3% - allow room for market to move)`);
  console.log(`  Profit Target: ${analysis.setup.profitTargetRatio.toFixed(1)}:1 RR`);
  console.log(`    → Modest (1.5:1 - accumulation is slow build)`);

  console.log('\n📈 Expected Performance:');
  console.log(`  Win Rate: ${(analysis.expectedWinRate * 100).toFixed(0)}%`);
  console.log(`  Sharpe Ratio: ${analysis.expectedSharpeRatio.toFixed(2)}`);

  console.log('\n💡 Reasoning:');
  console.log(`  ${analysis.setup.reasoning}`);

  console.log('\n✅ VERDICT: ACCUMULATE IN SMALL POSITIONS');
  console.log('  Smart money buying quietly. Accumulate on dips.');
  console.log('  This is the EARLY stage before trend develops.');
  console.log('  Plan to add more when trend confirmation comes.');
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(15) + 'REGIME-BASED TRADING SYSTEM EXAMPLES' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  example1_cleanBullTrend();
  example2_breakoutTransition();
  example3_consolidation();
  example4_distribution();
  example5_turbulentChop();
  example6_accumulation();

  console.log('\n' + '='.repeat(70));
  console.log('✅ EXAMPLES COMPLETE');
  console.log('='.repeat(70));
  console.log('\nKey Insights:');
  console.log('  1. Each regime has different position sizing rules');
  console.log('  2. Stop losses and targets change based on regime');
  console.log('  3. Some regimes require SKIPPING (turbulent chop, distribution)');
  console.log('  4. Accumulation is the BEST time to build positions');
  console.log('  5. Breakout transition is the MOST AGGRESSIVE');
  console.log('  6. Always check regime BEFORE entering a trade');
  console.log('');
}

// Export
export { RegimeAwareTradingSystem };
