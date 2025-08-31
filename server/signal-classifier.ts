
import { useMemo, useRef } from 'react';
import axios from 'axios';

// User-supplied mappings for i18n
export type LegacyLabelMap = { [k in LegacyLabel]?: LegacyLabel };

// Interface for additional indicators, aligned with RL system
export interface AdditionalIndicators {
  ichimoku_bullish?: boolean;
  vwap_bullish?: boolean;
  ema_crossover?: boolean;
  [key: string]: number | boolean | undefined;
}

// Type for streaming bars, aligned with RLSignal and ChartDataPoint
export interface Bar {
  timestamp: number | bigint;
  open: number; // Added for TradingChart
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
  bbPosition?: number; // Standardized from bbPos/bb_position
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

// Config type for classifier rules and thresholds
export interface VolatilityProxies {
  volumeRatio?: number;
  atr?: number;
  rv?: number;
  ivPercentile?: number;
}

export interface SignalClassifierConfig {
  thresholds: { [k: string]: number };
  volatility?: VolatilityProxies;
  hysteresis?: number; // Controls micro-state smoothing
  legacyLabelMap?: LegacyLabelMap; // For i18n
}

// Helper to freeze thresholds for type safety
function freezeThresholds(thresholds: { [k: string]: number }): { [k: string]: number } {
  return Object.freeze({ ...thresholds });
}

// Load default config or fetch from backend
export function loadSignalClassifierConfig(source: string = 'default'): SignalClassifierConfig {
  if (source === 'default') {
    const config = require('../config/signal-config.json');
    return {
      thresholds: config.thresholds,
      volatility: config.volatility,
      hysteresis: config.hysteresis ?? 2,
      legacyLabelMap: config.legacyLabelMap ?? {},
    };
  }
  // Placeholder for fetching from backend or file
  console.warn(`Config source ${source} not implemented, using default`);
  return loadSignalClassifierConfig();
}

export class SignalClassifier {
  // Static proxy for API usage: allows direct calls without instantiation
  static classifyMomentumSignal(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    config: SignalClassifierConfig,
    additionalIndicators: AdditionalIndicators = {},
    previousLabel?: SignalStrengthLabel,
    timestamp?: bigint | number,
  ): SignalStrengthLabel {
    return new SignalClassifier().classifyMomentumSignal(
      momentumShort,
      momentumLong,
      rsi,
      macd,
      config,
      additionalIndicators,
      previousLabel,
      timestamp,
    );
  }

  static classifyState(
    mom1d: number,
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: RegimeState,
    timestamp?: bigint | number,
  ): RegimeState {
    return new SignalClassifier().classifyState(
      mom1d,
      mom7d,
      mom30d,
      rsi,
      macd,
      bbPosition,
      config,
      previousLabel,
      timestamp,
    );
  }

  static classifyLegacy(
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: LegacyLabel,
    timestamp?: bigint | number,
  ): LegacyLabel {
    return new SignalClassifier().classifyLegacy(
      mom7d,
      mom30d,
      rsi,
      macd,
      bbPosition,
      config,
      previousLabel,
      timestamp,
    );
  }
  private signalMemoCache: Map<string, SignalStrengthLabel | RegimeState | LegacyLabel>;
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks

  constructor() {
    this.signalMemoCache = new Map();
  }

  /**
   * Clears the memoization cache to prevent memory leaks
   */
  private clearCacheIfNeeded(): void {
    if (this.signalMemoCache.size > this.MAX_CACHE_SIZE) {
      this.signalMemoCache.clear();
    }
  }

