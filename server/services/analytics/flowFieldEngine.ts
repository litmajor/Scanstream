/**
 * Flow Field Engine
 * 
 * Computes force vectors, pressure fields, turbulence, and energy gradients
 * from market tick/candle data. This provides a physics-based perspective on
 * market dynamics.
 * 
 * Key Concepts:
 * - Force: Directional momentum combining price change and volume
 * - Pressure: Accumulated stress from order imbalance and volatility
 * - Turbulence: Variance in force magnitudes (market chaos)
 * - Energy Gradient: Rate of change in pressure (acceleration/deceleration)
 */

import { variance, vectorMagnitude, movingAverage, standardDeviation } from "../../utils/mathUtils";

/**
 * Input data point for flow field calculation
 */
export interface FlowFieldPoint {
  timestamp: number;
  price: number;
  volume: number;
  bidVolume?: number;
  askVolume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

/**
 * Computed flow field metrics
 */
export interface FlowFieldResult {
  // Force metrics
  latestForce: number;           // Most recent force magnitude
  averageForce: number;          // Mean force over period
  maxForce: number;              // Peak force observed
  forceDirection: number;        // Angle in radians (-π to π)
  
  // Pressure metrics
  pressure: number;              // Current market pressure
  averagePressure: number;       // Mean pressure over period
  pressureTrend: 'rising' | 'falling' | 'stable';
  
  // Turbulence metrics
  turbulence: number;            // Variance in forces (chaos)
  turbulenceLevel: 'low' | 'medium' | 'high' | 'extreme';
  
  // Energy gradient
  energyGradient: number;        // Rate of pressure change
  energyTrend: 'accelerating' | 'decelerating' | 'stable';
  
  // Vector field
  forceVectors: Array<{
    timestamp: number;
    fx: number;  // X component (price momentum)
    fy: number;  // Y component (order imbalance)
    magnitude: number;
    angle: number;
  }>;
  
  // Summary stats
  totalDataPoints: number;
  timeSpan: number; // milliseconds
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Configuration for flow field computation
 */
export interface FlowFieldConfig {
  turbulenceThresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  pressureSmoothingPeriod?: number;
  energyGradientSensitivity?: number;
}

const DEFAULT_CONFIG: FlowFieldConfig = {
  turbulenceThresholds: {
    low: 0.0001,
    medium: 0.001,
    high: 0.01,
  },
  pressureSmoothingPeriod: 5,
  energyGradientSensitivity: 1.0,
};

/**
 * Main flow field computation engine
 */
export function computeFlowField(
  data: FlowFieldPoint[],
  config: FlowFieldConfig = DEFAULT_CONFIG
): FlowFieldResult {
  // Validate input
  if (!data || data.length < 2) {
    throw new Error('Flow field requires at least 2 data points');
  }

  // Merge config with defaults
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Storage for computed values
  const forces: number[] = [];
  const pressures: number[] = [];
  const forceVectors: FlowFieldResult['forceVectors'] = [];
  
  let lastPressure = 0;
  let bullishForces = 0;
  let bearishForces = 0;

  // Compute force vectors for each tick
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    // Calculate price change (normalized by previous price)
    const priceChange = (curr.price - prev.price) / prev.price;
    
    // Calculate volume weight (relative volume strength)
    const volumeWeight = curr.volume / Math.max(prev.volume, 1);
    
    // Calculate order imbalance (if bid/ask data available)
    let orderImbalance = 0;
    if (curr.bidVolume !== undefined && curr.askVolume !== undefined) {
      const totalOrderVolume = curr.bidVolume + curr.askVolume;
      orderImbalance = totalOrderVolume > 0
        ? (curr.bidVolume - curr.askVolume) / totalOrderVolume
        : 0;
    }
    
    // Calculate volatility (if OHLC data available)
    let volatility = 0;
    if (curr.high !== undefined && curr.low !== undefined) {
      volatility = (curr.high - curr.low) / curr.price;
    }

    // Force vector components
    // Fx: Price momentum weighted by volume
    const Fx = priceChange * volumeWeight;
    
    // Fy: Order flow imbalance (buying vs selling pressure)
    const Fy = orderImbalance;

    // Calculate force magnitude
    const forceMagnitude = vectorMagnitude(Fx, Fy);
    forces.push(forceMagnitude);
    
    // Calculate force angle (direction)
    const forceAngle = Math.atan2(Fy, Fx);

    // Calculate pressure (accumulated stress)
    // Pressure combines absolute price movement, volume, and volatility
    const pressure = Math.abs(Fx) + Math.abs(Fy) + volatility;
    pressures.push(pressure);

    // Store vector data
    forceVectors.push({
      timestamp: curr.timestamp,
      fx: Fx,
      fy: Fy,
      magnitude: forceMagnitude,
      angle: forceAngle,
    });
    
    // Track directional bias
    if (Fx > 0) bullishForces++;
    else if (Fx < 0) bearishForces++;
  }

  // Smooth pressure values to reduce noise
  const smoothedPressures = movingAverage(pressures, cfg.pressureSmoothingPeriod || 5);
  
  // Calculate turbulence (variance in force magnitudes)
  const turbulence = variance(forces);
  
  // Determine turbulence level
  let turbulenceLevel: FlowFieldResult['turbulenceLevel'] = 'low';
  if (turbulence > cfg.turbulenceThresholds!.high!) {
    turbulenceLevel = 'extreme';
  } else if (turbulence > cfg.turbulenceThresholds!.medium!) {
    turbulenceLevel = 'high';
  } else if (turbulence > cfg.turbulenceThresholds!.low!) {
    turbulenceLevel = 'medium';
  }

