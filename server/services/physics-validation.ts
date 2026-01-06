/**
 * PHYSICS THEORY VALIDATION SCRIPT
 * Real quantitative testing of VFMD metrics predictive power
 * 
 * Tests:
 * 1. PEG spike correlation with breakouts
 * 2. Turbulence Index accuracy in identifying choppy zones
 * 3. Coherence alignment with trends vs ranges
 * 4. Regime classification accuracy
 */

import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import FlowPhysicsAgent from '../services/rpg-agents/FlowPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';
import { storage } from '../storage';

interface ValidationMetrics {
  pegBreakoutCorrelation: number;      // % of breakouts preceded by PEG spike
  pegLeadTime: number;                 // avg bars before breakout
  turbulenceAccuracy: number;          // % correctly identified choppy zones
  coherenceRegimeAccuracy: number;     // % coherence matches regime (high in trends)
  regimeClassificationAccuracy: number; // % correct regime calls
}

interface ValidationReport {
  timestamp: Date;
  symbol: string;
  dataPoints: number;
  metrics: ValidationMetrics;
  testsPassed: boolean;
  summary: string;
}

// ============================================================================
// TEST 1: PEG BREAKOUT PREDICTION
// ============================================================================

function testPEGBreakoutPrediction(ticks: MarketTick[]): {
  pegBreakouts: number;
  totalBreakouts: number;
  correlation: number;
  avgLeadTime: number;
} {
  const results = {
    pegBreakouts: 0,
    totalBreakouts: 0,
    correlation: 0,
    avgLeadTime: 0,
    leadTimes: [] as number[]
  };

  const vfmdAgent = new VFMDPhysicsAgent('test', 'balanced');
  
  // More flexible breakout detection: look for significant price moves
  // Definition: >1% price move over 5-20 bars with directional consistency
  for (let i = 30; i < ticks.length - 20; i += 10) {
    // Check 5-bar and 10-bar moves
    const window5 = ticks.slice(i, i + 5);
    const window10 = ticks.slice(i, Math.min(i + 10, ticks.length));
    
    if (window5.length < 5 || window10.length < 5) continue;
    
    const priceChange5 = Math.abs(window5[window5.length - 1].close - window5[0].close) / window5[0].close;
    const priceChange10 = Math.abs(window10[window10.length - 1].close - window10[0].close) / window10[0].close;
    
    // Directional consistency check
    let consistentDirection5 = 0;
    for (let j = 1; j < window5.length; j++) {
      if ((window5[j].close > window5[j - 1].close && window5[window5.length - 1].close > window5[0].close) ||
          (window5[j].close < window5[j - 1].close && window5[window5.length - 1].close < window5[0].close)) {
        consistentDirection5++;
      }
    }
    
    // Detect breakout: >1% move OR >10% move + volume confirmation
    const isBreakout = 
      (priceChange5 > 0.01 && consistentDirection5 >= 3) ||  // 1% move with direction
      (priceChange10 > 0.005 && window10.some(t => t.volume > ticks.slice(Math.max(0, i - 10), i).reduce((s, x) => s + x.volume, 0) / 10 * 1.2));
    
    if (isBreakout) {
      results.totalBreakouts++;
      
      // Check if PEG spiked in bars 5-15 before breakout
      let pegSpike = false;
      let pegSpikeBar = 0;
      const pegValues: number[] = [];
      
      for (let j = Math.max(5, i - 15); j < i; j++) {
        const windowTicks = ticks.slice(Math.max(0, j - 30), j + 1);
        if (windowTicks.length >= 10) {
          const analysis = vfmdAgent.getAnalysisForUI(windowTicks);
          const peg = parseFloat(analysis?.field_metrics?.peg_energy || '0');
          pegValues.push(peg);
          
          if (peg > 1.5) {  // Lower threshold for PEG spike
            pegSpike = true;
            pegSpikeBar = i - j;
          }
        }
      }
      
      if (pegSpike && pegSpikeBar > 0 && pegSpikeBar < 15) {
        results.pegBreakouts++;
        results.leadTimes.push(pegSpikeBar);
      }
    }
  }
  
  results.correlation = results.totalBreakouts > 0 ? (results.pegBreakouts / results.totalBreakouts) * 100 : 0;
  results.avgLeadTime = results.leadTimes.length > 0 
    ? results.leadTimes.reduce((a, b) => a + b, 0) / results.leadTimes.length 
    : 0;
  
  return results;
}

