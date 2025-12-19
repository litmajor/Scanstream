import { Router, Request, Response } from 'express';

const router = Router();

// Mock data - in production, this would come from database/real-time engine
interface VoteData {
  agentName: string;
  agentType: string;
  vote: 'EXIT' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: string;
}

interface ConsensusVote {
  symbol: string;
  timestamp: string;
  votes: VoteData[];
  consensus: 'EXIT' | 'HOLD';
  confidence: number;
  exitUrgency?: 'HOLD' | 'TIGHTEN_STOP' | 'EXIT_STANDARD' | 'EXIT_URGENT';
}

interface ActivityItem {
  timestamp: string;
  type: 'vote' | 'consensus' | 'trade' | 'error';
  message: string;
  details?: string;
}

// Store for consensus history
const consensusHistory: ConsensusVote[] = [];
const activityLog: ActivityItem[] = [];

/**
 * GET /api/agents/interactions/consensus-history
 * Retrieve recent consensus votes with all agent votes
 */
router.get('/consensus-history', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: consensusHistory.slice(-20) // Last 20 votes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch consensus history'
    });
  }
});

/**
 * GET /api/agents/interactions/interaction-flow
 * Get current interaction flow between agents
 */
router.get('/interaction-flow', (req: Request, res: Response) => {
  try {
    const flow = {
      exitAgent: {
        stage: 'PROFIT_LOCK',
        reason: 'Price reached 2% above entry, locking in gains with 1% trail',
        confidence: 0.85
      },
      oppositionAgent: {
        nearSupport: false,
        nearResistance: true,
        breakoutRisk: 0.62
      },
      microstructureAgent: {
        spreadAlert: false,
        depthWarning: false,
        volumeAnomaly: true
      }
    };

    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interaction flow'
    });
  }
});

/**
 * GET /api/agents/interactions/activity-log
 * Get agent activity feed
 */
router.get('/activity-log', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: activityLog.slice(-50) // Last 50 activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity log'
    });
  }
});

/**
 * POST /api/agents/interactions/record-vote
 * Record an agent vote for visualization
 */
router.post('/record-vote', (req: Request, res: Response) => {
  try {
    const { symbol, votes, consensus, confidence, exitUrgency } = req.body;

    const consensusVote: ConsensusVote = {
      symbol,
      timestamp: new Date().toISOString(),
      votes,
      consensus,
      confidence,
      exitUrgency
    };

    consensusHistory.push(consensusVote);

    // Add activity log entry
    activityLog.push({
      timestamp: new Date().toISOString(),
      type: 'consensus',
      message: `Consensus reached for ${symbol}`,
      details: `${consensus === 'EXIT' ? 'Exit' : 'Hold'} decision with ${(confidence * 100).toFixed(0)}% confidence`
    });

    res.json({
      success: true,
      data: consensusVote
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to record vote'
    });
  }
});

/**
 * POST /api/agents/interactions/record-activity
 * Record any agent activity
 */
router.post('/record-activity', (req: Request, res: Response) => {
  try {
    const { type, message, details } = req.body;

    const activity: ActivityItem = {
      timestamp: new Date().toISOString(),
      type: type || 'trade',
      message,
      details
    };

    activityLog.push(activity);

    // Keep only last 1000 activities
    if (activityLog.length > 1000) {
      activityLog.shift();
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to record activity'
    });
  }
});

/**
 * GET /api/agents/interactions/agent-cards
 * Get data for agent cards display
 */
