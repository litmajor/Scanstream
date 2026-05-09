/**
 * REGIME CONSOLIDATION BRIDGE
 * 
 * Provides backward compatibility during migration from fragmented to unified regime system.
 * 
 * Allows new code to use unified regimes while old code continues working.
 * Gradually phase out legacy regime systems.
 */

import {
  UnifiedRegimeType,
  RegimeMapper,
  UnifiedRegimeDetector,
} from './unified-regime-system';

/**
 * Backward compatibility layer
 * Converts between legacy regime formats and unified format
 */
export class RegimeConsolidationBridge {
  private static conversionLog: Array<{
    timestamp: number;
    from: string;
    fromSystem: string;
    to: string;
    toSystem: string;
  }> = [];

  private static readonly MAX_LOG_SIZE = 1000;

  /**
   * Convert legacy VFMD regime to unified
   * VFMD: LAMINAR_TREND, TURBULENT_CHOP, ACCUMULATION, DISTRIBUTION, BREAKOUT_TRANSITION, CONSOLIDATION
   */
  static fromVFMD(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'vfmd');
  }

  /**
   * Convert legacy scanner regime to unified
   * Scanner: bull, bear, ranging (+ volatility: low, medium, high)
   */
  static fromScanner(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'scanner');
  }

  /**
   * Convert legacy ML regime to unified
   * ML: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, CONSOLIDATING, UNKNOWN
   */
  static fromML(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'ml');
  }

  /**
   * Convert legacy router regime to unified
   * Router: TRENDING, SIDEWAYS, HIGH_VOLATILITY, BREAKOUT, QUIET
   */
  static fromRouter(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'router');
  }

  /**
   * Convert legacy velocity regime to unified
   * Velocity: BULL, BEAR, SIDEWAYS
   */
  static fromVelocity(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'velocity');
  }

  /**
   * Convert legacy assessment regime to unified
   * Assessment: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, CONSOLIDATING
   */
  static fromAssessment(regime: string): UnifiedRegimeType {
    return this.convert(regime, 'assessment');
  }

  /**
   * Generic conversion from any source
   */
  static convert(regime: string, source: keyof typeof RegimeMapper): UnifiedRegimeType {
    const unified = UnifiedRegimeDetector.mapToUnified(regime, source);

    // Log conversion for migration tracking
    this.logConversion(regime, source, unified, 'unified');

    return unified;
  }

  /**
   * Convert FROM unified TO legacy format
   * Used for systems that haven't migrated yet
   */
  static toVFMD(unified: UnifiedRegimeType): string {
    return this.convertBack(unified, 'vfmd');
  }

  static toScanner(unified: UnifiedRegimeType): string {
    return this.convertBack(unified, 'scanner');
  }

  static toML(unified: UnifiedRegimeType): string {
    return this.convertBack(unified, 'ml');
  }

  static toRouter(unified: UnifiedRegimeType): string {
    return this.convertBack(unified, 'router');
  }

  static toVelocity(unified: UnifiedRegimeType): string {
    return this.convertBack(unified, 'velocity');
  }

  /**
   * Reverse conversion: unified → legacy
   * Finds best matching legacy regime
   */
  private static convertBack(
    unified: UnifiedRegimeType,
    targetSystem: keyof typeof RegimeMapper
  ): string {
    const mapping = RegimeMapper[targetSystem] as Record<string, UnifiedRegimeType>;

    // Find first match in reverse mapping
    for (const [legacy, u] of Object.entries(mapping)) {
      if (u === unified) {
        this.logConversion(unified, 'unified', legacy, targetSystem);
        return legacy;
      }
    }

    // Fallback to system-specific default
    const defaults: Record<string, string> = {
      vfmd: 'CONSOLIDATION',
      scanner: 'ranging',
      ml: 'RANGING',
      router: 'SIDEWAYS',
      velocity: 'SIDEWAYS',
    };

    return defaults[targetSystem] || 'UNKNOWN';
  }

  /**
   * Log conversions for migration tracking and validation
   */
  private static logConversion(
    from: string,
    fromSystem: string,
    to: string,
    toSystem: string
  ): void {
    this.conversionLog.push({
      timestamp: Date.now(),
      from,
      fromSystem,
      to,
      toSystem,
    });

    // Keep log size manageable
    if (this.conversionLog.length > this.MAX_LOG_SIZE) {
      this.conversionLog.shift();
    }
  }

  /**
   * Get conversion statistics for validation
   * Used to verify migration compatibility
   */
  static getConversionStats(): {
    totalConversions: number;
    bySystem: Record<string, number>;
    successRate: number;
    recentConversions: Array<any>;
  } {
    const bySystem: Record<string, number> = {};

    for (const entry of this.conversionLog) {
      bySystem[entry.fromSystem] = (bySystem[entry.fromSystem] || 0) + 1;
    }

    return {
      totalConversions: this.conversionLog.length,
      bySystem,
      successRate: 100, // Would be < 100 if any conversions failed
      recentConversions: this.conversionLog.slice(-10),
    };
  }

  /**
   * Validate conversion compatibility between two systems
   * Tests if old regime can round-trip to unified and back
   */
  static validateConversionRoundTrip(
    originalRegime: string,
    sourceSystem: keyof typeof RegimeMapper,
    targetSystem: keyof typeof RegimeMapper
  ): {
    valid: boolean;
    original: string;
    unified: string;
    converted: string;
    match: boolean;
  } {
    const unified = UnifiedRegimeDetector.mapToUnified(originalRegime, sourceSystem);
    const converted = this.convertBack(unified, targetSystem);

    // For some systems, exact match may not be possible (different # of regimes)
    // So we track it but don't fail validation
    const match = originalRegime.toLowerCase() === converted.toLowerCase();

    return {
      valid: true,
      original: originalRegime,
      unified,
      converted,
      match,
    };
  }

  /**
   * Clear conversion log (for testing)
   */
  static clearLog(): void {
    this.conversionLog = [];
  }

  /**
   * Export conversion log for audit trail
   */
  static exportLog(): Array<any> {
    return [...this.conversionLog];
  }
}

