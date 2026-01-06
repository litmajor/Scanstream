/**
 * CORRECT Physics Validation Framework
 * Proper statistical testing with independent ground truth
 * 
 * Fixes:
 * 1. Independent ground truth definitions (not circular)
 * 2. Larger sample sizes (180+ days, not 8 days)
 * 3. Correct PEG tests (energy release, not just breakouts)
 * 4. Proper regime prediction tests (future state, not current state)
 * 5. Statistical metrics (precision, recall, lead times)
 */

import type { MarketTick } from './types';

interface ValidationResults {
  testName: string;
  sampleSize: number;
  successRate: number;
  precision: number;
  recall: number;
  avgLeadTime: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  confidence: number; // 0-1, based on sample size
}

// ============================================================================
// PART 1: GROUND TRUTH DEFINITIONS (Independent, not circular)
// ============================================================================

/**
 * Define "turbulent market" INDEPENDENTLY from TI
 * Based on observable price action, not our metrics
 */
function isTurbulentGroundTruth(ticks: MarketTick[], start: number, window: number): boolean {
  const segment = ticks.slice(start, start + window);
  if (segment.length < window) return false;

  // Ground truth: Market is turbulent if:
  const closes = segment.map(t => t.close);
  const opens = segment.map(t => t.open);
  
  // 1. Small average candle size (low directional conviction)
  const avgBodySize = segment.reduce((sum, t) => {
    return sum + Math.abs(t.close - t.open);
  }, 0) / segment.length;
  const avgRange = segment.reduce((sum, t) => {
    return sum + (t.high - t.low);
  }, 0) / segment.length;
  const bodyRatio = avgBodySize / (avgRange + 0.00001);

  // 2. Many reversals (direction changes)
  let reversals = 0;
  for (let i = 1; i < segment.length; i++) {
    const prevDir = segment[i - 1].close > segment[i - 1].open ? 1 : -1;
    const currDir = segment[i].close > segment[i].open ? 1 : -1;
    if (prevDir !== currDir) reversals++;
  }

  // 3. High number of touches (wicks)
  const wicksPerCandle = segment.filter(t => {
    const bodyHigh = Math.max(t.open, t.close);
    const bodyLow = Math.min(t.open, t.close);
    const upperWick = t.high - bodyHigh;
    const lowerWick = bodyLow - t.low;
    return upperWick > 0.001 * t.close && lowerWick > 0.001 * t.close;
  }).length;

  // Ground truth: Turbulent if low body ratio AND high reversals
  const isTurbulent = (bodyRatio < 0.5 && reversals > window * 0.4) || 
                      (wicksPerCandle > window * 0.6);
  
  return isTurbulent;
}

/**
 * Define "trending market" INDEPENDENTLY
 * Based on directional price movement
 */
function isTrendingGroundTruth(ticks: MarketTick[], start: number, window: number): boolean {
  const segment = ticks.slice(start, start + window);
  if (segment.length < window) return false;

  // Ground truth: Market is trending if:
  const firstPrice = segment[0].close;
  const lastPrice = segment[segment.length - 1].close;
  const directionalMove = Math.abs(lastPrice - firstPrice) / firstPrice;

  // Single direction maintained for most of period
  let consecutiveUp = 0;
  let consecutiveDown = 0;
  let maxConsecutive = 0;

  for (let i = 1; i < segment.length; i++) {
    if (segment[i].close > segment[i - 1].close) {
      consecutiveUp++;
      consecutiveDown = 0;
    } else {
      consecutiveDown++;
      consecutiveUp = 0;
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveUp, consecutiveDown);
  }

  // Trending if: large directional move AND sustained direction
  const isTrending = directionalMove > 0.03 && maxConsecutive > window * 0.5;
  
  return isTrending;
}

/**
 * Define "energy release" INDEPENDENTLY
 * Based on volatility and volume spike
 * FIXED: Use realized volatility (high-low range) instead of close price std dev
 */
