/**
 * ARM (Asymmetric Reaction Model) Signal Template
 * 
 * Universal, module-agnostic ARM implementation that can be applied to ANY signal generator.
 * Handles:
 * - Volume/liquidity gating (hard constraint)
 * - ARM detection (pressure shift before edge)
 * - Confidence ramping with ARM persistence
 * - Module aggregation
 * 
 * Usage: Import and call generateModuleSignal() from any signal module
 */

/**
 * Unified signal type across all modules
 */
export type SignalType = 'BUY' | 'SELL' | 'HOLD' | 'ARM_LONG' | 'ARM_SHORT';

export type HoldReason = 
  | 'ZERO_VOLUME'
  | 'LOW_LIQUIDITY'
  | 'INSUFFICIENT_EDGE'
  | 'CONTINUATION'
  | 'LATE'
  | 'DATA_QUALITY';

export type ArmReason =
  | 'MOMENTUM_DECAY'
  | 'RSI_SLOPE_SHIFT'
  | 'VOLATILITY_COMPRESSION'
  | 'PRESSURE_SHIFT'
  | 'FLOW_REVERSAL'
  | 'CUSTOM';

/**
 * Unified signal interface for all modules
 */
export interface Signal {
  type: SignalType;
  confidence: number;           // 0–1 range
  strength?: number;            // raw metric strength
  module?: string;              // source: 'momentum', 'flow', 'physics', etc.
  timestamp?: number;           // for persistence tracking
  
  // Semantic details
  holdReason?: HoldReason;
  armReason?: ArmReason;
  reasoning?: string[];         // diagnostic messages
  
  // ARM-specific
  armTicks?: number;            // persistence counter
  armHistory?: ('LONG' | 'SHORT')[];  // recent ARM sequence
}

/**
 * Module-level state tracking for ARM persistence
 */
export interface ModuleState {
  lastArm?: 'LONG' | 'SHORT';
  armTicks: number;
  lastSignal?: SignalType;
  armHistory: ('LONG' | 'SHORT')[];
  lastUpdate: number;
}

/**
 * Module-specific inputs for ARM detection
 */
export interface ArmInputs {
  // Indicator series (last N candles)
  rsiSeries?: number[];
  macdHistogramSeries?: number[];
  atrSeries?: number[];
  momentumSeries?: number[];
  
  // Current values
  rsi?: number;
  macdHistogram?: number;
  atr?: number;
  momentum?: number;
  
  // Percentiles/context
  rsiPercentile?: number;      // 0–100
  atrPercentile?: number;      // 0–100
  
  // Module-specific metric (optional)
  moduleScore?: number;         // -1 to 1
  moduleStrength?: number;      // 0 to 100
}

/**
 * Helper: Calculate simple slope (derivative)
 */
