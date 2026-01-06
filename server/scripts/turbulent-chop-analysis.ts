/**
 * Turbulent Chop Trading Analysis
 * 
 * Analyzes what happens if we trade Turbulent Chop signals with controlled sizing
 * Tests hypothesis: Can we improve returns by harvesting Turbulent Chop with 50% position sizing?
 * 
 * Strategy:
 * 1. Trade all 165 detected Turbulent Chop signals
 * 2. Use 50% position sizing (reduces reversal impact)
 * 3. Apply pyramid exit strategy (30-30-40)
 * 4. Measure impact on overall PF and returns
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface TurbulentChopTrade {
  index: number;
  entryPrice: number;
  entryTime: string;
  exitPrice: number;
  exitTime: string;
  direction: 'long' | 'short';
  pnl: number;
  pnlPct: number;
  positionSize: number;
  confidence: number;
  signal: string;
}

interface ScenarioResult {
  name: string;
  totalTurbulentTrades: number;
  completedTurbulentTrades: number;
  turbulentWinRate: number;
  turbulentGrossProfit: number;
  turbulentGrossLoss: number;
  turbulentPnL: number;
  turbulentPF: number;
  
  // Combined with other regimes
  combinedTotalTrades: number;
  combinedPnL: number;
  combinedPF: number;
  combinedWinRate: number;
  
  // Impact analysis
  pnlDifference: number;
  pfDifference: number;
  drawdownChange: number;
}

async function analyzeturbulenTChopTrading() {
  console.log('\n' + '='.repeat(100));
  console.log('🌪️  TURBULENT CHOP TRADING ANALYSIS');
  console.log('='.repeat(100));
  console.log('');

  try {
    // Load 1-year data
    console.log('📊 Loading 1-year BTC/USDT data...');
    const cacheFile = './data/cache/BTCUSDT_1h_365d.json';
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    console.log(`✅ Loaded ${ticks.length} candles\n`);

    // Initialize agent
    console.log('🔧 Initializing VFMDPhysicsAgent...');
    const agent = new VFMDPhysicsAgent('backtest', 'balanced');
    console.log('✅ Agent ready\n');

    // Phase 1: Identify all regimes and turbulent chop signals
    console.log('📈 Phase 1: Analyzing regimes and turbulent chop signals...');
    const regimes: string[] = [];
    const turbulentChopSignals: Array<{
      index: number;
      confidence: number;
      direction: 'BUY' | 'SELL';
    }> = [];

    for (let i = 20; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const analysis = agent.getAnalysisForUI(historicalTicks);
      const regime = analysis?.regime?.classification || 'UNKNOWN';
      regimes[i] = regime;

      const signal = agent.generateSignal(historicalTicks);
      
      // Capture turbulent chop signals (lower confidence threshold to capture actual signals)
      if (regime === 'turbulent_chop' && signal.action !== 'HOLD' && signal.confidence >= 0.25) {
        turbulentChopSignals.push({
          index: i,
          confidence: signal.confidence,
          direction: signal.action as 'BUY' | 'SELL'
        });
      }

      if (i % 1000 === 0) {
        console.log(`  [${i}/${ticks.length}] Regimes: ${regimes.filter(r => r === 'turbulent_chop').length} turbulent detected`);
      }
    }

    console.log(`✅ Found ${turbulentChopSignals.length} turbulent chop signals\n`);

    // Phase 2: Load current backtest results
    console.log('📊 Phase 2: Loading current backtest results...');
    const resultsFile = './backtest-results-physics-engine.json';
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    const currentTrades = results.trades || [];

    // Extract current stats
    const currentPF = results.overall.profitFactor;
    const currentPnL = results.overall.totalPnL;
    const currentWR = results.overall.winRate;
    const currentTotalTrades = results.overall.trades;

    console.log(`Current Stats (with Lever 4):`);
    console.log(`  Total Trades: ${currentTotalTrades}`);
    console.log(`  Win Rate: ${(currentWR * 100).toFixed(2)}%`);
    console.log(`  Total PnL: $${currentPnL.toFixed(2)}`);
    console.log(`  Profit Factor: ${currentPF.toFixed(2)}\n`);

    // Phase 3: Simulate turbulent chop trading
    console.log('🔍 Phase 3: Simulating turbulent chop trades...');
    
    const SLIPPAGE_BPS = 2;
    const COMMISSION_BPS = 1;
    const MAX_POSITION_SIZE = 0.4;
    const TURBULENT_POSITION_MULTIPLIER = 0.5; // 50% position size
    
    let turbulentTradesExecuted = 0;
    let turbulentGrossProfit = 0;
    let turbulentGrossLoss = 0;
    let turbulentWins = 0;
    let turbulentLosses = 0;
    let turbulentTotalPnL = 0;
    const turbulentTrades: TurbulentChopTrade[] = [];

    let currentCapital = 1000; // Starting capital

    for (const tchSignal of turbulentChopSignals) {
      const i = tchSignal.index;
      const tick = ticks[i];
      const direction = tchSignal.direction === 'BUY' ? 'long' : 'short';

      // Calculate position size (50% of normal)
      const basePositionSize = Math.min(
        (currentCapital * MAX_POSITION_SIZE) / tick.close,
        currentCapital * 0.4
      );
      const positionSize = basePositionSize * TURBULENT_POSITION_MULTIPLIER;

      // Entry execution
      const slippageFactor = 1 + (direction === 'long' ? SLIPPAGE_BPS : -SLIPPAGE_BPS) / 10000;
      const entryPrice = tick.close * slippageFactor;

      // Find exit: pyramid 30-30-40 with trailing stop
      let partial1ExitPrice: number | undefined;
      let partial2ExitPrice: number | undefined;
      let trailingExitPrice: number | undefined;
      let trailingHighWaterMark = entryPrice;
      let trailingStopPrice = direction === 'long' ? entryPrice * 0.985 : entryPrice * 1.015;
      let exitPrice = entryPrice;
      let exitIndex = i + 1;

      for (let j = i + 1; j < Math.min(i + 16, ticks.length); j++) {
        const candleHigh = ticks[j].high;
        const candleLow = ticks[j].low;
        const candlesHeld = j - i;

        // Update trailing stop
        if (direction === 'long') {
          if (candleHigh > trailingHighWaterMark) {
            trailingHighWaterMark = candleHigh;
            trailingStopPrice = trailingHighWaterMark * 0.985;
          }
        } else {
          if (candleLow < trailingHighWaterMark) {
            trailingHighWaterMark = candleLow;
            trailingStopPrice = trailingHighWaterMark * 1.015;
          }
        }

        // Partial 1: Exit 30% at candle 3
        if (candlesHeld === 3 && !partial1ExitPrice) {
          partial1ExitPrice = direction === 'long' ? candleHigh : candleLow;
        }

        // Partial 2: Exit 30% at candle 6
        if (candlesHeld === 6 && !partial2ExitPrice) {
          partial2ExitPrice = direction === 'long' ? candleHigh : candleLow;
        }

        // Check trailing stop
        if ((direction === 'long' && candleLow <= trailingStopPrice) ||
            (direction === 'short' && candleHigh >= trailingStopPrice)) {
          trailingExitPrice = ticks[j].close;
          exitPrice = ticks[j].close;
          exitIndex = j;
          break;
        }

        // Hard stop at 15 candles
        if (j === i + 15) {
          if (!trailingExitPrice) {
            trailingExitPrice = ticks[j].close;
          }
          exitPrice = ticks[j].close;
          exitIndex = j;
          break;
        }
      }

      // Default trailing exit if not triggered
      if (!trailingExitPrice) {
        trailingExitPrice = exitPrice;
      }

      // Calculate PnL with pyramid
      const partial1Size = positionSize * 0.3;
      const partial1ExitPriceActual = partial1ExitPrice || exitPrice;
      const partial1Pnl = direction === 'long'
        ? partial1Size * (partial1ExitPriceActual - entryPrice)
        : partial1Size * (entryPrice - partial1ExitPriceActual);
      const partial1Commission = (entryPrice * partial1Size * COMMISSION_BPS / 10000) +
                                 (partial1ExitPriceActual * partial1Size * COMMISSION_BPS / 10000);

      const partial2Size = positionSize * 0.3;
      const partial2ExitPriceActual = partial2ExitPrice || exitPrice;
      const partial2Pnl = direction === 'long'
        ? partial2Size * (partial2ExitPriceActual - entryPrice)
        : partial2Size * (entryPrice - partial2ExitPriceActual);
      const partial2Commission = (entryPrice * partial2Size * COMMISSION_BPS / 10000) +
                                 (partial2ExitPriceActual * partial2Size * COMMISSION_BPS / 10000);

      const trailingSize = positionSize * 0.4;
      const trailingExitPriceActual = trailingExitPrice || exitPrice;
      const trailingPnl = direction === 'long'
        ? trailingSize * (trailingExitPriceActual - entryPrice)
        : trailingSize * (entryPrice - trailingExitPriceActual);
      const trailingCommission = (entryPrice * trailingSize * COMMISSION_BPS / 10000) +
                                 (trailingExitPriceActual * trailingSize * COMMISSION_BPS / 10000);

      // Total PnL
      const pnl = partial1Pnl + partial2Pnl + trailingPnl;
      const commissionCost = partial1Commission + partial2Commission + trailingCommission;
      const netPnL = pnl - commissionCost;

      const totalVolume = partial1Size + partial2Size + trailingSize;
      exitPrice = (partial1Size * partial1ExitPriceActual +
                   partial2Size * partial2ExitPriceActual +
                   trailingSize * trailingExitPriceActual) / totalVolume;

      const pnlPct = direction === 'long'
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;

      // Track metrics
      turbulentTradesExecuted++;
      turbulentTotalPnL += netPnL;
      currentCapital += netPnL;

      if (netPnL > 0) {
        turbulentWins++;
        turbulentGrossProfit += netPnL;
      } else {
        turbulentLosses++;
        turbulentGrossLoss += Math.abs(netPnL);
      }

      turbulentTrades.push({
        index: i,
        entryPrice,
        entryTime: new Date(tick.timestamp).toISOString(),
        exitPrice,
        exitTime: new Date(ticks[exitIndex].timestamp).toISOString(),
        direction,
        pnl: netPnL,
        pnlPct,
        positionSize,
        confidence: tchSignal.confidence,
        signal: tchSignal.direction
      });
    }

    const turbulentPF = turbulentGrossLoss > 0 ? turbulentGrossProfit / turbulentGrossLoss : 999;
    const turbulentWR = turbulentTradesExecuted > 0 ? turbulentWins / turbulentTradesExecuted : 0;

    console.log(`✅ Simulated ${turbulentTradesExecuted} turbulent chop trades\n`);

    // Phase 4: Calculate combined impact
    console.log('📊 Phase 4: Calculating combined impact...');

    const combinedTotalTrades = currentTotalTrades + turbulentTradesExecuted;
    const combinedPnL = currentPnL + turbulentTotalPnL;
    const combinedGrossProfit = (currentPF > 0 ? (currentPnL * currentPF) / (currentPF - 1) : 0) + turbulentGrossProfit;
    const combinedGrossLoss = (currentPF > 0 ? currentPnL / (currentPF - 1) : 0) + turbulentGrossLoss;
    const combinedPF = combinedGrossLoss > 0 ? combinedGrossProfit / combinedGrossLoss : 999;
    const combinedWinRate = (results.overall.winningTrades + turbulentWins) / combinedTotalTrades;

    console.log('');
    console.log('='.repeat(100));
    console.log('🎯 TURBULENT CHOP TRADING SCENARIO RESULTS');
    console.log('='.repeat(100));
    console.log('');

    console.log('CURRENT STATE (With Lever 4 - Regime Sizing):');
    console.log(`  Total Trades: ${currentTotalTrades}`);
    console.log(`  Win Rate: ${(currentWR * 100).toFixed(2)}%`);
    console.log(`  Total PnL: $${currentPnL.toFixed(2)}`);
    console.log(`  Profit Factor: ${currentPF.toFixed(2)}`);
    console.log('');

    console.log('TURBULENT CHOP TRADES (50% Position Sizing):');
    console.log(`  Total Signals: ${turbulentChopSignals.length}`);
    console.log(`  Executed Trades: ${turbulentTradesExecuted}`);
    console.log(`  Win Rate: ${(turbulentWR * 100).toFixed(2)}% (${turbulentWins}/${turbulentTradesExecuted})`);
    console.log(`  Gross Profit: $${turbulentGrossProfit.toFixed(2)}`);
    console.log(`  Gross Loss: $${turbulentGrossLoss.toFixed(2)}`);
    console.log(`  Total PnL: $${turbulentTotalPnL.toFixed(2)}`);
    console.log(`  Profit Factor: ${turbulentPF.toFixed(2)}`);
    console.log(`  Avg Trade: $${(turbulentTotalPnL / turbulentTradesExecuted).toFixed(2)}`);
    console.log('');

    console.log('COMBINED IMPACT (Current + Turbulent Chop):');
    console.log(`  Total Trades: ${combinedTotalTrades} (+${turbulentTradesExecuted})`);
    console.log(`  Win Rate: ${(combinedWinRate * 100).toFixed(2)}% (${results.overall.winningTrades + turbulentWins}/${combinedTotalTrades})`);
    console.log(`  Total PnL: $${combinedPnL.toFixed(2)} (+$${turbulentTotalPnL.toFixed(2)})`);
    console.log(`  Profit Factor: ${combinedPF.toFixed(2)} ${combinedPF > currentPF ? '✅ IMPROVED' : combinedPF === currentPF ? '→' : '❌ WORSE'}`);
    console.log('');

    console.log('IMPACT ANALYSIS:');
    console.log(`  PnL Gain: +$${turbulentTotalPnL.toFixed(2)} (${((turbulentTotalPnL / currentPnL) * 100).toFixed(1)}% increase)`);
    console.log(`  PF Change: ${(combinedPF - currentPF).toFixed(2)} (${((combinedPF - currentPF) / currentPF * 100).toFixed(1)}%)`);
    console.log(`  Capital Growth: $1000 → $${currentCapital.toFixed(2)} (${((currentCapital - 1000) / 1000 * 100).toFixed(1)}%)`);
    console.log('');

    if (turbulentWR < 0.5) {
      console.log('⚠️  WARNING: Turbulent Chop win rate is low (<50%)');
      console.log('   This suggests the edge is weak in this regime.');
      console.log('   Current 50% sizing already reduces exposure significantly.');
    }

    if (combinedPF > currentPF) {
      console.log('✅ RESULT: Adding turbulent chop IMPROVES profit factor');
    } else if (combinedPF === currentPF) {
      console.log('→ RESULT: Adding turbulent chop NEUTRAL to profit factor');
    } else {
      console.log('❌ RESULT: Adding turbulent chop HURTS profit factor');
    }

    console.log('');
    console.log('='.repeat(100));
    console.log('');

    // Save results
    const analysisFile = './turbulent-chop-analysis-results.json';
    const analysis = {
      timestamp: new Date().toISOString(),
      currentState: {
        totalTrades: currentTotalTrades,
        winRate: currentWR,
        pnL: currentPnL,
        profitFactor: currentPF
      },
      turbulentChopScenario: {
        signals: turbulentChopSignals.length,
        executedTrades: turbulentTradesExecuted,
        winRate: turbulentWR,
        grossProfit: turbulentGrossProfit,
        grossLoss: turbulentGrossLoss,
        totalPnL: turbulentTotalPnL,
        profitFactor: turbulentPF,
        avgTrade: turbulentTotalPnL / turbulentTradesExecuted
      },
      combined: {
        totalTrades: combinedTotalTrades,
        winRate: combinedWinRate,
        pnL: combinedPnL,
        profitFactor: combinedPF,
        pnlGain: turbulentTotalPnL,
        pfChange: combinedPF - currentPF,
        capitalGrowth: currentCapital
      },
      recommendation: combinedPF > currentPF 
        ? 'IMPLEMENT: Trading turbulent chop improves profit factor'
        : combinedPF === currentPF
        ? 'NEUTRAL: No harm in trading turbulent chop with 50% sizing'
        : 'SKIP: Turbulent chop trading hurts profit factor even with 50% sizing'
    };

    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
    console.log(`💾 Analysis saved to: ${analysisFile}\n`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeturbulenTChopTrading()
  .then(() => {
    console.log('✅ TURBULENT CHOP ANALYSIS COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