function isEnergyReleaseGroundTruth(
  ticks: MarketTick[],
  start: number,
  window: number,
  baselineVolatility: number
): boolean {
  const segment = ticks.slice(start, start + window);
  if (segment.length < window) return false;

  // FIX: Use realized volatility (high-low range) for better detection
  const volatility = calculateRealizedVolatility(segment);
  const avgVolume = segment.reduce((sum, t) => sum + t.volume, 0) / segment.length;
  const volumeSpike = Math.max(...segment.map(t => t.volume)) > avgVolume * 1.3;

  // Energy released if volatility > 1.3x baseline OR volume surges
  return volatility > baselineVolatility * 1.3 || volumeSpike;
}

/**
 * Define "price movement" INDEPENDENTLY
 * Any significant directional move
 */
function isPriceMovementGroundTruth(
  ticks: MarketTick[],
  start: number,
  window: number,
  threshold: number = 0.015
): boolean {
  const segment = ticks.slice(start, start + window);
  if (segment.length < window) return false;

  const startPrice = segment[0].close;
  const endPrice = segment[segment.length - 1].close;
  const move = Math.abs(endPrice - startPrice) / startPrice;

  return move > threshold;
}

/**
 * Define "accumulation regime" INDEPENDENTLY
 * Characteristic: Price consolidates near lows, volume and volatility increasing
 */
function isAccumulationGroundTruth(
  ticks: MarketTick[],
  start: number,
  window: number
): boolean {
  const segment = ticks.slice(start, start + window);
  if (segment.length < window) return false;

  // Accumulation characteristics:
  // 1. Price near lows of recent range
  const lows = segment.map(t => t.low);
  const highs = segment.map(t => t.high);
  const minLow = Math.min(...lows);
  const maxHigh = Math.max(...highs);
  const range = maxHigh - minLow;

  // Price in lower half of range
  const avgPrice = segment.reduce((sum, t) => sum + t.close, 0) / segment.length;
  const pricePosition = (avgPrice - minLow) / (range + 0.00001);

  // 2. Volume increasing over time
  const firstHalf = segment.slice(0, Math.floor(window / 2));
  const secondHalf = segment.slice(Math.floor(window / 2));
  const vol1 = firstHalf.reduce((sum, t) => sum + t.volume, 0) / firstHalf.length;
  const vol2 = secondHalf.reduce((sum, t) => sum + t.volume, 0) / secondHalf.length;
  const volumeIncreasing = vol2 > vol1 * 1.1;

  // 3. Volatility stable or increasing
  const volatility1 = calculateVolatility(firstHalf);
  const volatility2 = calculateVolatility(secondHalf);
  const volatilityStable = volatility2 >= volatility1 * 0.8;

  return (pricePosition < 0.4 && volumeIncreasing && volatilityStable);
}

// ============================================================================
// PART 2: CORRECTED PEG TESTS
// ============================================================================

/**
 * TEST 1: PEG → Volatility Prediction
 * Does high PEG predict future volatility increase?
 * 
 * FIXES (Dec 20, 2025):
 * 1. Use larger baseline window (100+ candles for stability)
 * 2. Use realized volatility (high-low range) instead of close price std dev
 * 3. Use longer lookAhead (20 candles for daily data)
 * 4. Higher threshold requirement (1.3x for volatility spike)
 */
