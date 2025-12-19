/**
 * Physics Agents API - VFMD & Flow Analysis
 * 
 * Endpoints:
 * - POST /api/agents/physics/vfmd-analyze - Analyze market for early entries using VFMD
 * - GET /api/agents/physics/agents - List available physics agents
 * - POST /api/agents/physics/compare - Compare VFMD vs Flow agent on same data
 */

import express, { type Request, type Response } from 'express';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import FlowPhysicsAgent from '../services/rpg-agents/FlowPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';
import { storage } from '../storage';

const router = express.Router();

// Singleton agent instances
const vfmdAgent = new VFMDPhysicsAgent('VFMD-Analyst', 'balanced');
const flowAgent = new FlowPhysicsAgent('Flow-Analyst', 'balanced');

/**
 * POST /api/agents/physics/vfmd-analyze
 * 
 * Analyze market data for early entry opportunities using VFMD system
 * 
 * Request body:
 * {
 *   symbol?: string,           // e.g., "BTC/USDT" (uses recent data from storage)
 *   data?: MarketTick[]        // OR provide raw tick data
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   analysis: {
 *     signal, entry_guidance, field_metrics, market_state, factors
 *   },
 *   agentLevel: number,
 *   agentName: string,
 *   timestamp: ISO string
 * }
 */
router.post('/vfmd-analyze', async (req: Request, res: Response) => {
  try {
    const { symbol, data } = req.body;

    let ticks: MarketTick[] = [];

    // Option 1: Fetch from storage using symbol
    if (symbol && !data) {
      try {
        const frames = await storage.getMarketFrames(symbol, 200);
        
        if (!frames || frames.length === 0) {
          return res.status(400).json({
            success: false,
            error: `No market data found for ${symbol}. Run scanner first.`,
            symbol
          });
        }

        // Convert MarketFrame to MarketTick
        ticks = frames.map(frame => ({
          timestamp: new Date(frame.timestamp).getTime(),
          open: (frame.price as any).open || 0,
          high: (frame.price as any).high || 0,
          low: (frame.price as any).low || 0,
          close: (frame.price as any).close || 0,
          volume: frame.volume,
          bidVolume: (frame.orderFlow as any)?.bidVolume,
          askVolume: (frame.orderFlow as any)?.askVolume
        }));
      } catch (storageErr: any) {
        console.warn('[Physics API] Storage fetch failed:', storageErr.message);
      }
    }

    // Option 2: Use provided data
    if (data && Array.isArray(data)) {
      ticks = data;
    }

    if (ticks.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Need at least 100 data points for VFMD analysis',
        provided: ticks.length
      });
    }

    // Run VFMD analysis
    const analysis = vfmdAgent.getAnalysisForUI(ticks);

    if (!analysis) {
      return res.status(400).json({
        success: false,
        error: 'VFMD analysis failed - data quality issue'
      });
    }

    // Generate signal
    const signal = vfmdAgent.generateSignal(ticks);

    res.json({
      success: true,
      analysis,
      signal: {
        action: signal.action,
        confidence: (signal.confidence * 100).toFixed(1) + '%',
        entry: signal.entry.toFixed(2),
        target: signal.target.toFixed(2),
        stop: signal.stop.toFixed(2)
      },
      agentName: vfmdAgent.name,
      agentLevel: vfmdAgent.level,
      timestamp: new Date().toISOString(),
      dataPoints: ticks.length
    });
  } catch (err: any) {
    console.error('[Physics API] VFMD Analysis Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'VFMD analysis failed'
    });
  }
});

/**
 * POST /api/agents/physics/flow-analyze
 * 
 * Analyze market data using Flow Field engine
 */
router.post('/flow-analyze', async (req: Request, res: Response) => {
  try {
    const { symbol, data } = req.body;

    let ticks: MarketTick[] = [];

    if (symbol && !data) {
      try {
        const frames = await storage.getMarketFrames(symbol, 200);
        
        if (!frames || frames.length === 0) {
          return res.status(400).json({
            success: false,
            error: `No market data found for ${symbol}`
          });
        }

        ticks = frames.map(frame => ({
          timestamp: new Date(frame.timestamp).getTime(),
          open: (frame.price as any).open || 0,
          high: (frame.price as any).high || 0,
          low: (frame.price as any).low || 0,
          close: (frame.price as any).close || 0,
          volume: frame.volume,
          bidVolume: (frame.orderFlow as any)?.bidVolume,
          askVolume: (frame.orderFlow as any)?.askVolume
        }));
      } catch (storageErr: any) {
        console.warn('[Physics API] Storage fetch failed:', storageErr.message);
      }
    }

    if (data && Array.isArray(data)) {
      ticks = data;
    }

    if (ticks.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Need at least 50 data points for Flow analysis',
        provided: ticks.length
      });
    }

    // Convert to FlowFieldPoint format
    const flowPoints = ticks.map(t => ({
      timestamp: t.timestamp,
      price: t.close,
      volume: t.volume,
      bidVolume: t.bidVolume,
      askVolume: t.askVolume,
      high: t.high,
      low: t.low,
      open: t.open
    }));

    // Analyze with Flow agent
    const flowResult = flowAgent.analyze(flowPoints);
    const signal = flowAgent.generateSignal(flowPoints);

    res.json({
      success: true,
      flowMetrics: {
        latestForce: flowResult.latestForce.toFixed(4),
        averageForce: flowResult.averageForce.toFixed(4),
        maxForce: flowResult.maxForce.toFixed(4),
        forceDirection: flowResult.forceDirection.toFixed(3),
        pressure: flowResult.pressure.toFixed(4),
        averagePressure: flowResult.averagePressure.toFixed(4),
        pressureTrend: flowResult.pressureTrend,
        turbulence: flowResult.turbulence.toFixed(6),
        turbulenceLevel: flowResult.turbulenceLevel,
        energyGradient: flowResult.energyGradient.toFixed(6),
        energyTrend: flowResult.energyTrend,
        dominantDirection: flowResult.dominantDirection
      },
      signal: {
        action: signal.action,
        confidence: (signal.confidence * 100).toFixed(1) + '%',
        entry: signal.entry.toFixed(2),
        target: signal.target.toFixed(2),
        stop: signal.stop.toFixed(2),
        reason: signal.reason
      },
      agentName: flowAgent.name,
      agentLevel: flowAgent.level,
      timestamp: new Date().toISOString(),
      dataPoints: ticks.length
    });
  } catch (err: any) {
    console.error('[Physics API] Flow Analysis Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Flow analysis failed'
    });
  }
});

