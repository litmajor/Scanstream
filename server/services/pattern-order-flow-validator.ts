/**
 * Pattern-Order Flow Confirmation Engine
 * 
 * Enhances pattern recognition by validating with order flow
 * - Confirms breakout patterns through volume accumulation
 * - Validates reversal patterns with flow divergence
 * - Strengthens support/resistance holds with institutional support
 * - Detects fake breakouts through order flow weakness
 */

import { OrderFlowAnalyzer, type OrderFlowData } from './order-flow-analyzer';

export interface PatternConfirmation {
  pattern: string;
  patternConfidence: number; // 0-1 from technical analysis
  orderFlowScore: number; // 0-1 from order flow analysis
  combinedConfidence: number; // 0-1 weighted combination
  isConfirmed: boolean; // true if both pattern and flow agree
  patternStrength: string; // 'STRONG' | 'MODERATE' | 'WEAK'
  flowStrength: string; // 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY'
  reasoning: string[];
  recommendation: 'STRONG_ENTRY' | 'MODERATE_ENTRY' | 'WEAK_ENTRY' | 'SKIP' | 'COUNTER_POSITION';
}

export class PatternOrderFlowValidator {
  /**
   * Validate a pattern with order flow confirmation
   * Ensures pattern moves are backed by institutional conviction
   */
  static validatePattern(
    patternType: string,
    patternConfidence: number,
    signalDirection: 'BUY' | 'SELL',
    orderFlow: OrderFlowData,
    volumeProfile: 'HEAVY' | 'NORMAL' | 'LIGHT' = 'NORMAL'
  ): PatternConfirmation {
    const reasoning: string[] = [];

    // Analyze order flow for this signal direction
    const flowAnalysis = OrderFlowAnalyzer.analyzeOrderFlow(
      orderFlow,
      signalDirection,
      volumeProfile
    );

    reasoning.push(`Pattern: ${patternType} (${(patternConfidence * 100).toFixed(0)}% confidence)`);
    reasoning.push(...flowAnalysis.reasoning);

    // Determine pattern strength
    let patternStrength: 'STRONG' | 'MODERATE' | 'WEAK';
    if (patternConfidence > 0.75) {
      patternStrength = 'STRONG';
    } else if (patternConfidence > 0.55) {
      patternStrength = 'MODERATE';
    } else {
      patternStrength = 'WEAK';
    }

    // Determine flow strength
    const flowStrength = flowAnalysis.orderFlowStrength;

    // Pattern-specific validation
    const patternValidation = PatternOrderFlowValidator.validatePatternSpecific(
      patternType,
      patternStrength,
      flowStrength,
      orderFlow,
      signalDirection,
      reasoning
    );

    // Combined confidence: Weight pattern and flow equally (50/50)
    const combinedConfidence = (patternConfidence * 0.5) + (flowAnalysis.orderFlowScore * 0.5);

    // Determine if pattern is confirmed
    const isConfirmed = 
      patternStrength !== 'WEAK' &&
      flowStrength !== 'CONTRADICTORY' &&
      combinedConfidence > 0.60;

    // Generate recommendation
    let recommendation: 'STRONG_ENTRY' | 'MODERATE_ENTRY' | 'WEAK_ENTRY' | 'SKIP' | 'COUNTER_POSITION';

    if (patternStrength === 'STRONG' && (flowStrength === 'STRONG' || flowStrength === 'MODERATE')) {
      recommendation = 'STRONG_ENTRY';
      reasoning.push('✅ STRONG: Pattern and flow both confirm. Increase position.');
    } else if (isConfirmed) {
      recommendation = 'MODERATE_ENTRY';
      reasoning.push('✓ MODERATE: Pattern confirmed by order flow. Normal position.');
    } else if (patternStrength === 'MODERATE' && flowStrength === 'WEAK') {
      recommendation = 'WEAK_ENTRY';
      reasoning.push('⚠️ WEAK: Pattern shows potential but flow is weak. Reduce position or skip.');
    } else if (flowStrength === 'CONTRADICTORY') {
      recommendation = 'SKIP';
      reasoning.push('❌ SKIP: Pattern contradicted by strong order flow. Avoid trade.');
    } else if (patternStrength === 'STRONG' && flowStrength === 'CONTRADICTORY') {
      recommendation = 'COUNTER_POSITION';
      reasoning.push('🔄 COUNTER: Pattern suggests signal but flow is strong opposite. Consider counter trade.');
    } else {
      recommendation = 'SKIP';
      reasoning.push('❌ SKIP: Insufficient pattern or flow confirmation.');
    }

    reasoning.push(`Combined Confidence: ${(combinedConfidence * 100).toFixed(0)}% (Pattern 50% + Flow 50%)`);
    reasoning.push(`Recommendation: ${recommendation}`);

    return {
      pattern: patternType,
      patternConfidence,
      orderFlowScore: flowAnalysis.orderFlowScore,
      combinedConfidence,
      isConfirmed,
      patternStrength,
      flowStrength: flowStrength as any,
      reasoning,
      recommendation
    };
  }