  /**
   * Fetches signals from the RL trading system backend
   * @param timeframe - Trading timeframe (e.g., '1h', '1d')
   * @param dryRun - Whether to simulate trades
   * @returns Array of Bar objects
   */
  static async fetchSignals(timeframe: string = '1h', dryRun: boolean = true): Promise<Bar[]> {
    try {
      const response = await axios.post('http://localhost:8000/signals', {
        timeframe,
        dry_run: dryRun,
      });
      return response.data.map((signal: any) => ({
        timestamp: new Date(signal.timestamp || Date.now()).getTime(),
        open: signal.open || signal.price,
        high: signal.high || signal.price * 1.01,
        low: signal.low || signal.price * 0.99,
        close: signal.close || signal.price,
        volume: signal.volume || 0,
        momentumShort: signal.momentum_short,
        momentumLong: signal.momentum_long,
        rsi: signal.rsi,
        macd: signal.macd,
        volumeRatio: signal.volume_ratio,
        mom1d: signal.mom1d,
        mom7d: signal.mom7d,
        mom30d: signal.mom30d,
        bbPosition: signal.bb_position,
        additionalIndicators: {
          ichimoku_bullish: signal.ichimoku_bullish,
          vwap_bullish: signal.vwap_bullish,
          ema_crossover: signal.ema_crossover,
        },
        signal: signal.signal,
      }));
    } catch (error) {
      console.error('Failed to fetch signals:', error);
      return [];
    }
  }

  /**
   * Classifies the main trading signal with hysteresis and memoization
   * @param momentumShort - Short-term momentum
   * @param momentumLong - Long-term momentum
   * @param rsi - Relative Strength Index
   * @param macd - MACD indicator
   * @param config - Classifier configuration
   * @param additionalIndicators - Additional indicators (e.g., ichimoku_bullish)
   * @param previousLabel - Previous signal label for hysteresis
   * @param timestamp - Timestamp for cache key
   * @returns Signal strength label
   */
  classifyMomentumSignal(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    config: SignalClassifierConfig,
    additionalIndicators: AdditionalIndicators = {},
    previousLabel?: SignalStrengthLabel,
    timestamp?: bigint | number,
  ): SignalStrengthLabel {
    const key = `${timestamp ?? ''}|${momentumShort}|${momentumLong}|${rsi}|${macd}|${JSON.stringify(additionalIndicators)}`;
    if (this.signalMemoCache.has(key)) {
      return this.signalMemoCache.get(key) as SignalStrengthLabel;
    }

    this.clearCacheIfNeeded();
    const thresholds = freezeThresholds(config.thresholds || {});
    const vol = config.volatility || {};
    let volMult = 1.0;
    if (vol.atr) volMult *= Math.max(0.5, Math.min(2.0, vol.atr));
    if (vol.rv) volMult *= Math.max(0.5, Math.min(2.0, vol.rv));
    if (vol.ivPercentile) volMult *= Math.max(0.5, Math.min(2.0, vol.ivPercentile / 100));
    if (vol.volumeRatio) volMult *= Math.max(0.5, Math.min(2.0, vol.volumeRatio));
    const momTh = (thresholds['momentum_short'] ?? 0.01) * volMult;
    const rsiMin = thresholds['rsi_min'] ?? 50;
    const rsiMax = thresholds['rsi_max'] ?? 70;
    const macdMin = thresholds['macd_min'] ?? 0;

    let label: SignalStrengthLabel = 'Neutral';
    if (
      momentumShort > momTh * 2 &&
      momentumLong > momTh &&
      rsi > rsiMin &&
      rsi < rsiMax &&
      macd > macdMin &&
      additionalIndicators.ichimoku_bullish
    ) {
      label = 'Strong Buy';
    } else if (momentumShort > momTh && rsi > rsiMin && macd > 0) {
      label = 'Buy';
    } else if (momentumShort > 0 && rsi > 45 && macd > 0) {
      label = 'Weak Buy';
    } else if (
      momentumShort < -momTh * 2 &&
      momentumLong < -momTh &&
      rsi < 100 - rsiMin &&
      rsi > 20 &&
      macd < -macdMin &&
      !additionalIndicators.ichimoku_bullish
    ) {
      label = 'Strong Sell';
    } else if (momentumShort < -momTh && rsi < 100 - rsiMin && macd < 0) {
      label = 'Sell';
    } else if (momentumShort < 0 && rsi < 55 && macd < 0) {
      label = 'Weak Sell';
    }

    // Hysteresis smoothing
    if (previousLabel && config.hysteresis !== undefined && previousLabel !== label) {
      const labelOrder: SignalStrengthLabel[] = [
        'Strong Sell',
        'Sell',
        'Weak Sell',
        'Neutral',
        'Weak Buy',
        'Buy',
        'Strong Buy',
      ];
      const prevIdx = labelOrder.indexOf(previousLabel);
      const currIdx = labelOrder.indexOf(label);
      if (Math.abs(currIdx - prevIdx) < (config.hysteresis ?? 2)) {
        label = previousLabel;
      }
    }

    this.signalMemoCache.set(key, label);
    return label;
  }

