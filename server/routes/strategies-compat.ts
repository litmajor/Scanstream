import express, { type Request, type Response } from 'express';
import type { BacktestResult, Signal } from '@shared/schema';
import { storage } from '../storage';
import { requireAuth } from '../middleware/auth';
import {
  STRATEGIES,
  backtestStrategy,
  executeConsensus,
} from './strategies';
import {
  getEnabledStrategies,
  getPyramidStrategy,
  getTradeDurationPredictor,
} from '../services/strategy-registry';

const TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);
const CONSENSUS_TIMEFRAMES = new Set(['M15', 'H1', 'H4', 'D1']);
const MAX_SYMBOL_LENGTH = 64;
const MAX_SIGNAL_LIMIT = 100;
const MAX_RESULT_LIMIT = 100;
const MAX_BACKTEST_DAYS = 730;

type BacktestRunner = (
  strategyId: string,
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string,
  parameters: Record<string, unknown>,
) => Promise<unknown>;

type ConsensusRunner = (
  symbol: string,
  timeframes: string[],
  equity: number,
) => Promise<unknown>;

interface StrategyCompatDependencies {
  getSignals: (limit: number) => Promise<Signal[]>;
  getBacktestResults: (strategyId?: string) => Promise<BacktestResult[]>;
  runBacktest: BacktestRunner;
  runConsensus: ConsensusRunner;
  getEnabledStrategies: typeof getEnabledStrategies;
  getTradeDurationPredictor: typeof getTradeDurationPredictor;
  getPyramidStrategy: typeof getPyramidStrategy;
}

const defaultDependencies: StrategyCompatDependencies = {
  getSignals: (limit) => storage.getSignals(undefined, limit),
  getBacktestResults: (strategyId) => storage.getBacktestResults(strategyId),
  runBacktest: backtestStrategy,
  runConsensus: executeConsensus,
  getEnabledStrategies,
  getTradeDurationPredictor,
  getPyramidStrategy,
};

function parseSymbol(raw: unknown): string | null {
  if (
    typeof raw !== 'string'
    || raw.trim().length === 0
    || raw.length > MAX_SYMBOL_LENGTH
    || !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$/.test(raw.trim())
  ) {
    return null;
  }
  return raw.trim().toUpperCase();
}

function parseTimeframe(raw: unknown): string | null {
  return typeof raw === 'string' && TIMEFRAMES.has(raw) ? raw : null;
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseParameters(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw);
  if (entries.length > 10) return {};
  return Object.fromEntries(entries.slice(0, 10));
}

function parseFiniteNumber(raw: unknown, minimum: number, maximum: number): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < minimum || raw > maximum) {
    return null;
  }
  return raw;
}

function handledError(res: Response): void {
  if (!res.headersSent) res.status(500).json({ error: 'Strategy request failed' });
}

function signalResponse(signal: Signal) {
  return {
    symbol: signal.symbol,
    exchange: 'strategy',
    signal: signal.type,
    strength: signal.strength,
    confidence: signal.confidence,
    price: signal.price,
    change: 0,
    change24h: 0,
    timestamp: signal.timestamp.getTime(),
    source: 'strategy',
    strategyName: signal.legacyLabel || signal.regimeState || 'Unknown Strategy',
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    reasoning: Array.isArray(signal.reasoning) ? signal.reasoning : [],
    indicators: {},
  };
}

