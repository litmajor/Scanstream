import express, { Router, Request, Response } from 'express';
import { apiRegistry } from '../services/api-registry';
import { AgentArena } from '../services/rpg-agents/AgentArena';
import { priceCache } from '../../src/core/PriceCache';
import { storage } from '../storage';
import { MLSignalEnhancer } from '../ml-engine';

/**
 * Missing API endpoints that frontend expects
 * These endpoints return mock/aggregated data for now
 */
const router = Router();

// GET /api/agents - List of all active agents
let _globalArena: AgentArena | null = null;
async function getGlobalArena(): Promise<AgentArena> {
  if (_globalArena) return _globalArena;
  _globalArena = new AgentArena();
  return _globalArena;
}

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const arena = await getGlobalArena();
    const agents = arena.getAllAgents ? arena.getAllAgents().map((a: any) => (a.getStatus ? a.getStatus() : a)) : [];
    res.json({ agents, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.warn('[Missing API] Failed to fetch real agents, falling back to empty list', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch agents' });
  }
});

try {
  apiRegistry.registerEndpoint({ method: 'GET', path: '/api/agents', category: 'AGENT', name: 'Agents List', description: 'List of active agents', version: '1.0.0', tags: ['agents'], isDeprecated: false, authentication: 'NONE', cacheable: true, cacheTTLSeconds: 5, isActive: true });
} catch (e) { console.warn('[APIRegistry] Failed to register /api/agents', e); }

// GET /api/market-sentiment - Current market sentiment (derived from storage & cache)
router.get('/market-sentiment', async (req: Request, res: Response) => {
  try {
    // Prefer persisted market sentiment if available
    try {
      const persisted = await storage.getMarketSentiment();
      // Compute a lightweight composite sentiment from cached prices for a few core symbols
      const core = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
      const components: any = { technical: 0, fundamental: 0, on_chain: 0, social: 0 };
      const major_signals: any[] = [];

      for (const s of core) {
        const candles = priceCache.getCandles(s, '1h');
        let strength = 0;
        let sentiment = 'neutral';
        if (candles && candles.length >= 2) {
          const last = candles[candles.length - 1][4];
          const prev = candles[candles.length - 2][4];
          const pct = prev > 0 ? ((last - prev) / prev) * 100 : 0;
          strength = Math.min(1, Math.abs(pct) / 5);
          sentiment = pct > 1 ? 'bullish' : pct < -1 ? 'bearish' : 'neutral';
        } else {
          const t = priceCache.get(s);
          if (t && t.price) { strength = 0.01; }
        }
        major_signals.push({ symbol: s, sentiment, strength });
        components.technical += strength;
      }
      components.technical = +(components.technical / core.length).toFixed(2);

      const overall_score = components.technical; // lightweight proxy
      const overall = overall_score > 0.1 ? 'bullish' : overall_score < -0.1 ? 'bearish' : 'neutral';

      return res.json({
        overall_sentiment: overall,
        sentiment_score: overall_score,
        components,
        major_signals,
        source: 'storage+cache',
        onChain: persisted,
        timestamp: new Date().toISOString()
      });
    } catch (innerErr) {
      console.warn('[Missing API] storage.getMarketSentiment failed:', innerErr);
    }

    // Fallback: very small computed signal using cache
    res.json({ overall_sentiment: 'neutral', sentiment_score: 0, components: {}, major_signals: [], timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

try { apiRegistry.registerEndpoint({ method: 'GET', path: '/api/market-sentiment', category: 'ANALYTICS', name: 'Market Sentiment', description: 'Current market sentiment (storage+cache)', version: '1.0.0', tags: ['sentiment'], isDeprecated: false, authentication: 'NONE', cacheable: true, cacheTTLSeconds: 30, isActive: true }); } catch (e) { console.warn('[APIRegistry] Failed to register /api/market-sentiment', e); }

// GET /api/portfolio-summary - Current portfolio summary
router.get('/portfolio-summary', async (req: Request, res: Response) => {
  try {
    const summary = await storage.getPortfolioSummary();
    return res.json({
      total_value: summary.totalValue ?? summary.totalValue,
      available_cash: summary.availableCash ?? summary.availableCash,
      invested: summary.invested ?? summary.invested,
      day_change: summary.dayChange ?? summary.dayChange,
      day_change_percent: summary.dayChangePercent ?? summary.dayChangePercent,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

try { apiRegistry.registerEndpoint({ method: 'GET', path: '/api/portfolio-summary', category: 'TRADING', name: 'Portfolio Summary', description: 'Current portfolio summary (storage-backed)', version: '1.0.0', tags: ['portfolio'], isDeprecated: false, authentication: 'NONE', cacheable: true, cacheTTLSeconds: 15, isActive: true }); } catch (e) { console.warn('[APIRegistry] Failed to register /api/portfolio-summary', e); }

// GET /api/ml/insights - ML model insights and predictions
router.get('/ml/insights', async (req: Request, res: Response) => {
  try {
    const ml = new MLSignalEnhancer();
    let insights: Record<string, number> = {};
    try {
      insights = ml.getModelInsights();
    } catch (e) {
      console.warn('[Missing API] ML insights unavailable:', e);
      insights = {};
    }

    // Provide a minimal next price prediction using cached price if available
    const symbol = (req.query.symbol as string) || 'BTC/USDT';
    const cached = priceCache.get(symbol);
    const prediction = cached ? { symbol, predicted_price: cached.price, confidence_interval: [cached.price, cached.price], probability_up: 0.5, probability_down: 0.5 } : null;

    res.json({ model_ensemble: insights, next_price_prediction: prediction, feature_importance: insights, timestamp: new Date().toISOString(), dataSource: cached ? 'cache' : 'none' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

try { apiRegistry.registerEndpoint({ method: 'GET', path: '/api/ml/insights', category: 'ANALYTICS', name: 'ML Insights', description: 'ML ensemble insights (cache+ml-enhancer)', version: '1.0.0', tags: ['ml','insights'], isDeprecated: false, authentication: 'NONE', cacheable: true, cacheTTLSeconds: 30, isActive: true }); } catch (e) { console.warn('[APIRegistry] Failed to register /api/ml/insights', e); }

// GET /api/orders - Current open orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const trades = await storage.getTrades('OPEN');
    const open = trades.map(t => ({ id: t.id, symbol: t.symbol, side: t.side, price: t.entryPrice, quantity: t.quantity, status: t.status, created_at: t.entryTime }));
    res.json({ open_orders: open, total_orders: open.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

try { apiRegistry.registerEndpoint({ method: 'GET', path: '/api/orders', category: 'TRADING', name: 'Open Orders', description: 'List of open orders (storage-backed)', version: '1.0.0', tags: ['orders'], isDeprecated: false, authentication: 'NONE', cacheable: false, isActive: true }); } catch (e) { console.warn('[APIRegistry] Failed to register /api/orders', e); }

export default router;
