/**
 * Enhanced Gradient Trend Analysis - v2
 * 
 * Three Key Enhancements:
 * 1. Gradient Strength Tracking: Momentum/acceleration of trend (not just direction)
 * 2. Band Reversal Correlation: When gradient switches, track price movement from bands
 * 3. Intelligent Trend Following: Follow trends based on band dynamics + gradient switches
 * 
 * Concepts:
 * - Gradient = Rate of change of price (color: red=bearish, green=bullish)
 * - Gradient Strength = Acceleration/momentum of the gradient itself
 * - Bands = Support/resistance zones that price gravitates toward
 * - Reversal Trigger = When gradient switches from one direction to another
 */

import * as fs from 'fs';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

interface GradientMetrics {
  // Direction: 1=BULLISH, -1=BEARISH, 0=NEUTRAL
  direction: number;
  
  // Gradient strength (0-100): Speed of price change
  // High = rapid price movement, Low = slow/consolidating
  strength: number;
  
  // Gradient acceleration (0-100): Speed of change in the gradient itself
  // Positive = trend strengthening, Negative = trend weakening
  acceleration: number;
  
  // Momentum score (0-100): Composite strength + acceleration
  momentum: number;
  
  // Price position relative to bands
  priceAboveMid: boolean;
  distanceFromUpper: number; // % distance from upper band
  distanceFromLower: number; // % distance from lower band
}

interface BandMetrics {
  upper: number;
  mid: number;
  lower: number;
  bandwidth: number; // upper - lower
}

interface TrendSwitch {
  index: number;
  direction: number; // 1=to bullish, -1=to bearish
  strength: number;
  maxPriceMove: number; // Max distance price moved after switch
  touchedBand: boolean; // Did price touch band after switch?
  timeToReverse: number; // Candles until reversal
}

// Calculate Bollinger Band style bands
function calculateBands(prices: number[], period: number = 20, stdDev: number = 2): BandMetrics {
  if (prices.length < period) {
    const mid = prices[prices.length - 1];
    return {
      upper: mid * 1.02,
      mid: mid,
      lower: mid * 0.98,
      bandwidth: mid * 0.04
    };
  }

  const lookback = prices.slice(-period);
  const mid = lookback.reduce((a, b) => a + b, 0) / period;
  
  const variance = lookback.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: mid + (std * stdDev),
    mid: mid,
    lower: mid - (std * stdDev),
    bandwidth: std * stdDev * 2
  };
}

// Calculate gradient metrics including strength and acceleration
function calculateGradientMetrics(prices: number[], period: number): GradientMetrics {
  if (prices.length < period + 5) {
    return {
      direction: 0,
      strength: 0,
      acceleration: 0,
      momentum: 0,
      priceAboveMid: false,
      distanceFromUpper: 0,
      distanceFromLower: 0
    };
  }

  // Calculate gradient (rate of change)
  const lookback = prices.slice(-period);
  let gradients: number[] = [];
  for (let i = 1; i < lookback.length; i++) {
    const change = (lookback[i] - lookback[i - 1]) / lookback[i - 1];
    gradients.push(change);
  }

  // Average gradient = direction
  const avgGradient = gradients.reduce((a, b) => a + b, 0) / gradients.length;
  const direction = avgGradient > 0.001 ? 1 : (avgGradient < -0.001 ? -1 : 0);

  // Gradient strength = magnitude of average change
  const strength = Math.min(100, Math.abs(avgGradient) * 1000);

  // Gradient acceleration = change in gradient itself
  let accelerations: number[] = [];
  for (let i = 1; i < gradients.length; i++) {
    const accel = gradients[i] - gradients[i - 1];
    accelerations.push(accel);
  }
  const avgAcceleration = accelerations.length > 0
    ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
    : 0;
  
  // Normalize acceleration (-100 to +100)
  const acceleration = Math.min(100, Math.max(-100, avgAcceleration * 10000));

  // Momentum score: blend strength + acceleration
  // Strong trend + strengthening = high momentum
  // Strong trend + weakening = medium momentum
  // Weak trend + any = low momentum
  const momentum = Math.max(0, (strength * 0.6) + (acceleration * 0.4));

  // Calculate bands for price position
  const bands = calculateBands(prices, 20);
  const currentPrice = prices[prices.length - 1];
  
  const distanceFromUpper = Math.max(0, (bands.upper - currentPrice) / currentPrice * 100);
  const distanceFromLower = Math.max(0, (currentPrice - bands.lower) / currentPrice * 100);
  const priceAboveMid = currentPrice > bands.mid;

  return {
    direction,
    strength,
    acceleration,
    momentum,
    priceAboveMid,
    distanceFromUpper,
    distanceFromLower
  };
}

