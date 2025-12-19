/**
 * Signal Classifier - Ported from Python scanner.py
 * 
 * Classifies trading signals based on technical indicators:
 * - Momentum signals (Strong Buy, Buy, Weak Buy, Neutral, Weak Sell, Sell, Strong Sell)
 * - Market states (Bullish, Bearish, Neutral with various sub-states)
 * - Legacy labels (Consistent Uptrend, Consolidation, etc.)
 * - Signal strength and confidence scores
 */

export interface SignalClassificationResult {
  signal: string; // 'Strong Buy' | 'Buy' | 'Weak Buy' | 'Neutral' | 'Weak Sell' | 'Sell' | 'Strong Sell'
  strength: number; // 0-100
  confidence: number; // 0-1
  reason: string;
}

export interface RegimeState {
  state: string; // 'BULL_EARLY' | 'BULL_STRONG' | 'BULL_PARABOLIC' | ...
  confidence: number; // 0-1
}

export interface LegacyLabel {
  label: string;
  confidence: number; // 0-1
}

export class SignalClassifier {
  /**
   * Main momentum signal classification
   * Maps indicator values to trading signals with volatility adjustments
   */
  static classifyMomentumSignal(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    thresholds: {
      momentumShort?: number;
      rsiMin?: number;
      rsiMax?: number;
      macdMin?: number;
    } = {},
    additionalIndicators: {
      ichimokuBullish?: boolean;
      [key: string]: any;
    } = {}
  ): SignalClassificationResult {
    // Unpack thresholds with defaults
    const momTh = thresholds.momentumShort ?? 0.01;
    const rsiMin = thresholds.rsiMin ?? 50;
    const rsiMax = thresholds.rsiMax ?? 70;
    const macdMin = thresholds.macdMin ?? 0;
    const ichimokuBullish = additionalIndicators.ichimokuBullish ?? false;

    let signal = 'Neutral';
    let strength = 50;
    let reasonParts: string[] = [];

    // Strong Buy: All indicators aligned bullish + Ichimoku confirmation
    if (
      momentumShort > momTh * 2 &&
      momentumLong > momTh &&
      rsi > rsiMin &&
      rsi < rsiMax &&
      macd > macdMin &&
      ichimokuBullish
    ) {
      signal = 'Strong Buy';
      strength = Math.min(95, 50 + Math.abs(momentumShort) * 500);
      reasonParts.push('all-bullish-aligned');
    }
    // Buy: Strong short-term momentum + moderate RSI + bullish MACD
    else if (
      momentumShort > momTh &&
      rsi > rsiMin &&
      macd > 0
    ) {
      signal = 'Buy';
      strength = Math.min(90, 50 + Math.abs(momentumShort) * 400);
      reasonParts.push('bullish-momentum');
    }
    // Weak Buy: Any bullish momentum with moderate conditions
    else if (
      momentumShort > 0 &&
      rsi > 45 &&
      macd > 0
    ) {
      signal = 'Weak Buy';
      strength = Math.min(75, 50 + Math.abs(momentumShort) * 300);
      reasonParts.push('weak-bullish');
    }
    // Strong Sell: All indicators aligned bearish + no Ichimoku
    else if (
      momentumShort < -momTh * 2 &&
      momentumLong < -momTh &&
      rsi < 100 - rsiMin &&
      rsi > 20 &&
      macd < -macdMin &&
      !ichimokuBullish
    ) {
      signal = 'Strong Sell';
      strength = Math.min(95, 50 - Math.abs(momentumShort) * 500);
      reasonParts.push('all-bearish-aligned');
    }
    // Sell: Strong short-term bearish momentum + moderate RSI + bearish MACD
    else if (
      momentumShort < -momTh &&
      rsi < 100 - rsiMin &&
      macd < 0
    ) {
      signal = 'Sell';
      strength = Math.min(90, 50 - Math.abs(momentumShort) * 400);
      reasonParts.push('bearish-momentum');
    }
    // Weak Sell: Any bearish momentum with moderate conditions
    else if (
      momentumShort < 0 &&
      rsi < 55 &&
      macd < 0
    ) {
      signal = 'Weak Sell';
      strength = Math.min(75, 50 - Math.abs(momentumShort) * 300);
      reasonParts.push('weak-bearish');
    }

    reasonParts.push(`mom_s:${momentumShort.toFixed(4)}`);
    reasonParts.push(`rsi:${rsi.toFixed(1)}`);
    reasonParts.push(`macd:${macd.toFixed(4)}`);

    // Clamp strength to 0-100
    strength = Math.max(0, Math.min(100, strength));

    return {
      signal,
      strength,
      confidence: strength / 100,
      reason: reasonParts.join(' | ')
    };
  }

