/**
 * Quality Envelope Computation
 * 
 * Determines system confidence in data reliability deterministically.
 * 
 * RULE: Never computed in agents. Only at frame assembly time.
 * RULE: Deterministic, explainable, conservative.
 * RULE: Confidence is 0–1, always explicit.
 */

import type { FrameQuality } from '../types/MarketFrame';

/**
 * Configuration for confidence scoring
 */
export interface ConfidenceScoringConfig {
  /** Expected number of sources for "good" confidence */
  expectedSourceCount: number;

  /** Maximum acceptable latency (ms) for "good" confidence */
  maxAcceptableLatencyMs: number;

  /** Confidence multiplier when using fallback data */
  fallbackPenalty: number; // 0–1, typically 0.5

  /** Minimum confidence floor (never go below this) */
  minConfidence: number; // typically 0.1
}

/** Default configuration (conservative) */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceScoringConfig = {
  expectedSourceCount: 1,        // Single exchange is expected
  maxAcceptableLatencyMs: 2000,  // 2 seconds is acceptable
  fallbackPenalty: 0.5,          // Fallback data cuts confidence in half
  minConfidence: 0.1,            // Never go below 0.1 (always some confidence)
};

/**
 * Score sources contribution
 * 
 * More sources = higher confidence
 * All sources agree = highest confidence
 */
function scoreSourceCount(
  sourceCount: number,
  expectedSources: number
): number {
  // Clamped ratio: 1 source = 1.0, more sources bonus
  return Math.min(sourceCount / expectedSources, 1.0);
}

/**
 * Score latency impact
 * 
 * No latency = 1.0
 * Max acceptable latency = 0.5
 * Beyond acceptable = 0.25
 */
function scoreLatency(maxLatencyMs: number, maxAcceptableMs: number): number {
  if (maxLatencyMs <= 0) return 1.0;
  if (maxLatencyMs <= maxAcceptableMs) {
    // Linear decay from 1.0 to 0.5
    return 1.0 - (maxLatencyMs / maxAcceptableMs) * 0.5;
  }
  // Beyond acceptable, steep penalty
  return Math.max(0.25, 1.0 - (maxLatencyMs / (maxAcceptableMs * 2)));
}

/**
 * Score fallback status
 * 
 * Live data = 1.0 (no penalty)
 * Fallback data = configurable penalty (typically 0.5)
 */
function scoreFallback(isFallback: boolean, fallbackPenalty: number): number {
  return isFallback ? fallbackPenalty : 1.0;
}

/**
 * Compute confidence score deterministically
 * 
 * Formula:
 * confidence = clamp(
 *   sourceScore * latencyScore * fallbackScore,
 *   minConfidence,
 *   1.0
 * )
 */
export function computeConfidence(
  sourceCount: number,
  maxLatencyMs: number,
  isFallback: boolean,
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): number {
  const sourceScore = scoreSourceCount(sourceCount, config.expectedSourceCount);
  const latencyScore = scoreLatency(maxLatencyMs, config.maxAcceptableLatencyMs);
  const fallbackScore = scoreFallback(isFallback, config.fallbackPenalty);

  // Multiply all scores
  const confidence = sourceScore * latencyScore * fallbackScore;

  // Clamp to valid range
  return Math.max(config.minConfidence, Math.min(confidence, 1.0));
}

/**
 * Explain why confidence is what it is
 * (For debugging and auditability)
 */
