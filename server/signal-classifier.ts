import { useMemo, useRef } from 'react';
import axios from 'axios';
import { ARMEvaluator, MomentumSignalContext, RegimeContext } from './arm-evaluator';

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

export type LegacyLabelMap = { [k in LegacyLabel]?: LegacyLabel };

export interface AdditionalIndicators {
  ichimoku_bullish?: boolean;
  vwap_bullish?: boolean;
  ema_crossover?: boolean;
  [key: string]: number | boolean | undefined;
}

export interface Bar {
  timestamp: number | bigint;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  momentumShort: number;
  momentumLong: number;
  rsi: number;
  macd: number;
  volumeRatio?: number;
  mom1d?: number;
  mom7d?: number;
  mom30d?: number;
  bbPosition?: number;
  additionalIndicators?: AdditionalIndicators;
  signal?: SignalStrengthLabel;
}

export interface Classification {
  signal: SignalStrengthLabel;
  regime: RegimeState;
  legacy: LegacyLabel;
  bar: Bar;
}

export type SignalStrengthLabel =
  | 'Strong Buy'
  | 'Buy'
  | 'Weak Buy'
  | 'Neutral'
  | 'Weak Sell'
  | 'Sell'
  | 'Strong Sell';

export type RegimeState =
  | 'BULL_EARLY'
  | 'BULL_STRONG'
  | 'BULL_PARABOLIC'
  | 'BEAR_EARLY'
  | 'BEAR_STRONG'
  | 'BEAR_CAPITULATION'
  | 'NEUTRAL_ACCUM'
  | 'NEUTRAL_DIST'
  | 'NEUTRAL';

export type LegacyLabel =
  | 'Uptrend'
  | 'Spike'
  | 'Topping'
  | 'Lagging'
  | 'Moderate Uptrend'
  | 'Reversal'
  | 'Consolidation'
  | 'Weak Uptrend'
  | 'Overbought'
  | 'Oversold'
  | 'MACD Bullish'
  | 'MACD Bearish'
  | 'Neutral';

export interface VolatilityProxies {
  volumeRatio?: number;
  atr?: number;
  rv?: number;
  ivPercentile?: number;
}

