/**
 * Pattern Detection Contribution
 * 
 * Wraps SignalClassifier and MarketStructureEngine outputs
 * Provides pattern-based trading signals as 6th source
 * 
 * Integrated Patterns:
 * - SUPPORT_BOUNCE (with volume validation)
 * - BREAKOUT (with structure confirmation)
 * - REVERSAL (with energy confirmation)
 * - CONFLUENCE (multiple patterns aligning)
 * - MA_CROSSOVER, RSI_EXTREME, etc.
 */

import type { StrategyContribution } from './unified-signal-aggregator';

export interface PatternSignal {
  pattern: string;
  confidence: number;
  strength: number;
  reasoning: string;
  supportLevel?: number;
  resistanceLevel?: number;
  volumeConfirmed?: boolean;
  priceActionConfirmed?: boolean;
}

export interface PatternDetectionResult {
  primaryPattern: string;
  patterns: PatternSignal[];
  confidence: number;
  strength: number;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  confluenceCount: number;
  reasoning: string;
}

export class PatternDetectionEngine {
  /**
   * Detect patterns from price action and technical indicators
   */
  static detectPatterns(
    currentPrice: number,
    prevPrice: number,
    support?: number,
    resistance?: number,
    volume?: number,
    prevVolume?: number,
    rsi?: number,
    macd?: { macd?: number; signal?: number; histogram?: number },
    ema20?: number,
    ema50?: number,
    sma200?: number,
    bollingerBands?: { upper?: number; middle?: number; lower?: number },
    atr?: number,
    volatility?: number
  ): PatternDetectionResult {
    const patterns: PatternSignal[] = [];
    let confluenceCount = 0;

    // ========== PATTERN 1: SUPPORT BOUNCE ==========
    // Price bouncing off support with volume confirmation
    if (support && prevPrice <= support && currentPrice > support) {
      const volumeConfirmed = volume && prevVolume ? volume / prevVolume > 1.5 : false;
      const priceActionConfirmed = support ? (currentPrice - support) / support > 0.02 : false;

      if (volumeConfirmed || priceActionConfirmed) {
        let confidence = 0.75;
        let strength = 75;

        if (volumeConfirmed) {
          confidence = Math.min(0.90, confidence + 0.08);
          strength = Math.min(100, strength + 12);
        }
        if (priceActionConfirmed) {
          confidence = Math.min(0.90, confidence + 0.05);
          strength = Math.min(100, strength + 8);
        }

        patterns.push({
          pattern: 'SUPPORT_BOUNCE',
          confidence,
          strength,
          supportLevel: support,
          volumeConfirmed,
          priceActionConfirmed,
          reasoning: `Bounce from support ${support?.toFixed(2)} ${volumeConfirmed ? '(volume confirmed)' : ''} ${priceActionConfirmed ? '(price action confirmed)' : ''}`
        });
        confluenceCount += volumeConfirmed || priceActionConfirmed ? 1 : 0;
      }
    }

    // ========== PATTERN 2: RESISTANCE BREAK ==========
    // Price breaking above resistance
    if (resistance && prevPrice <= resistance && currentPrice > resistance) {
      const volumeConfirmed = volume && prevVolume ? volume / prevVolume > 1.3 : false;
      const breakSize = (currentPrice - resistance) / resistance;

      let confidence = 0.75;
      let strength = 75;

      if (volumeConfirmed) {
        confidence = Math.min(0.95, confidence + 0.10);
        strength = Math.min(100, strength + 15);
      }
      if (breakSize > 0.015) {
        // Strong break (>1.5%)
        confidence = Math.min(0.95, confidence + 0.05);
        strength = Math.min(100, strength + 10);
      }

      patterns.push({
        pattern: 'RESISTANCE_BREAK',
        confidence,
        strength,
        resistanceLevel: resistance,
        volumeConfirmed,
        reasoning: `Break above resistance ${resistance?.toFixed(2)} with ${breakSize > 0.015 ? 'strong' : 'normal'} breakaway${volumeConfirmed ? ' (volume confirmed)' : ''}`
      });
      confluenceCount++;
    }

    // ========== PATTERN 3: BREAKOUT ==========
    // Price breaking out of range/consolidation
    if (bollingerBands?.upper && currentPrice > bollingerBands.upper) {
      const volumeConfirmed = volume && prevVolume ? volume / prevVolume > 1.3 : false;

      let confidence = 0.80;
      let strength = 80;

      if (volumeConfirmed) {
        confidence = Math.min(0.95, confidence + 0.10);
        strength = Math.min(100, strength + 15);
      }

      patterns.push({
        pattern: 'BREAKOUT',
        confidence,
        strength,
        volumeConfirmed,
        reasoning: `Breakout above Bollinger upper band ${volumeConfirmed ? '(volume confirmed)' : ''}`
      });
      confluenceCount++;
    }

    // ========== PATTERN 4: REVERSAL ==========
    // Price reversing from extreme RSI levels
    if (rsi) {
      if (rsi < 30 && currentPrice > prevPrice) {
        // Bullish reversal
        const volumeConfirmed = volume && prevVolume ? volume / prevVolume > 1.2 : false;

        patterns.push({
          pattern: 'REVERSAL_BULLISH',
          confidence: volumeConfirmed ? 0.85 : 0.75,
          strength: volumeConfirmed ? 85 : 75,
          volumeConfirmed,
          reasoning: `Bullish reversal from oversold RSI ${rsi?.toFixed(0)} ${volumeConfirmed ? '(volume spike)' : ''}`
        });
        confluenceCount += volumeConfirmed ? 1 : 0;
      } else if (rsi > 70 && currentPrice < prevPrice) {
        // Bearish reversal
        const volumeConfirmed = volume && prevVolume ? volume / prevVolume > 1.2 : false;

        patterns.push({
          pattern: 'REVERSAL_BEARISH',
          confidence: volumeConfirmed ? 0.85 : 0.75,
          strength: volumeConfirmed ? 85 : 75,
          volumeConfirmed,
          reasoning: `Bearish reversal from overbought RSI ${rsi?.toFixed(0)} ${volumeConfirmed ? '(volume spike)' : ''}`
        });
        confluenceCount += volumeConfirmed ? 1 : 0;
      }
    }

    // ========== PATTERN 5: MA CROSSOVER ==========
    // EMA20 crossing above/below EMA50
    if (ema20 && ema50) {
      if (prevPrice <= ema50 && currentPrice > ema20 && ema20 > ema50) {
        // Bullish crossover
        patterns.push({
          pattern: 'MA_CROSSOVER_BULLISH',
          confidence: 0.80,
          strength: 80,
          reasoning: `EMA20 (${ema20?.toFixed(2)}) crossed above EMA50 (${ema50?.toFixed(2)})`
        });
        confluenceCount++;
      } else if (prevPrice >= ema50 && currentPrice < ema20 && ema20 < ema50) {
        // Bearish crossover
        patterns.push({
          pattern: 'MA_CROSSOVER_BEARISH',
          confidence: 0.80,
          strength: 80,
          reasoning: `EMA20 (${ema20?.toFixed(2)}) crossed below EMA50 (${ema50?.toFixed(2)})`
        });
        confluenceCount++;
      }
    }

    // ========== PATTERN 6: MACD SIGNAL ==========
    // MACD histogram crossing zero or signal line crossover
    if (macd?.histogram !== undefined) {
      if (macd.histogram > 0 && (!macd.macd || !macd.signal || macd.macd > macd.signal)) {
        // Bullish MACD
        patterns.push({
          pattern: 'MACD_BULLISH',
          confidence: 0.75,
          strength: 75,
          reasoning: `MACD bullish signal (histogram positive)`
        });
        confluenceCount++;
      } else if (macd.histogram < 0 && (!macd.macd || !macd.signal || macd.macd < macd.signal)) {
        // Bearish MACD
        patterns.push({
          pattern: 'MACD_BEARISH',
          confidence: 0.75,
          strength: 75,
          reasoning: `MACD bearish signal (histogram negative)`
        });
        confluenceCount++;
      }
    }

    // ========== PATTERN 7: CONFLUENCE ==========
    // Multiple patterns confirming same direction
    const bullishCount = patterns.filter(p => 
      p.pattern.includes('BULLISH') || p.pattern === 'SUPPORT_BOUNCE' || p.pattern === 'RESISTANCE_BREAK' || p.pattern === 'BREAKOUT'
    ).length;
    const bearishCount = patterns.filter(p => p.pattern.includes('BEARISH')).length;

    if (bullishCount >= 3) {
      patterns.push({
        pattern: 'CONFLUENCE_BULLISH',
        confidence: Math.min(0.95, 0.70 + bullishCount * 0.10),
        strength: Math.min(100, 70 + bullishCount * 10),
        reasoning: `${bullishCount} bullish patterns confluent (REVERSAL + MA + SUPPORT)`
      });
      confluenceCount++;
    } else if (bearishCount >= 3) {
      patterns.push({
        pattern: 'CONFLUENCE_BEARISH',
        confidence: Math.min(0.95, 0.70 + bearishCount * 0.10),
        strength: Math.min(100, 70 + bearishCount * 10),
        reasoning: `${bearishCount} bearish patterns confluent`
      });
      confluenceCount++;
    }

    // ========== Determine Primary Pattern & Trend ==========
    const sortedPatterns = patterns.sort((a, b) => b.confidence - a.confidence);
    const primaryPattern = sortedPatterns.length > 0 ? sortedPatterns[0].pattern : 'NONE';

    let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
    if (bullishCount > bearishCount) {
      trend = 'BULLISH';
    } else if (bearishCount > bullishCount) {
      trend = 'BEARISH';
    }

    // Overall confidence and strength
    const avgConfidence =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
        : 0.5;

    const avgStrength =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length
        : 50;

    return {
      primaryPattern,
      patterns: sortedPatterns,
      confidence: avgConfidence,
      strength: avgStrength,
      trend,
      confluenceCount,
      reasoning: `${primaryPattern} with ${confluenceCount} confluence factor(s) - ${patterns.length} patterns detected`
    };
  }

  /**
   * Convert pattern detection to StrategyContribution
   */
  static toStrategyContribution(
    patternResult: PatternDetectionResult,
    weight: number = 0.25
  ): StrategyContribution {
    return {
      name: 'Pattern Detection',
      weight,
      trend: patternResult.trend,
      strength: patternResult.strength,
      confidence: patternResult.confidence,
      buySignals: patternResult.patterns.filter(p => p.pattern.includes('BULLISH')).length,
      sellSignals: patternResult.patterns.filter(p => p.pattern.includes('BEARISH')).length,
      reason: `${patternResult.primaryPattern} - ${patternResult.reasoning}`
    };
  }
}

export default PatternDetectionEngine;
