/**
 * Example Usage of Complete Signal Generator Pipeline
 * 
 * Shows how to use the integrated system in your application
 */

import CompletePipelineSignalGenerator, { type CompleteSignal } from './lib/complete-pipeline-signal-generator';
import { RegimeAwareSignalRouter } from './services/regime-aware-signal-router';
import { UnifiedSignalAggregator } from './services/unified-signal-aggregator';

// ============================================================================
// EXAMPLE 1: Basic signal generation for single symbol
// ============================================================================

async function generateBTCSignal() {
  const signal = await CompletePipelineSignalGenerator.generateSignal(
    'BTCUSDT',           // symbol
    42000,               // currentPrice
    '1h',                // timeframe
    10000,               // accountBalance

    // Market regime indicators
    'MEDIUM',            // volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
    65,                  // trendStrength: 0-100
    0.03,                // rangeWidth: 0-1 (as decimal)
    'RISING',            // volatilityTrend: 'RISING' | 'STABLE' | 'FALLING'
    1.02,                // priceVsMA: price/sma50 ratio
    4,                   // recentSwings: count of recent swing highs/lows

    // Gradient direction
    0.15,                // gradientValue: -1 to 1
    78,                  // gradientStrength: 0-100
    false,               // trendShiftDetected: boolean

    // UT Bot
    420,                 // atr: average true range
    41000,               // trailingStop: current trailing stop price
    3,                   // utBuyCount: number of buy signals
    1,                   // utSellCount: number of sell signals
    0.65,                // utMomentum: -1 to 1

    // Market structure
    'UPTREND',           // structureTrend: 'UPTREND' | 'DOWNTREND' | 'RANGING'
    false,               // structureBreak: boolean

    // Flow field
    'BULLISH',           // flowDominant: 'BULLISH' | 'BEARISH'
    75,                  // flowForce: 0-100
    'medium',            // flowTurbulence: 'low' | 'medium' | 'high' | 'extreme'
    'ACCELERATING',      // flowEnergyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING'

    // Chart data for ML
    []                   // chartData: array of price candles
  );

  return signal;
}

// ============================================================================
// EXAMPLE 2: Execute trade based on complete signal
// ============================================================================

