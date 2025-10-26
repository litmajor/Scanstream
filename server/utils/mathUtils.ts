/**
 * Mathematical Utilities for Analytics
 * Reusable functions for variance, normalization, statistical calculations
 */

/**
 * Calculate variance of an array of numbers
 */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Normalize values to 0-1 range
 */
export function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range === 0) return values.map(() => 0.5);
  
  return values.map(val => (val - min) / range);
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    
    const slice = values.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, val) => sum + val, 0) / period;
    result.push(avg);
  }
  
  return result;
}

/**
 * Calculate exponential moving average
 */
export function exponentialMovingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is simple average
  if (values.length > 0) {
    const firstAvg = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    result.push(firstAvg);
    
    // Subsequent EMAs use formula: (Close - EMA(previous)) × multiplier + EMA(previous)
    for (let i = 1; i < values.length; i++) {
      const ema = (values[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  
  return result;
}

/**
 * Calculate vector magnitude
 */
export function vectorMagnitude(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Calculate vector angle in radians
 */
export function vectorAngle(x: number, y: number): number {
  return Math.atan2(y, x);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Calculate correlation coefficient between two arrays
 */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSqX += diffX * diffX;
    sumSqY += diffY * diffY;
  }
  
  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate z-score (standard score)
 */
export function zScore(value: number, values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const std = standardDeviation(values);
  
  return std === 0 ? 0 : (value - mean) / std;
}

/**
 * Calculate percentile rank
 */
export function percentileRank(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  
  if (index === -1) return 100;
  if (index === 0) return 0;
  
  return (index / sorted.length) * 100;
}

/**
 * Smooth data using simple moving average
 */
export function smoothData(values: number[], windowSize: number = 3): number[] {
  return movingAverage(values, windowSize);
}

/**
 * Calculate rate of change
 */
export function rateOfChange(values: number[], period: number = 1): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(0);
      continue;
    }
    
    const change = (values[i] - values[i - period]) / values[i - period];
    result.push(change);
  }
  
  return result;
}

