/**
 * Feature Flags System
 * Centralized feature toggle management for all services and endpoints
 * 
 * Flags can be:
 * - Defined with defaults (ON or OFF)
 * - Overridden via environment variables: FEATURE_FLAG_<FLAG_NAME>=true|false
 * - Toggled at runtime via /api/feature-flags endpoints (dev-only)
 * - Persisted to memory (reset on server restart)
 */

export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  category: 'strategy' | 'service' | 'analysis' | 'experimental' | 'admin';
}

export interface FeatureFlagsConfig {
  [key: string]: FeatureFlag;
}

/**
 * Define ALL feature flags in the system
 * Add new features here with default state
 */
const DEFAULT_FLAGS: FeatureFlagsConfig = {
  // Strategy & Trading Features
  trade_duration_predictor: {
    name: 'trade_duration_predictor',
    description: 'Predict holding period based on cluster strength and trend characteristics',
    enabled: false,
    category: 'strategy',
  },
  pyramid_strategy: {
    name: 'pyramid_strategy',
    description: 'Safely add to winning positions using cluster validation',
    enabled: false,
    category: 'strategy',
  },
  adaptive_holding_period: {
    name: 'adaptive_holding_period',
    description: 'Dynamically adjust position holding based on market conditions',
    enabled: false,
    category: 'strategy',
  },
  regime_aware_trading: {
    name: 'regime_aware_trading',
    description: 'Adjust trading parameters based on detected market regime',
    enabled: false,
    category: 'strategy',
  },

  // Agent Core Features
  agent_lifecycle: {
    name: 'agent_lifecycle',
    description: 'Enable agent spawning, leveling, and lifecycle management',
    enabled: true,
    category: 'service',
  },
  agent_arena: {
    name: 'agent_arena',
    description: 'Enable agent interaction arena with voting and consensus',
    enabled: true,
    category: 'service',
  },
  agent_clustering: {
    name: 'agent_clustering',
    description: 'Enable agent clustering and specialist routing',
    enabled: true,
    category: 'service',
  },
  agent_synergy: {
    name: 'agent_synergy',
    description: 'Enable agent synergy detection and cooperative trading',
    enabled: false,
    category: 'service',
  },
  agent_achievement_system: {
    name: 'agent_achievement_system',
    description: 'Track agent achievements, XP, and progression',
    enabled: false,
    category: 'service',
  },
  agent_portfolio_manager: {
    name: 'agent_portfolio_manager',
    description: 'Enable portfolio-level agent coordination',
    enabled: false,
    category: 'service',
  },

  // Agent Abilities & Specializations
  agent_ability_breakout_hunter: {
    name: 'agent_ability_breakout_hunter',
    description: 'Enable Breakout Hunter agent ability',
    enabled: true,
    category: 'service',
  },
  agent_ability_reversal_master: {
    name: 'agent_ability_reversal_master',
    description: 'Enable Reversal Master agent ability',
    enabled: true,
    category: 'service',
  },
  agent_ability_trend_rider: {
    name: 'agent_ability_trend_rider',
    description: 'Enable Trend Rider agent ability',
    enabled: true,
    category: 'service',
  },
  agent_ability_support_sniper: {
    name: 'agent_ability_support_sniper',
    description: 'Enable Support Sniper agent ability',
    enabled: true,
    category: 'service',
  },
  agent_ability_physics_flow: {
    name: 'agent_ability_physics_flow',
    description: 'Enable Flow Physics agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_physics_vfmd: {
    name: 'agent_ability_physics_vfmd',
    description: 'Enable VFMD Physics agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_ml_oracle: {
    name: 'agent_ability_ml_oracle',
    description: 'Enable ML Oracle agent ability',
    enabled: true,
    category: 'service',
  },
  agent_ability_market_oracle: {
    name: 'agent_ability_market_oracle',
    description: 'Enable Market Oracle agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_volume_verifier: {
    name: 'agent_ability_volume_verifier',
    description: 'Enable Volume Mechanical Verifier agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_exit_orchestrator: {
    name: 'agent_ability_exit_orchestrator',
    description: 'Enable Exit Orchestrator agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_opposition_reader: {
    name: 'agent_ability_opposition_reader',
    description: 'Enable Opposition Reader agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_microstructure_specialist: {
    name: 'agent_ability_microstructure_specialist',
    description: 'Enable Microstructure Specialist agent ability',
    enabled: false,
    category: 'service',
  },
  agent_ability_feature_engineer: {
    name: 'agent_ability_feature_engineer',
    description: 'Enable Feature Engineer agent ability',
    enabled: false,
    category: 'service',
  },

  // Agent Leveled Abilities (unlock progressively as agents gain XP)
  agent_ability_dynamic_position_sizing: {
    name: 'agent_ability_dynamic_position_sizing',
    description: 'Unlock at Level 3 - Dynamic position sizing based on confidence',
    enabled: true,
    category: 'service',
  },
  agent_ability_intelligent_exits: {
    name: 'agent_ability_intelligent_exits',
    description: 'Unlock at Level 5 - Dynamic exit strategies based on market conditions',
    enabled: true,
    category: 'service',
  },
  agent_ability_multi_timeframe_confirmation: {
    name: 'agent_ability_multi_timeframe_confirmation',
    description: 'Unlock at Level 7 - Confirm signals across multiple timeframes',
    enabled: true,
    category: 'service',
  },
  agent_ability_regime_adaptation: {
    name: 'agent_ability_regime_adaptation',
    description: 'Unlock at Level 10 - Adapt strategy to market regime',
    enabled: true,
    category: 'service',
  },
  agent_ability_velocity_based_targets: {
    name: 'agent_ability_velocity_based_targets',
    description: 'Unlock at Level 12 - Calculate targets using velocity analysis',
    enabled: true,
    category: 'service',
  },
  agent_ability_correlation_hedging: {
    name: 'agent_ability_correlation_hedging',
    description: 'Unlock at Level 15 - Hedge positions using correlation analysis',
    enabled: true,
    category: 'service',
  },
  agent_ability_pattern_discovery: {
    name: 'agent_ability_pattern_discovery',
    description: 'Unlock at Level 18 - Discover new trading patterns autonomously',
    enabled: true,
    category: 'service',
  },
  agent_ability_portfolio_optimization: {
    name: 'agent_ability_portfolio_optimization',
    description: 'Unlock at Level 20 - Optimize entire portfolio allocation',
    enabled: true,
    category: 'service',
  },
  agent_ability_strategy_creation: {
    name: 'agent_ability_strategy_creation',
    description: 'Unlock at Level 25 - Create and spawn new sub-strategies',
    enabled: false,
    category: 'service',
  },

  // RPG System Features
  commander_approval: {
    name: 'commander_approval',
    description: 'Enable commander approval system for major decisions',
    enabled: false,
    category: 'service',
  },
  daily_briefing: {
    name: 'daily_briefing',
    description: 'Generate daily briefing reports with market summary',
    enabled: false,
    category: 'service',
  },
  information_channels: {
    name: 'information_channels',
    description: 'Enable agent information channel system for communication',
    enabled: false,
    category: 'service',
  },
  online_learning_system: {
    name: 'online_learning_system',
    description: 'Enable online learning for agents to adapt in real-time',
    enabled: false,
    category: 'service',
  },

  // Analysis Features
  physics_validation: {
    name: 'physics_validation',
    description: 'Enable physics-based model validation and scoring',
    enabled: true,
    category: 'analysis',
  },
  ml_lstm_consensus: {
    name: 'ml_lstm_consensus',
    description: 'Use ML LSTM consensus for signal prediction',
    enabled: true,
    category: 'analysis',
  },
  bayesian_belief_update: {
    name: 'bayesian_belief_update',
    description: 'Update agent beliefs using Bayesian learning system',
    enabled: false,
    category: 'analysis',
  },
  flow_field_analytics: {
    name: 'flow_field_analytics',
    description: 'Enable flow field based market structure analysis',
    enabled: true,
    category: 'analysis',
  },
  cross_exchange_aggregation: {
    name: 'cross_exchange_aggregation',
    description: 'Aggregate data and signals across multiple exchanges',
    enabled: false,
    category: 'analysis',
  },

  // Experimental Features
  advanced_risk_metrics: {
    name: 'advanced_risk_metrics',
    description: 'Calculate advanced risk metrics like VaR and CVaR',
    enabled: false,
    category: 'experimental',
  },
  neural_network_signals: {
    name: 'neural_network_signals',
    description: 'Use neural network based signal generation',
    enabled: false,
    category: 'experimental',
  },
  portfolio_optimization: {
    name: 'portfolio_optimization',
    description: 'Enable portfolio-level optimization algorithms',
    enabled: false,
    category: 'experimental',
  },

  // Admin Features
  feature_flag_ui: {
    name: 'feature_flag_ui',
    description: 'Enable UI dashboard for feature flag management',
    enabled: false,
    category: 'admin',
  },
  debug_logging: {
    name: 'debug_logging',
    description: 'Enable verbose debug logging for all services',
    enabled: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
    category: 'admin',
  },
  metrics_collection: {
    name: 'metrics_collection',
    description: 'Collect and expose service metrics',
    enabled: true,
    category: 'admin',
  },
};

