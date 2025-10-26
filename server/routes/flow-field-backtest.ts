/**
 * Flow Field Backtest API Routes
 */

import express, { type Request, type Response } from 'express';
import { 
  runFlowFieldBacktest,
  exportBacktestResults,
  generateBacktestReport,
  type BacktestConfig,
  type FlowFieldPoint
} from '../services/analytics/flowFieldBacktest';

const router = express.Router();

/**
 * POST /api/analytics/backtest/flow-field
 * 
 * Run backtest on historical data
 */
router.post('/backtest/flow-field', (req: Request, res: Response) => {
  try {
    const { historicalData, config } = req.body;
    
    if (!historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({
        error: 'Invalid historical data',
        message: 'Historical data must be an array of FlowFieldPoint objects'
      });
    }
    
    // Default config
    const backtestConfig: BacktestConfig = {
      initialCapital: config?.initialCapital || 10000,
      positionSize: config?.positionSize || 0.1, // 10% per trade
      stopLossPercent: config?.stopLossPercent || 0.02, // 2%
      takeProfitPercent: config?.takeProfitPercent || 0.05, // 5%
      commission: config?.commission || 0.001, // 0.1%
      slippage: config?.slippage || 0.0005, // 0.05%
      minConfidence: config?.minConfidence || 60
    };
    
    // Run backtest
    const results = runFlowFieldBacktest(historicalData as FlowFieldPoint[], backtestConfig);
    
    // Generate report
    const report = generateBacktestReport(results);
    
    res.json({
      success: true,
      results,
      report,
      config: backtestConfig,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[Flow Field Backtest] Error:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Backtest failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/analytics/backtest/flow-field/export
 * 
 * Export backtest results as JSON
 */
router.post('/backtest/flow-field/export', (req: Request, res: Response) => {
  try {
    const { results } = req.body;
    
    if (!results) {
      return res.status(400).json({
        error: 'No results provided'
      });
    }
    
    const jsonExport = exportBacktestResults(results);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=flow-field-backtest-${Date.now()}.json`);
    res.send(jsonExport);
    
  } catch (err: any) {
    console.error('[Flow Field Backtest Export] Error:', err);
    res.status(400).json({
      error: err.message || 'Export failed'
    });
  }
});

export default router;