  /**
   * Granular market state classification
   * Returns specific market regime states with confidence
   */
  static classifyState(
    mom1d: number,
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    volumeRatio: number
  ): RegimeState {
    // Volatility-adjusted thresholds
    const volMult = Math.max(0.5, Math.min(2.0, volumeRatio));
    const thWeak = 0.015 * volMult;
    const thMed = 0.035 * volMult;
    const thStrong = 0.075 * volMult;

    // Pattern detection
    const breakoutUp = bbPosition > 0.85 && mom1d > thWeak;
    const breakoutDn = bbPosition < 0.15 && mom1d < -thWeak;
    const thrustUp = mom1d > thMed && mom7d > thMed;
    const thrustDn = mom1d < -thMed && mom7d < -thMed;
    const parabolic = Math.abs(mom1d) > thStrong && Math.abs(mom7d) > thStrong;

    let state = 'NEUTRAL';
    let confidence = 0.5;

    if (parabolic && mom1d > 0) {
      state = 'BULL_PARABOLIC';
      confidence = 0.95;
    } else if (parabolic && mom1d < 0) {
      state = 'BEAR_CAPITULATION';
      confidence = 0.95;
    } else if (thrustUp) {
      state = 'BULL_STRONG';
      confidence = 0.85;
    } else if (thrustDn) {
      state = 'BEAR_STRONG';
      confidence = 0.85;
    } else if (breakoutUp) {
      state = 'BULL_EARLY';
      confidence = 0.75;
    } else if (breakoutDn) {
      state = 'BEAR_EARLY';
      confidence = 0.75;
    } else if (mom7d > -thWeak && mom7d < thWeak) {
      if (rsi < 35 && mom1d > 0) {
        state = 'NEUTRAL_ACCUM';
        confidence = 0.7;
      } else if (rsi > 65 && mom1d < 0) {
        state = 'NEUTRAL_DIST';
        confidence = 0.7;
      }
    }

    return { state, confidence };
  }

  /**
   * Legacy label classification
   * Backward-compatible with original Python labels
   */
  static classifyLegacy(
    mom7d: number,
    mom30d: number,
    rsi: number,
    macd: number,
    bbPosition: number,
    volumeRatio: number
  ): LegacyLabel {
    // Volatility-adjusted thresholds
    const volMult = Math.max(0.5, Math.min(2.0, volumeRatio));
    const thHigh = 0.07 * volMult;
    const thMed = 0.035 * volMult;
    const thLow = 0.015 * volMult;

    let label = 'Neutral';
    let confidence = 0.5;

    // 1. Consistent Uptrend
    if (mom7d > thMed && mom30d > thHigh && mom7d < 0.5 * mom30d) {
      label = 'Consistent Uptrend';
      confidence = 0.85;
    }
    // 2. New Spike
    else if (mom7d > thHigh && Math.abs(mom30d) < thMed) {
      label = 'New Spike';
      confidence = 0.8;
    }
    // 3. Topping Out
    else if (
      mom7d < -thMed &&
      mom30d > thHigh &&
      bbPosition > 0.8 &&
      rsi > 65
    ) {
      label = 'Topping Out';
      confidence = 0.8;
    }
    // 4. Lagging
    else if (Math.abs(mom7d) < thLow && Math.abs(mom30d) < thMed) {
      label = 'Lagging';
      confidence = 0.7;
    }
    // 5. Moderate Uptrend
    else if (thLow < mom7d && mom7d < thHigh && thMed < mom30d && mom30d < thHigh) {
      label = 'Moderate Uptrend';
      confidence = 0.75;
    }
    // 6. Potential Reversal
    else if (mom7d > thMed && mom30d < -thMed && rsi < 45) {
      label = 'Potential Reversal';
      confidence = 0.7;
    }
    // 7. Consolidation
    else if (
      Math.abs(mom7d) < thLow &&
      Math.abs(mom30d) < thLow &&
      rsi >= 40 &&
      rsi <= 60
    ) {
      label = 'Consolidation';
      confidence = 0.75;
    }
    // 8. Weak Uptrend
    else if (mom7d > thLow && Math.abs(mom30d) < thLow) {
      label = 'Weak Uptrend';
      confidence = 0.65;
    }
    // 9. Overbought
    else if (rsi > 75 && mom7d > thMed) {
      label = 'Overbought';
      confidence = 0.8;
    }
    // 10. Oversold
    else if (rsi < 25 && mom7d < -thMed) {
      label = 'Oversold';
      confidence = 0.8;
    }
    // 11. MACD Bullish
    else if (macd > 0 && mom7d > thMed) {
      label = 'MACD Bullish';
      confidence = 0.7;
    }
    // 12. MACD Bearish
    else if (macd < 0 && mom7d < -thMed) {
      label = 'MACD Bearish';
      confidence = 0.7;
    }

    return { label, confidence };
  }

