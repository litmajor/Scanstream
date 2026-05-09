/**
 * FLOW ENGINE + FLOW PHYSICS AGENT - Complete Usage Guide
 * 
 * What You Can Do With Your Flow Field System
 */

// ============================================================================
// PART 1: FLOW ENGINE CAPABILITIES
// ============================================================================

import {
  computeFlowField,
  computeFlowFieldBatch,
  detectFlowDivergence,
  type FlowFieldPoint,
  type FlowFieldResult,
  type FlowFieldConfig
} from './server/services/analytics/flowFieldEngine';

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLOW ENGINE METRICS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  FORCE METRICS                                                               │
│  ├─ latestForce          Current momentum magnitude                         │
│  ├─ averageForce         Mean momentum over period                          │
│  ├─ maxForce             Peak force observed (breakout strength)            │
│  ├─ forceDirection       Angle in radians (-π to +π) - direction bias      │
│  └─ forceVectors[]       Time series of all force vectors (fx, fy, mag)    │
│                                                                               │
│  PRESSURE METRICS                                                            │
│  ├─ pressure             Current accumulated stress level                   │
│  ├─ averagePressure      Mean pressure over lookback period                │
│  ├─ pressureTrend        'rising' | 'falling' | 'stable'                   │
│  └─ → Indicates building energy before release                             │
│                                                                               │
│  TURBULENCE METRICS (Chaos Level)                                           │
│  ├─ turbulence           Raw variance in forces                            │
│  ├─ turbulenceLevel      'low' | 'medium' | 'high' | 'extreme'             │
│  └─ → Low turbulence = clean directional flow (good for entries)           │
│                                                                               │
│  ENERGY GRADIENT (Acceleration)                                             │
│  ├─ energyGradient       Rate of pressure change                           │
│  ├─ energyTrend          'accelerating' | 'decelerating' | 'stable'        │
│  └─ → Detects momentum shifts and reversals                                │
│                                                                               │
│  DIRECTION ANALYSIS                                                          │
│  ├─ dominantDirection    'bullish' | 'bearish' | 'neutral'                 │
│  ├─ timeSpan             Duration of data in milliseconds                  │
│  └─ totalDataPoints      Sample size for reliability                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// ============================================================================
// EXAMPLE 1: Detect Directional Breakouts (Trend Strength)
// ============================================================================

function example1_DetectBreakoutStrength() {
  const flowData: FlowFieldPoint[] = [
    // ... market ticks with price, volume
  ];

  const result = computeFlowField(flowData);

  // Strong breakout = high force, clean direction, low turbulence
  const isStrongBreakout =
    result.maxForce > 0.5 &&
    result.turbulenceLevel === 'low' &&
    result.dominantDirection !== 'neutral';

  if (isStrongBreakout) {
    console.log(`🚀 Strong ${result.dominantDirection} breakout!`);
    console.log(`   Max Force: ${result.maxForce.toFixed(3)}`);
    console.log(`   Turbulence: ${result.turbulenceLevel}`);
    console.log(`   Confidence: ${(result.averageForce / result.maxForce * 100).toFixed(1)}%`);
  }
}

// ============================================================================
// EXAMPLE 2: Detect Momentum Shifts (Pressure Exhaustion)
// ============================================================================

function example2_DetectMomentumShift() {
  const flowData: FlowFieldPoint[] = [];

  const result = computeFlowField(flowData);

  // Momentum shift = pressure was rising, now decelerating
  const momentumShifting =
    result.pressureTrend === 'falling' &&
    result.energyTrend === 'decelerating';

  if (momentumShifting) {
    console.log('⚠️ Momentum Shift Detected!');
    console.log(`   Pressure was: ${result.averagePressure.toFixed(3)}`);
    console.log(`   Current pressure: ${result.pressure.toFixed(3)}`);
    console.log(`   Energy gradient: ${result.energyGradient.toFixed(3)}`);
    console.log('   → Possible reversal or consolidation incoming');
  }
}

// ============================================================================
// EXAMPLE 3: Detect Order Flow Imbalance (Quiet Accumulation)
// ============================================================================