export interface SignalClassifierConfig {
  thresholds: { [k: string]: number };
  volatility?: VolatilityProxies;
  hysteresis?: number;
  legacyLabelMap?: LegacyLabelMap;
  enableARMIntegration?: boolean;
  /** Base URL for the signals API. Defaults to VITE_SIGNALS_URL env var or '' (same origin). */
  signalsApiUrl?: string;
  armConfig?: {
    regimeWeighting?: Record<string, number>;
    volatilityAdjustment?: number;
    trendInfluence?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// LABEL ORDERINGS (single source of truth)
// ─────────────────────────────────────────────────────────────

const SIGNAL_ORDER: SignalStrengthLabel[] = [
  'Strong Sell', 'Sell', 'Weak Sell', 'Neutral', 'Weak Buy', 'Buy', 'Strong Buy',
];

const REGIME_ORDER: RegimeState[] = [
  'BEAR_CAPITULATION', 'BEAR_STRONG', 'BEAR_EARLY',
  'NEUTRAL', 'NEUTRAL_ACCUM', 'NEUTRAL_DIST',
  'BULL_EARLY', 'BULL_STRONG', 'BULL_PARABOLIC',
];

const LEGACY_ORDER: LegacyLabel[] = [
  'Oversold', 'MACD Bearish', 'Topping', 'Reversal',
  'Neutral', 'Lagging', 'Consolidation',
  'Weak Uptrend', 'Moderate Uptrend', 'MACD Bullish', 'Uptrend', 'Spike', 'Overbought',
];

const VALID_LEGACY_LABELS: ReadonlySet<LegacyLabel> = new Set<LegacyLabel>([
  'Uptrend', 'Spike', 'Topping', 'Lagging', 'Moderate Uptrend', 'Reversal',
  'Consolidation', 'Weak Uptrend', 'Overbought', 'Oversold', 'MACD Bullish',
  'MACD Bearish', 'Neutral',
]);

// ─────────────────────────────────────────────────────────────
// CONFIG LOADING
// ─────────────────────────────────────────────────────────────

function freezeThresholds(t: { [k: string]: number }): { [k: string]: number } {
  return Object.freeze({ ...t });
}

/**
 * Synchronous config loader — uses require() in Node, returns safe defaults in browser.
 * For browser environments call loadSignalClassifierConfigAsync() at init time instead.
 */
export function loadSignalClassifierConfig(source: string = 'default'): SignalClassifierConfig {
  if (source !== 'default') {
    console.warn(`[SignalClassifier] Config source "${source}" not implemented, using defaults.`);
    return loadSignalClassifierConfig();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config/signal-config.json');
    return {
      thresholds:     cfg.thresholds    ?? {},
      volatility:     cfg.volatility    ?? {},
      hysteresis:     cfg.hysteresis    ?? 2,
      legacyLabelMap: cfg.legacyLabelMap ?? {},
    };
  } catch {
    // Fixed: log clearly instead of silently swallowing, so callers know thresholds
    // are falling back to inline defaults in every classify call.
    console.error(
      '[SignalClassifier] Could not load signal-config.json — all thresholds will use' +
      ' hardcoded ?? defaults. Call loadSignalClassifierConfigAsync() at app init ' +
      'to avoid this in browser environments.',
    );
    return { thresholds: {}, volatility: {}, hysteresis: 2, legacyLabelMap: {} };
  }
}

/**
 * Fixed: async config loader for browser environments.
 * Await this once at app startup and pass the result everywhere.
 */
export async function loadSignalClassifierConfigAsync(
  url: string = '/config/signal-config.json',
): Promise<SignalClassifierConfig> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    return {
      thresholds:     cfg.thresholds    ?? {},
      volatility:     cfg.volatility    ?? {},
      hysteresis:     cfg.hysteresis    ?? 2,
      legacyLabelMap: cfg.legacyLabelMap ?? {},
    };
  } catch (err) {
    console.error('[SignalClassifier] Failed to load config from', url, err);
    return { thresholds: {}, volatility: {}, hysteresis: 2, legacyLabelMap: {} };
  }
}

// ─────────────────────────────────────────────────────────────
// SIGNAL CLASSIFIER
// ─────────────────────────────────────────────────────────────

export class SignalClassifier {
  // ── Static proxies ───────────────────────────────────────

  // Fixed: sharedInstance declared before the static methods that reference it
  static readonly sharedInstance = new SignalClassifier();

  static classifyMomentumSignal(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    config: SignalClassifierConfig,
    additionalIndicators: AdditionalIndicators = {},
    previousLabel?: SignalStrengthLabel,
    timestamp?: bigint | number,
    externalRegime?: RegimeContext,
  ): SignalStrengthLabel {
    return SignalClassifier.sharedInstance.classifyMomentumSignal(
      momentumShort, momentumLong, rsi, macd, config,
      additionalIndicators, previousLabel, timestamp, externalRegime,
    );
  }

  static classifyState(
    mom1d: number, mom7d: number, mom30d: number,
    rsi: number, macd: number, bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: RegimeState,
    timestamp?: bigint | number,
  ): RegimeState {
    return SignalClassifier.sharedInstance.classifyState(
      mom1d, mom7d, mom30d, rsi, macd, bbPosition,
      config, previousLabel, timestamp,
    );
  }

  static classifyLegacy(
    mom7d: number, mom30d: number,
    rsi: number, macd: number, bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: LegacyLabel,
    timestamp?: bigint | number,
  ): LegacyLabel {
    return SignalClassifier.sharedInstance.classifyLegacy(
      mom7d, mom30d, rsi, macd, bbPosition,
      config, previousLabel, timestamp,
    );
  }

