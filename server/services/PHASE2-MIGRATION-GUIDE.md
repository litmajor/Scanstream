/**
 * PHASE 2 MIGRATION GUIDE - DETECTOR CONSOLIDATION
 * 
 * This document provides step-by-step instructions for migrating each detector
 * to use UnifiedRegimeDetector while maintaining backward compatibility.
 * 
 * Total Timeline: 20 hours (5 detectors × 4 hours average)
 * Order: regimeClassifier → market-regime-detector → ml-regime-detector → 
 *        regime-assessment → ml-regime-ensemble (deprecate)
 * 
 * Each step includes:
 * - Migration steps with code examples
 * - Backward compatibility patterns
 * - Validation checklist
 * - Rollback procedures
 */

/**
 * ============================================================================
 * DETECTOR 1: regimeClassifier.ts (4 HOURS)
 * ============================================================================
 * 
 * CURRENT STATE:
 * - Standalone regime detection from VFMD and market structure
 * - Outputs: { regime: VFMDRegime, confidence: number, timestamp: number }
 * - Used by: VFMDPhysicsAgent, regime-aware-signal-router
 * 
 * TARGET STATE:
 * - Delegates to UnifiedRegimeDetector internally
 * - Output format: UNCHANGED (returns VFMDRegime via mapping)
 * - No breaking changes for consumers
 * 
 * MIGRATION STRATEGY:
 * 1. Create side-by-side detection (parallel old + new) [1h]
 * 2. Wire unified detection as internal logic [1h]
 * 3. Map unified result back to VFMD format [30m]
 * 4. Validate on 3-month backtest [1h 30m]
 * 
 * STEP 1: Open regimeClassifier.ts and add parallel detection
 * ============================================================================
 */

// BEFORE STATE (existing code structure):
// interface RegimeClassifierState {
//   lastRegime: VFMDRegime;
//   confidence: number;
//   transitions: RegimeTransition[];
// }
//
// class RegimeClassifier {
//   classify(marketData: MarketData): ClassificationResult {
//     // Old logic based on VFMD indicators
//     const adx = marketData.adx;
//     const volume = marketData.volume;
//     const trend = this.calculateTrend(marketData);
//     
//     // Direct regime determination
//     if (adx > 25 && trend > 0) return { regime: 'LAMINAR_TREND', ... };
//     if (this.isConsolidating(marketData)) return { regime: 'consolidation', ... };
//     return { regime: 'ranging', ... };
//   }
// }

// AFTER STATE (with parallel detection):
interface RegimeClassifierState {
  lastRegime: VFMDRegime;
  confidence: number;
  transitions: RegimeTransition[];
  unifiedRegime?: UnifiedRegimeType; // NEW: Track unified for comparison
  divergences?: number; // NEW: Track mapping divergences
}

class RegimeClassifier {
  private unifiedDetector = UnifiedRegimeDetector;
  private bridge = RegimeConsolidationBridge;

  /**
   * PHASE 2 MIGRATION: Parallel Detection
   * Keep old logic but also run unified detection
   */
  async classify(marketData: MarketData): Promise<ClassificationResult> {
    // STEP 1: Keep existing logic for backward compatibility
    const oldResult = this.classifyLegacy(marketData);

    // STEP 2: Run unified detection in parallel (NEW)
    const unifiedResult = this.detectUnified(marketData);

    // STEP 3: Compare and log divergences
    const comparisonBridge = this.bridge.fromVFMD(oldResult.regime);
    const mismatch =
      comparisonBridge !== unifiedResult.regime
        ? `Divergence: VFMD=${oldResult.regime} → Unified=${comparisonBridge}, vs Direct=${unifiedResult.regime}`
        : null;

    // STEP 4: Return VFMD format (unchanged) but track unified internally
    return {
      regime: oldResult.regime,
      confidence: oldResult.confidence,
      timestamp: oldResult.timestamp,
      // NEW FIELDS (backward compatible, optional):
      unifiedRegime: unifiedResult.regime,
      unifiedConfidence: unifiedResult.confidence,
      mappingDivergence: mismatch,
    };
  }

