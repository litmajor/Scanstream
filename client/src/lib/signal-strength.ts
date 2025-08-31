import { loadFrontendConfig } from '../lib/config';
let signalConfig: any = null;
loadFrontendConfig().then(config => {
  signalConfig = config.signalStrength || {};
});
// Standalone utility for signal strength calculation (frontend)
// Usage: import { calculateSignalStrength } from './signal-strength';

/**
 * Calculates a signal strength score (0-100) based on key indicators.
 * Ported from Python's calculate_signal_strength and matches backend logic.
 */
export function calculateSignalStrength(
  momentumShort: number,
  momentumLong: number,
  rsi: number,
  macd: number,
  volumeRatio: number = 1.0
): number {
  let score = signalConfig.baseScore ?? 50;
  const momentumShortFactor = signalConfig.momentumShortFactor ?? 1000;
  const momentumLongFactor = signalConfig.momentumLongFactor ?? 500;
  const momentumShortMax = signalConfig.momentumShortMax ?? 15;
  const momentumLongMax = signalConfig.momentumLongMax ?? 15;
  const rsiMidLow = signalConfig.rsiMidLow ?? 40;
  const rsiMidHigh = signalConfig.rsiMidHigh ?? 60;
  const rsiExtremeLow = signalConfig.rsiExtremeLow ?? 30;
  const rsiExtremeHigh = signalConfig.rsiExtremeHigh ?? 70;
  const rsiMidBonus = signalConfig.rsiMidBonus ?? 5;
  const rsiExtremePenalty = signalConfig.rsiExtremePenalty ?? 10;
  const macdFactor = signalConfig.macdFactor ?? 50;
  const macdMax = signalConfig.macdMax ?? 10;
  const volumeHigh = signalConfig.volumeHigh ?? 1.2;
  const volumeLow = signalConfig.volumeLow ?? 0.8;
  const volumeHighBonus = signalConfig.volumeHighBonus ?? 5;
  const volumeLowPenalty = signalConfig.volumeLowPenalty ?? 3;

  const momentumScore = Math.min(Math.abs(momentumShort) * momentumShortFactor, momentumShortMax) + Math.min(Math.abs(momentumLong) * momentumLongFactor, momentumLongMax);
  if (momentumShort > 0 && momentumLong > 0) score += momentumScore;
  else score -= momentumScore;
  if (rsi > rsiMidLow && rsi < rsiMidHigh) score += rsiMidBonus;
  else if (rsi > rsiExtremeHigh || rsi < rsiExtremeLow) score -= rsiExtremePenalty;
  score += macd > 0 ? Math.min(Math.abs(macd) * macdFactor, macdMax) : -Math.min(Math.abs(macd) * macdFactor, macdMax);
  if (volumeRatio > volumeHigh) score += volumeHighBonus;
  else if (volumeRatio < volumeLow) score -= volumeLowPenalty;
  return Math.max(0, Math.min(100, score));
}