// ============================================================================
// TEST 2: TURBULENCE INDEX ACCURACY
// ============================================================================

function testTurbulenceAccuracy(ticks: MarketTick[]): {
  correctChoppy: number;
  correctTrend: number;
  totalZones: number;
  accuracy: number;
} {
  const results = {
    correctChoppy: 0,
    correctTrend: 0,
    totalZones: 0,
    accuracy: 0
  };

  const vfmdAgent = new VFMDPhysicsAgent('test', 'balanced');
  
  // Analyze 20-bar zones
  for (let i = 50; i < ticks.length - 20; i += 20) {
    const zone = ticks.slice(i, i + 20);
    
    // Calculate actual volatility to determine if choppy or trending
    const closes = zone.map(t => t.close);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance = closes.reduce((sum, c) => sum + Math.pow(c - avgClose, 2), 0) / closes.length;
    const stdev = Math.sqrt(variance);
    const cv = stdev / avgClose; // Coefficient of variation
    
    const isChoppy = cv > 0.01; // High relative volatility = choppy
    
    // Get TI from VFMD
    const analysis = vfmdAgent.getAnalysisForUI(zone);
    const turbulence = analysis?.field_metrics?.turbulence_index || 0;
    const predictedChoppy = turbulence > 1.0;
    
    results.totalZones++;
    
    if (isChoppy === predictedChoppy) {
      if (isChoppy) results.correctChoppy++;
      else results.correctTrend++;
    }
  }
  
  results.accuracy = (results.correctChoppy + results.correctTrend) / results.totalZones * 100;
  
  return results;
}

// ============================================================================
// TEST 3: COHERENCE & REGIME ALIGNMENT
// ============================================================================

function testCoherenceRegimeAlignment(ticks: MarketTick[]): {
  highCoherenceInTrends: number;
  lowCoherenceInRanges: number;
  totalEvals: number;
  accuracy: number;
} {
  const results = {
    highCoherenceInTrends: 0,
    lowCoherenceInRanges: 0,
    totalEvals: 0,
    accuracy: 0
  };

  const vfmdAgent = new VFMDPhysicsAgent('test', 'balanced');
  
  // Analyze 50-bar regimes
  for (let i = 50; i < ticks.length - 50; i += 50) {
    const window = ticks.slice(i, i + 50);
    
    // Detect regime by price range vs directional move
    const high = Math.max(...window.map(t => t.high));
    const low = Math.min(...window.map(t => t.low));
    const range = high - low;
    const directionalmove = Math.abs(window[window.length - 1].close - window[0].open);
    const directionalRatio = directionalmove / range;
    
    const isTrending = directionalRatio > 0.6; // >60% of range is directional = trending
    
    // Get coherence from analysis
    const analysis = vfmdAgent.getAnalysisForUI(window);
    const coherence = analysis?.field_metrics?.coherence || 0;
    const predictedTrending = coherence > 50; // High coherence = trending
    
    results.totalEvals++;
    
    if (isTrending && predictedTrending) {
      results.highCoherenceInTrends++;
    } else if (!isTrending && !predictedTrending) {
      results.lowCoherenceInRanges++;
    }
  }
  
  results.accuracy = (results.highCoherenceInTrends + results.lowCoherenceInRanges) / results.totalEvals * 100;
  
  return results;
}