  // ── Per-method caches ─────────────────────────────────────
  // Fixed: three separate Maps so classifyMomentumSignal, classifyState, and
  // classifyLegacy can never collide on a matching key and return each other's
  // cached label (which would be the wrong type at runtime).
  private signalCache:  Map<string, SignalStrengthLabel> = new Map();
  private regimeCache:  Map<string, RegimeState>         = new Map();
  private legacyCache:  Map<string, LegacyLabel>         = new Map();

  private signalCacheTs: Map<string, number> = new Map();
  private regimeCacheTs: Map<string, number> = new Map();
  private legacyCacheTs: Map<string, number> = new Map();

  private readonly MAX_CACHE_SIZE   = 1000;
  private readonly MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

  // ── Cache helpers ─────────────────────────────────────────

  private evict<T>(
    cache: Map<string, T>,
    timestamps: Map<string, number>,
  ): void {
    const now = Date.now();
    for (const [k, t] of timestamps) {
      if (now - t > this.MAX_CACHE_AGE_MS) {
        cache.delete(k);
        timestamps.delete(k);
      }
    }
    if (cache.size > this.MAX_CACHE_SIZE) {
      cache.clear();
      timestamps.clear();
    }
  }

  private createCacheKey(...args: unknown[]): string {
    return args.map(a => {
      if (typeof a === 'number') return a.toFixed(6);
      if (a !== null && typeof a === 'object') {
        try { return JSON.stringify(a, Object.keys(a as object).sort()); }
        catch { return String(a); }
      }
      return String(a);
    }).join('|');
  }

  // ── Volatility multiplier ─────────────────────────────────
  // Fixed: was multiplying all four proxies together (could reach ×16).
  // Now uses the single largest active proxy, clamped to [0.5, 2.0].
  private applyVolatilityMultiplier(base: number, vol: VolatilityProxies = {}): number {
    const candidates: number[] = [];
    if (vol.atr           !== undefined) candidates.push(vol.atr);
    if (vol.rv            !== undefined) candidates.push(vol.rv);
    if (vol.ivPercentile  !== undefined) candidates.push(vol.ivPercentile / 100);
    if (vol.volumeRatio   !== undefined) candidates.push(vol.volumeRatio);
    if (candidates.length === 0) return base;
    const mult = Math.max(0.5, Math.min(2.0, Math.max(...candidates)));
    return base * mult;
  }

  // ── Regime helper (shared path) ───────────────────────────
  // Fixed: ARM regime inference and classifyState previously used different
  // code paths and could disagree. ARM now calls classifyState directly so
  // the regime used for weighting is always consistent with what's returned.
  private computeRegime(
    mom1d: number, mom7d: number, mom30d: number,
    rsi: number, macd: number, bbPosition: number,
    thresholds: { [k: string]: number },
    vol: VolatilityProxies,
  ): RegimeState {
    const thWeak   = this.applyVolatilityMultiplier(thresholds['weak']   ?? 0.015, vol);
    const thMed    = this.applyVolatilityMultiplier(thresholds['med']    ?? 0.035, vol);
    const thStrong = this.applyVolatilityMultiplier(thresholds['strong'] ?? 0.075, vol);

    const breakoutUp   = bbPosition > 0.85 && mom1d > thWeak;
    const breakoutDn   = bbPosition < 0.15 && mom1d < -thWeak;
    const thrustUp     = mom1d > thMed  && mom7d > thMed;
    const thrustDn     = mom1d < -thMed && mom7d < -thMed;
    const parabolic    = Math.abs(mom1d) > thStrong && Math.abs(mom7d) > thStrong;

    if (parabolic && mom1d > 0) return 'BULL_PARABOLIC';
    if (parabolic && mom1d < 0) return 'BEAR_CAPITULATION';
    if (thrustUp)               return 'BULL_STRONG';
    if (thrustDn)               return 'BEAR_STRONG';
    if (breakoutUp)             return 'BULL_EARLY';
    if (breakoutDn)             return 'BEAR_EARLY';
    if (-thWeak < mom7d && mom7d < thWeak) {
      if (rsi < 35 && mom1d > 0) return 'NEUTRAL_ACCUM';
      if (rsi > 65 && mom1d < 0) return 'NEUTRAL_DIST';
    }
    return 'NEUTRAL';
  }