// Detect when gradient direction changes meaningfully
function detectGradientSwitches(
  prices: number[],
  period: number,
  window: number = 5
): TrendSwitch[] {
  const switches: TrendSwitch[] = [];
  
  if (prices.length < period + window) return switches;

  let lastSwitchIndex = -100; // Prevent duplicate switches too close together

  for (let i = period + 5; i < prices.length - 1; i++) {
    if (i - lastSwitchIndex < 10) continue; // Minimum 10 candles between switches
    
    const prevMetrics = calculateGradientMetrics(prices.slice(0, i), period);
    const currMetrics = calculateGradientMetrics(prices.slice(0, i + 1), period);
    
    // Detect meaningful switch:
    // 1. Direction changed (bullish <-> bearish)
    // 2. Both have significant strength (>20)
    const directionChanged = prevMetrics.direction !== 0 && currMetrics.direction !== 0 && prevMetrics.direction !== currMetrics.direction;
    const bothStrong = prevMetrics.strength > 20 && currMetrics.strength > 20;
    
    if (directionChanged && bothStrong) {
      const switchDir = currMetrics.direction > prevMetrics.direction ? 1 : -1;
      lastSwitchIndex = i;
      
      // Track max price movement after switch and time to reversal
      let maxMove = 0;
      let touched = false;
      let timeToReverse = 0;
      const bands = calculateBands(prices.slice(0, i + 1), 20);
      
      for (let j = i + 1; j < Math.min(i + window, prices.length); j++) {
        const move = Math.abs((prices[j] - prices[i]) / prices[i] * 100);
        maxMove = Math.max(maxMove, move);
        
        // Check if price touched band
        if (switchDir === 1 && prices[j] >= bands.upper) touched = true;
        if (switchDir === -1 && prices[j] <= bands.lower) touched = true;
        
        // Track time to reversal
        if (j === i + 1) timeToReverse = 1;
      }
      
      switches.push({
        index: i,
        direction: switchDir,
        strength: currMetrics.strength,
        maxPriceMove: maxMove,
        touchedBand: touched,
        timeToReverse: timeToReverse
      });
    }
  }
  
  return switches;
}

interface Trade {
  index: number;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  direction: 'long' | 'short';
  pnl: number;
  pnl_percent: number;
  win: boolean;
  hold_hours: number;
  reason: string;
  gradient_strength: number;
  gradient_momentum: number;
}

