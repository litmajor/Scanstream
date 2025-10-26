
import express, { type Request, type Response } from 'express';

const router = express.Router();

router.post('/candle-clustering', (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    
    if (!data || data.length < 20) {
      return res.status(400).json({ error: 'Insufficient data (need 20+ candles)' });
    }
    
    // Calculate volume threshold (2x average)
    const avgVolume = data.reduce((sum: number, d: any) => sum + (d.volume || 0), 0) / data.length;
    const highVolumeThreshold = avgVolume * 2;
    
    // Detect clusters
    const clusters = [];
    let currentCluster: any = null;
    
    data.slice(-20).forEach((candle: any, idx: number) => {
      const isHighVolume = (candle.volume || 0) > highVolumeThreshold;
      const isBullish = candle.close > candle.open;
      
      if (isHighVolume) {
        if (!currentCluster || currentCluster.direction !== (isBullish ? 'bullish' : 'bearish')) {
          if (currentCluster) clusters.push(currentCluster);
          currentCluster = {
            startIndex: idx,
            direction: isBullish ? 'bullish' : 'bearish',
            candles: 1,
            totalVolume: candle.volume || 0
          };
        } else {
          currentCluster.candles++;
          currentCluster.totalVolume += candle.volume || 0;
        }
      } else {
        if (currentCluster) {
          clusters.push(currentCluster);
          currentCluster = null;
        }
      }
    });
    
    if (currentCluster) clusters.push(currentCluster);
    
    const bullishClusters = clusters.filter(c => c.direction === 'bullish').length;
    const bearishClusters = clusters.filter(c => c.direction === 'bearish').length;
    const totalClusters = clusters.length;
    const directionalRatio = totalClusters > 0 ? Math.max(bullishClusters, bearishClusters) / totalClusters : 0;
    
    res.json({
      success: true,
      clusters,
      totalClusters,
      bullishClusters,
      bearishClusters,
      directionalRatio,
      trendFormation: directionalRatio > 0.7,
      dominantDirection: bullishClusters > bearishClusters ? 'bullish' : 'bearish'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

