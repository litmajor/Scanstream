/**
 * Risk Management - Ported from Python scanner.py
 * 
 * Calculates:
 * - Stop-loss and take-profit levels
 * - Position sizing based on account risk
 * - Opportunity scores for entry optimization
 */

export interface StopLossTakeProfitResult {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  rewardAmount: number;
  riskRewardRatio: number;
  stopLossPct: number;
  takeProfitPct: number;
  supportLevel: number | null;
  resistanceLevel: number | null;
}

export interface PositionSizeResult {
  positionValue: number;
  units: number;
  marginRequired: number;
  riskAmountUsd: number;
  adjustedRiskUsd: number;
  totalFees: number;
  stopDistancePct: number;
  stopDistanceUsd: number;
  leverage: number;
  liquidationPrice: number | null;
  accountBalance: number;
  riskPerTradePct: number;
  marginUsagePct: number;
  warnings: string[];
  safeToTrade: boolean;
}

export interface MarketData {
  high: number[];
  low: number[];
  close: number[];
  volume?: number[];
}

export class RiskManagement {
  /**
   * Calculate optimal stop-loss and take-profit levels
   * Uses multiple methods (ATR, support/resistance, percentage-based)
   */
  static calculateStopLossTakeProfit(
    currentPrice: number,
    marketData: MarketData,
    signal: string,
    atr?: number,
    bbLower?: number,
    bbUpper?: number,
    supportLevel?: number,
    resistanceLevel?: number,
    riskRewardRatio: number = 2.5
  ): StopLossTakeProfitResult {
    // Calculate ATR if not provided
    if (atr === undefined) {
      atr = this.calculateATR(marketData.high, marketData.low, marketData.close);
    }

    // Calculate recent swing high/low (last 20 periods)
    const recentHigh = Math.max(...marketData.high.slice(-20));
    const recentLow = Math.min(...marketData.low.slice(-20));

    // Determine support and resistance if not provided
    if (supportLevel === undefined) {
      supportLevel = bbLower !== undefined ? bbLower : recentLow;
    }
    if (resistanceLevel === undefined) {
      resistanceLevel = bbUpper !== undefined ? bbUpper : recentHigh;
    }

    let stopLoss: number;
    let takeProfit: number;
    let riskAmount: number;
    let actualRr: number;

    if (['Strong Buy', 'Buy', 'Weak Buy'].includes(signal)) {
      // LONG POSITION
      const atrStop = currentPrice - atr * 1.5;
      const supportStop = supportLevel * 0.995; // 0.5% below support
      const percentageStop = currentPrice * 0.97; // 3% stop

      // Filter valid stops (between 0.5% and 8%)
      const stopCandidates = [atrStop, supportStop, percentageStop];
      const validStops = stopCandidates.filter(s => {
        const dist = (currentPrice - s) / currentPrice;
        return dist > 0.005 && dist < 0.08;
      });
      stopLoss = validStops.length > 0 ? Math.max(...validStops) : atrStop;

      // Take Profit
      riskAmount = currentPrice - stopLoss;
      const rewardByRr = currentPrice + riskAmount * riskRewardRatio;
      const resistanceTp = resistanceLevel * 0.995;

      if (resistanceTp > currentPrice && resistanceTp < rewardByRr) {
        takeProfit = resistanceTp;
        actualRr = (takeProfit - currentPrice) / riskAmount;
      } else {
        takeProfit = rewardByRr;
        actualRr = riskRewardRatio;
      }
    } else if (['Strong Sell', 'Sell', 'Weak Sell'].includes(signal)) {
      // SHORT POSITION
      const atrStop = currentPrice + atr * 1.5;
      const resistanceStop = resistanceLevel * 1.005; // 0.5% above resistance
      const percentageStop = currentPrice * 1.03; // 3% stop

      const stopCandidates = [atrStop, resistanceStop, percentageStop];
      const validStops = stopCandidates.filter(s => {
        const dist = (s - currentPrice) / currentPrice;
        return dist > 0.005 && dist < 0.08;
      });
      stopLoss = validStops.length > 0 ? Math.min(...validStops) : atrStop;

      // Take Profit
      riskAmount = stopLoss - currentPrice;
      const rewardByRr = currentPrice - riskAmount * riskRewardRatio;
      const supportTp = supportLevel * 1.005;

      if (supportTp < currentPrice && supportTp > rewardByRr) {
        takeProfit = supportTp;
        actualRr = (currentPrice - takeProfit) / riskAmount;
      } else {
        takeProfit = rewardByRr;
        actualRr = riskRewardRatio;
      }
    } else {
      // NEUTRAL
      stopLoss = currentPrice * 0.97;
      takeProfit = currentPrice * 1.03;
      riskAmount = currentPrice - stopLoss;
      actualRr = (takeProfit - currentPrice) / riskAmount;
    }

    return {
      entryPrice: Math.round(currentPrice * 1e8) / 1e8,
      stopLoss: Math.round(stopLoss * 1e8) / 1e8,
      takeProfit: Math.round(takeProfit * 1e8) / 1e8,
      riskAmount: Math.round(Math.abs(currentPrice - stopLoss) * 1e8) / 1e8,
      rewardAmount: Math.round(Math.abs(takeProfit - currentPrice) * 1e8) / 1e8,
      riskRewardRatio: Math.round(actualRr * 100) / 100,
      stopLossPct: Math.round(((stopLoss - currentPrice) / currentPrice) * 10000) / 100,
      takeProfitPct: Math.round(((takeProfit - currentPrice) / currentPrice) * 10000) / 100,
      supportLevel: supportLevel ? Math.round(supportLevel * 1e8) / 1e8 : null,
      resistanceLevel: resistanceLevel ? Math.round(resistanceLevel * 1e8) / 1e8 : null
    };
  }