  /**
   * Classifies the regime state with memoization
   * @param mom1d - 1-day momentum
   * @param mom7d - 7-day momentum
   * @param mom30d - 30-day momentum
   * @param rsi - Relative Strength Index
   * @param macd - MACD indicator
   * @param bbPosition - Bollinger Band position
   * @param config - Classifier configuration
   * @param previousLabel - Previous regime label
   * @param timestamp - Timestamp for cache key
   * @returns Regime state
   */
  classifyState(
    mom1d: number,
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: RegimeState,
    timestamp?: bigint | number,
  ): RegimeState {
    const key = `${timestamp ?? ''}|${mom1d}|${mom7d}|${mom30d}|${rsi}|${macd}|${bbPosition}`;
    if (this.signalMemoCache.has(key)) {
      return this.signalMemoCache.get(key) as RegimeState;
    }

    this.clearCacheIfNeeded();
    const thresholds = freezeThresholds(config.thresholds || {});
    const vol = config.volatility || {};
    let volMult = 1.0;
    if (vol.atr) volMult *= Math.max(0.5, Math.min(2.0, vol.atr));
    if (vol.rv) volMult *= Math.max(0.5, Math.min(2.0, vol.rv));
    if (vol.ivPercentile) volMult *= Math.max(0.5, Math.min(2.0, vol.ivPercentile / 100));
    if (vol.volumeRatio) volMult *= Math.max(0.5, Math.min(2.0, vol.volumeRatio));
    const thWeak = (thresholds['weak'] ?? 0.015) * volMult;
    const thMed = (thresholds['med'] ?? 0.035) * volMult;
    const thStrong = (thresholds['strong'] ?? 0.075) * volMult;

    let label: RegimeState = 'NEUTRAL';
    const breakoutUp = bbPosition > 0.85 && mom1d > thWeak;
    const breakoutDn = bbPosition < 0.15 && mom1d < -thWeak;
    const thrustUp = mom1d > thMed && mom7d > thMed;
    const thrustDn = mom1d < -thMed && mom7d < -thMed;
    const parabolic = Math.abs(mom1d) > thStrong && Math.abs(mom7d) > thStrong;

    if (parabolic && mom1d > 0) label = 'BULL_PARABOLIC';
    else if (parabolic && mom1d < 0) label = 'BEAR_CAPITULATION';
    else if (thrustUp) label = 'BULL_STRONG';
    else if (thrustDn) label = 'BEAR_STRONG';
    else if (breakoutUp) label = 'BULL_EARLY';
    else if (breakoutDn) label = 'BEAR_EARLY';
    else if (-thWeak < mom7d && mom7d < thWeak) {
      if (rsi < 35 && mom1d > 0) label = 'NEUTRAL_ACCUM';
      if (rsi > 65 && mom1d < 0) label = 'NEUTRAL_DIST';
    }

    this.signalMemoCache.set(key, label);
    return label;
  }

