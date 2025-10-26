/**
 * Flow Field Analytics API Routes
 * 
 * Endpoints:
 * - POST /api/analytics/flow-field - Compute flow field for provided data
 * - POST /api/analytics/flow-field/batch - Compute for multiple symbols
 * - POST /api/analytics/flow-field/divergence - Detect flow divergence
 */

import express, { type Request, type Response } from 'express';
import { 
  computeFlowField, 
  computeFlowFieldBatch,
  detectFlowDivergence,
  type FlowFieldPoint,
  type FlowFieldConfig 
} from '../services/analytics/flowFieldEngine';

const router = express.Router();

/**
 * POST /api/analytics/flow-field
 * 
 * Compute flow field metrics for a single symbol
 * 
 * Request body:
 * {
 *   data: FlowFieldPoint[],
 *   config?: FlowFieldConfig
 * }
 */
router.post('/flow-field', (req: Request, res: Response) => {
  try {
    const { data, config } = req.body;
    
    // Validate input
    if (!data || !Array.isArray(data) || data.length < 2) {
      return res.status(400).json({ 
        error: 'Invalid data payload',
        message: 'Data must be an array with at least 2 data points'
      });
    }
    
    // Compute flow field
    const result = computeFlowField(data as FlowFieldPoint[], config);
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[FlowField] Error:', err);
    res.status(400).json({ 
      success: false,
      error: err.message || 'Flow field computation failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/analytics/flow-field/batch
 * 
 * Compute flow field metrics for multiple symbols
 * 
 * Request body:
 * {
 *   symbols: {
 *     [symbol: string]: FlowFieldPoint[]
 *   },
 *   config?: FlowFieldConfig
 * }
 */
router.post('/flow-field/batch', async (req: Request, res: Response) => {
  try {
    const { symbols, config } = req.body;
    
    // Validate input
    if (!symbols || typeof symbols !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid payload',
        message: 'Symbols must be an object with symbol names as keys'
      });
    }
    
    // Convert to Map
    const dataMap = new Map<string, FlowFieldPoint[]>();
    for (const [symbol, data] of Object.entries(symbols)) {
      if (Array.isArray(data) && data.length >= 2) {
        dataMap.set(symbol, data as FlowFieldPoint[]);
      }
    }
    
    // Compute batch
    const resultsMap = await computeFlowFieldBatch(dataMap, config);
    
    // Convert Map to object for JSON response
    const results: Record<string, any> = {};
    for (const [symbol, result] of resultsMap.entries()) {
      results[symbol] = result;
    }
    
    res.json({
      success: true,
      results,
      totalSymbols: resultsMap.size,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[FlowField Batch] Error:', err);
    res.status(400).json({ 
      success: false,
      error: err.message || 'Batch flow field computation failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/analytics/flow-field/divergence
 * 
 * Detect flow divergence patterns
 * 
 * Request body:
 * {
 *   data: FlowFieldPoint[],
 *   config?: FlowFieldConfig
 * }
 */
router.post('/flow-field/divergence', (req: Request, res: Response) => {
  try {
    const { data, config } = req.body;
    
    // Validate input
    if (!data || !Array.isArray(data) || data.length < 10) {
      return res.status(400).json({ 
        error: 'Invalid data payload',
        message: 'Divergence detection requires at least 10 data points'
      });
    }
    
    // First compute flow field
    const flowField = computeFlowField(data as FlowFieldPoint[], config);
    
    // Then detect divergence
    const divergence = detectFlowDivergence(flowField, data as FlowFieldPoint[]);
    
    res.json({
      success: true,
      flowField,
      divergence,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[FlowField Divergence] Error:', err);
    res.status(400).json({ 
      success: false,
      error: err.message || 'Divergence detection failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/analytics/flow-field/status
 * 
 * Health check endpoint
 */
router.get('/flow-field/status', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Flow Field Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;

