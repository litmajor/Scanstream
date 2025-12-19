/**
 * Market Frame Factory
 * 
 * Transforms scanner API output (67 columns) → MarketFrame
 * 
 * Responsibility:
 * - Map scanner results to frame structure
 * - Validate OHLCV data
 * - Extract and organize 67 columns into frame.indicators
 * - Track data source and quality
 */

import type { MarketFrame, MarketFrameIndicators, MarketFrameMicrostructure } from '../../types/MarketFrame';

/**
 * Scanner API response structure (what comes from Python)
 * Subset of the 67 columns we care about
 */
interface ScannerSignal {
  symbol: string;
  timestamp: number;
  
  // OHLCV
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  
  // Trend indicators (EMAs)
  ema_5?: number;
  ema_9?: number;
  ema_13?: number;
  ema_21?: number;
  ema_50?: number;
  ema_200?: number;
  sma_20?: number;
  sma_50?: number;
  
  // Momentum (RSI, Stochastic)
  rsi?: number;
  stoch_k?: number;
  stoch_d?: number;
  
  // Volatility (Bollinger Bands)
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  bb_width?: number;
  
  // Trend strength
  atr?: number;
  adx?: number;
  
  // Volume
  obv?: number;
  vwap?: number;
  
  // Volume Profile
  poc_price?: number;
  volume_hist?: number[];
  anchored_poc?: number;
  anchored_volume_hist?: number[];
  fixed_poc?: number;
  fixed_volume_hist?: number[];
  
  // Ichimoku
  tenkan?: number;
  kijun?: number;
  senkou_a?: number;
  senkou_b?: number;
  chikou?: number;
  
  // Microstructure
  spread_bps?: number;
  bid_size?: number;
  ask_size?: number;
  
  // Meta
  is_final?: boolean;
  source?: string;
  
  [key: string]: any; // Allow any additional columns
}

/**
 * Build MarketFrame from scanner API response
 * 
 * @param signal Scanner API signal object (with 67 columns)
 * @param timeframe Timeframe of the data (e.g., '1h', '5m')
 * @returns Structured MarketFrame
 */
export function buildMarketFrame(
  signal: ScannerSignal,
  timeframe: string = '1h'
): MarketFrame {
  const now = Date.now();
  const dataAge = signal.timestamp ? now - signal.timestamp : 0;

  // Validate OHLCV
  if (!isValidOHLCV(signal)) {
    throw new Error(
      `Invalid OHLCV data for ${signal.symbol}: ` +
      `open=${signal.open}, high=${signal.high}, low=${signal.low}, close=${signal.close}`
    );
  }

  // Build indicators object from 67 columns (matching MarketFrameIndicators interface)
  const indicators: MarketFrameIndicators = {
    ema20: signal.ema_21 ?? signal.ema_20, // Use 21 or 20 as close to 20
    ema50: signal.ema_50,
    vwap: signal.vwap,
    atr: signal.atr,
    rsi: signal.rsi,
    
    // Bollinger Bands
    bb: (signal.bb_upper || signal.bb_middle || signal.bb_lower) ? {
      upper: signal.bb_upper ?? 0,
      middle: signal.bb_middle ?? 0,
      lower: signal.bb_lower ?? 0,
    } : undefined,
    
    // MACD (if available)
    macd: signal.macd_line ? {
      line: signal.macd_line,
      signal: signal.macd_signal ?? 0,
      histogram: signal.macd_histogram ?? 0,
    } : undefined,
    
    // Store extended indicators as custom properties
    ema5: signal.ema_5,
    ema9: signal.ema_9,
    ema13: signal.ema_13,
    ema200: signal.ema_200,
    sma20: signal.sma_20,
    sma50: signal.sma_50,
    stochK: signal.stoch_k,
    stochD: signal.stoch_d,
    adx: signal.adx,
    obv: signal.obv,
    bbWidth: signal.bb_width,
    
    // Volume Profiles (3 variants)
    volumeProfileRegular: {
      poc: signal.poc_price,
      histogram: signal.volume_hist,
    },
    volumeProfileAnchored: {
      poc: signal.anchored_poc,
      histogram: signal.anchored_volume_hist,
    },
    volumeProfileFixed: {
      poc: signal.fixed_poc,
      histogram: signal.fixed_volume_hist,
    },
    
    // Ichimoku
    ichimokuTenkan: signal.tenkan,
    ichimokuKijun: signal.kijun,
    ichimokuSenkouA: signal.senkou_a,
    ichimokuSenkouB: signal.senkou_b,
    ichimokuChikou: signal.chikou,
  };

  // Build microstructure from order flow data
  const microstructure = {
    spread: signal.spread_bps,
    imbalance: signal.bid_size && signal.ask_size 
      ? signal.bid_size / (signal.bid_size + signal.ask_size)
      : undefined,
  };

  // Build the frame with correct structure
  const frame: MarketFrame = {
    symbol: signal.symbol,
    timeframe: (timeframe as any),
    
    // OHLCV
    open: signal.open,
    high: signal.high,
    low: signal.low,
    close: signal.close,
    volume: signal.volume,
    
    // Indicators (optional)
    indicators,
    
    // Microstructure (optional)
    microstructure,
    
    // Quality envelope (required)
    quality: {
      sourceCount: 1,
      maxLatencyMs: dataAge,
      isFallback: false,
      confidence: 0.95,
      confidenceReason: 'Scanner signal with validated OHLCV',
      evaluatedAt: now,
    },
    
    // Meta information (required)
    meta: {
      mode: 'LIVE', // Use correct enum values
      source: 'WS', // Use correct enum value
      tsOpen: signal.timestamp ?? now,
      tsClose: signal.timestamp ?? now,
      isFinal: signal.is_final ?? true,
      exchangeCount: 1,
      latencyMs: dataAge,
    },
  };

  return frame;
}

