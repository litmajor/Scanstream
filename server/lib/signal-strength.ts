// Standalone utility for signal strength calculation
// Usage: import { calculateSignalStrength } from './lib/signal-strength';

/**
 * Calculates a signal strength score (0-100) based on key indicators.
 * Ported from Python's calculate_signal_strength and matches SignalClassifier.calculateSignalStrength.
 */
export function calculateSignalStrength(
  momentumShort: number,
  momentumLong: number,
  rsi: number,
  macd: number,
  volumeRatio: number = 1.0
): number {
  let score = 50;
  const momentumScore = Math.min(Math.abs(momentumShort) * 1000, 15) + Math.min(Math.abs(momentumLong) * 500, 15);
  if (momentumShort > 0 && momentumLong > 0) score += momentumScore;
  else score -= momentumScore;
  if (rsi > 40 && rsi < 60) score += 5;
  else if (rsi > 70 || rsi < 30) score -= 10;
  score += macd > 0 ? Math.min(Math.abs(macd) * 50, 10) : -Math.min(Math.abs(macd) * 50, 10);
  if (volumeRatio > 1.2) score += 5;
  else if (volumeRatio < 0.8) score -= 3;
  return Math.max(0, Math.min(100, score));
}
