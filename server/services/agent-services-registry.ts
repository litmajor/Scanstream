/**
 * Agent Services Registry
 * Centralized access to all RPG agent services with feature flag checks
 * 
 * Provides:
 * - Agent core service instantiation
 * - Agent ability access
 * - RPG system features
 */

import { isFeatureEnabled, FLAGS } from '../config/featureFlags';

export interface AgentServiceStatus {
  name: string;
  enabled: boolean;
  flag: string;
  description: string;
}

/**
 * Get status of all agent services
 */
export function getAgentServicesStatus(): AgentServiceStatus[] {
  return [
    // Core Services
    {
      name: 'Agent Lifecycle Manager',
      enabled: isFeatureEnabled(FLAGS.AGENT_LIFECYCLE),
      flag: FLAGS.AGENT_LIFECYCLE,
      description: 'Spawning, leveling, XP system',
    },
    {
      name: 'Agent Arena',
      enabled: isFeatureEnabled(FLAGS.AGENT_ARENA),
      flag: FLAGS.AGENT_ARENA,
      description: 'Agent voting and consensus',
    },
    {
      name: 'Agent Clustering',
      enabled: isFeatureEnabled(FLAGS.AGENT_CLUSTERING),
      flag: FLAGS.AGENT_CLUSTERING,
      description: 'Specialist routing and clustering',
    },
    {
      name: 'Agent Synergy Detector',
      enabled: isFeatureEnabled(FLAGS.AGENT_SYNERGY),
      flag: FLAGS.AGENT_SYNERGY,
      description: 'Detect cooperative trading opportunities',
    },
    {
      name: 'Agent Achievement System',
      enabled: isFeatureEnabled(FLAGS.AGENT_ACHIEVEMENT_SYSTEM),
      flag: FLAGS.AGENT_ACHIEVEMENT_SYSTEM,
      description: 'Track achievements and progression',
    },
    {
      name: 'Agent Portfolio Manager',
      enabled: isFeatureEnabled(FLAGS.AGENT_PORTFOLIO_MANAGER),
      flag: FLAGS.AGENT_PORTFOLIO_MANAGER,
      description: 'Portfolio-level coordination',
    },

    // RPG System Features
    {
      name: 'Commander Approval',
      enabled: isFeatureEnabled(FLAGS.COMMANDER_APPROVAL),
      flag: FLAGS.COMMANDER_APPROVAL,
      description: 'Commander approval system',
    },
    {
      name: 'Daily Briefing',
      enabled: isFeatureEnabled(FLAGS.DAILY_BRIEFING),
      flag: FLAGS.DAILY_BRIEFING,
      description: 'Daily market briefings',
    },
    {
      name: 'Information Channels',
      enabled: isFeatureEnabled(FLAGS.INFORMATION_CHANNELS),
      flag: FLAGS.INFORMATION_CHANNELS,
      description: 'Agent communication system',
    },
    {
      name: 'Online Learning System',
      enabled: isFeatureEnabled(FLAGS.ONLINE_LEARNING_SYSTEM),
      flag: FLAGS.ONLINE_LEARNING_SYSTEM,
      description: 'Real-time agent learning',
    },
  ];
}

/**
 * Get status of all agent abilities
 */
export function getAgentAbilitiesStatus(): AgentServiceStatus[] {
  return [
    {
      name: 'Breakout Hunter',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_BREAKOUT_HUNTER),
      flag: FLAGS.AGENT_ABILITY_BREAKOUT_HUNTER,
      description: 'Catch breakout patterns',
    },
    {
      name: 'Reversal Master',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_REVERSAL_MASTER),
      flag: FLAGS.AGENT_ABILITY_REVERSAL_MASTER,
      description: 'Detect and trade reversals',
    },
    {
      name: 'Trend Rider',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_TREND_RIDER),
      flag: FLAGS.AGENT_ABILITY_TREND_RIDER,
      description: 'Follow trending markets',
    },
    {
      name: 'Support Sniper',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_SUPPORT_SNIPER),
      flag: FLAGS.AGENT_ABILITY_SUPPORT_SNIPER,
      description: 'Trade from support levels',
    },
    {
      name: 'Physics Flow',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_PHYSICS_FLOW),
      flag: FLAGS.AGENT_ABILITY_PHYSICS_FLOW,
      description: 'Flow field physics analysis',
    },
    {
      name: 'Physics VFMD',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_PHYSICS_VFMD),
      flag: FLAGS.AGENT_ABILITY_PHYSICS_VFMD,
      description: 'VFMD physics patterns',
    },
    {
      name: 'ML Oracle',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_ML_ORACLE),
      flag: FLAGS.AGENT_ABILITY_ML_ORACLE,
      description: 'ML-based predictions',
    },
    {
      name: 'Market Oracle',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_MARKET_ORACLE),
      flag: FLAGS.AGENT_ABILITY_MARKET_ORACLE,
      description: 'Market-wide analysis',
    },
    {
      name: 'Volume Verifier',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_VOLUME_VERIFIER),
      flag: FLAGS.AGENT_ABILITY_VOLUME_VERIFIER,
      description: 'Volume-based verification',
    },
    {
      name: 'Exit Orchestrator',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_EXIT_ORCHESTRATOR),
      flag: FLAGS.AGENT_ABILITY_EXIT_ORCHESTRATOR,
      description: 'Coordinated exit strategies',
    },
    {
      name: 'Opposition Reader',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_OPPOSITION_READER),
      flag: FLAGS.AGENT_ABILITY_OPPOSITION_READER,
      description: 'Read order flow opposition',
    },
    {
      name: 'Microstructure Specialist',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_MICROSTRUCTURE_SPECIALIST),
      flag: FLAGS.AGENT_ABILITY_MICROSTRUCTURE_SPECIALIST,
      description: 'Analyze market microstructure',
    },
    {
      name: 'Feature Engineer',
      enabled: isFeatureEnabled(FLAGS.AGENT_ABILITY_FEATURE_ENGINEER),
      flag: FLAGS.AGENT_ABILITY_FEATURE_ENGINEER,
      description: 'Generate trading features',
    },
  ];
}

