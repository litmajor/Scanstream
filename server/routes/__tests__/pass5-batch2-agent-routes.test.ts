import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { AuthRequest } from '../../middleware/auth';
import { safetyEventLog } from '../../services/observability/safety-event-log';

const axiosGetMock = vi.hoisted(() => vi.fn());
const marketFramesMock = vi.hoisted(() => vi.fn());
const marketFramesForSymbolsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/rpg-agents/SpecializedExitAgents', () => {
  class ExitOrchestratorAgent {
    name = 'ExitMaster';
    level = 10;
    analyzeExit() { return { action: 'EXIT', reason: 'fixture exit' }; }
    updatePerformance() {}
    getStatus() { return { name: this.name, level: this.level }; }
  }
  class OppositionResistanceAgent {
    name = 'OppositionReader';
    level = 10;
    analyzeOpposition() { return { supportStrength: 0.2 }; }
    getStatus() { return { name: this.name, level: this.level }; }
  }
  class MicrostructureSpecialistAgent {
    name = 'MicrostructureMonitor';
    level = 10;
    analyzeMicrostructure() { return { exitUrgency: 'EXIT_URGENT' }; }
    getStatus() { return { name: this.name, level: this.level }; }
  }
  return { ExitOrchestratorAgent, OppositionResistanceAgent, MicrostructureSpecialistAgent };
});

  vi.mock('../../services/rpg-agents/VFMDPhysicsAgent', () => ({
  default: class VFMDPhysicsAgent {
    name = 'VFMD-Analyst';
    level = 10;
    skills = ['fixture'];
    getAnalysisForUI() {
      return {
        signal: 'BUY',
        entry_guidance: 'fixture',
        field_metrics: {},
        market_state: 'fixture',
        factors: [],
      };
    }
    generateSignal() {
      return {
        action: 'BUY',
        confidence: 0.8,
        entry: 100,
        target: 105,
        stop: 98,
      };
    }
  },
}));

vi.mock('../../services/rpg-agents/FlowPhysicsAgent', () => ({
  default: class FlowPhysicsAgent {
    name = 'Flow-Analyst';
    level = 10;
    skills = ['fixture'];
    analyze() {
      return {
        latestForce: 1,
        averageForce: 1,
        maxForce: 1,
        forceDirection: 0.8,
        pressure: 1,
        averagePressure: 1,
        pressureTrend: 'UP',
        turbulence: 0.1,
        turbulenceLevel: 'LOW',
        energyGradient: 0.2,
        energyTrend: 'UP',
        dominantDirection: 'UP',
      };
    }
    generateSignal() {
      return {
        action: 'BUY',
        confidence: 0.8,
        entry: 100,
        target: 105,
        stop: 98,
        reason: 'fixture',
      };
    }
  },
}));

vi.mock('../../storage', () => ({
  storage: {
    getMarketFrames: marketFramesMock,
    getMarketFramesForSymbols: marketFramesForSymbolsMock,
  },
}));

vi.mock('../../services/coingecko', () => ({
  coinGeckoService: {
    getMarketDataByIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/api-registry', () => ({
  apiRegistry: {
    registerEndpoint: vi.fn(),
  },
}));

vi.mock('axios', () => ({
  default: { get: axiosGetMock },
}));

import exitAgentsRouter from '../exit-agents';
import physicsAgentsRouter from '../physics-agents';
import agentInteractionsRouter, { getActivityLogSize } from '../agent-interactions';
import agentSignalInsightsRouter from '../agent-signal-insights';
import { ExitOrchestratorAgent } from '../../services/rpg-agents/SpecializedExitAgents';
import VFMDPhysicsAgent from '../../services/rpg-agents/VFMDPhysicsAgent';

const operatorToken = 'batch2-operator-token';

async function startRouter(router: express.Router, mountPath: string): Promise<{
  server: Server;
  base: string;
}> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-user']) {
      (req as AuthRequest).user = { id: 'batch2-user', email: 'batch2@example.test' };
    }
    next();
  });
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
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function withOperator(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-trading-operator-token': operatorToken,
    },
  };
}

function withUser(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-test-user': 'batch2-user',
    },
  };
}

const ticks = Array.from({ length: 100 }, (_, index) => ({
  timestamp: index,
  open: 100,
  high: 101,
  low: 99,
  close: 100 + index * 0.01,
  volume: 1000,
  bidVolume: 500,
  askVolume: 500,
}));

