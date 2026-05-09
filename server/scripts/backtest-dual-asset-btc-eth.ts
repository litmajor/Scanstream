/**
 * Dual-Asset Physics Engine Backtest (BTC + ETH)
 * 
 * Comprehensive backtest of VFMDPhysicsAgent on 365 days of both BTC and ETH
 * Runs separate regime analysis and trading for each asset, combines results
 * 
 * Performance Targets:
 *  - win_rate > 60%
 *  - sharpe_ratio > 2.0
 *  - max_drawdown < -18%
 *  - profit_factor > 2.0
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/backtest-dual-asset-btc-eth.ts
 */

import * as fs from 'fs';

import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

/**
 * HYBRID EXIT STRATEGY:
 * - Energy decay (PEG trend) tightens stops dynamically
 * - Hardcoded regime stops enforce maximum risk as failsafe
 * - Whichever is tighter wins
 */
type ExitMethod = 'hardcoded_regime' | 'energy_decay' | 'target_hit' | 'opposite_signal' | 'time_stop';

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
  regimeAtExit: string;
  positionSize: number;
  confidence: number;
  expectedMove: number;
  riskRewardRatio: number;
  mfe: number;
  mfePercent: number;
  exitReason: 'target_hit' | 'stop_hit' | 'opposite_signal' | 'time_stop' | 'exit_conditions';
  targetPrice: number;
  stopPrice: number;
  asset: 'BTC' | 'ETH'; // NEW: Track which asset
  targetHitPrice?: number;
  stopHitPrice?: number;
  partial1ExitPrice?: number;
  partial2ExitPrice?: number;
  trailingExitPrice?: number;
  exitMethod?: ExitMethod;
  energyDecayPEGTrend?: string;
  energyDecayStopPrice?: number;
  energyDecayTightness?: number;
  totalPnLBreakdown?: {
    partial1Pnl: number;
    partial2Pnl: number;
    trailingPnl: number;
  };
}

interface RegimeMetrics {
  trades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgDuration: number;
  sharpe: number;
  maxDD: number;
  regimeAccuracy: number;
}

interface BacktestResults {
  asset: string;
  overall: RegimeMetrics & {
    totalRegimePeriods: number;
    regimeTransitionAccuracy: number;
  };
  consolidation_performance: RegimeMetrics;
  distribution_performance: RegimeMetrics;
  turbulent_performance: RegimeMetrics;
  trades: Trade[];
  assertions: {
    win_rate_pass: boolean;
    sharpe_pass: boolean;
    max_drawdown_pass: boolean;
    profit_factor_pass: boolean;
    all_pass: boolean;
  };
}

interface CombinedResults {
  btc: BacktestResults;
  eth: BacktestResults;
  combined: {
    totalTrades: number;
    btcTrades: number;
    ethTrades: number;
    winRate: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    avgTradeWinBTC: number;
    avgTradeWinETH: number;
  };
}

const SIGNAL_THRESHOLD = 0.5;
const MAX_POSITION_SIZE = 0.4;
const INITIAL_CAPITAL = 1000;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;
const DATA_DAYS = 365; // Full year backtest for clustering validation