  /**
   * Pattern-specific validation logic
   * Different patterns have different flow signatures
   */
  private static validatePatternSpecific(
    patternType: string,
    patternStrength: 'STRONG' | 'MODERATE' | 'WEAK',
    flowStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY',
    orderFlow: OrderFlowData,
    signalDirection: 'BUY' | 'SELL',
    reasoning: string[]
  ): void {
    const bidAskTotal = orderFlow.bidVolume + orderFlow.askVolume;
    const bidAskRatio = orderFlow.bidVolume / (orderFlow.askVolume || 0.0001);
    const volumeRatio = orderFlow.volumeRatio || 1.0;

    switch (patternType.toUpperCase()) {
      // ============================================================
      // BREAKOUT PATTERNS - Need volume confirmation
      // ============================================================
      case 'BREAKOUT':
      case 'VOLATILITY_BREAKOUT':
      case 'PRICE_BREAKOUT': {
        reasoning.push(`[${patternType}] Breakout needs volume surge to confirm.`);

        if (volumeRatio > 1.8) {
          reasoning.push(`  ✓ Volume confirms: ${volumeRatio.toFixed(2)}x average (breakout valid)`);
        } else if (volumeRatio > 1.2) {
          reasoning.push(`  ~ Modest volume: ${volumeRatio.toFixed(2)}x average (proceed cautiously)`);
        } else {
          reasoning.push(`  ✗ Low volume: ${volumeRatio.toFixed(2)}x average (potential fake breakout)`);
        }

        // For breakups (BUY), need buyer dominance
        if (signalDirection === 'BUY' && bidAskRatio < 1.1) {
          reasoning.push(`  ⚠️ CAUTION: Low bid-ask ratio (${bidAskRatio.toFixed(2)}:1) - weak breakup`);
        }
        break;
      }

      // ============================================================
      // REVERSAL PATTERNS - Need flow divergence
      // ============================================================
      case 'REVERSAL':
      case 'BOTTOM_REVERSAL':
      case 'TOP_REVERSAL': {
        reasoning.push(`[${patternType}] Reversal needs flow to flip with price.`);

        // Bottom reversal = sellers exhausted, buyers take over
        if (patternType.toUpperCase().includes('BOTTOM') && signalDirection === 'BUY') {
          if (bidAskRatio > 1.3) {
            reasoning.push(`  ✓ Buyers emerge: ${bidAskRatio.toFixed(2)}:1 bid-ask (reversal confirmed)`);
          } else {
            reasoning.push(`  ✗ Weak buyer push: ${bidAskRatio.toFixed(2)}:1 (reversal questionable)`);
          }
        }

        // Top reversal = buyers exhausted, sellers take over
        if (patternType.toUpperCase().includes('TOP') && signalDirection === 'SELL') {
          if (bidAskRatio < 0.8) {
            reasoning.push(`  ✓ Sellers emerge: ${bidAskRatio.toFixed(2)}:1 bid-ask (reversal confirmed)`);
          } else {
            reasoning.push(`  ✗ Weak seller push: ${bidAskRatio.toFixed(2)}:1 (reversal questionable)`);
          }
        }
        break;
      }

      // ============================================================
      // SUPPORT/RESISTANCE HOLDS - Need institutional defense
      // ============================================================
      case 'SUPPORT_HOLD':
      case 'RESISTANCE_HOLD':
      case 'BOUNCE': {
        reasoning.push(`[${patternType}] Bounce needs buyers stepping in at support.`);

        if (volumeRatio > 1.5 && bidAskRatio > 1.2) {
          reasoning.push(`  ✓ Strong support: Volume ${volumeRatio.toFixed(2)}x + Buyers ${bidAskRatio.toFixed(2)}:1`);
        } else if (volumeRatio > 1.0 && bidAskRatio > 1.0) {
          reasoning.push(`  ~ Moderate support: Volume ${volumeRatio.toFixed(2)}x + Buyers ${bidAskRatio.toFixed(2)}:1`);
        } else {
          reasoning.push(`  ✗ Weak support: Low volume/buyers (may not hold)`);
        }
        break;
      }

      // ============================================================
      // MOMENTUM PATTERNS - Need sustained flow
      // ============================================================
      case 'TREND_CONTINUATION':
      case 'MOMENTUM':
      case 'PARABOLIC': {
        reasoning.push(`[${patternType}] Momentum needs sustained directional flow.`);

        const netFlowRatio = orderFlow.netFlow / (bidAskTotal || 1);
        if (signalDirection === 'BUY') {
          if (orderFlow.netFlow > 0 && Math.abs(netFlowRatio) > 0.3) {
            reasoning.push(`  ✓ Sustained buying: Net flow positive (momentum strong)`);
          } else {
            reasoning.push(`  ⚠️ Flow weakening: Net flow neutral/negative (momentum fading)`);
          }
        } else {
          if (orderFlow.netFlow < 0 && Math.abs(netFlowRatio) > 0.3) {
            reasoning.push(`  ✓ Sustained selling: Net flow negative (momentum strong)`);
          } else {
            reasoning.push(`  ⚠️ Flow weakening: Net flow neutral/positive (momentum fading)`);
          }
        }
        break;
      }

      // ============================================================
      // MEAN REVERSION PATTERNS - Need extreme flow/price divergence
      // ============================================================
      case 'MEAN_REVERSION':
      case 'OVERSOLD_BOUNCE':
      case 'OVERBOUGHT_DUMP': {
        reasoning.push(`[${patternType}] Mean reversion works best with extreme imbalance.`);

        if (flowStrength === 'STRONG') {
          reasoning.push(
            `  ✓ Perfect setup: Price extreme + Strong opposite flow = reversion likely`
          );
        } else if (flowStrength === 'MODERATE') {
          reasoning.push(
            `  ~ Decent setup: Moderate flow supports reversion but not guaranteed`
          );
        } else {
          reasoning.push(
            `  ✗ Weak reversion: Flow not strong enough to reverse price`
          );
        }
        break;
      }

      // ============================================================
      // VOLUME PATTERNS - Already flow-based
      // ============================================================
      case 'VOLUME_SURGE':
      case 'VOLUME_CLIMAX':
      case 'ACCUMULATION': {
        reasoning.push(`[${patternType}] Volume pattern IS order flow pattern.`);

        if (volumeRatio > 2.0) {
          reasoning.push(`  ✓ Extreme volume: ${volumeRatio.toFixed(2)}x (pattern confirmed by flow)`);
        } else if (volumeRatio > 1.5) {
          reasoning.push(`  ~ Significant volume: ${volumeRatio.toFixed(2)}x (moderate confirmation)`);
        } else {
          reasoning.push(`  ✗ Volume pattern fails: Not enough volume surge`);
        }
        break;
      }

      // ============================================================
      // CONSOLIDATION PATTERNS - Need balance with eventual breakout
      // ============================================================
      case 'CONSOLIDATION':
      case 'TRIANGLE':
      case 'FLAG': {
        reasoning.push(`[${patternType}] Consolidation valid if balanced, needs volume for breakout.`);

        // During consolidation, flow should be relatively balanced
        const flowBalance = Math.abs(orderFlow.bidVolume - orderFlow.askVolume) / (bidAskTotal || 1);
        if (flowBalance < 0.3) {
          reasoning.push(
            `  ✓ Balanced flow: ${(flowBalance * 100).toFixed(0)}% imbalance (consolidation confirmed)`
          );
        } else {
          reasoning.push(
            `  ✗ Imbalanced: ${(flowBalance * 100).toFixed(0)}% imbalance (not true consolidation)`
          );
        }

        if (volumeRatio > 1.5) {
          reasoning.push(`  ⚠️ Volume surge during consolidation - breakout imminent`);
        }
        break;
      }

      default:
        reasoning.push(`[${patternType}] No pattern-specific validation available.`);
    }
  }