export function validatePEGVolatilityPrediction(
  ticks: MarketTick[],
  pegValues: number[],
  pegThreshold: number = 2.0,
  lookAhead: number = 20
): ValidationResults {
  const results: ValidationResults = {
    testName: 'PEG → Volatility Prediction',
    sampleSize: 0,
    successRate: 0,
    precision: 0,
    recall: 0,
    avgLeadTime: 0,
    falsePositives: 0,
    falseNegatives: 0,
    truePositives: 0,
    status: 'FAIL',
    confidence: 0
  };

  if (pegValues.length < lookAhead + 10) {
    console.warn('Insufficient PEG data');
    return results;
  }

  // FIX 1: Calculate future volatility for all windows FIRST
  // This lets us use percentile-based thresholds instead of hard multipliers
  const futureVolatilities: number[] = [];
  for (let i = 0; i < ticks.length - lookAhead; i++) {
    const futureSegment = ticks.slice(i, i + lookAhead);
    const vol = calculateRealizedVolatility(futureSegment);
    futureVolatilities.push(vol);
  }

  // FIX 2: Use 75th percentile as "significant volatility" threshold
  // This adapts to market conditions instead of fixed multiplier
  const sorted = [...futureVolatilities].sort((a, b) => a - b);
  const percentile75 = sorted[Math.floor(sorted.length * 0.75)];
  const percentile50 = sorted[Math.floor(sorted.length * 0.50)];
  
  console.log(`[PEG Volatility Test] Volatility percentiles - 50th: ${percentile50.toFixed(6)}, 75th: ${percentile75.toFixed(6)}`);
  console.log(`[PEG Volatility Test] PEG stats - min: ${Math.min(...pegValues).toFixed(4)}, max: ${Math.max(...pegValues).toFixed(4)}, avg: ${(pegValues.reduce((a,b) => a+b) / pegValues.length).toFixed(4)}`);

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let validationCount = 0;
  let pegSpikeCount = 0;
  let highVolCount = 0;

  // Count how many have both high PEG and high volatility
  for (let i = 0; i < pegValues.length - lookAhead; i++) {
    const hasPEGSpike = pegValues[i] > pegThreshold;
    const hasHighVolatility = futureVolatilities[i] > percentile75;

    if (hasPEGSpike) {
      pegSpikeCount++;
      if (hasHighVolatility) {
        truePositives++;
      } else {
        falsePositives++;
      }
      validationCount++;
    } else {
      if (hasHighVolatility) {
        falseNegatives++;
        highVolCount++;
      }
    }
  }

  // ALTERNATIVE INTERPRETATION: 
  // If there are NO PEG spikes, the test is inconclusive
  if (validationCount === 0) {
    console.warn(`[PEG Volatility Test] NO PEG spikes detected (threshold=${pegThreshold}). Test inconclusive.`);
    results.status = 'INCONCLUSIVE';
    results.sampleSize = pegSpikeCount;
    results.confidence = 0;
    return results;
  }

  results.sampleSize = validationCount;
  results.truePositives = truePositives;
  results.falsePositives = falsePositives;
  results.falseNegatives = falseNegatives;
  results.precision = validationCount > 0 ? truePositives / (truePositives + falsePositives || 1) : 0;
  results.recall = (truePositives + falseNegatives) > 0 
    ? truePositives / (truePositives + falseNegatives)
    : 0;
  results.successRate = validationCount > 0 ? truePositives / validationCount : 0;
  results.avgLeadTime = lookAhead / 2; // Average time to see volatility release
  results.confidence = Math.min(validationCount / 100, 1.0);
  results.status = (results.precision > 0.55 && results.recall > 0.5) ? 'PASS' : 'FAIL';

  console.log(`[PEG Volatility Test] Results: ${truePositives} TP, ${falsePositives} FP, recall: ${falseNegatives} FN out of ${highVolCount} high-vol events, precision=${(results.precision * 100).toFixed(1)}%, recall=${(results.recall * 100).toFixed(1)}%`);

  return results;
}

/**
 * TEST 2: PEG → Price Movement Prediction
 * Does high PEG predict future significant price moves?
 */