/**
 * Check if an agent ability is available
 */
export function isAgentAbilityAvailable(
  abilityName:
    | 'breakout_hunter'
    | 'reversal_master'
    | 'trend_rider'
    | 'support_sniper'
    | 'physics_flow'
    | 'physics_vfmd'
    | 'ml_oracle'
    | 'market_oracle'
    | 'volume_verifier'
    | 'exit_orchestrator'
    | 'opposition_reader'
    | 'microstructure_specialist'
    | 'feature_engineer'
): boolean {
  const flagMap = {
    breakout_hunter: FLAGS.AGENT_ABILITY_BREAKOUT_HUNTER,
    reversal_master: FLAGS.AGENT_ABILITY_REVERSAL_MASTER,
    trend_rider: FLAGS.AGENT_ABILITY_TREND_RIDER,
    support_sniper: FLAGS.AGENT_ABILITY_SUPPORT_SNIPER,
    physics_flow: FLAGS.AGENT_ABILITY_PHYSICS_FLOW,
    physics_vfmd: FLAGS.AGENT_ABILITY_PHYSICS_VFMD,
    ml_oracle: FLAGS.AGENT_ABILITY_ML_ORACLE,
    market_oracle: FLAGS.AGENT_ABILITY_MARKET_ORACLE,
    volume_verifier: FLAGS.AGENT_ABILITY_VOLUME_VERIFIER,
    exit_orchestrator: FLAGS.AGENT_ABILITY_EXIT_ORCHESTRATOR,
    opposition_reader: FLAGS.AGENT_ABILITY_OPPOSITION_READER,
    microstructure_specialist: FLAGS.AGENT_ABILITY_MICROSTRUCTURE_SPECIALIST,
    feature_engineer: FLAGS.AGENT_ABILITY_FEATURE_ENGINEER,
  };

  const flagName = flagMap[abilityName];
  return flagName ? isFeatureEnabled(flagName) : false;
}

/**
 * Check if a core agent service is available
 */
export function isAgentServiceAvailable(
  serviceName:
    | 'lifecycle'
    | 'arena'
    | 'clustering'
    | 'synergy'
    | 'achievements'
    | 'portfolio_manager'
    | 'commander_approval'
    | 'daily_briefing'
    | 'information_channels'
    | 'online_learning'
): boolean {
  const flagMap = {
    lifecycle: FLAGS.AGENT_LIFECYCLE,
    arena: FLAGS.AGENT_ARENA,
    clustering: FLAGS.AGENT_CLUSTERING,
    synergy: FLAGS.AGENT_SYNERGY,
    achievements: FLAGS.AGENT_ACHIEVEMENT_SYSTEM,
    portfolio_manager: FLAGS.AGENT_PORTFOLIO_MANAGER,
    commander_approval: FLAGS.COMMANDER_APPROVAL,
    daily_briefing: FLAGS.DAILY_BRIEFING,
    information_channels: FLAGS.INFORMATION_CHANNELS,
    online_learning: FLAGS.ONLINE_LEARNING_SYSTEM,
  };

  const flagName = flagMap[serviceName];
  return flagName ? isFeatureEnabled(flagName) : false;
}

/**
 * Get count of enabled agent abilities
 */
export function getEnabledAbilitiesCount(): number {
  return getAgentAbilitiesStatus().filter((a) => a.enabled).length;
}

/**
 * Get count of enabled agent services
 */
export function getEnabledServicesCount(): number {
  return getAgentServicesStatus().filter((s) => s.enabled).length;
}

/**
 * Get all enabled agent features (services + abilities)
 */
export function getAllEnabledAgentFeatures(): {
  services: AgentServiceStatus[];
  abilities: AgentServiceStatus[];
  totalEnabled: number;
} {
  const services = getAgentServicesStatus().filter((s) => s.enabled);
  const abilities = getAgentAbilitiesStatus().filter((a) => a.enabled);

  return {
    services,
    abilities,
    totalEnabled: services.length + abilities.length,
  };
}

export default {
  getAgentServicesStatus,
  getAgentAbilitiesStatus,
  isAgentAbilityAvailable,
  isAgentServiceAvailable,
  getEnabledAbilitiesCount,
  getEnabledServicesCount,
  getAllEnabledAgentFeatures,
};