/**
 * POST /api/agents/physics/compare
 * 
 * Run both VFMD and Flow agents on the same data and compare signals
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { symbol, data } = req.body;

    let ticks: MarketTick[] = [];

    if (symbol && !data) {
      try {
        const frames = await storage.getMarketFrames(symbol, 200);
        
        if (!frames || frames.length === 0) {
          return res.status(400).json({
            success: false,
            error: `No market data found for ${symbol}`
          });
        }

        ticks = frames.map(frame => ({
          timestamp: new Date(frame.timestamp).getTime(),
          open: (frame.price as any).open || 0,
          high: (frame.price as any).high || 0,
          low: (frame.price as any).low || 0,
          close: (frame.price as any).close || 0,
          volume: frame.volume,
          bidVolume: (frame.orderFlow as any)?.bidVolume,
          askVolume: (frame.orderFlow as any)?.askVolume
        }));
      } catch (storageErr: any) {
        console.warn('[Physics API] Storage fetch failed:', storageErr.message);
      }
    }

    if (data && Array.isArray(data)) {
      ticks = data;
    }

    if (ticks.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Need at least 100 data points for comparison',
        provided: ticks.length
      });
    }

    // VFMD Analysis
    const vfmdAnalysis = vfmdAgent.getAnalysisForUI(ticks);
    const vfmdSignal = vfmdAgent.generateSignal(ticks);

    // Flow Analysis
    const flowPoints = ticks.map(t => ({
      timestamp: t.timestamp,
      price: t.close,
      volume: t.volume,
      bidVolume: t.bidVolume,
      askVolume: t.askVolume,
      high: t.high,
      low: t.low,
      open: t.open
    }));
    const flowResult = flowAgent.analyze(flowPoints);
    const flowSignal = flowAgent.generateSignal(flowPoints);

    res.json({
      success: true,
      comparison: {
        vfmd: {
          signal: vfmdAnalysis.signal,
          entry_guidance: vfmdAnalysis.entry_guidance,
          field_metrics: vfmdAnalysis.field_metrics,
          market_state: vfmdAnalysis.market_state,
          factors: vfmdAnalysis.factors
        },
        flow: {
          signal: {
            direction: flowResult.dominantDirection,
            pressure: flowResult.pressure.toFixed(4),
            coherence: (flowResult.forceDirection * 100).toFixed(1) + '%',
            turbulence: flowResult.turbulenceLevel
          },
          trends: {
            pressure_trend: flowResult.pressureTrend,
            energy_trend: flowResult.energyTrend
          }
        },
        consensus: {
          actions_agree: vfmdSignal.action === flowSignal.action,
          vfmd_action: vfmdSignal.action,
          flow_action: flowSignal.action,
          average_confidence:
            ((vfmdSignal.confidence + flowSignal.confidence) / 2 * 100).toFixed(1) + '%'
        }
      },
      timestamp: new Date().toISOString(),
      dataPoints: ticks.length
    });
  } catch (err: any) {
    console.error('[Physics API] Comparison Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Comparison failed'
    });
  }
});

/**
 * GET /api/agents/physics/agents
 * 
 * List available physics agents and their capabilities
 */
router.get('/agents', (_req: Request, res: Response) => {
  res.json({
    success: true,
    agents: [
      {
        name: vfmdAgent.name,
        type: 'PHYSICS_VFMD',
        level: vfmdAgent.level,
        specialization: 'Early entry detection using vector field dynamics',
        capabilities: [
          'vfmd_analysis',
          'early_entry_detection',
          'field_coherence_analysis',
          'imbalance_detection',
          'pressure_gradient_analysis'
        ],
        description: 'VFMD (Vector Field Market Dynamics) agent specializes in identifying high-probability early entry opportunities by analyzing market vector fields, accumulation/distribution zones, and directional coherence.',
        endpoints: ['/api/agents/physics/vfmd-analyze']
      },
      {
        name: flowAgent.name,
        type: 'PHYSICS_FLOW',
        level: flowAgent.level,
        specialization: 'Flow field analysis and pressure dynamics',
        capabilities: [
          'flow_field_analysis',
          'pressure_gradient_detection',
          'turbulence_measurement',
          'divergence_analysis',
          'energy_state_tracking'
        ],
        description: 'Flow Physics agent analyzes market forces, pressure fields, and turbulence patterns to identify momentum shifts and directional bias.',
        endpoints: ['/api/agents/physics/flow-analyze']
      }
    ],
    comparison_endpoint: '/api/agents/physics/compare',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/agents/physics/status
 * 
 * Health check and agent status
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Physics Agents Engine',
    agents: [
      {
        name: vfmdAgent.name,
        level: vfmdAgent.level,
        skills: vfmdAgent.skills,
        ready: true
      },
      {
        name: flowAgent.name,
        level: flowAgent.level,
        skills: flowAgent.skills,
        ready: true
      }
    ],
    timestamp: new Date().toISOString()
  });
});

export default router;
