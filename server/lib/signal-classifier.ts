/**
 * Signal Classifier - Detailed pattern classification
 * Identifies specific trading patterns and mechanisms
 */

export type SignalClassification = 
  | "BREAKOUT" 
  | "REVERSAL" 
  | "CONTINUATION" 
  | "PULLBACK" 
  | "DIVERGENCE"
  | "SUPPORT_BOUNCE"
  | "RESISTANCE_BREAK"
  | "TREND_CONFIRMATION"
  | "CONSOLIDATION_BREAK"
  | "MA_CROSSOVER"
  | "RSI_EXTREME"
  | "MACD_SIGNAL"
  | "CONFLUENCE"
  | "ML_PREDICTION";

export interface PatternDetails {
  pattern: SignalClassification;
  support?: number;
  resistance?: number;
  levels: number[];
  strength: number; // 0-100
  description: string;
}

export interface ClassificationResult {
  classification: SignalClassification;
  details: PatternDetails;
  confidence: number; // 0-1
  reasoning: string[];
}

export class SignalClassifier {
  /**
   * Classify signal based on technical indicators and price action
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
    const reasoning: string[] = [];
    let classification: SignalClassification = "CONFLUENCE";
    let confidence = 0.5;
    let strength = 50;

    // Breakout detection
    if (indicators.resistance && indicators.price > indicators.resistance) {
      classification = "BREAKOUT";
      confidence = 0.8;
      strength = 85;
      reasoning.push("Price broke above resistance level");
    }
    // Support bounce
    else if (indicators.support && indicators.price > indicators.support && indicators.prevPrice <= indicators.support) {
      classification = "SUPPORT_BOUNCE";
      confidence = 0.75;
      strength = 75;
      reasoning.push("Price bounced from support level");
    }
    // Resistance break
    else if (indicators.resistance && indicators.price < indicators.resistance && indicators.prevPrice >= indicators.resistance) {
      classification = "RESISTANCE_BREAK";
      confidence = 0.7;
      strength = 70;
      reasoning.push("Price rejected at resistance");
    }
    // MA crossover
    else if (indicators.ema20 && indicators.ema50) {
      if (indicators.prevPrice <= indicators.ema50 && indicators.price > indicators.ema20) {
        classification = "MA_CROSSOVER";
        confidence = 0.72;
        strength = 72;
        reasoning.push("EMA20 crossed above EMA50 - bullish signal");
      }
    }
    // RSI extreme
    else if (indicators.rsi) {
      if (indicators.rsi > 80) {
        classification = "RSI_EXTREME";
        confidence = 0.65;
        strength = 65;
        reasoning.push("RSI in overbought territory (>80) - potential reversal");
      } else if (indicators.rsi < 20) {
        classification = "RSI_EXTREME";
        confidence = 0.65;
        strength = 65;
        reasoning.push("RSI in oversold territory (<20) - potential bounce");
      }
    }
    // MACD signal
    else if (indicators.macd?.histogram !== undefined) {
      if (indicators.macd.histogram > 0 && (indicators.macd.macd || 0) > (indicators.macd.signal || 0)) {
        classification = "MACD_SIGNAL";
        confidence = 0.68;
        strength = 68;
        reasoning.push("MACD histogram positive - bullish momentum");
      }
    }
    // Divergence
    else if (indicators.divergence) {
      classification = "DIVERGENCE";
      confidence = 0.7;
      strength = 70;
      reasoning.push("Identified bullish/bearish divergence");
    }
    // Pullback into trend
    else if (indicators.ema20 && Math.abs(indicators.price - indicators.ema20) < Math.abs(indicators.ema20 * 0.02)) {
      classification = "PULLBACK";
      confidence = 0.6;
      strength = 60;
      reasoning.push("Price pulled back to EMA20 within trend");
    }
    // Trend confirmation
    else if (indicators.volume && indicators.prevVolume && indicators.volume > indicators.prevVolume * 1.2) {
      classification = "TREND_CONFIRMATION";
      confidence = 0.65;
      strength = 65;
      reasoning.push("Volume spike confirms trend");
    }

    const levels = [];
    if (indicators.support) levels.push(indicators.support);
    if (indicators.resistance) levels.push(indicators.resistance);
    if (indicators.ema20) levels.push(indicators.ema20);
    if (indicators.ema50) levels.push(indicators.ema50);

    const details: PatternDetails = {
      pattern: classification,
      support: indicators.support,
      resistance: indicators.resistance,
      levels,
      strength,
      description: this.getPatternDescription(classification)
    };

    return {
      classification,
      details,
      confidence,
      reasoning
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
      ML_PREDICTION: "Machine learning model predicts direction with high confidence"
    };
    return descriptions[classification] || "Signal detected";
  }
}