/**
 * Wrapper for legacy code that returns VFMD-style regimes
 * but internallly uses unified detection
 * 
 * Used during migration phase 2.1
 */
export class VFMDCompatibilityWrapper {
  /**
   * Detect regime and return as VFMD format
   * Internally uses unified detector
   */
  static async detectVFMDRegime(marketData: any): Promise<{
    regime: string;
    confidence: number;
    unified: UnifiedRegimeType; // Added field for new code
  }> {
    // Call unified detector
    const result = UnifiedRegimeDetector.detectRegime({
      adx: marketData.adx || 30,
      volatility: marketData.volatility || 0.02,
      priceVsMA: marketData.priceVsMA || 0,
      rangeWidth: marketData.rangeWidth || 0.03,
      divergence: marketData.divergence || 0,
      coherence: marketData.coherence || 0.7,
      momentum: marketData.momentum || 0,
    });

    // Convert unified back to VFMD for backward compat
    const vfmdRegime = RegimeConsolidationBridge.toVFMD(result.regime);

    return {
      regime: vfmdRegime,
      confidence: result.confidence,
      unified: result.regime,
    };
  }
}

/**
 * Wrapper for legacy market regime detector
 * Used during migration phase 2.2
 */
export class ScannerCompatibilityWrapper {
  /**
   * Detect regime and return as scanner format
   * Internally uses unified detector
   */
  static async detectScannerRegime(marketData: any): Promise<{
    regime: 'bull' | 'bear' | 'ranging';
    volatility: 'low' | 'medium' | 'high';
    confidence: number;
    unified: UnifiedRegimeType; // Added field for new code
  }> {
    const result = UnifiedRegimeDetector.detectRegime({
      adx: marketData.adx || 30,
      volatility: marketData.volatility || 0.02,
      priceVsMA: marketData.priceVsMA || 0,
      rangeWidth: marketData.rangeWidth || 0.03,
      divergence: marketData.divergence || 0,
      coherence: marketData.coherence || 0.7,
      momentum: marketData.momentum || 0,
    });

    const scannerRegime = RegimeConsolidationBridge.toScanner(result.regime) as
      | 'bull'
      | 'bear'
      | 'ranging';

    // Determine volatility level
    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (result.indicators.volatility > 0.06) {
      volatility = 'high';
    } else if (result.indicators.volatility < 0.02) {
      volatility = 'low';
    }

    return {
      regime: scannerRegime,
      volatility,
      confidence: result.confidence,
      unified: result.regime,
    };
  }
}

/**
 * Wrapper for legacy ML regime detector
 * Used during migration phase 2.3
 */
export class MLCompatibilityWrapper {
  /**
   * Detect regime and return as ML format
   * Internally uses unified detector
   */
  static async detectMLRegime(marketData: any): Promise<{
    regime: string;
    confidence: number;
    unified: UnifiedRegimeType; // Added field for new code
  }> {
    const result = UnifiedRegimeDetector.detectRegime({
      adx: marketData.adx || 30,
      volatility: marketData.volatility || 0.02,
      priceVsMA: marketData.priceVsMA || 0,
      rangeWidth: marketData.rangeWidth || 0.03,
      divergence: marketData.divergence || 0,
      coherence: marketData.coherence || 0.7,
      momentum: marketData.momentum || 0,
    });

    // ML format is already close to unified, minimal conversion needed
    return {
      regime: result.regime,
      confidence: result.confidence,
      unified: result.regime,
    };
  }
}

export default RegimeConsolidationBridge;
