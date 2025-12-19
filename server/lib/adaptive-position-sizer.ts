/**
 * PHASE 5: ADAPTIVE POSITION SIZING & RISK MANAGEMENT
 * 
 * Unified Intelligence Framework with 6 sizing methods:
 * 1. Confidence-Based (primary) - scales with signal certainty
 * 2. Kelly Criterion - optimal f* from historical metrics
 * 3. Volatility-Adjusted - adapts to market conditions (ATR%)
 * 4. Risk-to-Reward - controls risk per trade
 * 5. Equity Percentage - account-based scaling
 * 6. RL Adaptive (hooks) - for future ML optimization
 * 
 * Features:
 * - Daily risk budget tracking & enforcement
 * - Historical metrics by signal source
 * - Source weighting (ML > Scanner > Gateway > Agent)
 * - Unified decision engine orchestration
 * - Performance dashboard data structures
 * - RL integration hooks for future enhancements
 * 
 * Goals:
 * - Optimize risk-adjusted returns (+5-10% Sharpe)
 * - Reduce maximum drawdown (-2-3%)
 * - Scale positions based on conviction
 * - Prevent over-leverage
 * - Dynamic portfolio correlation management
 */

import type { QualityGatedSignal } from './quality-gating-engine';
import type { RegimeDetectionResult } from './regime-assessment';

// ============================================================================
// TYPE DEFINITIONS: EXTENDED UNIFIED INTELLIGENCE
// ============================================================================

export type SizingStrategy = 'KELLY' | 'VOLATILITY_BASED' | 'EQUITY_PERCENTAGE' | 'FIXED' | 'ADAPTIVE' | 'CONFIDENCE_BASED' | 'RL_ADAPTIVE' | 'RISK_TO_REWARD';
export type RiskLevel = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
export type SignalSource = 'ML' | 'SCANNER' | 'GATEWAY' | 'AGENT';
export type VolatilityRegime = 'low' | 'normal' | 'high' | 'extreme';

// Historical metrics per signal source
export interface SignalSourceMetrics {
  source: SignalSource;
  totalTrades: number;
  winRate: number;                      // 0-1: Historical win rate
  avgWin: number;                       // Average $ gain per win
  avgLoss: number;                      // Average $ loss per loss
  averageRiskRewardRatio: number;        // Avg reward / avg risk
  sharpeRatio?: number;                 // Historical Sharpe ratio
  confidenceLevel: 'high' | 'medium' | 'low'; // Based on trade count (50+/high)
  kellyFraction?: number;               // Pre-calculated Kelly %
  lastUpdated: Date;
}

// Daily risk budget state
export interface DailyRiskBudget {
  date: Date;
  accountEquity: number;
  maxDailyRiskPercent: number;           // 5% default
  maxDailyRiskAmount: number;            // Calculated from equity
  usedRiskAmount: number;                // Running total today
  remainingRiskAmount: number;           // Calculated
  openPositionCount: number;
  maxOpenPositions: number;
  tradesExecutedToday: number;
  isOpen: boolean;                       // Can still trade today
}

// Signal source context
export interface PositionSizingInput {
  symbol: string;
  signalStrength: number;               // 0-1: Quality gating confidence
  signalAction: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  
  // Signal source context
  signalSource: SignalSource;           // NEW: Which system generated signal
  signalConfidence?: number;            // NEW: Source-specific confidence
  
  // Account metrics
  accountEquity: number;
  accountRiskPercentage: number;        // % of equity to risk per trade
  maxDailyRiskPercent?: number;         // NEW: Daily cap (default 5%)
  
  // Market conditions
  volatility: number;                   // ATR% or normalized volatility
  volatilityRegime: VolatilityRegime;   // NEW: Explicit regime classification
  regime: string;                       // TRENDING, RANGING, VOLATILE, etc.
  
  // Portfolio context
  existingPositions: PortfolioPosition[];
  correlationWithPortfolio: number;     // -1 to +1
  
  // Daily budget & constraints
  dailyRiskBudget?: DailyRiskBudget;    // NEW: Daily risk tracking
  
  // Strategy preference
  sizingStrategy: SizingStrategy;
  riskLevel: RiskLevel;
  
  // Historical metrics by source (for Kelly calculation)
  historicalMetrics?: Record<SignalSource, SignalSourceMetrics>;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  correlation?: number;                 // Correlation with new signal
  sourceSignal?: SignalSource;          // NEW: Track which source opened position
}

