// analytics.ts
// Advanced analytics and reporting utilities for trading signals
import { Signal } from '@shared/schema';

/**
 * Generate a markdown/text report of scan results, signal distribution, and top opportunities.
 * @param signals Array of Signal objects
 * @param topN Number of top signals to include
 */
export function generateReport(signals: Signal[], topN: number = 10): string {
  if (!signals.length) return 'No scan results available.';
  const now = new Date().toISOString();
  const signalCounts = signals.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sorted = [...signals].sort((a, b) => (b.signalStrengthScore ?? 0) - (a.signalStrengthScore ?? 0));
  const top = sorted.slice(0, topN);
  let report = `=== MOMENTUM SCANNER REPORT ===\nTimestamp: ${now}\nTotal Signals: ${signals.length}\n\n=== SIGNAL DISTRIBUTION ===\n`;
  for (const [type, count] of Object.entries(signalCounts)) {
    report += `${type}: ${count}\n`;
  }
  report += `\n=== TOP ${topN} OPPORTUNITIES ===\n`;
  for (const s of top) {
    report += `Symbol: ${s.symbol}\n`;
    report += `Signal: ${s.type} (Strength: ${(s.signalStrengthScore ?? 0).toFixed(1)})\n`;
    report += `Price: $${s.price}\n`;
    report += `Regime: ${s.regimeState ?? 'N/A'}\n`;
    report += `Legacy: ${s.legacyLabel ?? 'N/A'}\n`;
    report += `---\n`;
  }
  return report;
}

/**
 * Filter and sort top signals by type and minimum strength.
 */
export function getTopSignals(signals: Signal[], types?: string[], minStrength: number = 70): Signal[] {
  let filtered = signals.filter(s => (s.signalStrengthScore ?? 0) >= minStrength);
  if (types && types.length) filtered = filtered.filter(s => types.includes(s.type));
  return filtered.sort((a, b) => (b.signalStrengthScore ?? 0) - (a.signalStrengthScore ?? 0));
}

/**
 * Summarize market regime based on average momentum and RSI.
 */
export function getMarketRecommendation(signals: Signal[]): string {
  if (!signals.length) return 'NO DATA';
  const avgMomentum = signals.reduce((a, s) => a + (s.strength ?? 0), 0) / signals.length;
  // RSI property does not exist on Signal, so we only use avgMomentum for recommendations.
  if (avgMomentum > 0.05) return 'BULLISH - Strong upward momentum';
  if (avgMomentum > 0.02) return 'MODERATELY BULLISH - Steady upward trend';
  if (avgMomentum > -0.02 && avgMomentum < 0.02) return 'NEUTRAL - Sideways movement';
  if (avgMomentum < -0.02) return 'BEARISH - Downward pressure';
  if (avgMomentum < -0.05) return 'VERY BEARISH - Strong selling pressure';
  return 'MIXED - Analyze individual signals carefully';
}
