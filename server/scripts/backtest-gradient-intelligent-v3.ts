/**
 * Intelligent Gradient Trend Analysis - PRODUCTION VERSION
 * 
 * Fixes the core issues:
 * 1. Gradient Direction: Trend direction (bullish/bearish) based on meaningful change
 * 2. Gradient Strength: Momentum/acceleration of the trend (how fast it's moving)
 * 3. Band Dynamics: Support/resistance areas price gravitates toward
 * 4. Exit Signals: When/where price exits based on gradient reversal + band interaction
 * 
 * Key Insight: Gradient is much noisier than we thought. Need adaptive thresholds.
 */

import * as fs from 'fs';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

interface GradientMetrics {
  direction: number;        // 1=BULLISH, -1=BEARISH
  strength: number;         // 0-100: magnitude of trend
  acceleration: number;     // 0-100: change in gradient (momentum)
  momentum: number;         // composite score
  colorSignal: string;      // "green" or "red"
}

interface BandMetrics {
  upper: number;
  mid: number;
  lower: number;
  bandwidth: number;
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
  exit_reason: string;
  gradient_strength_at_entry: number;
  gradient_strength_at_exit: number;
}

// Calculate Bollinger Bands
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

/**
 * Enhanced Gradient Calculation
 * 
 * Direction = Average change over period (is price going up or down?)
 * Strength = Consistency of that change (how strong is the trend?)
 * Acceleration = Change in the gradient itself (is trend speeding up or slowing down?)
 */
