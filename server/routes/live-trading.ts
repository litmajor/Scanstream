
import { Router } from 'express';
import type { Request, Response } from 'express';
import { liveTradingEngine } from '../live-trading-engine';
import { requireTradingOperator } from '../middleware/require-trading-operator';
import { systemKillSwitch } from '../services/system-kill-switch';
import { liveCircuitBreaker } from '../services/live-circuit-breaker';
import { auditOperatorAction } from '../middleware/audit-operator-action';
import { safetyEventLog } from '../services/observability/safety-event-log';
import { respondToInvalidRouteParam, routeParam } from '../utils/route-params';

const router = Router();

/** State snapshot recorded before and after each operator action. */
function engineSnapshot() {
  const status = liveTradingEngine.getStatus();
  return {
    isRunning: status.isRunning,
    config: status.config,
    openPositions: status.positions.length,
    totalExposure: status.totalExposure,
    killSwitch: systemKillSwitch.getState(),
    circuitBreaker: liveCircuitBreaker.getState(),
  };
}

const audit = (
  action: Parameters<typeof auditOperatorAction>[0],
  target?: (req: Request) => string | undefined
) => auditOperatorAction(action, { snapshot: engineSnapshot, target });

/**
 * GET /api/live-trading/status
 * Get current live trading status
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = liveTradingEngine.getStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/start
 * Start live trading engine (TESTNET ONLY by default)
 */
