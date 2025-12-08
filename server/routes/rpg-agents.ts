import express from 'express';
import { StrategyBridge } from '../services/rpg-agents/StrategyBridge';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { AgentArena } from '../services/rpg-agents/AgentArena';
import { BreakoutHunter } from '../services/rpg-agents/BreakoutHunter';
import { TradingAgent } from '../services/rpg-agents/TradingAgent';

const router = express.Router();

// Initialize Gateway components
const cache = new CacheManager();
const rateLimiter = new RateLimiter();
const gatewayAggregator = new ExchangeAggregator(cache, rateLimiter);

// Initialize Strategy Bridge with Gateway
const strategyBridge = new StrategyBridge(gatewayAggregator);

// Initialize Gateway
gatewayAggregator.initialize().catch(console.error);

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
 * GET /api/rpg-agents/live-activities
 * Get recent agent activities in real-time
 */
router.get('/live-activities', (req, res) => {
  try {
    // Get recent trades, level-ups, combo activations
    const activities = arena.getRecentActivities(20);
    
    res.json({
      success: true,
      activities,
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

// Get market oracle status
  app.get('/api/rpg-agents/market-oracle', async (req, res) => {
    try {
      const status = arena.getMarketOracleStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent achievements
  app.get('/api/rpg-agents/:agentName/achievements', async (req, res) => {
    try {
      const { agentName } = req.params;
      const achievements = arena.getAgentAchievements(agentName);
      res.json(achievements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get achievement leaderboard
  app.get('/api/rpg-agents/achievements/leaderboard', async (req, res) => {
    try {
      const leaderboard = arena.getAchievementLeaderboard();
      res.json(leaderboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vote on a signal
  app.post('/api/rpg-agents/vote-signal', async (req, res) => {
    try {
      const signal = req.body;
      const voteResult = await arena.voteOnSignal(signal);
      res.json(voteResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get voting power distribution
  app.get('/api/rpg-agents/voting-power', async (req, res) => {
    try {
      const votingPower = arena.getVotingPower();
      res.json(votingPower);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Synergy system routes
  app.get('/api/rpg-agents/synergy-stats', async (req, res) => {
    try {
      const stats = arena.getSynergyStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lifecycle management routes
  app.get('/api/rpg-agents/team-health', async (req, res) => {
    try {
      const report = arena.getTeamHealthReport();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/:agentName/probation', async (req, res) => {
    try {
      const { agentName } = req.params;
      arena.putAgentOnProbation(agentName);
      res.json({ success: true, message: `${agentName} placed on probation` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/:agentName/hibernate', async (req, res) => {
    try {
      const { agentName } = req.params;
      const { reason } = req.body;
      arena.hibernateAgent(agentName, reason);
      res.json({ success: true, message: `${agentName} hibernated` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/:agentName/wake', async (req, res) => {
    try {
      const { agentName } = req.params;
      arena.wakeAgent(agentName);
      res.json({ success: true, message: `${agentName} awakened` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Information channel routes
  app.get('/api/rpg-agents/channels/stats', async (req, res) => {
    try {
      const stats = arena.getChannelStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Spawn sub-agent
  app.post('/api/rpg-agents/:agentName/spawn', async (req, res) => {
    try {
      const { agentName } = req.params;
      const { specialization } = req.body;

      const agent = arena.getAgent(agentName);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const subAgent = agent.spawnSubAgent(specialization);
      res.json({ 
        success: !!subAgent,
        subAgent: subAgent ? {
          name: subAgent.name,
          level: subAgent.level,
          experience: subAgent.experience
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Market Sage routes
  app.get('/api/rpg-agents/market-sage/patterns', async (req, res) => {
    try {
      const patterns = arena.getDiscoveredPatterns();
      res.json({ success: true, patterns });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/market-sage/discover', async (req, res) => {
    try {
      const newPatterns = await arena.discoverNewStrategies();
      res.json({ success: true, discovered: newPatterns.length, patterns: newPatterns });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/market-sage/evolve', async (req, res) => {
    try {
      const { generation } = req.body;
      const strategies = arena.evolveStrategies(generation || 1);
      res.json({ success: true, strategies });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Manager routes
  app.get('/api/rpg-agents/portfolio/allocations', async (req, res) => {
    try {
      const allocations = arena.allocateCapital();
      res.json({ success: true, allocations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/portfolio/rebalance', async (req, res) => {
    try {
      const allocations = arena.rebalancePortfolio();
      res.json({ success: true, message: 'Portfolio rebalanced', allocations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/rpg-agents/portfolio/metrics', async (req, res) => {
    try {
      const metrics = arena.getPortfolioMetrics();
      res.json({ success: true, metrics });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/rpg-agents/:agentName/allocation', async (req, res) => {
    try {
      const { agentName } = req.params;
      const allocation = arena.getAgentAllocation(agentName);
      
      if (!allocation) {
        return res.status(404).json({ error: 'No allocation found for agent' });
      }
      
      res.json({ success: true, allocation });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Online Learning routes
  app.get('/api/rpg-agents/:agentName/learning-metrics', async (req, res) => {
    try {
      const { agentName } = req.params;
      const metrics = arena.getLearningMetrics(agentName);
      
      if (!metrics) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json({ success: true, metrics });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rpg-agents/learning/replay', async (req, res) => {
    try {
      arena.replayExperiences();
      res.json({ success: true, message: 'Experience replay completed' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

export default router;