function calculateGradientMetrics(prices: number[], period: number): GradientMetrics {
  if (prices.length < period) {
    return {
      direction: 0,
      strength: 0,
      acceleration: 0,
      momentum: 0,
      colorSignal: 'gray'
    };
  }

  const lookback = prices.slice(-period);
  
  // Calculate per-candle changes
  const changes: number[] = [];
  for (let i = 1; i < lookback.length; i++) {
    const change = (lookback[i] - lookback[i - 1]) / lookback[i - 1];
    changes.push(change);
  }

  // Average change determines DIRECTION
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  
  // Adaptive threshold: direction = meaningful trend
  // Instead of 0.001, use market volatility
  const volatility = Math.sqrt(changes.reduce((sum, c) => sum + c * c, 0) / changes.length);
  const threshold = Math.max(0.0001, volatility * 0.5); // At least 50% of volatility
  
  const direction = avgChange > threshold ? 1 : (avgChange < -threshold ? -1 : 0);

  // STRENGTH = How consistently is price moving in the direction?
  // Count how many candles moved in the direction
  const trendCandles = changes.filter(c => {
    if (direction === 1) return c > 0;
    if (direction === -1) return c < 0;
    return false;
  }).length;
  
  const strength = (trendCandles / changes.length) * 100;

  // ACCELERATION = Is the gradient itself accelerating?
  // Calculate gradient of the gradient
  let accelerations: number[] = [];
  for (let i = 1; i < changes.length; i++) {
    const accel = changes[i] - changes[i - 1];
    accelerations.push(accel);
  }
  
  const avgAcceleration = accelerations.length > 0
    ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
    : 0;
  
  // Normalize acceleration to 0-100
  const accelNormalized = Math.min(100, Math.max(0, 50 + (avgAcceleration / volatility) * 1000));

  // MOMENTUM = blend of strength and acceleration
  const momentum = (strength * 0.6) + (accelNormalized * 0.4);

  // COLOR SIGNAL
  const colorSignal = direction === 1 ? 'green' : direction === -1 ? 'red' : 'gray';

  return {
    direction,
    strength,
    acceleration: accelNormalized,
    momentum,
    colorSignal
  };
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
  const prices = ticks.map(t => t.close);

  console.log(`✅ Loaded ${ticks.length} candles`);

  // Analyze gradient distribution
  console.log(`\n🔍 Analyzing gradient behavior...`);
  let dirCounts = { bullish: 0, bearish: 0, neutral: 0 };
  const sampleMetrics = [];
  
  for (let i = 120; i < Math.min(500, prices.length); i++) {
    const metrics = calculateGradientMetrics(prices.slice(0, i), 25);
    if (metrics.direction === 1) dirCounts.bullish++;
    else if (metrics.direction === -1) dirCounts.bearish++;
    else dirCounts.neutral++;
    
    if (i % 100 === 0) sampleMetrics.push(metrics);
  }
  
  const totalSample = dirCounts.bullish + dirCounts.bearish + dirCounts.neutral;
  console.log(`   Bullish signals: ${dirCounts.bullish}/${totalSample} (${(dirCounts.bullish/totalSample*100).toFixed(1)}%)`);
  console.log(`   Bearish signals: ${dirCounts.bearish}/${totalSample} (${(dirCounts.bearish/totalSample*100).toFixed(1)}%)`);
  console.log(`   Avg gradient strength: ${(sampleMetrics.reduce((s, m) => s + m.strength, 0) / sampleMetrics.length).toFixed(1)}`);

  // Trading variables
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const trades: Trade[] = [];
  let tradeCount = 0;
  let inPosition = false;
  let positionDirection: 'long' | 'short' | null = null;
  let entryIndex = 0;
  let entryPrice = 0;

  console.log(`\n⚙️  Executing Intelligent Gradient Trend backtest...`);

  for (let i = 120; i < ticks.length - 50; i++) {
    const tick = ticks[i];
    const recentPrices = prices.slice(0, i + 1);
    const metrics = calculateGradientMetrics(recentPrices, 25);
    const bands = calculateBands(recentPrices, 20);

    // Entry logic: Strong gradient + momentum
    if (!inPosition && metrics.direction !== 0 && metrics.momentum > 50) {
      const direction = metrics.direction > 0 ? 'long' : 'short';
      inPosition = true;
      positionDirection = direction;
      entryIndex = i;
      entryPrice = tick.close;

      // Position sizing based on momentum
      const positionSize = capital * 0.05 * (metrics.momentum / 100);
      const shares = positionSize / entryPrice;

      // Apply slippage
      const slippage = entryPrice * (SLIPPAGE_BPS / 10000);
      const actualEntryPrice = direction === 'long' ? entryPrice + slippage : entryPrice - slippage;
      const entryCommission = shares * actualEntryPrice * (COMMISSION_BPS / 10000);

      // Store entry info for later trade recording
      (tick as any).__tradeEntry = {
        shares,
        positionSize,
        actualEntryPrice,
        entryCommission,
        metrics
      };
    }

    // Exit logic: If in position
    if (inPosition && i > entryIndex) {
      const prevMetrics = calculateGradientMetrics(prices.slice(0, i), 25);
      let shouldExit = false;
      let exitReason = '';

      // Exit 1: Gradient reversal
      if (metrics.direction !== prevMetrics.direction && metrics.direction !== 0) {
        shouldExit = true;
        exitReason = 'gradient_reversal';
      }

      // Exit 2: Price reached opposite band
      if (positionDirection === 'long' && tick.low <= bands.lower) {
        shouldExit = true;
        exitReason = 'lower_band_touch';
      }
      if (positionDirection === 'short' && tick.high >= bands.upper) {
        shouldExit = true;
        exitReason = 'upper_band_touch';
      }

      // Exit 3: Hard stop loss (-2%)
      if (positionDirection === 'long' && tick.low <= entryPrice * 0.98) {
        shouldExit = true;
        exitReason = 'stop_loss';
      }
      if (positionDirection === 'short' && tick.high >= entryPrice * 1.02) {
        shouldExit = true;
        exitReason = 'stop_loss';
      }

      // Exit 4: Take profit (+3%)
      if (positionDirection === 'long' && tick.high >= entryPrice * 1.03) {
        shouldExit = true;
        exitReason = 'take_profit';
      }
      if (positionDirection === 'short' && tick.low <= entryPrice * 0.97) {
        shouldExit = true;
        exitReason = 'take_profit';
      }

      // Exit 5: Max hold time (60 candles)
      if (i - entryIndex >= 60) {
        shouldExit = true;
        exitReason = 'timeout';
      }

      if (shouldExit) {
        const exitPrice = tick.close;
        const entryData = (ticks[entryIndex] as any).__tradeEntry;
        
        if (entryData && positionDirection) {
          const { shares, positionSize, actualEntryPrice, entryCommission, metrics: entryMetrics } = entryData;
          
          // Calculate exit
          const slippage = exitPrice * (SLIPPAGE_BPS / 10000);
          const actualExitPrice = positionDirection === 'long' ? exitPrice - slippage : exitPrice + slippage;
          const exitCommission = shares * actualExitPrice * (COMMISSION_BPS / 10000);

          // Calculate PnL
          let tradePnL: number;
          if (positionDirection === 'long') {
            tradePnL = shares * (actualExitPrice - actualEntryPrice) - entryCommission - exitCommission;
          } else {
            tradePnL = shares * (actualEntryPrice - actualExitPrice) - entryCommission - exitCommission;
          }

          const tradePnLPercent = (tradePnL / positionSize) * 100;
          const holdHours = i - entryIndex;

          // Update capital
          capital += tradePnL;
          peakCapital = Math.max(peakCapital, capital);
          equityCurve.push(capital);

          // Record trade
          trades.push({
            index: entryIndex,
            entry_time: String(ticks[entryIndex].timestamp),
            exit_time: String(tick.timestamp),
            entry_price: entryPrice,
            exit_price: exitPrice,
            direction: positionDirection,
            pnl: tradePnL,
            pnl_percent: tradePnLPercent,
            win: tradePnL > 0,
            hold_hours: holdHours,
            exit_reason: exitReason,
            gradient_strength_at_entry: entryMetrics.strength,
            gradient_strength_at_exit: metrics.strength
          });

          tradeCount++;
          if (tradeCount % 50 === 0) {
            console.log(`    [${tradeCount} trades] Capital: $${capital.toFixed(2)}`);
          }
        }

        inPosition = false;
        positionDirection = null;
      }
    }
  }

  console.log(`\n✅ Executed ${tradeCount} trades`);

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

  const exitReasons = trades.reduce((acc: Record<string, number>, t) => {
    acc[t.exit_reason] = (acc[t.exit_reason] || 0) + 1;
    return acc;
  }, {});

  return {
    asset,
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
    exit_reasons: exitReasons
  };
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Intelligent Gradient Trend Analysis - PRODUCTION v3          ║');
    console.log('║  Smart Threshold Adaptation + Band Dynamics                  ║');
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
    console.log('║      INTELLIGENT GRADIENT TREND ANALYSIS RESULTS SUMMARY        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    console.log('\n📊 BTC PERFORMANCE:');
    console.log(`   Trades: ${btcResults.total_trades} | WR: ${btcResults.win_rate.toFixed(2)}% | PnL: $${btcResults.total_pnl.toFixed(2)} (${btcResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${btcResults.profit_factor.toFixed(2)} | Sharpe: ${btcResults.sharpe_ratio.toFixed(3)} | DD: ${btcResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${btcResults.final_capital.toFixed(2)}`);
    console.log(`   Exit Reasons:`, btcResults.exit_reasons);

    console.log('\n📊 ETH PERFORMANCE:');
    console.log(`   Trades: ${ethResults.total_trades} | WR: ${ethResults.win_rate.toFixed(2)}% | PnL: $${ethResults.total_pnl.toFixed(2)} (${ethResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${ethResults.profit_factor.toFixed(2)} | Sharpe: ${ethResults.sharpe_ratio.toFixed(3)} | DD: ${ethResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${ethResults.final_capital.toFixed(2)}`);
    console.log(`   Exit Reasons:`, ethResults.exit_reasons);

    // Combined
    const combinedTrades = btcResults.total_trades + ethResults.total_trades;
    const combinedWins = btcResults.winning_trades + ethResults.winning_trades;
    const combinedPnL = btcResults.total_pnl + ethResults.total_pnl;
    const combinedCapital = btcResults.final_capital + ethResults.final_capital;

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 COMBINED RESULTS:');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`   Total Trades: ${combinedTrades}`);
    console.log(`   Combined WR: ${combinedTrades > 0 ? (combinedWins/combinedTrades*100).toFixed(2) : 0}%`);
    console.log(`   Combined PnL: $${combinedPnL.toFixed(2)}`);
    console.log(`   Combined Final Capital: $${combinedCapital.toFixed(2)}`);

    // Save results
    fs.writeFileSync('./backtest-results-gradient-intelligent-v3.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      btc: btcResults,
      eth: ethResults,
      combined: {
        total_trades: combinedTrades,
        combined_wr: combinedTrades > 0 ? (combinedWins/combinedTrades*100) : 0,
        combined_pnl: combinedPnL,
        combined_capital: combinedCapital
      }
    }, null, 2));

    console.log(`\n✅ Results saved to: ./backtest-results-gradient-intelligent-v3.json`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