// Enhanced output with unified intelligence breakdown
export interface PositionSizeOutput {
  symbol: string;
  recommendedQuantity: number;
  recommendedSize: number;              // In dollars
  riskAmount: number;                   // Max loss per position
  rewardTarget: number;                 // Expected profit target
  riskRewardRatio: number;
  
  // Method breakdown (new)
  methodBreakdown: {
    confidenceBasedSize: number;        // NEW: Primary method
    kellyOptimalSize?: number;          // NEW: If historical data available
    volatilityAdjustedSize: number;     // NEW: Market-adjusted
    riskToRewardSize: number;           // NEW: SL-based
    equityPercentageSize: number;       // NEW: Account-based
    rlAdaptiveSize?: number;            // NEW: ML prediction (future)
  };
  
  sizing: {
    baseSize: number;
    volatilityAdjustment: number;       // Multiplier
    signalStrengthAdjustment: number;   // Multiplier
    sourceWeightAdjustment: number;     // NEW: Source credibility multiplier
    correlationAdjustment: number;      // Multiplier
    dailyBudgetAdjustment: number;      // NEW: Daily cap multiplier
    finalSize: number;
  };
  
  // Source-specific metrics (new)
  sourceMetrics?: {
    source: SignalSource;
    sourceConfidence: number;
    sourceWeight: number;               // 1.0 (ML) to 0.5 (Agent)
    historicalWinRate?: number;
    kellyFraction?: number;
    dataQuality: 'high' | 'medium' | 'low';
  };
  
  // Daily budget impact (new)
  dailyBudgetImpact?: {
    riskUsedByThisTrade: number;
    totalRiskUsedToday: number;
    remainingRiskToday: number;
    dailyBudgetPercentUsed: number;
    dailyBudgetStatus: 'safe' | 'caution' | 'exceeded';
  };
  
  rationale: string[];
  warnings: string[];
  kellyFraction?: number;               // If Kelly strategy used
  maxDrawdownLimit?: number;            // Max allowed drawdown
  
  // Dashboard metrics (new)
  dashboardMetrics?: {
    methodsApplied: SizingStrategy[];
    totalAdjustmentMultiplier: number;
    confidenceScore: number;            // 0-1: Overall quality
    riskLevel: RiskLevel;
    recommendationStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'REJECT';
  };
}

export interface KellyInput {
  winRate: number;                      // Historical win rate (0-1)
  avgWin: number;                       // Average $ gain per win
  avgLoss: number;                      // Average $ loss per loss
  riskRewardRatio: number;              // Avg reward / avg risk
  tradeCount?: number;                  // NEW: For confidence calculation
}

// ============================================================================
// KELLY CRITERION CALCULATOR
// ============================================================================

export class KellyCriterionCalculator {
  /**
   * Calculate optimal position size using Kelly Criterion
   * f* = (bp - q) / b
   * where: f* = optimal fraction, b = odds, p = win rate, q = loss rate
   */
  calculateKellyFraction(input: KellyInput): {
    kellyFraction: number;
    safeKellyFraction: number;          // Kelly / 4 (conservative)
    fractionalKelly: number;            // Kelly / 2 (moderate)
    reasoning: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  } {
    const { winRate, avgWin, avgLoss, riskRewardRatio, tradeCount } = input;

    if (winRate <= 0 || winRate >= 1 || avgWin <= 0 || avgLoss <= 0) {
      return {
        kellyFraction: 0,
        safeKellyFraction: 0,
        fractionalKelly: 0,
        reasoning: 'Invalid input: win rate must be between 0 and 1, wins/losses must be positive',
        confidenceLevel: 'low'
      };
    }

    // Kelly Criterion formula
    const b = avgWin / avgLoss;  // Odds ratio
    const p = winRate;            // Win probability
    const q = 1 - winRate;        // Loss probability

    const kellyFraction = (b * p - q) / b;

    // Apply safety constraints
    const constrained = Math.max(0, Math.min(0.25, kellyFraction)); // Cap at 25%

    // Determine confidence based on historical data volume
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (tradeCount && tradeCount >= 50) confidenceLevel = 'high';
    else if (tradeCount && tradeCount >= 25) confidenceLevel = 'medium';

    return {
      kellyFraction: constrained,
      safeKellyFraction: constrained / 4,      // Quarter Kelly (very conservative)
      fractionalKelly: constrained / 2,        // Half Kelly (conservative)
      reasoning: `Kelly: ${(constrained * 100).toFixed(1)}% | Safe: ${(constrained / 4 * 100).toFixed(1)}% | Fractional: ${(constrained / 2 * 100).toFixed(1)}% (${tradeCount || 0} trades)`,
      confidenceLevel
    };
  }
}

