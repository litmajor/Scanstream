/**
 * Flow Field Integration Layer
 * 
 * Bridges Flow Field Engine with Scanner Pipeline
 * Converts scanner data to flow field format and enriches signals
 */

import { computeFlowField, type FlowFieldPoint, type FlowFieldResult } from './flowFieldEngine';

/**
 * Convert scanner candle data to flow field points
 */
export function convertCandlesToFlowPoints(candles: any[]): FlowFieldPoint[] {
  return candles.map(candle => ({
    timestamp: new Date(candle.timestamp).getTime(),
    price: candle.close,
    volume: candle.volume,
    bidVolume: candle.bidVolume,
    askVolume: candle.askVolume,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    close: candle.close,
  }));
}

/**
 * Calculate flow-enhanced signal score
 * Combines traditional signal strength with flow field metrics
 */
export function calculateFlowEnhancedScore(
  baseScore: number,
  flowField: FlowFieldResult
): {
  enhancedScore: number;
  flowBoost: number;
  confidenceAdjustment: number;
  riskAdjustment: number;
} {
  // Flow boost based on force magnitude and direction alignment
  let flowBoost = 0;
  
  // Strong force in trending direction = boost signal
  if (flowField.latestForce > flowField.averageForce * 1.2) {
    flowBoost += 10; // Strong momentum confirmation
  }
  
  // Low turbulence = higher confidence
  if (flowField.turbulenceLevel === 'low') {
    flowBoost += 15; // Clean trend, high confidence
  } else if (flowField.turbulenceLevel === 'medium') {
    flowBoost += 5; // Normal conditions
  } else if (flowField.turbulenceLevel === 'high') {
    flowBoost -= 10; // Choppy market, reduce confidence
  } else { // extreme
    flowBoost -= 20; // Very risky conditions
  }
  
  // Pressure alignment
  if (flowField.pressureTrend === 'rising' && flowField.dominantDirection === 'bullish') {
    flowBoost += 10; // Building bullish pressure
  } else if (flowField.pressureTrend === 'falling' && flowField.dominantDirection === 'bearish') {
    flowBoost += 10; // Building bearish pressure
  }
  
  // Energy gradient (acceleration)
  if (flowField.energyTrend === 'accelerating') {
    flowBoost += 8; // Momentum building
  } else if (flowField.energyTrend === 'decelerating') {
    flowBoost -= 8; // Momentum fading
  }
  
  // Confidence adjustment based on turbulence
  const confidenceAdjustment = {
    'low': 1.2,
    'medium': 1.0,
    'high': 0.8,
    'extreme': 0.5
  }[flowField.turbulenceLevel];
  
  // Risk adjustment (stop loss multiplier)
  const riskAdjustment = {
    'low': 0.8,      // Tighter stops in clean trends
    'medium': 1.0,   // Normal stops
    'high': 1.3,     // Wider stops in choppy markets
    'extreme': 1.5   // Very wide stops or avoid trade
  }[flowField.turbulenceLevel];
  
  // Calculate final enhanced score
  const enhancedScore = Math.max(0, Math.min(100, baseScore + flowBoost));
  
  return {
    enhancedScore,
    flowBoost,
    confidenceAdjustment,
    riskAdjustment
  };
}

/**
 * Generate flow-based trading signals
 */
export function generateFlowSignals(flowField: FlowFieldResult): {
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  reasons: string[];
  confidence: number;
} {
  const reasons: string[] = [];
  let confidence = 50;
  
  // Analyze force direction and magnitude
  const isBullish = flowField.dominantDirection === 'bullish';
  const isBearish = flowField.dominantDirection === 'bearish';
  const hasStrongForce = flowField.latestForce > flowField.averageForce * 1.3;
  const hasLowTurbulence = flowField.turbulenceLevel === 'low' || flowField.turbulenceLevel === 'medium';
  
  // Build signal logic
  if (isBullish && hasStrongForce && hasLowTurbulence) {
    confidence += 30;
    reasons.push('Strong bullish force with low turbulence');
    
    if (flowField.energyTrend === 'accelerating') {
      confidence += 10;
      reasons.push('Momentum accelerating');
      return { signal: 'STRONG_BUY', reasons, confidence: Math.min(95, confidence) };
    }
    return { signal: 'BUY', reasons, confidence: Math.min(85, confidence) };
  }
  
  if (isBearish && hasStrongForce && hasLowTurbulence) {
    confidence += 30;
    reasons.push('Strong bearish force with low turbulence');
    
    if (flowField.energyTrend === 'accelerating') {
      confidence += 10;
      reasons.push('Momentum accelerating');
      return { signal: 'STRONG_SELL', reasons, confidence: Math.min(95, confidence) };
    }
    return { signal: 'SELL', reasons, confidence: Math.min(85, confidence) };
  }
  
  // High turbulence warning
  if (flowField.turbulenceLevel === 'extreme') {
    confidence -= 20;
    reasons.push('Extreme turbulence - high risk');
    return { signal: 'NEUTRAL', reasons, confidence: Math.max(10, confidence) };
  }
  
  // Weak or conflicting signals
  reasons.push('Weak or unclear flow pattern');
  return { signal: 'NEUTRAL', reasons, confidence };
}

/**
 * Detect reversal patterns using flow field
 */
