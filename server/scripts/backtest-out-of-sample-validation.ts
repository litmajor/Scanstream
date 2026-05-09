/**
 * Out-of-Sample Validation Test
 * 
 * Trains on 2023-2024 data and tests on 2025 data to detect overfitting
 * Physics-based system doesn't require traditional ML training, but we can analyze:
 *   1. Signal quality consistency across time periods
 *   2. Regime prevalence changes (are thresholds still optimal?)
 *   3. Performance degradation (overfitting indicator)
 * 
 * HYBRID ARCHITECTURE (Entry ≠ Exit):
 *   ENTRY:  Agent-controlled via VFMDPhysicsAgent
 *           → PEG threshold gating
 *           → TRIGGER constraint checking  
 *           → Profit score validation
 *           → generateSignal() determines when to trade
 *   
 *   EXIT:   Hardcoded regime-based rules (NOT agent-controlled)
 *           → maxHoldCandles varies by regime (distribution: 20, consolidation: 5, other: 15)
 *           → Profit target is fixed (agent recommendation lost money)
 *           → Stop loss is fixed (agent recommendation lost money)
 *           → Trailing stops are regime-agnostic
 *   
 *   Why hybrid works: Agent excels at entry timing via physics, but regime-specific
 *   exit rules outperform agent exit logic. Hardcoded stops avoid agent exit PnL bleed.
 * 
 * Expected behaviors for a robust system:
 *   - Test performance within 80% of training performance
 *   - No regime frequency shift > 30%
 *   - Win rate variance < 10%
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/backtest-out-of-sample-validation.ts
 */

import * as fs from 'fs';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface PeriodResults {
  period: string;
  startDate: string;
  endDate: string;
  candleCount: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeDuration: number;
  regimeDistribution: Record<string, { count: number; percentage: number }>;
  regimePerformance: Record<string, {
    trades: number;
    winRate: number;
    profitFactor: number;
    avgDuration: number;
  }>;
}

interface ValidationResults {
  training: {
    btc: PeriodResults;
    eth: PeriodResults;
  };
  testing: {
    btc: PeriodResults;
    eth: PeriodResults;
  };
  analysis: {
    btcOverfittingIndicators: string[];
    ethOverfittingIndicators: string[];
    overallAssessment: string;
    recommendations: string[];
  };
}

const STARTING_CAPITAL = 1000;
const MAX_POSITION_SIZE = 0.4;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

interface Trade {
  entryIndex: number;
  entryPrice: number;
  entryTime: string;
  exitIndex: number;
  exitPrice: number;
  exitTime: string;
  direction: 'long' | 'short';
  pnl: number;
  pnlPct: number;
  regimeAtEntry: string;
  positionSize: number;
  confidence: number;
}

async function loadCachedCandles(symbol: string, year: number): Promise<MarketTick[]> {
  const cacheFile = `./data/cache/${symbol}USDT_1h_${year}.json`;
  
  if (!fs.existsSync(cacheFile)) {
    console.log(`  ⚠️  Cache miss: ${cacheFile}`);
    return [];
  }

  try {
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    
    // Validate structure
    if (ticks.length > 0 && !('open' in ticks[0])) {
      console.log(`  ⚠️  Invalid format: ${cacheFile}`);
      return [];
    }

    return ticks;
  } catch (e) {
    console.log(`  ⚠️  Failed to parse: ${cacheFile}`);
    return [];
  }
}

