/**
 * VFMD System Type Definitions
 * TypeScript port of Python VFMD system for early entry detection
 */

/**
 * Raw market tick with OHLCV data
 */
export interface MarketTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bidVolume?: number;
  askVolume?: number;
}

/**
 * 2D Vector Field representation
 * Shape: [spatial_bins, temporal_window, 2]
 * [:, :, 0] = x-component (price direction / velocity)
 * [:, :, 1] = y-component (temporal momentum / acceleration)
 */
export interface VectorField {
  data: number[][][]; // 3D array
  spatialBins: number;
  temporalWindow: number;
  priceMin: number;
  priceMax: number;
}

/**
 * Physics metrics computed from vector field
 */
export interface PhysicsMetrics {
  // Potential Energy Gradient: stored energy before release
  peg: number;

  // Turbulence Index: chaos/instability in flow
  turbulenceIndex: number;

  // Directional Coherence: how aligned is the field
  coherenceScore: number;
  dominantAngle: number;

  // Divergence: sources (positive) and sinks (negative)
  divergenceScore: number;
  recentDivergence: number;

  // Curl: vorticity / rotational chaos
  curlScore: number;
  recentCurl: number;

  // Gradient magnitude: where is the action
  gradientMagnitude: number;
}

/**
 * Early Entry Detection Signals
 */
export interface EarlyEntrySignal {
  // Signal quality
  confidence: number; // 0-1
  strength: number; // 0-1 (magnitude of setup)
  type: 'bullish' | 'bearish' | 'neutral';

  // Interpretable metrics
  volatilityRegime: 'low' | 'medium' | 'high';
  imbalanceScore: number; // -1 to +1, positive = buy pressure
  pressureGradient: number; // rate of change of pressure
  flowMomentum: number; // -1 to +1

  // Entry guidance
  suggestedEntry: number;
  suggestedTarget: number;
  suggestedStop: number;

  // Explanation
  reason: string;
  factors: string[];
}

/**
 * Complete VFMD Analysis Output
 */
export interface VFMDAnalysis {
  // Physics
  metrics: PhysicsMetrics;

  // Early entry opportunity
  earlyEntry: EarlyEntrySignal;

  // Context
  currentPrice: number;
  volatility: number;
  recentTrend: number; // -1 to +1

  // Raw data for visualization
  fieldSnapshot: {
    spatial: number[];
    temporal: number[];
    vectorMagnitudes: number[];
  };

  timestamp: number;
  dataPointsProcessed: number;
}
