import express, { Router, Request, Response } from 'express';

/**
 * Missing API endpoints that frontend expects
 * These endpoints return mock/aggregated data for now
 */
const router = Router();

// GET /api/agents - List of all active agents
router.get('/agents', (req: Request, res: Response) => {
  try {
    res.json({
      agents: [
        {
          id: 'discovery-agent',
          name: 'Discovery Agent',
          status: 'active',
          performance: 0.65,
          signals_generated: 1247,
          win_rate: 0.58
        },
        {
          id: 'arbitrage-agent',
          name: 'Arbitrage Agent',
          status: 'active',
          performance: 0.72,
          signals_generated: 892,
          win_rate: 0.71
        },
        {
          id: 'portfolio-agent',
          name: 'Portfolio Agent',
          status: 'active',
          performance: 0.68,
          signals_generated: 654,
          win_rate: 0.64
        },
        {
          id: 'rpg-commander',
          name: 'RPG Commander',
          status: 'active',
          performance: 0.75,
          signals_generated: 523,
          win_rate: 0.76
        },
        {
          id: 'ml-ensemble',
          name: 'ML Ensemble',
          status: 'active',
          performance: 0.70,
          signals_generated: 1156,
          win_rate: 0.68
        }
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/market-sentiment - Current market sentiment
router.get('/market-sentiment', (req: Request, res: Response) => {
  try {
    res.json({
      overall_sentiment: 'bullish',
      sentiment_score: 0.72,
      components: {
        technical: 0.70,
        fundamental: 0.68,
        on_chain: 0.75,
        social: 0.65
      },
      major_signals: [
        { symbol: 'BTC/USDT', sentiment: 'bullish', strength: 0.78 },
        { symbol: 'ETH/USDT', sentiment: 'bullish', strength: 0.72 },
        { symbol: 'SOL/USDT', sentiment: 'neutral', strength: 0.55 }
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portfolio-summary - Current portfolio summary
router.get('/portfolio-summary', (req: Request, res: Response) => {
  try {
    res.json({
      total_value: 125000,
      daily_change: 2450,
      daily_change_percent: 1.98,
      positions: [
        { symbol: 'BTC/USDT', quantity: 0.5, entry_price: 42000, current_price: 43500, pnl: 750 },
        { symbol: 'ETH/USDT', quantity: 5, entry_price: 2200, current_price: 2280, pnl: 400 },
        { symbol: 'SOL/USDT', quantity: 50, entry_price: 140, current_price: 145, pnl: 250 }
      ],
      allocation: {
        BTC: 0.50,
        ETH: 0.30,
        SOL: 0.15,
        USDT: 0.05
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/exchange/status - Exchange connectivity status
router.get('/exchange/status', (req: Request, res: Response) => {
  try {
    res.json({
      status: 'healthy',
      exchanges: {
        binance: { status: 'connected', latency_ms: 45 },
        kucoinfutures: { status: 'connected', latency_ms: 78 },
        okx: { status: 'connected', latency_ms: 65 },
        bybit: { status: 'connected', latency_ms: 52 },
        kraken: { status: 'connected', latency_ms: 89 },
        coinbase: { status: 'connected', latency_ms: 123 }
      },
      data_freshness_ms: 1250,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ml/insights - ML model insights and predictions
router.get('/ml/insights', (req: Request, res: Response) => {
  try {
    res.json({
      model_ensemble: {
        lstm: { confidence: 0.76, signal: 'BUY' },
        transformer: { confidence: 0.72, signal: 'BUY' },
        consensus: { confidence: 0.74, signal: 'BUY' }
      },
      next_price_prediction: {
        symbol: 'BTC/USDT',
        predicted_price: 44200,
        confidence_interval: [43800, 44600],
        probability_up: 0.68,
        probability_down: 0.32
      },
      feature_importance: {
        rsi: 0.18,
        macd: 0.15,
        volume: 0.12,
        volatility: 0.10
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gateway/price/:base/:quote - Price endpoint (base route for multiple pairs)
router.get('/gateway/price/:base/:quote', (req: Request, res: Response) => {
  const { base, quote } = req.params;
  try {
    res.json({
      symbol: `${base}/${quote}`,
      price: 43500,
      bid: 43490,
      ask: 43510,
      volume_24h: 28500000000,
      change_24h_percent: 2.15,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders - Current open orders
router.get('/orders', (req: Request, res: Response) => {
  try {
    res.json({
      open_orders: [
        {
          id: 'order-001',
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 42800,
          quantity: 0.1,
          status: 'pending',
          created_at: new Date().toISOString()
        },
        {
          id: 'order-002',
          symbol: 'ETH/USDT',
          side: 'sell',
          price: 2350,
          quantity: 2,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ],
      total_orders: 2,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
