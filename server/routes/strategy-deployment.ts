
import { Router } from 'express';
import type { Request, Response } from 'express';
import { strategyDeploymentManager } from '../services/strategy-deployment-manager';

const router = Router();

/**
 * POST /api/strategy-deployment/deploy
 * Deploy a strategy in specified mode
 */
router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { strategyId, mode } = req.body;

    if (!strategyId || !mode) {
      return res.status(400).json({
        error: 'Missing required fields: strategyId, mode'
      });
    }

    if (!['backtest', 'paper', 'live'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode. Must be: backtest, paper, or live'
      });
    }

    const result = await strategyDeploymentManager.deployStrategy(strategyId, mode);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/strategy-deployment/stop/:strategyId
 * Stop a strategy deployment
 */
router.post('/stop/:strategyId', (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const result = strategyDeploymentManager.stopStrategy(strategyId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/strategy-deployment/status/:strategyId
 * Get deployment status for a strategy
 */
router.get('/status/:strategyId', (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const status = strategyDeploymentManager.getDeploymentStatus(strategyId);

    if (!status) {
      return res.status(404).json({
        error: 'Strategy deployment not found'
      });
    }

    res.json({ success: true, deployment: status });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/strategy-deployment/all
 * Get all strategy deployments
 */
router.get('/all', (req: Request, res: Response) => {
  try {
    const deployments = strategyDeploymentManager.getAllDeployments();

    res.json({
      success: true,
      deployments,
      total: deployments.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/strategy-deployment/mode/:mode
 * Get deployments by mode
 */
router.get('/mode/:mode', (req: Request, res: Response) => {
  try {
    const { mode } = req.params;

    if (!['backtest', 'paper', 'live'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode'
      });
    }

    const deployments = strategyDeploymentManager.getDeploymentsByMode(mode as any);

    res.json({
      success: true,
      mode,
      deployments,
      total: deployments.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
