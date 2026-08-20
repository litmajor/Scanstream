import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import tradeExecutionRouter from '../trade-execution';
import { TradeExecutionManager } from '../../services/trade-execution-manager';
import { safetyEventLog } from '../../services/observability/safety-event-log';

let server: Server;
let base: string;

const token = 'route-test-operator-token';
const decision = {
  canOpenNewPosition: true,
  positionActions: [],
  positionSize: 500,
  overallStatus: 'HEALTHY',
  summary: 'fixture decision',
};

async function request(
  route: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() };
}

function withToken(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-trading-operator-token': token,
    },
  };
}

describe('trade execution routes', () => {
  beforeAll(async () => {
    process.env.TRADING_OPERATOR_TOKEN = token;
    const app = express();
    app.use(express.json());
    app.use('/api/execution', tradeExecutionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/execution`;
  });

  beforeEach(() => {
    const auditPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-execution-audit-')), 'events.jsonl');
    safetyEventLog.setFilePath(auditPath);
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    delete process.env.TRADING_OPERATOR_TOKEN;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('keeps the read-only status route available without operator authentication', async () => {
    const response = await request('/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metrics).toEqual(expect.objectContaining({
      portfolio: expect.any(Object),
      performance: expect.any(Object),
    }));
  });

  it('rejects every state-changing route without the operator token', async () => {
    const routes: Array<[string, object]> = [
      ['/decision', { signal: { symbol: 'BTC/USDT' } }],
      ['/record-outcome', { tradeId: 'trade-1', signal: { symbol: 'BTC/USDT' }, pnl: 1 }],
      ['/reset', { initialBalance: 100_000 }],
    ];

    for (const [route, body] of routes) {
      const response = await request(route, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(response.status, route).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    }
    expect(safetyEventLog.tail().filter((event) => event.type === 'operator_action')).toEqual([]);
  });

  it('audits successful decision, outcome, and reset actions', async () => {
    vi.spyOn(TradeExecutionManager.prototype, 'makeExecutionDecision').mockReturnValue(decision as any);
    const recordOutcome = vi.spyOn(TradeExecutionManager.prototype, 'recordTradeOutcome').mockImplementation(() => undefined);

    const decisionResponse = await request('/decision', withToken({
      method: 'POST',
      body: JSON.stringify({
        signal: { symbol: 'BTC/USDT', type: 'BUY' },
        portfolio: {},
      }),
    }));
    const outcomeResponse = await request('/record-outcome', withToken({
      method: 'POST',
      body: JSON.stringify({
        tradeId: 'trade-1',
        signal: { symbol: 'BTC/USDT', type: 'BUY' },
        pnl: 12.5,
        durationHours: 2,
      }),
    }));
    const resetResponse = await request('/reset', withToken({
      method: 'POST',
      body: JSON.stringify({ initialBalance: 50_000 }),
    }));

    expect(decisionResponse.status).toBe(200);
    expect(decisionResponse.body).toEqual(expect.objectContaining({ success: true, decision }));
    expect(outcomeResponse.status).toBe(200);
    expect(recordOutcome).toHaveBeenCalledWith('trade-1', expect.any(Object), 12.5, 2);
    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body).toEqual(expect.objectContaining({
      success: true,
      initialBalance: 50_000,
    }));

    const audits = safetyEventLog.tail().filter((event) => event.type === 'operator_action') as any[];
    expect(audits.map((event) => event.action)).toEqual([
      'execution_decision',
      'record_outcome',
      'reset_execution',
    ]);
    for (const audit of audits) {
      expect(audit.operator).toBe('shared-operator-token');
      expect(audit.success).toBe(true);
      expect(audit.previousState).toEqual(expect.any(Object));
      expect(audit.resultingState).toEqual(expect.any(Object));
    }
    expect(JSON.stringify(audits)).not.toContain(token);
  });

  it('returns handled errors when the decision service fails', async () => {
    vi.spyOn(TradeExecutionManager.prototype, 'makeExecutionDecision').mockImplementation(() => {
      throw new Error('decision service unavailable');
    });

    const response = await request('/decision', withToken({
      method: 'POST',
      body: JSON.stringify({
        signal: { symbol: 'BTC/USDT', type: 'BUY' },
        portfolio: {},
      }),
    }));

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('decision service unavailable');
    const audit = safetyEventLog.tail().find((event) => event.type === 'operator_action') as any;
    expect(audit).toEqual(expect.objectContaining({
      action: 'execution_decision',
      success: false,
    }));
  });

  it('returns a handled error when outcome recording fails', async () => {
    vi.spyOn(TradeExecutionManager.prototype, 'recordTradeOutcome').mockImplementation(() => {
      throw new Error('outcome service unavailable');
    });

    const response = await request('/record-outcome', withToken({
      method: 'POST',
      body: JSON.stringify({
        tradeId: 'trade-1',
        signal: { symbol: 'BTC/USDT', type: 'BUY' },
        pnl: 12.5,
      }),
    }));

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('outcome service unavailable');
    const audit = safetyEventLog.tail().find((event) => event.type === 'operator_action') as any;
    expect(audit).toEqual(expect.objectContaining({
      action: 'record_outcome',
      success: false,
    }));
  });

  it('validates malformed state-changing requests without invoking services', async () => {
    const decisionSpy = vi.spyOn(TradeExecutionManager.prototype, 'makeExecutionDecision');
    const response = await request('/record-outcome', withToken({
      method: 'POST',
      body: JSON.stringify({ tradeId: 'missing-pnl' }),
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('tradeId, signal, and pnl required');
    expect(decisionSpy).not.toHaveBeenCalled();
    const audit = safetyEventLog.tail().find((event) => event.type === 'operator_action') as any;
    expect(audit).toEqual(expect.objectContaining({
      action: 'record_outcome',
      success: false,
    }));
  });
});
