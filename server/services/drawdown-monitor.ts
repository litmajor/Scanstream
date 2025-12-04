/**
 * Drawdown Monitor Service
 * Tracks portfolio high water mark and prevents catastrophic losses
 * 
 * Rules:
 * 1. Track highest portfolio value ever (high water mark)
 * 2. Flag when drawdown > 10%
 * 3. Force position reduction > 15%
 * 4. Circuit break > 20%
 * 5. Auto-liquidate > 30%
 */

export interface DrawdownState {
  currentValue: number;
  highWaterMark: number;
  currentDrawdown: number;
  drawdownPercent: number;
  isWarning: boolean; // 10-15%
  isSevere: boolean; // 15-20%
  isCritical: boolean; // 20%+
  status: 'HEALTHY' | 'WARNING' | 'SEVERE' | 'CRITICAL';
}

export interface DrawdownAction {
  action: 'CONTINUE' | 'REDUCE_POSITIONS' | 'CIRCUIT_BREAK' | 'LIQUIDATE_ALL';
  reason: string;
  positionReductionPercent: number; // 0-1, how much to close
}

export class DrawdownMonitor {
  private highWaterMark: number = 0;
  private highWaterMarkTime: number = 0;

  constructor(initialBalance: number = 10000) {
    this.highWaterMark = initialBalance;
    this.highWaterMarkTime = Date.now();
  }

  /**
   * Update high water mark if new value is higher
   */
  updateHighWaterMark(currentValue: number): void {
    if (currentValue > this.highWaterMark) {
      this.highWaterMark = currentValue;
      this.highWaterMarkTime = Date.now();
    }
  }

  /**
   * Calculate current drawdown state
   */
  getDrawdownState(currentValue: number): DrawdownState {
    this.updateHighWaterMark(currentValue);

    const drawdown = this.highWaterMark - currentValue;
    const drawdownPercent = this.highWaterMark > 0 ? drawdown / this.highWaterMark : 0;

    const isWarning = drawdownPercent > 0.1 && drawdownPercent <= 0.15;
    const isSevere = drawdownPercent > 0.15 && drawdownPercent <= 0.20;
    const isCritical = drawdownPercent > 0.20;

    let status: 'HEALTHY' | 'WARNING' | 'SEVERE' | 'CRITICAL' = 'HEALTHY';
    if (isCritical) status = 'CRITICAL';
    else if (isSevere) status = 'SEVERE';
    else if (isWarning) status = 'WARNING';

    return {
      currentValue,
      highWaterMark: this.highWaterMark,
      currentDrawdown: drawdown,
      drawdownPercent,
      isWarning,
      isSevere,
      isCritical,
      status
    };
  }

  /**
   * Get recommended action based on drawdown
   */
  getAction(currentValue: number): DrawdownAction {
    const state = this.getDrawdownState(currentValue);
    const pct = state.drawdownPercent;

    if (pct > 0.30) {
      return {
        action: 'LIQUIDATE_ALL',
        reason: `CRITICAL: Portfolio down ${(pct * 100).toFixed(1)}% - LIQUIDATE ALL POSITIONS`,
        positionReductionPercent: 1.0 // Close 100%
      };
    }

    if (pct > 0.20) {
      return {
        action: 'CIRCUIT_BREAK',
        reason: `CRITICAL: Portfolio down ${(pct * 100).toFixed(1)}% - STOP ALL NEW TRADES`,
        positionReductionPercent: 0.5 // Close 50%
      };
    }

    if (pct > 0.15) {
      return {
        action: 'REDUCE_POSITIONS',
        reason: `SEVERE: Portfolio down ${(pct * 100).toFixed(1)}% - REDUCE POSITIONS`,
        positionReductionPercent: 0.33 // Close 33%
      };
    }

    if (pct > 0.10) {
      return {
        action: 'REDUCE_POSITIONS',
        reason: `WARNING: Portfolio down ${(pct * 100).toFixed(1)}% - REDUCE RISK`,
        positionReductionPercent: 0.25 // Close 25%
      };
    }

    return {
      action: 'CONTINUE',
      reason: 'Portfolio health: Normal',
      positionReductionPercent: 0
    };
  }

  /**
   * Get time recovery estimate
   */
  getRecoveryEstimate(currentValue: number, avgDailyReturn: number = 0.01): {
    daysToRecover: number;
    recoveryPercent: number;
  } {
    const state = this.getDrawdownState(currentValue);

    if (avgDailyReturn <= 0) {
      return { daysToRecover: Infinity, recoveryPercent: state.drawdownPercent };
    }

    // Calculate days needed to recover
    // Future value = current * (1 + rate)^days
    // highWaterMark = current * (1 + rate)^days
    // days = log(highWaterMark / current) / log(1 + rate)

    const ratio = this.highWaterMark / currentValue;
    const daysToRecover = Math.log(ratio) / Math.log(1 + avgDailyReturn);

    return {
      daysToRecover: Math.ceil(daysToRecover),
      recoveryPercent: state.drawdownPercent
    };
  }

  /**
   * Get drawdown statistics
   */
  getStats(): {
    highWaterMark: number;
    highWaterMarkTime: string;
    maxDrawdownFromStart: number;
    recoveryNeeded: number;
  } {
    return {
      highWaterMark: this.highWaterMark,
      highWaterMarkTime: new Date(this.highWaterMarkTime).toISOString(),
      maxDrawdownFromStart: this.highWaterMark,
      recoveryNeeded: 0
    };
  }
}
