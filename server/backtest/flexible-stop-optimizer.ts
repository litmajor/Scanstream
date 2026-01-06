/**
 * FLEXIBLE STOP LOSS OPTIMIZATION FRAMEWORK
 * Test different stop strategies while maintaining asymmetry
 * 
 * Theory: If we use dynamic stops (wider), we need wider targets to maintain asymmetry
 * This allows positions to hold longer and catch bigger moves
 * 
 * Strategies to test:
 * 1. Fixed stop (baseline: 1.5%)
 * 2. Time-based adaptive stop (tightens over time)
 * 3. ATR-based dynamic stop (market volatility driven)
 * 4. Recent support/resistance stop (technical level based)
 * 5. Volatility expansion stop (adapts to regime changes)
 */

import Decimal from 'decimal.js';

export interface StopLossStrategy {
  name: string;
  calculateStop: (params: StopCalculationParams) => number;
  calculateTarget: (params: TargetCalculationParams) => number;
  description: string;
}

export interface StopCalculationParams {
  entryPrice: number;
  currentPrice: number;
  barsHeld: number;
  maxBars: number;
  atr14: number;
  recentHigh: number;
  recentLow: number;
  volatilityRegime: 'low' | 'medium' | 'high';
  scoutProfit: number; // % profit of initial scout
  direction: 'BUY' | 'SELL';
}

export interface TargetCalculationParams {
  entryPrice: number;
  stopPrice: number;
  direction: 'BUY' | 'SELL';
  riskAmount: number; // How much we're willing to lose
  asymmetryRatio: number; // Win/Loss ratio to maintain (e.g., 1.91x)
}

/**
 * STRATEGY 1: Fixed Stop (Baseline)
 * Classic approach: Always stop at -1.5%
 * Target: 2.2x risk to maintain 1.91x asymmetry
 */