  /**
   * STEP 2: Implement unified detection (NEW METHOD)
   * Extracts market indicators and feeds to UnifiedRegimeDetector
   */
  private detectUnified(marketData: MarketData): RegimeDetectionResult {
    // Extract indicators from market data
    const params = {
      adx: marketData.adx ?? 20,
      volatility: marketData.volatilityPercent ?? 0.02,
      priceVsMA: marketData.priceVsMA50 ?? 0,
      rangeWidth: marketData.rangeWidth ?? 0.03,
      divergence: marketData.divergence ?? 0,
      coherence: marketData.signalCoherence ?? 0.7,
      momentum: marketData.momentum ?? 0,
      rsi: marketData.rsi, // Optional
    };

    // Call unified detector
    return this.unifiedDetector.detectRegime(params);
  }

  /**
   * STEP 3: Preserve legacy logic (keep as-is)
   */
  private classifyLegacy(marketData: MarketData): ClassificationResult {
    // Existing logic unchanged
    const adx = marketData.adx;
    const trend = this.calculateTrend(marketData);

    if (adx > 25 && trend > 0) return { regime: 'LAMINAR_TREND', confidence: 0.85 };
    if (adx > 25 && trend < 0) return { regime: 'BEARISH_TREND', confidence: 0.85 };
    if (this.isConsolidating(marketData)) return { regime: 'consolidation', confidence: 0.7 };

    return { regime: 'ranging', confidence: 0.6 };
  }

  // Existing helper methods stay the same...
  private calculateTrend(data: MarketData): number {
    // unchanged
    return 0;
  }

  private isConsolidating(data: MarketData): boolean {
    // unchanged
    return false;
  }
}

/**
 * VALIDATION CHECKLIST FOR DETECTOR 1:
 * 
 * □ Side-by-side detection running without errors
 * □ Output format unchanged (still returns VFMD regimes)
 * □ Divergence tracking < 5% over 3-month period
 * □ No breaking changes to VFMDPhysicsAgent
 * □ ConversionBridge round-trip tests pass
 * □ Backtest results within 2% of baseline
 * □ Performance: unified detection adds <1ms latency
 * 
 * ROLLBACK PROCEDURE:
 * 
 * If issues arise:
 * 1. Comment out detectUnified() call in classify()
 * 2. Comment out unifiedRegime field assignments
 * 3. Return to 100% legacy logic (no changes needed)
 * 4. Revert git changes: git checkout -- regimeClassifier.ts
 * 
 * VALIDATION COMMANDS:
 * 
 * npm test -- regimeClassifier.test.ts
 * npm run backtest:regimeClassifier --period=3m
 * npm run divergence-report -- --detector=regimeClassifier
 */

/**
 * ============================================================================
 * DETECTOR 2: market-regime-detector.ts (4 HOURS)
 * ============================================================================
 * 
 * CURRENT STATE:
 * - Detects bull/bear/neutral from price + volume structure
 * - Uses: MA crossovers, volume trends, volatility bands
 * - Output: { regime: 'BULL' | 'BEAR' | 'NEUTRAL', signal: number }
 * - Used by: TradingAgent, AgentArena for signal weighting
 * 
 * TARGET STATE:
 * - Delegates to UnifiedRegimeDetector
 * - Maintains output format but adds unified regime
 * - Removes duplicate calculation (volume trend already in unified)
 * 
 * MIGRATION STEPS:
 * 1. Analyze current bull/bear detection logic [1h]
 * 2. Map to unified regime system [30m]
 * 3. Implement dual detection path [1h]
 * 4. Validate consistency [1h 30m]
 * 
 * KEY INSIGHT: Bull/Bear is subset of unified system
 * - BULL = TRENDING_UP
 * - BEAR = TRENDING_DOWN
 * - NEUTRAL = RANGING or CONSOLIDATING
 */

class MarketRegimeDetector {
  private unifiedDetector = UnifiedRegimeDetector;

  /**
   * Detect market regime from OHLCV structure
   * PHASE 2: Wire to unified system while maintaining output interface
   */
  detect(
    ohlcv: OHLCVData
  ): {
    regime: 'BULL' | 'BEAR' | 'NEUTRAL';
    signal: number;
    confidence: number;
    unifiedRegime?: UnifiedRegimeType;
  } {
    // STEP 1: Extract unified detection inputs
    const unifiedResult = this.unifiedDetector.detectRegime({
      adx: this.calculateADX(ohlcv),
      volatility: this.calculateVolatility(ohlcv),
      priceVsMA: this.calculatePriceVsMA(ohlcv),
      rangeWidth: this.calculateRangeWidth(ohlcv),
      divergence: this.calculateDivergence(ohlcv),
      coherence: this.calculateCoherence(ohlcv),
      momentum: this.calculateMomentum(ohlcv),
    });

    // STEP 2: Map unified regime back to bull/bear
    const legacy = this.mapUnifiedToLegacy(unifiedResult.regime);

    // STEP 3: Return with both formats (backward compatible)
    return {
      regime: legacy,
      signal: this.calculateSignalStrength(unifiedResult),
      confidence: unifiedResult.confidence,
      unifiedRegime: unifiedResult.regime,
    };
  }

