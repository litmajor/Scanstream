import type { Candle } from '../../types/market-data';
import type { CrossExchangeAggregator } from './cross-exchange-aggregator';

export interface SyntheticCandle extends Candle {
  confidence: number; // 0..100
  synthetic: true;
}

/**
 * HealingService
 * - forwardFill(symbol, fromAggregator)
 * - interpolate(symbol, n)
 * Returns synthetic candles with confidence scores.
 */
export class HealingService {
  constructor() {}

  forwardFill(symbol: string, aggregator: CrossExchangeAggregator): SyntheticCandle | null {
    // Use the most recent per-exchange candle to construct a forward-filled candle
    const per = aggregator.getPerExchange(symbol);
    const entries = Object.entries(per || {});
    if (entries.length === 0) return null;

    // Pick the freshest candle
    let freshest: Candle | undefined;
    for (const [, c] of entries) {
      if (!c) continue;
      if (!freshest || (c.ts && c.ts > (freshest.ts || 0))) freshest = c as Candle;
    }
    if (!freshest) return null;

    const synthetic: SyntheticCandle = {
      ts: (freshest.ts || Date.now()) + 60_000,
      open: freshest.close,
      high: freshest.close,
      low: freshest.close,
      close: freshest.close,
      volume: 0,
      isFinal: false,
      source: 'healing',
      raw: {},
      confidence: 50,
      synthetic: true,
    } as any;

    return synthetic;
  }

  interpolate(symbol: string, aggregator: CrossExchangeAggregator, n = 3): SyntheticCandle[] {
    // Very simple interpolation using last n candles across exchanges
    const per = aggregator.getPerExchange(symbol);
    const entries = Object.values(per || {}).filter(Boolean) as Candle[];
    if (entries.length === 0) return [];

    // average close price and step forward in time
    const avgClose = Math.round((entries.reduce((s, c) => s + (c.close || 0), 0) / entries.length) * 100) / 100;
    const baseTs = Math.max(...entries.map(e => e.ts || 0));
    const out: SyntheticCandle[] = [];
    for (let i = 1; i <= n; i++) {
      out.push({
        ts: baseTs + i * 60_000,
        open: avgClose,
        high: avgClose,
        low: avgClose,
        close: avgClose,
        volume: 0,
        isFinal: false,
        source: 'healing',
        raw: {},
        confidence: Math.max(20, 70 - i * 10),
        synthetic: true,
      } as any);
    }

    return out;
  }

  /**
   * Cross-market filling: uses all available per-exchange candles to create
   * a higher-confidence synthetic candle when some exchanges are missing data.
   * Confidence is driven by number of agreeing sources, freshness, and spread.
   */
  crossMarketFill(symbol: string, aggregator: CrossExchangeAggregator): SyntheticCandle | null {
    const per = aggregator.getPerExchange(symbol);
    const entries = Object.entries(per || {}).filter(([, v]) => !!v) as [string, Candle][];
    if (entries.length === 0) return null;

    // compute median close and a spread metric
    const closes = entries.map(([, c]) => c.close).sort((a, b) => a - b);
    const median = closes[Math.floor(closes.length / 2)];

    // freshness: fraction of sources with ts within freshness window
    const now = Date.now();
    const freshnessWindow = 90_000; // 90s
    let freshCount = 0;
    for (const [, c] of entries) if (now - (c.ts || 0) < freshnessWindow) freshCount++;

    // spread across sources
    const spread = (closes.length > 0) ? (Math.max(...closes) - Math.min(...closes)) : 0;

    // confidence heuristic: base on number of sources, freshness ratio and inverse spread
    const sourceFactor = Math.min(1, entries.length / 5); // 5+ sources => full
    const freshnessFactor = freshCount / Math.max(1, entries.length);
    const spreadFactor = spread > 0 ? Math.max(0, 1 - spread / Math.max(1, Math.abs(median))) : 1;
    const confidence = Math.round(100 * sourceFactor * freshnessFactor * spreadFactor);

    const ts = Math.max(...entries.map(([, c]) => c.ts || 0));

    const synthetic: SyntheticCandle = {
      ts: (ts || Date.now()) + 60_000,
      open: median,
      high: median,
      low: median,
      close: median,
      volume: entries.reduce((s, [, c]) => s + (c.volume || 0), 0) / entries.length,
      isFinal: false,
      source: 'healing:cross-market',
      raw: { sources: entries.map(([s]) => s) },
      confidence: Math.min(100, Math.max(0, confidence)),
      synthetic: true,
    } as any;

    return synthetic;
  }
}

export default HealingService;

