
import { Router } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';

const router = Router();

// Initialize services
const cache = new CacheManager(5000);
const rateLimiter = new RateLimiter();

// Initialize rate limits for exchanges
rateLimiter.initExchange('binance', 400);
rateLimiter.initExchange('coinbase', 200);
rateLimiter.initExchange('kraken', 100);
rateLimiter.initExchange('kucoinfutures', 50);
rateLimiter.initExchange('okx', 150);
rateLimiter.initExchange('bybit', 150);

// Cleanup cache every 5 minutes
setInterval(() => {
  const removed = cache.cleanup();
  if (removed > 0) {
    console.log(`[Gateway] Cleaned up ${removed} expired cache entries`);
  }
}, 5 * 60 * 1000);

/**
 * Gateway Health Status
 */
router.get('/health', async (req, res) => {
  const cacheStats = cache.getStats();
  
  const exchanges = {
    binance: rateLimiter.getStats('binance'),
    coinbase: rateLimiter.getStats('coinbase'),
    kraken: rateLimiter.getStats('kraken'),
    kucoinfutures: rateLimiter.getStats('kucoinfutures'),
    okx: rateLimiter.getStats('okx'),
    bybit: rateLimiter.getStats('bybit')
  };

  const healthyCount = Object.values(exchanges).filter(e => e?.healthy).length;
  const status = healthyCount === 0 ? 'down' : 
                 healthyCount < 3 ? 'degraded' : 'healthy';

  res.json({
    status,
    exchanges,
    cache: {
      hitRate: cacheStats.hitRate,
      entries: cacheStats.entries
    },
    timestamp: new Date()
  });
});

/**
 * Cache Metrics
 */
router.get('/metrics/cache', (req, res) => {
  res.json(cache.getStats());
});

/**
 * Rate Limit Metrics
 */
router.get('/metrics/rate-limit', (req, res) => {
  const stats = {
    binance: rateLimiter.getStats('binance'),
    coinbase: rateLimiter.getStats('coinbase'),
    kraken: rateLimiter.getStats('kraken'),
    kucoinfutures: rateLimiter.getStats('kucoinfutures'),
    okx: rateLimiter.getStats('okx'),
    bybit: rateLimiter.getStats('bybit')
  };

  res.json(stats);
});

/**
 * Clear cache (admin endpoint)
 */
router.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

/**
 * Invalidate cache pattern
 */
router.post('/cache/invalidate', (req, res) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern required' });
  }

  cache.invalidatePattern(pattern);
  res.json({ success: true, message: `Invalidated cache entries matching: ${pattern}` });
});

export default router;
export { cache, rateLimiter };
