import type { MarketFrame } from './continuous-scanner';
import * as indicators from './indicators';
import { vwap, volumeProfile, fibLevels } from './indicators';
import SignalClassifier from './signal-classifier';
import { SignalClassifier as LibSignalClassifier } from '../../lib/signal-classifier';
import RiskManagement from './risk-management';
import MarketRegimeDetector from './market-regime-detector';
import { getRegimeService } from '../regime-service';
import type { RegimeContext as ArmRegimeContext } from '../../arm-evaluator';
import { QualityGating } from './quality-gating';

export interface MomentumScoreResult {
  score: number; // -1 .. +1
  signal: string; // 'Strong Buy' | 'Buy' | 'Weak Buy' | 'Neutral' | 'Weak Sell' | 'Sell' | 'Strong Sell'
  signalStrength: number; // 0-100
  confidence: number; // 0-1
  reason?: string;
  regime?: string;
  regimeConfidence?: number;
  indicators?: Record<string, any>;
  
  // === QUALITY GATING ===
  passesQualityGate?: boolean; // true if signal meets quality threshold
  qualityGateReason?: string; // Why it passed or failed
}

/**
 * MomentumScanner - Enhanced with Signal Classification & Regime Detection
 * 
 * Complete port of Python momentum scanner with:
 * - Technical indicator computation (MACD, RSI, Slope, Volume)
 * - Signal classification (Strong Buy/Sell, Buy/Sell, etc.)
 * - Market regime detection (Bull/Bear/Ranging)
 * - Risk management integration
 * - Opportunity scoring
 */
export class MomentumScanner {
  static computeScore(frames: MarketFrame[]): MomentumScoreResult {
    if (!frames || frames.length < 5) {
      return {
        score: 0,
        signal: 'Neutral',
        signalStrength: 0,
        confidence: 0,
        reason: 'INSUFFICIENT_DATA',
        indicators: {}
      };
    }

    const closes = frames.map(f => f.price.close);
    const volumes = frames.map(f => f.volume ?? 0);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);

    // === INDICATOR CALCULATION ===

    // --- MACD ---
    const { macd: macdLine, signal: signalLine, histogram } = indicators.macd(closes);
    const lastIdx = closes.length - 1;
    const macdHistLast = Number.isNaN(histogram[lastIdx]) ? 0 : histogram[lastIdx];
    const macdHistPrev = lastIdx - 1 >= 0 && !Number.isNaN(histogram[lastIdx - 1]) ? histogram[lastIdx - 1] : 0;
    const macdMomentum = macdHistLast - macdHistPrev;

    // --- RSI ---
    const rsiArr = indicators.rsi(closes);
    const rsiLast = Number.isNaN(rsiArr[lastIdx]) ? 50 : rsiArr[lastIdx];

    // --- Slope ---
    const slopeVal = indicators.slope(closes, Math.min(10, closes.length));