// ============================================================================
// CONFIDENCE-BASED POSITION SIZER (PRIMARY METHOD)
// ============================================================================

export class ConfidenceBasedSizer {
  private sourceWeights = {
    'ML': 1.0,
    'SCANNER': 0.8,
    'GATEWAY': 0.6,
    'AGENT': 0.5
  };

  /**
   * Size position based on signal confidence (primary method)
   * position = baseSize * confidence * sourceWeight
   */
  calculateConfidenceSize(
    baseSize: number,
    confidence: number,
    source: SignalSource
  ): {
    size: number;
    sourceWeight: number;
    description: string;
  } {
    const sourceWeight = this.sourceWeights[source] || 0.5;
    const size = baseSize * Math.min(confidence, 1.0) * sourceWeight;

    return {
      size,
      sourceWeight,
      description: `${source} signal at ${(confidence * 100).toFixed(0)}% confidence (${sourceWeight}x weight) = ${(size).toFixed(0)}`
    };
  }

  /**
   * Get source credibility weight
   */
  getSourceWeight(source: SignalSource): number {
    return this.sourceWeights[source] || 0.5;
  }
}

// ============================================================================
// VOLATILITY-BASED POSITION SIZER
// ============================================================================

export class VolatilityBasedSizer {
  /**
   * Adjust position size based on market volatility
   * Higher volatility → smaller positions (reduce risk)
   * Lower volatility → larger positions (capture gains)
   */
  calculateVolatilityAdjustment(volatility: number, volatilityRegime?: VolatilityRegime): {
    adjustment: number;                 // Multiplier (0.5 - 1.3)
    regime: VolatilityRegime;
    description: string;
  } {
    // Volatility ranges (ATR%)
    let regime: VolatilityRegime = 'normal';
    let adjustment: number;

    if (volatility < 0.5) {
      adjustment = 1.3;
      regime = 'low';
    } else if (volatility < 1.0) {
      adjustment = 1.1;
      regime = 'low';
    } else if (volatility < 1.5) {
      adjustment = 1.0;
      regime = 'normal';
    } else if (volatility < 2.0) {
      adjustment = 0.85;
      regime = 'high';
    } else if (volatility < 2.5) {
      adjustment = 0.7;
      regime = 'high';
    } else {
      adjustment = 0.5;
      regime = 'extreme';
    }

    const regimeText = {
      'low': 'Very Low Vol - Size up 30%',
      'normal': 'Normal Vol - Base size',
      'high': 'High Vol - Size down 15-30%',
      'extreme': 'Extreme Vol - Size down 50%'
    };

    return {
      adjustment,
      regime,
      description: regimeText[regime]
    };
  }

  /**
   * Adjust based on market regime
   */
  calculateRegimeAdjustment(regime: string): {
    adjustment: number;
    description: string;
  } {
    const adjustments: Record<string, { adjustment: number; description: string }> = {
      'TRENDING_UP': { adjustment: 1.15, description: 'Strong uptrend - increase size' },
      'TRENDING_DOWN': { adjustment: 1.15, description: 'Strong downtrend - increase size' },
      'TRENDING': { adjustment: 1.15, description: 'Strong trend - increase size' },
      'RANGING': { adjustment: 0.9, description: 'Ranging market - reduce size' },
      'VOLATILE': { adjustment: 0.75, description: 'Volatile - reduce size' },
      'CONSOLIDATING': { adjustment: 0.85, description: 'Consolidating - reduce size' },
      'BREAKOUT_SETUP': { adjustment: 1.1, description: 'Breakout setup - increase size' }
    };

    return adjustments[regime] || { adjustment: 1.0, description: 'Unknown regime - base size' };
  }
}

// ============================================================================
// DAILY RISK BUDGET MANAGER (NEW)
// ============================================================================