export function slope(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

/**
 * Helper: Get or initialize module state
 */
const moduleStates = new Map<string, ModuleState>();

export function getModuleState(moduleId: string): ModuleState {
  if (!moduleStates.has(moduleId)) {
    moduleStates.set(moduleId, {
      armTicks: 0,
      armHistory: [],
      lastUpdate: Date.now()
    });
  }
  return moduleStates.get(moduleId)!;
}

export function resetModuleState(moduleId: string): void {
  moduleStates.delete(moduleId);
}

/**
 * Core ARM Detection Logic
 * Returns true if ARM_LONG / ARM_SHORT should be triggered
 */
export interface ArmDetectionResult {
  armLong: boolean;
  armShort: boolean;
  armReason: ArmReason;
}

export function detectArm(inputs: ArmInputs): ArmDetectionResult {
  const rsiSlope = slope(inputs.rsiSeries || []);
  const macdHistSlope = slope(inputs.macdHistogramSeries || []);
  const atrSlope = slope(inputs.atrSeries || []);

  // ARM_LONG: Bullish pressure shift
  const armLong =
    (
      // Momentum reversing from bearish
      (inputs.macdHistogram && inputs.macdHistogram < 0 && macdHistSlope > 0) ||
      // RSI recovering from oversold
      (inputs.rsi && inputs.rsi < 50 && rsiSlope > 0 && inputs.rsiPercentile && inputs.rsiPercentile < 40) ||
      // Market coiling (low volatility)
      (atrSlope < 0 && inputs.atrPercentile && inputs.atrPercentile < 40) ||
      // Module-specific bullish pressure
      (inputs.moduleScore && inputs.moduleScore > 0.2 && inputs.moduleScore < 0.5)
    );

  // ARM_SHORT: Bearish pressure shift
  const armShort =
    (
      // Momentum reversing from bullish
      (inputs.macdHistogram && inputs.macdHistogram > 0 && macdHistSlope < 0) ||
      // RSI declining from overbought
      (inputs.rsi && inputs.rsi > 50 && rsiSlope < 0 && inputs.rsiPercentile && inputs.rsiPercentile > 60) ||
      // Market coiling (low volatility)
      (atrSlope < 0 && inputs.atrPercentile && inputs.atrPercentile < 40) ||
      // Module-specific bearish pressure
      (inputs.moduleScore && inputs.moduleScore < -0.2 && inputs.moduleScore > -0.5)
    );

  // Determine primary ARM reason
  let armReason: ArmReason = 'PRESSURE_SHIFT';
  if (armLong || armShort) {
    if (Math.abs(macdHistSlope) > Math.abs(rsiSlope) && Math.abs(macdHistSlope) > 0) {
      armReason = 'MOMENTUM_DECAY';
    } else if (Math.abs(rsiSlope) > 0) {
      armReason = 'RSI_SLOPE_SHIFT';
    } else if (atrSlope < 0) {
      armReason = 'VOLATILITY_COMPRESSION';
    }
  }

  return { armLong: !!armLong, armShort: !!armShort, armReason };
}

/**
 * Main signal generation function
 * Apply this template to ANY module to get ARM-aware signals
 */
export function generateModuleSignal(
  moduleName: string,
  armInputs: ArmInputs,
  volumeGate: boolean,         // pass false if volume/liquidity insufficient
  confirmationLogic?: {         // optional: module's BUY/SELL confirmation rules
    shouldConfirmLong?: (inputs: ArmInputs, armTicks: number) => boolean;
    shouldConfirmShort?: (inputs: ArmInputs, armTicks: number) => boolean;
  }
): Signal {
  const moduleId = `${moduleName}:${Date.now() % 10000}`;
  const state = getModuleState(moduleId);

  // 1. VOLUME GATE (hard constraint - no volume = no trade)
  if (!volumeGate) {
    return {
      type: 'HOLD',
      holdReason: 'LOW_LIQUIDITY',
      confidence: 0.05,
      module: moduleName,
      timestamp: Date.now(),
      reasoning: ['Volume/liquidity insufficient for signal']
    };
  }

  // 2. ARM DETECTION (pressure shift)
  const { armLong, armShort, armReason } = detectArm(armInputs);

  if (armLong) {
    state.lastArm = 'LONG';
    state.armTicks = Math.min((state.armTicks || 0) + 1, 10); // cap at 10
    state.armHistory.push('LONG');
    if (state.armHistory.length > 5) state.armHistory.shift(); // keep last 5
    state.lastUpdate = Date.now();

    // Confidence ramps with persistence
    const baseConfidence = 0.2;
    const persistenceBonus = Math.min(state.armTicks * 0.08, 0.25); // cap at 50%
    const confidence = Math.min(baseConfidence + persistenceBonus, 0.5);

    return {
      type: 'ARM_LONG',
      confidence,
      armReason,
      armTicks: state.armTicks,
      module: moduleName,
      timestamp: Date.now(),
      strength: armInputs.moduleStrength,
      reasoning: [
        `ARM detected: ${armReason}`,
        `Persistence: ${state.armTicks} ticks`,
        `Confidence: ${(confidence * 100).toFixed(0)}%`
      ]
    };
  }

  if (armShort) {
    state.lastArm = 'SHORT';
    state.armTicks = Math.min((state.armTicks || 0) + 1, 10);
    state.armHistory.push('SHORT');
    if (state.armHistory.length > 5) state.armHistory.shift();
    state.lastUpdate = Date.now();

    const baseConfidence = 0.2;
    const persistenceBonus = Math.min(state.armTicks * 0.08, 0.25);
    const confidence = Math.min(baseConfidence + persistenceBonus, 0.5);

    return {
      type: 'ARM_SHORT',
      confidence,
      armReason,
      armTicks: state.armTicks,
      module: moduleName,
      timestamp: Date.now(),
      strength: armInputs.moduleStrength,
      reasoning: [
        `ARM detected: ${armReason}`,
        `Persistence: ${state.armTicks} ticks`,
        `Confidence: ${(confidence * 100).toFixed(0)}%`
      ]
    };
  }

  // 3. CONFIRMATION LOGIC (if ARM persists, check for edge confirmation)
  let shouldConfirmLong = false;
  let shouldConfirmShort = false;

  if (confirmationLogic?.shouldConfirmLong) {
    shouldConfirmLong = state.lastArm === 'LONG' && confirmationLogic.shouldConfirmLong(armInputs, state.armTicks);
  } else {
    // Default confirmation: ARM must persist + RSI/MACD confirm
    shouldConfirmLong =
      state.lastArm === 'LONG' &&
      state.armTicks >= 2 &&
      (armInputs.rsi ?? 50) > 50 &&
      (armInputs.macdHistogram ?? 0) >= 0;
  }

  if (confirmationLogic?.shouldConfirmShort) {
    shouldConfirmShort = state.lastArm === 'SHORT' && confirmationLogic.shouldConfirmShort(armInputs, state.armTicks);
  } else {
    // Default confirmation: ARM must persist + RSI/MACD confirm
    shouldConfirmShort =
      state.lastArm === 'SHORT' &&
      state.armTicks >= 2 &&
      (armInputs.rsi ?? 50) < 50 &&
      (armInputs.macdHistogram ?? 0) <= 0;
  }

  if (shouldConfirmLong) {
    state.armTicks = 0;
    state.lastArm = undefined;
    return {
      type: 'BUY',
      confidence: 0.65,
      module: moduleName,
      timestamp: Date.now(),
      strength: armInputs.moduleStrength,
      reasoning: [
        `ARM confirmation: ${state.armHistory.join(' → ')}`,
        `Edge confirmed via module ${moduleName}`,
        `Ready for entry`
      ]
    };
  }

  if (shouldConfirmShort) {
    state.armTicks = 0;
    state.lastArm = undefined;
    return {
      type: 'SELL',
      confidence: 0.65,
      module: moduleName,
      timestamp: Date.now(),
      strength: armInputs.moduleStrength,
      reasoning: [
        `ARM confirmation: ${state.armHistory.join(' → ')}`,
        `Edge confirmed via module ${moduleName}`,
        `Ready for exit`
      ]
    };
  }

  // 4. DEFAULT HOLD (no ARM, no confirmation)
  state.armTicks = 0;
  state.lastArm = undefined;
  return {
    type: 'HOLD',
    holdReason: 'INSUFFICIENT_EDGE',
    confidence: 0.1,
    module: moduleName,
    timestamp: Date.now(),
    reasoning: ['No asymmetry detected']
  };
}

/**
 * Multi-module signal aggregation
 * Fuses signals from multiple modules into unified decision
 */
export interface AggregationOptions {
  requireConfirmation?: boolean;  // only act on BUY/SELL (not ARM)
  requireMultipleModules?: number; // minimum modules must agree
  armBoost?: boolean;              // boost confidence if multiple ARMs align
}

export function aggregateSignals(
  signals: Signal[],
  options: AggregationOptions = {}
): Signal {
  const {
    requireConfirmation = false,
    requireMultipleModules = 1,
    armBoost = true
  } = options;

  // If requiring confirmation, filter out ARM signals
  const actionableSignals = requireConfirmation
    ? signals.filter(s => s.type === 'BUY' || s.type === 'SELL')
    : signals.filter(s => s.type !== 'HOLD');

  // 1. Any confirmed BUY/SELL? Use highest confidence
  const buySignals = signals.filter(s => s.type === 'BUY');
  if (buySignals.length >= requireMultipleModules) {
    const strongest = buySignals.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return {
      ...strongest,
      confidence: Math.min(strongest.confidence + 0.05, 1.0), // slight boost for agreement
      reasoning: [
        ...(strongest.reasoning || []),
        `Agreement from ${buySignals.length} module(s)`
      ]
    };
  }

  const sellSignals = signals.filter(s => s.type === 'SELL');
  if (sellSignals.length >= requireMultipleModules) {
    const strongest = sellSignals.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return {
      ...strongest,
      confidence: Math.min(strongest.confidence + 0.05, 1.0),
      reasoning: [
        ...(strongest.reasoning || []),
        `Agreement from ${sellSignals.length} module(s)`
      ]
    };
  }

  // 2. If no confirmed signal, check ARM alignment
  const armLongSignals = signals.filter(s => s.type === 'ARM_LONG');
  const armShortSignals = signals.filter(s => s.type === 'ARM_SHORT');

  if (armBoost && armLongSignals.length >= requireMultipleModules) {
    const avgConfidence = armLongSignals.reduce((sum, s) => sum + s.confidence, 0) / armLongSignals.length;
    return {
      type: 'ARM_LONG',
      confidence: Math.min(avgConfidence + 0.1, 0.5), // boost for alignment, still capped
      module: `${armLongSignals.map(s => s.module).join('+')}`,
      timestamp: Date.now(),
      reasoning: [
        `ARM alignment: ${armLongSignals.length} modules agree on pressure shift`,
        `Average ticks: ${(armLongSignals.reduce((sum, s) => sum + (s.armTicks || 0), 0) / armLongSignals.length).toFixed(1)}`
      ]
    };
  }

  if (armBoost && armShortSignals.length >= requireMultipleModules) {
    const avgConfidence = armShortSignals.reduce((sum, s) => sum + s.confidence, 0) / armShortSignals.length;
    return {
      type: 'ARM_SHORT',
      confidence: Math.min(avgConfidence + 0.1, 0.5),
      module: `${armShortSignals.map(s => s.module).join('+')}`,
      timestamp: Date.now(),
      reasoning: [
        `ARM alignment: ${armShortSignals.length} modules agree on pressure shift`,
        `Average ticks: ${(armShortSignals.reduce((sum, s) => sum + (s.armTicks || 0), 0) / armShortSignals.length).toFixed(1)}`
      ]
    };
  }

  // 3. Default to strongest ARM if any exist
  const anyArm = [...armLongSignals, ...armShortSignals];
  if (anyArm.length > 0) {
    return anyArm.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  }

  // 4. Default HOLD
  return {
    type: 'HOLD',
    confidence: 0.1,
    holdReason: 'INSUFFICIENT_EDGE',
    reasoning: ['All modules returned HOLD']
  };
}

/**
 * Utility: Convert signal to trading action with validation
 */
export function signalToAction(signal: Signal): {
  action: 'BUY' | 'SELL' | 'WAIT' | 'HOLD';
  confidence: number;
  reasoning: string;
} {
  if (signal.type === 'BUY' && signal.confidence >= 0.4) {
    return {
      action: 'BUY',
      confidence: signal.confidence,
      reasoning: `${signal.module || 'module'} generated BUY with ${(signal.confidence * 100).toFixed(0)}% confidence`
    };
  }

  if (signal.type === 'SELL' && signal.confidence >= 0.4) {
    return {
      action: 'SELL',
      confidence: signal.confidence,
      reasoning: `${signal.module || 'module'} generated SELL with ${(signal.confidence * 100).toFixed(0)}% confidence`
    };
  }

  if ((signal.type === 'ARM_LONG' || signal.type === 'ARM_SHORT') && signal.confidence >= 0.3) {
    return {
      action: 'WAIT',
      confidence: signal.confidence,
      reasoning: `Pressure shift detected (${signal.armReason}). Waiting for confirmation.`
    };
  }

  return {
    action: 'HOLD',
    confidence: 0.1,
    reasoning: signal.reasoning?.[0] || 'No actionable signal'
  };
}