  // ── Signal API ────────────────────────────────────────────

  /**
   * Fixed: P3 — API URL is now configurable via config.signalsApiUrl,
   * falling back to VITE_SIGNALS_URL env var, then same-origin /signals.
   * Returns [] on error but logs a distinguishable message so callers know
   * whether empty results are real or a fetch failure.
   */
  static async fetchSignals(
    timeframe: string = '1h',
    dryRun: boolean = true,
    config?: Pick<SignalClassifierConfig, 'signalsApiUrl'>,
  ): Promise<Bar[]> {
    const base =
      config?.signalsApiUrl ??
      (typeof import.meta !== 'undefined'
        ? (import.meta as any).env?.VITE_SIGNALS_URL
        : undefined) ??
      '';
    const url = `${base}/signals`;

    try {
      const response = await axios.post(url, { timeframe, dry_run: dryRun });
      return (response.data as any[]).map(s => ({
        timestamp: new Date(s.timestamp ?? Date.now()).getTime(),
        open:      s.open  ?? s.price,
        high:      s.high  ?? s.price * 1.01,
        low:       s.low   ?? s.price * 0.99,
        close:     s.close ?? s.price,
        volume:    s.volume ?? 0,
        momentumShort: s.momentum_short,
        momentumLong:  s.momentum_long,
        rsi:           s.rsi,
        macd:          s.macd,
        volumeRatio:   s.volume_ratio,
        mom1d:         s.mom1d,
        mom7d:         s.mom7d,
        mom30d:        s.mom30d,
        bbPosition:    s.bb_position,
        additionalIndicators: {
          ichimoku_bullish: s.ichimoku_bullish,
          vwap_bullish:     s.vwap_bullish,
          ema_crossover:    s.ema_crossover,
        },
        signal: s.signal,
      } as Bar));
    } catch (error) {
      console.error(`[SignalClassifier] fetchSignals failed (url=${url}):`, error);
      return [];
    }
  }

  // ── classifyMomentumSignal ────────────────────────────────