async function executeTrade(signal: CompleteSignal) {
  console.log(`\n[TRADE] ${signal.metadata.symbol} - ${signal.direction}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
  console.log(`Regime: ${signal.regime.type} (strength: ${signal.regime.strength.toFixed(0)}%)`);
  console.log(`Position Size: ${(signal.finalPositionSize).toFixed(2)} (${(signal.finalPositionPercent * 100).toFixed(2)}% of account)`);
  console.log(`Entry Rule: ${signal.rules.entryRule}`);
  console.log(`Stop Loss: ${(signal.metadata.priceLevel - signal.rules.stoplossDistance).toFixed(2)}`);
  console.log(`Take Profit: ${(signal.metadata.priceLevel + signal.rules.takeprofitDistance).toFixed(2)}`);
  console.log(`Risk Level: ${signal.risk.level}`);

  if (signal.direction === 'BUY') {
    // Execute BUY trade
    const entryPrice = signal.metadata.priceLevel;
    const quantity = signal.finalPositionSize / entryPrice;
    const stopLoss = entryPrice - signal.rules.stoplossDistance;
    const takeProfit = entryPrice + signal.rules.takeprofitDistance;

    console.log(`
      Entry: ${entryPrice.toFixed(2)} 
      Quantity: ${quantity.toFixed(4)}
      SL: ${stopLoss.toFixed(2)} 
      TP: ${takeProfit.toFixed(2)}
    `);

    // Place order...
  } else if (signal.direction === 'SELL') {
    // Execute SELL trade
    console.log('Executing SELL trade...');
  } else {
    // HOLD - no trade
    console.log('Holding position...');
  }
}

// ============================================================================
// EXAMPLE 3: Monitor regime changes and strategy weight shifts
// ============================================================================

interface RegimeHistory {
  timestamp: number;
  regime: string;
  weights: Record<string, number>;
  explanation: string;
}

const regimeHistory: RegimeHistory[] = [];

async function monitorRegimeChanges() {
  let lastRegime = '';

  setInterval(async () => {
    // In real scenario, you would fetch actual market data
    const signal = await generateBTCSignal();

    if (signal.regime.type !== lastRegime) {
      console.log(`\n[REGIME CHANGE] ${lastRegime} → ${signal.regime.type}`);
      console.log('Strategy Weights Updated:');
      console.log(`  Gradient: ${(signal.strategyWeights.gradient * 100).toFixed(0)}%`);
      console.log(`  UT Bot: ${(signal.strategyWeights.utBot * 100).toFixed(0)}%`);
      console.log(`  Structure: ${(signal.strategyWeights.structure * 100).toFixed(0)}%`);
      console.log(`  Flow Field: ${(signal.strategyWeights.flowField * 100).toFixed(0)}%`);
      console.log(`  ML: ${(signal.strategyWeights.ml * 100).toFixed(0)}%`);

      lastRegime = signal.regime.type;

      regimeHistory.push({
        timestamp: Date.now(),
        regime: signal.regime.type,
        weights: {
          gradient: signal.strategyWeights.gradient,
          utBot: signal.strategyWeights.utBot,
          structure: signal.strategyWeights.structure,
          flowField: signal.strategyWeights.flowField,
          ml: signal.strategyWeights.ml
        },
        explanation: signal.regime.characteristics.join('; ')
      });
    }
  }, 60000); // Check every minute
}

// ============================================================================
// EXAMPLE 4: Analyze signal quality and transparency
// ============================================================================

function analyzeSignalQuality(signal: CompleteSignal) {
  console.log(`\n[SIGNAL ANALYSIS] ${signal.metadata.symbol}`);

  // Agreement score
  console.log(`Agreement Score: ${signal.agreementScore.toFixed(0)}%`);
  const minRequired = signal.regime.type === 'TRENDING' ? 55 :
                      signal.regime.type === 'SIDEWAYS' ? 60 :
                      signal.regime.type === 'HIGH_VOLATILITY' ? 70 :
                      signal.regime.type === 'BREAKOUT' ? 65 : 75;
  console.log(`  Min Required (${signal.regime.type}): ${minRequired}%`);
  console.log(`  Status: ${signal.agreementScore >= minRequired ? '✅ PASS' : '❌ FILTERED'}`);

  // Strategy contributions
  console.log(`\nStrategy Contributions (Reweighted for ${signal.regime.type}):`);
  signal.contributions.forEach(contrib => {
    console.log(`  ${contrib.name}: ${(contrib.weight * 100).toFixed(0)}% - ${contrib.reason}`);
  });

  // Confidence breakdown
  console.log(`\nConfidence Breakdown:`);
  console.log(`  Unified Signal: ${(signal.confidence * 100).toFixed(0)}%`);
  console.log(`  Ensemble Model: ${(signal.ensembleModel.ensembleScore * 100).toFixed(0)}%`);
  console.log(`  Model Agreement: ${signal.unifiedSignal.agreementScore.toFixed(0)}%`);

  // Risk assessment
  console.log(`\nRisk Assessment:`);
  console.log(`  Level: ${signal.risk.level} (Score: ${signal.risk.score.toFixed(0)}/100)`);
  signal.risk.factors.forEach(factor => {
    console.log(`    • ${factor}`);
  });

  // Position sizing
  console.log(`\nPosition Sizing:`);
  console.log(`  Before Regime Adjustment: ${(signal.positionSizing.positionPercent * 100).toFixed(2)}%`);
  console.log(`  Regime Multiplier: ${signal.regimeSizingAdjustment.toFixed(1)}x`);
  console.log(`  Final Size: ${(signal.finalPositionPercent * 100).toFixed(2)}%`);
  console.log(`  In Currency: ${signal.finalPositionSize.toFixed(2)}`);

  // Debug trace
  if (signal.metadata.debugTrace) {
    console.log(`\nDebug Trace:`);
    Object.entries(signal.metadata.debugTrace).forEach(([key, value]) => {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    });
  }
}

// ============================================================================
// EXAMPLE 5: Batch process multiple symbols
// ============================================================================

async function processMultipleSymbols() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT'];
  const prices = [42000, 2400, 310, 0.98, 2.50];
  const results: CompleteSignal[] = [];

  for (let i = 0; i < symbols.length; i++) {
    try {
      const signal = await CompletePipelineSignalGenerator.generateSignal(
        symbols[i],
        prices[i],
        '1h',
        10000,
        // ... other parameters
        'MEDIUM', 65, 0.03, 'RISING', 1.02, 4,
        0.15, 78, false,
        prices[i] * 0.02, prices[i] * 0.98, 3, 1, 0.65,
        'UPTREND', false,
        'BULLISH', 75, 'medium', 'ACCELERATING',
        []
      );

      results.push(signal);
      console.log(`✅ ${symbols[i]}: ${signal.direction} (Confidence: ${(signal.confidence * 100).toFixed(0)}%)`);
    } catch (error) {
      console.error(`❌ ${symbols[i]}: Error - ${error}`);
    }
  }

  // Summary
  const buySignals = results.filter(s => s.direction === 'BUY').length;
  const sellSignals = results.filter(s => s.direction === 'SELL').length;
  const holdSignals = results.filter(s => s.direction === 'HOLD').length;

  console.log(`\n[SUMMARY] BUY: ${buySignals}, SELL: ${sellSignals}, HOLD: ${holdSignals}`);
  console.log(`Average Confidence: ${(results.reduce((a, b) => a + b.confidence, 0) / results.length * 100).toFixed(0)}%`);
}

// ============================================================================
// EXAMPLE 6: Compare regime-aware vs fixed weighting
// ============================================================================

async function compareWeightingStrategies(marketData: any) {
  // Simulate with different weight scenarios
  const scenarios = [
    {
      name: 'Fixed Weights (Original)',
      weights: {
        gradient: 0.35,
        utBot: 0.20,
        structure: 0.25,
        flowField: 0.15,
        ml: 0.05
      }
    },
    {
      name: 'Regime-Aware Adaptive',
      weights: 'dynamic'  // Will be set by RegimeAwareSignalRouter
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n[SCENARIO] ${scenario.name}`);

    if (scenario.weights === 'dynamic') {
      // Use regime-aware weighting
      const signal = await generateBTCSignal();
      console.log(`  Regime: ${signal.regime.type}`);
      signal.contributions.forEach(contrib => {
        console.log(`    ${contrib.name}: ${(contrib.weight * 100).toFixed(0)}%`);
      });
      console.log(`  Result: ${signal.direction} @ ${(signal.confidence * 100).toFixed(0)}% confidence`);
    } else {
      // Use fixed weighting
      console.log(`  All regimes use same weights`);
      Object.entries(scenario.weights).forEach(([strategy, weight]) => {
        console.log(`    ${strategy}: ${((weight as number) * 100).toFixed(0)}%`);
      });
      console.log(`  Result: [Simulated with fixed weights]`);
    }
  }
}