/**
 * Runtime flag state (can be toggled at runtime in dev mode)
 * Initialized from defaults + environment overrides
 */
let runtimeFlags: FeatureFlagsConfig = {};

/**
 * Initialize feature flags from defaults and environment
 */
function initializeFlags(): void {
  runtimeFlags = JSON.parse(JSON.stringify(DEFAULT_FLAGS));

  // Override from environment variables: FEATURE_FLAG_<NAME>=true|false
  Object.keys(runtimeFlags).forEach((flagName) => {
    const envKey = `FEATURE_FLAG_${flagName.toUpperCase()}`;
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
      runtimeFlags[flagName].enabled = envValue === 'true' || envValue === '1';
      console.log(`[FeatureFlags] ${flagName} override from env: ${runtimeFlags[flagName].enabled}`);
    }
  });
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagName: string): boolean {
  if (!runtimeFlags[flagName]) {
    console.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
    return false;
  }
  return runtimeFlags[flagName].enabled;
}

/**
 * Get all feature flags
 */
export function getAllFlags(): FeatureFlagsConfig {
  return JSON.parse(JSON.stringify(runtimeFlags));
}

/**
 * Get flags by category
 */
export function getFlagsByCategory(
  category: 'strategy' | 'service' | 'analysis' | 'experimental' | 'admin'
): FeatureFlagsConfig {
  const result: FeatureFlagsConfig = {};
  Object.entries(runtimeFlags).forEach(([name, flag]) => {
    if (flag.category === category) {
      result[name] = flag;
    }
  });
  return result;
}