export class DailyRiskBudgetManager {
  /**
   * Calculate daily risk budget from account equity
   */
  calculateDailyBudget(
    accountEquity: number,
    maxDailyRiskPercent: number = 0.05 // 5% default
  ): DailyRiskBudget {
    const maxDailyRiskAmount = accountEquity * maxDailyRiskPercent;

    return {
      date: new Date(),
      accountEquity,
      maxDailyRiskPercent,
      maxDailyRiskAmount,
      usedRiskAmount: 0,
      remainingRiskAmount: maxDailyRiskAmount,
      openPositionCount: 0,
      maxOpenPositions: 5,
      tradesExecutedToday: 0,
      isOpen: true
    };
  }

  /**
   * Update budget after trade execution
   */
  updateBudgetAfterTrade(
    budget: DailyRiskBudget,
    riskAmount: number
  ): DailyRiskBudget {
    const newUsedAmount = budget.usedRiskAmount + riskAmount;
    const newRemaining = budget.maxDailyRiskAmount - newUsedAmount;

    return {
      ...budget,
      usedRiskAmount: newUsedAmount,
      remainingRiskAmount: Math.max(0, newRemaining),
      tradesExecutedToday: budget.tradesExecutedToday + 1,
      isOpen: newRemaining > 0 && budget.openPositionCount < budget.maxOpenPositions
    };
  }

  /**
   * Get daily budget status for display
   */
  getBudgetStatus(budget: DailyRiskBudget): {
    status: 'safe' | 'caution' | 'exceeded';
    percentUsed: number;
    description: string;
  } {
    const percentUsed = (budget.usedRiskAmount / budget.maxDailyRiskAmount) * 100;

    let status: 'safe' | 'caution' | 'exceeded' = 'safe';
    if (percentUsed > 100) status = 'exceeded';
    else if (percentUsed > 80) status = 'caution';

    const descriptions = {
      'safe': `${percentUsed.toFixed(0)}% used - OK to trade`,
      'caution': `${percentUsed.toFixed(0)}% used - CAUTION, reduce position 30%`,
      'exceeded': `${percentUsed.toFixed(0)}% used - EXCEEDED, reduce position 50% or skip`
    };

    return {
      status,
      percentUsed,
      description: descriptions[status]
    };
  }

  /**
   * Calculate adjustment multiplier based on daily budget remaining
   */
  calculateBudgetAdjustment(budget: DailyRiskBudget): number {
    if (!budget.isOpen) return 0;

    const percentRemaining = (budget.remainingRiskAmount / budget.maxDailyRiskAmount) * 100;

    if (percentRemaining >= 50) return 1.0;      // Full position
    if (percentRemaining >= 20) return 0.7;      // 70% position
    if (percentRemaining >= 5) return 0.5;       // 50% position
    return 0;                                     // No more trades today
  }
}

export class SignalStrengthSizer {
  /**
   * Adjust position size based on signal quality/strength
   * Strong signals (0.9-1.0) → larger positions
   * Weak signals (0.3-0.5) → smaller positions
   * Rejected signals (<0.3) → skip trade
   */
  calculateSignalAdjustment(signalStrength: number): {
    adjustment: number;
    shouldTrade: boolean;
    description: string;
  } {
    if (signalStrength < 0.3) {
      return { adjustment: 0, shouldTrade: false, description: 'Signal too weak - REJECT' };
    } else if (signalStrength < 0.5) {
      return { adjustment: 0.5, shouldTrade: true, description: 'Weak signal - 50% size' };
    } else if (signalStrength < 0.65) {
      return { adjustment: 0.75, shouldTrade: true, description: 'Moderate signal - 75% size' };
    } else if (signalStrength < 0.8) {
      return { adjustment: 1.0, shouldTrade: true, description: 'Good signal - 100% size' };
    } else if (signalStrength < 0.9) {
      return { adjustment: 1.15, shouldTrade: true, description: 'Strong signal - 115% size' };
    } else {
      return { adjustment: 1.3, shouldTrade: true, description: 'Very strong signal - 130% size' };
    }
  }
}

// ============================================================================
// RISK-TO-REWARD & EQUITY PERCENTAGE SIZERS (NEW)
// ============================================================================

export class RiskToRewardSizer {
  /**
   * Size position to control risk per trade
   * position = targetRisk / distance_to_stop_loss
   */
  calculateRiskBasedSize(
    targetRiskAmount: number,
    entryPrice: number,
    stopLossPrice: number
  ): {
    quantity: number;
    positionSize: number;
    description: string;
  } {
    const riskDistance = Math.abs(entryPrice - stopLossPrice);
    
    if (riskDistance === 0) {
      return {
        quantity: 0,
        positionSize: 0,
        description: 'Stop loss equals entry price - invalid'
      };
    }

    const quantity = targetRiskAmount / riskDistance;
    const positionSize = quantity * entryPrice;

    return {
      quantity,
      positionSize,
      description: `Risk ${targetRiskAmount.toFixed(0)} = ${quantity.toFixed(2)} units @ ${entryPrice.toFixed(2)}`
    };
  }
}

