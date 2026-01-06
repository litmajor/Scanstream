/**
 * Agent Abilities Registry
 * Maps agent abilities to their implementations and feature flag requirements
 * Provides ability state management and availability checks
 */

import { isFeatureEnabled, FLAGS } from '../config/featureFlags';

/**
 * Agent ability definition with metadata and requirements
 */
export interface AgentAbility {
  id: string;
  name: string;
  description: string;
  category: 'specialist' | 'leveled' | 'rpg';
  unlocksAtLevel?: number; // For leveled abilities
  flagName: string;
  requiredXP?: number;
  cooldownMs?: number;
  energyCost?: number;
}

/**
 * Registry of all agent abilities keyed by ID
 */
export const AGENT_ABILITIES: Record<string, AgentAbility> = {
  // ============================================================================
  // SPECIALIST ABILITIES (always available for specialized agents)
  // ============================================================================
  
  breakout_hunter: {
    id: 'breakout_hunter',
    name: 'Breakout Hunter',
    description: 'Specialist in detecting and trading breakouts with high confidence',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_BREAKOUT_HUNTER,
  },

  reversal_master: {
    id: 'reversal_master',
    name: 'Reversal Master',
    description: 'Expert at identifying and trading reversal patterns',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_REVERSAL_MASTER,
  },

  trend_rider: {
    id: 'trend_rider',
    name: 'Trend Rider',
    description: 'Master of riding trending markets with momentum analysis',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_TREND_RIDER,
  },

  support_sniper: {
    id: 'support_sniper',
    name: 'Support Sniper',
    description: 'Precision trading around support and resistance levels',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_SUPPORT_SNIPER,
  },

  physics_flow: {
    id: 'physics_flow',
    name: 'Physics Flow Analysis',
    description: 'Analyze market using vector field physics models',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_PHYSICS_FLOW,
  },

  physics_vfmd: {
    id: 'physics_vfmd',
    name: 'VFMD Physics',
    description: 'Vector Field Market Dynamics analysis for trend prediction',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_PHYSICS_VFMD,
  },

  ml_oracle: {
    id: 'ml_oracle',
    name: 'ML Oracle',
    description: 'Machine learning predictions for market direction',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_ML_ORACLE,
  },

  market_oracle: {
    id: 'market_oracle',
    name: 'Market Oracle',
    description: 'Aggregate market intelligence for trading signals',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_MARKET_ORACLE,
  },

  volume_verifier: {
    id: 'volume_verifier',
    name: 'Volume Mechanical Verifier',
    description: 'Verify signal conviction using volume profile analysis',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_VOLUME_VERIFIER,
  },

  exit_orchestrator: {
    id: 'exit_orchestrator',
    name: 'Exit Orchestrator',
    description: 'Coordinate optimal exits for maximum profit realization',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_EXIT_ORCHESTRATOR,
  },

  opposition_reader: {
    id: 'opposition_reader',
    name: 'Opposition Reader',
    description: 'Identify and trade against market opposition levels',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_OPPOSITION_READER,
  },

  microstructure_specialist: {
    id: 'microstructure_specialist',
    name: 'Microstructure Specialist',
    description: 'Exploit market microstructure inefficiencies',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_MICROSTRUCTURE_SPECIALIST,
  },

  feature_engineer: {
    id: 'feature_engineer',
    name: 'Feature Engineer',
    description: 'Create and optimize custom trading features',
    category: 'specialist',
    flagName: FLAGS.AGENT_ABILITY_FEATURE_ENGINEER,
  },

  // ============================================================================
  // LEVELED ABILITIES (unlock as agents gain XP and levels)
  // ============================================================================

  dynamic_position_sizing: {
    id: 'dynamic_position_sizing',
    name: 'Dynamic Position Sizing',
    description: 'Adjust position size dynamically based on confidence and risk',
    category: 'leveled',
    unlocksAtLevel: 3,
    flagName: FLAGS.AGENT_ABILITY_DYNAMIC_POSITION_SIZING,
    requiredXP: 300,
  },

  intelligent_exits: {
    id: 'intelligent_exits',
    name: 'Intelligent Exits',
    description: 'Dynamic exit strategies that adapt to market conditions',
    category: 'leveled',
    unlocksAtLevel: 5,
    flagName: FLAGS.AGENT_ABILITY_INTELLIGENT_EXITS,
    requiredXP: 500,
  },

  multi_timeframe_confirmation: {
    id: 'multi_timeframe_confirmation',
    name: 'Multi-Timeframe Confirmation',
    description: 'Confirm signals across multiple timeframes for higher confidence',
    category: 'leveled',
    unlocksAtLevel: 7,
    flagName: FLAGS.AGENT_ABILITY_MULTI_TIMEFRAME_CONFIRMATION,
    requiredXP: 700,
  },

  regime_adaptation: {
    id: 'regime_adaptation',
    name: 'Regime Adaptation',
    description: 'Adapt trading strategy based on market regime detection',
    category: 'leveled',
    unlocksAtLevel: 10,
    flagName: FLAGS.AGENT_ABILITY_REGIME_ADAPTATION,
    requiredXP: 1000,
  },

  velocity_based_targets: {
    id: 'velocity_based_targets',
    name: 'Velocity-Based Targets',
    description: 'Calculate profit targets using velocity profile analysis',
    category: 'leveled',
    unlocksAtLevel: 12,
    flagName: FLAGS.AGENT_ABILITY_VELOCITY_BASED_TARGETS,
    requiredXP: 1200,
  },

  correlation_hedging: {
    id: 'correlation_hedging',
    name: 'Correlation Hedging',
    description: 'Hedge positions using correlation analysis',
    category: 'leveled',
    unlocksAtLevel: 15,
    flagName: FLAGS.AGENT_ABILITY_CORRELATION_HEDGING,
    requiredXP: 1500,
  },

  pattern_discovery: {
    id: 'pattern_discovery',
    name: 'Pattern Discovery',
    description: 'Discover new trading patterns autonomously',
    category: 'leveled',
    unlocksAtLevel: 18,
    flagName: FLAGS.AGENT_ABILITY_PATTERN_DISCOVERY,
    requiredXP: 1800,
  },

  portfolio_optimization: {
    id: 'portfolio_optimization',
    name: 'Portfolio Optimization',
    description: 'Optimize entire portfolio allocation based on correlation',
    category: 'leveled',
    unlocksAtLevel: 20,
    flagName: FLAGS.AGENT_ABILITY_PORTFOLIO_OPTIMIZATION,
    requiredXP: 2000,
  },

  strategy_creation: {
    id: 'strategy_creation',
    name: 'Strategy Creation',
    description: 'Create and spawn new sub-strategies as sub-agents',
    category: 'leveled',
    unlocksAtLevel: 25,
    flagName: FLAGS.AGENT_ABILITY_STRATEGY_CREATION,
    requiredXP: 2500,
  },
};