function example3_DetectOrderFlowImbalance() {
  const flowData: FlowFieldPoint[] = [];

  const result = computeFlowField(flowData);

  // Order flow imbalance = directional bias without noise
  // Detected by analyzing fy component (order imbalance) vs fx (price)
  const hasOrderFlowImbalance =
    result.turbulenceLevel === 'low' &&
    result.pressureTrend === 'rising' &&
    result.energyTrend === 'accelerating';

  if (hasOrderFlowImbalance) {
    console.log('💰 Quiet Accumulation Detected!');
    console.log(`   Pressure rising: ${result.pressure.toFixed(3)}`);
    console.log(`   Turbulence low: ${result.turbulence.toFixed(6)}`);
    console.log(`   Direction: ${result.dominantDirection}`);
    console.log('   → Orders building before breakout');
  }
}

// ============================================================================
// EXAMPLE 4: Detect Reversal Conditions (Divergence)
// ============================================================================

function example4_DetectReversal() {
  const flowData: FlowFieldPoint[] = [];

  const result = computeFlowField(flowData);

  // Try to detect divergence
  const divergence = detectFlowDivergence(result, flowData);

  if (divergence.hasDivergence) {
    console.log(`⚠️ ${divergence.type.toUpperCase()} Divergence!`);
    console.log(`   Strength: ${(divergence.strength * 100).toFixed(1)}%`);
    console.log('   → Price moving but force weakening (reversal signal)');
  }
}

// ============================================================================
// EXAMPLE 5: Monitor Energy Levels (Breakout Probability)
// ============================================================================

function example5_MonitorEnergyLevels() {
  const flowData: FlowFieldPoint[] = [];

  const result = computeFlowField(flowData);

  // Energy levels:
  // Low: No setup (consolidating)
  // Medium: Building pressure (watch for trigger)
  // High: Breakout likely (high probability)
  const energyLevel =
    result.pressure < 0.3 ? 'Low (consolidating)' :
    result.pressure < 0.6 ? 'Medium (building)' :
    'High (ready to break)';

  console.log(`📊 Energy Level: ${energyLevel}`);
  console.log(`   Current Pressure: ${result.pressure.toFixed(3)}`);
  console.log(`   Pressure Trend: ${result.pressureTrend}`);
  console.log(`   Max Force Available: ${result.maxForce.toFixed(3)}`);

  if (result.pressure > 0.6 && result.turbulenceLevel === 'low') {
    console.log('   ✨ HIGH PROBABILITY SETUP - Clean energy, low chaos');
  }
}

// ============================================================================
// EXAMPLE 6: Batch Analysis (Multiple Symbols)
// ============================================================================

async function example6_BatchAnalysis() {
  // Analyze multiple symbols in parallel
  const dataMap = new Map<string, FlowFieldPoint[]>([
    ['BTC/USDT', btcTicks],
    ['ETH/USDT', ethTicks],
    ['SOL/USDT', solTicks],
  ]);

  const results = await computeFlowFieldBatch(dataMap);

  // Find strongest bullish setup
  let strongest = '';
  let maxForce = 0;

  for (const [symbol, result] of results.entries()) {
    if (
      result.dominantDirection === 'bullish' &&
      result.turbulenceLevel === 'low' &&
      result.averageForce > maxForce
    ) {
      maxForce = result.averageForce;
      strongest = symbol;
    }
  }

  console.log(`🏆 Strongest Setup: ${strongest}`);
  console.log(`   Force: ${maxForce.toFixed(3)}`);
}

// ============================================================================
// EXAMPLE 7: Custom Configuration (Tune for Your Market)
// ============================================================================

function example7_CustomConfig() {
  const customConfig: FlowFieldConfig = {
    turbulenceThresholds: {
      low: 0.00005,      // Very sensitive to chaos
      medium: 0.0005,
      high: 0.005,       // Higher threshold
    },
    pressureSmoothingPeriod: 3,     // Faster response
    energyGradientSensitivity: 1.5, // More sensitive to changes
  };

  const result = computeFlowField(flowData, customConfig);

  // Custom thresholds work better for specific assets
  // High volatility (crypto): increase thresholds
  // Low volatility (stocks): decrease thresholds
}

// ============================================================================
// PART 2: FLOW PHYSICS AGENT CAPABILITIES
// ============================================================================