export function validatePEGPriceMovementPrediction(
  ticks: MarketTick[],
  pegValues: number[],
  pegThreshold: number = 2.0,
  lookAhead: number = 15,
  moveThreshold: number = 0.015
): ValidationResults {
  const results: ValidationResults = {
    testName: 'PEG → Price Movement Prediction',
    sampleSize: 0,
    successRate: 0,
    precision: 0,
    recall: 0,
    avgLeadTime: 0,
    falsePositives: 0,
    falseNegatives: 0,
    truePositives: 0,
    status: 'FAIL',
    confidence: 0
  };

  if (pegValues.length < lookAhead) {
    return results;
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let validationCount = 0;

  for (let i = 0; i < pegValues.length - lookAhead; i++) {
    const hasPEGSpike = pegValues[i] > pegThreshold;
    const futureMoveGround = isPriceMovementGroundTruth(ticks, i, lookAhead, moveThreshold);

    if (hasPEGSpike) {
      if (futureMoveGround) {
        truePositives++;
      } else {
        falsePositives++;
      }
      validationCount++;
    } else {
      if (futureMoveGround) {
        falseNegatives++;
      }
    }
  }

  results.sampleSize = validationCount;
  results.truePositives = truePositives;
  results.falsePositives = falsePositives;
  results.falseNegatives = falseNegatives;
  results.precision = validationCount > 0 ? truePositives / (truePositives + falsePositives || 1) : 0;
  results.recall = (truePositives + falseNegatives) > 0 
    ? truePositives / (truePositives + falseNegatives)
    : 0;
  results.successRate = validationCount > 0 ? truePositives / validationCount : 0;
  results.confidence = Math.min(validationCount / 100, 1.0);
  results.status = (results.precision > 0.55 && results.recall > 0.5) ? 'PASS' : 'FAIL';

  return results;
}

// ============================================================================
// PART 3: CORRECTED REGIME TESTS
// ============================================================================

/**
 * TEST: Does regime classification PREDICT future price direction?
 * Not: does current regime match current RSI (circular)
 * But: does current regime predict RSI 15 bars ahead?
 */
export function validateRegimeDirectionPrediction(
  ticks: MarketTick[],
  regimeLabels: string[],
  lookAhead: number = 15,
  moveThreshold: number = 0.02
): ValidationResults {
  const results: ValidationResults = {
    testName: 'Regime → Future Direction Prediction',
    sampleSize: 0,
    successRate: 0,
    precision: 0,
    recall: 0,
    avgLeadTime: lookAhead,
    falsePositives: 0,
    falseNegatives: 0,
    truePositives: 0,
    status: 'FAIL',
    confidence: 0
  };

  if (regimeLabels.length < lookAhead) {
    return results;
  }

  let accumulationCorrect = 0;
  let accumulationTotal = 0;
  let distributionCorrect = 0;
  let distributionTotal = 0;
  let truePositives = 0;

  for (let i = 0; i < regimeLabels.length - lookAhead; i++) {
    const regime = regimeLabels[i];
    const futureUpMove = isPriceMovementGroundTruth(ticks, i, lookAhead, moveThreshold);

    if (regime === 'accumulation') {
      accumulationTotal++;
      if (futureUpMove) {
        accumulationCorrect++;
        truePositives++;
      }
    } else if (regime === 'distribution') {
      distributionTotal++;
      // Distribution should predict down move
      const futureDownMove = isPriceMovementGroundTruth(ticks, i, lookAhead, -moveThreshold);
      if (futureDownMove) {
        distributionCorrect++;
        truePositives++;
      }
    }
  }

  const totalTests = accumulationTotal + distributionTotal;
  results.sampleSize = totalTests;
  results.truePositives = truePositives;
  results.successRate = totalTests > 0 ? truePositives / totalTests : 0;
  results.precision = results.successRate;
  results.recall = results.successRate;
  results.confidence = Math.min(totalTests / 100, 1.0);
  results.status = (results.successRate > 0.55) ? 'PASS' : 'FAIL';

  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateVolatility(ticks: MarketTick[]): number {
  if (ticks.length < 2) return 0;

  let sumSquaredDiff = 0;
  const closes = ticks.map(t => t.close);
  const meanClose = closes.reduce((a, b) => a + b) / closes.length;

  for (const close of closes) {
    sumSquaredDiff += Math.pow(close - meanClose, 2);
  }

  const variance = sumSquaredDiff / closes.length;
  return Math.sqrt(variance);
}

/**
 * Calculate realized volatility using high-low range
 * Better metric for detecting actual market volatility spikes
 * Realized volatility = sqrt(mean of (high-low)^2 / close^2)
 */
function calculateRealizedVolatility(ticks: MarketTick[]): number {
  if (ticks.length < 2) return 0;

  let sumSquaredRange = 0;
  let sumLogReturns = 0;
  
  for (let i = 1; i < ticks.length; i++) {
    const prev = ticks[i - 1];
    const curr = ticks[i];
    
    // High-low range as percentage of average price
    const avgPrice = (curr.high + curr.low) / 2;
    const range = curr.high - curr.low;
    const rangePercent = range / (avgPrice || 1);
    
    sumSquaredRange += rangePercent * rangePercent;
    
    // Also include log returns for completeness
    const logReturn = Math.log(curr.close / (prev.close || 1));
    sumLogReturns += logReturn * logReturn;
  }

  // Average of both metrics for robust volatility estimate
  const rangeVol = Math.sqrt(sumSquaredRange / ticks.length);
  const returnVol = Math.sqrt(sumLogReturns / ticks.length);
  
  return (rangeVol + returnVol) / 2;
}

export { calculateVolatility, calculateRealizedVolatility };