  /**
   * Classifies legacy labels with memoization and i18n support
   * @param mom7d - 7-day momentum
   * @param mom30d - 30-day momentum
   * @param rsi - Relative Strength Index
   * @param macd - MACD indicator
   * @param bbPosition - Bollinger Band position
   * @param config - Classifier configuration
   * @param previousLabel - Previous legacy label
   * @param timestamp - Timestamp for cache key
   * @returns Legacy label
   */
  classifyLegacy(
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    config: SignalClassifierConfig,
    previousLabel?: LegacyLabel,
    timestamp?: bigint | number,
  ): LegacyLabel {
    const key = `${timestamp ?? ''}|${mom7d}|${mom30d}|${rsi}|${macd}|${bbPosition}`;
    if (this.signalMemoCache.has(key)) {
      return this.signalMemoCache.get(key) as LegacyLabel;
    }

    this.clearCacheIfNeeded();
    const thresholds = freezeThresholds(config.thresholds || {});
    const vol = config.volatility || {};
    let volMult = 1.0;
    if (vol.atr) volMult *= Math.max(0.5, Math.min(2.0, vol.atr));
    if (vol.rv) volMult *= Math.max(0.5, Math.min(2.0, vol.rv));
    if (vol.ivPercentile) volMult *= Math.max(0.5, Math.min(2.0, vol.ivPercentile / 100));
    if (vol.volumeRatio) volMult *= Math.max(0.5, Math.min(2.0, vol.volumeRatio));
    const thHigh = (thresholds['high'] ?? 0.07) * volMult;
    const thMed = (thresholds['med'] ?? 0.035) * volMult;
    const thLow = (thresholds['low'] ?? 0.015) * volMult;

    let label: LegacyLabel = 'Neutral';
    if (mom7d > thMed && mom30d > thHigh && mom7d < 0.5 * mom30d) label = 'Uptrend';
    else if (mom7d > thHigh && Math.abs(mom30d) < thMed) label = 'Spike';
    else if (mom7d < -thMed && mom30d > thHigh && bbPosition > 0.80 && rsi > 65) label = 'Topping';
    else if (Math.abs(mom7d) < thLow && Math.abs(mom30d) < thMed) label = 'Lagging';
    else if (thLow < mom7d && mom7d < thHigh && thMed < mom30d && mom30d < thHigh) label = 'Moderate Uptrend';
    else if (mom7d > thMed && mom30d < -thMed && rsi < 45) label = 'Reversal';
    else if (Math.abs(mom7d) < thLow && Math.abs(mom30d) < thLow && rsi >= 40 && rsi <= 60) label = 'Consolidation';
    else if (mom7d > thLow && Math.abs(mom30d) < thLow) label = 'Weak Uptrend';
    else if (rsi > 75 && mom7d > thMed) label = 'Overbought';
    else if (rsi < 25 && mom7d < -thMed) label = 'Oversold';
    else if (macd > 0 && mom7d > thMed) label = 'MACD Bullish';
    else if (macd < 0 && mom7d < -thMed) label = 'MACD Bearish';

    // i18n mapping with validation
    if (config.legacyLabelMap && config.legacyLabelMap[label]) {
      const mappedLabel = config.legacyLabelMap[label];
      const validLabels: LegacyLabel[] = [
        'Uptrend', 'Spike', 'Topping', 'Lagging', 'Moderate Uptrend', 'Reversal',
        'Consolidation', 'Weak Uptrend', 'Overbought', 'Oversold', 'MACD Bullish',
        'MACD Bearish', 'Neutral',
      ];
      if (validLabels.includes(mappedLabel as LegacyLabel)) {
        label = mappedLabel as LegacyLabel;
      }
    }

    this.signalMemoCache.set(key, label);
    return label;
  }