export class EquityPercentageSizer {
  /**
   * Size position as percentage of account equity
   */
  calculateEquityPercentageSize(
    accountEquity: number,
    riskPercentPerTrade: number = 0.02 // 2% default
  ): {
    riskAmount: number;
    maxDailyRisk: number;
    maxPositions: number;
    description: string;
  } {
    const maxDailyRisk = accountEquity * 0.05; // 5% daily max
    const riskAmount = accountEquity * riskPercentPerTrade;
    const maxPositions = Math.floor(maxDailyRisk / riskAmount);

    return {
      riskAmount,
      maxDailyRisk,
      maxPositions: Math.min(maxPositions, 5), // Cap at 5 concurrent
      description: `${riskPercentPerTrade * 100}% of ${accountEquity.toFixed(0)} = ${riskAmount.toFixed(0)} risk per trade`
    };
  }
}

export class CorrelationBasedSizer {
  /**
   * Reduce position size if highly correlated with existing positions
   * Positive correlation (0.8+) → reduce size (diversification)
   * Negative correlation (< -0.3) → increase size (hedge)
   * No correlation (0 to 0.3) → base size
   */
  calculateCorrelationAdjustment(correlation: number): {
    adjustment: number;
    description: string;
    hedgeOrDiversify: 'hedge' | 'diversify' | 'neutral';
  } {
    if (correlation < -0.5) {
      return { adjustment: 1.25, description: 'Strong negative correlation - hedge boost (+25%)', hedgeOrDiversify: 'hedge' };
    } else if (correlation < -0.2) {
      return { adjustment: 1.1, description: 'Mild negative correlation - slight boost (+10%)', hedgeOrDiversify: 'hedge' };
    } else if (correlation < 0.3) {
      return { adjustment: 1.0, description: 'Low/no correlation - base size', hedgeOrDiversify: 'neutral' };
    } else if (correlation < 0.6) {
      return { adjustment: 0.85, description: 'Moderate correlation - slight reduction (-15%)', hedgeOrDiversify: 'diversify' };
    } else if (correlation < 0.8) {
      return { adjustment: 0.7, description: 'High correlation - reduce to diversify (-30%)', hedgeOrDiversify: 'diversify' };
    } else {
      return { adjustment: 0.5, description: 'Very high correlation - significant reduction (-50%)', hedgeOrDiversify: 'diversify' };
    }
  }

  /**
   * Calculate correlation with existing portfolio
   */
  estimatePortfolioCorrelation(
    newSignal: string,
    existingPositions: PortfolioPosition[]
  ): number {
    if (existingPositions.length === 0) return 0;

    // Simplified correlation estimation based on symbol similarity
    // In production, use actual historical correlation matrix
    const sameAsset = existingPositions.filter(p => p.symbol === newSignal).length > 0;
    
    if (sameAsset) return 0.95; // Same asset = very high correlation
    
    // Extract asset class (e.g., crypto, stock, forex)
    const getAssetClass = (symbol: string) => {
      if (symbol.includes('BTC') || symbol.includes('ETH')) return 'CRYPTO';
      if (symbol.includes('EURUSD') || symbol.includes('USDJPY')) return 'FOREX';
      return 'STOCK';
    };

    const newClass = getAssetClass(newSignal);
    const sameClass = existingPositions.filter(p => getAssetClass(p.symbol) === newClass);

    // Same asset class = moderate correlation
    if (sameClass.length > 0) {
      return 0.4 + (sameClass.length * 0.1); // Increase with number of same-class positions
    }

    return 0.15; // Different asset classes = low correlation
  }
}

// ============================================================================
// UNIFIED DECISION ENGINE (MAIN ORCHESTRATOR)
// ============================================================================

export class UnifiedPositionSizingEngine {
  private kellyCriterion = new KellyCriterionCalculator();
  private confidenceBasedSizer = new ConfidenceBasedSizer();
  private volatilitySizer = new VolatilityBasedSizer();
  private signalSizer = new SignalStrengthSizer();
  private correlationSizer = new CorrelationBasedSizer();
  private riskToRewardSizer = new RiskToRewardSizer();
  private equityPercentageSizer = new EquityPercentageSizer();
  private dailyRiskBudgetMgr = new DailyRiskBudgetManager();

