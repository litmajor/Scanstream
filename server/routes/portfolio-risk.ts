
import { Router } from 'express';
import type { Request, Response } from 'express';
import { portfolioRiskManager } from '../services/portfolio-risk-manager';

const router = Router();

/**
 * GET /api/portfolio-risk/metrics
 * Get current portfolio risk metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const balance = parseFloat(req.query.balance as string) || 10000;
    const metrics = portfolioRiskManager.getPortfolioMetrics(balance);
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio-risk/position-consensus
 * Get position sizing consensus from multiple sources
 */
router.post('/position-consensus', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      signalConfidence,
      signalType,
      accountBalance,
      currentPrice,
      atr,
      marketRegime,
      primaryPattern
    } = req.body;

    const consensus = await portfolioRiskManager.getPositionSizingConsensus(
      symbol,
      signalConfidence,
      signalType,
      accountBalance,
      currentPrice,
      atr,
      marketRegime,
      primaryPattern
    );

    res.json({ success: true, consensus });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio-risk/add-position
 * Add a new position to tracking
 */
router.post('/add-position', (req: Request, res: Response) => {
  try {
    const position = req.body;
    portfolioRiskManager.addPosition(position);
    res.json({ success: true, message: 'Position added' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio-risk/remove-position
 * Remove a position from tracking
 */
router.post('/remove-position', (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    portfolioRiskManager.removePosition(symbol);
    res.json({ success: true, message: 'Position removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio-risk/update-price
 * Update position price
 */
router.post('/update-price', (req: Request, res: Response) => {
  try {
    const { symbol, currentPrice } = req.body;
    portfolioRiskManager.updatePositionPrice(symbol, currentPrice);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/portfolio-risk/limits
 * Get current risk limits
 */
router.get('/limits', (_req: Request, res: Response) => {
  try {
    const limits = portfolioRiskManager.getLimits();
    res.json({ success: true, limits });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio-risk/limits
 * Update risk limits
 */
router.post('/limits', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    portfolioRiskManager.updateLimits(updates);
    res.json({ success: true, limits: portfolioRiskManager.getLimits() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