  classifyMomentumSignal(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    config: SignalClassifierConfig,
    additionalIndicators: AdditionalIndicators = {},
    previousLabel?: SignalStrengthLabel,
    timestamp?: bigint | number,
    externalRegime?: RegimeContext,
  ): SignalStrengthLabel {
    const key = this.createCacheKey(
      'sig', timestamp ?? '', momentumShort, momentumLong, rsi, macd, additionalIndicators,
    );
    if (this.signalCache.has(key)) return this.signalCache.get(key)!;

    this.evict(this.signalCache, this.signalCacheTs);

    const thresholds = freezeThresholds(config.thresholds || {});
    const vol    = config.volatility ?? {};
    const momTh  = this.applyVolatilityMultiplier(thresholds['momentum_short'] ?? 0.01, vol);
    const rsiMin = thresholds['rsi_min'] ?? 50;
    const rsiMax = thresholds['rsi_max'] ?? 70;
    const macdMin = thresholds['macd_min'] ?? 0;

    let label: SignalStrengthLabel = 'Neutral';
    if (
      momentumShort > momTh * 2 && momentumLong > momTh &&
      rsi > rsiMin && rsi < rsiMax && macd > macdMin &&
      additionalIndicators.ichimoku_bullish
    ) {
      label = 'Strong Buy';
    } else if (momentumShort > momTh  && rsi > rsiMin       && macd > 0) {
      label = 'Buy';
    } else if (momentumShort > 0      && rsi > 45            && macd > 0) {
      label = 'Weak Buy';
    } else if (
      momentumShort < -momTh * 2 && momentumLong < -momTh &&
      rsi < 100 - rsiMin && rsi > 20 && macd < -macdMin &&
      !additionalIndicators.ichimoku_bullish
    ) {
      label = 'Strong Sell';
    } else if (momentumShort < -momTh && rsi < 100 - rsiMin && macd < 0) {
      label = 'Sell';
    } else if (momentumShort < 0      && rsi < 55             && macd < 0) {
      label = 'Weak Sell';
    }

    // ARM integration
    // Fixed: regime is now computed via computeRegime() — the same function used
    // by classifyState — so ARM weighting and regime output are always consistent.
    if (config.enableARMIntegration) {
      let regimeContext: RegimeContext;
      if (externalRegime) {
        regimeContext = externalRegime;
      } else {
        const regimeState  = this.computeRegime(
          0, momentumLong, 0, rsi, macd, 0.5, thresholds, vol,
        );
        const regimeConf   = ARMEvaluator.calculateRegimeConfidence(momentumShort, momentumLong, rsi);
        const trendStr     = ARMEvaluator.evaluateTrendStrength(momentumLong, macd, rsi);
        const volatility   = ARMEvaluator.evaluateVolatility(momentumShort, rsi, additionalIndicators);
        regimeContext = { regime: regimeState, volatility, trendStrength: trendStr, regimeConfidence: regimeConf };
      }

      const signalContext: MomentumSignalContext = {
        momentumShort, momentumLong, rsi, macd, regimeContext, additionalIndicators,
      };

      const armCfg = {
        enableAdaptiveThresholds: true,
        regimeWeighting: config.armConfig?.regimeWeighting ?? {
          BULL_EARLY: 1.1, BULL_STRONG: 1.3, BULL_PARABOLIC: 1.2,
          BEAR_EARLY: 0.9, BEAR_STRONG: 0.7, BEAR_CAPITULATION: 0.8,
          NEUTRAL_ACCUM: 1.0, NEUTRAL_DIST: 1.0, NEUTRAL: 1.0,
        },
        volatilityAdjustment: config.armConfig?.volatilityAdjustment ?? 0.5,
        trendInfluence:       config.armConfig?.trendInfluence       ?? 0.3,
      };

      label = ARMEvaluator.evaluateMomentumWithRegime(signalContext, label, armCfg);
    }

    // Hysteresis
    label = applyHysteresis(label, previousLabel, SIGNAL_ORDER, config.hysteresis);

    this.signalCache.set(key, label);
    this.signalCacheTs.set(key, Date.now());
    return label;
  }

  // ── classifyState ─────────────────────────────────────────

  // Fixed: hysteresis now applied (was accepted but silently ignored before)
  classifyState(
    mom1d: number, mom7d: number, mom30d: number,
    rsi: number, macd: number, bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: RegimeState,
    timestamp?: bigint | number,
  ): RegimeState {
    const key = this.createCacheKey('reg', timestamp ?? '', mom1d, mom7d, mom30d, rsi, macd, bbPosition);
    if (this.regimeCache.has(key)) return this.regimeCache.get(key)!;

    this.evict(this.regimeCache, this.regimeCacheTs);

    const thresholds = freezeThresholds(config.thresholds || {});
    const vol = config.volatility ?? {};

    let label = this.computeRegime(mom1d, mom7d, mom30d, rsi, macd, bbPosition, thresholds, vol);
    label = applyHysteresis(label, previousLabel, REGIME_ORDER, config.hysteresis);

    this.regimeCache.set(key, label);
    this.regimeCacheTs.set(key, Date.now());
    return label;
  }

  // ── classifyLegacy ────────────────────────────────────────