import FlowPhysicsAgent from './server/services/rpg-agents/FlowPhysicsAgent';

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW PHYSICS AGENT ABILITIES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  BASIC (Level 1+)                                                            │
│  ├─ flow_field_analysis          Raw flow metrics computation               │
│  ├─ generateSignal()             BUY/SELL/HOLD decisions                   │
│  └─ getStatus()                  Agent stats and performance                │
│                                                                               │
│  INTERMEDIATE (Level 5+)                                                     │
│  ├─ Multi-timeframe analysis     Stack agents for 1h + 4h + 1d             │
│  ├─ Ensemble voting              Combine with other agents                  │
│  └─ Adaptive thresholds          Adjust sensitivity per regime              │
│                                                                               │
│  ADVANCED (Level 10+)                                                        │
│  ├─ Pattern recognition          Memory of past setups                      │
│  ├─ Regime adaptation            Different rules for trending/ranging      │
│  └─ Sub-agent spawning           Create specialized variants                │
│                                                                               │
│  RPG MECHANICS                                                               │
│  ├─ Level up                     Gain XP from accurate signals              │
│  ├─ Skill progression            pattern_recognition, timing, exit          │
│  ├─ Achievement tracking         Milestones and unlocks                     │
│  └─ Personality traits           aggressive/balanced/conservative           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// ============================================================================
// AGENT EXAMPLE 1: Generate Trading Signals
// ============================================================================