/**
 * Set a feature flag at runtime (dev-only by default)
 * Returns true if successful, false if flag doesn't exist
 */
export function setFeatureFlag(flagName: string, enabled: boolean): boolean {
  if (!runtimeFlags[flagName]) {
    return false;
  }
  runtimeFlags[flagName].enabled = enabled;
  console.log(`[FeatureFlags] ${flagName} set to ${enabled}`);
  return true;
}

/**
 * Reset all flags to defaults
 */
export function resetAllFlags(): void {
  runtimeFlags = JSON.parse(JSON.stringify(DEFAULT_FLAGS));
  console.log('[FeatureFlags] All flags reset to defaults');
}

/**
 * Reload flags from environment (useful after env changes)
 */
export function reloadFlagsFromEnv(): void {
  initializeFlags();
  console.log('[FeatureFlags] Reloaded from environment');
}

/**
 * Export flag names as constants for type safety
 */
export const FLAGS = {
  TRADE_DURATION_PREDICTOR: 'trade_duration_predictor',
  PYRAMID_STRATEGY: 'pyramid_strategy',
  ADAPTIVE_HOLDING_PERIOD: 'adaptive_holding_period',
  REGIME_AWARE_TRADING: 'regime_aware_trading',
  
  // Agent Core
  AGENT_LIFECYCLE: 'agent_lifecycle',
  AGENT_ARENA: 'agent_arena',
  AGENT_CLUSTERING: 'agent_clustering',
  AGENT_SYNERGY: 'agent_synergy',
  AGENT_ACHIEVEMENT_SYSTEM: 'agent_achievement_system',
  AGENT_PORTFOLIO_MANAGER: 'agent_portfolio_manager',
  
  // Agent Abilities
  AGENT_ABILITY_BREAKOUT_HUNTER: 'agent_ability_breakout_hunter',
  AGENT_ABILITY_REVERSAL_MASTER: 'agent_ability_reversal_master',
  AGENT_ABILITY_TREND_RIDER: 'agent_ability_trend_rider',
  AGENT_ABILITY_SUPPORT_SNIPER: 'agent_ability_support_sniper',
  AGENT_ABILITY_PHYSICS_FLOW: 'agent_ability_physics_flow',
  AGENT_ABILITY_PHYSICS_VFMD: 'agent_ability_physics_vfmd',
  AGENT_ABILITY_ML_ORACLE: 'agent_ability_ml_oracle',
  AGENT_ABILITY_MARKET_ORACLE: 'agent_ability_market_oracle',
  AGENT_ABILITY_VOLUME_VERIFIER: 'agent_ability_volume_verifier',
  AGENT_ABILITY_EXIT_ORCHESTRATOR: 'agent_ability_exit_orchestrator',
  AGENT_ABILITY_OPPOSITION_READER: 'agent_ability_opposition_reader',
  AGENT_ABILITY_MICROSTRUCTURE_SPECIALIST: 'agent_ability_microstructure_specialist',
  AGENT_ABILITY_FEATURE_ENGINEER: 'agent_ability_feature_engineer',
  
  // Agent Leveled Abilities
  AGENT_ABILITY_DYNAMIC_POSITION_SIZING: 'agent_ability_dynamic_position_sizing',
  AGENT_ABILITY_INTELLIGENT_EXITS: 'agent_ability_intelligent_exits',
  AGENT_ABILITY_MULTI_TIMEFRAME_CONFIRMATION: 'agent_ability_multi_timeframe_confirmation',
  AGENT_ABILITY_REGIME_ADAPTATION: 'agent_ability_regime_adaptation',
  AGENT_ABILITY_VELOCITY_BASED_TARGETS: 'agent_ability_velocity_based_targets',
  AGENT_ABILITY_CORRELATION_HEDGING: 'agent_ability_correlation_hedging',
  AGENT_ABILITY_PATTERN_DISCOVERY: 'agent_ability_pattern_discovery',
  AGENT_ABILITY_PORTFOLIO_OPTIMIZATION: 'agent_ability_portfolio_optimization',
  AGENT_ABILITY_STRATEGY_CREATION: 'agent_ability_strategy_creation',
  
  // RPG System
  COMMANDER_APPROVAL: 'commander_approval',
  DAILY_BRIEFING: 'daily_briefing',
  INFORMATION_CHANNELS: 'information_channels',
  ONLINE_LEARNING_SYSTEM: 'online_learning_system',
  
  // Analysis Features
  PHYSICS_VALIDATION: 'physics_validation',
  ML_LSTM_CONSENSUS: 'ml_lstm_consensus',
  BAYESIAN_BELIEF_UPDATE: 'bayesian_belief_update',
  FLOW_FIELD_ANALYTICS: 'flow_field_analytics',
  CROSS_EXCHANGE_AGGREGATION: 'cross_exchange_aggregation',
  
  // Experimental
  ADVANCED_RISK_METRICS: 'advanced_risk_metrics',
  NEURAL_NETWORK_SIGNALS: 'neural_network_signals',
  PORTFOLIO_OPTIMIZATION: 'portfolio_optimization',
  
  // Admin
  FEATURE_FLAG_UI: 'feature_flag_ui',
  DEBUG_LOGGING: 'debug_logging',
  METRICS_COLLECTION: 'metrics_collection',
} as const;

// Initialize on module load
initializeFlags();

export default {
  isFeatureEnabled,
  getAllFlags,
  getFlagsByCategory,
  setFeatureFlag,
  resetAllFlags,
  reloadFlagsFromEnv,
  FLAGS,
};
