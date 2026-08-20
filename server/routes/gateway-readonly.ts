import express, { type Request, type Response } from 'express';
import { priceCache, type OHLCV, type TickerData } from '../../src/core/PriceCache';
import { signalPerformanceTracker } from '../services/signal-performance-tracker';

const TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '1d', '1w']);
const MAX_SYMBOL_LENGTH = 64;
const MAX_CANDLE_LIMIT = 500;
const MAX_PERFORMANCE_LIMIT = 100;

interface PerformanceTracker {
  getPerformanceStats: () => unknown;
  getRecentPerformance: (limit: number) => readonly unknown[];
}

interface ReadonlyDependencies {
  tickerCache: {
    get: (symbol: string) => TickerData | null;
    getCandles: (symbol: string, timeframe: string) => OHLCV[];
  };
  performanceTracker: PerformanceTracker;
}

const defaultDependencies: ReadonlyDependencies = {
  tickerCache: priceCache,
  performanceTracker: signalPerformanceTracker,
};

function parseSymbol(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let symbol: string;
  try {
    symbol = decodeURIComponent(raw).toUpperCase();
  } catch {
    return null;
  }

  if (
    symbol.length === 0
    || symbol.length > MAX_SYMBOL_LENGTH
    || !/^[A-Z0-9._-]+(?:\/[A-Z0-9._-]+)?$/.test(symbol)
  ) {
    return null;
  }
  return symbol;
}

function parseTimeframe(raw: unknown): string | null {
  if (typeof raw !== 'string' || !TIMEFRAMES.has(raw)) return null;
  return raw;
}

function parseBoundedInteger(raw: unknown, fallback: number, max: number): number | null {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) return null;
  return value;
}

function calculateRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const averageGain = gains / period;
  const averageLoss = losses / period;
  return 100 - (100 / (1 + (averageGain / (averageLoss || 1))));
}

function calculateEma(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  return closes.slice(1).reduce(
    (ema, close) => close * multiplier + ema * (1 - multiplier),
    closes[0],
  );
}

function calculateAtr(candles: OHLCV[], period = 14): number {
  if (candles.length < 2) return 0;
  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index][4];
    return Math.max(
      candle[2] - candle[3],
      Math.abs(candle[2] - previousClose),
      Math.abs(candle[3] - previousClose),
    );
  });
  const window = trueRanges.slice(-period);
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

function dataframeFor(
  symbol: string,
  timeframe: string,
  candles: OHLCV[],
  ticker: TickerData | null,
): Record<string, number | string> {
  const closes = candles.map((candle) => candle[4]).filter(Number.isFinite);
  const latestClose = closes.at(-1) ?? ticker?.price ?? 0;
  const previousClose = closes.at(-2) ?? latestClose;
  const priceChangePercent = previousClose > 0
    ? ((latestClose - previousClose) / previousClose) * 100
    : 0;
  const signal = priceChangePercent > 1 ? 'BUY' : priceChangePercent < -1 ? 'SELL' : 'HOLD';

  return {
    symbol,
    timeframe,
    signal,
    signalConfidence: Math.min(100, Math.abs(priceChangePercent) * 20),
    close: ticker?.price ?? latestClose,
    rsi: calculateRsi(closes),
    ema20: calculateEma(closes, 20),
    ema50: calculateEma(closes, 50),
    macd: calculateEma(closes, 12) - calculateEma(closes, 26),
    atr: calculateAtr(candles),
    trendDirection: priceChangePercent > 0 ? 'UPTREND' : priceChangePercent < 0 ? 'DOWNTREND' : 'NEUTRAL',
    volume: candles.at(-1)?.[5] ?? 0,
    volumeTrend: 'STABLE',
    priceChangePercent,
  };
}

function genericReadError(res: Response): void {
  if (!res.headersSent) res.status(500).json({ error: 'Gateway read failed' });
}

function createStatusHandler(dependencies: ReadonlyDependencies) {
  return (_req: Request, res: Response) => {
    try {
      const hasCachedPrice = dependencies.tickerCache.get('BTC/USDT') !== null;
      const timestamp = Date.now();
      return res.json({
        exchange: 'aggregated',
        status: hasCachedPrice ? 'online' : 'offline',
        last_update: timestamp,
        trading_pairs: 0,
        api_latency_ms: 0,
        isOperational: hasCachedPrice,
        latency: 0,
      });
    } catch {
      return genericReadError(res);
    }
  };
}

export function createGatewayStatusRouter(
  dependencies: ReadonlyDependencies = defaultDependencies,
) {
  const router = express.Router();
  router.get('/status', createStatusHandler(dependencies));
  return router;
}

export function createGatewayReadonlyRouter(
  dependencies: ReadonlyDependencies = defaultDependencies,
) {
  const router = express.Router();

  const getDataframe = (req: Request, res: Response, symbolOverride?: string) => {
    try {
      const symbol = parseSymbol(symbolOverride ?? req.params.symbol);
      const timeframe = parseTimeframe(req.query.timeframe ?? '1h');
      const limit = parseBoundedInteger(req.query.limit, 100, MAX_CANDLE_LIMIT);
      if (!symbol || !timeframe || limit === null) {
        return res.status(400).json({ error: 'Invalid symbol, timeframe, or limit' });
      }

      const candles = dependencies.tickerCache.getCandles(symbol, timeframe).slice(-limit);
      const ticker = dependencies.tickerCache.get(symbol);
      if (candles.length === 0 && !ticker) {
        return res.status(404).json({ error: 'Market data unavailable', symbol, timeframe });
      }

      return res.json({ dataframe: dataframeFor(symbol, timeframe, candles, ticker) });
    } catch {
      return genericReadError(res);
    }
  };

  router.get('/dataframe/:symbol', (req, res) => getDataframe(req, res));
  router.get('/dataframe/:base/:quote', (req, res) => {
    return getDataframe(req, res, `${req.params.base}/${req.params.quote}`);
  });

  const getPrice = (req: Request, res: Response, symbolOverride?: string) => {
    try {
      const symbol = parseSymbol(symbolOverride ?? req.params.symbol);
      if (!symbol) return res.status(400).json({ error: 'Invalid symbol' });
      const ticker = dependencies.tickerCache.get(symbol);
      if (!ticker) return res.status(404).json({ error: 'Price unavailable', symbol });

      const candles = dependencies.tickerCache.getCandles(symbol, '1h').slice(-2);
      const previousClose = candles.at(-2)?.[4] ?? ticker.price;
      const priceChange = ticker.price - previousClose;
      return res.json({
        ...ticker,
        priceChange,
        priceChangePercent: previousClose > 0 ? (priceChange / previousClose) * 100 : 0,
      });
    } catch {
      return genericReadError(res);
    }
  };

  router.get('/price/:symbol', (req, res) => getPrice(req, res));
  router.get('/price/:base/:quote', (req, res) => {
    return getPrice(req, res, `${req.params.base}/${req.params.quote}`);
  });

  router.get('/signals/performance/stats', (_req, res) => {
    try {
      return res.json(dependencies.performanceTracker.getPerformanceStats());
    } catch {
      return genericReadError(res);
    }
  });

  router.get('/signals/performance/recent', (req, res) => {
    try {
      const limit = parseBoundedInteger(req.query.limit, 20, MAX_PERFORMANCE_LIMIT);
      if (limit === null) return res.status(400).json({ error: 'Invalid limit' });
      return res.json(dependencies.performanceTracker.getRecentPerformance(limit));
    } catch {
      return genericReadError(res);
    }
  });

  return router;
}

export default createGatewayReadonlyRouter();