  /**
   * MAIN METHOD: Unified Decision Engine
   * Orchestrates all 6 sizing methods with daily risk budget
   * 
   * Priority Order:
   * 1. Confidence-based (primary) + Signal source weighting
   * 2. Kelly Criterion (if historical data available)
   * 3. Volatility-adjusted (market conditions)
   * 4. Risk-to-reward (SL-based control)
   * 5. Equity percentage (account scaling)
   * 6. Daily budget constraint (hard stop)
   */
  calculatePositionSize(input: PositionSizingInput): PositionSizeOutput {
    const warnings: string[] = [];
    const rationale: string[] = [];
    const methodsApplied: SizingStrategy[] = [];

    // ========== VALIDATION & SETUP ==========
    if (input.accountRiskPercentage < 0.1 || input.accountRiskPercentage > 5) {
      warnings.push(`Risk percentage ${input.accountRiskPercentage}% unusual (typical 0.5-3%)`);
    }

    const positionRisk = Math.abs(input.entryPrice - input.stopLoss);
    if (positionRisk === 0) {
      warnings.push('Stop loss equals entry price - cannot size position');
      return this.createEmptyOutput(input);
    }

    // ========== METHOD 1: CONFIDENCE-BASED (PRIMARY) ==========
    const baseAccountRisk = input.accountEquity * (input.accountRiskPercentage / 100);
    const baseQuantity = baseAccountRisk / positionRisk;
    const baseSize = baseQuantity * input.entryPrice;

    const confidenceAdj = this.confidenceBasedSizer.calculateConfidenceSize(
      baseSize,
      input.signalStrength,
      input.signalSource || 'SCANNER'
    );

    const sourceWeight = this.confidenceBasedSizer.getSourceWeight(input.signalSource || 'SCANNER');
    methodsApplied.push('CONFIDENCE_BASED');
    rationale.push(`1. Confidence-Based: ${confidenceAdj.description}`);

    // ========== METHOD 2: KELLY CRITERION (IF AVAILABLE) ==========
    let kellyOptimalSize: number | undefined;
    let kellyFraction: number | undefined;
    let kellyConfidence: 'high' | 'medium' | 'low' = 'low';

    if (input.historicalMetrics && input.historicalMetrics[input.signalSource || 'SCANNER']) {
      const sourceMetrics = input.historicalMetrics[input.signalSource || 'SCANNER'];
      if (sourceMetrics.totalTrades >= 50) {
        const kellyCalc = this.kellyCriterion.calculateKellyFraction({
          winRate: sourceMetrics.winRate,
          avgWin: sourceMetrics.avgWin,
          avgLoss: sourceMetrics.avgLoss,
          riskRewardRatio: sourceMetrics.averageRiskRewardRatio,
          tradeCount: sourceMetrics.totalTrades
        });
        kellyFraction = kellyCalc.safeKellyFraction; // Use safe Kelly
        kellyOptimalSize = baseQuantity * kellyFraction * input.entryPrice;
        kellyConfidence = kellyCalc.confidenceLevel;
        methodsApplied.push('KELLY');
        rationale.push(`2. Kelly Criterion: ${kellyCalc.reasoning}`);
      }
    }

    // ========== METHOD 3: VOLATILITY-ADJUSTED ==========
    const volAdj = this.volatilitySizer.calculateVolatilityAdjustment(
      input.volatility,
      input.volatilityRegime
    );
    const regimeAdj = this.volatilitySizer.calculateRegimeAdjustment(input.regime);
    methodsApplied.push('VOLATILITY_BASED');
    rationale.push(`3. Volatility: ${volAdj.description} | Regime: ${regimeAdj.description}`);

    // ========== METHOD 4: RISK-TO-REWARD ==========
    const riskToRewardResult = this.riskToRewardSizer.calculateRiskBasedSize(
      baseAccountRisk,
      input.entryPrice,
      input.stopLoss
    );
    methodsApplied.push('RISK_TO_REWARD');
    rationale.push(`4. Risk-to-Reward: ${riskToRewardResult.description}`);

    // ========== METHOD 5: EQUITY PERCENTAGE ==========
    const equityPercentResult = this.equityPercentageSizer.calculateEquityPercentageSize(
      input.accountEquity,
      input.accountRiskPercentage / 100
    );
    methodsApplied.push('EQUITY_PERCENTAGE');
    rationale.push(`5. Equity %: ${equityPercentResult.description}`);

    // ========== SIGNAL STRENGTH CHECK ==========
    const signalAdj = this.signalSizer.calculateSignalAdjustment(input.signalStrength);
    if (!signalAdj.shouldTrade) {
      warnings.push(`Signal strength ${(input.signalStrength * 100).toFixed(0)}% below minimum - TRADE REJECTED`);
      return this.createEmptyOutput(input);
    }
    rationale.push(`Signal Quality: ${signalAdj.description}`);

    // ========== CORRELATION-BASED ADJUSTMENT ==========
    const correlation = this.correlationSizer.estimatePortfolioCorrelation(
      input.symbol,
      input.existingPositions
    );
    const corrAdj = this.correlationSizer.calculateCorrelationAdjustment(correlation);
    rationale.push(`Correlation: ${corrAdj.description}`);

    // ========== DAILY RISK BUDGET CONSTRAINT ==========
    let dailyBudgetAdj = 1.0;
    let dailyBudgetStatus: 'safe' | 'caution' | 'exceeded' = 'safe';
    let dailyRiskUsed = 0;
    let dailyRiskRemaining = 0;
    let dailyBudgetPercent = 0;

    if (input.dailyRiskBudget) {
      const budgetStatus = this.dailyRiskBudgetMgr.getBudgetStatus(input.dailyRiskBudget);
      dailyBudgetAdj = this.dailyRiskBudgetMgr.calculateBudgetAdjustment(input.dailyRiskBudget);
      dailyBudgetStatus = budgetStatus.status;
      dailyBudgetPercent = budgetStatus.percentUsed;
      dailyRiskUsed = input.dailyRiskBudget.usedRiskAmount;
      dailyRiskRemaining = input.dailyRiskBudget.remainingRiskAmount;

      if (dailyBudgetStatus !== 'safe') {
        warnings.push(budgetStatus.description);
      }
      rationale.push(`Daily Budget: ${budgetStatus.description}`);
    }

    // ========== COMBINE ALL METHODS ==========
    // Start with confidence-based as primary
    let finalQuantity = confidenceAdj.size / input.entryPrice;

    // Apply all multipliers
    const totalMultiplier = signalAdj.adjustment * 
                           volAdj.adjustment * 
                           regimeAdj.adjustment * 
                           corrAdj.adjustment * 
                           dailyBudgetAdj;

    finalQuantity = finalQuantity * totalMultiplier;

    // Cap based on daily budget if provided
    if (input.dailyRiskBudget && input.dailyRiskBudget.isOpen) {
      const maxQuantityByBudget = dailyRiskRemaining / positionRisk;
      finalQuantity = Math.min(finalQuantity, maxQuantityByBudget);
    }

    // ========== CALCULATE FINAL METRICS ==========
    const finalSize = finalQuantity * input.entryPrice;
    const finalRiskAmount = finalQuantity * positionRisk;
    const riskRewardRatio = (input.takeProfit - input.entryPrice) / positionRisk;
    const rewardTarget = finalRiskAmount * riskRewardRatio;

    // ========== CONFIDENCE SCORE ==========
    const confidenceScore = this.calculateConfidenceScore(
      input.signalStrength,
      input.historicalMetrics?.[input.signalSource || 'SCANNER'],
      kellyConfidence
    );

    // ========== RECOMMENDATION STRENGTH ==========
    let recommendationStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'REJECT' = 'MODERATE';
    if (input.signalStrength >= 0.85 && confidenceScore >= 0.8) recommendationStrength = 'STRONG';
    else if (input.signalStrength < 0.5 || confidenceScore < 0.5) recommendationStrength = 'WEAK';
    if (!signalAdj.shouldTrade) recommendationStrength = 'REJECT';

    // ========== BUILD OUTPUT ==========
    return {
      symbol: input.symbol,
      recommendedQuantity: Math.max(0, finalQuantity),
      recommendedSize: Math.max(0, finalSize),
      riskAmount: finalRiskAmount,
      rewardTarget: Math.max(0, rewardTarget),
      riskRewardRatio,
      
      methodBreakdown: {
        confidenceBasedSize: confidenceAdj.size,
        kellyOptimalSize,
        volatilityAdjustedSize: confidenceAdj.size * volAdj.adjustment,
        riskToRewardSize: riskToRewardResult.positionSize,
        equityPercentageSize: equityPercentResult.riskAmount,
        rlAdaptiveSize: undefined // Future hook
      },
      
      sizing: {
        baseSize,
        volatilityAdjustment: volAdj.adjustment,
        signalStrengthAdjustment: signalAdj.adjustment,
        sourceWeightAdjustment: sourceWeight,
        correlationAdjustment: corrAdj.adjustment,
        dailyBudgetAdjustment: dailyBudgetAdj,
        finalSize
      },
      
      sourceMetrics: {
        source: input.signalSource || 'SCANNER',
        sourceConfidence: input.signalConfidence || input.signalStrength,
        sourceWeight,
        historicalWinRate: input.historicalMetrics?.[input.signalSource || 'SCANNER']?.winRate,
        kellyFraction,
        dataQuality: kellyConfidence
      },
      
      dailyBudgetImpact: input.dailyRiskBudget ? {
        riskUsedByThisTrade: finalRiskAmount,
        totalRiskUsedToday: dailyRiskUsed + finalRiskAmount,
        remainingRiskToday: Math.max(0, dailyRiskRemaining - finalRiskAmount),
        dailyBudgetPercentUsed: dailyBudgetPercent,
        dailyBudgetStatus
      } : undefined,
      
      rationale,
      warnings,
      kellyFraction,
      maxDrawdownLimit: input.accountEquity * -0.10,
      
      dashboardMetrics: {
        methodsApplied: methodsApplied as SizingStrategy[],
        totalAdjustmentMultiplier: totalMultiplier,
        confidenceScore,
        riskLevel: input.riskLevel,
        recommendationStrength
      }
    };
  }

