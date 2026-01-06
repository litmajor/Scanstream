/**
 * Agent Services API Routes
 * Expose agent core services and abilities via HTTP API
 * 
 * GET  /api/agents/services          - List all agent services and their status
 * GET  /api/agents/abilities          - List all agent abilities and their status
 * GET  /api/agents/status             - Get overall agent system status
 * POST /api/agents/spawn              - Spawn a new agent (if lifecycle enabled)
 * GET  /api/agents/list               - List active agents
 * POST /api/agents/:agent/ability     - Trigger agent ability (if enabled)
 */

import { Router, Request, Response } from 'express';
import {
  getAgentServicesStatus,
  getAgentAbilitiesStatus,
  isAgentAbilityAvailable,
  isAgentServiceAvailable,
  getEnabledAbilitiesCount,
  getEnabledServicesCount,
  getAllEnabledAgentFeatures,
} from '../services/agent-services-registry';
import { isFeatureEnabled, FLAGS } from '../config/featureFlags';

const router = Router();

/**
 * GET /api/agents/services
 * List all agent core services and their status
 */
router.get('/services', (req: Request, res: Response) => {
  const services = getAgentServicesStatus();
  const enabled = services.filter((s) => s.enabled);

  res.json({
    timestamp: new Date().toISOString(),
    total: services.length,
    enabled_count: enabled.length,
    services: services.map((s) => ({
      ...s,
      enabled: isFeatureEnabled(s.flag),
    })),
  });
});

/**
 * GET /api/agents/abilities
 * List all agent abilities and their status
 */
router.get('/abilities', (req: Request, res: Response) => {
  const abilities = getAgentAbilitiesStatus();
  const enabled = abilities.filter((a) => a.enabled);

  res.json({
    timestamp: new Date().toISOString(),
    total: abilities.length,
    enabled_count: enabled.length,
    abilities: abilities.map((a) => ({
      ...a,
      enabled: isFeatureEnabled(a.flag),
    })),
  });
});

/**
 * GET /api/agents/status
 * Get overall agent system status
 */
router.get('/status', (req: Request, res: Response) => {
  const allFeatures = getAllEnabledAgentFeatures();
  const services = getAgentServicesStatus();
  const abilities = getAgentAbilitiesStatus();

  res.json({
    timestamp: new Date().toISOString(),
    agent_system: {
      overall_enabled: isFeatureEnabled(FLAGS.AGENT_LIFECYCLE),
      total_services: services.length,
      enabled_services: allFeatures.services.length,
      total_abilities: abilities.length,
      enabled_abilities: allFeatures.abilities.length,
      total_features_enabled: allFeatures.totalEnabled,
    },
    core_services: {
      lifecycle: isFeatureEnabled(FLAGS.AGENT_LIFECYCLE),
      arena: isFeatureEnabled(FLAGS.AGENT_ARENA),
      clustering: isFeatureEnabled(FLAGS.AGENT_CLUSTERING),
      synergy: isFeatureEnabled(FLAGS.AGENT_SYNERGY),
      achievements: isFeatureEnabled(FLAGS.AGENT_ACHIEVEMENT_SYSTEM),
      portfolio_manager: isFeatureEnabled(FLAGS.AGENT_PORTFOLIO_MANAGER),
    },
    rpg_system: {
      commander_approval: isFeatureEnabled(FLAGS.COMMANDER_APPROVAL),
      daily_briefing: isFeatureEnabled(FLAGS.DAILY_BRIEFING),
      information_channels: isFeatureEnabled(FLAGS.INFORMATION_CHANNELS),
      online_learning: isFeatureEnabled(FLAGS.ONLINE_LEARNING_SYSTEM),
    },
    enabled_features: allFeatures,
  });
});

/**
 * GET /api/agents/abilities/available
 * Get only enabled abilities (simplified list)
 */
router.get('/abilities/available', (req: Request, res: Response) => {
  const abilities = getAgentAbilitiesStatus().filter((a) => a.enabled);

  res.json({
    timestamp: new Date().toISOString(),
    count: abilities.length,
    abilities: abilities.map((a) => ({
      name: a.name,
      description: a.description,
      flag: a.flag,
    })),
  });
});

