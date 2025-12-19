/**
 * Signal Object
 * 
 * Pre-computed signals derived from frame.indicators
 * Agents read these, not raw indicators
 * 
 * Rule: Computed ONCE per frame, consumed by MANY agents
 */

export interface SignalObject {
  // Trend signals (from EMA alignment, price position)
  trend: 'up' | 'down' | 'neutral';
  trendStrength: number; // 0–1, how confident in trend
  
  // Breakout signals (from volume profile, support/resistance)
  breakout: boolean;
  breakoutDirection: 'up' | 'down' | 'none';
  breakoutStrength: number; // 0–1
  
  // Momentum signals (from RSI, Stochastic)
  momentum: 'overbought' | 'oversold' | 'neutral';
  rsiLevel: number; // 0–100
  
  // Volatility signals (from Bollinger Bands, ATR)
  bbPosition: 'oversold' | 'normal' | 'overbought';
  bbWidth: number; // Band width relative to middle
  volatility: 'low' | 'medium' | 'high'; // From ATR
  atrValue: number;
  
  // Volume signals (from OBV, volume profile)
  volumeProfile: {
    poc: number; // Point of Control price
    accumulation: boolean; // High volume at lower price
    distribution: boolean; // High volume at higher price
  };
  
  // Mean reversion signals
  meanReversion: {
    distanceFromMean: number; // % distance from SMA/EMA
    reverting: boolean; // Price moving back toward mean
  };
  
  // Confluence signals (multiple indicators agree)
  confluenceScore: number; // 0–1, how many signals align
  confluenceLevel: 'weak' | 'medium' | 'strong'; // Derived from score
  
  // Advanced signals (if computed)
  ichimokuStatus?: {
    priceAboveCloud: boolean;
    cloudColor: 'bullish' | 'bearish';
    conversion: number;
    baseline: number;
  };
  
  adxTrend?: {
    value: number; // 0–100
    strength: 'weak' | 'moderate' | 'strong';
  };
  
  // Meta
  timestamp: number;
  source: 'scanner' | 'live' | 'replay'; // Where signal came from
}

/**
 * Quality assessment of signals
 * (Separate from quality metrics in DecisionContext)
 */
export interface SignalQuality {
  confidence: number; // 0–1, how much to trust these signals
  stale: boolean; // Signals older than expected
  incomplete: boolean; // Some indicators missing
  reasonCode?: string; // Human-readable reason
}

/**
 * Confidence calculator
 * Determines signal quality based on data freshness and indicator completeness
 */
export function calculateSignalQuality(
  indicators: Record<string, any>,
  dataAgeMs: number,
  maxAgeMs: number = 60000
): SignalQuality {
  // Check completeness
  const requiredIndicators = [
    'rsi', 'bb', 'ema', 'stoch', 'atr', 'adx', 'obv', 'vwap'
  ];
  const presentCount = requiredIndicators.filter(ind => 
    indicators[ind] !== undefined && indicators[ind] !== null
  ).length;
  const completeness = presentCount / requiredIndicators.length;

  // Check staleness
  const stale = dataAgeMs > maxAgeMs;

  // Confidence: high when complete and fresh, lower otherwise
  let confidence = completeness;
  if (stale) {
    confidence *= 0.5; // Halve confidence if stale
  }

  return {
    confidence,
    stale,
    incomplete: completeness < 1.0,
    reasonCode: stale ? 'stale_data' : completeness < 1.0 ? 'incomplete_indicators' : 'ok',
  };
}
