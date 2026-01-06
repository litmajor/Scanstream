/**
 * Agent Abilities API Routes
 * 
 * GET  /api/agents/abilities              - List all abilities
 * GET  /api/agents/abilities/:id          - Get single ability
 * GET  /api/agents/abilities/category/:cat - Get abilities by category
 * GET  /api/agents/abilities/level/:level - Get abilities unlocked at level
 * GET  /api/agents/abilities/report       - Admin report on ability availability
 */

import { Router, Request, Response } from 'express';
import {
  AGENT_ABILITIES,
  getAbility,
  isAbilityAvailable,
  getSpecialistAbilities,
  getLeveledAbilitiesByLevel,
  getNextLevelAbility,
  getAbilitiesByCategory,
  getAbilityReport,
} from '../services/agent-abilities-registry';

const router = Router();

/**
 * GET /api/agents/abilities
 * List all agent abilities
 */
router.get('/', (req: Request, res: Response) => {
  const abilities = Object.values(AGENT_ABILITIES);
  const availableAbilities = abilities.filter((a) => isAbilityAvailable(a.id));

  res.json({
    timestamp: new Date().toISOString(),
    total: abilities.length,
    available: availableAbilities.length,
    unavailable: abilities.length - availableAbilities.length,
    abilities: abilities.map((a) => ({
      ...a,
      isAvailable: isAbilityAvailable(a.id),
    })),
  });
});

/**
 * GET /api/agents/abilities/:id
 * Get single ability details
 */
router.get('/:id', (req: Request, res: Response) => {
  const ability = getAbility(req.params.id);

  if (!ability) {
    return res.status(404).json({
      error: `Ability '${req.params.id}' not found`,
      available_abilities: Object.keys(AGENT_ABILITIES),
    });
  }

  res.json({
    timestamp: new Date().toISOString(),
    ability: {
      ...ability,
      isAvailable: isAbilityAvailable(ability.id),
      flag: ability.flagName,
    },
  });
});

/**
 * GET /api/agents/abilities/category/:category
 * Get abilities by category
 */
router.get(
  '/category/:category',
  (req: Request, res: Response) => {
    const validCategories = ['specialist', 'leveled', 'rpg'];
    const category = req.params.category as any;

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category: ${category}`,
        valid_categories: validCategories,
      });
    }

    const abilities = getAbilitiesByCategory(category);
    const availableAbilities = abilities.filter((a) => isAbilityAvailable(a.id));

    res.json({
      timestamp: new Date().toISOString(),
      category,
      total: abilities.length,
      available: availableAbilities.length,
      abilities: abilities.map((a) => ({
        ...a,
        isAvailable: isAbilityAvailable(a.id),
      })),
    });
  }
);

/**
 * GET /api/agents/abilities/level/:level
 * Get abilities available at a specific level
 */
router.get(
  '/level/:level',
  (req: Request, res: Response) => {
    const level = parseInt(req.params.level, 10);

    if (isNaN(level) || level < 1 || level > 100) {
      return res.status(400).json({
        error: 'Invalid level: must be a number between 1 and 100',
      });
    }

    const abilities = getLeveledAbilitiesByLevel(level);
    const nextAbility = getNextLevelAbility(level);

    res.json({
      timestamp: new Date().toISOString(),
      currentLevel: level,
      unlockedAbilities: abilities.map((a) => ({
        ...a,
        isAvailable: isAbilityAvailable(a.id),
      })),
      nextAbility: nextAbility ? {
        ...nextAbility,
        isAvailable: isAbilityAvailable(nextAbility.id),
        unlocksAtLevel: nextAbility.unlocksAtLevel,
      } : null,
      totalUnlocked: abilities.length,
    });
  }
);

/**
 * GET /api/agents/abilities/specialist
 * Get all specialist abilities
 */
router.get('/specialist', (req: Request, res: Response) => {
  const abilities = getSpecialistAbilities();

  res.json({
    timestamp: new Date().toISOString(),
    total: abilities.length,
    abilities: abilities.map((a) => ({
      ...a,
      isAvailable: isAbilityAvailable(a.id),
    })),
  });
});

/**
 * GET /api/agents/abilities/report
 * Admin report on ability system status
 */
router.get('/report', (req: Request, res: Response) => {
  const report = getAbilityReport();

  res.json({
    timestamp: new Date().toISOString(),
    summary: {
      total: report.total,
      available: report.available,
      disabled: report.total - report.available,
      availabilityPercent: ((report.available / report.total) * 100).toFixed(1),
    },
    byCategory: report.byCategory,
    disabledAbilities: report.unavailable.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      flagName: a.flagName,
      enableInstructions: `POST /api/feature-flags/${a.flagName}/set with {"enabled": true}`,
    })),
    levelProgression: {
      description: 'Leveled abilities unlock as agents gain XP',
      progression: Object.values(AGENT_ABILITIES)
        .filter((a) => a.category === 'leveled' && a.unlocksAtLevel)
        .sort((a, b) => (a.unlocksAtLevel || 0) - (b.unlocksAtLevel || 0))
        .map((a) => ({
          level: a.unlocksAtLevel,
          ability: a.id,
          name: a.name,
          xpRequired: a.requiredXP,
          isEnabled: isAbilityAvailable(a.id),
        })),
    },
  });
});

export default router;
