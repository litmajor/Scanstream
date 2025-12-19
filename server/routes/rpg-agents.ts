import express, { Request, Response } from 'express';
import { StrategyBridge } from '../services/rpg-agents/StrategyBridge';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { AgentArena } from '../services/rpg-agents/AgentArena';
import { BreakoutHunter } from '../services/rpg-agents/BreakoutHunter';
import { TradingAgent } from '../services/rpg-agents/TradingAgent';
import { TrendRider } from '../services/rpg-agents/TrendRider';
import { SupportSniper } from '../services/rpg-agents/SupportSniper';
import { ReversalMaster } from '../services/rpg-agents/ReversalMaster';

const router = express.Router();

// Initialize Gateway components
const cache = new CacheManager();
const rateLimiter = new RateLimiter();
const gatewayAggregator = new ExchangeAggregator(cache, rateLimiter);

// Lazy-initialized services to avoid circular dependencies
let strategyBridge: StrategyBridge | null = null;
let arena: AgentArena | null = null;

async function initializeServices() {
  if (strategyBridge && arena) {
    return; // Already initialized
  }
  
  try {
    // Initialize Gateway first
    await gatewayAggregator.initialize();
    
    // Then create Strategy Bridge and Arena
    arena = new AgentArena();
    strategyBridge = new StrategyBridge(gatewayAggregator);
    
    console.log('[RPG-Agents] Services initialized successfully');
  } catch (error) {
    console.error('[RPG-Agents] Failed to initialize services:', error);
    throw error;
  }
}

// --- Helper to respond consistently
function respondOk(res: Response, data: any) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}

// Middleware to ensure services are initialized
const ensureInitialized = async (req: Request, res: Response, next: any) => {
  try {
    await initializeServices();
    next();
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to initialize services: ' + error.message });
  }
};

// Apply middleware to all routes
router.use(ensureInitialized);