  /**
   * Calculate signal strength (0-100)
   * Combines momentum, RSI, MACD, and volume into a single strength metric
   */
  static calculateSignalStrength(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    volumeRatio: number = 1.0
  ): number {
    let score = 50;

    // Momentum component: favor strong, aligned movements
    const momentumScore = Math.min(Math.abs(momentumShort) * 1000, 15) +
                          Math.min(Math.abs(momentumLong) * 500, 15);

    if (momentumShort > 0 && momentumLong > 0) {
      score += momentumScore;
    } else if (momentumShort < 0 && momentumLong < 0) {
      score -= momentumScore;
    } else {
      score -= momentumScore * 0.5; // Divergence penalty
    }

    // RSI component: reward neutral zones, penalize extremes
    if (rsi > 40 && rsi < 60) {
      score += 5;
    } else if (rsi > 70 || rsi < 30) {
      score -= 10;
    }

    // MACD component: directional bias
    score += Math.min(Math.abs(macd) * 50, 10) * (macd > 0 ? 1 : -1);

    // Volume component: high volume adds confidence
    if (volumeRatio > 1.2) {
      score += 5;
    } else if (volumeRatio < 0.8) {
      score -= 3;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate confidence score (0-1)
   * Measures how aligned multiple indicators are
   */
  static calculateConfidenceScore(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    trendScore: number,
    volumeRatio: number
  ): number {
    // Normalize each component
    const momScore = Math.min(Math.max(Math.abs(momentumShort), 0), 0.1) / 0.1;
    const longMomScore = Math.min(Math.max(Math.abs(momentumLong), 0), 0.2) / 0.2;
    const rsiScore = rsi >= 50
      ? Math.min(Math.max((rsi - 50) / 30, 0), 1)
      : Math.min(Math.max((50 - rsi) / 30, 0), 1);
    const macdScore = Math.min(Math.max(Math.abs(macd), 0), 0.05) / 0.05;
    const trendScoreNorm = Math.min(Math.max(trendScore / 10, 0), 1);
    const volScore = volumeRatio >= 1
      ? Math.min((volumeRatio - 1) / 1.5, 1)
      : Math.max(0, 1 + (volumeRatio - 1) / 0.8);

    // Weighted combination
    const score =
      momScore * 0.18 +
      longMomScore * 0.12 +
      rsiScore * 0.18 +
      macdScore * 0.18 +
      trendScoreNorm * 0.22 +
      volScore * 0.12;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate opportunity score (0-100)
   * Identifies the BEST entry points, not just momentum
   * Penalizes overbought/oversold, rewards pullbacks
   */
  static calculateOpportunityScore(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    bbPosition: number | null,
    trendScore: number,
    volumeRatio: number,
    stochK: number | null = null,
    rsiBearishDiv: boolean = false
  ): number {
    // 1. RSI Opportunity (favor 30-50 for longs)
    let rsiOpp = 0.5;
    if (rsi < 30) {
      rsiOpp = 0.3; // Oversold - risky
    } else if (rsi < 45) {
      rsiOpp = 1.0; // Sweet spot
    } else if (rsi < 55) {
      rsiOpp = 0.8; // Neutral - okay
    } else if (rsi < 70) {
      rsiOpp = 0.5; // Getting extended
    } else {
      rsiOpp = 0.2; // Overbought
    }

    // 2. Bollinger Band Position (favor lower BB for longs)
    let bbOpp = 0.5;
    if (bbPosition !== null) {
      if (bbPosition < 0.3) {
        bbOpp = 1.0; // Near lower band
      } else if (bbPosition < 0.5) {
        bbOpp = 0.9; // Below midline
      } else if (bbPosition < 0.7) {
        bbOpp = 0.6; // Above midline
      } else {
        bbOpp = 0.2; // Near upper band
      }
    }

    // 3. Stochastic Opportunity
    let stochOpp = 0.5;
    if (stochK !== null) {
      if (stochK < 20) {
        stochOpp = momentumLong > 0 ? 1.0 : 0.3;
      } else if (stochK < 40) {
        stochOpp = 0.9;
      } else if (stochK < 60) {
        stochOpp = 0.7;
      } else if (stochK < 80) {
        stochOpp = 0.4;
      } else {
        stochOpp = 0.1;
      }
    }

    // 4. Momentum Context (pullbacks in uptrend = best)
    let momentumOpp = 0.5;
    if (momentumLong > 0.001) {
      if (momentumShort > -0.005 && momentumShort < 0.002) {
        momentumOpp = 1.0; // Pullback in uptrend
      } else if (momentumShort > 0.005) {
        momentumOpp = 0.4; // Already running hot
      } else {
        momentumOpp = 0.6;
      }
    } else if (momentumLong < -0.001) {
      if (momentumShort > -0.002 && momentumShort < 0.005) {
        momentumOpp = 1.0; // Bounce in downtrend
      } else {
        momentumOpp = 0.5;
      }
    }

    // 5. Divergence Penalty
    const divergencePenalty = rsiBearishDiv ? 0.5 : 1.0;

    // 6. Volume Context
    let volOpp = 0.6;
    if (volumeRatio > 1.5) {
      volOpp = rsi < 55 ? 1.0 : 0.3;
    } else if (volumeRatio > 1.2) {
      volOpp = 0.8;
    } else if (volumeRatio > 0.8) {
      volOpp = 0.6;
    } else {
      volOpp = 0.4;
    }

    // 7. Trend Quality
    const trendOpp = Math.min(Math.max(trendScore / 10, 0), 1);

    // 8. MACD Opportunity
    let macdOpp = 0.5;
    if (momentumLong > 0 && macd > -0.5 && macd < 0) {
      macdOpp = 1.0;
    } else if (macd > 0) {
      macdOpp = macd < 2 ? 0.7 : 0.3;
    }

    // Weighted combination
    const opportunity =
      (rsiOpp * 0.25 +
        bbOpp * 0.2 +
        stochOpp * 0.15 +
        momentumOpp * 0.15 +
        volOpp * 0.1 +
        trendOpp * 0.1 +
        macdOpp * 0.05) *
      divergencePenalty;

    return Math.round(opportunity * 100);
  }

  /**
   * Calculate composite score (0-100)
   * Combines multiple indicators with optional custom weights
   */
  static calculateCompositeScore(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
    macd: number,
    trendScore: number,
    volumeRatio: number,
    ichimokuBullish: boolean,
    fibConfluence: number = 0,
    weights?: Record<string, number>
  ): number {
    // Default weights
    const w = weights || {
      momentumShort: 0.2,
      momentumLong: 0.15,
      rsi: 0.2,
      macd: 0.15,
      trendScore: 0.2,
      volumeRatio: 0.1,
      ichimoku: 0.1,
      fibConfluence: 0.15
    };

    // Normalize each component
    const momShortScore = Math.min(Math.max(Math.abs(momentumShort) * 1000, 0), 1);
    const momLongScore = Math.min(Math.max(Math.abs(momentumLong) * 500, 0), 1);
    const rsiScore = rsi >= 50
      ? Math.min(Math.max((rsi - 50) / 30, 0), 1)
      : Math.min(Math.max((50 - rsi) / 30, 0), 1);
    const macdScore = Math.min(Math.max(Math.abs(macd) * 50, 0), 1);
    const trendScoreNorm = Math.min(Math.max(trendScore / 10, 0), 1);
    const volScore = Math.min(Math.max((volumeRatio - 1) / 1.5, 0), 1);
    const ichimokuScore = ichimokuBullish ? 1.0 : 0.0;
    const fibScore = Math.min(Math.max(fibConfluence / 100, 0), 1);

    const score =
      momShortScore * w.momentumShort +
      momLongScore * w.momentumLong +
      rsiScore * w.rsi +
      macdScore * w.macd +
      trendScoreNorm * w.trendScore +
      volScore * w.volumeRatio +
      ichimokuScore * w.ichimoku +
      fibScore * (w.fibConfluence || 0.15);

    return Math.round(score * 100);
  }
}

export default SignalClassifier;
