/**
 * Exit Agents API Routes
 * 
 * Endpoints for specialized exit agents:
 * - ExitOrchestratorAgent: Profit stages & trailing stops
 * - OppositionResistanceAgent: Support/resistance level breaks
 * - MicrostructureSpecialistAgent: Order flow & liquidity monitoring
 */

import express from 'express';
import {
  ExitOrchestratorAgent,
  OppositionResistanceAgent,
  MicrostructureSpecialistAgent,
  type ExitDecision,
  type OppositionAnalysis,
  type MicrostructureSignal
} from '../services/rpg-agents/SpecializedExitAgents';

const router = express.Router();

// Initialize exit agents (singleton pattern)
const exitOrchestrator = new ExitOrchestratorAgent('ExitMaster', 'balanced');
const oppositionReader = new OppositionResistanceAgent('OppositionReader', 'balanced');
const microstructureSpecialist = new MicrostructureSpecialistAgent('MicrostructureMonitor', 'conservative');

// ============================================================================
// ENDPOINT 1: Exit Orchestrator - Profit Stage Management
// ============================================================================
/**
 * POST /api/agents/exit/orchestrator
 * 
 * Analyze current trade state and determine exit action
 * 
 * Body: {
 *   entryPrice: number,
 *   currentPrice: number,
 *   atr: number,
 *   signalType: 'BUY' | 'SELL',
 *   profitPercent: number,
 *   timeHeldHours: number,
 *   microstructure?: { spread, bidVolume, askVolume, netFlow, depth, volumeSpike }
 * }
 */