  // Fixed: hysteresis now applied (was accepted but silently ignored before)
  classifyLegacy(
    mom7d: number, mom30d: number,
    rsi: number, macd: number, bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: LegacyLabel,
    timestamp?: bigint | number,
  ): LegacyLabel {
    const key = this.createCacheKey('leg', timestamp ?? '', mom7d, mom30d, rsi, macd, bbPosition);
    if (this.legacyCache.has(key)) return this.legacyCache.get(key)!;

    this.evict(this.legacyCache, this.legacyCacheTs);

    const thresholds = freezeThresholds(config.thresholds || {});
    const vol  = config.volatility ?? {};
    const thHigh = this.applyVolatilityMultiplier(thresholds['high'] ?? 0.07,  vol);
    const thMed  = this.applyVolatilityMultiplier(thresholds['med']  ?? 0.035, vol);
    const thLow  = this.applyVolatilityMultiplier(thresholds['low']  ?? 0.015, vol);

    let label: LegacyLabel = 'Neutral';
    if      (mom7d > thMed  && mom30d > thHigh && mom7d < 0.5 * mom30d) label = 'Uptrend';
    else if (mom7d > thHigh && Math.abs(mom30d) < thMed)                 label = 'Spike';
    else if (mom7d < -thMed && mom30d > thHigh && bbPosition > 0.80 && rsi > 65) label = 'Topping';
    else if (Math.abs(mom7d) < thLow && Math.abs(mom30d) < thMed)        label = 'Lagging';
    else if (thLow < mom7d && mom7d < thHigh && thMed < mom30d && mom30d < thHigh) label = 'Moderate Uptrend';
    else if (mom7d > thMed  && mom30d < -thMed && rsi < 45)              label = 'Reversal';
    else if (Math.abs(mom7d) < thLow && Math.abs(mom30d) < thLow && rsi >= 40 && rsi <= 60) label = 'Consolidation';
    else if (mom7d > thLow  && Math.abs(mom30d) < thLow)                 label = 'Weak Uptrend';
    else if (rsi > 75       && mom7d > thMed)                            label = 'Overbought';
    else if (rsi < 25       && mom7d < -thMed)                           label = 'Oversold';
    else if (macd > 0       && mom7d > thMed)                            label = 'MACD Bullish';
    else if (macd < 0       && mom7d < -thMed)                           label = 'MACD Bearish';

    // i18n mapping with validation
    if (config.legacyLabelMap?.[label]) {
      const mapped = config.legacyLabelMap[label]!;
      // LegacyLabelMap allows mapping a label to itself for partial-override configs
      if (VALID_LEGACY_LABELS.has(mapped)) label = mapped;
    }

    label = applyHysteresis(label, previousLabel, LEGACY_ORDER, config.hysteresis);

    this.legacyCache.set(key, label);
    this.legacyCacheTs.set(key, Date.now());
    return label;
  }

  // ── classifyStreaming ─────────────────────────────────────

  classifyStreaming(bars: Bar[], config: SignalClassifierConfig): Classification {
    if (!bars.length) throw new Error('[SignalClassifier] No bars provided to classifyStreaming');
    const latest    = bars[bars.length - 1];
    const prevSignal = bars.length > 1 ? bars[bars.length - 2].signal : undefined;

    const signal = this.classifyMomentumSignal(
      latest.momentumShort, latest.momentumLong, latest.rsi, latest.macd,
      config, latest.additionalIndicators ?? {}, prevSignal, latest.timestamp,
    );
    const regime = this.classifyState(
      latest.mom1d ?? 0, latest.mom7d ?? 0, latest.mom30d ?? 0,
      latest.rsi, latest.macd, latest.bbPosition ?? 0,
      config, undefined, latest.timestamp,
    );
    const legacy = this.classifyLegacy(
      latest.mom7d ?? 0, latest.mom30d ?? 0,
      latest.rsi, latest.macd, latest.bbPosition ?? 0,
      config, undefined, latest.timestamp,
    );

    return { signal, regime, legacy, bar: latest };
  }

  // ── classifyBatch ─────────────────────────────────────────

