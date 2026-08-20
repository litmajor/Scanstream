import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Router } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { requireAuth, type AuthRequest } from '../../middleware/auth';

const queryMock = vi.hoisted(() => vi.fn());
const validationMock = vi.hoisted(() => vi.fn());
const marketDataMock = vi.hoisted(() => vi.fn());
const searchCoinsMock = vi.hoisted(() => vi.fn());
const coinDetailsMock = vi.hoisted(() => vi.fn());
const exchangeCreateMock = vi.hoisted(() => vi.fn());

vi.mock('../../db-storage', () => ({ db: { query: queryMock } }));
vi.mock('../../services/physics-validation', () => ({
  runPhysicsValidation: validationMock,
}));
vi.mock('../../services/coingecko', () => ({
  coinGeckoService: {
    getMarketData: marketDataMock,
    searchCoins: searchCoinsMock,
    getCoinDetails: coinDetailsMock,
  },
}));
vi.mock('../../trading-engine', () => ({
  ExchangeDataFeed: { create: exchangeCreateMock },
}));

import scoutReportRouter from '../scout-report-routes';
import phase5Router from '../phase5-api';
import multiTimeframeRouter from '../multi-timeframe-analysis';
import symbolsRouter from '../symbols';
import physicsValidationRouter from '../physics-validation';
import learningMetricsRouter from '../learning-metrics';

type Json = Record<string, unknown> | unknown[];

