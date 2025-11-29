
import { Router, Request, Response } from 'express';
import { getGatewayServices } from './gateway';

const router = Router();

interface MetricsSnapshot {
  timestamp: Date;
  cache: {
    hitRate: number;
    entries: number;
    hits: number;
    misses: number;
  };
  rateLimits: Record<string, any>;
  exchanges: Record<string, any>;
}

// Store metrics history (last 1000 snapshots)
const metricsHistory: MetricsSnapshot[] = [];
const MAX_HISTORY = 1000;

// Collect metrics every 10 seconds
setInterval(() => {
  try {
    const { aggregator, cacheManager, rateLimiter } = getGatewayServices();
    
    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      cache: cacheManager.getStats(),
      rateLimits: {
        binance: rateLimiter.getStats('binance'),
        coinbase: rateLimiter.getStats('coinbase'),
        kraken: rateLimiter.getStats('kraken'),
        kucoinfutures: rateLimiter.getStats('kucoinfutures'),
        okx: rateLimiter.getStats('okx'),
        bybit: rateLimiter.getStats('bybit')
      },
      exchanges: aggregator.getHealthStatus()
    };
    
    metricsHistory.push(snapshot);
    
    // Keep only last 1000 snapshots
    if (metricsHistory.length > MAX_HISTORY) {
      metricsHistory.shift();
    }
  } catch (error) {
    console.error('[Metrics] Failed to collect snapshot:', error);
  }
}, 10000);

/**
 * Get real-time metrics
 */
router.get('/realtime', (req: Request, res: Response) => {
  try {
    const { aggregator, cacheManager, rateLimiter } = getGatewayServices();
    
    const metrics = {
      cache: cacheManager.getStats(),
      rateLimits: {
        binance: rateLimiter.getStats('binance'),
        coinbase: rateLimiter.getStats('coinbase'),
        kraken: rateLimiter.getStats('kraken'),
        kucoinfutures: rateLimiter.getStats('kucoinfutures'),
        okx: rateLimiter.getStats('okx'),
        bybit: rateLimiter.getStats('bybit')
      },
      exchanges: aggregator.getHealthStatus(),
      timestamp: new Date()
    };
    
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get metrics history for time series
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { duration = '1h' } = req.query;
    
    let cutoffTime = new Date();
    if (duration === '1h') cutoffTime.setHours(cutoffTime.getHours() - 1);
    else if (duration === '6h') cutoffTime.setHours(cutoffTime.getHours() - 6);
    else if (duration === '24h') cutoffTime.setHours(cutoffTime.getHours() - 24);
    
    const filtered = metricsHistory.filter(m => m.timestamp >= cutoffTime);
    
    res.json({
      success: true,
      duration,
      count: filtered.length,
      metrics: filtered
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get cache performance by symbol
 */
router.get('/cache-by-symbol', (req: Request, res: Response) => {
  try {
    const { aggregator, cacheManager } = getGatewayServices();
    
    // Get all cache entries
    const stats = cacheManager.getStats();
    
    res.json({
      success: true,
      overall: stats,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get exchange latency trends
 */
router.get('/exchange-latency', (req: Request, res: Response) => {
  try {
    const latencyData = metricsHistory.slice(-60).map(snapshot => ({
      timestamp: snapshot.timestamp,
      exchanges: Object.entries(snapshot.exchanges).reduce((acc, [name, health]: [string, any]) => {
        acc[name] = health.latency || 0;
        return acc;
      }, {} as Record<string, number>)
    }));
    
    res.json({
      success: true,
      data: latencyData,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get rate limit usage trends
 */
router.get('/rate-limit-usage', (req: Request, res: Response) => {
  try {
    const usageData = metricsHistory.slice(-60).map(snapshot => ({
      timestamp: snapshot.timestamp,
      exchanges: Object.entries(snapshot.rateLimits).reduce((acc, [name, stats]: [string, any]) => {
        acc[name] = stats?.usage || 0;
        return acc;
      }, {} as Record<string, number>)
    }));
    
    res.json({
      success: true,
      data: usageData,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get aggregated statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    if (metricsHistory.length === 0) {
      return res.json({ success: true, stats: null, message: 'No metrics collected yet' });
    }
    
    const recent = metricsHistory.slice(-60); // Last 10 minutes
    
    // Calculate averages
    const avgCacheHitRate = recent.reduce((sum, m) => sum + m.cache.hitRate, 0) / recent.length;
    
    const exchangeStats = Object.keys(recent[0].exchanges).reduce((acc, exchange) => {
      const latencies = recent.map(m => m.exchanges[exchange]?.latency || 0).filter(l => l > 0);
      const avgLatency = latencies.length > 0 
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
        : 0;
      
      acc[exchange] = {
        avgLatency: Math.round(avgLatency),
        uptime: recent.filter(m => m.exchanges[exchange]?.healthy).length / recent.length
      };
      return acc;
    }, {} as Record<string, any>);
    
    res.json({
      success: true,
      stats: {
        avgCacheHitRate,
        totalSnapshots: metricsHistory.length,
        timeRange: {
          start: metricsHistory[0].timestamp,
          end: metricsHistory[metricsHistory.length - 1].timestamp
        },
        exchanges: exchangeStats
      },
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
