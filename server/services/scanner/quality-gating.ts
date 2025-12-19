/**
 * Quality Gating - Signal filtering based on quality thresholds
 * 
 * Ensures only signals meeting minimum quality standards are emitted.
 * Prevents low-quality signals from reaching UI/trading engine.
 */

export interface GatedSignalResult {
  passesGate: boolean; // true if signal passes quality gate
  reason?: string; // Why it was filtered (if applicable)
  rejectionReason?: string; // Human-readable rejection reason
}

/**
 * Quality gate thresholds by category
 */
export const QUALITY_GATE_THRESHOLDS = {
  // Tier-1 assets (BTC, ETH, etc.) - highest bar
  TIER_1: {
    minConfidence: 0.70, // 70% confidence minimum
    minStrength: 65, // 65/100 strength minimum
    description: 'Tier-1 (BTC, ETH, etc.)'
  },
  // Standard assets (most alts)
  STANDARD: {
    minConfidence: 0.60, // 60% confidence minimum
    minStrength: 55, // 55/100 strength minimum
    description: 'Standard assets'
  },
  // Meme/lower liquidity assets
  MEME: {
    minConfidence: 0.65, // Higher bar for memes (less data)
    minStrength: 60,
    description: 'Meme coins'
  },
  // Default fallback
  DEFAULT: {
    minConfidence: 0.60,
    minStrength: 55,
    description: 'Default'
  }
};

export class QualityGating {
  /**
   * Determine asset category (for different thresholds)
   */
  static getAssetCategory(symbol: string): string {
    const tier1 = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'AVAX'];
    const meme = ['SHIB', 'PEPE', 'BONK', 'FLOKI', 'WIF', 'MOG'];

    const base = symbol.split('/')[0].toUpperCase();

    if (tier1.includes(base)) return 'TIER_1';
    if (meme.includes(base)) return 'MEME';
    return 'STANDARD';
  }

  /**
   * Get quality gate thresholds for a symbol
   */
  static getThresholds(symbol: string) {
    const category = this.getAssetCategory(symbol);
    return (QUALITY_GATE_THRESHOLDS as Record<string, any>)[category] || QUALITY_GATE_THRESHOLDS.DEFAULT;
  }

  /**
   * Check if signal passes quality gate
   * 
   * Returns false if:
   * - Confidence < threshold for asset category
   * - Strength < threshold for asset category
   */
  static passesQualityGate(
    confidence: number, // 0-1
    strength: number, // 0-100
    symbol: string = 'DEFAULT'
  ): GatedSignalResult {
    const thresholds = this.getThresholds(symbol);

    // Check confidence
    if (confidence < thresholds.minConfidence) {
      return {
        passesGate: false,
        rejectionReason: `Low confidence (${(confidence * 100).toFixed(1)}% < ${(thresholds.minConfidence * 100).toFixed(0)}% required)`
      };
    }

    // Check strength
    if (strength < thresholds.minStrength) {
      return {
        passesGate: false,
        rejectionReason: `Low strength (${strength.toFixed(0)} < ${thresholds.minStrength} required)`
      };
    }

    return {
      passesGate: true,
      reason: `Passes quality gate (confidence: ${(confidence * 100).toFixed(1)}%, strength: ${strength.toFixed(0)})`
    };
  }

  /**
   * Check if pattern classification passes quality gate
   */
  static passesPatternQualityGate(
    overallConfidence: number, // 0-1
    overallStrength: number, // 0-100
    patternCount: number, // number of patterns detected
    symbol: string = 'DEFAULT'
  ): GatedSignalResult {
    const thresholds = this.getThresholds(symbol);

    // Require at least 1 pattern detected
    if (patternCount === 0) {
      return {
        passesGate: false,
        rejectionReason: 'No patterns detected'
      };
    }

    // Pattern detection can use slightly lower bars (it's already filtered)
    const adjustedConfThreshold = Math.max(0.50, thresholds.minConfidence - 0.05);
    const adjustedStrengthThreshold = Math.max(50, thresholds.minStrength - 5);

    if (overallConfidence < adjustedConfThreshold) {
      return {
        passesGate: false,
        rejectionReason: `Low pattern confidence (${(overallConfidence * 100).toFixed(1)}% < ${(adjustedConfThreshold * 100).toFixed(0)}% required)`
      };
    }

    if (overallStrength < adjustedStrengthThreshold) {
      return {
        passesGate: false,
        rejectionReason: `Low pattern strength (${overallStrength.toFixed(0)} < ${adjustedStrengthThreshold} required)`
      };
    }

    return {
      passesGate: true,
      reason: `Passes pattern quality gate (${patternCount} patterns, confidence: ${(overallConfidence * 100).toFixed(1)}%)`
    };
  }
}

export default QualityGating;