router.post('/orchestrator', (req, res) => {
  try {
    const { entryPrice, currentPrice, atr, signalType, profitPercent, timeHeldHours, microstructure } = req.body;

    if (!entryPrice || currentPrice === undefined || !atr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: entryPrice, currentPrice, atr'
      });
    }

    const exitDecision = exitOrchestrator.analyzeExit({
      entryPrice,
      currentPrice,
      atr,
      signalType: signalType || 'BUY',
      profitPercent: profitPercent || 0,
      timeHeldHours: timeHeldHours || 0,
      microstructure
    });

    // Update agent performance if we have outcome data
    if (req.body.actualOutcome) {
      exitOrchestrator.updatePerformance({
        profit: req.body.actualOutcome.profit,
        profit_pct: req.body.actualOutcome.profit_pct,
        market_difficulty: req.body.actualOutcome.market_difficulty || 1.0,
        execution_quality: req.body.actualOutcome.execution_quality || 0.8,
        regime: req.body.actualOutcome.regime || 'normal',
        duration_hours: timeHeldHours || 1
      });
    }

    res.json({
      success: true,
      data: {
        exitDecision,
        agentStatus: exitOrchestrator.getStatus(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Exit Orchestrator] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 2: Opposition Reader - Support/Resistance Level Analysis
// ============================================================================
/**
 * POST /api/agents/exit/opposition
 * 
 * Analyze support/resistance levels and predict breaks
 * 
 * Body: {
 *   currentPrice: number,
 *   supportLevels: number[],
 *   resistanceLevels: number[],
 *   volume: number,
 *   priceVelocity: number,
 *   volatility: number,
 *   timeToSupport: number
 * }
 */
router.post('/opposition', (req, res) => {
  try {
    const { currentPrice, supportLevels, resistanceLevels, volume, priceVelocity, volatility, timeToSupport } = req.body;

    if (!currentPrice || !supportLevels || !resistanceLevels) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currentPrice, supportLevels, resistanceLevels'
      });
    }

    const opposition = oppositionReader.analyzeOpposition({
      currentPrice,
      supportLevels,
      resistanceLevels,
      volume: volume || 1000,
      priceVelocity: priceVelocity || 0,
      volatility: volatility || 0.01,
      timeToSupport: timeToSupport || 10
    });

    res.json({
      success: true,
      data: {
        opposition,
        agentStatus: oppositionReader.getStatus(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Opposition Reader] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 3: Microstructure Specialist - Order Flow & Liquidity Monitoring
// ============================================================================
/**
 * POST /api/agents/exit/microstructure
 * 
 * Analyze market microstructure for deterioration signals
 * 
 * Body: {
 *   bidVolume: number,
 *   askVolume: number,
 *   spread: number,
 *   normalSpread: number,
 *   netFlow: number,
 *   depth: number,
 *   volumeSpike: number,
 *   momentum: number
 * }
 */
router.post('/microstructure', (req, res) => {
  try {
    const { bidVolume, askVolume, spread, normalSpread, netFlow, depth, volumeSpike, momentum } = req.body;

    if (bidVolume === undefined || askVolume === undefined || spread === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bidVolume, askVolume, spread'
      });
    }

    const microstructure = microstructureSpecialist.analyzeMicrostructure({
      bidVolume,
      askVolume,
      spread,
      normalSpread: normalSpread || spread * 0.5,
      netFlow: netFlow || 0,
      depth: depth || 10000,
      volumeSpike: volumeSpike || 1.0,
      momentum: momentum || 0
    });

    res.json({
      success: true,
      data: {
        microstructure,
        agentStatus: microstructureSpecialist.getStatus(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Microstructure Specialist] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 4: Consensus Exit Voting (All 3 Agents)
// ============================================================================
/**
 * POST /api/agents/exit/consensus
 * 
 * Get consensus exit decision from all 3 agents
 * Returns: decision if 2/3 agents agree
 * 
 * Body: {
 *   tradeState: { entryPrice, currentPrice, atr, signalType, profitPercent, timeHeldHours },
 *   opposition: { currentPrice, supportLevels, resistanceLevels, volume, priceVelocity, volatility, timeToSupport },
 *   microstructure: { bidVolume, askVolume, spread, normalSpread, netFlow, depth, volumeSpike, momentum }
 * }
 */
router.post('/consensus', (req, res) => {
  try {
    const { tradeState, opposition, microstructure } = req.body;

    if (!tradeState) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tradeState'
      });
    }

    // Get individual votes
    const exitVote = exitOrchestrator.analyzeExit(tradeState);
    
    let oppVote = 'HOLD';
    if (opposition) {
      const oppAnalysis = oppositionReader.analyzeOpposition(opposition);
      oppVote = oppAnalysis.supportStrength < 0.3 ? 'EXIT' : 'HOLD';
    }

    let microVote = 'HOLD';
    if (microstructure) {
      const microAnalysis = microstructureSpecialist.analyzeMicrostructure(microstructure);
      microVote = microAnalysis.exitUrgency.includes('EXIT') ? 'EXIT' : 'HOLD';
    }

    // Count votes
    const votes = {
      ExitOrchestrator: exitVote.action,
      OppositionReader: oppVote,
      MicrostructureSpecialist: microVote
    };

    const exitVotes = Object.values(votes).filter(v => v === 'EXIT').length;
    const consensusAction = exitVotes >= 2 ? 'EXIT' : 'HOLD';
    const confidence = exitVotes / 3;

    const majorityReason =
      exitVotes === 3
        ? 'All agents agree: EXIT'
        : exitVotes === 2
          ? 'Majority consensus: EXIT (2/3 agents)'
          : 'Hold: Minority exit vote or disagreement';

    res.json({
      success: true,
      data: {
        consensusAction,
        confidence,
        votes,
        majorityReason,
        details: {
          exitOrchestrator: exitVote.reason,
          oppositionReader: opposition ? 'Analyzed' : 'Skipped',
          microstructureSpecialist: microstructure ? 'Analyzed' : 'Skipped'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Consensus Voting] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 5: Multi-Position Exit Coordination
// ============================================================================
/**
 * POST /api/agents/exit/coordinate
 * 
 * Coordinate exits across multiple open positions
 * Returns priority exit order
 * 
 * Body: {
 *   positions: [{
 *     symbol: string,
 *     profitPercent: number,
 *     timeHeldHours: number,
 *     distanceToStop: number,
 *     ...
 *   }]
 * }
 */
router.post('/coordinate', (req, res) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: positions (array)'
      });
    }

    const exitPriority: string[] = [];
    const recommendations: Record<string, string> = {};

    // PRIORITY 1: Stop losses hit
    positions
      .filter(p => p.profitPercent < -0.02)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '❌ Stop loss hit - EXIT IMMEDIATELY';
      });

    // PRIORITY 2: Losing trades about to hit stop
    positions
      .filter(p => p.profitPercent < -0.01 && p.profitPercent > -0.02)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '⚠️ Near stop loss - PREPARE EXIT';
      });

    // PRIORITY 3: Winning trades at profit targets
    positions
      .filter(p => p.profitPercent > 0.04)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '💰 At target - TAKE PROFIT';
      });

    // PRIORITY 4: Everything else - let run
    positions
      .filter(
        p =>
          p.profitPercent >= -0.01 &&
          p.profitPercent <= 0.04 &&
          !exitPriority.includes(p.symbol)
      )
      .forEach(p => {
        recommendations[p.symbol] = '⏳ Hold for development';
      });

    res.json({
      success: true,
      data: {
        exitPriority,
        recommendations,
        totalPositions: positions.length,
        priorityExits: exitPriority.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Exit Coordination] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 6: Agent Status & Leaderboard
// ============================================================================
/**
 * GET /api/agents/exit/status
 * 
 * Get status of all exit agents
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      ExitOrchestrator: exitOrchestrator.getStatus(),
      OppositionReader: oppositionReader.getStatus(),
      MicrostructureSpecialist: microstructureSpecialist.getStatus()
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Exit Agents Status] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 7: Record Exit Outcome (For Agent Learning)
// ============================================================================
/**
 * POST /api/agents/exit/outcome
 * 
 * Record actual exit outcome for agent learning
 * 
 * Body: {
 *   agentName: 'ExitOrchestrator' | 'OppositionReader' | 'MicrostructureSpecialist',
 *   exitDecision: string,
 *   actualPrice: number,
 *   optimalPrice: number,
 *   profit: number,
 *   profitPercent: number,
 *   reason: string
 * }
 */
router.post('/outcome', (req, res) => {
  try {
    const { agentName, profit, profitPercent, market_difficulty, execution_quality, regime, duration_hours } = req.body;

    if (!agentName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: agentName'
      });
    }

    let agent;
    switch (agentName) {
      case 'ExitOrchestrator':
        agent = exitOrchestrator;
        break;
      case 'OppositionReader':
        agent = oppositionReader;
        break;
      case 'MicrostructureSpecialist':
        agent = microstructureSpecialist;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown agent: ${agentName}`
        });
    }

    agent.updatePerformance({
      profit: profit || 0,
      profit_pct: profitPercent || 0,
      market_difficulty: market_difficulty || 1.0,
      execution_quality: execution_quality || 0.8,
      regime: regime || 'normal',
      duration_hours: duration_hours || 1
    });

    res.json({
      success: true,
      data: {
        agentName,
        newStatus: agent.getStatus(),
        message: `${agentName} updated with outcome data`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Exit Outcome Recording] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