    // --- Volume Metrics ---
    const meanPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
    const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volumes.length || 1);
    const volLast = volumes[volumes.length - 1] ?? 0;
    const volRatio = RiskManagement.calculateVolumeRatio(volumes, 20);

    // --- Momentum Periods ---
    const momentum1d = closes.length >= 1 ? (closes[lastIdx] - closes[Math.max(0, lastIdx - 1)]) / closes[Math.max(0, lastIdx - 1)] : 0;
    const momentum7d = closes.length >= 7
      ? (closes[lastIdx] - closes[Math.max(0, lastIdx - 7)]) / closes[Math.max(0, lastIdx - 7)]
      : momentum1d;
    const momentum30d = closes.length >= 30
      ? (closes[lastIdx] - closes[Math.max(0, lastIdx - 30)]) / closes[Math.max(0, lastIdx - 30)]
      : momentum7d;

    // --- Bollinger Bands Position ---
    const bbResult = indicators.bollingerBands(closes, 20, 2);
    const bbUpper = bbResult?.upper?.[lastIdx] ?? meanPrice * 1.02;
    const bbLower = bbResult?.lower?.[lastIdx] ?? meanPrice * 0.98;
    const bbPosition = RiskManagement.calculateBBPosition(closes[lastIdx], bbUpper, bbLower);

    // --- VWAP & Volume Profile ---
    const vwapArr = vwap(closes, volumes, 20);
    const vwapLast = Number.isNaN(vwapArr[lastIdx]) ? meanPrice : vwapArr[lastIdx];
    const vwapGap = (closes[lastIdx] - vwapLast) / vwapLast;

    // --- Fibonacci Levels ---
    const fib = fibLevels(highs, lows, closes, Math.min(55, closes.length));

    // === MARKET REGIME DETECTION ===
    const regimeResult = MarketRegimeDetector.detectRegime(closes, highs, lows, volumes);

    // === SIGNAL CLASSIFICATION ===
    // Best-effort: request central RegimeService and pass external regime to classifier
    let armRegime: ArmRegimeContext | undefined;
    // Note: Regime service is async and can't be used in sync context - skipped for now
    
    const signalResult = SignalClassifier.classifyMomentumSignal(
      momentum1d,
      momentum7d,
      rsiLast,
      macdHistLast,
      {
        momentumShort: 0.01,
        rsiMin: 50,
        rsiMax: 70,
        macdMin: 0
      },
      { ichimokuBullish: true },
      undefined,
      undefined,
      armRegime // pass external regime when available
    );

    // === STATE CLASSIFICATION ===
    const stateResult = SignalClassifier.classifyState(
      momentum1d,
      momentum7d,
      momentum30d,
      rsiLast,
      macdHistLast,
      bbPosition,
      volRatio
    );

    // === SIGNAL STRENGTH & CONFIDENCE ===
    const signalStrength = SignalClassifier.calculateSignalStrength(
      momentum1d,
      momentum7d,
      rsiLast,
      macdHistLast,
      volRatio
    );

    const confidence = SignalClassifier.calculateConfidenceScore(
      momentum1d,
      momentum7d,
      rsiLast,
      macdHistLast,
      regimeResult.trendStrength,
      volRatio
    );

    // === COMPOSITE SCORE ===
    const compositeScore = SignalClassifier.calculateCompositeScore(
      momentum1d,
      momentum7d,
      rsiLast,
      macdHistLast,
      regimeResult.trendStrength,
      volRatio,
      true, // ichimokuBullish
      0 // fibConfluence
    );

    // === CONVERT TO -1..1 SCORE ===
    const score = (compositeScore / 100 - 0.5) * 2; // Convert 0-100 to -1..1

    const reasonParts: string[] = [];
    reasonParts.push(`signal:${signalResult.signal}`);
    reasonParts.push(`regime:${regimeResult.regime}`);
    reasonParts.push(`state:${stateResult.state}`);
    reasonParts.push(`macd:${macdHistLast.toFixed(6)}`);
    reasonParts.push(`rsi:${rsiLast.toFixed(1)}`);
    reasonParts.push(`volRatio:${volRatio.toFixed(2)}`);

    // === QUALITY GATING ===
    const gateResult = QualityGating.passesQualityGate(confidence, signalStrength, (frames[0] as any)?.symbol || 'DEFAULT');

    return {
      score,
      signal: signalResult.signal,
      signalStrength: Math.round(signalStrength),
      confidence,
      reason: reasonParts.join(' | '),
      regime: regimeResult.regime,
      regimeConfidence: regimeResult.confidence / 100,
      passesQualityGate: gateResult.passesGate,
      qualityGateReason: gateResult.rejectionReason || gateResult.reason,
      indicators: {
        macdHistLast,
        macdHistPrev,
        macdMomentum,
        rsiLast,
        slope: slopeVal,
        momentum1d: Math.round(momentum1d * 10000) / 100,
        momentum7d: Math.round(momentum7d * 10000) / 100,
        momentum30d: Math.round(momentum30d * 10000) / 100,
        volRatio: Math.round(volRatio * 100) / 100,
        meanPrice,
        vwapLast,
        vwapGap: Math.round(vwapGap * 10000) / 100,
        bbPosition: Math.round(bbPosition * 100) / 100,
        bbUpper,
        bbLower,
        trendStrength: regimeResult.trendStrength,
        volatility: regimeResult.volatility,
        atrPct: regimeResult.atrPct,
        compositeScore,
        fib: {
          direction: fib?.direction || 'bull',
          retracements: (fib?.retracements?.length ?? 0) > 0 ? fib!.retracements![Math.floor(fib!.retracements!.length / 2)].price : meanPrice,
          extensions: (fib?.extensions?.length ?? 0) > 0 ? fib!.extensions![0].price : meanPrice * 1.618
        }
      }
    };
  }

  /**
   * Calculate opportunity score for entry optimization
   * Identifies best entry points, not just momentum
   */
  static calculateOpportunity(frames: MarketFrame[]): number {
    if (!frames || frames.length < 20) return 0;

    const closes = frames.map(f => f.price.close);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const volumes = frames.map(f => f.volume ?? 0);
    const lastIdx = closes.length - 1;

    // Calculate metrics
    const rsiArr = indicators.rsi(closes);
    const rsi = rsiArr[lastIdx];

    const { histogram } = indicators.macd(closes);
    const macd = histogram[lastIdx];

    const momentum1d = (closes[lastIdx] - closes[lastIdx - 1]) / closes[lastIdx - 1];
    const momentum7d = (closes[lastIdx] - closes[Math.max(0, lastIdx - 7)]) / closes[Math.max(0, lastIdx - 7)];

    const trendScore = RiskManagement.calculateTrendScore(closes);
    const volRatio = RiskManagement.calculateVolumeRatio(volumes, 20);

    const bbUpper = closes[lastIdx] * 1.02;
    const bbLower = closes[lastIdx] * 0.98;
    const bbPos = RiskManagement.calculateBBPosition(closes[lastIdx], bbUpper, bbLower);

    return SignalClassifier.calculateOpportunityScore(
      momentum1d,
      momentum7d,
      rsi,
      macd,
      bbPos,
      trendScore,
      volRatio,
      null,
      false
    );
  }

  /**
   * Calculate risk-adjusted entry and exit levels
   */
  static calculateRiskLevels(frames: MarketFrame[], signal: string): any {
    if (!frames || frames.length < 14) return null;

    const closes = frames.map(f => f.price.close);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const currentPrice = closes[closes.length - 1];

    return RiskManagement.calculateStopLossTakeProfit(
      currentPrice,
      { high: highs, low: lows, close: closes },
      signal
    );
  }

  /**
   * SCANNER SOURCE IMPLEMENTATION - Real multi-pattern detection for consensus engine
   * 
   * Detects multiple trading patterns from live market data frames.
   * This is the LIVE SCANNER SOURCE that feeds into the 3-source consensus engine.
   * 
   * Returns multi-pattern classification with confidence scores.
   */
  static classifyPatterns(frames: MarketFrame[]) {
    if (!frames || frames.length < 14) {
      return {
        patterns: [],
        primaryPattern: null,
        overallConfidence: 0,
        overallStrength: 0,
        reasoning: [],
        patternDetails: []
      };
    }

    const closes = frames.map(f => f.price.close);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const volumes = frames.map(f => f.volume ?? 0);
    const lastIdx = closes.length - 1;
    const currentPrice = closes[lastIdx];
    const prevPrice = closes[Math.max(0, lastIdx - 1)];

    // === Calculate all technical indicators ===
    const rsiArr = indicators.rsi(closes);
    const rsiLast = Number.isNaN(rsiArr[lastIdx]) ? 50 : rsiArr[lastIdx];
    
    const { histogram: macdHist } = indicators.macd(closes);
    const macdHistLast = Number.isNaN(macdHist[lastIdx]) ? 0 : macdHist[lastIdx];
    
    const emaArr20 = indicators.ema(closes, 20);
    const ema20 = emaArr20[lastIdx] ?? currentPrice;
    
    const emaArr50 = indicators.ema(closes, 50);
    const ema50 = emaArr50[lastIdx] ?? currentPrice;
    
    const meanPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
    const bbResult2 = indicators.bollingerBands(closes, 20, 2);
    const bbUpper = bbResult2?.upper?.[lastIdx] ?? meanPrice * 1.02;
    const bbLower = bbResult2?.lower?.[lastIdx] ?? meanPrice * 0.98;
    
    const volRatio = RiskManagement.calculateVolumeRatio(volumes, 20);
    const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volumes.length || 1);

    // === Support/Resistance Levels ===
    let support = Math.min(...lows.slice(-20));
    let resistance = Math.max(...highs.slice(-20));

    // === Build indicator package for classifier ===
    const indicatorPackage = {
      price: currentPrice,
      prevPrice: prevPrice,
      rsi: rsiLast,
      macd: { histogram: macdHistLast },
      ema20: ema20,
      ema50: ema50,
      bollingerBands: { upper: bbUpper, middle: meanPrice, lower: bbLower },
      support: support,
      resistance: resistance,
      volume: volumes[lastIdx],
      prevVolume: volumes[Math.max(0, lastIdx - 1)],
      divergence: false // TODO: Implement divergence detection
    };

    // === Call full multi-pattern classifier ===
    const classifier = new LibSignalClassifier();
    const classificationResult = classifier.classifySignal(indicatorPackage);

    // === Add pattern-specific metadata ===
    const enrichedPatterns = classificationResult.patterns.map(p => ({
      ...p,
      // Can add historical accuracy adjustments here later
      levels: this.getPatternLevels(p.pattern, support, resistance, currentPrice)
    }));

    // === QUALITY GATING for patterns ===
    const patternGateResult = QualityGating.passesPatternQualityGate(
      classificationResult.overallConfidence,
      classificationResult.overallStrength,
      classificationResult.patterns.length,
      (frames[0] as any)?.symbol || 'DEFAULT'
    );

    return {
      patterns: classificationResult.classifications,
      primaryPattern: classificationResult.primaryPattern,
      overallConfidence: classificationResult.overallConfidence,
      overallStrength: classificationResult.overallStrength,
      reasoning: classificationResult.reasoning,
      patternDetails: enrichedPatterns,
      passesQualityGate: patternGateResult.passesGate,
      qualityGateReason: patternGateResult.rejectionReason || patternGateResult.reason,
      // Additional context for consensus
      sourceContext: {
        technicalScore: Math.round(classificationResult.overallStrength),
        confidenceScore: classificationResult.overallConfidence,
        patternCount: classificationResult.patterns.length,
        volumeRatio: volRatio,
        regime: 'LIVE' // Will be enriched with actual regime from RegimeService
      }
    };
  }

  /**
   * Extract key support/resistance levels for a pattern
   */
  private static getPatternLevels(pattern: string, support: number, resistance: number, price: number): Array<{name: string; value: number}> {
    const levels: Array<{name: string; value: number}> = [];
    
    switch (pattern) {
      case 'BREAKOUT':
        levels.push({ name: 'breakoutLevel', value: resistance });
        break;
      case 'SUPPORT_BOUNCE':
        levels.push({ name: 'supportLevel', value: support });
        break;
      case 'RESISTANCE_BREAK':
        levels.push({ name: 'resistanceLevel', value: resistance });
        break;
      case 'CONSOLIDATION_BREAK':
        levels.push({ name: 'consolidationHigh', value: resistance });
        levels.push({ name: 'consolidationLow', value: support });
        break;
      default:
        levels.push({ name: 'price', value: price });
    }
    
    return levels;
  }
}

export default MomentumScanner;
