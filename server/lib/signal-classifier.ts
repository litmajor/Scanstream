/**
 * Signal Classifier - Multi-pattern detection
 * Identifies MULTIPLE trading patterns and mechanisms in a single signal
 */

export type SignalClassification =
  | 'BREAKOUT'
  | 'REVERSAL'
  | 'CONTINUATION'
  | 'PULLBACK'
  | 'DIVERGENCE'
  | 'SUPPORT_BOUNCE'
  | 'RESISTANCE_BREAK'
  | 'TREND_CONFIRMATION'
  | 'CONSOLIDATION_BREAK'
  | 'MA_CROSSOVER'
  | 'RSI_EXTREME'
  | 'MACD_SIGNAL'
  | 'CONFLUENCE'
  | 'ML_PREDICTION'
  | 'PARABOLIC'
  | 'BULL_EARLY'
  | 'BEAR_EARLY'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'SPIKE';
  // Removed redundant patterns: TOPPING, BOTTOMING, RANGING, LAGGING, LEADING, TREND_EXHAUSTION, TREND_ESTABLISHMENT, RETEST, FLIP

export interface PatternMatch {
  pattern: SignalClassification;
  confidence: number; // 0-1
  strength: number; // 0-100
  reasoning: string;
}

export interface PatternDetails {
  pattern: SignalClassification;
  support?: number;
  resistance?: number;
  levels: number[];
  strength: number; // 0-100
  description: string;
}

export interface ClassificationResult {
  classifications: SignalClassification[]; // MULTIPLE patterns
  patterns: PatternMatch[]; // Detailed match data
  primaryPattern: SignalClassification; // Highest confidence
  overallConfidence: number; // 0-1
  overallStrength: number; // 0-100
  reasoning: string[];
  patternDetails: PatternDetails[];
}

export class SignalClassifier {
  private accuracyEngine: any; // Will be injected

  constructor(accuracyEngine?: any) {
    this.accuracyEngine = accuracyEngine;
  }

  /**
   * Classify signal - detects MULTIPLE patterns
   */
  classifySignal(indicators: {
    rsi?: number;
    macd?: { macd?: number; signal?: number; histogram?: number };
    bollingerBands?: { upper?: number; middle?: number; lower?: number };
    ema20?: number;
    ema50?: number;
    price: number;
    prevPrice: number;
    support?: number;
    resistance?: number;
    volume?: number;
    prevVolume?: number;
    divergence?: boolean;
  }): ClassificationResult {
    const patterns: PatternMatch[] = [];
    const reasoning: string[] = [];

    // Check BREAKOUT
    if (indicators.resistance && indicators.price > indicators.resistance) {
      patterns.push({
        pattern: "BREAKOUT",
        confidence: 0.8,
        strength: 85,
        reasoning: "Price broke above resistance level"
      });
    }

    // Check SUPPORT_BOUNCE (v2 - Enhanced with volume & price action confirmation)
    if (indicators.support && indicators.price > indicators.support && indicators.prevPrice <= indicators.support) {
      let confidence = 0.75; // Base confidence
      let strength = 75;
      let volumeConfirmed = false;
      let priceActionConfirmed = false;
      let reasoning = "Price bounced from support level";

      // VOLUME CONFIRMATION: Volume spike validates institutional buying at support
      if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 1.5) {
        confidence += 0.05; // Boost to 0.80
        strength += 5;
        volumeConfirmed = true;
        reasoning += " + volume confirmation";
      }

      // PRICE ACTION REVERSAL: Price moves meaningfully away from support (strong recovery)
      const priceStrength = (indicators.price - indicators.support) / indicators.support;
      if (priceStrength > 0.02) { // Price moved >2% above support = strong recovery
        confidence += 0.05; // Boost to 0.85 (or 0.80 if no volume)
        strength += 5;
        priceActionConfirmed = true;
        reasoning += " + strong price action recovery";
      }

      // Cap confidence at 0.90 (excellent quality)
      confidence = Math.min(0.90, confidence);
      strength = Math.min(100, strength);

      // Only add if at least one confirmation present (volume OR price action)
      // This filters out weak bounces without institutional support
      if (volumeConfirmed || priceActionConfirmed) {
        patterns.push({
          pattern: "SUPPORT_BOUNCE",
          confidence,
          strength,
          reasoning
        });
      }
    }

    // Check RESISTANCE_BREAK
    if (indicators.resistance && indicators.price < indicators.resistance && indicators.prevPrice >= indicators.resistance) {
      patterns.push({
        pattern: "RESISTANCE_BREAK",
        confidence: 0.7,
        strength: 70,
        reasoning: "Price rejected at resistance"
      });
    }

    // Check MA_CROSSOVER
    if (indicators.ema20 && indicators.ema50) {
      if (indicators.prevPrice <= indicators.ema50 && indicators.price > indicators.ema20) {
        patterns.push({
          pattern: "MA_CROSSOVER",
          confidence: 0.72,
          strength: 72,
          reasoning: "EMA20 crossed above EMA50 - bullish signal"
        });
      }
    }

    // Check RSI_EXTREME
    if (indicators.rsi) {
      if (indicators.rsi > 80 || indicators.rsi < 20) {
        patterns.push({
          pattern: "RSI_EXTREME",
          confidence: 0.65,
          strength: 65,
          reasoning: `RSI at ${indicators.rsi > 80 ? "overbought" : "oversold"} level`
        });
      }
    }

