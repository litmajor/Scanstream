/**
 * Indicator Configuration & Selective Computation
 * 
 * Enables opt-in control over which indicators are computed per symbol/timeframe.
 * Supports granular enable/disable toggles, parameter overrides, and preset profiles.
 */

/**
 * Configuration for a single indicator.
 * When enabled=false, the indicator is skipped entirely (not computed).
 */
export interface IndicatorConfig {
  /** Enable/disable indicator computation */
  enabled: boolean;
  /** Custom parameters to override defaults (e.g., RSI period) */
  params?: Record<string, any>;
  /** Whether to cache this indicator array */
  cache?: boolean;
  /** If true and computation is expensive, may be deferred to worker */
  deferToWorker?: boolean;
}

/**
 * Master configuration for all indicators.
 * Each indicator can be individually enabled/disabled and customized.
 */
export interface IndicatorSetConfig {
  // Moving Averages
  sma?: IndicatorConfig;
  ema?: IndicatorConfig;
  vwma?: IndicatorConfig;

  // Trend
  macd?: IndicatorConfig;
  adx?: IndicatorConfig;
  parabolicSAR?: IndicatorConfig;
  aroon?: IndicatorConfig;
  ichimoku?: IndicatorConfig;

  // Momentum
  rsi?: IndicatorConfig;
  stochastic?: IndicatorConfig;
  williamsR?: IndicatorConfig;
  cci?: IndicatorConfig;
  tsi?: IndicatorConfig;
  elderRay?: IndicatorConfig;

  // Volatility
  bollingerBands?: IndicatorConfig;
  keltnerChannels?: IndicatorConfig;
  atr?: IndicatorConfig;

  // Volume
  obv?: IndicatorConfig;
  mfi?: IndicatorConfig;
  cmf?: IndicatorConfig;
  vwap?: IndicatorConfig;
  volumeProfile?: IndicatorConfig;

  // Support/Resistance
  fibLevels?: IndicatorConfig;

  // Utilities
  slope?: IndicatorConfig;
}

/**
 * Per-symbol/timeframe configuration.
 * Allows different settings for different trading contexts.
 */
export interface SymbolTimeframeConfig extends IndicatorSetConfig {
  symbol?: string;
  timeframe?: string;
}

/**
 * Preset indicator profiles for common trading strategies.
 */
export type IndicatorProfile = 'aggressive' | 'balanced' | 'conservative' | 'custom';

/**
 * Predefined indicator profiles optimized for different strategies.
 * 'aggressive' = more indicators, lower performance; 'conservative' = minimal fast indicators only.
 */
const INDICATOR_PROFILES: Record<Exclude<IndicatorProfile, 'custom'>, IndicatorSetConfig> = {
  aggressive: {
    // All indicators enabled, standard parameters
    sma: { enabled: true },
    ema: { enabled: true },
    vwma: { enabled: true },
    macd: { enabled: true },
    adx: { enabled: true },
    parabolicSAR: { enabled: true },
    aroon: { enabled: true },
    ichimoku: { enabled: true, deferToWorker: true }, // Heavy computation
    rsi: { enabled: true },
    stochastic: { enabled: true },
    williamsR: { enabled: true },
    cci: { enabled: true },
    tsi: { enabled: true },
    elderRay: { enabled: true },
    bollingerBands: { enabled: true },
    keltnerChannels: { enabled: true },
    atr: { enabled: true },
    obv: { enabled: true },
    mfi: { enabled: true },
    cmf: { enabled: true },
    vwap: { enabled: true },
    volumeProfile: { enabled: true, deferToWorker: true }, // Heavy computation
    fibLevels: { enabled: true },
    slope: { enabled: true }
  },

  balanced: {
    // Core indicators + selected advanced ones
    ema: { enabled: true },
    macd: { enabled: true },
    rsi: { enabled: true },
    adx: { enabled: true },
    atr: { enabled: true },
    bollingerBands: { enabled: true },
    vwap: { enabled: true },
    ichimoku: { enabled: false }, // Defer aggressive computation
    volumeProfile: { enabled: false }, // Defer aggressive computation
    slope: { enabled: true },
    // Others disabled
    sma: { enabled: false },
    vwma: { enabled: false },
    parabolicSAR: { enabled: false },
    aroon: { enabled: false },
    stochastic: { enabled: false },
    williamsR: { enabled: false },
    cci: { enabled: false },
    tsi: { enabled: false },
    elderRay: { enabled: false },
    keltnerChannels: { enabled: false },
    obv: { enabled: false },
    mfi: { enabled: false },
    cmf: { enabled: false },
    fibLevels: { enabled: false }
  },

  conservative: {
    // Minimal, fast indicators only
    rsi: { enabled: true, params: { period: 14 } },
    macd: { enabled: true },
    ema: { enabled: true },
    slope: { enabled: true },
    atr: { enabled: true },
    // Everything else disabled
    sma: { enabled: false },
    vwma: { enabled: false },
    adx: { enabled: false },
    parabolicSAR: { enabled: false },
    aroon: { enabled: false },
    ichimoku: { enabled: false },
    stochastic: { enabled: false },
    williamsR: { enabled: false },
    cci: { enabled: false },
    tsi: { enabled: false },
    elderRay: { enabled: false },
    bollingerBands: { enabled: false },
    keltnerChannels: { enabled: false },
    obv: { enabled: false },
    mfi: { enabled: false },
    cmf: { enabled: false },
    vwap: { enabled: false },
    volumeProfile: { enabled: false },
    fibLevels: { enabled: false }
  }
};