  /**
   * Calculate overall confidence score (0-1)
   */
  private calculateConfidenceScore(
    signalStrength: number,
    sourceMetrics: SignalSourceMetrics | undefined,
    kellyConfidence: 'high' | 'medium' | 'low'
  ): number {
    let score = signalStrength * 0.5; // Signal strength is 50% of score

    if (sourceMetrics) {
      // Win rate contributes 30%
      score += (sourceMetrics.winRate * 0.3);
      
      // Kelly confidence contributes 20%
      const kellyScore = kellyConfidence === 'high' ? 1.0 : kellyConfidence === 'medium' ? 0.6 : 0.3;
      score += (kellyScore * 0.2);
    } else {
      // No historical data - use signal strength only
      score = signalStrength;
    }

    return Math.min(score, 1.0);
  }

  private createEmptyOutput(input: PositionSizingInput): PositionSizeOutput {
    return {
      symbol: input.symbol,
      recommendedQuantity: 0,
      recommendedSize: 0,
      riskAmount: 0,
      rewardTarget: 0,
      riskRewardRatio: 0,
      
      methodBreakdown: {
        confidenceBasedSize: 0,
        volatilityAdjustedSize: 0,
        riskToRewardSize: 0,
        equityPercentageSize: 0
      },
      
      sizing: {
        baseSize: 0,
        volatilityAdjustment: 0,
        signalStrengthAdjustment: 0,
        sourceWeightAdjustment: 0,
        correlationAdjustment: 0,
        dailyBudgetAdjustment: 0,
        finalSize: 0
      },
      
      rationale: [],
      warnings: ['Position size calculation failed - no trade recommended'],
      dashboardMetrics: {
        methodsApplied: [],
        totalAdjustmentMultiplier: 0,
        confidenceScore: 0,
        riskLevel: 'CONSERVATIVE',
        recommendationStrength: 'REJECT'
      }
    };
  }

  /**
   * Get recommended risk percentage based on account size
   */
  getRecommendedRiskPercentage(accountEquity: number): number {
    if (accountEquity < 10000) return 2.0;      // Small accounts: 2%
    if (accountEquity < 50000) return 1.5;      // Medium accounts: 1.5%
    if (accountEquity < 250000) return 1.0;     // Large accounts: 1%
    return 0.75;                                // Very large accounts: 0.75%
  }

  /**
   * Create initial daily risk budget
   */
  initializeDailyBudget(accountEquity: number, maxDailyRiskPercent?: number): DailyRiskBudget {
    return this.dailyRiskBudgetMgr.calculateDailyBudget(
      accountEquity,
      maxDailyRiskPercent || 0.05
    );
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

export const adaptivePositionSizer = new UnifiedPositionSizingEngine();