    // Check MACD_SIGNAL
    if (indicators.macd?.histogram !== undefined) {
      if (indicators.macd.histogram > 0 && (indicators.macd.macd || 0) > (indicators.macd.signal || 0)) {
        patterns.push({
          pattern: "MACD_SIGNAL",
          confidence: 0.68,
          strength: 68,
          reasoning: "MACD histogram positive - bullish momentum"
        });
      }
    }

    // Check DIVERGENCE
    if (indicators.divergence) {
      patterns.push({
        pattern: "DIVERGENCE",
        confidence: 0.7,
        strength: 70,
        reasoning: "Identified bullish/bearish divergence"
      });
    }

    // Check PULLBACK
    if (indicators.ema20 && Math.abs(indicators.price - indicators.ema20) < Math.abs(indicators.ema20 * 0.02)) {
      patterns.push({
        pattern: "PULLBACK",
        confidence: 0.6,
        strength: 60,
        reasoning: "Price pulled back to EMA20 within trend"
      });
    }

    // Check TREND_CONFIRMATION
    if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 1.2) {
      patterns.push({
        pattern: "TREND_CONFIRMATION",
        confidence: 0.65,
        strength: 65,
        reasoning: "Volume spike confirms trend"
      });
    }

    // Check PARABOLIC
    if (indicators.price && indicators.prevPrice && Math.abs((indicators.price - indicators.prevPrice) / indicators.prevPrice) > 0.05) {
      patterns.push({
        pattern: "PARABOLIC",
        confidence: 0.58,
        strength: 58,
        reasoning: "Parabolic move detected - >5% move in single period"
      });
    }

    // Check ACCUMULATION
    if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 1.5 && indicators.price > indicators.prevPrice) {
      patterns.push({
        pattern: "ACCUMULATION",
        confidence: 0.62,
        strength: 62,
        reasoning: "High volume on up move - accumulation phase"
      });
    }

    // Check DISTRIBUTION
    if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 1.5 && indicators.price < indicators.prevPrice) {
      patterns.push({
        pattern: "DISTRIBUTION",
        confidence: 0.62,
        strength: 62,
        reasoning: "High volume on down move - distribution phase"
      });
    }

    // Check SPIKE
    if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 2) {
      patterns.push({
        pattern: "SPIKE",
        confidence: 0.55,
        strength: 55,
        reasoning: "Volume spike detected - temporary spike move"
      });
    }

    // If multiple patterns detected, add CONFLUENCE
    if (patterns.length > 2) {
      patterns.unshift({
        pattern: "CONFLUENCE",
        confidence: Math.min(0.95, 0.7 + (patterns.length * 0.05)),
        strength: Math.min(100, 70 + (patterns.length * 5)),
        reasoning: `Multiple patterns align - ${patterns.length} independent signals detected`
      });
    }

    // Build result
    const classifications = patterns.map(p => p.pattern);
    const primaryPattern = patterns.length > 0 ? patterns[0].pattern : "CONFLUENCE";
    const avgConfidence = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0.5;
    const avgStrength = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length
      : 50;

    patterns.forEach(p => reasoning.push(p.reasoning));

    const levels: number[] = [];
    if (indicators.support) levels.push(indicators.support);
    if (indicators.resistance) levels.push(indicators.resistance);
    if (indicators.ema20) levels.push(indicators.ema20);
    if (indicators.ema50) levels.push(indicators.ema50);

    const patternDetails = patterns.map(p => ({
      pattern: p.pattern,
      support: indicators.support,
      resistance: indicators.resistance,
      levels,
      strength: p.strength,
      description: this.getPatternDescription(p.pattern)
    }));

    return {
      classifications,
      patterns,
      primaryPattern,
      overallConfidence: avgConfidence,
      overallStrength: avgStrength,
      reasoning,
      patternDetails
    };
  }

  private getPatternDescription(classification: SignalClassification): string {
    const descriptions: Record<SignalClassification, string> = {
      BREAKOUT: "Price broke through key resistance - momentum continuation likely",
      REVERSAL: "Price reversed from previous trend - change of direction detected",
      CONTINUATION: "Price continues established trend - trend strength maintained",
      PULLBACK: "Price pulled back within trend - opportunity for trend entry",
      DIVERGENCE: "Indicator divergence detected - potential reversal signal",
      SUPPORT_BOUNCE: "Price bounced from support level - bullish continuation likely",
      RESISTANCE_BREAK: "Price rejected at resistance - bearish pressure",
      TREND_CONFIRMATION: "Volume surge confirms trend - high conviction signal",
      CONSOLIDATION_BREAK: "Price broke from consolidation range - directional breakout",
      MA_CROSSOVER: "Moving average crossover detected - trend change signal",
      RSI_EXTREME: "RSI at extreme levels - reversal or strong trend signal",
      MACD_SIGNAL: "MACD histogram shows momentum shift - directional signal",
      CONFLUENCE: "Multiple indicators align - high quality signal",
      ML_PREDICTION: "Machine learning model predicts direction with high confidence",
      PARABOLIC: "Steep acceleration detected - parabolic move underway or imminent reversal",
      BULL_EARLY: "Early stage bull market - accumulation phase with momentum building",
      BEAR_EARLY: "Early stage bear market - distribution phase with selling pressure",
      ACCUMULATION: "Price accumulating at support - large buyers accumulating positions",
      DISTRIBUTION: "Price distributing at resistance - large sellers offloading positions",
      SPIKE: "Sharp vertical move detected - spike or flash move pattern",
    };
    return descriptions[classification] || "Signal detected";
  }
}