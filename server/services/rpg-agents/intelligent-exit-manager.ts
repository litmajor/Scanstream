export interface ExitUpdate {
  action: 'HOLD' | 'EXIT' | 'REDUCE';
  reason?: string;
  stage?: string;
  volumeInsight?: string;
}

export interface VolumeExitSignal {
  exhaustionDetected: boolean;
  distributionPattern: boolean;
  supportBroken: boolean;
  recommendedAction: 'EXIT' | 'HOLD' | 'REDUCE';
  confidence: number;
  reason: string;
}

export class IntelligentExitManager {
  entryPrice: number;
  atr: number;
  signalType: string;

  constructor(entryPrice: number = 0, atr: number = 0, signalType: string = 'BUY') {
    this.entryPrice = entryPrice;
    this.atr = atr;
    this.signalType = signalType;
  }

  update(currentPrice: number, signalType: string): ExitUpdate {
    // simple placeholder logic
    if (!currentPrice) return { action: 'HOLD', reason: 'no-price' };
    if (this.signalType === 'BUY' && currentPrice < this.entryPrice - this.atr * 2) return { action: 'EXIT', reason: 'deep-drawdown' };
    return { action: 'HOLD', reason: '' };
  }

  updateWithMicrostructure(currentPrice: number, micro: any, previous: any, signalType: string): ExitUpdate {
    // basic placeholder
    if (micro && micro.depth < 1000) return { action: 'EXIT', reason: 'low-depth' };
    return { action: 'HOLD', reason: '' };
  }

  /**
   * Update exit decision with volume insights from VolumeMechanicalVerifierAgent
   * Detects exhaustion, distribution, and support breaks via volume
   */
  updateWithVolumeInsights(volumeSignal: VolumeExitSignal | null): ExitUpdate {
    if (!volumeSignal) {
      return { action: 'HOLD', reason: 'no-volume-signal' };
    }

    const action = volumeSignal.recommendedAction;
    const volumeInsight = `[Volume] ${volumeSignal.reason} (${(volumeSignal.confidence * 100).toFixed(0)}%)`;

    return {
      action,
      reason: volumeSignal.reason,
      stage: 'volume-analysis',
      volumeInsight
    };
  }

  /**
   * Analyze climax exhaustion from volume agent
   * Returns exit recommendation if buying or selling climax detected
   */
  detectClimaxExhaustion(
    climaxType: 'BUYING_CLIMAX' | 'SELLING_CLIMAX' | 'NONE',
    convictionScore: number
  ): VolumeExitSignal | null {
    if (climaxType === 'NONE') {
      return null;
    }

    if (climaxType === 'BUYING_CLIMAX' && this.signalType === 'BUY') {
      return {
        exhaustionDetected: true,
        distributionPattern: false,
        supportBroken: false,
        recommendedAction: 'REDUCE',
        confidence: Math.min(convictionScore / 100, 0.95),
        reason: 'Buying climax detected - potential exhaustion, consider reducing position'
      };
    }

    if (climaxType === 'SELLING_CLIMAX' && this.signalType === 'SELL') {
      return {
        exhaustionDetected: true,
        distributionPattern: false,
        supportBroken: false,
        recommendedAction: 'REDUCE',
        confidence: Math.min(convictionScore / 100, 0.95),
        reason: 'Selling climax detected - potential exhaustion, consider covering'
      };
    }

    return null;
  }

  /**
   * Detect smart money distribution patterns
   * Exit if distribution occurring at resistance levels
   */
  detectDistributionPattern(
    smartMoneySignal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL',
    priceAtResistance: boolean,
    volumeRatio: number
  ): VolumeExitSignal | null {
    if (smartMoneySignal !== 'DISTRIBUTION' || !priceAtResistance) {
      return null;
    }

    // High confidence if volume is elevated during distribution
    const confidence = Math.min(0.75 + (volumeRatio - 1) * 0.1, 0.95);

    return {
      exhaustionDetected: false,
      distributionPattern: true,
      supportBroken: false,
      recommendedAction: 'EXIT',
      confidence,
      reason: 'Smart money distribution at resistance - high-risk environment'
    };
  }

  /**
   * Detect support break via volume weakness
   * If price breaks support on weak volume, it's likely a fakeout
   * If price breaks support on strong volume, it's a real break
   */
  detectSupportBreak(
    priceAtSupport: boolean,
    breakoutValidity: 'VALID' | 'FAKEOUT' | 'NONE',
    convictionScore: number
  ): VolumeExitSignal | null {
    if (breakoutValidity === 'NONE' || !priceAtSupport) {
      return null;
    }

    if (breakoutValidity === 'FAKEOUT') {
      // Fakeout is actually positive - avoid exiting
      return null;
    }

    // VALID breakout at support = real break
    if (breakoutValidity === 'VALID' && this.signalType === 'BUY') {
      return {
        exhaustionDetected: false,
        distributionPattern: false,
        supportBroken: true,
        recommendedAction: 'EXIT',
        confidence: Math.min(convictionScore / 100, 0.95),
        reason: 'Support broken on strong volume - confirmed breakdown'
      };
    }

    return null;
  }

  /**
   * Aggregate volume signals for final exit decision
   */
  aggregateVolumeSignals(signals: VolumeExitSignal[]): ExitUpdate | null {
    if (signals.length === 0) return null;

    // Count exit recommendations
    const exitCount = signals.filter(s => s.recommendedAction === 'EXIT').length;
    const reduceCount = signals.filter(s => s.recommendedAction === 'REDUCE').length;
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    let action: 'EXIT' | 'REDUCE' | 'HOLD' = 'HOLD';

    if (exitCount >= 2 || (exitCount === 1 && avgConfidence > 0.85)) {
      action = 'EXIT';
    } else if (reduceCount >= 2 || (reduceCount > 0 && avgConfidence > 0.75)) {
      action = 'REDUCE';
    }

    const reasons = signals.map(s => s.reason).join('; ');
    const volumeInsight = `[Volume Aggregation] ${reasons}`;

    return {
      action,
      reason: `Volume-based signal: ${reasons}`,
      stage: 'volume-aggregation',
      volumeInsight
    };
  }
}