  /**
   * Classifies streaming bars (e.g., from RL system)
   * @param bars - Array of Bar objects (rolling window)
   * @param config - Classifier configuration
   * @returns Classification for the latest bar
   */
  classifyStreaming(bars: Bar[], config: SignalClassifierConfig): Classification {
    if (!bars.length) throw new Error('No bars provided');
    const latest = bars[bars.length - 1];
    const prevSignal = bars.length > 1 ? bars[bars.length - 2].signal : undefined;

    const signal = this.classifyMomentumSignal(
      latest.momentumShort,
      latest.momentumLong,
      latest.rsi,
      latest.macd,
      config,
      latest.additionalIndicators ?? {},
      prevSignal,
      latest.timestamp,
    );
    const regime = this.classifyState(
      latest.mom1d ?? 0,
      latest.mom7d ?? 0,
      latest.mom30d ?? 0,
      latest.rsi,
      latest.macd,
      latest.bbPosition ?? 0,
      config,
      undefined,
      latest.timestamp,
    );
    const legacy = this.classifyLegacy(
      latest.mom7d ?? 0,
      latest.mom30d ?? 0,
      latest.rsi,
      latest.macd,
      latest.bbPosition ?? 0,
      config,
      undefined,
      latest.timestamp,
    );

    return { signal, regime, legacy, bar: latest };
  }

  /**
   * Batch classification for back-tests
   * @param bars - Array of Bar objects
   * @param config - Classifier configuration
   * @returns Array of Classification objects
   */
  classifyBatch(bars: Bar[], config: SignalClassifierConfig): Classification[] {
    return bars.map((bar, i) => {
      const prevSignal = i > 0 ? bars[i - 1].signal : undefined;
      const signal = this.classifyMomentumSignal(
        bar.momentumShort,
        bar.momentumLong,
        bar.rsi,
        bar.macd,
        config,
        bar.additionalIndicators ?? {},
        prevSignal,
        bar.timestamp,
      );
      const regime = this.classifyState(
        bar.mom1d ?? 0,
        bar.mom7d ?? 0,
        bar.mom30d ?? 0,
        bar.rsi,
        bar.macd,
        bar.bbPosition ?? 0,
        config,
        undefined,
        bar.timestamp,
      );
      const legacy = this.classifyLegacy(
        bar.mom7d ?? 0,
        bar.mom30d ?? 0,
        bar.rsi,
        bar.macd,
        bar.bbPosition ?? 0,
        config,
        undefined,
        bar.timestamp,
      );
      return { signal, regime, legacy, bar };
    });
  }
}

/**
 * React hook for signal classification
 * @param bar - Current bar data
 * @param config - Classifier configuration
 * @returns Classification result
 */
export function useSignalClassifier(bar: Bar, config: SignalClassifierConfig) {
  const classifier = useRef(new SignalClassifier());
  const prevSignalRef = useRef<SignalStrengthLabel | undefined>(undefined);

  const result = useMemo(() => {
    const signal = classifier.current.classifyMomentumSignal(
      bar.momentumShort,
      bar.momentumLong,
      bar.rsi,
      bar.macd,
      config,
      bar.additionalIndicators ?? {},
      prevSignalRef.current,
      bar.timestamp,
    );
    prevSignalRef.current = signal;

    const regime = classifier.current.classifyState(
      bar.mom1d ?? 0,
      bar.mom7d ?? 0,
      bar.mom30d ?? 0,
      bar.rsi,
      bar.macd,
      bar.bbPosition ?? 0,
      config,
      undefined,
      bar.timestamp,
    );

    const legacy = classifier.current.classifyLegacy(
      bar.mom7d ?? 0,
      bar.mom30d ?? 0,
      bar.rsi,
      bar.macd,
      bar.bbPosition ?? 0,
      config,
      undefined,
      bar.timestamp,
    );

    return { signal, regime, legacy };
  }, [bar, config]);

  return result;
}

// Placeholder for calculateSignalStrength (implement as needed)
export function calculateSignalStrength(bar: Bar, config: SignalClassifierConfig): number {
  const classification = new SignalClassifier().classifyStreaming([bar], config);
  const signalOrder: SignalStrengthLabel[] = [
    'Strong Sell',
    'Sell',
    'Weak Sell',
    'Neutral',
    'Weak Buy',
    'Buy',
    'Strong Buy',
  ];
  return signalOrder.indexOf(classification.signal) / (signalOrder.length - 1);
}