/**
 * Configuration manager for selective indicator computation.
 * Supports per-symbol/timeframe overrides and preset profiles.
 */
export class IndicatorConfigManager {
  private globalConfig: IndicatorSetConfig = INDICATOR_PROFILES.balanced;
  private overrides = new Map<string, SymbolTimeframeConfig>();

  constructor(profile: IndicatorProfile = 'balanced') {
    if (profile !== 'custom') {
      this.globalConfig = INDICATOR_PROFILES[profile];
    }
  }

  /**
   * Get configuration for a specific indicator at global level.
   */
  getIndicatorConfig(indicatorName: string): IndicatorConfig | undefined {
    return (this.globalConfig as any)[indicatorName];
  }

  /**
   * Check if an indicator is enabled globally.
   */
  isIndicatorEnabled(indicatorName: string): boolean {
    const cfg = this.getIndicatorConfig(indicatorName);
    return cfg?.enabled ?? false;
  }

  /**
   * Get effective configuration for a symbol/timeframe, merging global + overrides.
   */
  getEffectiveConfig(symbol: string, timeframe: string): SymbolTimeframeConfig {
    const key = `${symbol}:${timeframe}`;
    const override = this.overrides.get(key);
    if (override) {
      // Merge override with global config (override takes precedence)
      return { ...this.globalConfig, ...override };
    }
    return { ...this.globalConfig };
  }

  /**
   * Set per-symbol/timeframe configuration overrides.
   */
  setOverride(symbol: string, timeframe: string, config: Partial<SymbolTimeframeConfig>): void {
    const key = `${symbol}:${timeframe}`;
    const existing = this.overrides.get(key) ?? {};
    this.overrides.set(key, { ...existing, ...config });
  }

  /**
   * Remove per-symbol/timeframe overrides (revert to global config).
   */
  clearOverride(symbol: string, timeframe: string): void {
    this.overrides.delete(`${symbol}:${timeframe}`);
  }

  /**
   * Clear all overrides, revert to global profile.
   */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Get list of enabled indicators for a symbol/timeframe.
   */
  getEnabledIndicators(symbol: string, timeframe: string): string[] {
    const config = this.getEffectiveConfig(symbol, timeframe);
    const enabled: string[] = [];
    for (const [name, cfg] of Object.entries(config)) {
      if (cfg && typeof cfg === 'object' && 'enabled' in cfg && cfg.enabled) {
        enabled.push(name);
      }
    }
    return enabled;
  }

  /**
   * Get list of indicators to defer to worker threads.
   */
  getDeferredIndicators(symbol: string, timeframe: string): string[] {
    const config = this.getEffectiveConfig(symbol, timeframe);
    const deferred: string[] = [];
    for (const [name, cfg] of Object.entries(config)) {
      if (cfg && typeof cfg === 'object' && cfg.deferToWorker) {
        deferred.push(name);
      }
    }
    return deferred;
  }

  /**
   * Get effective parameters for an indicator (custom params merged with defaults).
   */
  getIndicatorParams(indicatorName: string, symbol?: string, timeframe?: string): Record<string, any> {
    const config = symbol && timeframe
      ? this.getEffectiveConfig(symbol, timeframe)
      : this.globalConfig;
    return (config as any)[indicatorName]?.params ?? {};
  }

  /**
   * Set global profile.
   */
  setGlobalProfile(profile: IndicatorProfile, customConfig?: IndicatorSetConfig): void {
    if (profile === 'custom' && customConfig) {
      this.globalConfig = customConfig;
    } else if (profile !== 'custom') {
      this.globalConfig = INDICATOR_PROFILES[profile];
    }
  }

  /**
   * Export current configuration for debugging/persistence.
   */
  export() {
    return {
      globalConfig: this.globalConfig,
      overrides: Object.fromEntries(this.overrides)
    };
  }

  /**
   * Import configuration from saved state.
   */
  import(state: { globalConfig: IndicatorSetConfig; overrides: Record<string, SymbolTimeframeConfig> }): void {
    this.globalConfig = state.globalConfig;
    this.overrides.clear();
    for (const [key, cfg] of Object.entries(state.overrides)) {
      this.overrides.set(key, cfg);
    }
  }
}

export default IndicatorConfigManager;