describe('Pass 5 batch 2 agent routes', () => {
  beforeAll(() => {
    process.env.TRADING_OPERATOR_TOKEN = operatorToken;
    axiosGetMock.mockRejectedValue(new Error('agent dependency unavailable'));
    marketFramesMock.mockResolvedValue([]);
    marketFramesForSymbolsMock.mockResolvedValue({});
  });

  beforeEach(() => {
    safetyEventLog.setFilePath(`/tmp/scanstream-batch2-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterAll(() => {
    delete process.env.TRADING_OPERATOR_TOKEN;
  });

  describe('exit agents', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const started = await startRouter(exitAgentsRouter, '/api/agents/exit');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('keeps status public and rejects each capital-adjacent mutation without operator auth', async () => {
      expect((await request(base, '/status')).status).toBe(200);
      const routes = [
        ['/orchestrator', { entryPrice: 100, currentPrice: 105, atr: 2 }],
        ['/opposition', { currentPrice: 100, supportLevels: [95], resistanceLevels: [105] }],
        ['/microstructure', { bidVolume: 100, askVolume: 100, spread: 0.1 }],
        ['/consensus', { tradeState: { entryPrice: 100, currentPrice: 105, atr: 2 } }],
        ['/coordinate', { positions: [{ symbol: 'BTC/USDT', profitPercent: -0.03 }] }],
        ['/outcome', { agentName: 'ExitOrchestrator' }],
      ] as const;

      for (const [route, body] of routes) {
        expect((await request(base, route, {
          method: 'POST',
          body: JSON.stringify(body),
        })).status, route).toBe(401);
      }
    });

    it('covers all six guarded mutations and records operator audits', async () => {
      const responses = await Promise.all([
        request(base, '/orchestrator', withOperator({
          method: 'POST',
          body: JSON.stringify({ entryPrice: 100, currentPrice: 105, atr: 2 }),
        })),
        request(base, '/opposition', withOperator({
          method: 'POST',
          body: JSON.stringify({ currentPrice: 100, supportLevels: [95], resistanceLevels: [105] }),
        })),
        request(base, '/microstructure', withOperator({
          method: 'POST',
          body: JSON.stringify({ bidVolume: 100, askVolume: 100, spread: 0.1 }),
        })),
        request(base, '/consensus', withOperator({
          method: 'POST',
          body: JSON.stringify({ tradeState: { entryPrice: 100, currentPrice: 105, atr: 2 } }),
        })),
        request(base, '/coordinate', withOperator({
          method: 'POST',
          body: JSON.stringify({ positions: [{ symbol: 'BTC/USDT', profitPercent: -0.03 }] }),
        })),
        request(base, '/outcome', withOperator({
          method: 'POST',
          body: JSON.stringify({ agentName: 'ExitOrchestrator', profit: 10 }),
        })),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
      const audits = safetyEventLog.tail().filter((event) => event.type === 'operator_action') as Array<Record<string, unknown>>;
      expect(audits).toHaveLength(6);
      expect(audits.every((event) => event.success === true)).toBe(true);
      expect(audits.every((event) => event.previousState !== undefined && event.resultingState !== undefined)).toBe(true);
    });

    it('rejects malformed exit inputs and handles an agent failure', async () => {
      const invalid = await request(base, '/coordinate', withOperator({
        method: 'POST',
        body: JSON.stringify({ positions: Array.from({ length: 101 }, () => ({ symbol: 'BTC/USDT', profitPercent: 0 })) }),
      }));
      expect(invalid.status).toBe(400);

      const failureSpy = vi.spyOn(ExitOrchestratorAgent.prototype, 'analyzeExit').mockImplementation(() => {
        throw new Error('exit agent unavailable');
      });
      const failed = await request(base, '/orchestrator', withOperator({
        method: 'POST',
        body: JSON.stringify({ entryPrice: 100, currentPrice: 105, atr: 2 }),
      }));
      expect(failed.status).toBe(500);
      expect(failed.body.error).toBe('exit agent unavailable');
      failureSpy.mockRestore();
    });
  });

  describe('physics agents', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const started = await startRouter(physicsAgentsRouter, '/api/agents/physics');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('covers public status/agent routes and authenticated bounded analysis routes', async () => {
      expect((await request(base, '/agents')).status).toBe(200);
      expect((await request(base, '/status')).status).toBe(200);

      for (const route of ['/vfmd-analyze', '/flow-analyze', '/compare']) {
        expect((await request(base, route, {
          method: 'POST',
          body: JSON.stringify({ data: ticks }),
        })).status, route).toBe(401);
      }

      const responses = await Promise.all(
        ['/vfmd-analyze', '/flow-analyze', '/compare'].map((route) =>
          request(base, route, withUser({
            method: 'POST',
            body: JSON.stringify({ data: ticks }),
          }))),
      );
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('rejects oversized analysis input and handles agent failures', async () => {
      const oversized = await request(base, '/flow-analyze', withUser({
        method: 'POST',
        body: JSON.stringify({ data: Array.from({ length: 501 }, () => ticks[0]) }),
      }));
      expect(oversized.status).toBe(400);

      const failureSpy = vi.spyOn(VFMDPhysicsAgent.prototype, 'getAnalysisForUI').mockImplementation(() => {
        throw new Error('physics agent unavailable');
      });
      const failed = await request(base, '/vfmd-analyze', withUser({
        method: 'POST',
        body: JSON.stringify({ data: ticks }),
      }));
      expect(failed.status).toBe(500);
      expect(failed.body.error).toBe('physics agent unavailable');
      failureSpy.mockRestore();
    });
  });

  describe('agent interactions', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const started = await startRouter(agentInteractionsRouter, '/api/agents/interactions');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('covers all read-only routes and authenticated mutations', async () => {
      for (const route of ['/consensus-history', '/interaction-flow', '/activity-log', '/agent-cards', '/interaction-graph']) {
        const response = await request(base, route);
        expect(response.status, route).toBe(200);
        expect(response.body.success).toBe(true);
      }

      for (const route of ['/record-vote', '/record-activity', '/agent-event']) {
        expect((await request(base, route, { method: 'POST', body: JSON.stringify({}) })).status).toBe(401);
      }

      const vote = await request(base, '/record-vote', withUser({
        method: 'POST',
        body: JSON.stringify({
          symbol: 'BTC/USDT',
          votes: [],
          consensus: 'HOLD',
          confidence: 0.5,
        }),
      }));
      const activity = await request(base, '/record-activity', withUser({
        method: 'POST',
        body: JSON.stringify({ type: 'trade', message: 'fixture activity' }),
      }));
      const event = await request(base, '/agent-event', withUser({
        method: 'POST',
        body: JSON.stringify({ agentName: 'fixture', eventType: 'trade', data: {} }),
      }));
      expect(vote.status).toBe(200);
      expect(activity.status).toBe(200);
      expect(event.status).toBe(200);
    });

    it('rejects malformed interaction mutations', async () => {
      const invalidVote = await request(base, '/record-vote', withUser({
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC/USDT', votes: [], consensus: 'INVALID', confidence: 2 }),
      }));
      const invalidActivity = await request(base, '/record-activity', withUser({
        method: 'POST',
        body: JSON.stringify({ type: 'trade' }),
      }));
      expect(invalidVote.status).toBe(400);
      expect(invalidActivity.status).toBe(400);
    });

    it('bounds activity history when recording votes repeatedly', async () => {
      for (let index = 0; index < 1005; index += 1) {
        const response = await request(base, '/record-vote', withUser({
          method: 'POST',
          body: JSON.stringify({
            symbol: `BTC/USDT-${index}`,
            votes: [],
            consensus: 'HOLD',
            confidence: 0.5,
          }),
        }));
        expect(response.status).toBe(200);
      }

      expect(getActivityLogSize()).toBeLessThanOrEqual(1000);
    });
  });

  describe('agent signal insights', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const started = await startRouter(agentSignalInsightsRouter, '/api/agents/signals');
      server = started.server;
      base = started.base;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('covers all five read-only routes with bounded fallback behavior', async () => {
      for (const route of [
        '/asset-insights',
        '/asset-insights/BTC',
        '/compare',
        '/divergence-alert',
        '/consensus-strength',
      ]) {
        const response = await request(base, route);
        expect(response.status, route).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('guards and validates the insight recording route', async () => {
      const denied = await request(base, '/record-insight', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC', insight: { agentName: 'fixture', signal: 'HOLD' } }),
      });
      expect(denied.status).toBe(401);

      const invalid = await request(base, '/record-insight', withUser({
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC', insight: {} }),
      }));
      expect(invalid.status).toBe(400);

      const accepted = await request(base, '/record-insight', withUser({
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC', insight: { agentName: 'fixture', signal: 'HOLD' } }),
      }));
      expect(accepted.status).toBe(200);
      expect(accepted.body.success).toBe(true);
    });
  });
});