async function startRouter(router: Router, mountPath = '/'): Promise<{
  server: Server;
  base: string;
}> {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => resolve());
    (app as express.Express & { routeTestServer?: Server }).routeTestServer = server;
  });
  const server = (app as express.Express & { routeTestServer?: Server }).routeTestServer as Server;
  return {
    server,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}${mountPath}`,
  };
}

async function request(
  base: string,
  route: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() as Json };
}

function record(body: Json): Record<string, unknown> {
  return body as Record<string, unknown>;
}

const opportunity = {
  id: 'opp-1',
  type: 'SCALP',
  direction: 'BULLISH',
  confidence: 0.8,
  riskRewardRatio: 2,
  stopLoss: 95,
  targets: [105],
};

const scoutReport = {
  symbol: 'BTC/USDT',
  timestamp: Date.now(),
  generatedIn: 12,
  executiveSummary: {
    direction: 'BULLISH',
    confidence: 0.8,
    strength: 80,
    recommendation: 'BUY',
  },
  opportunities: [opportunity],
  alternatives: [],
  consensus: { direction: 'BULLISH', confidence: 0.8, strength: 80 },
  insights: [],
  sourcesAnalysis: {
    ml: {},
    scanner: {},
    agents: {},
    priceAction: {},
  },
  riskAssessment: { overallRiskScore: 3, riskLevel: 'LOW' },
};

describe('Pass 5 batch 1 read-mostly routes', () => {
  describe('scout report routes', () => {
    let server: Server;
    let base: string;
    const generateScoutReport = vi.fn();
    const service = {
      generateScoutReport,
      mapDirectionToClient: (direction: string) =>
        direction === 'BULLISH' ? 'BUY' : direction === 'BEARISH' ? 'SELL' : 'HOLD',
    };

    beforeAll(async () => {
      Reflect.set(globalThis, 'scoutReportService', service);
      const started = await startRouter(scoutReportRouter, '/api/scout');
      server = started.server;
      base = started.base;
    });

    beforeEach(() => {
      generateScoutReport.mockResolvedValue(scoutReport);
    });

    afterAll(async () => {
      Reflect.deleteProperty(globalThis, 'scoutReportService');
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('serves the success contract for all fourteen read-only routes', async () => {
      const routes = [
        '/list',
        '/BTC%2FUSDT',
        '/BTC%2FUSDT/executive',
        '/BTC%2FUSDT/sources',
        '/BTC%2FUSDT/opportunities',
        '/BTC%2FUSDT/scalp',
        '/BTC%2FUSDT/day',
        '/BTC%2FUSDT/swing',
        '/BTC%2FUSDT/consensus',
        '/BTC%2FUSDT/risk-assessment',
        '/multi?symbols=BTC%2FUSDT,ETH%2FUSDT',
        '/compare?symbol1=BTC%2FUSDT&symbol2=ETH%2FUSDT',
        '/best',
        '/watch-list?userId=test-user',
      ];

      for (const route of routes) {
        const response = await request(base, route);
        expect(response.status, route).toBe(200);
        expect(response.body).toBeDefined();
      }
    });

    it('rejects invalid required queries and bounds multi-symbol work', async () => {
      const missingMulti = await request(base, '/multi');
      const missingCompare = await request(base, '/compare');
      const missingWatchList = await request(base, '/watch-list');
      const tooMany = await request(
        base,
        `/multi?symbols=${Array.from({ length: 21 }, (_, i) => `S${i}`).join(',')}`,
      );

      for (const response of [missingMulti, missingCompare, missingWatchList, tooMany]) {
        expect(response.status).toBe(400);
        expect(record(response.body).success).toBe(false);
      }
    });

    it('turns report-service failures into handled responses', async () => {
      generateScoutReport.mockRejectedValue(new Error('scout service unavailable'));
      const routes = [
        '/BTC%2FUSDT',
        '/BTC%2FUSDT/executive',
        '/BTC%2FUSDT/sources',
        '/BTC%2FUSDT/opportunities',
        '/BTC%2FUSDT/scalp',
        '/BTC%2FUSDT/day',
        '/BTC%2FUSDT/swing',
        '/BTC%2FUSDT/consensus',
        '/BTC%2FUSDT/risk-assessment',
        '/multi?symbols=BTC%2FUSDT',
        '/compare?symbol1=BTC%2FUSDT&symbol2=ETH%2FUSDT',
        '/best',
        '/watch-list?userId=test-user',
      ];

      for (const route of routes) {
        const response = await request(base, route);
        expect(response.status, route).toBe(500);
        expect(record(response.body).error).toEqual(expect.any(String));
      }
    });
  });

  describe('phase 5 routes', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const started = await startRouter(phase5Router, '/api/phase5');
      server = started.server;
      base = started.base;
    });

    beforeEach(() => {
      queryMock.mockImplementation(async (query: string) => {
        if (query.includes('FROM signals')) {
          return { rows: [{
            scanner_score: 0.7,
            scanner_reasoning: 'fixture',
            ml_score: 0.6,
            ml_reasoning: 'fixture',
            rl_score: 0.5,
            rl_reasoning: 'fixture',
            rpg_score: 0.4,
            rpg_reasoning: 'fixture',
            composite_quality: 0.65,
            confidence_level: 0.75,
            timestamp: new Date().toISOString(),
            signal_source_metrics: {},
          }] };
        }
        if (query.includes('FROM agent_performance')) return { rows: [] };
        if (query.includes('FROM market_regime')) {
          return { rows: [{
            current_regime: 'TRENDING',
            regime_confidence: 0.8,
            scanner_weight: 0.25,
            ml_weight: 0.25,
            rl_weight: 0.25,
            rpg_weight: 0.25,
            volatility_level: 0.2,
            trend_strength: 0.7,
            timestamp: new Date().toISOString(),
          }] };
        }
        if (query.includes('FROM regime_transitions')) return { rows: [] };
        if (query.includes('FROM signal_history')) {
          if (query.includes('COUNT(*)')) {
            return { rows: [{
              total_signals: '1',
              closed_signals: '1',
              winning_signals: '1',
              avg_pnl: '2',
              accurate_predictions: '1',
              avg_quality: '70',
              avg_confidence: '80',
            }] };
          }
          return { rows: [] };
        }
        return { rows: [] };
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('serves all eight read-only contracts', async () => {
      const routes = [
        '/signal-transparency',
        '/agent-leaderboard',
        '/signal-history',
        '/signal-history/stats',
        '/regime',
        '/regime/history',
        '/quality-accuracy-correlation',
        '/confidence-pnl-correlation',
      ];

      for (const route of routes) {
        const response = await request(base, route);
        expect(response.status, route).toBe(200);
        expect(response.body).toBeDefined();
      }
    });

    it('bounds history queries and handles database failures', async () => {
      expect((await request(base, '/signal-history?limit=1001')).status).toBe(400);
      expect((await request(base, '/regime/history?hours=721')).status).toBe(400);

      queryMock.mockRejectedValue(new Error('database unavailable'));
      for (const route of [
        '/signal-transparency',
        '/agent-leaderboard',
        '/signal-history',
        '/signal-history/stats',
        '/regime',
        '/regime/history',
        '/quality-accuracy-correlation',
        '/confidence-pnl-correlation',
      ]) {
        const response = await request(base, route);
        expect(response.status, route).toBe(500);
        expect(record(response.body).error).toBe('Internal server error');
      }
    });
  });

  describe('multi-timeframe analysis route', () => {
    let server: Server;
    let base: string;
    let fetchMarketData: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
      const frames = Array.from({ length: 50 }, (_, index) => ({
        price: { close: 100 + index },
        volume: 1000 + index,
      }));
      fetchMarketData = vi.fn().mockResolvedValue(frames);
      exchangeCreateMock.mockResolvedValue({
        fetchMarketData,
      });
      const started = await startRouter(multiTimeframeRouter, '/api/analysis/multi-timeframe');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('returns bounded multi-timeframe analysis and validates symbol input', async () => {
      const response = await request(base, '/?symbol=BTC%2FUSDT');
      expect(response.status).toBe(200);
      expect(record(response.body)).toEqual(expect.objectContaining({
        success: true,
        symbol: 'BTC/USDT',
        multiTimeframeAnalysis: expect.any(Object),
      }));
      expect((await request(base, '/?symbol=')).status).toBe(400);
    });

    it('handles exchange-feed failures without hanging', async () => {
      fetchMarketData.mockRejectedValue(new Error('feed unavailable'));
      const response = await request(base, '/?symbol=BTC%2FUSDT');
      expect(response.status).toBe(200);
      const analysis = record(record(response.body).multiTimeframeAnalysis);
      expect(analysis.timeframeAnalysis).toEqual([]);
      expect(record(response.body).summary).toEqual(expect.objectContaining({
        timeframesAnalyzed: 0,
      }));
    });
  });

  describe('symbols routes', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      marketDataMock.mockResolvedValue([{
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 100,
        price_change_percentage_24h: 1,
        total_volume: 1000,
        market_cap: 10000,
      }]);
      searchCoinsMock.mockResolvedValue({ coins: [{ id: 'bitcoin' }] });
      coinDetailsMock.mockResolvedValue({
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          current_price: { usd: 100 },
          price_change_percentage_24h: 1,
          total_volume: { usd: 1000 },
          market_cap: { usd: 10000 },
        },
        tickers: [],
        links: { homepage: ['https://bitcoin.org'] },
      });
      const started = await startRouter(symbolsRouter, '/api/symbols');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('serves both symbol contracts with bounded pagination', async () => {
      const list = await request(base, '/?limit=1000');
      const detail = await request(base, '/BTC');
      expect(list.status).toBe(200);
      expect(record(list.body)).toEqual(expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        limit: 100,
      }));
      expect(detail.status).toBe(200);
      expect(record(detail.body)).toEqual(expect.objectContaining({
        id: 'bitcoin',
        symbol: 'BTC',
      }));
    });

    it('handles market-data and missing-symbol failures', async () => {
      marketDataMock.mockRejectedValue(new Error('market data unavailable'));
      expect((await request(base, '/')).status).toBe(200);
      searchCoinsMock.mockResolvedValue({ coins: [] });
      expect((await request(base, '/UNKNOWN')).status).toBe(404);
    });
  });

  describe('physics validation routes', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        if (req.headers['x-test-user']) {
          (req as AuthRequest).user = { id: 'operator', email: 'operator@example.test' };
        }
        next();
      });
      app.use(physicsValidationRouter);
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    beforeEach(() => {
      validationMock.mockResolvedValue({ testsPassed: true, metrics: {} });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('keeps status read-only and protects bounded validation work', async () => {
      const status = await request(base, '/validate-status');
      const denied = await request(base, '/validate', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC/USDT' }),
      });
      const accepted = await request(base, '/validate', {
        method: 'POST',
        headers: { 'x-test-user': 'operator' },
        body: JSON.stringify({ symbol: 'BTC/USDT' }),
      });
      const invalid = await request(base, '/validate', {
        method: 'POST',
        headers: { 'x-test-user': 'operator' },
        body: JSON.stringify({ symbol: 'x'.repeat(33) }),
      });

      expect(status.status).toBe(200);
      expect(record(status.body).status).toBe('ready');
      expect(denied.status).toBe(401);
      expect(accepted.status).toBe(200);
      expect(record(accepted.body).success).toBe(true);
      expect(invalid.status).toBe(400);
    });

    it('handles validation-service failure', async () => {
      validationMock.mockRejectedValue(new Error('validation unavailable'));
      const response = await request(base, '/validate', {
        method: 'POST',
        headers: { 'x-test-user': 'operator' },
        body: JSON.stringify({ symbol: 'BTC/USDT' }),
      });
      expect(response.status).toBe(500);
      expect(record(response.body).error).toBe('validation unavailable');
    });
  });

  describe('learning metrics routes', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        if (req.headers['x-test-user']) {
          (req as AuthRequest).user = { id: 'learner', email: 'learner@example.test' };
        }
        next();
      });
      app.use(learningMetricsRouter);
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('serves all eight learning contracts', async () => {
      const trade = await request(base, '/api/learning/trade-outcome', {
        method: 'POST',
        headers: { 'x-test-user': 'learner' },
        body: JSON.stringify({
          strategy_id: 'fixture',
          entry_price: 100,
          exit_price: 105,
          direction: 'LONG',
        }),
      });
      const responses = await Promise.all([
        request(base, '/api/learning/metrics'),
        request(base, '/api/learning/strategy/fixture'),
        request(base, '/api/learning/history?limit=10'),
        request(base, '/api/learning/weight-evolution/fixture'),
        request(base, '/api/learning/regime-analysis'),
        request(base, '/api/learning/reset', {
          method: 'POST',
          headers: { 'x-test-user': 'learner' },
          body: '{}',
        }),
        request(base, '/api/learning/update-metrics', {
          method: 'POST',
          headers: { 'x-test-user': 'learner' },
          body: JSON.stringify({ market_regime: 'NEUTRAL' }),
        }),
      ]);

      expect(trade.status).toBe(200);
      for (const response of responses) expect(response.status).toBe(200);
      expect(record(trade.body).success).toBe(true);
      expect(record(responses[0].body).success).toBe(true);
      expect(record(responses[1].body).success).toBe(true);
    });

    it('rejects unauthenticated mutations and invalid trade outcomes', async () => {
      for (const route of [
        '/api/learning/trade-outcome',
        '/api/learning/reset',
        '/api/learning/update-metrics',
      ]) {
        const response = await request(base, route, { method: 'POST', body: '{}' });
        expect(response.status, route).toBe(401);
      }

      const invalid = await request(base, '/api/learning/trade-outcome', {
        method: 'POST',
        headers: { 'x-test-user': 'learner' },
        body: JSON.stringify({
          strategy_id: 'fixture',
          entry_price: 0,
          exit_price: 105,
          direction: 'UNKNOWN',
        }),
      });
      expect(invalid.status).toBe(400);

      const historyBefore = await request(base, '/api/learning/history?limit=1000');
      const invalidHistoryInput = await request(base, '/api/learning/trade-outcome', {
        method: 'POST',
        headers: { 'x-test-user': 'learner' },
        body: JSON.stringify({
          strategy_id: 'fixture',
          entry_price: 100,
          exit_price: 105,
          direction: 'LONG',
          signal_confidence: 2,
          entry_quality: 0.5,
          entry_time: 'not-a-timestamp',
          exit_reason: { arbitrary: true },
        }),
      });
      expect(invalidHistoryInput.status).toBe(400);
      const historyAfter = await request(base, '/api/learning/history?limit=1000');
      expect(record(historyAfter.body).count).toBe(record(historyBefore.body).count);
    });

    it('rejects malformed metrics payloads before replacing shared state', async () => {
      const malformed = await request(base, '/api/learning/update-metrics', {
        method: 'POST',
        headers: { 'x-test-user': 'learner' },
        body: JSON.stringify({
          strategy_beliefs: { fixture: { confidence: 'not-a-number' } },
        }),
      });
      expect(malformed.status).toBe(400);
      expect(record(malformed.body).success).toBe(false);

      const metrics = await request(base, '/api/learning/metrics');
      expect(metrics.status).toBe(200);
      expect(record(record(metrics.body).metrics).market_regime).toBe('NEUTRAL');
    });
  });
});
