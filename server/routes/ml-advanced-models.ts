
import express, { type Request, type Response } from 'express';
import AttentionModel from '../services/ml-attention-model';
import RegimeDetector from '../services/ml-regime-detector';
import AnomalyDetector from '../services/ml-anomaly-detector';
import { storage } from '../storage';

const router = express.Router();

/**
 * GET /api/ml-advanced/attention-prediction
 */
router.get('/attention-prediction/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const frames = await storage.getMarketFrames(symbol, 200);
    
    if (frames.length < 50) {
      return res.status(400).json({ error: 'Insufficient data' });
    }
    
    const prediction = await AttentionModel.predict(frames);
    
    res.json({
      success: true,
      symbol,
      prediction,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ml-advanced/regime
 */
router.get('/regime/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const frames = await storage.getMarketFrames(symbol, 200);
    
    const regimeInfo = RegimeDetector.detectRegime(frames);
    const stability = RegimeDetector.getRegimeStability();
    
    res.json({
      success: true,
      symbol,
      regime: regimeInfo,
      stability,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ml-advanced/anomaly
 */
router.get('/anomaly/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const frames = await storage.getMarketFrames(symbol, 200);
    
    const anomaly = AnomalyDetector.detectAnomaly(frames);
    const report = AnomalyDetector.getAnomalyReport(frames, 20);
    
    res.json({
      success: true,
      symbol,
      current: anomaly,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