router.get('/agent-cards', (req: Request, res: Response) => {
  try {
    // Sample agent data
    const agents = [
      {
        name: 'VectorForce',
        agent_type: 'PHYSICS_VFMD',
        level: 15,
        xp: 7500,
        xp_to_next_level: 10000,
        mood: 'focused',
        personality: 'aggressive',
        stats: {
          total_trades: 284,
          wins: 189,
          win_rate: 0.666,
          profit_factor: 2.34,
          sharpe_ratio: 1.89,
          max_drawdown: -0.082
        },
        skill_levels: {
          divergence_detection: 8,
          accumulation_sensing: 7,
          early_entry_timing: 9,
          momentum_confirmation: 8
        },
        abilities: ['Early Vector Detection', 'Accumulation Zone Mapping', 'Divergence Exploitation'],
        achievements: [
          { name: '100 Win Streak', description: 'Won 100 consecutive trades', unlockedAt: '2024-01-15' },
          { name: 'Vector Master', description: 'Reached level 15', unlockedAt: '2024-01-20' }
        ],
        rank: 'Gold'
      },
      {
        name: 'FlowMomentum',
        agent_type: 'PHYSICS_FLOW',
        level: 13,
        xp: 5200,
        xp_to_next_level: 10000,
        mood: 'cautious',
        personality: 'balanced',
        stats: {
          total_trades: 267,
          wins: 174,
          win_rate: 0.651,
          profit_factor: 2.12,
          sharpe_ratio: 1.76,
          max_drawdown: -0.095
        },
        skill_levels: {
          force_field_analysis: 8,
          pressure_sensing: 7,
          turbulence_detection: 8,
          energy_gradient_reading: 7
        },
        abilities: ['Pressure Field Detection', 'Turbulence Analysis', 'Energy Flow Mapping'],
        achievements: [
          { name: 'Flow Finder', description: 'Found 50 premium flow patterns', unlockedAt: '2024-01-18' }
        ],
        rank: 'Silver'
      },
      {
        name: 'ExitMaster',
        agent_type: 'EXIT_ORCHESTRATOR',
        level: 12,
        xp: 4800,
        xp_to_next_level: 10000,
        mood: 'focused',
        personality: 'conservative',
        stats: {
          total_trades: 245,
          wins: 201,
          win_rate: 0.82,
          profit_factor: 3.45,
          sharpe_ratio: 2.34,
          max_drawdown: -0.045
        },
        skill_levels: {
          exit_timing: 9,
          stage_recognition: 8,
          liquidation_detection: 7,
          profit_preservation: 9
        },
        abilities: ['4-Stage Exit Management', 'Risk Preservation', 'Profit Locking'],
        achievements: [
          { name: 'Perfect Exit', description: 'Exited at peak 50 times', unlockedAt: '2024-01-19' }
        ],
        rank: 'Silver'
      },
      {
        name: 'ResistanceReader',
        agent_type: 'OPPOSITION_READER',
        level: 11,
        xp: 3200,
        xp_to_next_level: 10000,
        mood: 'cautious',
        personality: 'balanced',
        stats: {
          total_trades: 198,
          wins: 145,
          win_rate: 0.732,
          profit_factor: 2.56,
          sharpe_ratio: 1.94,
          max_drawdown: -0.068
        },
        skill_levels: {
          opposition_sensing: 8,
          level_identification: 8,
          breakout_timing: 7,
          consolidation_detection: 6
        },
        abilities: ['Support/Resistance Detection', 'Breakout Prediction', 'Level Analysis'],
        achievements: [
          { name: 'Level Expert', description: 'Identified 200 key levels', unlockedAt: '2024-01-17' }
        ],
        rank: 'Bronze'
      },
      {
        name: 'LiquidityHunter',
        agent_type: 'MICROSTRUCTURE_SPECIALIST',
        level: 10,
        xp: 2100,
        xp_to_next_level: 10000,
        mood: 'aggressive',
        personality: 'aggressive',
        stats: {
          total_trades: 156,
          wins: 109,
          win_rate: 0.698,
          profit_factor: 2.23,
          sharpe_ratio: 1.67,
          max_drawdown: -0.078
        },
        skill_levels: {
          order_flow_reading: 7,
          liquidity_sensing: 8,
          spread_interpretation: 6,
          momentum_exhaustion: 7
        },
        abilities: ['Order Flow Analysis', 'Liquidity Detection', 'Spread Monitoring'],
        achievements: [],
        rank: 'Bronze'
      }
    ];

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent cards'
    });
  }
});

/**
 * GET /api/agents/interactions/interaction-graph
 * Get interaction graph data for visualization
 */
router.get('/interaction-graph', (req: Request, res: Response) => {
  try {
    const graphData = {
      nodes: [
        { id: 'exit-orchestrator', label: 'Exit Orchestrator', type: 'exit', level: 12 },
        { id: 'opposition-reader', label: 'Opposition Reader', type: 'exit', level: 11 },
        { id: 'microstructure', label: 'Microstructure', type: 'exit', level: 10 },
        { id: 'vector-force', label: 'Vector Force', type: 'entry', level: 15 },
        { id: 'flow-momentum', label: 'Flow Momentum', type: 'entry', level: 13 }
      ],
      edges: [
        { source: 'exit-orchestrator', target: 'opposition-reader', weight: 0.8, type: 'consensus' },
        { source: 'exit-orchestrator', target: 'microstructure', weight: 0.75, type: 'consensus' },
        { source: 'opposition-reader', target: 'microstructure', weight: 0.6, type: 'consensus' },
        { source: 'vector-force', target: 'exit-orchestrator', weight: 0.9, type: 'signal' },
        { source: 'flow-momentum', target: 'exit-orchestrator', weight: 0.85, type: 'signal' }
      ]
    };

    res.json({
      success: true,
      data: graphData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interaction graph'
    });
  }
});

/**
 * POST /api/agents/interactions/agent-event
 * Record any agent event for visualization
 */
router.post('/agent-event', (req: Request, res: Response) => {
  try {
    const { agentName, eventType, data } = req.body;

    activityLog.push({
      timestamp: new Date().toISOString(),
      type: eventType || 'trade',
      message: `${agentName}: ${eventType}`,
      details: JSON.stringify(data)
    });

    res.json({
      success: true,
      message: 'Event recorded'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to record event'
    });
  }
});

export default router;