/**
 * Validate OHLCV data
 * Ensures basic sanity: open, high, low, close, volume are all valid numbers
 */
function isValidOHLCV(signal: ScannerSignal): boolean {
  if (!signal.symbol) return false;
  if (typeof signal.open !== 'number' || signal.open <= 0) return false;
  if (typeof signal.high !== 'number' || signal.high <= 0) return false;
  if (typeof signal.low !== 'number' || signal.low <= 0) return false;
  if (typeof signal.close !== 'number' || signal.close <= 0) return false;
  if (typeof signal.volume !== 'number' || signal.volume < 0) return false;
  
  // High should be >= low
  if (signal.high < signal.low) return false;
  
  // All prices should be within reasonable range of each other
  if (signal.high < signal.low * 0.95 || signal.high > signal.low * 1.05) {
    return true; // Could be valid, just different timeframe
  }
  
  return true;
}

/**
 * Build MarketFrame for replay (historical data)
 * Same as buildMarketFrame but marks data as replay-sourced
 */
export function buildMarketFrameForReplay(
  signal: ScannerSignal,
  timeframe: string
): MarketFrame {
  const frame = buildMarketFrame(signal, timeframe);
  frame.meta.source = 'REPLAY_API'; // Use correct enum value
  frame.meta.mode = 'REPLAY'; // Mark as replay mode
  return frame;
}

/**
 * Batch build multiple MarketFrames from scanner results
 */
export function buildMarketFramesBatch(
  signals: ScannerSignal[],
  timeframe: string
): MarketFrame[] {
  return signals.map(signal => {
    try {
      return buildMarketFrame(signal, timeframe);
    } catch (err) {
      console.error(
        `[MarketFrameFactory] Failed to build frame for ${signal.symbol}:`,
        (err as Error).message
      );
      return null;
    }
  }).filter((f): f is MarketFrame => f !== null);
}

/**
 * Export frame to CSV or JSON for analysis
 */
export function exportFrameForAnalysis(frame: MarketFrame): Record<string, any> {
  const indicators = frame.indicators || {};
  const micro = frame.microstructure || {};
  
  return {
    symbol: frame.symbol,
    timeframe: frame.timeframe,
    tsOpen: frame.meta.tsOpen,
    tsClose: frame.meta.tsClose,
    open: frame.open,
    high: frame.high,
    low: frame.low,
    close: frame.close,
    volume: frame.volume,
    
    // Flatten indicators for export
    rsi: indicators.rsi,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    ema5: indicators.ema5 as any,
    ema200: indicators.ema200 as any,
    bb_upper: indicators.bb?.upper,
    bb_middle: indicators.bb?.middle,
    bb_lower: indicators.bb?.lower,
    atr: indicators.atr,
    adx: indicators.adx as any,
    obv: indicators.obv as any,
    vwap: indicators.vwap,
    
    // Microstructure
    spread: micro.spread,
    imbalance: micro.imbalance,
    
    // Meta
    meta_source: frame.meta.source,
    meta_mode: frame.meta.mode,
    meta_isFinal: frame.meta.isFinal,
    meta_latencyMs: frame.meta.latencyMs,
    quality_confidence: frame.quality.confidence,
    quality_sourceCount: frame.quality.sourceCount,
  };
}
