/**
 * PHASE 1 CORE FIXES: TEST SUITE TEMPLATE
 * 
 * Unit tests for the 4 critical fixes
 * Run with: npm test -- Phase1CoreFixTests.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseNormalizer } from '../src/server/services/rpg-agents/convexEngine/ResponseNormalizer';
import { VFMDDeduplicator } from '../src/server/services/rpg-agents/convexEngine/VFMDDeduplicator';
import { ScaleInValidator } from '../src/server/services/rpg-agents/convexEngine/ScaleInValidator';
import { CircuitBreakerStructureAnchored } from '../src/server/services/rpg-agents/convexEngine/CircuitBreakerStructureAnchored';

// ============================================================================
// TEST 1: ResponseNormalizer
// ============================================================================

describe('ResponseNormalizer - CRITICAL FIX #1', () => {
  let normalizer: ResponseNormalizer;

  beforeEach(() => {
    normalizer = new ResponseNormalizer(200);
  });

  it('should initialize with empty history', () => {
    const health = normalizer.getHealthIndicators();
    expect(health.responseCount).toBe(0);
  });

  it('should accept raw R-scores and build history', () => {
    normalizer.update(0.5);
    normalizer.update(0.6);
    normalizer.update(0.7);
    
    const health = normalizer.getHealthIndicators();
    expect(health.responseCount).toBe(3);
  });

  it('should return raw score when insufficient history', () => {
    const result = normalizer.update(0.5);
    expect(result).toBe(0.5);  // Raw score returned
  });

  it('should normalize to percentile after 100+ bars', () => {
    // Build 100+ bars of history
    for (let i = 0; i < 150; i++) {
      const score = 0.3 + (Math.random() * 0.4);  // Range [0.3, 0.7]
      normalizer.update(score);
    }

    // Test normalization boundaries
    const veryLow = normalizer.update(0.1);   // Below range → ~0.0
    const veryHigh = normalizer.update(0.9);  // Above range → ~1.0
    const median = normalizer.update(0.5);    // Middle → ~0.5

    expect(veryLow).toBeLessThan(0.1);
    expect(veryHigh).toBeGreaterThan(0.9);
    expect(Math.abs(median - 0.5)).toBeLessThan(0.1);
  });

  it('should adapt thresholds to regime changes', () => {
    // Laminar trend regime (naturally high R-scores)
    for (let i = 0; i < 100; i++) {
      normalizer.update(0.65 + Math.random() * 0.25);  // [0.65, 0.90]
    }

    let health = normalizer.getHealthIndicators();
    const p50_laminar = health.p50;

    // Switch to choppy regime (naturally low R-scores)
    for (let i = 0; i < 100; i++) {
      normalizer.update(0.1 + Math.random() * 0.25);  // [0.10, 0.35]
    }

    health = normalizer.getHealthIndicators();
    const p50_choppy = health.p50;

    // Percentiles should shift significantly
    expect(p50_choppy).toBeLessThan(p50_laminar);
  });

  it('should calculate adaptive entry/decay thresholds', () => {
    for (let i = 0; i < 150; i++) {
      normalizer.update(0.4 + Math.random() * 0.3);
    }

    const thresholds = normalizer.getAdaptiveThresholds();
    expect(thresholds.entry).toBe(0.65);        // 65th percentile
    expect(thresholds.decay).toBe(0.40);        // 40th percentile
    expect(thresholds.scaleIn).toBe(0.75);      // 75th percentile
    expect(thresholds.strongConfidence).toBe(0.85);  // 85th percentile
  });

  it('should provide percentile rank for display', () => {
    for (let i = 0; i < 150; i++) {
      normalizer.update(0.5 + Math.random() * 0.2);
    }

    const percentile = normalizer.getNormalizedPercentile(0.4);
    expect(percentile).toBeGreaterThanOrEqual(0);
    expect(percentile).toBeLessThanOrEqual(100);
  });

  it('should pass entry threshold check', () => {
    for (let i = 0; i < 150; i++) {
      normalizer.update(0.5 + Math.random() * 0.2);
    }

    const strong = normalizer.passesEntryThreshold(0.75);
    const weak = normalizer.passesEntryThreshold(0.30);

    expect(strong).toBe(true);
    expect(weak).toBe(false);
  });

  it('should reset history', () => {
    normalizer.update(0.5);
    normalizer.update(0.6);
    normalizer.reset();

    const health = normalizer.getHealthIndicators();
    expect(health.responseCount).toBe(0);
  });
});

// ============================================================================
// TEST 2: VFMDDeduplicator
// ============================================================================

describe('VFMDDeduplicator - CRITICAL FIX #2', () => {
  let dedup: VFMDDeduplicator;

  beforeEach(() => {
    dedup = new VFMDDeduplicator(3);  // 3-bar cooldown
  });

  it('should process first VFMD in IDLE state', () => {
    const vfmd = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    const result = dedup.filter(vfmd, 0, 'IDLE');
    expect(result.shouldProcess).toBe(true);
    expect(result.action).toBe('PROCESS');
  });

  it('should ignore same-direction within cooldown', () => {
    const buySignal = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.filter(buySignal, 0, 'IDLE');
    dedup.record(buySignal, 0);

    // Same direction within 3 bars
    const buySignal2 = { ...buySignal, bar: 2 };
    const result = dedup.filter(buySignal2, 2, 'IDLE');

    expect(result.shouldProcess).toBe(false);
    expect(result.action).toBe('IGNORE');
  });

  it('should allow same-direction after cooldown expires', () => {
    const buySignal = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.filter(buySignal, 0, 'IDLE');
    dedup.record(buySignal, 0);

    // Same direction AFTER 3 bars
    const buySignal2 = { ...buySignal, bar: 4 };
    const result = dedup.filter(buySignal2, 4, 'IDLE');

    expect(result.shouldProcess).toBe(true);
    expect(result.action).toBe('PROCESS');
  });

  it('should ignore VFMD in OBSERVATION state', () => {
    const vfmd = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    const result = dedup.filter(vfmd, 0, 'OBSERVATION');
    expect(result.shouldProcess).toBe(false);
  });

  it('should ignore same-direction in POSITION_ACTIVE', () => {
    const buySignal = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.record(buySignal, 0);

    // Same direction while in position
    const result = dedup.filter(buySignal, 5, 'POSITION_ACTIVE');
    expect(result.shouldProcess).toBe(false);
  });

  it('should trigger regime check on opposite direction in POSITION_ACTIVE', () => {
    const buySignal = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.record(buySignal, 0);

    // Opposite direction while in position
    const sellSignal = { ...buySignal, direction: 'SELL' as const };
    const result = dedup.filter(sellSignal, 5, 'POSITION_ACTIVE');

    expect(result.shouldProcess).toBe(true);
    expect(result.action).toBe('REGIME_CHECK');
  });

  it('should track statistics', () => {
    const buy = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.filter(buy, 0, 'IDLE');
    dedup.filter(buy, 1, 'IDLE');  // Ignored (cooldown)
    dedup.filter(buy, 2, 'IDLE');  // Ignored (cooldown)

    const stats = dedup.getStats();
    expect(stats.processed).toBe(1);
    expect(stats.ignored).toBe(2);
    expect(stats.ignoreRate).toBeCloseTo(0.67, 1);
  });

  it('should reset state', () => {
    const vfmd = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    dedup.filter(vfmd, 0, 'IDLE');
    dedup.reset();

    const stats = dedup.getStats();
    expect(stats.processed).toBe(0);
    expect(stats.ignored).toBe(0);
  });
});

// ============================================================================
// TEST 3: ScaleInValidator
// ============================================================================

describe('ScaleInValidator - IMPORTANT FIX #3', () => {
  let validator: ScaleInValidator;
  let normalizer: ResponseNormalizer;

  beforeEach(() => {
    normalizer = new ResponseNormalizer(200);
    validator = new ScaleInValidator(normalizer);
    
    // Build history
    for (let i = 0; i < 150; i++) {
      normalizer.update(0.5 + Math.random() * 0.2);
    }
  });

  it('should block scale-in when R-score too weak', () => {
    const validation = validator.validate(0.3, 0.0);  // Weak R, no velocity
    expect(validation.canScaleIn).toBe(false);
    expect(validation.checks.rScoreStrong).toBe(false);
  });

  it('should block scale-in when R velocity negative', () => {
    const validation = validator.validate(0.75, -0.10);  // Strong R, but decelerating
    expect(validation.canScaleIn).toBe(false);
    expect(validation.checks.rVelocityHealthy).toBe(false);
  });

  it('should block scale-in when R below peak', () => {
    validator.recordRScore(0.80);  // Peak
    validator.recordRScore(0.78);
    validator.recordRScore(0.60);  // Well below peak

    const validation = validator.validate(0.60, -0.05);
    expect(validation.canScaleIn).toBe(false);
    expect(validation.checks.rNearPeak).toBe(false);
  });

  it('should approve scale-in when all conditions pass', () => {
    validator.recordRScore(0.80);  // Peak
    validator.recordRScore(0.78);
    
    const validation = validator.validate(0.75, 0.02);  // Strong, rising, near peak
    expect(validation.canScaleIn).toBe(true);
    expect(validation.checks.rScoreStrong).toBe(true);
    expect(validation.checks.rVelocityHealthy).toBe(true);
    expect(validation.checks.rNearPeak).toBe(true);
  });

  it('should provide detailed feedback', () => {
    const validation = validator.validate(0.30, -0.10);
    expect(validation.details.length).toBeGreaterThan(0);
    expect(validation.details.some(d => d.includes('✗'))).toBe(true);
  });

  it('should calculate statistics', () => {
    validator.recordRScore(0.50);
    validator.recordRScore(0.70);
    validator.recordRScore(0.60);

    const stats = validator.getStats();
    expect(stats.maxR).toBe(0.70);
    expect(stats.minR).toBe(0.50);
    expect(stats.avgR).toBeCloseTo(0.60, 1);
  });
});

// ============================================================================
// TEST 4: CircuitBreakerStructureAnchored
// ============================================================================

describe('CircuitBreakerStructureAnchored - IMPORTANT FIX #4', () => {
  let breaker: CircuitBreakerStructureAnchored;

  beforeEach(() => {
    breaker = new CircuitBreakerStructureAnchored({
      priceLossThreshold: 0.015,
      responseDecayThreshold: -0.05,
      regimeVolatilityThreshold: 4.0,
      requireBothConditions: true
    });
    
    breaker.initialize(100, 0, 0.70);  // Entry @ 100, bar 0, R=0.70
  });

  it('should not trigger on small price loss alone', () => {
    const status = breaker.check(
      98.5,    // Price loss 1.5%
      0.65,    // R still strong
      0.70,    // R not decelerating
      2.0      // Volatility low
    );

    expect(status.triggered).toBe(false);
    expect(status.conditions.priceLossTriggered).toBe(true);
    expect(status.conditions.responseWeakening).toBe(false);
  });

  it('should trigger when price loss + response decay', () => {
    const status = breaker.check(
      98.5,    // Price loss 1.5%
      0.60,    // R declining
      0.70,    // R dropping (velocity -0.10)
      2.0      // Volatility low
    );

    expect(status.triggered).toBe(true);
    expect(status.conditions.priceLossTriggered).toBe(true);
    expect(status.conditions.responseWeakening).toBe(true);
  });

  it('should trigger when price loss + regime noise', () => {
    const status = breaker.check(
      98.5,    // Price loss 1.5%
      0.65,    // R still strong
      0.70,    // R not decelerating
      5.0      // Volatility spike
    );

    expect(status.triggered).toBe(true);
    expect(status.conditions.regimeNoisy).toBe(true);
  });

  it('should respect legacy mode (price loss only)', () => {
    const legacyBreaker = new CircuitBreakerStructureAnchored({
      priceLossThreshold: 0.015,
      responseDecayThreshold: -0.05,
      regimeVolatilityThreshold: 4.0,
      requireBothConditions: false  // Legacy mode
    });
    
    legacyBreaker.initialize(100, 0, 0.70);

    const status = legacyBreaker.check(
      98.5,    // Price loss 1.5%
      0.70,    // R still strong
      0.70,    // R not decaying
      2.0      // Volatility low
    );

    expect(status.triggered).toBe(true);  // Triggers on price loss alone
  });

  it('should allow pullback with strong response', () => {
    const status = breaker.check(
      99.0,    // Small pullback (1%)
      0.75,    // R still strong
      0.70,    // R rising slightly (+0.05)
      2.0      // Volatility normal
    );

    expect(status.triggered).toBe(false);  // Healthy pullback allowed
  });

  it('should handle liquidation wick correctly', () => {
    // Initial healthy move
    const healthy = breaker.check(101.0, 0.75, 0.70, 2.0);
    expect(healthy.triggered).toBe(false);

    // Liquidation wick
    const wick = breaker.check(98.0, 0.73, 0.75, 2.0);
    expect(wick.triggered).toBe(false);  // Response still strong, doesn't trigger

    // Immediate recovery
    const recovery = breaker.check(100.5, 0.76, 0.73, 2.0);
    expect(recovery.triggered).toBe(false);  // Back in business
  });

  it('should provide diagnostics', () => {
    const diag = breaker.getDiagnostics();
    expect(diag).toContain('Entry:');
    expect(diag).toContain('threshold');
  });

  it('should allow runtime reconfiguration', () => {
    breaker.reconfigure({ priceLossThreshold: 0.02 });
    const config = breaker.getConfig();
    expect(config.priceLossThreshold).toBe(0.02);
  });
});

// ============================================================================
// INTEGRATION TEST
// ============================================================================

describe('Phase 1 Fixes - Integration', () => {
  it('should work together in a realistic scenario', () => {
    const normalizer = new ResponseNormalizer(200);
    const dedup = new VFMDDeduplicator(3);
    const validator = new ScaleInValidator(normalizer);
    const breaker = new CircuitBreakerStructureAnchored();

    // Build history
    for (let i = 0; i < 150; i++) {
      normalizer.update(0.5 + Math.random() * 0.2);
    }

    breaker.initialize(100, 0, 0.70);

    // Simulate VFMD entry + position
    const buySignal = {
      direction: 'BUY' as const,
      strength: 0.8,
      bar: 0,
      price: 100,
      reason: 'test'
    };

    const dedupResult = dedup.filter(buySignal, 0, 'IDLE');
    expect(dedupResult.shouldProcess).toBe(true);

    // Track R-score and validate scale-in
    for (let bar = 1; bar <= 10; bar++) {
      const r = 0.72 + (Math.sin(bar / 2) * 0.05);  // Oscillating but high
      const rNorm = normalizer.update(r);
      validator.recordRScore(rNorm);

      const scaleValid = validator.validate(rNorm, 0.02);
      if (bar >= 3 && bar <= 5) {
        // Should allow scale-in on bars 3-5 when R strong
        expect(scaleValid.canScaleIn).toBe(true);
      }

      // Check circuit breaker
      const breakerStatus = breaker.check(100 + bar * 0.5, rNorm, rNorm - 0.02, 2.0);
      expect(breakerStatus.triggered).toBe(false);  // No early exit
    }

    // Check dedup stats
    const stats = dedup.getStats();
    expect(stats.processed).toBe(1);
  });
});