  /**
   * Get confidence multiplier for combining pattern + flow
   * Different pattern types benefit differently from flow confirmation
   */
  static getPatternFlowWeighting(patternType: string): {
    patternWeight: number; // How much to trust pattern (vs flow)
    flowWeight: number; // How much to trust flow (vs pattern)
    reasoning: string;
  } {
    // By default: 50/50 weighting
    const defaultWeighting = {
      patternWeight: 0.5,
      flowWeight: 0.5,
      reasoning: 'Standard 50/50 pattern + flow weighting'
    };

    switch (patternType.toUpperCase()) {
      // Pattern-heavy: Technical setups are very reliable
      case 'DOUBLE_BOTTOM':
      case 'DOUBLE_TOP':
      case 'HEAD_SHOULDERS':
      case 'TRIANGLE':
      case 'WEDGE':
        return {
          patternWeight: 0.60, // Trust pattern more
          flowWeight: 0.40,
          reasoning: 'Chart patterns are reliable - weight pattern higher'
        };

      // Flow-heavy: Volume patterns need confirmation
      case 'VOLUME_CLIMAX':
      case 'VOLUME_SURGE':
      case 'ACCUMULATION':
      case 'DISTRIBUTION':
        return {
          patternWeight: 0.40,
          flowWeight: 0.60,
          reasoning: 'Volume patterns need order flow confirmation - weight flow higher'
        };

      // Breakouts need flow badly
      case 'BREAKOUT':
      case 'PRICE_BREAKOUT':
        return {
          patternWeight: 0.35,
          flowWeight: 0.65,
          reasoning: 'Breakouts need volume confirmation - weight flow heavily'
        };

      // Reversals need flow reversal
      case 'REVERSAL':
      case 'BOTTOM_REVERSAL':
      case 'TOP_REVERSAL':
        return {
          patternWeight: 0.45,
          flowWeight: 0.55,
          reasoning: 'Reversals need flow to turn - slight flow weight'
        };

      // Momentum is about sustained flow
      case 'MOMENTUM':
      case 'PARABOLIC':
      case 'TREND_CONTINUATION':
        return {
          patternWeight: 0.40,
          flowWeight: 0.60,
          reasoning: 'Momentum is sustained flow - weight flow higher'
        };

      // Mean reversion thrives with extreme flow
      case 'MEAN_REVERSION':
      case 'OVERSOLD_BOUNCE':
      case 'OVERBOUGHT_DUMP':
        return {
          patternWeight: 0.30,
          flowWeight: 0.70,
          reasoning: 'Mean reversion needs extreme opposite flow - weight flow heavily'
        };

      default:
        return defaultWeighting;
    }
  }

