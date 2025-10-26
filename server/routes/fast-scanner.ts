/**
 * Fast Scanner API Routes
 * Provides quick scan results and symbol-specific data
 */

import express, { type Request, type Response } from 'express';
import { fastScanner } from '../services/fast-scanner';

const router = express.Router();

/**
 * POST /api/scanner/quick-scan
 * Trigger a quick scan (returns in 5-10 seconds)
 */
router.post('/quick-scan', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    
    console.log('[API] Quick scan requested');
    const results = await fastScanner.triggerScan(symbols);
    
    res.json({
      success: true,
      scanId: fastScanner.getStatus().currentScanId,
      signals: results,
      count: results.length,
      timestamp: new Date().toISOString(),
      message: 'Quick scan complete. Deep analysis running in background.'
    });
  } catch (error: any) {
    console.error('[API] Quick scan failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/scanner/results
 * Get current scan results
 */
router.get('/results', (req: Request, res: Response) => {
  try {
    const results = fastScanner.getCurrentResults();
    const status = fastScanner.getStatus();
    
    res.json({
      success: true,
      signals: results,
      count: results.length,
      status: status,
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
 * GET /api/scanner/symbol/:symbol
 * Get detailed data for a specific symbol
 */
router.get('/symbol/:symbol', (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const data = fastScanner.getSymbolData(symbol);
    
    if (!data.signal) {
      return res.status(404).json({
        success: false,
        error: `Symbol ${symbol} not found in scan results`
      });
    }
    
    res.json({
      success: true,
      symbol,
      signal: data.signal,
      deepAnalysis: data.deepData,
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
 * GET /api/scanner/status
 * Get scanner status
 */
router.get('/scan-status', (req: Request, res: Response) => {
  try {
    const status = fastScanner.getStatus();
    const history = fastScanner.getScanHistory();
    
    res.json({
      success: true,
      status,
      history,
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
 * WebSocket endpoint for real-time updates
 * (To be implemented with Socket.IO or native WebSocket)
 */

export default router;

