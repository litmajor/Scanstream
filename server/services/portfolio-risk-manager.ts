
/**
 * Portfolio Risk Manager
 * 
 * Manages portfolio-wide risk limits, drawdown tracking, position sizing consensus,
 * correlation analysis, and portfolio max loss protection.
 * 
 * Features:
 * - Portfolio-level position sizing limits
 * - Correlation-based exposure caps
 * - Real-time drawdown tracking
 * - Dynamic risk adjustment based on portfolio health
 */

import { assetCorrelationAnalyzer } from './asset-correlation-analyzer';
import { dynamicPositionSizer } from './dynamic-position-sizer';

interface PortfolioPosition {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number; // USD value
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface RiskLimits {
  maxPortfolioDrawdown: number; // % (e.g., 20%)
  maxSinglePositionSize: number; // % of portfolio (e.g., 5%)
  maxCorrelatedExposure: number; // % for correlated assets (e.g., 15%)
  maxTotalExposure: number; // % of portfolio (e.g., 80%)
  maxDailyLoss: number; // % (e.g., 5%)
}

interface PortfolioRiskMetrics {
  totalValue: number;
  totalExposure: number;
  exposurePercent: number;
  currentDrawdown: number;
  peakValue: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  correlatedExposures: Map<string, number>; // Category -> USD exposure
  riskScore: number; // 0-100 (higher = riskier)
  canOpenNewPosition: boolean;
  recommendedMaxPositionSize: number;
}

interface PositionSizingConsensus {
  symbol: string;
  signalConfidence: number;
  kellySize: number; // From Kelly Criterion
  rlSize: number; // From RL Agent
  portfolioSize: number; // From portfolio risk limits
  correlationSize: number; // From correlation analysis
  finalSize: number; // Consensus (minimum of all)
  reasoning: string[];
  approved: boolean;
}

export class PortfolioRiskManager {
  private positions: Map<string, PortfolioPosition> = new Map();
  private peakValue: number = 0;
  private dailyStartValue: number = 0;
  private lastResetTime: Date = new Date();
  
  private limits: RiskLimits = {
    maxPortfolioDrawdown: 20, // 20% max drawdown
    maxSinglePositionSize: 5, // 5% max per position
    maxCorrelatedExposure: 15, // 15% max for correlated assets
    maxTotalExposure: 80, // 80% max total exposure
    maxDailyLoss: 5 // 5% max daily loss
  };

  constructor(initialValue: number = 10000) {
    this.peakValue = initialValue;
    this.dailyStartValue = initialValue;
  }

  /**
   * Get position sizing consensus from multiple sources
   */
  async getPositionSizingConsensus(
    symbol: string,
    signalConfidence: number,
    signalType: 'BUY' | 'SELL',
    accountBalance: number,
    currentPrice: number,
    atr: number,
    marketRegime: string,
    primaryPattern: string
  ): Promise<PositionSizingConsensus> {
    const reasoning: string[] = [];

    // 1. Kelly Criterion size (from Dynamic Position Sizer)
    const kellySizing = dynamicPositionSizer.calculatePositionSize({
      symbol,
      confidence: signalConfidence,
      signalType,
      accountBalance,
      currentPrice,
      atr,
      marketRegime,
      primaryPattern,
      trendDirection: 'SIDEWAYS',
      sma20: currentPrice,
      sma50: currentPrice
    });
    const kellySize = kellySizing.positionSize;
    reasoning.push(`Kelly: $${kellySize.toFixed(2)} (${kellySizing.positionPercent.toFixed(2)}%)`);

    // 2. RL Agent size (same source, but separate multiplier tracking)
    const rlSize = kellySize * kellySizing.rlMultiplier;
    reasoning.push(`RL: $${rlSize.toFixed(2)} (${kellySizing.rlMultiplier.toFixed(2)}x multiplier)`);

    // 3. Portfolio risk limits
    const portfolioMetrics = this.getPortfolioMetrics(accountBalance);
    const maxAllowedSize = accountBalance * (this.limits.maxSinglePositionSize / 100);
    const portfolioSize = Math.min(kellySize, maxAllowedSize);
    reasoning.push(`Portfolio Limit: $${portfolioSize.toFixed(2)} (max ${this.limits.maxSinglePositionSize}% per position)`);

    // 4. Correlation-based sizing
    const correlatedExposure = this.getCorrelatedExposure(symbol);
    const maxCorrelatedSize = accountBalance * (this.limits.maxCorrelatedExposure / 100);
    const remainingCorrelatedCapacity = Math.max(0, maxCorrelatedSize - correlatedExposure);
    const correlationSize = Math.min(portfolioSize, remainingCorrelatedCapacity);
    reasoning.push(`Correlation Limit: $${correlationSize.toFixed(2)} (${correlatedExposure.toFixed(2)} already exposed)`);

    // 5. Drawdown-based adjustment
    let drawdownMultiplier = 1.0;
    if (portfolioMetrics.currentDrawdown > 10) {
      drawdownMultiplier = 0.5; // Reduce by 50% in drawdown
      reasoning.push(`Drawdown Reduction: 50% (current DD: ${portfolioMetrics.currentDrawdown.toFixed(1)}%)`);
    }

    // 6. Daily loss limit check
    if (portfolioMetrics.dailyPnlPercent < -this.limits.maxDailyLoss) {
      reasoning.push(`⛔ Daily loss limit reached (${portfolioMetrics.dailyPnlPercent.toFixed(2)}%)`);
      return {
        symbol,
        signalConfidence,
        kellySize,
        rlSize,
        portfolioSize,
        correlationSize,
        finalSize: 0,
        reasoning,
        approved: false
      };
    }

    // Final consensus: minimum of all constraints
    const finalSize = Math.min(
      kellySize,
      rlSize,
      portfolioSize,
      correlationSize
    ) * drawdownMultiplier;

    const approved = finalSize > 0 && portfolioMetrics.canOpenNewPosition;

    return {
      symbol,
      signalConfidence,
      kellySize,
      rlSize,
      portfolioSize,
      correlationSize,
      finalSize,
      reasoning,
      approved
    };
  }