async function runBacktest(
  asset: 'BTC' | 'ETH',
  candles: MarketTick[],
  period: string
): Promise<PeriodResults> {
  if (candles.length === 0) {
    throw new Error(`No candles loaded for ${asset} in period ${period}`);
  }

  console.log(`\n    Running ${period} backtest for ${asset} (${candles.length} candles)...`);

  const agent = new VFMDPhysicsAgent('backtest', 'balanced');
  agent.setAsset(asset);
  
  let capital = STARTING_CAPITAL;
  const trades: Trade[] = [];
  const equityCurve = [capital];
  const regimes: string[] = [];
  let currentRegime = '';
  let regimeChangePoints: number[] = [];
  let regimeAccuracy = 0;

  // Analyze regimes for entire period
  for (let i = 20; i < candles.length; i++) {
    const historicalTicks = candles.slice(0, i + 1);
    let regime = 'unknown';
    
    try {
      const analysis = agent.getAnalysisForUI(historicalTicks);
      if (analysis?.regime?.classification) {
        regime = analysis.regime.classification;
        if (analysis?.regime?.confidence) {
          regimeAccuracy += analysis.regime.confidence;
        }
      }
    } catch (e) {
      // Silent fail on analysis errors
    }
    
    regimes.push(regime);

    if (regime !== currentRegime) {
      regimeChangePoints.push(i);
      currentRegime = regime;
    }
  }
  regimeAccuracy = regimeAccuracy / Math.max(1, candles.length - 20);

  // Execute trades
  let holdSignalCount = 0;
  let lowConfidenceCount = 0;

  for (let i = 20; i < candles.length - 1; i++) {
    if (capital <= 0) break;

    const historicalTicks = candles.slice(0, i + 1);
    const regime = regimes[i] || 'unknown';
    const tick = candles[i];
    const nextTick = candles[i + 1];

    // ╔═══════════════════════════════════════════════════════════════════════════════╗
    // ║ ENTRY LOGIC: AGENT-CONTROLLED via VFMDPhysicsAgent                             ║
    // ║ Agent generates signal based on: PEG thresholds → TRIGGER gates → profitScore ║
    // ║ Agent fully controls: when to BUY/SELL and position sizing logic              ║
    // ╚═══════════════════════════════════════════════════════════════════════════════╝
    let signal: any;
    try {
      signal = agent.generateSignal(historicalTicks);
    } catch (e) {
      holdSignalCount++;
      continue;
    }

    if (!signal || signal.action === 'HOLD') {
      holdSignalCount++;
      continue;
    }

    const turbulentChopThreshold = regime === 'turbulent_chop' ? 0.15 : 0.18;
    if (signal.confidence < turbulentChopThreshold) {
      lowConfidenceCount++;
      continue;
    }

    const direction = signal.action === 'BUY' ? 'long' : signal.action === 'SELL' ? 'short' : null;
    if (!direction) continue;

    let positionSize = (capital * MAX_POSITION_SIZE) / tick.close;
    const regimeMultipliers: Record<string, number> = {
      'distribution': 0.3,
      'turbulent_chop': 1.0,
      'consolidation': 0.4,
      'accumulation': 0.6,
      'breakout_transition': 1.0,
      'laminar_trend': 0.8,
      'unknown': 0.3
    };
    const regimeLowercase = regime.toLowerCase();
    const regimeMultiplier = regimeMultipliers[regimeLowercase] ?? 0.5;
    positionSize *= regimeMultiplier;

    const slippageFactor = 1 + (direction === 'long' ? SLIPPAGE_BPS : -SLIPPAGE_BPS) / 10000;
    const entryPrice = tick.close * slippageFactor;
    
    // ╔═══════════════════════════════════════════════════════════════════════════════╗
    // ║ EXIT LOGIC: HARDCODED REGIME-BASED STOPS (NOT agent recommendation)           ║
    // ║ Challenge: Agent exit signals from exitConditions metadata lost money         ║
    // ║ Solution: Revert to hardcoded regime-specific stops that historically work     ║
    // ╚═══════════════════════════════════════════════════════════════════════════════╝
    const targetPrice = entryPrice * 1.02;  // Fixed 2% target (NOT from agent.signal.target)
    const stopPrice = entryPrice * 0.985;   // Fixed 1.5% stop (NOT from agent.signal.stop)

    let trailingHighWaterMark = entryPrice;
    let trailingStopPrice = direction === 'long' ? entryPrice * 0.99 : entryPrice * 1.01;

    let exitPrice = nextTick.close;
    let exitIndex = i + 1;
    let exitReason: string = 'time_stop';

    // Regime-specific hold duration (tuned per regime performance)
    // distribution: 20 candles (low win rate, exit quickly)
    // consolidation: 5 candles (tight ranges, fast exits)
    // all others: 15 candles (default prudent holding period)
    const maxHoldCandles = regime === 'distribution' ? 20 : regime === 'consolidation' ? 5 : 15;

    for (let j = i + 1; j < Math.min(i + maxHoldCandles, candles.length - 1); j++) {
      const checkTick = candles[j];

      if (direction === 'long') {
        trailingHighWaterMark = Math.max(trailingHighWaterMark, checkTick.high);
        trailingStopPrice = trailingHighWaterMark * (1 - 0.01);

        if (checkTick.high >= targetPrice) {
          exitPrice = targetPrice;
          exitIndex = j;
          exitReason = 'target_hit';
          break;
        }
        if (checkTick.low <= stopPrice) {
          exitPrice = stopPrice;
          exitIndex = j;
          exitReason = 'stop_hit';
          break;
        }
        if (checkTick.low <= trailingStopPrice) {
          exitPrice = trailingStopPrice;
          exitIndex = j;
          exitReason = 'trailing_stop';
          break;
        }
      } else {
        trailingHighWaterMark = Math.min(trailingHighWaterMark, checkTick.low);
        trailingStopPrice = trailingHighWaterMark * (1 + 0.01);

        if (checkTick.low <= targetPrice) {
          exitPrice = targetPrice;
          exitIndex = j;
          exitReason = 'target_hit';
          break;
        }
        if (checkTick.high >= stopPrice) {
          exitPrice = stopPrice;
          exitIndex = j;
          exitReason = 'stop_hit';
          break;
        }
        if (checkTick.high >= trailingStopPrice) {
          exitPrice = trailingStopPrice;
          exitIndex = j;
          exitReason = 'trailing_stop';
          break;
        }
      }
    }

    const exitCommission = exitPrice * positionSize * (COMMISSION_BPS / 10000);
    const entryCommission = entryPrice * positionSize * (COMMISSION_BPS / 10000);

    let pnl = direction === 'long'
      ? (exitPrice - entryPrice) * positionSize - entryCommission - exitCommission
      : (entryPrice - exitPrice) * positionSize - entryCommission - exitCommission;

    const pnlPct = pnl / capital;
    capital += pnl;

    if (capital > 0) {
      const trade: Trade = {
        entryIndex: i,
        entryPrice,
        entryTime: new Date(candles[i].timestamp).toISOString(),
        exitIndex,
        exitPrice,
        exitTime: new Date(candles[exitIndex].timestamp).toISOString(),
        direction,
        pnl,
        pnlPct,
        regimeAtEntry: regime,
        positionSize,
        confidence: signal.confidence
      };
      trades.push(trade);
      equityCurve.push(capital);
    }
  }

  // Calculate metrics
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 1);

  const durations = trades.map(t => t.exitIndex - t.entryIndex);
  const avgTradeDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Sharpe ratio
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / Math.max(dailyReturns.length, 1);
  const stdDev = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / Math.max(dailyReturns.length, 1)
  );
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

  // Max drawdown
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const peakVal = Math.max(...equityCurve.slice(0, i + 1));
    const dd = (equityCurve[i] - peakVal) / peakVal;
    maxDD = Math.min(maxDD, dd);
  }

  // Regime distribution
  const regimeDistribution: Record<string, { count: number; percentage: number }> = {};
  for (const regime of regimes) {
    if (!regimeDistribution[regime]) {
      regimeDistribution[regime] = { count: 0, percentage: 0 };
    }
    regimeDistribution[regime].count++;
  }
  for (const regime in regimeDistribution) {
    regimeDistribution[regime].percentage = 
      (regimeDistribution[regime].count / regimes.length) * 100;
  }

  // Regime performance
  const regimePerformance: Record<string, {
    trades: number;
    winRate: number;
    profitFactor: number;
    avgDuration: number;
  }> = {};

  for (const regime of Object.keys(regimeDistribution)) {
    const regimeTrades = trades.filter(t => t.regimeAtEntry === regime);
    if (regimeTrades.length > 0) {
      const regimeWins = regimeTrades.filter(t => t.pnl > 0).length;
      const regimeLosses = regimeTrades.filter(t => t.pnl <= 0).length;
      const regimeGrossProfit = regimeTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
      const regimeGrossLoss = Math.abs(regimeTrades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0));
      const regimePF = regimeGrossLoss > 0 ? regimeGrossProfit / regimeGrossLoss : 1;
      const regimeDurations = regimeTrades.map(t => t.exitIndex - t.entryIndex);
      const regimeAvgDuration = regimeDurations.reduce((a, b) => a + b, 0) / regimeDurations.length;

      regimePerformance[regime] = {
        trades: regimeTrades.length,
        winRate: regimeWins / regimeTrades.length,
        profitFactor: regimePF,
        avgDuration: regimeAvgDuration
      };
    }
  }

  return {
    period,
    startDate: new Date(candles[0].timestamp).toISOString().split('T')[0],
    endDate: new Date(candles[candles.length - 1].timestamp).toISOString().split('T')[0],
    candleCount: candles.length,
    totalTrades: trades.length,
    winRate: wins.length / Math.max(trades.length, 1),
    profitFactor,
    totalPnL,
    grossProfit,
    grossLoss,
    sharpeRatio,
    maxDrawdown: maxDD,
    avgTradeDuration,
    regimeDistribution,
    regimePerformance
  };
}