// Leaderboard
router.get('/leaderboard', (req: Request, res: Response) => {
  try {
    const leaderboard = arena?.getLeaderboard ? arena.getLeaderboard() : [];
    respondOk(res, leaderboard);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Agent status
router.get('/status/:agentName', (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const agent = arena?.getAgent ? arena.getAgent(agentName) : null;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    respondOk(res, agent.getStatus ? agent.getStatus() : agent);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Live activities
router.get('/live-activities', (req: Request, res: Response) => {
  try {
    const activities = arena?.getRecentActivities ? arena.getRecentActivities(20) : [];
    respondOk(res, activities);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Combos
router.get('/combos', (req: Request, res: Response) => {
  try {
    const combos = arena?.getCombos ? arena.getCombos() : [];
    respondOk(res, combos);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Upgrade skill
router.post('/upgrade-skill', (req: Request, res: Response) => {
  try {
    const { agentName, skill } = req.body;
    const agent = arena?.getAgent ? arena.getAgent(agentName) : null;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    const upgraded = agent.upgradeSkill ? agent.upgradeSkill(skill as any) : false;
    res.json({ success: true, upgraded, agent: agent.getStatus ? agent.getStatus() : agent, message: upgraded ? `Successfully upgraded ${skill}` : 'Not enough skill points or skill maxed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// All agents
router.get('/all', (req: Request, res: Response) => {
  try {
    const agents = arena?.getAllAgents ? arena.getAllAgents().map((a: any) => (a.getStatus ? a.getStatus() : a)) : [];
    res.json({ success: true, data: agents, count: agents.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Process market (strategy bridge)
router.post('/process-market', async (req: Request, res: Response) => {
  try {
    const result = strategyBridge?.processMarketData ? await strategyBridge.processMarketData(req.body) : null;
    respondOk(res, result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Spawn via parent agent
router.post('/spawn', (req: Request, res: Response) => {
  try {
    const { parentAgentName, specialization } = req.body;
    const parentAgent = arena?.getAgent ? arena.getAgent(parentAgentName) : null;
    if (!parentAgent) return res.status(404).json({ success: false, error: 'Parent agent not found' });

    const subAgent = parentAgent.spawnSubAgent ? parentAgent.spawnSubAgent(specialization) : null;
    if (!subAgent) return res.status(400).json({ success: false, error: 'Failed to spawn sub-agent. Check level and abilities.' });

    if (arena?.registerAgent) arena.registerAgent(subAgent);

    res.json({ success: true, data: { parent: parentAgent.getStatus ? parentAgent.getStatus() : parentAgent, spawned: subAgent.getStatus ? subAgent.getStatus() : subAgent }, message: `Successfully spawned ${subAgent.name ?? 'sub-agent'}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Update performance
router.post('/update-performance', async (req: Request, res: Response) => {
  try {
    const { agentName, tradeResult } = req.body;
    if (strategyBridge?.updateAgentPerformance) strategyBridge.updateAgentPerformance(agentName, tradeResult);
    res.json({ success: true, message: `Updated performance for ${agentName}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Market oracle
router.get('/market-oracle', async (req: Request, res: Response) => {
  try {
    const status = { ok: true, timestamp: new Date().toISOString() };
    respondOk(res, status);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Achievements
router.get('/:agentName/achievements', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const achievements = arena?.getAgentAchievements ? arena.getAgentAchievements(agentName) : [];
    respondOk(res, achievements);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/achievements/leaderboard', async (req: Request, res: Response) => {
  try {
    const leaderboard = arena?.getAchievementLeaderboard ? arena.getAchievementLeaderboard() : [];
    respondOk(res, leaderboard);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Voting / governance
router.post('/vote-signal', async (req: Request, res: Response) => {
  try {
    const signal = req.body;
    const voteResult = arena?.voteOnSignal ? await arena.voteOnSignal(signal) : { ok: false, reason: 'Not available' };
    res.json(voteResult);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/voting-power', async (req: Request, res: Response) => {
  try {
    const votingPower = arena?.getVotingPower ? arena.getVotingPower() : {};
    respondOk(res, votingPower);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/synergy-stats', async (req: Request, res: Response) => {
  try {
    const stats = arena?.getSynergyStats ? arena.getSynergyStats() : {};
    respondOk(res, stats);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/team-health', async (req: Request, res: Response) => {
  try {
    const report = arena?.getTeamHealthReport ? arena.getTeamHealthReport() : {};
    respondOk(res, report);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/:agentName/probation', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    if (arena?.putAgentOnProbation) arena.putAgentOnProbation(agentName);
    res.json({ success: true, message: `${agentName} placed on probation` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/:agentName/hibernate', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const { reason } = req.body;
    if (arena?.hibernateAgent) arena.hibernateAgent(agentName, reason);
    res.json({ success: true, message: `${agentName} hibernated` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/:agentName/wake', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    if (arena?.wakeAgent) arena.wakeAgent(agentName);
    res.json({ success: true, message: `${agentName} awakened` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/channels/stats', async (req: Request, res: Response) => {
  try {
    const stats = arena?.getChannelStats ? arena.getChannelStats() : {};
    respondOk(res, stats);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/:agentName/spawn', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const { specialization } = req.body;
    const agent = arena?.getAgent ? arena.getAgent(agentName) : null;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    const subAgent = agent.spawnSubAgent ? agent.spawnSubAgent(specialization) : null;
    res.json({ success: !!subAgent, subAgent: subAgent ? subAgent.getStatus() : null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Market Sage
router.get('/market-sage/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = arena?.getDiscoveredPatterns ? arena.getDiscoveredPatterns() : [];
    respondOk(res, patterns);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/market-sage/discover', async (req: Request, res: Response) => {
  try {
    const newPatterns = arena?.discoverNewStrategies ? await arena.discoverNewStrategies() : [];
    res.json({ success: true, discovered: newPatterns.length, patterns: newPatterns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/market-sage/evolve', async (req: Request, res: Response) => {
  try {
    const { generation } = req.body;
    const strategies = arena?.evolveStrategies ? arena.evolveStrategies(generation || 1) : [];
    res.json({ success: true, strategies });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Portfolio
router.get('/portfolio/allocations', async (req: Request, res: Response) => {
  try {
    const allocations = arena?.allocateCapital ? arena.allocateCapital() : {};
    respondOk(res, allocations);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/portfolio/rebalance', async (req: Request, res: Response) => {
  try {
    const allocations = arena?.rebalancePortfolio ? arena.rebalancePortfolio() : {};
    res.json({ success: true, message: 'Portfolio rebalanced', allocations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/portfolio/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = arena?.getPortfolioMetrics ? arena.getPortfolioMetrics() : {};
    respondOk(res, metrics);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/:agentName/allocation', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const allocation = arena?.getAgentAllocation ? arena.getAgentAllocation(agentName) : null;
    if (!allocation) return res.status(404).json({ success: false, error: 'No allocation found for agent' });
    respondOk(res, allocation);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Online learning
router.get('/:agentName/learning-metrics', async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const metrics = arena?.getLearningMetrics ? arena.getLearningMetrics(agentName) : null;
    if (!metrics) return res.status(404).json({ success: false, error: 'Agent not found' });
    respondOk(res, metrics);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.post('/learning/replay', async (req: Request, res: Response) => {
  try {
    if (arena?.replayExperiences) arena.replayExperiences();
    res.json({ success: true, message: 'Experience replay completed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Auto-manage team composition
router.post('/auto-manage', async (req: Request, res: Response) => {
  try {
    const { marketRegime = 'NEUTRAL' } = req.body;
    const result = arena?.autoManageTeam ? arena.autoManageTeam(marketRegime as any) : { spawned: [], retired: [], decisions: [] };
    res.json({ success: true, spawned: result.spawned?.map((a: any) => (a.getStatus ? a.getStatus() : a)), retired: result.retired, decisions: result.decisions, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Team analysis
router.get('/team-analysis', (req: Request, res: Response) => {
  try {
    const analysis = arena?.getTeamAnalysis ? arena.getTeamAnalysis() : {};
    respondOk(res, analysis);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Feature insights & recommendations
router.get('/feature-insights', (req: Request, res: Response) => {
  try {
    const insights = arena?.getChannelSystem ? arena.getChannelSystem().getFeatureInsights() : {};
    respondOk(res, insights);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

router.get('/:agentName/feature-recommendations', (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const { regime = 'NEUTRAL' } = req.query;
    const recommendations = arena?.getChannelSystem ? arena.getChannelSystem().getFeatureRecommendations(agentName, regime as string) : [];
    res.json({ success: true, agentName, regime, recommendations, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// --- Direct Agent Spawning & Strategy Control ---

/**
 * Force spawn a specific agent type
 * Useful for strategy testing and manual team composition
 */
router.post('/force-spawn/:agentType', (req: Request, res: Response) => {
  try {
    const { agentType } = req.params;
    const { name, config } = req.body;
    
    let agent: any = null;
    const agentName = name || `${agentType}-${Date.now()}`;
    
    switch (agentType.toUpperCase()) {
      case 'BREAKOUT':
      case 'BREAKOUT_HUNTER':
        agent = new BreakoutHunter(agentName);
        break;
      case 'TREND':
      case 'TREND_RIDER':
        agent = new TrendRider(agentName);
        break;
      case 'SUPPORT':
      case 'SUPPORT_SNIPER':
        agent = new SupportSniper(agentName);
        break;
      case 'REVERSAL':
      case 'REVERSAL_MASTER':
        agent = new ReversalMaster(agentName);
        break;
      case 'GENERIC':
      case 'TRADING_AGENT':
        // Normalize personality: allow either a string or a small config object
        const _personality = (() => {
          if (config == null) return 'balanced';
          if (typeof config.personality === 'string') return config.personality;
          if (typeof config.personality === 'object' && config.personality !== null) {
            const rt = (config.personality as any).risk_tolerance;
            if (typeof rt === 'number') {
              if (rt >= 0.66) return 'aggressive';
              if (rt <= 0.33) return 'conservative';
              return 'balanced';
            }
          }
          return config.personality || 'balanced';
        })() as any;

        agent = new TradingAgent(agentName, config?.specialization || 'GENERIC', _personality);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown agent type: ${agentType}`,
          available: ['BREAKOUT', 'TREND', 'SUPPORT', 'REVERSAL', 'TRADING_AGENT']
        });
    }
    
    // Register the agent with the arena
    if (arena?.registerAgent) {
      arena.registerAgent(agent);
    }
    
    res.json({ 
      success: true, 
      agent: agent.getStatus ? agent.getStatus() : agent,
      message: `${agentType} agent "${agentName}" spawned successfully`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

/**
 * Force spawn multiple agents at once
 * Useful for quick team building
 */
router.post('/force-spawn-team', (req: Request, res: Response) => {
  try {
    const { composition } = req.body; // Array of { type, count, config? }
    
    if (!composition || !Array.isArray(composition)) {
      return res.status(400).json({ 
        success: false, 
        error: 'composition must be an array of {type, count, config?}'
      });
    }
    
    const spawnedAgents = [];
    
    for (const spec of composition) {
      for (let i = 0; i < (spec.count || 1); i++) {
        let agent: any = null;
        const agentName = `${spec.type}-${i}-${Date.now()}`;
        
        try {
          switch (spec.type.toUpperCase()) {
            case 'BREAKOUT':
              agent = new BreakoutHunter(agentName);
              break;
            case 'TREND':
              agent = new TrendRider(agentName);
              break;
            case 'SUPPORT':
              agent = new SupportSniper(agentName);
              break;
            case 'REVERSAL':
              agent = new ReversalMaster(agentName);
              break;
            case 'TRADING_AGENT':
              agent = new TradingAgent(agentName, spec.config?.specialization || 'GENERIC');
              break;
          }
          
          if (agent && arena?.registerAgent) {
            arena.registerAgent(agent);
            spawnedAgents.push({
              name: agentName,
              type: spec.type,
              status: agent.getStatus ? agent.getStatus() : agent
            });
          }
        } catch (e) {
          console.error(`Failed to spawn ${spec.type}:`, e);
        }
      }
    }
    
    res.json({ 
      success: true, 
      count: spawnedAgents.length,
      agents: spawnedAgents,
      message: `Spawned ${spawnedAgents.length} agents`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

/**
 * Modify agent configuration directly
 */
router.post('/:agentName/configure', (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const { config } = req.body;
    
    const agent = arena?.getAgent ? arena.getAgent(agentName) : null;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    
    // Apply configuration updates
    if (config.riskTolerance !== undefined && agent.setRiskTolerance) {
      agent.setRiskTolerance(config.riskTolerance);
    }
    if (config.positionSize !== undefined && agent.setPositionSize) {
      agent.setPositionSize(config.positionSize);
    }
    if (config.stopLoss !== undefined && agent.setStopLoss) {
      agent.setStopLoss(config.stopLoss);
    }
    if (config.takeProfit !== undefined && agent.setTakeProfit) {
      agent.setTakeProfit(config.takeProfit);
    }
    if (config.enabled !== undefined && agent.setEnabled) {
      agent.setEnabled(config.enabled);
    }
    
    res.json({ 
      success: true, 
      agent: agent.getStatus ? agent.getStatus() : agent,
      message: `Configuration updated for ${agentName}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

/**
 * Forcibly retire/remove an agent
 */
router.post('/:agentName/force-retire', (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    
    const agent = arena?.getAgent ? arena.getAgent(agentName) : null;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    
    // Force retire the agent
    if (arena?.retireAgent) {
      arena.retireAgent(agentName);
    }
    
    res.json({ 
      success: true, 
      message: `Agent ${agentName} forcibly retired`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

/**
 * Get current team composition
 */
router.get('/team/composition', (req: Request, res: Response) => {
  try {
    const agents = arena?.getAllAgents ? arena.getAllAgents() : [];
    const composition: Record<string, number> = {};
    
    for (const agent of agents) {
      const type = agent.constructor.name || 'Unknown';
      composition[type] = (composition[type] || 0) + 1;
    }
    
    res.json({
      success: true,
      totalAgents: agents.length,
      composition,
      agents: agents.map((a: any) => ({
        name: a.name || a.constructor.name,
        type: a.constructor.name,
        status: a.getStatus ? a.getStatus() : { name: a.name }
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

/**
 * Reset team composition (retire all, start fresh)
 */
router.post('/team/reset', (req: Request, res: Response) => {
  try {
    const agents = arena?.getAllAgents ? arena.getAllAgents() : [];
    let retiredCount = 0;
    
    for (const agent of agents) {
      try {
        if (arena?.retireAgent && agent.name) {
          arena.retireAgent(agent.name);
          retiredCount++;
        }
      } catch (e) {
        console.error(`Failed to retire agent:`, e);
      }
    }
    
    res.json({
      success: true,
      message: `Team reset: ${retiredCount} agents retired`,
      retiredCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});



// Get approval system details
router.get('/commander/approval-system', (req: Request, res: Response) => {
  try {
    const approvalSystem = arena?.getApprovalSystem ? arena.getApprovalSystem() : null;
    if (!approvalSystem) return res.status(404).json({ success: false, error: 'Approval system not available' });
    respondOk(res, { system: approvalSystem });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Get pending approvals
router.get('/commander/pending-approvals', (req: Request, res: Response) => {
  try {
    const pending = arena?.getPendingApprovals ? arena.getPendingApprovals() : [];
    respondOk(res, pending);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Get active alerts
router.get('/commander/active-alerts', (req: Request, res: Response) => {
  try {
    const alerts = arena?.getActiveAlerts ? arena.getActiveAlerts() : [];
    respondOk(res, alerts);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Get autonomy config
router.get('/commander/autonomy-config', (req: Request, res: Response) => {
  try {
    const config = arena?.getAutonomyConfig ? arena.getAutonomyConfig() : {};
    respondOk(res, config);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Initialize commander system
router.post('/commander/initialize', (req: Request, res: Response) => {
  try {
    const { autonomyLevel = 'HYBRID_OPTIMAL' } = req.body;
    if (arena?.initializeCommanderSystem) arena.initializeCommanderSystem(autonomyLevel);
    res.json({ success: true, message: `Commander system initialized with ${autonomyLevel} mode` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Pause all agents
router.post('/commander/pause-all', (req: Request, res: Response) => {
  try {
    if (arena?.pauseAllAgents) arena.pauseAllAgents();
    res.json({ success: true, message: 'All agents paused' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Resume all agents
router.post('/commander/resume-all', (req: Request, res: Response) => {
  try {
    if (arena?.resumeAllAgents) arena.resumeAllAgents();
    res.json({ success: true, message: 'All agents resumed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Propose new agent
router.post('/commander/propose-agent', (req: Request, res: Response) => {
  try {
    const agent = req.body;
    if (arena?.proposeNewAgent) arena.proposeNewAgent(agent);
    res.json({ success: true, message: 'Agent proposal submitted for approval' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Propose agent evolution
router.post('/commander/propose-evolution', (req: Request, res: Response) => {
  try {
    const { agentName, newLevel, reason } = req.body;
    if (arena?.proposeAgentEvolution) arena.proposeAgentEvolution(agentName, newLevel, reason);
    res.json({ success: true, message: `Evolution proposal for ${agentName} submitted` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Propose agent retirement
router.post('/commander/propose-retirement', (req: Request, res: Response) => {
  try {
    const { agentName, reason } = req.body;
    if (arena?.proposeAgentRetirement) arena.proposeAgentRetirement(agentName, reason);
    res.json({ success: true, message: `Retirement proposal for ${agentName} submitted` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

// Propose agent hibernation
router.post('/commander/propose-hibernation', (req: Request, res: Response) => {
  try {
    const { agentName, reason, duration } = req.body;
    if (arena?.proposeAgentHibernation) arena.proposeAgentHibernation(agentName, reason, duration);
    res.json({ success: true, message: `Hibernation proposal for ${agentName} submitted` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? String(error) });
  }
});

export default router;
