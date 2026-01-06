/**
 * Circuit Breaker (Structure-Anchored)
 * 
 * IMPORTANT FIX #4: Exit Only if BOTH Price Loss AND (Response Decay OR Regime Noisy)
 * 
 * Problem: Pure price-based circuit breaker
 * - Exits on liquidation wicks (reverting immediately)
 * - Exits on healthy pullbacks inside strong moves
 * - Misses convex payoff while price recovers
 * 
 * Solution: Anchor breaker to structure + response
 * Trigger circuit breaker only if BOTH:
 * 1. Price loss exceeds threshold (e.g., 1% for crypto)
 * 2. AND (response already weakening OR regime turning noisy)
 * 
 * Result:
 * - Protects against pathological losses
 * - Allows healthy pullbacks during strong response
 * - Exits only when thesis + response both broken
 */

export interface CircuitBreakerConfig {
  priceLossThreshold: number;      // 0-1 (e.g., 0.01 = 1%)
  responseDecayThreshold: number;   // R-score velocity (e.g., -0.05)
  regimeVolatilityThreshold: number; // ATR % threshold (e.g., 3.0 = 3%)
  requireBothConditions: boolean;   // Must have price loss AND (decay OR noise)
}

export interface CircuitBreakerStatus {
  triggered: boolean;
  reason?: string;
  conditions: {
    priceLossTriggered: boolean;
    responseWeakening: boolean;
    regimeNoisy: boolean;
  };
  diagnostics: {
    priceLossPct: number;
    rVelocity: number;
    atrPercent: number;
    unrealizedPnL: number;
  };
}

export class CircuitBreakerStructureAnchored {
  private entryPrice: number = 0;
  private entryBar: number = 0;
  private maxProfitPrice: number = 0;
  private lastGoodRScore: number = 0;
  
  private config: CircuitBreakerConfig;
  
  /**
   * Initialize circuit breaker with configuration
   * 
   * Default configs per asset class:
   * - Crypto: { priceLoss: 0.015, volatility: 4.0 }
   * - Stocks: { priceLoss: 0.008, volatility: 2.5 }
   * - Forex: { priceLoss: 0.003, volatility: 2.0 }
   */
  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      priceLossThreshold: config?.priceLossThreshold ?? 0.015,      // 1.5% default
      responseDecayThreshold: config?.responseDecayThreshold ?? -0.05,  // -5% decay
      regimeVolatilityThreshold: config?.regimeVolatilityThreshold ?? 4.0,  // 4% volatility
      requireBothConditions: config?.requireBothConditions ?? true
    };
  }
  
  /**
   * Initialize breaker at entry point
   */
  initialize(entryPrice: number, entryBar: number, initialRScore: number): void {
    this.entryPrice = entryPrice;
    this.entryBar = entryBar;
    this.maxProfitPrice = entryPrice;
    this.lastGoodRScore = initialRScore;
  }
  
  /**
   * Check if circuit breaker should trigger
   * 
   * @param currentPrice - Current market price
   * @param currentRScore - Current response score
   * @param previousRScore - Previous bar's R score
   * @param atrPercent - ATR as % of price (volatility metric)
   * @returns CircuitBreakerStatus with trigger decision
   */
  check(
    currentPrice: number,
    currentRScore: number,
    previousRScore: number,
    atrPercent: number
  ): CircuitBreakerStatus {
    // Update tracking
    this.maxProfitPrice = Math.max(this.maxProfitPrice, currentPrice);
    
    // CONDITION 1: Price loss check
    const unrealizedPnL = currentPrice - this.entryPrice;
    const unrealizedPnLPct = unrealizedPnL / this.entryPrice;
    const priceLossTriggered = Math.abs(unrealizedPnLPct) > this.config.priceLossThreshold
      && unrealizedPnLPct < 0;  // Only if losing (not in profit)
    
    // CONDITION 2: Response weakening check
    const rVelocity = currentRScore - previousRScore;
    const responseWeakening = rVelocity < this.config.responseDecayThreshold;
    
    // CONDITION 3: Regime noise check
    const regimeNoisy = atrPercent > this.config.regimeVolatilityThreshold;
    
    // DECISION: Should breaker trigger?
    let triggered = false;
    let reason = '';
    
    if (this.config.requireBothConditions) {
      // STRICT MODE: Price loss PLUS (response decay OR regime noise)
      triggered = priceLossTriggered && (responseWeakening || regimeNoisy);
      
      if (triggered) {
        const decayReason = responseWeakening ? `R decaying (${(rVelocity * 100).toFixed(1)}%)` : '';
        const noiseReason = regimeNoisy ? `regime noisy (ATR ${(atrPercent).toFixed(1)}%)` : '';
        const conditions = [decayReason, noiseReason].filter(r => r).join(' + ');
        reason = `Price loss ${(Math.abs(unrealizedPnLPct) * 100).toFixed(1)}% + ${conditions}`;
      }
    } else {
      // LEGACY MODE: Price loss alone triggers
      triggered = priceLossTriggered;
      if (triggered) {
        reason = `Price loss ${(Math.abs(unrealizedPnLPct) * 100).toFixed(1)}%`;
      }
    }
    
    // Update "good" state if not triggered
    if (!triggered) {
      this.lastGoodRScore = currentRScore;
    }
    
    return {
      triggered,
      reason: triggered ? reason : undefined,
      conditions: {
        priceLossTriggered,
        responseWeakening,
        regimeNoisy
      },
      diagnostics: {
        priceLossPct: Math.abs(unrealizedPnLPct),
        rVelocity,
        atrPercent,
        unrealizedPnL
      }
    };
  }
  
  /**
   * Get circuit breaker status for logging
   */
  getStatus(): CircuitBreakerStatus {
    return {
      triggered: false,
      conditions: {
        priceLossTriggered: false,
        responseWeakening: false,
        regimeNoisy: false
      },
      diagnostics: {
        priceLossPct: 0,
        rVelocity: 0,
        atrPercent: 0,
        unrealizedPnL: 0
      }
    };
  }
  
  /**
   * Reconfigure breaker thresholds at runtime
   */
  reconfigure(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
  
  /**
   * Get diagnostics for current state
   */
  getDiagnostics(): string {
    return [
      `Entry: ${this.entryPrice.toFixed(2)}`,
      `Max profit: ${this.maxProfitPrice.toFixed(2)}`,
      `Last good R: ${(this.lastGoodRScore * 100).toFixed(0)}%`,
      `Price threshold: ${(this.config.priceLossThreshold * 100).toFixed(1)}%`,
      `Volatility threshold: ${this.config.regimeVolatilityThreshold.toFixed(1)}%`
    ].join(' | ');
  }
}
