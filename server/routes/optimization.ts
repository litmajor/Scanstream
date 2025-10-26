
import express, { type Request, type Response } from 'express';
import { MirrorOptimizer } from '../bayesian-optimizer';
import { ScannerAgent, MLAgent } from '../bayesian-optimizer';
import { ExchangeDataFeed } from '../trading-engine';

const router = express.Router();

// Global optimizer instance
let optimizer: MirrorOptimizer | null = null;

/**
 * POST /api/optimize/run
 * Run comprehensive optimization
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      optimizeScanner = true,
      optimizeML = true,
      optimizeRL = true,
      optimizeStrategies = true,
      iterations = 15,
      parallelOptimization = false,
      symbol = 'BTC/USDT',
      timeframe = '1h',
      dataPoints = 500
    } = req.body;
    
    // Initialize optimizer
    if (!optimizer) {
      optimizer = new MirrorOptimizer();
      
      // Register agents
      const scannerAgent = await ScannerAgent.create();
      const mlAgent = new MLAgent();
      
      optimizer.registerAgent('scanner', scannerAgent);
      optimizer.registerAgent('ml', mlAgent);
    }
    
    // Fetch market data
    console.log(`[Optimization] Fetching ${dataPoints} candles for ${symbol}...`);
    const dataFeed = await ExchangeDataFeed.create();
    const marketData = await dataFeed.fetchMarketData(symbol, timeframe, dataPoints);
    
    if (!marketData || marketData.length < 100) {
      return res.status(400).json({
        error: 'Insufficient market data',
        message: 'Need at least 100 candles for optimization'
      });
    }
    
    // Run optimization
    const config = {
      optimizeScanner,
      optimizeML,
      optimizeRL,
      optimizeStrategies,
      iterations,
      parallelOptimization
    };
    
    console.log('[Optimization] Starting optimization with config:', config);
    const results = await optimizer.optimizeAll(config, marketData);
    
    // Get full report
    const report = optimizer.getOptimizationReport();
    
    res.json({
      success: true,
      results,
      report,
      dataPoints: marketData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Optimization] Error:', error);
    res.status(500).json({
      error: error.message || 'Optimization failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/optimize/status
 * Get current optimization status
 */
router.get('/status', (_req: Request, res: Response) => {
  if (!optimizer) {
    return res.json({
      initialized: false,
      message: 'Optimizer not initialized. Run optimization first.'
    });
  }
  
  const report = optimizer.getOptimizationReport();
  
  res.json({
    initialized: true,
    report,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/optimize/history
 * Get optimization history
 */
router.get('/history', (_req: Request, res: Response) => {
  if (!optimizer) {
    return res.json({ history: {} });
  }
  
  const history = optimizer.getOptimizationHistory();
  
  res.json({
    history,
    timestamp: new Date().toISOString()
  });
});

export default router;