export function createStrategiesCompatRouter(
  dependencies: StrategyCompatDependencies = defaultDependencies,
) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json({
      success: true,
      strategies: STRATEGIES,
      total: STRATEGIES.length,
    });
  });

  router.get('/signals', async (_req, res) => {
    try {
      const signals = await dependencies.getSignals(MAX_SIGNAL_LIMIT);
      res.json({ success: true, signals: signals.slice(0, MAX_SIGNAL_LIMIT).map(signalResponse) });
    } catch {
      handledError(res);
    }
  });

  router.get('/backtest/results', async (req, res) => {
    try {
      const strategyId = req.query.strategyId;
      if (strategyId !== undefined && (typeof strategyId !== 'string' || strategyId.length > MAX_SYMBOL_LENGTH)) {
        return res.status(400).json({ error: 'Invalid strategyId' });
      }
      const results = await dependencies.getBacktestResults(strategyId as string | undefined);
      return res.json({
        results: results.slice(0, MAX_RESULT_LIMIT).map((result) => ({
          ...result,
          name: STRATEGIES.find((strategy) => strategy.id === result.strategyId)?.name || 'Unknown Strategy',
        })),
      });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  router.get('/feature-enabled', (_req, res) => {
    try {
      const strategies = dependencies.getEnabledStrategies();
      return res.json({
        timestamp: new Date().toISOString(),
        total_enabled: strategies.length,
        strategies,
        all_available: [
          {
            name: 'Trade Duration Predictor',
            endpoint: 'POST /api/strategies/predict-duration',
            flag: 'trade_duration_predictor',
          },
          {
            name: 'Pyramid Strategy',
            endpoint: 'POST /api/strategies/pyramid-decision',
            flag: 'pyramid_strategy',
          },
        ],
      });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  router.get('/compare-durations', (req, res) => {
    try {
      const predictor = dependencies.getTradeDurationPredictor();
      if (!predictor) return res.status(403).json({ error: 'Trade Duration Predictor feature is disabled' });
      const clusterStrength = req.query.cluster_strength === undefined
        ? 0.75
        : Number(req.query.cluster_strength);
      const momentumScore = req.query.momentum_score === undefined
        ? 0.5
        : Number(req.query.momentum_score);
      if (
        !Number.isFinite(clusterStrength) || clusterStrength < 0 || clusterStrength > 1
        || !Number.isFinite(momentumScore) || momentumScore < 0 || momentumScore > 1
      ) {
        return res.status(400).json({ error: 'Invalid comparison parameters' });
      }
      const trendFormation = req.query.trend_formation === 'true';
      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        input: {
          base_cluster_strength: clusterStrength,
          trend_formation: trendFormation,
          momentum_score: momentumScore,
        },
        scenarios: predictor.compareScenarios(clusterStrength, trendFormation, momentumScore),
      });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  router.get('/:id', (req, res, next) => {
    if (req.params.id === 'list' || req.params.id === 'weights') return next();
    const strategy = STRATEGIES.find((candidate) => candidate.id === req.params.id);
    if (!strategy) return res.status(404).json({ success: false, error: 'Strategy not found' });
    return res.json({ success: true, strategy });
  });

  router.post('/consensus', requireAuth, async (req, res) => {
    try {
      const symbol = parseSymbol(req.body?.symbol);
      const timeframes = req.body?.timeframes;
      const equity = parseFiniteNumber(req.body?.equity ?? 10000, 1, 1_000_000_000);
      if (
        !symbol
        || !Array.isArray(timeframes)
        || timeframes.length < 1
        || timeframes.length > 4
        || !timeframes.every((timeframe): timeframe is string => typeof timeframe === 'string' && CONSENSUS_TIMEFRAMES.has(timeframe))
        || equity === null
      ) {
        return res.status(400).json({ success: false, error: 'Invalid consensus parameters' });
      }
      const result = await dependencies.runConsensus(symbol, timeframes, equity);
      return res.json({ success: true, consensus: result });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  const runBoundedBacktest = async (req: Request, res: Response, strategyId: string) => {
    try {
      const strategy = STRATEGIES.find((candidate) => candidate.id === strategyId);
      const symbol = parseSymbol(req.body?.symbol);
      const timeframe = parseTimeframe(req.body?.timeframe);
      const start = parseDate(req.body?.startDate);
      const end = parseDate(req.body?.endDate);
      if (!strategy || !symbol || !timeframe || !start || !end || end < start) {
        return res.status(400).json({ success: false, error: 'Invalid backtest parameters' });
      }
      const days = (end.getTime() - start.getTime()) / 86_400_000;
      if (days > MAX_BACKTEST_DAYS) {
        return res.status(400).json({ success: false, error: 'Backtest range exceeds limit' });
      }
      const result = await dependencies.runBacktest(
        strategy.id,
        symbol,
        timeframe,
        start.toISOString(),
        end.toISOString(),
        parseParameters(req.body?.parameters),
      );
      return res.json({
        success: true,
        backtest: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol,
          timeframe,
          ...(result as Record<string, unknown>),
        },
      });
    } catch {
      handledError(res);
      return undefined;
    }
  };

  router.post('/backtest/run', requireAuth, (req, res) => {
    const strategyId = typeof req.body?.strategyId === 'string' ? req.body.strategyId : '';
    return runBoundedBacktest(req, res, strategyId);
  });
  router.post('/bounce/backtest', requireAuth, (req, res) => (
    runBoundedBacktest(req, res, 'enhanced_bounce')
  ));
  router.post('/:id/backtest', requireAuth, (req, res) => (
    runBoundedBacktest(
      req,
      res,
      typeof req.params.id === 'string' ? req.params.id : '',
    )
  ));

  router.post('/predict-duration', requireAuth, (req, res) => {
    try {
      const predictor = dependencies.getTradeDurationPredictor();
      if (!predictor) return res.status(403).json({ error: 'Trade Duration Predictor feature is disabled' });
      const clusterStrength = parseFiniteNumber(req.body?.cluster_strength, 0, 1);
      const momentumScore = parseFiniteNumber(req.body?.momentum_score ?? 0.5, 0, 1);
      const volatilityMultiplier = parseFiniteNumber(req.body?.volatility_multiplier ?? 1, 0, 10);
      if (clusterStrength === null || typeof req.body?.trend_formation !== 'boolean' || momentumScore === null || volatilityMultiplier === null) {
        return res.status(400).json({ error: 'Invalid duration parameters' });
      }
      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        prediction: predictor.predictDuration(
          clusterStrength,
          req.body.trend_formation,
          momentumScore,
          volatilityMultiplier,
        ),
      });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  router.post('/pyramid-decision', requireAuth, (req, res) => {
    try {
      const strategy = dependencies.getPyramidStrategy();
      if (!strategy) return res.status(403).json({ error: 'Pyramid Strategy feature is disabled' });
      const originalEntryPrice = parseFiniteNumber(req.body?.original_entry_price, 0, 1_000_000_000);
      const currentPrice = parseFiniteNumber(req.body?.current_price, 0, 1_000_000_000);
      const positionSize = parseFiniteNumber(req.body?.original_position_size, 0, 1_000_000_000);
      const clusterStrength = parseFiniteNumber(req.body?.cluster_strength, 0, 1);
      if (
        originalEntryPrice === null || currentPrice === null || positionSize === null
        || clusterStrength === null || typeof req.body?.trend_formation !== 'boolean'
      ) {
        return res.status(400).json({ error: 'Invalid pyramid parameters' });
      }
      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        decision: strategy.decidePyramid({
          original_entry_price: originalEntryPrice,
          current_price: currentPrice,
          original_position_size: positionSize,
          cluster_strength: clusterStrength,
          trend_formation: req.body.trend_formation,
        }),
      });
    } catch {
      handledError(res);
      return undefined;
    }
  });

  return router;
}

export default createStrategiesCompatRouter();
