/**
 * ARM Template - Unified signal generation with Asymmetric Reaction Model
 * 
 * Provides reusable ARM detection logic for all signal modules:
 * - Momentum, Volume, Flow, Physics, Multi-agent, etc.
 * 
 * Every module implements same interface:
 * 1. Volume gate check
 * 2. ARM detection (derivative-based)
 * 3. Confirmed signal (edge after ARM persistence)
 * 4. State tracking (persistence counter)
 */

export type SignalType = 'BUY' | 'SELL' | 'HOLD' | 'ARM_LONG' | 'ARM_SHORT';

export interface Signal {
  type: SignalType;
  confidence: number;      // 0–1, scaled by ARM persistence / alignment
  strength?: number;       // raw module metric, optional
  holdReason?: string;     // semantic HOLD reasons
  armReason?: string;      // what triggered ARM
  module?: string;         // source module (momentum, volume, flow, etc.)
  timestamp?: number;      // for persistence tracking
}

export interface ModuleState {
  lastArm?: 'LONG' | 'SHORT';
  armTicks: number;
  lastSignal?: SignalType;
  lastUpdate?: number;
}

/**
 * Simple slope calculation (derivative)
 * Used for RSI slope, MACD histogram slope, ATR slope, volume slope, etc.
 */
export function slope(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

/**
 * Generic ARM detection template
 * 
 * Every module calls this with their specific data and conditions
 * Returns ARM_LONG / ARM_SHORT if pressure shift detected
 */
export interface ArmDetectionInput {
  // Directional data
  rsi?: number;
  rsiSlope?: number;
  macd?: number;
  macdHistogram?: number;
  macdHistSlope?: number;
  atr?: number;
  atrSlope?: number;
  atrPercentile?: number;
  momentum?: number;
  
  // Volume data
  volume?: number;
  volumeSlope?: number;
  volumeRatio?: number;
  
  // Flow data
  flowDirection?: number;
  flowStrength?: number;
  
  // Custom data (module-specific)
  [key: string]: any;
}

/**
 * Core ARM detection logic
 * Returns ARM_LONG or ARM_SHORT if asymmetry detected, otherwise null
 */
export function detectArm(input: ArmDetectionInput): 'LONG' | 'SHORT' | null {
  // ARM_LONG: Sellers losing power (bullish pressure shift)
  const armLong =
    // Momentum decay: MACD negative but histogram rising (sellers weakening)
    (input.macd !== undefined && input.macdHistogram !== undefined && input.macdHistSlope !== undefined &&
      input.macd < 0 && input.macdHistSlope > 0) ||
    // RSI slope shift: RSI below 50 but trending upward (demand recovering)
    (input.rsi !== undefined && input.rsiSlope !== undefined &&
      input.rsi < 50 && input.rsiSlope > 0) ||
    // Volatility compression: ATR contracting after expansion
    (input.atr !== undefined && input.atrSlope !== undefined && input.atrPercentile !== undefined &&
      input.atrSlope < 0 && input.atrPercentile < 40 && input.momentum !== undefined && input.momentum > -1) ||
    // Volume pressure: Volume declining but trending upward (weak selling)
    (input.volume !== undefined && input.volumeSlope !== undefined &&
      input.volumeSlope > 0 && input.momentum !== undefined && input.momentum < 1);

  // ARM_SHORT: Buyers losing power (bearish pressure shift)
  const armShort =
    // Momentum decay: MACD positive but histogram falling (buyers weakening)
    (input.macd !== undefined && input.macdHistogram !== undefined && input.macdHistSlope !== undefined &&
      input.macd > 0 && input.macdHistSlope < 0) ||
    // RSI slope shift: RSI above 50 but trending downward (supply returning)
    (input.rsi !== undefined && input.rsiSlope !== undefined &&
      input.rsi > 50 && input.rsiSlope < 0) ||
    // Volatility compression: ATR contracting (coiling)
    (input.atr !== undefined && input.atrSlope !== undefined && input.atrPercentile !== undefined &&
      input.atrSlope < 0 && input.atrPercentile < 40 && input.momentum !== undefined && input.momentum < 1) ||
    // Volume pressure: Volume declining but declining (weak buying)
    (input.volume !== undefined && input.volumeSlope !== undefined &&
      input.volumeSlope < 0 && input.momentum !== undefined && input.momentum > 1);

  if (armLong) return 'LONG';
  if (armShort) return 'SHORT';
  return null;
}

/**
 * Module signal generator template
 * 
 * Every module implements this pattern:
 * 1. Check volume/liquidity gate
 * 2. Detect ARM
 * 3. Track ARM persistence
 * 4. Confirm edge after ARM stabilizes
 * 5. Return appropriate signal type
 */
export function generateModuleSignal(options: {
  moduleName: string;
  data: ArmDetectionInput;
  state: ModuleState;
  volumeGate: boolean;
  
  // Confirmation conditions (module-specific)
  confirmLongCondition?: (data: ArmDetectionInput) => boolean;
  confirmShortCondition?: (data: ArmDetectionInput) => boolean;
  
  // ARM persistence requirement
  minArmTicks?: number;  // default 2
  
  // Confidence calculations
  baseConfidence?: number;  // default 0.2
  armConfidencePerTick?: number;  // default 0.05
  confirmedConfidence?: number;  // default 0.6
}): Signal {
  const {
    moduleName,
    data,
    state,
    volumeGate,
    confirmLongCondition,
    confirmShortCondition,
    minArmTicks = 2,
    baseConfidence = 0.2,
    armConfidencePerTick = 0.05,
    confirmedConfidence = 0.6
  } = options;

  // 1. VOLUME GATE: Hard constraint
  if (!volumeGate) {
    return {
      type: 'HOLD',
      holdReason: 'LOW_LIQUIDITY',
      confidence: 0.05,
      module: moduleName,
      timestamp: Date.now()
    };
  }

  // 2. ARM DETECTION
  const detectedArm = detectArm(data);

  if (detectedArm === 'LONG') {
    state.lastArm = 'LONG';
    state.armTicks = (state.armTicks || 0) + 1;
    state.lastUpdate = Date.now();

    return {
      type: 'ARM_LONG',
      armReason: 'PRESSURE_SHIFT',
      confidence: Math.min(
        baseConfidence + state.armTicks * armConfidencePerTick,
        0.5  // ARM capped at 50%
      ),
      strength: Math.abs(data.rsiSlope || 0) + Math.abs(data.macdHistSlope || 0),
      module: moduleName,
      timestamp: state.lastUpdate
    };
  }

  if (detectedArm === 'SHORT') {
    state.lastArm = 'SHORT';
    state.armTicks = (state.armTicks || 0) + 1;
    state.lastUpdate = Date.now();

    return {
      type: 'ARM_SHORT',
      armReason: 'PRESSURE_SHIFT',
      confidence: Math.min(
        baseConfidence + state.armTicks * armConfidencePerTick,
        0.5  // ARM capped at 50%
      ),
      strength: Math.abs(data.rsiSlope || 0) + Math.abs(data.macdHistSlope || 0),
      module: moduleName,
      timestamp: state.lastUpdate
    };
  }

  // 3. CONFIRMED SIGNAL (edge after ARM persistence)
  const confirmedLong =
    state.lastArm === 'LONG' &&
    state.armTicks >= minArmTicks &&
    (!confirmLongCondition || confirmLongCondition(data));

  const confirmedShort =
    state.lastArm === 'SHORT' &&
    state.armTicks >= minArmTicks &&
    (!confirmShortCondition || confirmShortCondition(data));

  if (confirmedLong) {
    state.armTicks = 0;  // reset ARM
    state.lastArm = undefined;
    state.lastSignal = 'BUY';
    state.lastUpdate = Date.now();

    return {
      type: 'BUY',
      confidence: confirmedConfidence,
      module: moduleName,
      timestamp: state.lastUpdate
    };
  }

  if (confirmedShort) {
    state.armTicks = 0;  // reset ARM
    state.lastArm = undefined;
    state.lastSignal = 'SELL';
    state.lastUpdate = Date.now();

    return {
      type: 'SELL',
      confidence: confirmedConfidence,
      module: moduleName,
      timestamp: state.lastUpdate
    };
  }

  // 4. DEFAULT HOLD (no asymmetry, no persistence)
  state.armTicks = 0;
  state.lastArm = undefined;
  state.lastSignal = 'HOLD';
  state.lastUpdate = Date.now();

  return {
    type: 'HOLD',
    holdReason: 'INSUFFICIENT_EDGE',
    confidence: 0.1,
    module: moduleName,
    timestamp: state.lastUpdate
  };
}

/**
 * Multi-module aggregation
 * 
 * Takes signals from multiple modules and fuses them intelligently:
 * 1. If any confirmed BUY/SELL exists, use it
 * 2. If multiple ARM signals exist, take strongest
 * 3. Otherwise HOLD
 */
export function aggregateSignals(signals: Signal[]): Signal {
  if (!signals || signals.length === 0) {
    return {
      type: 'HOLD',
      confidence: 0.05,
      holdReason: 'NO_SIGNALS'
    };
  }

  // Priority 1: Confirmed BUY (highest conviction)
  const buySignals = signals.filter(s => s.type === 'BUY');
  if (buySignals.length > 0) {
    // Take strongest BUY
    return buySignals.reduce((best, signal) =>
      (signal.confidence > best.confidence) ? signal : best
    );
  }

  // Priority 2: Confirmed SELL (highest conviction)
  const sellSignals = signals.filter(s => s.type === 'SELL');
  if (sellSignals.length > 0) {
    return sellSignals.reduce((best, signal) =>
      (signal.confidence > best.confidence) ? signal : best
    );
  }

  // Priority 3: ARM signals (forming edges)
  const armSignals = signals.filter(s => s.type === 'ARM_LONG' || s.type === 'ARM_SHORT');
  if (armSignals.length > 0) {
    // Take strongest ARM
    return armSignals.reduce((best, signal) =>
      (signal.confidence > best.confidence) ? signal : best
    );
  }

  // Priority 4: Default HOLD with aggregated confidence
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  return {
    type: 'HOLD',
    confidence: Math.max(0.05, avgConfidence),
    holdReason: 'NO_EDGE',
    module: 'aggregator'
  };
}

/**
 * Signal quality assessment
 * Returns diagnostic info about signal reliability
 */
export function assessSignalQuality(signal: Signal, moduleCount: number): {
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string[];
  recommendation: string;
} {
  const reasoning: string[] = [];

  // Assess by type
  if (signal.type === 'BUY' || signal.type === 'SELL') {
    reasoning.push('Edge confirmed');
    if (signal.confidence >= 0.7) {
      reasoning.push('High conviction');
      return {
        quality: 'HIGH',
        reasoning,
        recommendation: 'Execute with full size'
      };
    } else if (signal.confidence >= 0.5) {
      reasoning.push('Moderate conviction');
      return {
        quality: 'MEDIUM',
        reasoning,
        recommendation: 'Execute with caution, consider 50% size'
      };
    }
  }

  if (signal.type === 'ARM_LONG' || signal.type === 'ARM_SHORT') {
    reasoning.push('Pressure shift detected');
    if (signal.confidence >= 0.4) {
      reasoning.push('ARM persistent');
      return {
        quality: 'MEDIUM',
        reasoning,
        recommendation: 'Prepare for entry, await confirmation'
      };
    } else {
      reasoning.push('ARM early stage');
      return {
        quality: 'LOW',
        reasoning,
        recommendation: 'Monitor, not yet actionable'
      };
    }
  }

  reasoning.push('No asymmetry detected');
  return {
    quality: 'LOW',
    reasoning,
    recommendation: 'Wait for edge formation'
  };
}

export default {
  slope,
  detectArm,
  generateModuleSignal,
  aggregateSignals,
  assessSignalQuality
};