  /**
   * Get correlated exposure for an asset
   */
  private getCorrelatedExposure(symbol: string): number {
    let totalExposure = 0;

    // Get correlation report
    const report = assetCorrelationAnalyzer.getCorrelationReport(symbol);
    
    for (const correlated of report.correlatedAssets) {
      const position = this.positions.get(correlated.symbol);
      if (position) {
        totalExposure += position.size;
      }
    }

    return totalExposure;
  }

  /**
   * Add or update a position
   */
  addPosition(position: PortfolioPosition): void {
    this.positions.set(position.symbol, position);
  }

  /**
   * Remove a position
   */
  removePosition(symbol: string): void {
    this.positions.delete(symbol);
  }

  /**
   * Update position prices and recalculate metrics
   */
  updatePositionPrice(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (!position) return;

    position.currentPrice = currentPrice;
    position.pnl = position.side === 'BUY'
      ? (currentPrice - position.entryPrice) * (position.size / position.entryPrice)
      : (position.entryPrice - currentPrice) * (position.size / position.entryPrice);
    position.pnlPercent = (position.pnl / position.size) * 100;
  }

  /**
   * Get comprehensive portfolio risk metrics
   */
  getPortfolioMetrics(currentBalance: number): PortfolioRiskMetrics {
    // Reset daily tracking if new day
    const now = new Date();
    if (now.getDate() !== this.lastResetTime.getDate()) {
      this.dailyStartValue = currentBalance;
      this.lastResetTime = now;
    }

    // Update peak
    if (currentBalance > this.peakValue) {
      this.peakValue = currentBalance;
    }

    // Calculate total exposure
    let totalExposure = 0;
    for (const position of this.positions.values()) {
      totalExposure += position.size;
    }

    // Calculate drawdown
    const currentDrawdown = ((this.peakValue - currentBalance) / this.peakValue) * 100;

    // Calculate daily P&L
    const dailyPnl = currentBalance - this.dailyStartValue;
    const dailyPnlPercent = (dailyPnl / this.dailyStartValue) * 100;

    // Calculate correlated exposures by category
    const correlatedExposures = new Map<string, number>();
    // Simplified: group by first letter for demo
    for (const [symbol, position] of this.positions.entries()) {
      const category = symbol.charAt(0);
      correlatedExposures.set(
        category,
        (correlatedExposures.get(category) || 0) + position.size
      );
    }

    // Risk score (0-100, higher = riskier)
    let riskScore = 0;
    riskScore += Math.min(50, (currentDrawdown / this.limits.maxPortfolioDrawdown) * 50);
    riskScore += Math.min(30, (totalExposure / currentBalance) / (this.limits.maxTotalExposure / 100) * 30);
    riskScore += Math.min(20, Math.abs(dailyPnlPercent) / this.limits.maxDailyLoss * 20);

    // Can open new position?
    const canOpenNewPosition =
      currentDrawdown < this.limits.maxPortfolioDrawdown &&
      (totalExposure / currentBalance) < (this.limits.maxTotalExposure / 100) &&
      dailyPnlPercent > -this.limits.maxDailyLoss;

    // Recommended max position size
    const recommendedMaxPositionSize = currentBalance * (this.limits.maxSinglePositionSize / 100);

    return {
      totalValue: currentBalance,
      totalExposure,
      exposurePercent: (totalExposure / currentBalance) * 100,
      currentDrawdown,
      peakValue: this.peakValue,
      dailyPnl,
      dailyPnlPercent,
      correlatedExposures,
      riskScore,
      canOpenNewPosition,
      recommendedMaxPositionSize
    };
  }

  /**
   * Update risk limits
   */
  updateLimits(updates: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...updates };
  }

  /**
   * Get current risk limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Reset daily tracking
   */
  resetDailyTracking(currentBalance: number): void {
    this.dailyStartValue = currentBalance;
    this.lastResetTime = new Date();
  }
}

// Singleton instance
export const portfolioRiskManager = new PortfolioRiskManager(10000);