/**
 * Get ability definition by ID
 */
export function getAbility(abilityId: string): AgentAbility | undefined {
  return AGENT_ABILITIES[abilityId];
}

/**
 * Check if an ability is available (feature flag enabled)
 */
export function isAbilityAvailable(abilityId: string): boolean {
  const ability = getAbility(abilityId);
  if (!ability) return false;

  return isFeatureEnabled(ability.flagName as any);
}

/**
 * Get all available specialist abilities
 */
export function getSpecialistAbilities(): AgentAbility[] {
  return Object.values(AGENT_ABILITIES).filter(
    (a) => a.category === 'specialist' && isAbilityAvailable(a.id)
  );
}

/**
 * Get leveled abilities unlocked at or before a specific level
 */
export function getLeveledAbilitiesByLevel(agentLevel: number): AgentAbility[] {
  return Object.values(AGENT_ABILITIES).filter(
    (a) =>
      a.category === 'leveled' &&
      a.unlocksAtLevel !== undefined &&
      a.unlocksAtLevel <= agentLevel &&
      isAbilityAvailable(a.id)
  );
}

/**
 * Get next leveled ability to unlock
 */
export function getNextLevelAbility(agentLevel: number): AgentAbility | undefined {
  return Object.values(AGENT_ABILITIES).find(
    (a) =>
      a.category === 'leveled' &&
      a.unlocksAtLevel !== undefined &&
      a.unlocksAtLevel === agentLevel + 1
  );
}

/**
 * Get all abilities in a category
 */
export function getAbilitiesByCategory(
  category: 'specialist' | 'leveled' | 'rpg'
): AgentAbility[] {
  return Object.values(AGENT_ABILITIES).filter((a) => a.category === category);
}

/**
 * Get ability availability report (for admin/debug)
 */
export function getAbilityReport(): {
  total: number;
  available: number;
  byCategory: Record<string, { total: number; available: number }>;
  unavailable: AgentAbility[];
} {
  const allAbilities = Object.values(AGENT_ABILITIES);
  const availableAbilities = allAbilities.filter((a) => isAbilityAvailable(a.id));
  const unavailableAbilities = allAbilities.filter((a) => !isAbilityAvailable(a.id));

  const byCategory: Record<string, { total: number; available: number }> = {
    specialist: { total: 0, available: 0 },
    leveled: { total: 0, available: 0 },
    rpg: { total: 0, available: 0 },
  };

  allAbilities.forEach((a) => {
    byCategory[a.category].total++;
    if (isAbilityAvailable(a.id)) {
      byCategory[a.category].available++;
    }
  });

  return {
    total: allAbilities.length,
    available: availableAbilities.length,
    byCategory,
    unavailable: unavailableAbilities,
  };
}

export default {
  AGENT_ABILITIES,
  getAbility,
  isAbilityAvailable,
  getSpecialistAbilities,
  getLeveledAbilitiesByLevel,
  getNextLevelAbility,
  getAbilitiesByCategory,
  getAbilityReport,
};