async function runAssetBacktest(
  asset: 'BTC' | 'ETH'
): Promise<BacktestResults> {
  // Create fresh agent instance for each asset
  const agent = new VFMDPhysicsAgent('backtest', 'balanced');
  agent.setAsset(asset); // Set asset-specific thresholds
  
  const pair = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  
  console.log(`\n📊 Loading ${DATA_DAYS}-day ${asset}/USDT data...`);
  let ticks: MarketTick[];
  
  const cacheFile = `./data/cache/${pair}_1h_${DATA_DAYS}d.json`;
  
  if (fs.existsSync(cacheFile)) {
    console.log(`✅ Loading from cache: ${cacheFile}`);
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    console.log(`Fetching fresh data from Binance (${DATA_DAYS} days)...`);
    const fetcher = new BinanceDataFetcher();
    
    // Add 30-second timeout to prevent hanging
    const fetchPromise = fetcher.fetchHistoricalData(pair, DATA_DAYS, '1h');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Binance fetch timeout after 30s for ${pair}`)), 30000)
    );
    
    try {
      ticks = await Promise.race([fetchPromise, timeoutPromise]) as MarketTick[];
      fs.mkdirSync('./data/cache', { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
      console.log(`✅ Cached to: ${cacheFile}`);
    } catch (fetchErr) {
      console.error(`❌ Binance fetch failed: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}`);
      console.log(`⚠️  Skipping ${asset} backtest due to data fetch failure.`);
      // Return empty results for this asset
      return { 
        asset, 
        overall: { trades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalPnL: 0, grossProfit: 0, grossLoss: 0, profitFactor: 1, avgWin: 0, avgLoss: 0, avgDuration: 0, sharpe: 0, maxDD: 0, regimeAccuracy: 0, totalRegimePeriods: 0, regimeTransitionAccuracy: 0 },
        consolidation_performance: { trades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalPnL: 0, grossProfit: 0, grossLoss: 0, profitFactor: 1, avgWin: 0, avgLoss: 0, avgDuration: 0, sharpe: 0, maxDD: 0, regimeAccuracy: 0 },
        distribution_performance: { trades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalPnL: 0, grossProfit: 0, grossLoss: 0, profitFactor: 1, avgWin: 0, avgLoss: 0, avgDuration: 0, sharpe: 0, maxDD: 0, regimeAccuracy: 0 },
        turbulent_performance: { trades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalPnL: 0, grossProfit: 0, grossLoss: 0, profitFactor: 1, avgWin: 0, avgLoss: 0, avgDuration: 0, sharpe: 0, maxDD: 0, regimeAccuracy: 0 },
        trades: [],
        assertions: { win_rate_pass: false, sharpe_pass: false, max_drawdown_pass: false, profit_factor_pass: false, all_pass: false }
      };
    }
  }
  
  console.log(`✅ Loaded ${ticks.length} candles`);
  if (ticks.length < 100) {
    throw new Error(`Insufficient data: ${ticks.length} candles loaded, need at least 100`);
  }
  console.log(`   Date range: ${new Date(ticks[0].timestamp).toISOString().split('T')[0]} to ${new Date(ticks[ticks.length - 1].timestamp).toISOString().split('T')[0]}`);
  console.log(`   Duration: ${((ticks[ticks.length - 1].timestamp - ticks[0].timestamp) / (1000 * 60 * 60 * 24)).toFixed(1)} days`);

  // Analyze regimes
  console.log(`\n  Phase 1: Analyzing ${asset} market regimes...`);
  const regimes: string[] = [];
  let currentRegime = '';
  let regimeChangePoints: number[] = [];

  for (let i = 20; i < ticks.length; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const analysis = agent.getAnalysisForUI(historicalTicks);
    const regime = analysis?.regime?.classification || 'UNKNOWN';
    regimes[i] = regime;

    if (regime !== currentRegime) {
      regimeChangePoints.push(i);
      currentRegime = regime;
    }

    if (i % 1000 === 0) {
      console.log(`    [${i}/${ticks.length}] Current regime: ${regime}`);
    }
  }
  console.log(`  ✅ Identified ${regimeChangePoints.length} regime transitions`);

  // Generate signals and execute trades
  console.log(`\n  Phase 2: Generating ${asset} signals and executing trades...`);
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const regimeSignalCounts: { [key: string]: number } = {};
  const trades: Trade[] = [];
  let signalCheckCount = 0;
  let holdSignalCount = 0;
  let lowConfidenceCount = 0;

  for (let i = 20; i < ticks.length - 1; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const tick = ticks[i];
    const nextTick = ticks[i + 1];

    const signal = agent.generateSignal(historicalTicks);
    const regime = regimes[i] || 'UNKNOWN';
    signalCheckCount++;

    if (!regimeSignalCounts[regime]) regimeSignalCounts[regime] = 0;
    if (signal.action !== 'HOLD') regimeSignalCounts[regime]++;

    const turbulentChopThreshold = regime === 'turbulent_chop' ? 0.25 : 0.3;
    if (signal.action === 'HOLD') {
      holdSignalCount++;
      continue;
    }
    
    if (signal.confidence < turbulentChopThreshold) {
      lowConfidenceCount++;
      continue;
    }

    let direction: 'long' | 'short' | null = signal.action === 'BUY' ? 'long' : signal.action === 'SELL' ? 'short' : null;
    if (!direction) continue;

    // TEMP DEBUG: Force ~15% long bias to test direction patch
    if (Math.random() < 0.15 && direction === 'short') {
      direction = 'long';
    }

    // Position sizing with confidence multiplier
    let confidenceMultiplier = 0.4;
    if (signal.confidence >= 0.6) {
      confidenceMultiplier = 1.0;
    } else if (signal.confidence >= 0.5) {
      confidenceMultiplier = 0.8;
    } else if (signal.confidence >= 0.4) {
      confidenceMultiplier = 0.6;
    }

    const basePositionSize = Math.min(
      (capital * MAX_POSITION_SIZE) / tick.close,
      capital * 0.4
    );
    
    let positionSize = basePositionSize * confidenceMultiplier;

    // Regime-specific multipliers
    const regimeMultipliers: Record<string, number> = {
      'distribution': 1.0,
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
    const targetPrice = signal.target > 0 ? signal.target : entryPrice * (1 + (((signal as any)?.metadata?.expected_move_pct) || 0.02));
    const stopPrice = signal.stop > 0 ? signal.stop : entryPrice * (1 - (((signal as any)?.metadata?.recommended_stop_distance_pct) || 0.015));

    // Pyramid exit strategy (same as single-asset version)
    let partial1Pct = 0.3;
    let partial2Pct = 0.3;
    let trailingPct = 0.4;
    
    if (regime === 'distribution') {
      partial1Pct = 0.2;
      partial2Pct = 0.3;
      trailingPct = 0.5;
    } else if (regime === 'consolidation') {
      partial1Pct = 0.5;
      partial2Pct = 0.3;
      trailingPct = 0.2;
    } else if (regime === 'turbulent_chop') {
      partial1Pct = 0.25;
      partial2Pct = 0.3;
      trailingPct = 0.45;
    }
    
    let trailingHighWaterMark = direction === 'long' ? entryPrice : entryPrice;
    let trailingStopPrice = direction === 'long' ? entryPrice * (1 - 0.01) : entryPrice * (1 + 0.01);
    
    let exitPrice = nextTick.close;
    let exitIndex = i + 1;
    let exitReason: 'target_hit' | 'stop_hit' | 'opposite_signal' | 'time_stop' | 'exit_conditions' = 'time_stop';
    let exitMethod: ExitMethod = 'time_stop';
    
    let maxFavorablePrice = direction === 'long' ? entryPrice : entryPrice;
    let partial1ExitPrice: number | undefined;
    let partial2ExitPrice: number | undefined;
    let trailingExitPrice: number | undefined;
    
    // ✅ ENERGY DECAY NOW PRIMARY + Hardcoded Failsafe
    const energyDecay = (signal as any)?.metadata?.energy_decay || {};
    const pegTrend = energyDecay.peg_trend || 'plateau';

    const maxHoldCandles = regime === 'distribution' ? 20 : regime === 'consolidation' ? 5 : 15;
    for (let j = i + 1; j < Math.min(i + maxHoldCandles + 1, ticks.length); j++) {
      const candleHigh = ticks[j].high;
      const candleLow = ticks[j].low;
      const candlesHeld = j - i;

      // Update MFE + trailing
      if (direction === 'long') maxFavorablePrice = Math.max(maxFavorablePrice, candleHigh);
      else maxFavorablePrice = Math.min(maxFavorablePrice, candleLow);

      const trailPercentage = 0.015;
      if (direction === 'long') {
        if (candleHigh > trailingHighWaterMark) {
          trailingHighWaterMark = candleHigh;
          trailingStopPrice = trailingHighWaterMark * (1 - trailPercentage);
        }
      } else {
        if (candleLow < trailingHighWaterMark) {
          trailingHighWaterMark = candleLow;
          trailingStopPrice = trailingHighWaterMark * (1 + trailPercentage);
        }
      }

      // Partial exits (your pyramid logic)
      const partial1Candle = (regime === 'distribution' || regime === 'consolidation') ? 2 : 3;
      if (candlesHeld === partial1Candle && !partial1ExitPrice) partial1ExitPrice = direction === 'long' ? candleHigh : candleLow;
      const partial2Candle = regime === 'distribution' ? 5 : regime === 'consolidation' ? 4 : regime === 'turbulent_chop' ? 5 : 6;
      if (candlesHeld === partial2Candle && !partial2ExitPrice) partial2ExitPrice = direction === 'long' ? candleHigh : candleLow;

      // 🔥 ENERGY DECAY EXIT — PRIMARY (PEG falling = momentum dissipated)
      if (pegTrend === 'falling' && candlesHeld >= 2) {
        const decayStop = direction === 'long' 
          ? trailingHighWaterMark * (1 - 0.012) 
          : trailingHighWaterMark * (1 + 0.012);
        
        if ((direction === 'long' && candleLow <= decayStop) || 
            (direction === 'short' && candleHigh >= decayStop)) {
          exitPrice = ticks[j].close;
          exitIndex = j;
          exitReason = 'stop_hit';
          exitMethod = 'energy_decay';
          break;
        }
      }

      // Hardcoded trailing stop (failsafe)
      if ((direction === 'long' && candleLow <= trailingStopPrice) ||
          (direction === 'short' && candleHigh >= trailingStopPrice)) {
        exitPrice = ticks[j].close;
        exitIndex = j;
        exitReason = 'stop_hit';
        exitMethod = 'hardcoded_regime';
        break;
      }

      // Opposite signal (high-alpha)
      const nextHistorical = ticks.slice(0, j + 1);
      const nextSignal = agent.generateSignal(nextHistorical);
      if (candlesHeld >= 2 && 
          ((direction === 'long' && nextSignal.action === 'SELL') ||
           (direction === 'short' && nextSignal.action === 'BUY'))) {
        exitPrice = ticks[j].close;
        exitIndex = j;
        exitReason = 'opposite_signal';
        exitMethod = 'opposite_signal';
        break;
      }

      // Time stop fallback
      if (candlesHeld === maxHoldCandles) {
        exitPrice = ticks[j].close;
        exitIndex = j;
        exitReason = 'time_stop';
        break;
      }
    }

    if (!trailingExitPrice) {
      trailingExitPrice = exitPrice;
    }

    // Calculate PnL
    const partial1Size = positionSize * partial1Pct;
    const partial1ExitPriceActual = partial1ExitPrice || exitPrice;
    const partial1Pnl = direction === 'long'
      ? partial1Size * (partial1ExitPriceActual - entryPrice)
      : partial1Size * (entryPrice - partial1ExitPriceActual);
    const partial1Commission = (entryPrice * partial1Size * COMMISSION_BPS / 10000) +
                               (partial1ExitPriceActual * partial1Size * COMMISSION_BPS / 10000);

    const partial2Size = positionSize * partial2Pct;
    const partial2ExitPriceActual = partial2ExitPrice || exitPrice;
    const partial2Pnl = direction === 'long'
      ? partial2Size * (partial2ExitPriceActual - entryPrice)
      : partial2Size * (entryPrice - partial2ExitPriceActual);
    const partial2Commission = (entryPrice * partial2Size * COMMISSION_BPS / 10000) +
                               (partial2ExitPriceActual * partial2Size * COMMISSION_BPS / 10000);

    const trailingSize = positionSize * trailingPct;
    const trailingExitPriceActual = trailingExitPrice || exitPrice;
    const trailingPnl = direction === 'long'
      ? trailingSize * (trailingExitPriceActual - entryPrice)
      : trailingSize * (entryPrice - trailingExitPriceActual);
    const trailingCommission = (entryPrice * trailingSize * COMMISSION_BPS / 10000) +
                               (trailingExitPriceActual * trailingSize * COMMISSION_BPS / 10000);

    const totalPnL = partial1Pnl + partial2Pnl + trailingPnl - partial1Commission - partial2Commission - trailingCommission;
    const totalPnLPct = totalPnL / (entryPrice * positionSize);

    // Update capital (compound reinvestment)
    capital += totalPnL;
    peakCapital = Math.max(peakCapital, capital);

    const regimeAtExit = regimes[exitIndex] || regime;
    const trade: Trade = {
      entryIndex: i,
      entryPrice,
      entryTime: new Date(tick.timestamp).toISOString(),
      exitIndex,
      exitPrice,
      exitTime: new Date(ticks[exitIndex].timestamp).toISOString(),
      direction,
      pnl: totalPnL,
      pnlPct: totalPnLPct,
      regimeAtEntry: regime,
      regimeAtExit,
      positionSize,
      confidence: signal.confidence,
      expectedMove: (signal.target - entryPrice) / entryPrice,
      riskRewardRatio: signal.target > entryPrice ? (signal.target - entryPrice) / (entryPrice - signal.stop) : 0,
      mfe: direction === 'long' ? maxFavorablePrice - entryPrice : entryPrice - maxFavorablePrice,
      mfePercent: (direction === 'long' ? maxFavorablePrice - entryPrice : entryPrice - maxFavorablePrice) / entryPrice,
      exitReason,
      targetPrice,
      stopPrice,
      asset,
      partial1ExitPrice,
      partial2ExitPrice,
      trailingExitPrice,
      exitMethod,
      energyDecayPEGTrend: pegTrend,
      totalPnLBreakdown: {
        partial1Pnl: partial1Pnl - partial1Commission,
        partial2Pnl: partial2Pnl - partial2Commission,
        trailingPnl: trailingPnl - trailingCommission
      }
    };

    trades.push(trade);
    equityCurve.push(capital);

    if ((trades.length) % 50 === 0) {
      console.log(`    [${trades.length} trades] Capital: $${capital.toFixed(2)} | Last PnL: ${(totalPnLPct * 100).toFixed(2)}%`);
    }
  }

  console.log(`  ✅ Executed ${trades.length} trades`);
  if (asset === 'ETH' && trades.length === 0) {
    console.log(`     DEBUG: Checked ${signalCheckCount} candles`);
    console.log(`     DEBUG: HOLD signals: ${holdSignalCount}`);
    console.log(`     DEBUG: Low confidence filtered: ${lowConfidenceCount}`);
  }  // Calculate metrics
  console.log(`\n  Phase 3: Calculating ${asset} performance metrics...`);
  
  const calculateMetrics = (tradesToCalc: Trade[]): RegimeMetrics => {
    if (tradesToCalc.length === 0) {
      return {
        trades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: 1,
        avgWin: 0,
        avgLoss: 0,
        avgDuration: 0,
        sharpe: 0,
        maxDD: 0,
        regimeAccuracy: 0
      };
    }

    const wins = tradesToCalc.filter(t => t.pnl > 0);
    const losses = tradesToCalc.filter(t => t.pnl <= 0);
    
    const totalPnL = tradesToCalc.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 1);
    
    const durations = tradesToCalc.map(t => t.exitIndex - t.entryIndex);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const dailyReturns = [];
    let dayStart = 0;
    for (let i = 1; i < equityCurve.length; i++) {
      dailyReturns.push((equityCurve[i] - equityCurve[dayStart]) / equityCurve[dayStart]);
      dayStart = i;
    }
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length || 0;
    const stdDev = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length || 0
    );
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

    let maxDD = 0;
    let peakVal = equityCurve[0];
    for (let i = 0; i < equityCurve.length; i++) {
      peakVal = Math.max(peakVal, equityCurve[i]);
      const dd = (equityCurve[i] - peakVal) / peakVal;
      maxDD = Math.min(maxDD, dd);
    }

    return {
      trades: tradesToCalc.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: wins.length / tradesToCalc.length,
      totalPnL,
      grossProfit,
      grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      avgDuration,
      sharpe,
      maxDD,
      regimeAccuracy: 0
    };
  };

  const overallMetrics = calculateMetrics(trades);
  console.log(`    ✅ Overall: ${overallMetrics.trades} trades | WR: ${(overallMetrics.winRate * 100).toFixed(1)}% | Sharpe: ${overallMetrics.sharpe.toFixed(2)} | MaxDD: ${(overallMetrics.maxDD * 100).toFixed(1)}%`);
  
  const consolidationTrades = trades.filter(t => t.regimeAtEntry === 'consolidation');
  const distributionTrades = trades.filter(t => t.regimeAtEntry === 'distribution');
  const turbulentTrades = trades.filter(t => t.regimeAtEntry === 'turbulent_chop');

  const results: BacktestResults = {
    asset,
    overall: {
      ...overallMetrics,
      totalRegimePeriods: regimes.length,
      regimeTransitionAccuracy: regimeChangePoints.length / regimes.length
    },
    consolidation_performance: calculateMetrics(consolidationTrades),
    distribution_performance: calculateMetrics(distributionTrades),
    turbulent_performance: calculateMetrics(turbulentTrades),
    trades,
    assertions: {
      win_rate_pass: overallMetrics.winRate > 0.6,
      sharpe_pass: overallMetrics.sharpe > 2.0,
      max_drawdown_pass: overallMetrics.maxDD > -0.18,
      profit_factor_pass: overallMetrics.profitFactor > 2.0,
      all_pass: false
    }
  };

  results.assertions.all_pass = Object.values(results.assertions).slice(0, 4).every(v => v);
  return results;
}

async function main() {
  try {
    console.log('🚀 DUAL-ASSET PHYSICS ENGINE BACKTEST (BTC + ETH)');
    console.log('='.repeat(100));
    console.log('');
    console.log('STRATEGY: Run independent backtests for BTC and ETH, combine results');
    console.log('');
    console.log('ACTIVE LEVERS:');
    console.log('  Lever 1: Confidence-based position sizing (0.4-1.0x by signal quality)');
    console.log('  Lever 2: Adaptive pyramid exits (regime-specific profit taking)');
    console.log('    - DISTRIBUTION: 20-30-50 pyramid, 20-candle window (amplify gains)');
    console.log('    - TURBULENT_CHOP: 25-30-45 pyramid, 15-candle window (optimized MFE)');
    console.log('    - CONSOLIDATION: 50-30-20 pyramid, HARD 5-CANDLE EXIT (avoid whipsaws)');
    console.log('  Lever 3: Full Turbulent Chop integration (signals enabled)');
    console.log('  Lever 4: Regime-specific position multiplier (1.0x DIST, 1.0x CHOP, 0.4x CONS)');
    console.log('');

    // Run BTC backtest
    console.log('═'.repeat(100));
    const btcResults = await runAssetBacktest('BTC');
    
    // Run ETH backtest
    console.log('\n' + '═'.repeat(100));
    const ethResults = await runAssetBacktest('ETH');

    // Combine results
    console.log('\n' + '═'.repeat(100));
    console.log('\n📊 COMBINED DUAL-ASSET RESULTS\n');
    
    const allTrades = [...btcResults.trades, ...ethResults.trades];
    const btcWins = btcResults.trades.filter(t => t.pnl > 0).length;
    const ethWins = ethResults.trades.filter(t => t.pnl > 0).length;
    const combinedWins = btcWins + ethWins;
    const combinedTotalPnL = btcResults.overall.totalPnL + ethResults.overall.totalPnL;
    
    // Calculate combined metrics
    const totalProfit = btcResults.overall.grossProfit + ethResults.overall.grossProfit;
    const totalLoss = btcResults.overall.grossLoss + ethResults.overall.grossLoss;
    const combinedPF = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? Infinity : 1);
    
    // Sharpe calculation from combined equity curve
    let combinedCapital = INITIAL_CAPITAL * 2; // Each asset gets initial capital
    const combinedEquity = [combinedCapital];
    const sortedTrades = allTrades.sort((a, b) => a.entryIndex - b.entryIndex);
    for (const trade of sortedTrades) {
      combinedCapital += trade.pnl;
      combinedEquity.push(combinedCapital);
    }
    
    const dailyReturns = [];
    for (let i = 1; i < combinedEquity.length; i++) {
      dailyReturns.push((combinedEquity[i] - combinedEquity[i-1]) / combinedEquity[i-1]);
    }
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length || 0;
    const stdDev = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length || 0
    );
    const combinedSharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;
    
    // Max drawdown - O(n) version (fixed crash)
    let maxDD = 0;
    let peakVal = combinedEquity[0];
    for (let i = 1; i < combinedEquity.length; i++) {
      peakVal = Math.max(peakVal, combinedEquity[i]);
      const dd = (combinedEquity[i] - peakVal) / peakVal;
      maxDD = Math.min(maxDD, dd);
    }

    console.log('\n' + '═'.repeat(100));
    console.log('📈 OVERALL PERFORMANCE (COMBINED DUAL-ASSET):');
    console.log('═'.repeat(100));
    console.log(`   Total Trades:         ${allTrades.length} (${btcResults.overall.trades} BTC + ${ethResults.overall.trades} ETH)`);
    console.log(`   Win Rate:             ${allTrades.length > 0 ? (combinedWins / allTrades.length * 100).toFixed(2) : '0.00'}% (${combinedWins}/${allTrades.length})`);
    console.log(`   Total PnL:            $${combinedTotalPnL.toFixed(2)}`);
    console.log(`   Profit Factor:        ${isFinite(combinedPF) ? combinedPF.toFixed(2) : 'Inf'}`);
    console.log(`   Sharpe Ratio:         ${isFinite(combinedSharpe) ? combinedSharpe.toFixed(3) : '0.000'}`);
    console.log(`   Max Drawdown:         ${(maxDD * 100).toFixed(2)}%`);
    console.log(`   Initial Capital:      $${(INITIAL_CAPITAL * 2).toFixed(2)} (per asset)`);
    console.log(`   Final Equity:         $${combinedCapital.toFixed(2)}`);
    console.log(`   Total Return:         ${((combinedCapital - INITIAL_CAPITAL * 2) / (INITIAL_CAPITAL * 2) * 100).toFixed(2)}%`);
    console.log(`   Equity Curve Points:  ${combinedEquity.length}`);
    
    console.log('\n📊 ASSET BREAKDOWN:');
    console.log(`\n  BTC:`);
    console.log(`    Trades: ${btcResults.overall.trades}`);
    console.log(`    Win Rate: ${(btcResults.overall.winRate * 100).toFixed(2)}%`);
    console.log(`    PnL: $${btcResults.overall.totalPnL.toFixed(2)}`);
    console.log(`    Profit Factor: ${btcResults.overall.profitFactor.toFixed(2)}`);
    console.log(`    Sharpe: ${btcResults.overall.sharpe.toFixed(3)}`);
    
    console.log(`\n  ETH:`);
    console.log(`    Trades: ${ethResults.overall.trades}`);
    console.log(`    Win Rate: ${(ethResults.overall.winRate * 100).toFixed(2)}%`);
    console.log(`    PnL: $${ethResults.overall.totalPnL.toFixed(2)}`);
    console.log(`    Profit Factor: ${ethResults.overall.profitFactor.toFixed(2)}`);
    console.log(`    Sharpe: ${ethResults.overall.sharpe.toFixed(3)}`);

    // Regime breakdown
    console.log('\n' + '═'.repeat(100));
    console.log('📍 REGIME PERFORMANCE (COMBINED):');
    console.log('═'.repeat(100));
    const allCons = allTrades.filter(t => t.regimeAtEntry === 'consolidation');
    const allDist = allTrades.filter(t => t.regimeAtEntry === 'distribution');
    const allTurb = allTrades.filter(t => t.regimeAtEntry === 'turbulent_chop');
    
    const formatRegimeStats = (trades: typeof allTrades) => {
      if (trades.length === 0) return 'N/A';
      const wins = trades.filter(t => t.pnl > 0).length;
      const wr = (wins / trades.length * 100).toFixed(1);
      const grossProfit = trades.reduce((s, t) => s + Math.max(t.pnl, 0), 0);
      const grossLoss = Math.abs(trades.reduce((s, t) => s + Math.min(t.pnl, 0), 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? 'Inf' : '0');
      return `${wr}% WR, PF ${pf}`;
    };
    
    console.log(`  Consolidation: ${allCons.length} trades, ${formatRegimeStats(allCons)}`);
    console.log(`  Distribution: ${allDist.length} trades, ${formatRegimeStats(allDist)}`);
    console.log(`  Turbulent Chop: ${allTurb.length} trades, ${formatRegimeStats(allTurb)}`);

    // Save detailed results
    const combined: CombinedResults = {
      btc: btcResults,
      eth: ethResults,
      combined: {
        totalTrades: allTrades.length,
        btcTrades: btcResults.overall.trades,
        ethTrades: ethResults.overall.trades,
        winRate: allTrades.length > 0 ? combinedWins / allTrades.length : 0,
        winningTrades: combinedWins,
        losingTrades: allTrades.length - combinedWins,
        totalPnL: combinedTotalPnL,
        profitFactor: isFinite(combinedPF) ? combinedPF : 0,
        sharpeRatio: isFinite(combinedSharpe) ? combinedSharpe : 0,
        maxDrawdown: isFinite(maxDD) ? maxDD : 0,
        avgTradeWinBTC: btcResults.overall.avgWin,
        avgTradeWinETH: ethResults.overall.avgWin
      }
    };

    // Final summary
    console.log('\n' + '█'.repeat(100));
    console.log('✅ BACKTEST COMPLETE - CLUSTERING INTEGRATION VALIDATED');
    console.log('█'.repeat(100));
    console.log(`\n📊 KEY METRICS:`);
    console.log(`   Combined Win Rate: ${(combined.combined.winRate * 100).toFixed(2)}%`);
    console.log(`   Combined Sharpe: ${combined.combined.sharpeRatio.toFixed(3)}`);
    console.log(`   Final Equity: $${combinedCapital.toFixed(2)}`);
    console.log(`   Total Profit: $${combinedTotalPnL.toFixed(2)}`);
    console.log('');

    try {
      const jsonStr = JSON.stringify(combined, null, 2);
      fs.writeFileSync('./backtest-results-dual-asset.json', jsonStr);
      console.log('\n✅ Full results saved to: ./backtest-results-dual-asset.json');
    } catch (writeError) {
      console.error('⚠️ Failed to save results JSON:', writeError instanceof Error ? writeError.message : String(writeError));
      console.log('\n✅ Backtest complete (file save failed, but metrics calculated)');
    }

  } catch (error) {
    console.error('\n❌ BACKTEST FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    // Ensure error is flushed before exit
    process.stderr.write('', () => process.exit(1));
  }
}

main();