/**
 * GET /api/agents/services/available
 * Get only enabled services (simplified list)
 */
router.get('/services/available', (req: Request, res: Response) => {
  const services = getAgentServicesStatus().filter((s) => s.enabled);

  res.json({
    timestamp: new Date().toISOString(),
    count: services.length,
    services: services.map((s) => ({
      name: s.name,
      description: s.description,
      flag: s.flag,
    })),
  });
});

/**
 * GET /api/agents/ability/:ability
 * Check if a specific ability is available
 */
router.get(
  '/ability/:ability',
  (req: Request, res: Response) => {
    const abilityName = req.params.ability as any;
    const available = isAgentAbilityAvailable(abilityName);
    const allAbilities = getAgentAbilitiesStatus();
    const abilityInfo = allAbilities.find(
      (a) => a.flag.includes(abilityName.replace(/-/g, '_'))
    );

    if (!abilityInfo) {
      return res.status(404).json({
        error: `Ability '${abilityName}' not found`,
        available_abilities: allAbilities.map((a) => a.flag),
      });
    }

    res.json({
      ability: abilityName,
      available,
      name: abilityInfo.name,
      description: abilityInfo.description,
      flag: abilityInfo.flag,
    });
  }
);

/**
 * GET /api/agents/service/:service
 * Check if a specific service is available
 */
router.get(
  '/service/:service',
  (req: Request, res: Response) => {
    const serviceName = req.params.service as any;
    const available = isAgentServiceAvailable(serviceName);
    const allServices = getAgentServicesStatus();
    const serviceInfo = allServices.find(
      (s) => s.flag.includes(serviceName.replace(/-/g, '_'))
    );

    if (!serviceInfo) {
      return res.status(404).json({
        error: `Service '${serviceName}' not found`,
        available_services: allServices.map((s) => s.flag),
      });
    }

    res.json({
      service: serviceName,
      available,
      name: serviceInfo.name,
      description: serviceInfo.description,
      flag: serviceInfo.flag,
    });
  }
);

/**
 * POST /api/agents/ability/:ability/use
 * Use an agent ability (experimental endpoint)
 * This simulates calling an ability with test parameters
 */
router.post('/ability/:ability/use', (req: Request, res: Response) => {
  const abilityName = req.params.ability as any;
  const available = isAgentAbilityAvailable(abilityName);

  if (!available) {
    return res.status(403).json({
      error: `Ability '${abilityName}' is disabled or not available`,
      enable_instructions: `POST /api/feature-flags/agent_ability_${abilityName}/set with body {"enabled": true}`,
    });
  }

  try {
    const { market_data, parameters } = req.body;

    // Placeholder: In real implementation, this would invoke the actual ability
    const result = {
      ability: abilityName,
      executed_at: new Date().toISOString(),
      status: 'simulated',
      input: { market_data, parameters },
      output: {
        signal: 'BUY',
        confidence: 0.75,
        entry: 100,
        target: 105,
        stop: 98,
        reason: `${abilityName} ability simulation - not real data`,
      },
    };

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to use ability',
      details: error.message,
    });
  }
});

/**
 * GET /api/agents/config
 * Get agent configuration and stats
 */
router.get('/config', (req: Request, res: Response) => {
  const features = getAllEnabledAgentFeatures();

  res.json({
    timestamp: new Date().toISOString(),
    configuration: {
      max_agents: 50,
      max_synergies: 10,
      enable_progression: isFeatureEnabled(FLAGS.AGENT_ACHIEVEMENT_SYSTEM),
      enable_portfolio_management: isFeatureEnabled(FLAGS.AGENT_PORTFOLIO_MANAGER),
      enable_learning: isFeatureEnabled(FLAGS.ONLINE_LEARNING_SYSTEM),
      enable_communication: isFeatureEnabled(FLAGS.INFORMATION_CHANNELS),
    },
    stats: {
      total_services: getAgentServicesStatus().length,
      total_abilities: getAgentAbilitiesStatus().length,
      enabled_services: features.services.length,
      enabled_abilities: features.abilities.length,
    },
    features,
  });
});

export default router;
