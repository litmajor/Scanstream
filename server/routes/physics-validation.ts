/**
 * Physics Validation API Routes
 * Real quantitative testing endpoints for physics theory
 */

import { Router, Request, Response } from 'express';
import { runPhysicsValidation } from '../services/physics-validation';

const router = Router();

/**
 * POST /api/physics/validate
 * Run full quantitative physics validation
 * 
 * Body:
 * {
 *   symbol: string (default: "BTC/USDT")
 * }
 * 
 * Response: Detailed validation metrics and test results
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT' } = req.body;

    console.log(`[Physics Validation] Starting for ${symbol}`);

    const report = await runPhysicsValidation(symbol);

    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
      conclusion: report.testsPassed 
        ? '✅ PHYSICS THEORY VALIDATED - All critical thresholds met'
        : '⚠️ VALIDATION INCOMPLETE - Some metrics below threshold'
    });
  } catch (err: any) {
    console.error('[Physics Validation] Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/physics/validate-status
 * Quick check of validation readiness
 */
router.get('/validate-status', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    tests: [
      { name: 'PEG Breakout Prediction', threshold: '>50% correlation', importance: 'CRITICAL' },
      { name: 'Turbulence Index Accuracy', threshold: '>60% accuracy', importance: 'CRITICAL' },
      { name: 'Coherence Regime Alignment', threshold: '>65% accuracy', importance: 'HIGH' },
      { name: 'Regime Classification', threshold: '>70% accuracy', importance: 'HIGH' }
    ],
    endpoint: 'POST /api/physics/validate',
    dataRequired: '200+ historical candles'
  });
});

export default router;