// ============================================================================
// TEST 4: REGIME CLASSIFICATION ACCURACY
// ============================================================================

function testRegimeClassificationAccuracy(ticks: MarketTick[]): {
  correct: number;
  total: number;
  accuracy: number;
} {
  const results = { correct: 0, total: 0, accuracy: 0 };

  const vfmdAgent = new VFMDPhysicsAgent('test', 'balanced');
  
  for (let i = 100; i < ticks.length - 50; i += 100) {
    const window = ticks.slice(i, i + 100);
    
    // Calculate actual regime from price behavior (physics-based ground truth)
    const closes = window.map(t => t.close);
    const opens = window.map(t => t.open);
    const highs = window.map(t => t.high);
    const lows = window.map(t => t.low);
    
    // 1. Calculate directional strength
    const firstClose = closes[0];
    const lastClose = closes[closes.length - 1];
    const directionalMove = Math.abs(lastClose - firstClose) / firstClose;
    
    // 2. Calculate trend consistency
    let upBars = 0;
    let downBars = 0;
    for (let j = 1; j < closes.length; j++) {
      if (closes[j] > closes[j - 1]) upBars++;
      else downBars++;
    }
    const trendConsistency = Math.max(upBars, downBars) / closes.length;
    
    // 3. Calculate volatility (range-based)
    let totalRange = 0;
    for (let j = 0; j < window.length; j++) {
      totalRange += (highs[j] - lows[j]) / (closes[j] || 1);
    }
    const avgVolatility = totalRange / window.length;
    
    // 4. Determine ground truth regime from price behavior
    let actualRegime = 'consolidation'; // Default
    
    if (directionalMove > 0.03 && trendConsistency > 0.55) {
      actualRegime = 'trending'; // Strong directional move with consistent direction
    } else if (avgVolatility > 0.03 && trendConsistency < 0.52) {
      actualRegime = 'turbulent'; // High volatility with reversals
    } else if (directionalMove < 0.01 && avgVolatility < 0.015) {
      actualRegime = 'quiet'; // Low movement, low volatility
    }
    
    // Get predicted regime from VFMD
    const analysis = vfmdAgent.getAnalysisForUI(window);
    const predictedRegime = analysis?.regime?.classification || 'unknown';
    
    results.total++;
    
    // More flexible matching: check if predictions align with price behavior
    const isTrending = ['laminar_trend', 'uptrend', 'downtrend', 'trending', 'bullish', 'bearish'].includes(predictedRegime);
    const isConsolidating = ['consolidation', 'quiet', 'neutral'].includes(predictedRegime);
    const isTurbulent = ['turbulent_chop', 'turbulent', 'chaotic'].includes(predictedRegime);
    
    if (actualRegime === 'trending' && isTrending) {
      results.correct++;
    } else if (actualRegime === 'consolidation' && isConsolidating) {
      results.correct++;
    } else if (actualRegime === 'turbulent' && isTurbulent) {
      results.correct++;
    } else if (actualRegime === 'quiet' && isConsolidating) {
      results.correct++;
    }
  }
  
  results.accuracy = (results.correct / results.total) * 100;
  return results;
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

export async function runPhysicsValidation(symbol: string = 'BTC/USDT'): Promise<ValidationReport> {
  console.log('\n' + '='.repeat(80));
  console.log('PHYSICS THEORY VALIDATION - QUANTITATIVE TESTING');
  console.log('='.repeat(80) + '\n');

  try {
    // Fetch market data
    const frames = await storage.getMarketFrames(symbol, 500);
    
    if (!frames || frames.length < 200) {
      throw new Error(`Insufficient data: need 200+ frames, got ${frames?.length || 0}`);
    }

    // Convert to ticks
    const ticks: MarketTick[] = frames.map(frame => ({
      timestamp: new Date(frame.timestamp).getTime(),
      open: (frame.price as any).open || 0,
      high: (frame.price as any).high || 0,
      low: (frame.price as any).low || 0,
      close: (frame.price as any).close || 0,
      volume: frame.volume,
      bidVolume: (frame.orderFlow as any)?.bidVolume,
      askVolume: (frame.orderFlow as any)?.askVolume
    }));

    console.log(`✓ Loaded ${ticks.length} market ticks for ${symbol}\n`);

    // Run all validation tests
    console.log('TEST 1: PEG BREAKOUT PREDICTION');
    console.log('-'.repeat(80));
    const pegResults = testPEGBreakoutPrediction(ticks);
    console.log(`  Breakouts detected: ${pegResults.totalBreakouts}`);
    console.log(`  Preceded by PEG spike: ${pegResults.pegBreakouts}`);
    console.log(`  ✓ Correlation: ${pegResults.correlation.toFixed(1)}%`);
    console.log(`  ✓ Lead time: ${pegResults.avgLeadTime.toFixed(1)} bars\n`);

    console.log('TEST 2: TURBULENCE INDEX ACCURACY');
    console.log('-'.repeat(80));
    const turbResults = testTurbulenceAccuracy(ticks);
    console.log(`  Zones analyzed: ${turbResults.totalZones}`);
    console.log(`  Correctly identified choppy: ${turbResults.correctChoppy}`);
    console.log(`  Correctly identified trending: ${turbResults.correctTrend}`);
    console.log(`  ✓ Accuracy: ${turbResults.accuracy.toFixed(1)}%\n`);

    console.log('TEST 3: COHERENCE & REGIME ALIGNMENT');
    console.log('-'.repeat(80));
    const coherenceResults = testCoherenceRegimeAlignment(ticks);
    console.log(`  Evaluations: ${coherenceResults.totalEvals}`);
    console.log(`  High coherence in trends: ${coherenceResults.highCoherenceInTrends}`);
    console.log(`  Low coherence in ranges: ${coherenceResults.lowCoherenceInRanges}`);
    console.log(`  ✓ Accuracy: ${coherenceResults.accuracy.toFixed(1)}%\n`);

    console.log('TEST 4: REGIME CLASSIFICATION ACCURACY');
    console.log('-'.repeat(80));
    const regimeResults = testRegimeClassificationAccuracy(ticks);
    console.log(`  Regimes evaluated: ${regimeResults.total}`);
    console.log(`  Correct classifications: ${regimeResults.correct}`);
    console.log(`  ✓ Accuracy: ${regimeResults.accuracy.toFixed(1)}%\n`);

    // Calculate overall validation score
    const avgAccuracy = (pegResults.correlation + turbResults.accuracy + coherenceResults.accuracy + regimeResults.accuracy) / 4;
    const allTestsPassed = pegResults.correlation > 50 && 
                          turbResults.accuracy > 60 && 
                          coherenceResults.accuracy > 65 && 
                          regimeResults.accuracy > 70;

    console.log('='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Overall Physics Validation Score: ${avgAccuracy.toFixed(1)}%`);
    console.log(`All Critical Tests Passed: ${allTestsPassed ? '✓ YES' : '✗ NO'}\n`);

    const report: ValidationReport = {
      timestamp: new Date(),
      symbol,
      dataPoints: ticks.length,
      metrics: {
        pegBreakoutCorrelation: pegResults.correlation,
        pegLeadTime: pegResults.avgLeadTime,
        turbulenceAccuracy: turbResults.accuracy,
        coherenceRegimeAccuracy: coherenceResults.accuracy,
        regimeClassificationAccuracy: regimeResults.accuracy
      },
      testsPassed: allTestsPassed,
      summary: `Physics validation ${allTestsPassed ? 'PASSED' : 'FAILED'} with ${avgAccuracy.toFixed(1)}% overall accuracy`
    };

    return report;
  } catch (err) {
    console.error('Validation error:', err);
    throw err;
  }
}

// Export for use in API routes
export { ValidationReport, ValidationMetrics };