export function detectFlowReversals(
  flowField: FlowFieldResult,
  priceData: FlowFieldPoint[]
): {
  hasReversal: boolean;
  type: 'bullish' | 'bearish' | 'none';
  strength: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  // Check for exhaustion patterns
  const hasHighPressure = flowField.pressure > flowField.averagePressure * 2;
  const hasHighTurbulence = flowField.turbulenceLevel === 'high' || flowField.turbulenceLevel === 'extreme';
  const isDecelerating = flowField.energyTrend === 'decelerating';
  
  // Bullish reversal: Price down, but force declining (exhaustion)
  if (flowField.dominantDirection === 'bearish' && isDecelerating && hasHighTurbulence) {
    reasons.push('Bearish momentum exhaustion detected');
    reasons.push(`High turbulence (${flowField.turbulenceLevel})`);
    reasons.push('Energy decelerating');
    
    return {
      hasReversal: true,
      type: 'bullish',
      strength: flowField.turbulence * 1000, // Convert to readable scale
      reasons
    };
  }
  
  // Bearish reversal: Price up, but force declining (exhaustion)
  if (flowField.dominantDirection === 'bullish' && isDecelerating && hasHighPressure) {
    reasons.push('Bullish momentum exhaustion detected');
    reasons.push(`High pressure (${flowField.pressureTrend})`);
    reasons.push('Energy decelerating');
    
    return {
      hasReversal: true,
      type: 'bearish',
      strength: flowField.pressure * 10,
      reasons
    };
  }
  
  return {
    hasReversal: false,
    type: 'none',
    strength: 0,
    reasons: ['No reversal pattern detected']
  };
}

/**
 * Calculate optimal entry timing based on flow field
 */
export function calculateFlowEntryTiming(flowField: FlowFieldResult): {
  entryScore: number; // 0-100
  waitTime: 'immediate' | 'short' | 'medium' | 'long';
  reason: string;
} {
  // Perfect entry: Strong force, low turbulence, accelerating
  if (
    flowField.latestForce > flowField.averageForce * 1.3 &&
    flowField.turbulenceLevel === 'low' &&
    flowField.energyTrend === 'accelerating'
  ) {
    return {
      entryScore: 95,
      waitTime: 'immediate',
      reason: 'Optimal conditions: strong force, low turbulence, accelerating momentum'
    };
  }
  
  // Good entry: Moderate force, acceptable turbulence
  if (
    flowField.latestForce > flowField.averageForce &&
    (flowField.turbulenceLevel === 'low' || flowField.turbulenceLevel === 'medium')
  ) {
    return {
      entryScore: 75,
      waitTime: 'short',
      reason: 'Good conditions: wait for slight pullback or confirmation'
    };
  }
  
  // Wait for better setup: High turbulence or weak force
  if (flowField.turbulenceLevel === 'high' || flowField.latestForce < flowField.averageForce * 0.8) {
    return {
      entryScore: 40,
      waitTime: 'medium',
      reason: 'Suboptimal conditions: wait for turbulence to decrease or force to strengthen'
    };
  }
  
  // Avoid: Extreme turbulence or conflicting signals
  return {
    entryScore: 20,
    waitTime: 'long',
    reason: 'Poor conditions: extreme turbulence or very weak force'
  };
}

/**
 * Enrich scanner signal with flow field analysis
 */
export interface EnrichedSignal {
  // Original signal data
  symbol: string;
  baseScore: number;
  signal: string;
  
  // Flow field enrichment
  flowField: FlowFieldResult;
  enhancedScore: number;
  flowBoost: number;
  confidenceAdjustment: number;
  riskAdjustment: number;
  
  // Flow-based insights
  flowSignal: string;
  flowConfidence: number;
  flowReasons: string[];
  
  // Reversal detection
  reversalDetected: boolean;
  reversalType: string;
  reversalStrength: number;
  
  // Entry timing
  entryScore: number;
  entryTiming: string;
  entryReason: string;
}

export function enrichSignalWithFlow(
  symbol: string,
  baseScore: number,
  signal: string,
  candles: any[]
): EnrichedSignal {
  // Convert candles to flow points
  const flowPoints = convertCandlesToFlowPoints(candles);
  
  // Compute flow field
  const flowField = computeFlowField(flowPoints);
  
  // Calculate enhanced score
  const {
    enhancedScore,
    flowBoost,
    confidenceAdjustment,
    riskAdjustment
  } = calculateFlowEnhancedScore(baseScore, flowField);
  
  // Generate flow signals
  const flowSignalData = generateFlowSignals(flowField);
  
  // Detect reversals
  const reversal = detectFlowReversals(flowField, flowPoints);
  
  // Calculate entry timing
  const entryTiming = calculateFlowEntryTiming(flowField);
  
  return {
    symbol,
    baseScore,
    signal,
    
    flowField,
    enhancedScore,
    flowBoost,
    confidenceAdjustment,
    riskAdjustment,
    
    flowSignal: flowSignalData.signal,
    flowConfidence: flowSignalData.confidence,
    flowReasons: flowSignalData.reasons,
    
    reversalDetected: reversal.hasReversal,
    reversalType: reversal.type,
    reversalStrength: reversal.strength,
    
    entryScore: entryTiming.entryScore,
    entryTiming: entryTiming.waitTime,
    entryReason: entryTiming.reason
  };
}