function agentExample1_GenerateSignals() {
  const agent = new FlowPhysicsAgent('FlowMaster', 'aggressive');

  const signal = agent.generateSignal(flowData);

  console.log(`Signal: ${signal.action}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`Entry: $${signal.entry.toFixed(2)}`);
  console.log(`Target: $${signal.target.toFixed(2)}`);
  console.log(`Stop: $${signal.stop.toFixed(2)}`);
  console.log(`Reason: ${signal.reason}`);

  // Integration example:
  if (signal.action === 'BUY' && signal.confidence > 0.6) {
    // Execute trade
    console.log('📈 Executing BUY order...');
  }
}

// ============================================================================
// AGENT EXAMPLE 2: Multi-Timeframe Stack (Confirmation)
// ============================================================================

function agentExample2_MultiTimeframe() {
  const agent1h = new FlowPhysicsAgent('Flow-1h', 'balanced');
  const agent4h = new FlowPhysicsAgent('Flow-4h', 'balanced');
  const agent1d = new FlowPhysicsAgent('Flow-1d', 'conservative');

  const signal1h = agent1h.generateSignal(data1h);
  const signal4h = agent4h.generateSignal(data4h);
  const signal1d = agent1d.generateSignal(data1d);

  // Only trade when multiple timeframes agree
  const alignment = [
    signal1h.action,
    signal4h.action,
    signal1d.action,
  ].filter(a => a === 'BUY').length;

  if (alignment >= 2) {
    console.log(`✨ Multiple timeframe confirmation!`);
    console.log(`   1h: ${signal1h.action} (${(signal1h.confidence * 100).toFixed(0)}%)`);
    console.log(`   4h: ${signal4h.action} (${(signal4h.confidence * 100).toFixed(0)}%)`);
    console.log(`   1d: ${signal1d.action} (${(signal1d.confidence * 100).toFixed(0)}%)`);
    console.log('   → High probability setup!');
  }
}

// ============================================================================
// AGENT EXAMPLE 3: Ensemble Voting (Blend with VFMD)
// ============================================================================

import VFMDPhysicsAgent from './server/services/rpg-agents/VFMDPhysicsAgent';

function agentExample3_EnsembleVoting() {
  const flowAgent = new FlowPhysicsAgent('FlowMaster');
  const vfmdAgent = new VFMDPhysicsAgent('VFMD-Scout');

  const flowSignal = flowAgent.generateSignal(flowData);
  const vfmdSignal = vfmdAgent.generateSignal(vfmdData);

  // Ensemble logic
  const consensusAction =
    flowSignal.action === vfmdSignal.action
      ? flowSignal.action
      : 'HOLD';

  const avgConfidence = (flowSignal.confidence + vfmdSignal.confidence) / 2;

  console.log(`🤝 Ensemble Signal:`);
  console.log(`   Flow: ${flowSignal.action} (${(flowSignal.confidence * 100).toFixed(0)}%)`);
  console.log(`   VFMD: ${vfmdSignal.action} (${(vfmdSignal.confidence * 100).toFixed(0)}%)`);
  console.log(`   Consensus: ${consensusAction} (${(avgConfidence * 100).toFixed(0)}%)`);

  if (consensusAction !== 'HOLD' && avgConfidence > 0.65) {
    console.log('   → Execute with high confidence');
  }
}

// ============================================================================
// AGENT EXAMPLE 4: Regime Adaptation
// ============================================================================

function agentExample4_RegimeAdaptation() {
  const agent = new FlowPhysicsAgent('AdaptiveFlow');

  // Different strategies per regime
  const isRanging = analyzeRegime(flowData) === 'RANGING';
  const isTrending = analyzeRegime(flowData) === 'TRENDING';

  let signal;

  if (isTrending) {
    // Trending: use momentum, take larger moves
    console.log('📈 TRENDING mode - Following momentum');
    signal = agent.generateSignal(flowData);
  } else if (isRanging) {
    // Ranging: use mean reversion, smaller targets
    console.log('📊 RANGING mode - Trading reversions');
    signal = agent.generateSignal(flowData);
    signal.target = signal.entry + (signal.target - signal.entry) * 0.5; // Smaller targets
  }

  return signal;
}

// ============================================================================
// AGENT EXAMPLE 5: Performance Tracking & Agent Leveling
// ============================================================================

function agentExample5_PerformanceTracking() {
  const agent = new FlowPhysicsAgent('TrainerFlow');

  // Simulate trades
  const trades = [
    { profit: 250, marketDifficulty: 1.5, executionQuality: 0.9 },
    { profit: -150, marketDifficulty: 2.0, executionQuality: 0.6 },
    { profit: 500, marketDifficulty: 1.8, executionQuality: 0.95 },
  ];

  trades.forEach(trade => {
    agent.updatePerformance({
      profit: trade.profit,
      profit_pct: (trade.profit / 42500) * 100,
      market_difficulty: trade.marketDifficulty,
      execution_quality: trade.executionQuality,
      regime: 'TRENDING',
      duration_hours: 4,
    });
  });

  const status = agent.getStatus();
  console.log(`\n🎮 Agent Status:`);
  console.log(`   Name: ${status.name}`);
  console.log(`   Level: ${status.level}`);
  console.log(`   XP: ${status.xp}/${status.xp_to_next_level}`);
  console.log(`   Win Rate: ${(status.stats.win_rate * 100).toFixed(1)}%`);
  console.log(`   Sharpe: ${status.stats.sharpe.toFixed(2)}`);
  console.log(`   Abilities: ${status.abilities.join(', ')}`);
}

// ============================================================================
// PART 3: COMPARING FLOW VS VFMD - WHEN TO USE EACH
// ============================================================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW ENGINE vs VFMD SYSTEM                               │
├──────────────────────────┬──────────────────────────────────────────────────┤
│        FLOW ENGINE       │           VFMD SYSTEM                            │
├──────────────────────────┼──────────────────────────────────────────────────┤
│                          │                                                   │
│ STRENGTH: MOMENTUM       │ STRENGTH: EARLY ENTRIES                          │
│ ─────────────────────    │ ─────────────────────────                        │
│ • Detects trend strength │ • Spots accumulation zones                       │
│ • Measures pressure      │ • Identifies divergence early                    │
│ • Shows energy levels    │ • Analyzes vector field patterns                 │
│ • Clear direction bias   │ • Predicts breakouts before confirmation         │
│                          │                                                   │
│ BEST FOR:                │ BEST FOR:                                        │
│ ─────────────────────    │ ─────────────────────────                        │
│ • Following trends       │ • Early entry timing                             │
│ • Confirming breakouts   │ • Spotting accumulation                          │
│ • Measuring momentum     │ • Anticipating reversals                         │
│ • Pressure levels        │ • Low-risk high-reward setups                    │
│ • Clear directional      │ • Entry point precision                          │
│   pushes                 │                                                   │
│                          │                                                   │
│ TIMEFRAME:               │ TIMEFRAME:                                       │
│ • 1h+ preferred          │ • 5m - 4h sweet spot                             │
│ • Strong on liquid pairs │ • Works all timeframes                           │
│ • Filters out noise      │ • Catches micro-moves                            │
│                          │                                                   │
│ ENTRY SIGNAL:            │ ENTRY SIGNAL:                                    │
│ "Follow the momentum"    │ "Orders building, get ready"                    │
│                          │                                                   │
└──────────────────────────┴──────────────────────────────────────────────────┘
*/

// ============================================================================
// COMBINED STRATEGY EXAMPLE
// ============================================================================

function combinedStrategy_VFMDDetectsEarlyVFMDThenFlowConfirms() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 COMBINED STRATEGY: VFMD Entry → Flow Confirmation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const vfmd = new VFMDPhysicsAgent('Scout');
  const flow = new FlowPhysicsAgent('Confirmer');

  // Step 1: VFMD detects early setup
  const vfmdAnalysis = vfmd.getAnalysisForUI(vfmdData);
  console.log(`Step 1️⃣  VFMD Analysis:`);
  console.log(`   Signal: ${vfmdAnalysis.signal.type}`);
  console.log(`   Confidence: ${vfmdAnalysis.signal.confidence}`);
  console.log(`   Reason: ${vfmdAnalysis.signal.recommendation}`);

  if (vfmdAnalysis.signal.type === 'neutral') {
    console.log('   → No setup detected, skip');
    return;
  }

  // Step 2: Flow confirms momentum building
  const flowSignal = flow.generateSignal(flowData);
  console.log(`\nStep 2️⃣  Flow Confirmation:`);
  console.log(`   Signal: ${flowSignal.action}`);
  console.log(`   Pressure Trend: ${flowSignal.reason}`);
  console.log(`   Confidence: ${(flowSignal.confidence * 100).toFixed(0)}%`);

  // Step 3: Execute if both agree
  const vfmdEntry = vfmdAnalysis.entry_guidance.suggested_entry;
  const flowEntry = flowSignal.entry;

  const entryPrice = (vfmdEntry + flowEntry) / 2;

  if (
    vfmdAnalysis.signal.type !== 'neutral' &&
    flowSignal.action !== 'HOLD' &&
    vfmdAnalysis.signal.type.includes(flowSignal.action.toLowerCase())
  ) {
    console.log(`\n✨ TRADE SETUP CONFIRMED!`);
    console.log(`   Entry: $${entryPrice.toFixed(2)}`);
    console.log(`   Target: $${vfmdAnalysis.entry_guidance.profit_target}`);
    console.log(`   Stop: $${vfmdAnalysis.entry_guidance.stop_loss}`);
    console.log(`   Risk/Reward: ${vfmdAnalysis.entry_guidance.risk_reward}`);
    console.log(`   Plan: VFMD found early setup, Flow confirms momentum`);
  }
}

// ============================================================================
// API ENDPOINTS YOU CAN USE
// ============================================================================

/*
You have 5 endpoints available right now:

POST /api/agents/physics/vfmd-analyze
  ├─ Input: {symbol: "BTC/USDT"} or {data: MarketTick[]}
  └─ Output: VFMD analysis with early entry signal

POST /api/agents/physics/flow-analyze
  ├─ Input: {symbol: "BTC/USDT"} or {data: FlowFieldPoint[]}
  └─ Output: Flow field metrics and momentum signals

POST /api/agents/physics/compare
  ├─ Input: {symbol}
  └─ Output: Both VFMD and Flow results + consensus

GET /api/agents/physics/agents
  └─ Output: List of all physics agents

GET /api/agents/physics/status
  └─ Output: Health check and agent levels
*/

// ============================================================================
// FLOW ENGINE METRICS - DETAILED BREAKDOWN
// ============================================================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FLOW ENGINE METRIC GUIDE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ LATESTFORCE (0.0 - ∞)                                                        │
│ ├─ What: Current momentum magnitude                                          │
│ ├─ Range: 0.0 (no move) → 0.05+ (strong move)                              │
│ └─ Use: Detect if something is moving NOW                                   │
│                                                                               │
│ AVERAGEFORCE (0.0 - ∞)                                                       │
│ ├─ What: Average momentum over lookback                                      │
│ ├─ Range: 0.01 (quiet) → 0.05 (active)                                     │
│ └─ Use: Overall market activity level                                       │
│                                                                               │
│ MAXFORCE (0.0 - ∞)                                                           │
│ ├─ What: Strongest push during period                                       │
│ ├─ Range: 0.02 (minor) → 0.15+ (breakout)                                  │
│ └─ Use: How strong was the best move? (breakout strength)                   │
│                                                                               │
│ FORCEDIRECTION (-π to +π radians, or -180° to +180°)                        │
│ ├─ What: Direction vector angle                                             │
│ ├─ Range: -π (pure down) → 0 (mixed) → +π (pure up)                        │
│ └─ Use: sin(angle) = directional bias (-1 = bearish, +1 = bullish)         │
│                                                                               │
│ PRESSURE (0.0 - ∞)                                                           │
│ ├─ What: Accumulated stress/energy                                          │
│ ├─ Range: 0.1 (quiet) → 0.5 (building) → 1.0+ (ready to pop)               │
│ └─ Use: Energy level before breakout                                        │
│                                                                               │
│ TURBULENCE (0.0 - ∞)                                                         │
│ ├─ What: Chaos level (variance in forces)                                   │
│ ├─ Range: 0.00001 (very clean) → 0.1 (choppy)                              │
│ ├─ Levels: 'low' | 'medium' | 'high' | 'extreme'                           │
│ └─ Use: Filter noise - only trade when low (clean flow)                     │
│                                                                               │
│ ENERGYGRADIENT (can be negative)                                             │
│ ├─ What: Rate of pressure change (acceleration)                             │
│ ├─ Range: -1.0 (accelerating down) → 0 (stable) → +1.0 (up)                │
│ ├─ Trend: 'accelerating' | 'decelerating' | 'stable'                       │
│ └─ Use: Detect momentum shifts and reversals                                │
│                                                                               │
│ DOMINANTDIRECTION                                                            │
│ ├─ What: Overall direction bias                                             │
│ ├─ Values: 'bullish' | 'bearish' | 'neutral'                                │
│ └─ Use: High-level market bias                                              │
│                                                                               │
│ PRESURETREND                                                                 │
│ ├─ What: Is pressure building or releasing?                                 │
│ ├─ Values: 'rising' (building) | 'falling' (releasing) | 'stable'          │
│ └─ Use: Setup quality - rising pressure + low turb = good setup             │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// ============================================================================
// PRACTICAL TRADING RECIPES
// ============================================================================

function recipe1_TrendFollowing() {
  /*
  Strategy: Follow strong momentum with low turbulence
  
  Entry Rules:
  1. dominantDirection = 'bullish' or 'bearish'
  2. turbulenceLevel = 'low' or 'medium' (clean flow)
  3. averageForce > 0.01 (something is moving)
  4. energyTrend = 'accelerating' (momentum building)
  5. maxForce > averageForce * 1.5 (current push stronger than average)
  
  Exit Rules:
  1. energyTrend = 'decelerating' (momentum fading)
  2. pressureTrend = 'falling' (energy releasing)
  3. turbulence > 0.01 (flow getting chaotic)
  */

  const flow = new FlowPhysicsAgent('TrendFollower', 'aggressive');
  const signal = flow.generateSignal(flowData);

  return signal;
}

function recipe2_ReversalHunting() {
  /*
  Strategy: Catch reversals using divergence and gradient changes
  
  Setup:
  1. pressureTrend = 'rising' (energy building)
  2. energyGradient starts slowing (gradient decreasing)
  3. energyTrend changes from 'accelerating' to 'stable'
  4. Turbulence stays low (clean wind down)
  
  Signal:
  1. dominantDirection changes (price follows later)
  2. forceDirection angle flips
  3. New pressure cycle begins (fresh breakout)
  */

  const flow = new FlowPhysicsAgent('ReversalHunter', 'balanced');
  return flow.generateSignal(flowData);
}

function recipe3_BreakoutConfirmation() {
  /*
  Strategy: Wait for pressure + force alignment, then execute
  
  Checklist:
  1. Pressure > 0.5 (significant energy)
  2. averageForce > 0.02 (real momentum)
  3. turbulenceLevel = 'low' (clean)
  4. maxForce > 0.08 (strong push)
  5. All directional (no crossing)
  
  When all 5: Execute immediately
  Confidence: pressure shows setup quality, force shows execution
  */

  const flow = new FlowPhysicsAgent('BreakoutTrader', 'balanced');
  return flow.generateSignal(flowData);
}

export {
  example1_DetectBreakoutStrength,
  example2_DetectMomentumShift,
  example3_DetectOrderFlowImbalance,
  example4_DetectReversal,
  example5_MonitorEnergyLevels,
  example6_BatchAnalysis,
  example7_CustomConfig,
  agentExample1_GenerateSignals,
  agentExample2_MultiTimeframe,
  agentExample3_EnsembleVoting,
  agentExample4_RegimeAdaptation,
  agentExample5_PerformanceTracking,
  combinedStrategy_VFMDDetectsEarlyVFMDThenFlowConfirms,
  recipe1_TrendFollowing,
  recipe2_ReversalHunting,
  recipe3_BreakoutConfirmation,
};