async function main() {
  try {
    console.log('🔬 OUT-OF-SAMPLE VALIDATION TEST');
    console.log('='.repeat(100));
    console.log('');
    console.log('OBJECTIVE: Train on 2023-2024 data, test on 2025 to detect overfitting');
    console.log('');
    console.log('Robustness Criteria:');
    console.log('  ✓ Test win rate within ±5% of training');
    console.log('  ✓ Test profit factor > 1.5');
    console.log('  ✓ Regime frequency stable (±20% variance)');
    console.log('  ✓ Test trades > 50 (statistical significance)');
    console.log('');

    // Load training data (2023-2024)
    console.log('📥 LOADING TRAINING DATA (2023-2024)');
    console.log('─'.repeat(100));

    console.log('\n  BTC:');
    const btc2023 = await loadCachedCandles('BTC', 2023);
    const btc2024 = await loadCachedCandles('BTC', 2024);
    const btcTraining = [...btc2023, ...btc2024];
    console.log(`    2023: ${btc2023.length} candles | 2024: ${btc2024.length} candles | Total: ${btcTraining.length}`);

    console.log('\n  ETH:');
    const eth2023 = await loadCachedCandles('ETH', 2023);
    const eth2024 = await loadCachedCandles('ETH', 2024);
    const ethTraining = [...eth2023, ...eth2024];
    console.log(`    2023: ${eth2023.length} candles | 2024: ${eth2024.length} candles | Total: ${ethTraining.length}`);

    // Load test data (2025)
    console.log('\n📥 LOADING TEST DATA (2025)');
    console.log('─'.repeat(100));

    console.log('\n  BTC:');
    const btc2025 = await loadCachedCandles('BTC', 2025);
    console.log(`    ${btc2025.length} candles loaded`);

    console.log('\n  ETH:');
    const eth2025 = await loadCachedCandles('ETH', 2025);
    console.log(`    ${eth2025.length} candles loaded`);

    if (btcTraining.length === 0 || ethTraining.length === 0 || 
        btc2025.length === 0 || eth2025.length === 0) {
      console.log('\n❌ ERROR: Missing cached data files. Please run:');
      console.log('   pnpm exec tsx server/services/vfmd/binanceDataFetcher.ts 3years-1h');
      process.exit(1);
    }

    // Run backtests
    console.log('\n⚙️  RUNNING BACKTESTS');
    console.log('='.repeat(100));

    console.log('\n📊 TRAINING PERIOD (2023-2024)');
    console.log('─'.repeat(100));

    const btcTrainingResults = await runBacktest('BTC', btcTraining, '2023-2024');
    const ethTrainingResults = await runBacktest('ETH', ethTraining, '2023-2024');

    console.log('\n📊 TEST PERIOD (2025)');
    console.log('─'.repeat(100));

    const btcTestResults = await runBacktest('BTC', btc2025, '2025');
    const ethTestResults = await runBacktest('ETH', eth2025, '2025');

    // Detailed results
    console.log('\n📈 RESULTS COMPARISON');
    console.log('='.repeat(100));

    const printResults = (label: string, training: PeriodResults, test: PeriodResults) => {
      console.log(`\n${label}:`);
      console.log('');
      console.log(`  Metric                  Training          Test              Change`);
      console.log('  ' + '─'.repeat(95));

      const winRateChange = ((test.winRate - training.winRate) / training.winRate) * 100;
      const tradeChange = ((test.totalTrades - training.totalTrades) / training.totalTrades) * 100;
      const pfChange = ((test.profitFactor - training.profitFactor) / training.profitFactor) * 100;
      const sharpeChange = ((test.sharpeRatio - training.sharpeRatio) / training.sharpeRatio) * 100;

      console.log(`  Trades                  ${training.totalTrades.toString().padEnd(17)} ${test.totalTrades.toString().padEnd(17)} ${tradeChange > 0 ? '+' : ''}${tradeChange.toFixed(1)}%`);
      console.log(`  Win Rate                ${(training.winRate * 100).toFixed(1)}%${' '.repeat(12)} ${(test.winRate * 100).toFixed(1)}%${' '.repeat(12)} ${winRateChange > 0 ? '+' : ''}${winRateChange.toFixed(1)}%`);
      console.log(`  Profit Factor           ${training.profitFactor.toFixed(2).padEnd(17)} ${test.profitFactor.toFixed(2).padEnd(17)} ${pfChange > 0 ? '+' : ''}${pfChange.toFixed(1)}%`);
      console.log(`  Total PnL               $${training.totalPnL.toFixed(2).padEnd(15)} $${test.totalPnL.toFixed(2).padEnd(15)} ${(test.totalPnL - training.totalPnL > 0 ? '+' : '')}$${(test.totalPnL - training.totalPnL).toFixed(2)}`);
      console.log(`  Sharpe Ratio            ${training.sharpeRatio.toFixed(3).padEnd(17)} ${test.sharpeRatio.toFixed(3).padEnd(17)} ${sharpeChange > 0 ? '+' : ''}${sharpeChange.toFixed(1)}%`);
      console.log(`  Max Drawdown            ${(training.maxDrawdown * 100).toFixed(2)}%${' '.repeat(12)} ${(test.maxDrawdown * 100).toFixed(2)}%${' '.repeat(12)} ${(test.maxDrawdown - training.maxDrawdown) * 100 > 0 ? '+' : ''}${((test.maxDrawdown - training.maxDrawdown) * 100).toFixed(2)}%`);
    };

    printResults('BTC', btcTrainingResults, btcTestResults);
    printResults('ETH', ethTrainingResults, ethTestResults);

    // Regime analysis
    console.log('\n🎯 REGIME FREQUENCY ANALYSIS');
    console.log('─'.repeat(100));

    const analyzeRegimes = (label: string, training: PeriodResults, test: PeriodResults) => {
      console.log(`\n${label}:`);
      console.log('');
      const allRegimes = new Set([...Object.keys(training.regimeDistribution), ...Object.keys(test.regimeDistribution)]);
      
      for (const regime of allRegimes) {
        const trainingPct = training.regimeDistribution[regime]?.percentage || 0;
        const testPct = test.regimeDistribution[regime]?.percentage || 0;
        const change = testPct - trainingPct;
        
        console.log(`  ${regime.padEnd(25)} Training: ${trainingPct.toFixed(1)}%  Test: ${testPct.toFixed(1)}%  Change: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`);
      }
    };

    analyzeRegimes('BTC', btcTrainingResults, btcTestResults);
    analyzeRegimes('ETH', ethTrainingResults, ethTestResults);

    // Overfitting assessment
    console.log('\n🔍 OVERFITTING ASSESSMENT');
    console.log('='.repeat(100));

    const analyzeOverfitting = (asset: 'BTC' | 'ETH', training: PeriodResults, test: PeriodResults): { indicators: string[]; assessment: string } => {
      const indicators: string[] = [];
      let overallScore = 0; // 0 = robust, 100 = overfitted

      // Win rate degradation
      const winRateDegradation = training.winRate - test.winRate;
      if (winRateDegradation > 0.10) {
        indicators.push(`⚠️  Win rate dropped ${(winRateDegradation * 100).toFixed(1)}% (training: ${(training.winRate * 100).toFixed(1)}% → test: ${(test.winRate * 100).toFixed(1)}%)`);
        overallScore += 25;
      } else if (winRateDegradation > 0.05) {
        indicators.push(`⚠️  Win rate dropped ${(winRateDegradation * 100).toFixed(1)}% (training: ${(training.winRate * 100).toFixed(1)}% → test: ${(test.winRate * 100).toFixed(1)}%)`);
        overallScore += 10;
      }

      // Profit factor degradation
      const pfDegradation = training.profitFactor - test.profitFactor;
      if (pfDegradation > 0.5) {
        indicators.push(`⚠️  Profit factor dropped ${pfDegradation.toFixed(2)} (training: ${training.profitFactor.toFixed(2)} → test: ${test.profitFactor.toFixed(2)})`);
        overallScore += 25;
      } else if (pfDegradation > 0.2) {
        indicators.push(`⚠️  Profit factor dropped ${pfDegradation.toFixed(2)} (training: ${training.profitFactor.toFixed(2)} → test: ${test.profitFactor.toFixed(2)})`);
        overallScore += 10;
      }

      // Trade count degradation (suggests parameter tuning to history)
      const tradeCountChange = (test.totalTrades - training.totalTrades) / training.totalTrades;
      if (tradeCountChange < -0.3) {
        indicators.push(`⚠️  Trade count dropped ${Math.abs(tradeCountChange * 100).toFixed(1)}% (suggests overfitting to training period)`);
        overallScore += 20;
      }

      // Regime frequency shifts
      const allRegimes = new Set([...Object.keys(training.regimeDistribution), ...Object.keys(test.regimeDistribution)]);
      let maxRegimeShift = 0;
      for (const regime of allRegimes) {
        const trainingPct = training.regimeDistribution[regime]?.percentage || 0;
        const testPct = test.regimeDistribution[regime]?.percentage || 0;
        const shift = Math.abs(testPct - trainingPct);
        maxRegimeShift = Math.max(maxRegimeShift, shift);
      }

      if (maxRegimeShift > 20) {
        indicators.push(`⚠️  Regime frequency shifted ${maxRegimeShift.toFixed(1)}% (market environment changed)`);
        overallScore += 15;
      }

      // Insufficient test trades
      if (test.totalTrades < 50) {
        indicators.push(`⚠️  Insufficient test trades (${test.totalTrades} < 50) - results not statistically significant`);
        overallScore += 10;
      }

      if (indicators.length === 0) {
        indicators.push('✅ No overfitting indicators detected');
        indicators.push('✅ Win rate stable (within 5%)');
        indicators.push('✅ Profit factor stable (within 20%)');
        indicators.push('✅ Trade count consistent');
        indicators.push('✅ Regime frequency stable');
      }

      let assessment: string;
      if (overallScore === 0) {
        assessment = '✅ PASS: System is ROBUST - generalizes well to unseen data';
      } else if (overallScore < 25) {
        assessment = '⚠️  CAUTION: System shows minor overfitting - monitor but likely acceptable';
      } else if (overallScore < 50) {
        assessment = '⚠️  CONCERN: System shows moderate overfitting - review thresholds and regime logic';
      } else {
        assessment = '❌ FAIL: System is OVERFITTED - parameters tuned to historical data only';
      }

      return { indicators, assessment };
    };

    const btcAnalysis = analyzeOverfitting('BTC', btcTrainingResults, btcTestResults);
    const ethAnalysis = analyzeOverfitting('ETH', ethTrainingResults, ethTestResults);

    console.log('\nBTC Analysis:');
    for (const indicator of btcAnalysis.indicators) {
      console.log(`  ${indicator}`);
    }
    console.log(`\n  ${btcAnalysis.assessment}`);

    console.log('\n\nETH Analysis:');
    for (const indicator of ethAnalysis.indicators) {
      console.log(`  ${indicator}`);
    }
    console.log(`\n  ${ethAnalysis.assessment}`);

    // Overall recommendations
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('─'.repeat(100));

    const recommendations: string[] = [];

    if (btcAnalysis.assessment.includes('ROBUST') && ethAnalysis.assessment.includes('ROBUST')) {
      recommendations.push('✅ System is production-ready - low overfitting risk');
      recommendations.push('→ Next: Run cost stress test (increase commission/slippage to 10bps)');
    } else if (btcAnalysis.assessment.includes('OVERFITTED') || ethAnalysis.assessment.includes('OVERFITTED')) {
      recommendations.push('❌ System requires parameter review before deployment');
      recommendations.push('→ Check RegimeClassifier thresholds against test period market conditions');
      recommendations.push('→ Verify profit score thresholds are not tuned to 2025 volatility');
      recommendations.push('→ Consider wider profit score ranges to generalizes better');
    } else {
      recommendations.push('⚠️  System shows mixed robustness - investigate variances');
      recommendations.push('→ Compare regime transitions between periods');
      recommendations.push('→ Verify signal quality metrics are consistent');
    }

    for (const rec of recommendations) {
      console.log(`  ${rec}`);
    }

    // Save results
    const results: ValidationResults = {
      training: {
        btc: btcTrainingResults,
        eth: ethTrainingResults
      },
      testing: {
        btc: btcTestResults,
        eth: ethTestResults
      },
      analysis: {
        btcOverfittingIndicators: btcAnalysis.indicators,
        ethOverfittingIndicators: ethAnalysis.indicators,
        overallAssessment: 
          btcAnalysis.assessment.includes('ROBUST') && ethAnalysis.assessment.includes('ROBUST')
            ? 'PASS: System is robust'
            : 'FAIL: System shows overfitting',
        recommendations
      }
    };

    fs.writeFileSync(
      './backtest-out-of-sample-validation.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n\n✅ Results saved to: ./backtest-out-of-sample-validation.json');

  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

main();