async function runBacktest(asset: 'BTC' | 'ETH'): Promise<any> {
  const pair = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';

  console.log(`\n📊 Loading ${DATA_DAYS}-day ${asset}/USDT data...`);
  let ticks: MarketTick[];

  const cacheFile = `./data/cache/${pair}_1h_${DATA_DAYS}d.json`;
  if (!fs.existsSync(cacheFile)) {
    throw new Error(`Cache file not found: ${cacheFile}`);
  }

  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);

  console.log(`✅ Loaded ${ticks.length} candles`);
  const prices = ticks.map(t => t.close);

  // First pass: Analyze gradient switches to understand the strategy
  console.log(`\n🔍 Analyzing gradient switch behavior...`);
  const switches = detectGradientSwitches(prices, 25);
  console.log(`   Found ${switches.length} gradient switches`);
  
  // Analyze switch quality
  const switchesWithBandTouch = switches.filter(s => s.touchedBand).length;
  const avgMaxMove = switches.length > 0
    ? switches.reduce((sum, s) => sum + s.maxPriceMove, 0) / switches.length
    : 0;
  
  console.log(`   Band touches after switch: ${switchesWithBandTouch}/${switches.length} (${(switchesWithBandTouch/switches.length*100).toFixed(1)}%)`);
  console.log(`   Avg max price move after switch: ${avgMaxMove.toFixed(2)}%`);

  // Trading variables
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const trades: Trade[] = [];
  let switchesTraded = 0;

  console.log(`\n⚙️  Executing Enhanced Gradient Trend backtest...`);

  // If few/no switches found, use gradient strength + momentum directly
  const useDirectSignals = switches.length < 10;
  
  if (useDirectSignals) {
    console.log(`   ⚠️  Low switch count (${switches.length}), using gradient strength signals...`);
  }

  for (let i = 120; i < ticks.length - 50; i++) {
    const tick = ticks[i];
    const recentPrices = prices.slice(0, i + 1);

    // Calculate gradient metrics
    const metrics1h = calculateGradientMetrics(recentPrices, 25);   // 1-hour trend
    const metrics4h = calculateGradientMetrics(recentPrices, 100);  // 4-hour trend
    
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let reason = '';

    if (useDirectSignals) {
      // Direct gradient signal: strong momentum + direction
      if (metrics1h.direction === 1 && metrics1h.momentum > 40) {
        signal = 'BUY';
        reason = 'gradient_bullish_momentum';
      } else if (metrics1h.direction === -1 && metrics1h.momentum > 40) {
        signal = 'SELL';
        reason = 'gradient_bearish_momentum';
      }
    } else {
      // Switch-based signal: entry on detected gradient switches
      const isSwitch = switches.some(s => s.index === i && s.direction !== 0);
      if (isSwitch) {
        const switchData = switches.find(s => s.index === i);
        if (switchData) {
          signal = switchData.direction > 0 ? 'BUY' : 'SELL';
          reason = `gradient_switch_${switchData.direction > 0 ? 'bullish' : 'bearish'}`;
        }
      }
    }

    if (signal === 'HOLD') {
      continue;
    }

    const direction = signal === 'BUY' ? 'long' : 'short';

    // Position sizing: Based on momentum and band proximity
    const momentumMultiplier = Math.min(1.0, metrics1h.momentum / 100);
    const bandProximityMultiplier = 0.7 + (1 - metrics1h.distanceFromUpper * 0.01) * 0.3;
    const positionMultiplier = momentumMultiplier * bandProximityMultiplier;
    const positionSize = capital * 0.05 * positionMultiplier;

    const entryPrice = tick.close;
    const shares = positionSize / entryPrice;

    // Apply slippage and commission
    const slippage = entryPrice * (SLIPPAGE_BPS / 10000);
    const actualEntryPrice = direction === 'long' ? entryPrice + slippage : entryPrice - slippage;
    const entryCommission = shares * actualEntryPrice * (COMMISSION_BPS / 10000);

    // Exit logic: Wait for next gradient switch or band touch
    let exitPrice = tick.close;
    let exitIndex = i + 1;
    let exitReason = 'timeout';
    const maxHoldCandles = 60;
    const bands = calculateBands(recentPrices, 20);

    for (let j = i + 1; j < Math.min(i + maxHoldCandles, ticks.length); j++) {
      const checkTick = ticks[j];
      const checkPrices = prices.slice(0, j + 1);
      const checkMetrics = calculateGradientMetrics(checkPrices, 25);

      // Exit 1: Gradient reversal
      if (checkMetrics.direction !== metrics1h.direction && checkMetrics.direction !== 0) {
        exitPrice = checkTick.close;
        exitIndex = j;
        exitReason = 'gradient_reversal';
        break;
      }

      // Exit 2: Price touched opposite band
      if (direction === 'long' && checkTick.low <= bands.lower) {
        exitPrice = bands.lower;
        exitIndex = j;
        exitReason = 'lower_band_touch';
        break;
      }
      if (direction === 'short' && checkTick.high >= bands.upper) {
        exitPrice = bands.upper;
        exitIndex = j;
        exitReason = 'upper_band_touch';
        break;
      }

      // Exit 3: Hard stop-loss (3%)
      if (direction === 'long' && checkTick.low <= entryPrice * 0.97) {
        exitPrice = entryPrice * 0.97;
        exitIndex = j;
        exitReason = 'stop_loss';
        break;
      }
      if (direction === 'short' && checkTick.high >= entryPrice * 1.03) {
        exitPrice = entryPrice * 1.03;
        exitIndex = j;
        exitReason = 'stop_loss';
        break;
      }

      // Exit 4: Momentum decay (gradient strength drops below 15)
      if (checkMetrics.strength < 15) {
        exitPrice = checkTick.close;
        exitIndex = j;
        exitReason = 'momentum_decay';
        break;
      }
    }

    // Apply slippage on exit
    const exitSlippage = exitPrice * (SLIPPAGE_BPS / 10000);
    const actualExitPrice = direction === 'long' ? exitPrice - exitSlippage : exitPrice + exitSlippage;
    const exitCommission = shares * actualExitPrice * (COMMISSION_BPS / 10000);

    // Calculate PnL
    let tradePnL: number;
    if (direction === 'long') {
      tradePnL = shares * (actualExitPrice - actualEntryPrice) - entryCommission - exitCommission;
    } else {
      tradePnL = shares * (actualEntryPrice - actualExitPrice) - entryCommission - exitCommission;
    }

    const tradePnLPercent = (tradePnL / positionSize) * 100;
    const holdHours = exitIndex - i;

    // Update capital
    capital += tradePnL;
    peakCapital = Math.max(peakCapital, capital);
    equityCurve.push(capital);

    // Record trade
    trades.push({
      index: i,
      entry_time: String(tick.timestamp),
      exit_time: String(ticks[exitIndex].timestamp),
      entry_price: entryPrice,
      exit_price: exitPrice,
      direction,
      pnl: tradePnL,
      pnl_percent: tradePnLPercent,
      win: tradePnL > 0,
      hold_hours: holdHours,
      reason: exitReason,
      gradient_strength: metrics1h.strength,
      gradient_momentum: metrics1h.momentum
    });

    switchesTraded++;

    // Progress indicator every 20 trades
    if (switchesTraded % 20 === 0) {
      console.log(`    [${switchesTraded} trades] Capital: $${capital.toFixed(2)} | Momentum Avg: ${(trades.slice(-20).reduce((sum, t) => sum + t.gradient_momentum, 0) / 20).toFixed(1)}`);
    }
  }

  console.log(`\n✅ Executed ${switchesTraded} gradient switch trades`);

  // Calculate metrics
  const winningTrades = trades.filter(t => t.win).length;
  const losingTrades = trades.filter(t => !t.win).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  const avgWin = trades.filter(t => t.win).length > 0
    ? trades.filter(t => t.win).reduce((sum, t) => sum + t.pnl, 0) / winningTrades
    : 0;

  const avgLoss = trades.filter(t => !t.win).length > 0
    ? Math.abs(trades.filter(t => !t.win).reduce((sum, t) => sum + t.pnl, 0) / losingTrades)
    : 0;

  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999 : 0);
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnLPercent = (totalPnL / INITIAL_CAPITAL) * 100;

  // Sharpe Ratio
  const returns = equityCurve.map((equity, i) => i === 0 ? 0 : (equity - equityCurve[i - 1]) / equityCurve[i - 1]);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Max Drawdown
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const peak = Math.max(...equityCurve.slice(0, i + 1));
    const dd = ((equityCurve[i] - peak) / peak) * 100;
    maxDD = Math.min(maxDD, dd);
  }

  const avgMomentum = trades.reduce((sum, t) => sum + t.gradient_momentum, 0) / (trades.length || 1);

  // Exit reason distribution
  const exitReasons = trades.reduce((acc: Record<string, number>, t) => {
    acc[t.reason] = (acc[t.reason] || 0) + 1;
    return acc;
  }, {});

  return {
    asset,
    trades,
    total_trades: trades.length,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    win_rate: winRate,
    avg_win: avgWin,
    avg_loss: avgLoss,
    profit_factor: profitFactor,
    total_pnl: totalPnL,
    total_pnl_percent: totalPnLPercent,
    sharpe_ratio: sharpeRatio,
    max_drawdown: maxDD,
    final_capital: capital,
    avg_momentum: avgMomentum,
    gradient_switches_found: switches.length,
    switches_with_band_touch: switchesWithBandTouch,
    avg_move_after_switch: avgMaxMove,
    exit_reasons: exitReasons,
    equity_curve: equityCurve
  };
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Enhanced Gradient Trend Analysis - v2 (365 Day Backtest)     ║');
    console.log('║  with Band Dynamics & Intelligent Trend Following            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // Run BTC backtest
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ BTC/USDT BACKTEST                                               │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    const btcResults = await runBacktest('BTC');

    // Run ETH backtest
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ ETH/USDT BACKTEST                                               │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    const ethResults = await runBacktest('ETH');

    // Print results
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║        ENHANCED GRADIENT TREND ANALYSIS RESULTS SUMMARY        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // BTC Results
    console.log('\n📊 BTC PERFORMANCE:');
    console.log(`   Gradient Switches Found: ${btcResults.gradient_switches_found}`);
    console.log(`   Band Touches After Switch: ${btcResults.switches_with_band_touch}/${btcResults.gradient_switches_found} (${(btcResults.switches_with_band_touch/btcResults.gradient_switches_found*100).toFixed(1)}%)`);
    console.log(`   Avg Price Move After Switch: ${btcResults.avg_move_after_switch.toFixed(2)}%`);
    console.log(`   Trades Executed: ${btcResults.total_trades}`);
    console.log(`   Win Rate: ${btcResults.win_rate.toFixed(2)}%`);
    console.log(`   PnL: $${btcResults.total_pnl.toFixed(2)} (${btcResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${btcResults.profit_factor.toFixed(2)}`);
    console.log(`   Sharpe Ratio: ${btcResults.sharpe_ratio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${btcResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${btcResults.final_capital.toFixed(2)}`);
    console.log(`   Exit Reasons:`, btcResults.exit_reasons);

    // ETH Results
    console.log('\n📊 ETH PERFORMANCE:');
    console.log(`   Gradient Switches Found: ${ethResults.gradient_switches_found}`);
    console.log(`   Band Touches After Switch: ${ethResults.switches_with_band_touch}/${ethResults.gradient_switches_found} (${(ethResults.switches_with_band_touch/ethResults.gradient_switches_found*100).toFixed(1)}%)`);
    console.log(`   Avg Price Move After Switch: ${ethResults.avg_move_after_switch.toFixed(2)}%`);
    console.log(`   Trades Executed: ${ethResults.total_trades}`);
    console.log(`   Win Rate: ${ethResults.win_rate.toFixed(2)}%`);
    console.log(`   PnL: $${ethResults.total_pnl.toFixed(2)} (${ethResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${ethResults.profit_factor.toFixed(2)}`);
    console.log(`   Sharpe Ratio: ${ethResults.sharpe_ratio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${ethResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${ethResults.final_capital.toFixed(2)}`);
    console.log(`   Exit Reasons:`, ethResults.exit_reasons);

    // Combined Results
    const combinedTrades = btcResults.total_trades + ethResults.total_trades;
    const combinedWins = btcResults.winning_trades + ethResults.winning_trades;
    const combinedPnL = btcResults.total_pnl + ethResults.total_pnl;
    const combinedCapital = btcResults.final_capital + ethResults.final_capital;
    const combinedWR = combinedTrades > 0 ? (combinedWins / combinedTrades) * 100 : 0;

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 COMBINED RESULTS:');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`   Total Trades: ${combinedTrades}`);
    console.log(`   Combined Win Rate: ${combinedWR.toFixed(2)}%`);
    console.log(`   Combined PnL: $${combinedPnL.toFixed(2)}`);
    console.log(`   Combined Final Capital: $${combinedCapital.toFixed(2)}`);

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      btc: btcResults,
      eth: ethResults,
      combined: {
        total_trades: combinedTrades,
        combined_wr: combinedWR,
        combined_pnl: combinedPnL,
        combined_capital: combinedCapital
      },
      key_findings: {
        gradient_as_trend_direction: 'Green (bullish) or Red (bearish) - direction only',
        gradient_strength_meaning: 'Momentum/acceleration of the gradient itself (0-100 scale)',
        band_reversal_concept: `When gradient switches, price moves average ${btcResults.avg_move_after_switch.toFixed(2)}% before reversal`,
        band_touches_on_reversal: `Price touches band ${btcResults.switches_with_band_touch}/${btcResults.gradient_switches_found} times (${(btcResults.switches_with_band_touch/btcResults.gradient_switches_found*100).toFixed(1)}%) after gradient switch`,
        intelligent_following: 'Exit on: gradient reversal, band touch, momentum decay, or hard stop-loss'
      }
    };

    const resultsFile = './backtest-results-gradient-enhanced-v2.json';
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
