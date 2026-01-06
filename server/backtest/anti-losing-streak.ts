/**
 * Anti-Losing Streak Logic
 * 
 * Breaks the 12-bar losing streak by:
 * 1. Detecting consecutive losses
 * 2. Tightening stops during streak
 * 3. Reducing position size during streak
 * 4. Increasing signal quality threshold during streak
 * 5. Taking profits faster (reduced targets)
 */

export interface StreakState {
  currentLossCount: number;
  isInLossingStreak: boolean;
  streakStartBar: number;
  activationBar: number;
  lastLossBar: number;
}

export class AntiLosingStreakManager {
  private streakState: StreakState = {
    currentLossCount: 0,
    isInLossingStreak: false,
    streakStartBar: 0,
    activationBar: 0,
    lastLossBar: 0,
  };

  private readonly LOSS_STREAK_THRESHOLD = 3;  // Activate after 3 losses
  private readonly STREAK_RECOVERY_BARS = 5;   // Reset after 5 winning bars

  /**
   * Update streak state based on trade result
   */
  updateStreak(won: boolean, bar: number) {
    if (!won) {
      this.streakState.currentLossCount++;
      this.streakState.lastLossBar = bar;

      if (this.streakState.currentLossCount === this.LOSS_STREAK_THRESHOLD) {
        this.streakState.isInLossingStreak = true;
        this.streakState.streakStartBar = bar;
        this.streakState.activationBar = bar;
        console.log(`⚠️  [STREAK BREAKER] Losing streak detected at bar ${bar} (${this.streakState.currentLossCount} losses)`);
      }
    } else {
      // Reset on win
      if (this.streakState.currentLossCount > 0) {
        this.streakState.currentLossCount--;
      } else if (this.streakState.isInLossingStreak) {
        // Exiting streak after wins
        this.streakState.isInLossingStreak = false;
        console.log(`✅ [STREAK BREAKER] Streak broken at bar ${bar}!`);
      }
    }
  }

  /**
   * Get adjusted parameters during losing streak
   */
  getAdjustedParams(originalParams: {
    convexStopLossPercent: number;
    positionSizeMultiplier: number;
    targetMultiplier: number;
    forConfidenceThreshold: number;
  }): {
    convexStopLossPercent: number;
    positionSizeMultiplier: number;
    targetMultiplier: number;
    forConfidenceThreshold: number;
  } {
    if (!this.streakState.isInLossingStreak) {
      return originalParams;
    }

    // During streak: tighter stops, smaller sizes, faster targets, higher confidence
    return {
      convexStopLossPercent: originalParams.convexStopLossPercent * 0.7,     // 30% tighter
      positionSizeMultiplier: originalParams.positionSizeMultiplier * 0.5,   // 50% smaller
      targetMultiplier: originalParams.targetMultiplier * 0.6,                // 40% closer targets
      forConfidenceThreshold: originalParams.forConfidenceThreshold + 0.1,   // 10% higher quality
    };
  }

  /**
   * Get streak status
   */
  getStatus(): {
    isActive: boolean;
    currentLossCount: number;
    barsInStreak: number;
  } {
    return {
      isActive: this.streakState.isInLossingStreak,
      currentLossCount: this.streakState.currentLossCount,
      barsInStreak: this.streakState.isInLossingStreak ? 
        Math.max(0, this.streakState.lastLossBar - this.streakState.activationBar) : 0,
    };
  }

  /**
   * Reset streak manager
   */
  reset() {
    this.streakState = {
      currentLossCount: 0,
      isInLossingStreak: false,
      streakStartBar: 0,
      activationBar: 0,
      lastLossBar: 0,
    };
  }
}

/**
 * Adaptive position sizing based on scout PnL
 */
export class AdaptivePositionSizer {
  private scoutPnLHistory: number[] = [];
  private readonly historySize = 10;  // Track last 10 scouts

  /**
   * Add scout PnL to history
   */
  recordScoutPnL(pnlPct: number) {
    this.scoutPnLHistory.push(pnlPct);
    if (this.scoutPnLHistory.length > this.historySize) {
      this.scoutPnLHistory.shift();
    }
  }

  /**
   * Get position size multiplier based on recent scout performance
   */
  getPositionSizeMultiplier(): number {
    if (this.scoutPnLHistory.length === 0) return 1.0;

    const recentAvg = this.scoutPnLHistory.reduce((a, b) => a + b) / this.scoutPnLHistory.length;
    const recentWinRate = (this.scoutPnLHistory.filter(x => x > 0).length / this.scoutPnLHistory.length) * 100;

    // Scale from 0.5x to 1.5x based on performance
    if (recentWinRate >= 60) return 1.5;      // Very hot
    if (recentWinRate >= 50) return 1.2;      // Good
    if (recentWinRate >= 40) return 1.0;      // Normal
    if (recentWinRate >= 30) return 0.8;      // Cold
    return 0.5;                                // Very cold
  }

  /**
   * Get win rate from scout history
   */
  getRecentWinRate(): number {
    if (this.scoutPnLHistory.length === 0) return 0;
    return (this.scoutPnLHistory.filter(x => x > 0).length / this.scoutPnLHistory.length) * 100;
  }

  /**
   * Reset history
   */
  reset() {
    this.scoutPnLHistory = [];
  }
}