// ============================================================================
// EXAMPLE 7: Real-time streaming with regime monitoring
// ============================================================================

async function streamSignalsWithRegimeMonitoring() {
  let lastRegime = '';
  const signalCache: Map<string, CompleteSignal> = new Map();

  // Simulate real-time market data stream
  const stream = setInterval(async () => {
    try {
      // Fetch current market data (replace with real data)
      const signal = await generateBTCSignal();
      signalCache.set(signal.metadata.symbol, signal);

      // Log main signal
      console.log(`[${new Date().toISOString()}] ${signal.direction} @ ${signal.metadata.priceLevel}`);

      // Detect regime change
      if (signal.regime.type !== lastRegime) {
        console.log(`⚠️  REGIME CHANGE: ${lastRegime || 'INIT'} → ${signal.regime.type}`);
        console.log(`   Characteristics: ${signal.regime.characteristics.join(', ')}`);
        console.log(`   Weight Shift: See above for new strategy allocation`);
        lastRegime = signal.regime.type;
      }

      // Log if high-risk
      if (signal.risk.level === 'HIGH' || signal.risk.level === 'EXTREME') {
        console.log(`🚨 HIGH RISK: ${signal.risk.factors.join(', ')}`);
      }

      // Log if signal filtered (below min agreement)
      if (signal.direction === 'HOLD' && signal.unifiedSignal.direction !== 'HOLD') {
        console.log(`⏸️  Signal filtered (${signal.agreementScore.toFixed(0)}% < min ${signal.regime.type})`);
      }
    } catch (error) {
      console.error('Signal generation error:', error);
    }
  }, 5000); // Every 5 seconds

  return stream;
}