router.post('/start', requireTradingOperator, audit('start'), async (_req: Request, res: Response) => {
  try {
    await liveTradingEngine.start();
    res.json({ 
      success: true, 
      message: 'Live trading engine started',
      warning: 'Running in TESTNET mode. Switch to live at your own risk.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/stop
 * Stop live trading engine
 */
router.post('/stop', requireTradingOperator, audit('stop'), (_req: Request, res: Response) => {
  try {
    liveTradingEngine.stop();
    res.json({ success: true, message: 'Live trading engine stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/config
 * Update configuration (DANGEROUS - requires validation)
 */
router.post('/config', requireTradingOperator, audit('config', (req) => Object.keys(req.body ?? {}).join(',')), (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // Safety check: prevent disabling testMode without explicit confirmation
    if (updates.testMode === false && !req.body.confirmLiveTrading) {
      return res.status(400).json({
        success: false,
        error: 'Live trading requires explicit confirmation. Set confirmLiveTrading: true'
      });
    }

    // Config must never be able to widen a hard limit past the configured
    // ceiling, and numeric fields must be sane.
    const numericFields = ['maxPositionSize', 'maxTotalExposure', 'defaultLeverage', 'slippageTolerance', 'minConfidence'] as const;
    for (const field of numericFields) {
      if (updates[field] === undefined) continue;
      const value = Number(updates[field]);
      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ success: false, error: `Invalid ${field}: must be a positive number` });
      }
      updates[field] = value;
    }
    if (updates.minConfidence !== undefined && updates.minConfidence > 1) {
      return res.status(400).json({ success: false, error: 'Invalid minConfidence: must be <= 1' });
    }

    liveTradingEngine.updateConfig(updates);
    res.json({ success: true, config: liveTradingEngine.getStatus().config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(
  '/realized-pnl/:entryId/resolve',
  requireTradingOperator,
  audit('resolve_realized_pnl', (req) => String(req.params.entryId)),
  (req: Request, res: Response) => {
    const entryId = String(req.params.entryId || '');
    const body = req.body ?? {};
    if (!entryId || entryId === '*' || entryId.includes('*')) {
      return res.status(400).json({ success: false, error: 'A specific realized PnL entry ID is required' });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return res.status(400).json({ success: false, error: 'Resolution reason is required' });

    let resolution:
      | { kind: 'attested_value'; pnl: number; reason: string }
      | { kind: 'excluded_unknown'; reason: string };
    if (body.resolution === 'attested_value') {
      const pnl = Number(body.pnl);
      if (!Number.isFinite(pnl)) {
        return res.status(400).json({ success: false, error: 'A finite pnl attestation is required' });
      }
      resolution = { kind: 'attested_value', pnl, reason };
    } else if (body.resolution === 'excluded_unknown') {
      if (body.pnl !== undefined) {
        return res.status(400).json({ success: false, error: 'excluded_unknown cannot include pnl' });
      }
      resolution = { kind: 'excluded_unknown', reason };
    } else {
      return res.status(400).json({
        success: false,
        error: 'resolution must be attested_value or excluded_unknown',
      });
    }

    try {
      const entry = liveTradingEngine.resolveRealizedPnlEntry(entryId, resolution);
      return res.json({ success: true, entry });
    } catch (error: any) {
      const message = error?.message ? String(error.message) : 'Unable to resolve realized PnL entry';
      const status = message.includes('not found') ? 404 : 409;
      return res.status(status).json({ success: false, error: message });
    }
  }
);

router.post(
  '/funding/attest',
  requireTradingOperator,
  audit('resolve_funding_baseline', (req) => String(req.body?.symbol ?? '')),
  (req: Request, res: Response) => {
    const body = req.body ?? {};
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!symbol || symbol === '*' || symbol.includes('*')) {
      return res.status(400).json({ success: false, error: 'A specific funding symbol is required' });
    }
    if (!reason) return res.status(400).json({ success: false, error: 'Baseline reason is required' });
    try {
      liveTradingEngine.resolveFundingBaseline(symbol, reason);
      return res.json({ success: true, symbol });
    } catch (error: any) {
      const message = error?.message ? String(error.message) : 'Unable to attest funding baseline';
      return res.status(409).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/live-trading/positions
 * Get open positions
 */
router.get('/positions', (_req: Request, res: Response) => {
  try {
    const status = liveTradingEngine.getStatus();
    res.json({ success: true, positions: status.positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/close/:positionId
 * Close a specific position
 */
router.post('/close/:positionId', requireTradingOperator, audit('close', (req) => String(req.params.positionId)), async (req: Request, res: Response) => {
  try {
    const positionId = routeParam(req.params.positionId, 'positionId');
    const success = await liveTradingEngine.closePosition(positionId);
    
    if (success) {
      res.json({ success: true, message: 'Position closed' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to close position' });
    }
  } catch (error: any) {
    if (respondToInvalidRouteParam(error, res)) return;
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/execute
 * Execute a signal (CAUTION: Real money in live mode)
 */
router.post('/execute', requireTradingOperator, audit('execute', (req) => (typeof req.body?.symbol === 'string' ? req.body.symbol : undefined)), async (req: Request, res: Response) => {
  try {
    const signal = req.body;

    if (!signal || typeof signal !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid signal format' });
    }

    const symbol = typeof signal.symbol === 'string' ? signal.symbol.trim() : '';
    const type = typeof signal.type === 'string' ? signal.type.toUpperCase() : '';
    const price = Number(signal.price);
    const confidence = signal.confidence === undefined ? undefined : Number(signal.confidence);

    if (!symbol || !/^[A-Z0-9]+([\/:\-][A-Z0-9]+)*$/i.test(symbol)) {
      return res.status(400).json({ success: false, error: 'Invalid symbol' });
    }
    if (type !== 'BUY' && type !== 'SELL') {
      return res.status(400).json({ success: false, error: 'Invalid type: expected BUY or SELL' });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid price: must be a positive finite number' });
    }
    if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      return res.status(400).json({ success: false, error: 'Invalid confidence: must be within [0, 1]' });
    }

    signal.symbol = symbol;
    signal.type = type;
    signal.price = price;

    const order = await liveTradingEngine.executeSignal(signal);
    
    if (order) {
      res.json({ success: true, order });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Order not placed (check logs for details)' 
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/flatten-all
 * Emergency flatten: close every open position and halt new placements.
 */
router.post('/flatten-all', requireTradingOperator, audit('flatten_all'), async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 120) : 'manual';
    const result = await liveTradingEngine.flattenAll(reason);
    // Partial success is still a failure from an operator's point of view.
    res.status(result.failed.length > 0 ? 207 : 200).json({ success: result.failed.length === 0, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/live-trading/safety
 * Current state of the global safety controls.
 */
router.get('/safety', (_req: Request, res: Response) => {
  res.json({
    success: true,
    killSwitch: systemKillSwitch.getState(),
    circuitBreaker: liveCircuitBreaker.getState(),
    engine: liveTradingEngine.getStatus().config,
    reconciliation: liveTradingEngine.getReconciliation(),
  });
});

/**
 * GET /api/live-trading/safety-events
 * Durable safety + operator audit trail, including events written before the
 * last restart. Operator-only: it describes control actions and positions.
 */
router.get('/safety-events', requireTradingOperator, (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  res.json({
    success: true,
    writeFailures: safetyEventLog.getWriteFailures(),
    events: safetyEventLog.readPersisted(limit),
    inProcess: safetyEventLog.tail(limit),
  });
});

export default router;