  /**
   * Calculate optimal position size based on account risk
   */
  static calculatePositionSize(
    accountBalance: number,
    riskPerTradePct: number,
    entryPrice: number,
    stopLoss: number,
    leverage: number = 1.0,
    feeRate: number = 0.001
  ): PositionSizeResult {
    // Calculate risk amount
    const riskAmountUsd = accountBalance * (riskPerTradePct / 100);

    // Calculate stop distance
    const stopDistancePct = Math.abs((entryPrice - stopLoss) / entryPrice);

    // Calculate base position size
    const basePositionSize = riskAmountUsd / stopDistancePct;

    // Apply leverage
    const positionValue = basePositionSize * leverage;

    // Calculate units
    const units = positionValue / entryPrice;

    // Calculate fees
    const entryFee = positionValue * feeRate;
    const exitFee = positionValue * feeRate;
    const totalFees = entryFee + exitFee;

    // Adjust for fees
    const adjustedRisk = riskAmountUsd - totalFees;
    const marginRequired = positionValue / leverage;

    // Calculate liquidation price
    let liquidationPrice: number | null = null;
    if (leverage > 1) {
      const liquidationBuffer = marginRequired * 0.9;
      if (stopLoss < entryPrice) {
        liquidationPrice = entryPrice - liquidationBuffer / units;
      } else {
        liquidationPrice = entryPrice + liquidationBuffer / units;
      }
    }

    // Stop distance in USD
    const stopDistanceUsd = Math.abs(entryPrice - stopLoss) * units;

    // Generate warnings
    const warnings: string[] = [];
    if (marginRequired > accountBalance) {
      warnings.push('Insufficient balance for this position');
    }
    if (marginRequired > accountBalance * 0.5) {
      warnings.push('Position uses >50% of account (high risk)');
    }
    if (leverage > 3) {
      warnings.push(`High leverage (${leverage}x) - increased liquidation risk`);
    }
    if (riskPerTradePct > 3) {
      warnings.push(`Risking ${riskPerTradePct}% per trade (recommended: 1-2%)`);
    }
    if (
      liquidationPrice !== null &&
      ((stopLoss < entryPrice && liquidationPrice > stopLoss) ||
        (stopLoss > entryPrice && liquidationPrice < stopLoss))
    ) {
      warnings.push('Liquidation price is beyond stop-loss - very risky!');
    }

    const safeToTrade =
      warnings.filter(w => w.includes('Insufficient') || w.includes('Liquidation'))
        .length === 0;

    return {
      positionValue: Math.round(positionValue * 100) / 100,
      units: Math.round(units * 1e8) / 1e8,
      marginRequired: Math.round(marginRequired * 100) / 100,
      riskAmountUsd: Math.round(riskAmountUsd * 100) / 100,
      adjustedRiskUsd: Math.round(adjustedRisk * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      stopDistancePct: Math.round(stopDistancePct * 10000) / 100,
      stopDistanceUsd: Math.round(stopDistanceUsd * 100) / 100,
      leverage,
      liquidationPrice:
        liquidationPrice !== null ? Math.round(liquidationPrice * 1e8) / 1e8 : null,
      accountBalance,
      riskPerTradePct,
      marginUsagePct: Math.round((marginRequired / accountBalance) * 10000) / 100,
      warnings,
      safeToTrade
    };
  }

  /**
   * Simple ATR calculation
   */
  private static calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number {
    if (highs.length < period) {
      // Fallback: simple high-low average
      let sum = 0;
      for (let i = 0; i < Math.min(period, highs.length); i++) {
        sum += highs[i] - lows[i];
      }
      return sum / Math.min(period, highs.length);
    }

    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }

    // Calculate ATR (average of last `period` TR values)
    const recentTrs = trs.slice(-period);
    return recentTrs.reduce((a, b) => a + b, 0) / recentTrs.length;
  }