  // Calculate energy gradients (rate of pressure change)
  const energyGradients: number[] = [];
  for (let i = 1; i < smoothedPressures.length; i++) {
    const gradient = (smoothedPressures[i] - smoothedPressures[i - 1]) * 
                     (cfg.energyGradientSensitivity || 1.0);
    energyGradients.push(Math.abs(gradient));
  }

  // Determine pressure trend
  const recentPressures = smoothedPressures.slice(-5).filter(p => !isNaN(p));
  let pressureTrend: FlowFieldResult['pressureTrend'] = 'stable';
  if (recentPressures.length >= 2) {
    const pressureChange = recentPressures[recentPressures.length - 1] - recentPressures[0];
    if (pressureChange > 0.01) pressureTrend = 'rising';
    else if (pressureChange < -0.01) pressureTrend = 'falling';
  }

  // Determine energy trend
  const recentGradients = energyGradients.slice(-5);
  let energyTrend: FlowFieldResult['energyTrend'] = 'stable';
  if (recentGradients.length >= 2) {
    const gradientChange = recentGradients[recentGradients.length - 1] - recentGradients[0];
    if (gradientChange > 0.001) energyTrend = 'accelerating';
    else if (gradientChange < -0.001) energyTrend = 'decelerating';
  }

  // Determine dominant direction
  const totalForces = bullishForces + bearishForces;
  let dominantDirection: FlowFieldResult['dominantDirection'] = 'neutral';
  if (totalForces > 0) {
    const bullishRatio = bullishForces / totalForces;
    if (bullishRatio > 0.6) dominantDirection = 'bullish';
    else if (bullishRatio < 0.4) dominantDirection = 'bearish';
  }

  // Calculate final metrics
  const avgForce = forces.reduce((sum, f) => sum + f, 0) / forces.length;
  const maxForce = Math.max(...forces);
  const latestForce = forces[forces.length - 1];
  
  const avgPressure = smoothedPressures
    .filter(p => !isNaN(p))
    .reduce((sum, p) => sum + p, 0) / smoothedPressures.filter(p => !isNaN(p)).length;
  
  const latestPressure = smoothedPressures[smoothedPressures.length - 1] || 0;
  
  const latestGradient = energyGradients[energyGradients.length - 1] || 0;
  
  // Get latest force direction
  const latestVector = forceVectors[forceVectors.length - 1];
  const forceDirection = latestVector ? latestVector.angle : 0;

  // Calculate time span
  const timeSpan = data[data.length - 1].timestamp - data[0].timestamp;

  return {
    // Force metrics
    latestForce,
    averageForce: avgForce,
    maxForce,
    forceDirection,
    
    // Pressure metrics
    pressure: latestPressure,
    averagePressure: avgPressure,
    pressureTrend,
    
    // Turbulence metrics
    turbulence,
    turbulenceLevel,
    
    // Energy gradient
    energyGradient: latestGradient,
    energyTrend,
    
    // Vector field
    forceVectors,
    
    // Summary stats
    totalDataPoints: data.length,
    timeSpan,
    dominantDirection,
  };
}

/**
 * Compute flow field for multiple symbols in parallel
 */
export async function computeFlowFieldBatch(
  dataBySymbol: Map<string, FlowFieldPoint[]>,
  config?: FlowFieldConfig
): Promise<Map<string, FlowFieldResult>> {
  const results = new Map<string, FlowFieldResult>();
  
  for (const [symbol, data] of dataBySymbol.entries()) {
    try {
      const result = computeFlowField(data, config);
      results.set(symbol, result);
    } catch (error) {
      console.error(`Flow field computation failed for ${symbol}:`, error);
    }
  }
  
  return results;
}

/**
 * Analyze flow field divergence (when force and price diverge)
 */
export function detectFlowDivergence(
  flowField: FlowFieldResult,
  priceData: FlowFieldPoint[]
): {
  hasDivergence: boolean;
  type: 'bullish' | 'bearish' | 'none';
  strength: number;
} {
  // Check if price is making new highs/lows while force is declining
  const recentVectors = flowField.forceVectors.slice(-10);
  const recentPrices = priceData.slice(-10);
  
  if (recentVectors.length < 5 || recentPrices.length < 5) {
    return { hasDivergence: false, type: 'none', strength: 0 };
  }
  
  // Calculate price trend
  const priceSlope = (recentPrices[recentPrices.length - 1].price - recentPrices[0].price) / 
                     recentPrices[0].price;
  
  // Calculate force trend
  const forceMagnitudes = recentVectors.map(v => v.magnitude);
  const forceSlope = (forceMagnitudes[forceMagnitudes.length - 1] - forceMagnitudes[0]) / 
                     forceMagnitudes[0];
  
  // Detect divergence
  const hasDivergence = (priceSlope > 0 && forceSlope < -0.1) || 
                        (priceSlope < 0 && forceSlope > 0.1);
  
  let type: 'bullish' | 'bearish' | 'none' = 'none';
  let strength = 0;
  
  if (hasDivergence) {
    // Bearish divergence: Price up, force down
    if (priceSlope > 0 && forceSlope < 0) {
      type = 'bearish';
      strength = Math.abs(forceSlope);
    }
    // Bullish divergence: Price down, force up
    else if (priceSlope < 0 && forceSlope > 0) {
      type = 'bullish';
      strength = Math.abs(forceSlope);
    }
  }
  
  return { hasDivergence, type, strength };
}