export function explainConfidence(
  sourceCount: number,
  maxLatencyMs: number,
  isFallback: boolean,
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): string {
  const sourceScore = scoreSourceCount(sourceCount, config.expectedSourceCount);
  const latencyScore = scoreLatency(maxLatencyMs, config.maxAcceptableLatencyMs);
  const fallbackScore = scoreFallback(isFallback, config.fallbackPenalty);
  const confidence = computeConfidence(sourceCount, maxLatencyMs, isFallback, config);

  return (
    `Confidence: ${confidence.toFixed(2)}\n` +
    `  Sources: ${sourceCount}/${config.expectedSourceCount} = ${sourceScore.toFixed(2)}\n` +
    `  Latency: ${maxLatencyMs}ms (max acceptable: ${config.maxAcceptableLatencyMs}ms) = ${latencyScore.toFixed(2)}\n` +
    `  Fallback: ${isFallback ? 'YES' : 'NO'} (penalty: ${fallbackScore.toFixed(2)})\n` +
    `  Product: ${(sourceScore * latencyScore * fallbackScore).toFixed(2)}`
  );
}

/**
 * Build FrameQuality from raw data
 * 
 * IMPORTANT: Called during frame assembly, not in agents, not in storage.
 */
export function buildFrameQuality(
  sourceCount: number,
  maxLatencyMs: number,
  isFallback: boolean,
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): FrameQuality {
  const confidence = computeConfidence(sourceCount, maxLatencyMs, isFallback, config);
  const now = Date.now();

  return {
    sourceCount,
    maxLatencyMs,
    isFallback,
    confidence,
    confidenceReason: explainConfidence(sourceCount, maxLatencyMs, isFallback, config),
    evaluatedAt: now,
  };
}

/**
 * Batch build quality for multiple frames
 */
export function buildFrameQualityBatch(
  frames: Array<{
    sourceCount: number;
    maxLatencyMs: number;
    isFallback: boolean;
  }>,
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): FrameQuality[] {
  return frames.map(f =>
    buildFrameQuality(f.sourceCount, f.maxLatencyMs, f.isFallback, config)
  );
}

/**
 * Merge multiple qualities (e.g., multi-timeframe)
 * Takes the minimum confidence (conservative)
 */
export function mergeFrameQualities(qualities: FrameQuality[]): FrameQuality {
  if (qualities.length === 0) {
    return buildFrameQuality(0, 0, true); // Worst case
  }

  const minConfidence = Math.min(...qualities.map(q => q.confidence));
  const maxLatency = Math.max(...qualities.map(q => q.maxLatencyMs));
  const anyFallback = qualities.some(q => q.isFallback);
  const totalSources = qualities.reduce((sum, q) => sum + q.sourceCount, 0);

  return {
    sourceCount: totalSources,
    maxLatencyMs: maxLatency,
    isFallback: anyFallback,
    confidence: minConfidence,
    confidenceReason: `Merged from ${qualities.length} qualities (min confidence: ${minConfidence.toFixed(2)})`,
    evaluatedAt: Date.now(),
  };
}

/**
 * Assess quality at runtime (for decision making)
 */
export function assessQualityStatus(quality: FrameQuality): {
  level: 'high' | 'medium' | 'low' | 'degraded';
  safe: boolean;
} {
  if (quality.isFallback) {
    return { level: 'degraded', safe: false };
  }

  if (quality.confidence >= 0.8) {
    return { level: 'high', safe: true };
  }

  if (quality.confidence >= 0.6) {
    return { level: 'medium', safe: true };
  }

  return { level: 'low', safe: false };
}

/**
 * Example: How to use in ExchangeAggregator
 * 
 * ```ts
 * function aggregateMarketFrames(
 *   frames: MarketFrame[],
 *   config: ConfidenceScoringConfig
 * ): MarketFrame {
 *   // Aggregate OHLCV, indicators, etc.
 *   
 *   // Compute quality
 *   const quality = buildFrameQuality(
 *     frames.length,                    // sourceCount
 *     Math.max(...frames.map(f => f.meta.latencyMs)),  // maxLatencyMs
 *     frames.some(f => f.meta.source === 'FALLBACK'),  // isFallback
 *     config
 *   );
 *   
 *   return {
 *     ...aggregatedData,
 *     quality,  // Attach quality envelope
 *     meta: { ... }
 *   };
 * }
 * ```
 */