  /**
   * Calculate Bollinger Band position (0-1, where 0 = lower band, 1 = upper band)
   */
  static calculateBBPosition(
    price: number,
    bbUpper: number,
    bbLower: number
  ): number {
    if (bbUpper === bbLower) return 0.5;
    return (price - bbLower) / (bbUpper - bbLower);
  }

  /**
   * Calculate volume ratio (current / average)
   */
  static calculateVolumeRatio(volumes: number[], window: number = 20): number {
    if (volumes.length < window) {
      return 1.0;
    }
    const recent = volumes.slice(-window);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;

    const previous = volumes.slice(-window * 2, -window);
    const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

    return prevAvg > 0 ? recentAvg / prevAvg : 1.0;
  }

  /**
   * Calculate trend score based on EMA alignment
   */
  static calculateTrendScore(
    closes: number[],
    ema21?: number,
    ema50?: number,
    ema200?: number,
    adx: number = 25
  ): number {
    if (closes.length < 21) return 0;

    // If EMAs not provided, calculate them
    if (ema21 === undefined) {
      ema21 = this.calculateEMA(closes, 21);
    }
    if (ema50 === undefined) {
      ema50 = this.calculateEMA(closes, 50);
    }
    if (ema200 === undefined) {
      ema200 = this.calculateEMA(closes, 200);
    }

    const currentPrice = closes[closes.length - 1];
    const lookback = 21;

    // EMA slope
    const emaPrev = this.calculateEMA(closes.slice(0, -1), 21);
    const emaSlope = (ema21 - emaPrev) / Math.abs(emaPrev);
    const emaScore = ((Math.max(Math.min(emaSlope * 100 / 2, 1), -1) + 1) / 2) * (ema21 > ema50 ? 1 : 0.5);

    // ADX score
    const adxScore = Math.min(adx / 50, 1);

    // Price position relative to lookback
    const prevPrices = closes.slice(-lookback - 1, -1);
    const maxPrev = Math.max(...prevPrices);
    const minPrev = Math.min(...prevPrices);
    const priceScore = currentPrice > maxPrev ? 1.0 : currentPrice < minPrev ? 0.0 : 0.5;

    // Weighted combination
    const trendScore = emaScore * 0.4 + adxScore * 0.4 + priceScore * 0.2;
    return Math.round(trendScore * 10 * 100) / 100;
  }

  /**
   * Calculate simple EMA
   */
  private static calculateEMA(values: number[], period: number): number {
    if (values.length < period) {
      return values[values.length - 1];
    }

    const alpha = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    return ema;
  }
}

export default RiskManagement;