export const FixedStopStrategy: StopLossStrategy = {
  name: 'Fixed Stop Loss',
  description: 'Classic -1.5% stop, 2.2x target multiplier. Baseline for comparison.',
  calculateStop: (params: StopCalculationParams) => {
    if (params.direction === 'BUY') {
      return params.entryPrice * 0.985; // -1.5%
    } else {
      return params.entryPrice * 1.015; // +1.5% for shorts
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * STRATEGY 2: Time-Based Adaptive Stop
 * Early bars: Wide stop (more room for volatility)
 * Later bars: Tight stop (protect profit, exit if not working)
 * Theory: Gives early moves room to develop, tightens after 20 bars
 */
export const TimeBasedAdaptiveStop: StopLossStrategy = {
  name: 'Time-Based Adaptive Stop',
  description: 'Tightens stop over time: 2.5% (bars 1-10) → 2.0% (bars 11-20) → 1.5% (bars 21+)',
  calculateStop: (params: StopCalculationParams) => {
    let stopPercentage = 0.015; // Default 1.5%

    if (params.barsHeld <= 10) {
      stopPercentage = 0.025; // Wide: 2.5% for early bars
    } else if (params.barsHeld <= 20) {
      stopPercentage = 0.020; // Medium: 2.0% for middle bars
    }
    // bars 21+: stay at 1.5%

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 - stopPercentage);
    } else {
      return params.entryPrice * (1 + stopPercentage);
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * STRATEGY 3: ATR-Based Dynamic Stop
 * Stop is based on market volatility (ATR14)
 * High volatility = wider stop (1x ATR)
 * Low volatility = tight stop (0.5x ATR)
 * Theory: Adapts to market conditions, gives room in volatile markets
 */
export const ATRBasedStop: StopLossStrategy = {
  name: 'ATR-Based Dynamic Stop',
  description: 'Stop adjusted by ATR14: Low vol = 0.5x ATR, High vol = 1.5x ATR',
  calculateStop: (params: StopCalculationParams) => {
    let atrMultiplier = 1.0; // Medium volatility = 1x ATR

    if (params.volatilityRegime === 'low') {
      atrMultiplier = 0.5; // Tight stop in calm markets
    } else if (params.volatilityRegime === 'high') {
      atrMultiplier = 1.5; // Wide stop in volatile markets
    }

    const stopDistance = params.atr14 * atrMultiplier;

    if (params.direction === 'BUY') {
      return params.entryPrice - stopDistance;
    } else {
      return params.entryPrice + stopDistance;
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * STRATEGY 4: Recent Support/Resistance Stop
 * Place stop just below recent support (for buys) or above resistance (for sells)
 * Theory: Uses technical levels instead of fixed percentages
 * More natural stopping points
 */
export const SupportResistanceStop: StopLossStrategy = {
  name: 'Support/Resistance Stop',
  description:
    'Places stop at recent support/resistance levels with 0.5% buffer',
  calculateStop: (params: StopCalculationParams) => {
    const buffer = params.entryPrice * 0.005; // 0.5% buffer

    if (params.direction === 'BUY') {
      // For buys, use recent low as stop
      const srStop = params.recentLow - buffer;
      const fixedStop = params.entryPrice * 0.985;
      // Use whichever is less aggressive
      return Math.max(srStop, fixedStop);
    } else {
      // For sells, use recent high as stop
      const srStop = params.recentHigh + buffer;
      const fixedStop = params.entryPrice * 1.015;
      return Math.min(srStop, fixedStop);
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * STRATEGY 5: Volatility Expansion Stop
 * Wider stops when volatility is expanding (catching bigger moves)
 * Tighter stops when volatility is contracting (fewer big moves possible)
 * Theory: Adjusts to regime changes in real time
 */
export const VolatilityExpansionStop: StopLossStrategy = {
  name: 'Volatility Expansion Stop',
  description:
    'Adapts to volatility regime: Expanding = wider, Contracting = tighter',
  calculateStop: (params: StopCalculationParams) => {
    // Estimate volatility trend from recent bars
    const volatilityMultiplier =
      params.volatilityRegime === 'high'
        ? 1.8 // Very wide in high volatility
        : params.volatilityRegime === 'medium'
          ? 1.3 // Medium in normal volatility
          : 1.0; // Tight in low volatility

    const baseStop = params.entryPrice * 0.015; // 1.5% base
    const stopDistance = baseStop * volatilityMultiplier;

    if (params.direction === 'BUY') {
      return params.entryPrice - stopDistance;
    } else {
      return params.entryPrice + stopDistance;
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * STRATEGY 6: Scout-Based Dynamic Stop
 * Scout profit determines stop position
 * High scout profit (>2%) = wider stop (give room for bigger move)
 * Low scout profit (<0.5%) = tight stop (quick exit if not working)
 * Theory: Confidence in the move determines risk tolerance
 */
export const ScoutBasedDynamicStop: StopLossStrategy = {
  name: 'Scout-Based Dynamic Stop',
  description:
    'Stop width based on scout profit: High scout profit = wider stop',
  calculateStop: (params: StopCalculationParams) => {
    let stopPercentage = 0.015; // Default 1.5%

    if (params.scoutProfit > 0.02) {
      // Scout up >2%, very confident
      stopPercentage = 0.025; // Wide 2.5% stop
    } else if (params.scoutProfit > 0.01) {
      // Scout up >1%, somewhat confident
      stopPercentage = 0.02; // Medium 2.0% stop
    } else if (params.scoutProfit < 0) {
      // Scout losing (shouldn't happen if FoR works, but safety)
      stopPercentage = 0.01; // Tight 1.0% stop
    }

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 - stopPercentage);
    } else {
      return params.entryPrice * (1 + stopPercentage);
    }
  },
  calculateTarget: (params: TargetCalculationParams) => {
    const riskPercentage = Math.abs(
      (params.stopPrice - params.entryPrice) / params.entryPrice
    );
    const targetPercentage = riskPercentage * params.asymmetryRatio;

    if (params.direction === 'BUY') {
      return params.entryPrice * (1 + targetPercentage);
    } else {
      return params.entryPrice * (1 - targetPercentage);
    }
  },
};

/**
 * ALL STRATEGIES FOR TESTING
 */
export const AllStopStrategies: StopLossStrategy[] = [
  FixedStopStrategy,
  TimeBasedAdaptiveStop,
  ATRBasedStop,
  SupportResistanceStop,
  VolatilityExpansionStop,
  ScoutBasedDynamicStop,
];

/**
 * Test harness to compare strategies
 */
export interface StrategyTestResult {
  strategyName: string;
  totalTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  winLossRatio: number;
  totalReturn: number;
  sharpeRatio: number;
  averageHoldingBars: number;
  maxDrawdown: number;
}

export function compareAllStrategies(trades: any[]): StrategyTestResult[] {
  return AllStopStrategies.map((strategy) => {
    const results: StrategyTestResult = {
      strategyName: strategy.name,
      totalTrades: trades.length,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      winLossRatio: 0,
      totalReturn: 0,
      sharpeRatio: 0,
      averageHoldingBars: 0,
      maxDrawdown: 0,
    };

    // Calculate metrics for each strategy
    // This would be integrated with actual trade execution

    return results;
  });
}

export function printStrategyComparison(results: StrategyTestResult[]): void {
  console.log('\n' + '='.repeat(100));
  console.log('FLEXIBLE STOP LOSS STRATEGY COMPARISON');
  console.log('='.repeat(100) + '\n');

  console.log(
    'Strategy'.padEnd(30) +
      'Win Rate'.padEnd(12) +
      'Avg Win'.padEnd(12) +
      'Avg Loss'.padEnd(12) +
      'W/L Ratio'.padEnd(12) +
      'Total Return'
  );
  console.log('-'.repeat(100));

  results.forEach((result) => {
    console.log(
      result.strategyName.padEnd(30) +
        `${(result.winRate * 100).toFixed(1)}%`.padEnd(12) +
        `${(result.averageWin * 100).toFixed(2)}%`.padEnd(12) +
        `${(result.averageLoss * 100).toFixed(2)}%`.padEnd(12) +
        `${result.winLossRatio.toFixed(2)}x`.padEnd(12) +
        `${(result.totalReturn * 100).toFixed(2)}%`
    );
  });

  console.log('\n' + '='.repeat(100));
  console.log('KEY FINDINGS:');
  console.log('='.repeat(100));

  // Find best strategy by different metrics
  const bestByReturn = results.reduce((prev, current) =>
    prev.totalReturn > current.totalReturn ? prev : current
  );
  const bestByWinRate = results.reduce((prev, current) =>
    prev.winRate > current.winRate ? prev : current
  );
  const bestByAsymmetry = results.reduce((prev, current) =>
    prev.winLossRatio > current.winLossRatio ? prev : current
  );

  console.log(`Best Total Return:      ${bestByReturn.strategyName} (${(bestByReturn.totalReturn * 100).toFixed(2)}%)`);
  console.log(`Best Win Rate:          ${bestByWinRate.strategyName} (${(bestByWinRate.winRate * 100).toFixed(1)}%)`);
  console.log(
    `Best Asymmetry Ratio:   ${bestByAsymmetry.strategyName} (${bestByAsymmetry.winLossRatio.toFixed(2)}x)`
  );

  console.log('\nRECOMMENDATION:');
  console.log('-'.repeat(100));
  console.log('The wider stop strategies allow positions to hold longer and capture bigger moves.');
  console.log(
    'However, they increase losing trades. The asymmetry ratio MUST remain >1.5x to justify.'
  );
  console.log(
    'Best approach: Start with baseline (fixed stop), then test time-based or ATR-based for improvement.'
  );
  console.log('');
}
