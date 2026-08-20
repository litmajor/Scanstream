import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

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
const MAX_ACTIVITY_ITEMS = 1000;

export function getActivityLogSize(): number {
  return activityLog.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isVoteData(value: unknown): value is VoteData {
  return (
    isRecord(value) &&
    typeof value.agentName === 'string' &&
    value.agentName.length > 0 &&
    value.agentName.length <= 64 &&
    typeof value.agentType === 'string' &&
    value.agentType.length > 0 &&
    value.agentType.length <= 64 &&
    (value.vote === 'EXIT' || value.vote === 'HOLD') &&
    isFiniteConfidence(value.confidence) &&
    typeof value.reasoning === 'string' &&
    value.reasoning.length <= 500 &&
    typeof value.timestamp === 'string' &&
    value.timestamp.length <= 64
  );
}

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
router.post('/record-vote', requireAuth, (req: Request, res: Response) => {
  try {
    const { symbol, votes, consensus, confidence, exitUrgency } = req.body;

    if (
      typeof symbol !== 'string' ||
      symbol.length === 0 ||
      symbol.length > 32 ||
      !Array.isArray(votes) ||
      votes.length > 20 ||
      votes.some((vote) => !isVoteData(vote)) ||
      !['EXIT', 'HOLD'].includes(consensus) ||
      !isFiniteConfidence(confidence) ||
      (exitUrgency !== undefined &&
        !['HOLD', 'TIGHTEN_STOP', 'EXIT_STANDARD', 'EXIT_URGENT'].includes(exitUrgency))
    ) {
      return res.status(400).json({
        success: false,
        error: 'symbol, bounded votes, consensus, and confidence are required',
      });
    }

    const consensusVote: ConsensusVote = {
      symbol,
      timestamp: new Date().toISOString(),
      votes,
      consensus,
      confidence,
      exitUrgency
    };

    consensusHistory.push(consensusVote);
    if (consensusHistory.length > MAX_ACTIVITY_ITEMS) {
      consensusHistory.shift();
    }

    // Add activity log entry
    activityLog.push({
      timestamp: new Date().toISOString(),
      type: 'consensus',
      message: `Consensus reached for ${symbol}`,
      details: `${consensus === 'EXIT' ? 'Exit' : 'Hold'} decision with ${(confidence * 100).toFixed(0)}% confidence`
    });
    if (activityLog.length > MAX_ACTIVITY_ITEMS) {
      activityLog.shift();
    }

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
router.post('/record-activity', requireAuth, (req: Request, res: Response) => {
  try {
    const { type, message, details } = req.body;

    if (
      (type !== undefined && !['vote', 'consensus', 'trade', 'error'].includes(type)) ||
      typeof message !== 'string' ||
      message.length === 0 ||
      message.length > 500 ||
      (details !== undefined && (typeof details !== 'string' || details.length > 2000))
    ) {
      return res.status(400).json({
        success: false,
        error: 'activity type, message, and bounded details are required',
      });
    }

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
router.post('/agent-event', requireAuth, (req: Request, res: Response) => {
  try {
    const { agentName, eventType, data } = req.body;

    if (
      typeof agentName !== 'string' ||
      agentName.length === 0 ||
      agentName.length > 64 ||
      !['vote', 'consensus', 'trade', 'error'].includes(eventType) ||
      !isRecord(data)
    ) {
      return res.status(400).json({
        success: false,
        error: 'agentName, supported eventType, and object data are required',
      });
    }

    const serializedData = JSON.stringify(data);
    if (serializedData.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'event data must serialize to at most 5000 characters',
      });
    }

    activityLog.push({
      timestamp: new Date().toISOString(),
      type: eventType || 'trade',
      message: `${agentName}: ${eventType}`,
      details: serializedData
    });
    if (activityLog.length > MAX_ACTIVITY_ITEMS) {
      activityLog.shift();
    }

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