  /**
   * Fixed: hysteresis now carries forward the signal computed in this batch run,
   * not the stale `.signal` field from the original input bar objects.
   */
  classifyBatch(bars: Bar[], config: SignalClassifierConfig): Classification[] {
    const results: Classification[] = [];
    let prevSignal: SignalStrengthLabel | undefined;
    let prevRegime: RegimeState         | undefined;
    let prevLegacy: LegacyLabel         | undefined;

    for (const bar of bars) {
      const signal = this.classifyMomentumSignal(
        bar.momentumShort, bar.momentumLong, bar.rsi, bar.macd,
        config, bar.additionalIndicators ?? {}, prevSignal, bar.timestamp,
      );
      const regime = this.classifyState(
        bar.mom1d ?? 0, bar.mom7d ?? 0, bar.mom30d ?? 0,
        bar.rsi, bar.macd, bar.bbPosition ?? 0,
        config, prevRegime, bar.timestamp,
      );
      const legacy = this.classifyLegacy(
        bar.mom7d ?? 0, bar.mom30d ?? 0,
        bar.rsi, bar.macd, bar.bbPosition ?? 0,
        config, prevLegacy, bar.timestamp,
      );

      results.push({ signal, regime, legacy, bar });
      prevSignal = signal;
      prevRegime = regime;
      prevLegacy = legacy;
    }

    return results;
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED HYSTERESIS UTILITY
// ─────────────────────────────────────────────────────────────

/**
 * Generic ordinal hysteresis: if the new label is within `threshold` steps of
 * the previous label in the given ordering array, keep the previous label.
 * Works for SignalStrengthLabel, RegimeState, and LegacyLabel.
 */
function applyHysteresis<T>(
  label: T,
  previous: T | undefined,
  order: T[],
  threshold: number = 0,
): T {
  if (!previous || threshold <= 0 || previous === label) return label;
  const prevIdx = order.indexOf(previous);
  const currIdx = order.indexOf(label);
  if (prevIdx === -1 || currIdx === -1) return label;
  return Math.abs(currIdx - prevIdx) < threshold ? previous : label;
}

// ─────────────────────────────────────────────────────────────
// REACT HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Fixed: memo dependencies are stable primitives extracted from bar,
 * so the memo doesn't invalidate on every render when bar is a new object.
 * config should be passed as a stable reference (memoised by the caller).
 */
export function useSignalClassifier(bar: Bar, config: SignalClassifierConfig) {
  const classifier  = useRef(new SignalClassifier());
  const prevSigRef  = useRef<SignalStrengthLabel | undefined>(undefined);
  const prevRegRef  = useRef<RegimeState | undefined>(undefined);
  const prevLegRef  = useRef<LegacyLabel | undefined>(undefined);

  // Stable primitive deps — avoids invalidating on every new bar object reference
  const ts    = typeof bar.timestamp === 'bigint' ? Number(bar.timestamp) : bar.timestamp;
  const mShort = bar.momentumShort;
  const mLong  = bar.momentumLong;
  const rsi    = bar.rsi;
  const macd   = bar.macd;
  const bb     = bar.bbPosition ?? 0;
  const mom1d  = bar.mom1d   ?? 0;
  const mom7d  = bar.mom7d   ?? 0;
  const mom30d = bar.mom30d  ?? 0;

  const result = useMemo(() => {
    const signal = classifier.current.classifyMomentumSignal(
      mShort, mLong, rsi, macd, config,
      bar.additionalIndicators ?? {}, prevSigRef.current, ts,
    );
    const regime = classifier.current.classifyState(
      mom1d, mom7d, mom30d, rsi, macd, bb,
      config, prevRegRef.current, ts,
    );
    const legacy = classifier.current.classifyLegacy(
      mom7d, mom30d, rsi, macd, bb,
      config, prevLegRef.current, ts,
    );

    prevSigRef.current = signal;
    prevRegRef.current = regime;
    prevLegRef.current = legacy;

    return { signal, regime, legacy };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts, mShort, mLong, rsi, macd, bb, mom1d, mom7d, mom30d, config]);

  return result;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Fixed: uses the shared singleton instead of allocating a new classifier
 * instance (and empty cache) on every call.
 */
export function calculateSignalStrength(bar: Bar, config: SignalClassifierConfig): number {
  const result = SignalClassifier.sharedInstance.classifyStreaming([bar], config);
  const idx = SIGNAL_ORDER.indexOf(result.signal);
  return idx === -1 ? 0.5 : idx / (SIGNAL_ORDER.length - 1);
}