  /**
   * Detect "fake breakouts" - price breaks but order flow doesn't
   * These are high-risk trades with poor risk/reward
   */
  static detectFakeBreakout(
    patternType: string,
    priceBreakout: boolean,
    volumeRatio: number,
    bidAskRatio: number,
    signalDirection: 'BUY' | 'SELL'
  ): {
    isFake: boolean;
    confidence: number;
    reasoning: string;
  } {
    // Only applies to breakout patterns
    if (!patternType.toUpperCase().includes('BREAKOUT')) {
      return {
        isFake: false,
        confidence: 0,
        reasoning: 'Not a breakout pattern - fake breakout detection N/A'
      };
    }

    const reasons: string[] = [];
    let fakeScore = 0;

    // Price broke but volume didn't
    if (priceBreakout && volumeRatio < 1.3) {
      fakeScore += 0.4;
      reasons.push('Price broke but volume is weak (fake breakout indicator)');
    }

    // For bullish breakout, need strong bid volume
    if (signalDirection === 'BUY' && bidAskRatio < 1.0) {
      fakeScore += 0.3;
      reasons.push('Breakup but sellers dominate (suspicious)');
    }

    // For bearish breakout, need strong ask volume
    if (signalDirection === 'SELL' && bidAskRatio > 1.0) {
      fakeScore += 0.3;
      reasons.push('Breakdown but buyers dominate (suspicious)');
    }

    // If multiple indicators trigger, high probability of fake
    const isFake = fakeScore > 0.5;

    return {
      isFake,
      confidence: Math.min(1.0, fakeScore),
      reasoning: reasons.length > 0
        ? `⚠️ POTENTIAL FAKE BREAKOUT: ${reasons.join(' | ')}`
        : 'Breakout appears genuine'
    };
  }
}

export const patternOrderFlowValidator = new PatternOrderFlowValidator();