// ============================================================================
// EXAMPLE 8: Backtest regime weighting effectiveness
// ============================================================================

async function backtestRegimeWeighting(historicalData: any[]) {
  let regimeAwareMetrics = {
    trades: 0,
    wins: 0,
    losses: 0,
    totalReturn: 0,
    sharpe: 0
  };

  let fixedWeightMetrics = {
    trades: 0,
    wins: 0,
    losses: 0,
    totalReturn: 0,
    sharpe: 0
  };

  // Backtest with regime-aware weighting
  for (const candle of historicalData) {
    // Generate signal with adaptive weights
    const signal = await CompletePipelineSignalGenerator.generateSignal(
      candle.symbol,
      candle.price,
      candle.timeframe,
      10000,
      // ... market data
      candle.volatility, candle.trendStrength, candle.rangeWidth,
      candle.volatilityTrend, candle.priceVsMA, candle.recentSwings,
      candle.gradientValue, candle.gradientStrength, candle.trendShift,
      candle.atr, candle.trailingStop, candle.utBuy, candle.utSell, candle.utMomentum,
      candle.structureTrend, candle.structureBreak,
      candle.flowDominant, candle.flowForce, candle.flowTurbulence, candle.flowEnergy,
      candle.chartData
    );

    // Simulate trade outcome
    if (signal.direction === 'BUY') {
      regimeAwareMetrics.trades++;
      // ... calculate win/loss based on next candle
    }
  }

  console.log('\n[BACKTEST RESULTS]');
  console.log('\nRegime-Aware Adaptive Weighting:');
  console.log(`  Trades: ${regimeAwareMetrics.trades}`);
  console.log(`  Win Rate: ${(regimeAwareMetrics.wins / regimeAwareMetrics.trades * 100).toFixed(0)}%`);
  console.log(`  Total Return: ${(regimeAwareMetrics.totalReturn * 100).toFixed(2)}%`);
  console.log(`  Sharpe Ratio: ${regimeAwareMetrics.sharpe.toFixed(2)}`);

  console.log('\nFixed Weight Strategy:');
  console.log(`  Trades: ${fixedWeightMetrics.trades}`);
  console.log(`  Win Rate: ${(fixedWeightMetrics.wins / fixedWeightMetrics.trades * 100).toFixed(0)}%`);
  console.log(`  Total Return: ${(fixedWeightMetrics.totalReturn * 100).toFixed(2)}%`);
  console.log(`  Sharpe Ratio: ${fixedWeightMetrics.sharpe.toFixed(2)}`);

  console.log(`\nImprovement: ${((regimeAwareMetrics.sharpe / fixedWeightMetrics.sharpe - 1) * 100).toFixed(0)}% better Sharpe with regime-aware`);
}

// ============================================================================
// Export examples for use
// ============================================================================

export {
  generateBTCSignal,
  executeTrade,
  monitorRegimeChanges,
  analyzeSignalQuality,
  processMultipleSymbols,
  compareWeightingStrategies,
  streamSignalsWithRegimeMonitoring,
  backtestRegimeWeighting
};

// Usage:
// import { generateBTCSignal, executeTrade } from './examples';
//
// const signal = await generateBTCSignal();
// await executeTrade(signal);
