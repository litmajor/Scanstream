import { useMemo, useEffect, useState } from 'react';

export type HookChartPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number | null;
  macd?: { line: number; signal: number; histogram: number } | null;
  ema?: number | null;
};

export type HookWorldTick = {
  // flexible shape - we'll map fields based on heuristics or explicit map
  timestamp?: number | string;
  ts?: number | string;
  time?: number | string;
  price?: number;
  p?: number;
  last?: number;
  size?: number;
  qty?: number;
  q?: number;
  volume?: number;
  symbol?: string;
  [k: string]: any;
};

type FieldMap = {
  tsKey?: string;
  priceKey?: string;
  sizeKey?: string;
};

type Options = {
  minTicks?: number; // minimum ticks required to use feed
  lookback?: number; // max candles to return
  rebucketIntervalMs?: number | null; // if set, will recompute periodically
  fieldMap?: FieldMap; // explicit mapping for custom feed fields
};

const defaultOptions: Options = {
  minTicks: 10,
  lookback: 200,
  rebucketIntervalMs: null,
  fieldMap: {},
};

function toNumberOrNull(v: any): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function useTickCandles(ticks: HookWorldTick[] | undefined, timeframe: string, options?: Options) {
  const opts = { ...defaultOptions, ...(options || {}) };
  const [tick, setTick] = useState(0); // used to trigger periodic rebuilds

  // optional periodic refresh (rebucketing) to handle streaming accumulation
  useEffect(() => {
    if (!opts.rebucketIntervalMs) return;
    const id = setInterval(() => setTick(t => t + 1), opts.rebucketIntervalMs);
    return () => clearInterval(id);
  }, [opts.rebucketIntervalMs]);

  const candles = useMemo<HookChartPoint[]>(() => {
    if (!Array.isArray(ticks) || ticks.length < (opts.minTicks || 1)) return [];

    // helper to pick field from tick using fieldMap or common keys
    const mapTick = (t: HookWorldTick) => {
      const fm = opts.fieldMap || {};
      const rawTs = fm.tsKey ? t[fm.tsKey] : (t.timestamp ?? t.ts ?? t.time);
      const rawPrice = fm.priceKey ? t[fm.priceKey] : (t.price ?? t.p ?? t.last);
      const rawSize = fm.sizeKey ? t[fm.sizeKey] : (t.size ?? t.qty ?? t.q ?? t.volume ?? 0);

      const ts = toNumberOrNull(rawTs);
      const price = toNumberOrNull(rawPrice);
      const size = toNumberOrNull(rawSize) ?? 0;

      return { ts, price, size };
    };

    const timeframeToMs = (tf: string) => {
      switch (tf) {
        case '1m': return 60 * 1000;
        case '5m': return 5 * 60 * 1000;
        case '1h': return 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        case '1w': return 7 * 24 * 60 * 60 * 1000;
        default: return 60 * 1000;
      }
    };

    const bucketMs = timeframeToMs(timeframe);

    const normalized: { timestamp: number; price: number; size: number }[] = [];
    for (const t of ticks) {
      const m = mapTick(t);
      if (m.price === null || m.ts === null) continue;
      let tsVal = m.ts as number;
      // if timestamp looks like seconds -> convert to ms
      if (tsVal < 1e12) tsVal = tsVal * 1000;
      normalized.push({ timestamp: tsVal, price: m.price as number, size: m.size as number });
    }

    if (normalized.length === 0) return [];

    // Group into buckets
    const buckets: Record<number, { open: number; high: number; low: number; close: number; volume: number; firstTs: number }> = {};
    for (const t of normalized) {
      const key = Math.floor(t.timestamp / bucketMs) * bucketMs;
      if (!buckets[key]) {
        buckets[key] = { open: t.price, high: t.price, low: t.price, close: t.price, volume: t.size || 0, firstTs: t.timestamp };
      } else {
        const b = buckets[key];
        b.high = Math.max(b.high, t.price);
        b.low = Math.min(b.low, t.price);
        b.close = t.price;
        b.volume += t.size || 0;
      }
    }

    const keys = Object.keys(buckets).map(k => parseInt(k, 10)).sort((a, b) => a - b);
    const results: HookChartPoint[] = keys.map(k => ({
      timestamp: k,
      open: buckets[k].open,
      high: buckets[k].high,
      low: buckets[k].low,
      close: buckets[k].close,
      volume: buckets[k].volume,
      rsi: null,
      macd: null,
      ema: null,
    }));

    if (opts.lookback && results.length > opts.lookback) return results.slice(-opts.lookback);
    return results;
  // include `tick` in deps so periodic timer triggers recompute
  }, [ticks, timeframe, opts.minTicks, opts.lookback, opts.fieldMap, tick]);

  return { candles };
}
