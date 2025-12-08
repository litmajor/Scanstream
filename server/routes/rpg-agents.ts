
import express from 'express';
import { AgentArena } from '../services/rpg-agents/AgentArena';
import { BreakoutHunter } from '../services/rpg-agents/BreakoutHunter';
import { TradingAgent } from '../services/rpg-agents/TradingAgent';

const router = express.Router();

// Initialize the arena with some agents
const arena = new AgentArena();

// Create initial agents
const breakoutHunter = new BreakoutHunter('BREAKOUT_HUNTER_ALPHA');
arena.registerAgent(breakoutHunter);

// TODO: Create other agent types (ReversalMaster, MLOracle, etc.)

/**
 * GET /api/rpg-agents/leaderboard
 * Get agent performance leaderboard
 */
router.get('/leaderboard', (req, res) => {
  try {
    const leaderboard = arena.getLeaderboard();
    
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rpg-agents/status/:agentName
 * Get detailed status of a specific agent
 */
router.get('/status/:agentName', (req, res) => {
  try {
    const { agentName } = req.params;
    const agent = arena.getAgent(agentName);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      data: agent.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rpg-agents/combos
 * Get available agent combos
 */
router.get('/combos', (req, res) => {
  try {
    const combos = arena.getCombos();
    
    res.json({
      success: true,
      data: combos,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rpg-agents/upgrade-skill
 * Upgrade an agent's skill
 */
router.post('/upgrade-skill', (req, res) => {
  try {
    const { agentName, skill } = req.body;
    
    const agent = arena.getAgent(agentName);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    const upgraded = agent.upgradeSkill(skill as any);
    
    res.json({
      success: true,
      upgraded,
      agent: agent.getStatus(),
      message: upgraded ? `Successfully upgraded ${skill}` : 'Not enough skill points or skill maxed'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rpg-agents/all
 * Get all agents status
 */
router.get('/all', (req, res) => {
  try {
    const agents = arena.getAllAgents().map(agent => agent.getStatus());
    
    res.json({
      success: true,
      data: agents,
      count: agents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rpg-agents/process-market
 * Process market data through RPG agents
 */
router.post('/process-market', async (req, res) => {
  try {
    const { strategyBridge } = await import('../services/rpg-agents/StrategyBridge');
    const result = await strategyBridge.processMarketData(req.body);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rpg-agents/spawn
 * Spawn a sub-agent from a level 25+ agent
 */
router.post('/spawn', (req, res) => {
  try {
    const { parentAgentName, specialization } = req.body;
    
    const parentAgent = arena.getAgent(parentAgentName);
    if (!parentAgent) {
      return res.status(404).json({
        success: false,
        error: 'Parent agent not found'
      });
    }
    
    const subAgent = arena.spawnSubAgent(parentAgent, specialization);
    
    if (!subAgent) {
      return res.status(400).json({
        success: false,
        error: 'Failed to spawn sub-agent. Check level and abilities.'
      });
    }
    
    res.json({
      success: true,
      data: {
        parent: parentAgent.getStatus(),
        spawned: subAgent.getStatus()
      },
      message: `Successfully spawned ${subAgent.name}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rpg-agents/update-performance
 * Update agent performance after trade closes
 */
router.post('/update-performance', async (req, res) => {
  try {
    const { strategyBridge } = await import('../services/rpg-agents/StrategyBridge');
    const { agentName, tradeResult } = req.body;
    
    strategyBridge.updateAgentPerformance(agentName, tradeResult);
    
    res.json({
      success: true,
      message: `Updated performance for ${agentName}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