  /**
   * Map unified regimes to bull/bear/neutral
   */
  private mapUnifiedToLegacy(
    unified: UnifiedRegimeType
  ): 'BULL' | 'BEAR' | 'NEUTRAL' {
    switch (unified) {
      case 'TRENDING_UP':
      case 'BREAKOUT_TRANSITION': // Treat breakouts as bull
        return 'BULL';

      case 'TRENDING_DOWN':
        return 'BEAR';

      case 'RANGING':
      case 'CONSOLIDATING':
      case 'VOLATILE':
      case 'ACCUMULATION':
      case 'DISTRIBUTION':
      default:
        return 'NEUTRAL';
    }
  }

  /**
   * Calculate signal strength from unified result
   * Replaces old calculation method
   */
  private calculateSignalStrength(result: RegimeDetectionResult): number {
    // 0 = neutral, ±1.0 = strong bull/bear
    const direction =
      result.regime === 'TRENDING_UP'
        ? 1
        : result.regime === 'TRENDING_DOWN'
          ? -1
          : 0;

    return direction * (result.confidence * 0.8 + (result.strength / 100) * 0.2);
  }

  // Extract calculation methods from existing code:
  private calculateADX(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculateVolatility(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculatePriceVsMA(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculateRangeWidth(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculateDivergence(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculateCoherence(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }

  private calculateMomentum(ohlcv: OHLCVData): number {
    // Existing logic
    return 0;
  }
}

/**
 * VALIDATION CHECKLIST FOR DETECTOR 2:
 * 
 * □ Bull/Bear/Neutral signal preserved
 * □ Signal strength in [-1, 1] range
 * □ Unified regime tracking working
 * □ TradingAgent receives same signal weights
 * □ Round-trip validation: BULL ↔ TRENDING_UP
 * □ Backtest performance within 1%
 * □ No regressions in signal quality
 * 
 * TESTING COMMANDS:
 * npm test -- market-regime-detector.test.ts
 * npm run backtest -- --detector=market-regime --period=1y
 */

/**
 * ============================================================================
 * DETECTOR 3: ml-regime-detector.ts (5 HOURS)
 * ============================================================================
 * 
 * CURRENT STATE:
 * - ML model predicts regime from 20+ features
 * - Features: volume, price, volatility, time-of-day, etc.
 * - Output: { regime: string, confidence: number, modelVersion: string }
 * - Training: Online learning with new samples
 * 
 * TARGET STATE:
 * - Replace feature extraction with unified inputs
 * - Use unified regime detection as pre-filter
 * - Maintain model training pipeline (still learns per-regime)
 * - Output both unified and model predictions
 * 
 * MIGRATION STRATEGY:
 * 1. Analyze current feature engineering [1h]
 * 2. Map features to unified inputs [1h]
 * 3. Create pre-filtering with unified system [1h]
 * 4. Validate model accuracy preserved [1.5h]
 * 5. Update training data pipeline [30m]
 * 
 * KEY INSIGHT: ML model learns per-regime, unified system pre-classifies
 * - Reduces feature complexity
 * - Ensures consistency with other detectors
 * - Model still captures fine-grained patterns
 */

class MLRegimeDetector {
  private unifiedDetector = UnifiedRegimeDetector;
  private model?: any; // TensorFlow model

  /**
   * Predict regime using ML model
   * PHASE 2: Pre-filter with unified, maintain model for refinement
   */
  async predict(
    features: Record<string, number>
  ): Promise<{
    regime: string;
    confidence: number;
    unifiedRegime?: UnifiedRegimeType;
    modelVersion: string;
  }> {
    // STEP 1: Get unified pre-classification
    const unifiedResult = this.unifiedDetector.detectRegime({
      adx: features.adx ?? 20,
      volatility: features.volatility ?? 0.02,
      priceVsMA: features.priceVsMA ?? 0,
      rangeWidth: features.rangeWidth ?? 0.03,
      divergence: features.divergence ?? 0,
      coherence: features.coherence ?? 0.7,
      momentum: features.momentum ?? 0,
      rsi: features.rsi,
    });

    // STEP 2: Use model for regime-specific refinement
    // Only run ML if unified confidence is moderate
    let modelPrediction = unifiedResult.regime;
    let modelConfidence = unifiedResult.confidence;

    if (unifiedResult.confidence < 0.85 && this.model) {
      // Low confidence = need ML refinement
      const refinement = await this.refineWithML(
        features,
        unifiedResult.regime
      );
      modelPrediction = refinement.regime;
      modelConfidence = refinement.confidence;
    }

    return {
      regime: modelPrediction,
      confidence: modelConfidence,
      unifiedRegime: unifiedResult.regime,
      modelVersion: this.model?.version ?? 'unified-only',
    };
  }

  /**
   * ML-specific refinement (keeping model refinement capability)
   */
  private async refineWithML(
    features: Record<string, number>,
    priorRegime: string
  ): Promise<{ regime: string; confidence: number }> {
    if (!this.model) {
      return { regime: priorRegime, confidence: 0.5 };
    }

    // Normalize features
    const normalized = this.normalizeFeatures(features);

    // Run prediction
    const predictions = await this.model.predict(normalized);

    // Find best regime
    const regimes = Array.from(Object.entries(predictions));
    regimes.sort(([, a], [, b]) => b - a);

    return {
      regime: regimes[0][0],
      confidence: regimes[0][1],
    };
  }

  private normalizeFeatures(features: Record<string, number>): any {
    // Feature normalization logic
    return features;
  }
}

/**
 * VALIDATION CHECKLIST FOR DETECTOR 3:
 * 
 * □ ML model predictions still trained properly
 * □ Feature extraction simplified with unified inputs
 * □ Confidence scores calibrated correctly
 * □ Unified pre-filter improves consistency
 * □ Model accuracy maintained (>95% on test set)
 * □ Training pipeline updated for unified system
 * □ Prediction latency: <10ms per sample
 * 
 * TESTING COMMANDS:
 * npm test -- ml-regime-detector.test.ts
 * npm run ml:train -- --detector=ml-regime
 * npm run ml:validate -- --testset=3m
 */

/**
 * ============================================================================
 * DETECTOR 4: regime-assessment.ts (3 HOURS)
 * ============================================================================
 * 
 * CURRENT STATE:
 * - Composite assessment from multiple sources
 * - Aggregates: VFMDClassifier + MarketRegimeDetector + CustomLogic
 * - Output: { regime: string, score: number, sources: Map<string, string> }
 * - Used by: Signal weighting, position sizing
 * 
 * TARGET STATE:
 * - Use UnifiedRegimeDetector as primary
 * - Remove duplicate logic (already handled by unified)
 * - Use multi-timeframe voting for weight
 * - Output: Same interface, unified-backed
 * 
 * MIGRATION STRATEGY:
 * 1. Remove duplicate calculations [1h]
 * 2. Wire to unified detector [1h]
 * 3. Consolidate source aggregation [1h]
 */

class RegimeAssessment {
  private unifiedDetector = UnifiedRegimeDetector;
  private vfmdClassifier = new RegimeClassifier();

  /**
   * Assess regime from multiple perspectives
   * PHASE 2: Delegate to unified, keep source tracking
   */
  assess(
    marketData: MarketData,
    timeframes: string[] = ['1H', '4H', '1D']
  ): {
    regime: string;
    score: number;
    sources: Map<string, string>;
    multiTimeframeConsensus?: string;
  } {
    // STEP 1: Collect regime detections from each timeframe
    const timeframeDetections = timeframes.map((tf) =>
      this.unifiedDetector.detectRegime({
        adx: marketData[tf]?.adx ?? 20,
        volatility: marketData[tf]?.volatility ?? 0.02,
        priceVsMA: marketData[tf]?.priceVsMA ?? 0,
        rangeWidth: marketData[tf]?.rangeWidth ?? 0.03,
        divergence: marketData[tf]?.divergence ?? 0,
        coherence: marketData[tf]?.coherence ?? 0.7,
        momentum: marketData[tf]?.momentum ?? 0,
      })
    );

    // STEP 2: Get multi-timeframe consensus
    const regimeTimeframeData = timeframeDetections.map((r, i) => ({
      regime: r.regime,
      confidence: r.confidence,
      timeframe: timeframes[i],
    }));

    const consensus = this.unifiedDetector.multiTimeframeVoting(
      regimeTimeframeData
    );

    // STEP 3: Build source map for audit trail
    const sources = new Map<string, string>();
    timeframeDetections.forEach((r, i) => {
      sources.set(timeframes[i], r.regime);
    });
    sources.set('consensus', consensus.consensus);

    return {
      regime: consensus.consensus,
      score: consensus.confidence * 100,
      sources,
      multiTimeframeConsensus: consensus.consensus,
    };
  }
}

/**
 * VALIDATION CHECKLIST FOR DETECTOR 4:
 * 
 * □ Multi-timeframe voting working correctly
 * □ Source audit trail maintained
 * □ Score calculation matches expectations
 * □ Position sizing logic still works
 * □ Signal weighting unchanged
 * □ Backtest results match baseline
 * 
 * TESTING COMMANDS:
 * npm test -- regime-assessment.test.ts
 * npm run backtest -- --detector=assessment
 */

/**
 * ============================================================================
 * DETECTOR 5: ml-regime-ensemble.ts (2 HOURS - DEPRECATION)
 * ============================================================================
 * 
 * CURRENT STATE:
 * - Ensemble of 3 ML models voting on regime
 * - Redundant with MLOracle (which also does ensemble)
 * - Output: { regime: string, confidence: number, votes: number }
 * - Used by: Legacy code paths
 * 
 * TARGET STATE:
 * - DEPRECATED - functionality now in MLOracle
 * - Create compatibility shim that delegates to MLOracle
 * - Remove from all consumers (phase 3)
 * 
 * MIGRATION STRATEGY:
 * 1. Create deprecation wrapper [30m]
 * 2. Redirect imports to MLOracle [1h]
 * 3. Mark file as deprecated [30m]
 */

// DEPRECATION WARNING COMMENT
/**
 * @deprecated Use MLOracle instead. This ensemble duplicates MLOracle's functionality.
 * Migration: Replace all imports of ml-regime-ensemble with MLOracle
 * Removal date: Phase 3 (after all consumers updated)
 * 
 * DEPRECATION SHIM:
 */

class MLRegimeEnsembleDeprecationShim {
  private mlOracle = new MLOracle();

  /**
   * @deprecated Use MLOracle.predictRegime() instead
   */
  async predict(features: Record<string, number>): Promise<{
    regime: string;
    confidence: number;
    votes: number;
  }> {
    console.warn(
      'DEPRECATED: ml-regime-ensemble.predict() called. Use MLOracle instead.'
    );

    const result = await this.mlOracle.predictRegime(features);

    return {
      regime: result.regime,
      confidence: result.confidence,
      votes: 3, // Dummy - MLOracle is single unified model
    };
  }
}

/**
 * VALIDATION CHECKLIST FOR DETECTOR 5:
 * 
 * □ All imports redirected to MLOracle
 * □ Deprecation warnings logged
 * □ No functional changes (delegation works)
 * □ Marked for removal in Phase 3
 * 
 * MIGRATION COMMANDS:
 * grep -r "ml-regime-ensemble" src/ --include="*.ts" | wc -l  # Count references
 * npm run deprecation-check # Finds all import uses
 */

/**
 * ============================================================================
 * PHASE 2 COMPLETION CHECKLIST
 * ============================================================================
 * 
 * After all 5 detectors migrated:
 * 
 * ✓ Detector Migration:
 *   □ regimeClassifier.ts - Parallel detection working
 *   □ market-regime-detector.ts - Bull/bear preserved
 *   □ ml-regime-detector.ts - ML model updated
 *   □ regime-assessment.ts - Consolidation done
 *   □ ml-regime-ensemble.ts - Deprecation wrapper active
 * 
 * ✓ Validation:
 *   □ All 5 detectors pass individual tests
 *   □ Backtest results within tolerance (<2%)
 *   □ Divergence tracking < 5% across board
 *   □ Performance: <1ms additional latency per detector
 *   □ Backward compatibility maintained (0 breaking changes)
 * 
 * ✓ Infrastructure:
 *   □ UnifiedRegimeDetector in production
 *   □ RegimeConsolidationBridge live
 *   □ Migration validator tool ready
 *   □ Monitoring dashboards updated
 * 
 * ✓ Risk Mitigation:
 *   □ Rollback procedures documented
 *   □ Backup detectors ready (old logic preserved)
 *   □ Gradual rollout plan approved
 *   □ On-call support briefed
 * 
 * PHASE 2 DURATION: 20 hours (4+4+5+3+2 hours + 2 hours overhead)
 * PHASE 2 COMPLETION: When all detectors + validation passing
 * NEXT PHASE: Phase 3 - Consumer integration (12 hours)
 */

export {};
