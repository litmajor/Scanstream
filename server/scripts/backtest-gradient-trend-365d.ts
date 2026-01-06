/**
 * Gradient Trend Exhaustive Analysis - 365 Day Backtest
 * Uses multi-timeframe gradient trend analysis as the primary signal generator
 */

import * as fs from 'fs';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

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
  gradient_1h_strength: number;
  gradient_4h_strength: number;
  confluence_score: number;
}

// Calculate gradient trend (rate of change over lookback period)
function calculateGradientTrend(prices: number[], period: number): { direction: string; strength: number; slope: number } {
  if (prices.length < period) {
    return { direction: 'NEUTRAL', strength: 0, slope: 0 };
  }

  const lookback = prices.slice(-period);
  const start = lookback[0];
  const end = lookback[lookback.length - 1];
  const slope = (end - start) / start;

  // Calculate average change
  let totalChange = 0;
  for (let i = 1; i < lookback.length; i++) {
    totalChange += (lookback[i] - lookback[i - 1]) / lookback[i - 1];
  }
  const avgChange = totalChange / (lookback.length - 1);

  // Strength is abs(avgChange) * 100, capped at 100
  const strength = Math.min(100, Math.abs(avgChange) * 100);

  // Direction
  let direction = 'NEUTRAL';
  if (avgChange > 0.001) direction = 'BULLISH';
  else if (avgChange < -0.001) direction = 'BEARISH';

  return { direction, strength, slope };
}

// Multi-timeframe confluence score (0-100)
function calculateConfluenceScore(
  trend1h: { direction: string; strength: number },
  trend4h: { direction: string; strength: number },
  trend1d: { direction: string; strength: number }
): number {
  let score = 0;

  // All aligned bullish
  if (trend1h.direction === 'BULLISH' && trend4h.direction === 'BULLISH' && trend1d.direction === 'BULLISH') {
    score = 90 + Math.min(10, (trend1h.strength + trend4h.strength + trend1d.strength) / 30);
  }
  // All aligned bearish
  else if (trend1h.direction === 'BEARISH' && trend4h.direction === 'BEARISH' && trend1d.direction === 'BEARISH') {
    score = 90 + Math.min(10, (trend1h.strength + trend4h.strength + trend1d.strength) / 30);
  }
  // 2 of 3 aligned bullish
  else if ([trend1h.direction, trend4h.direction, trend1d.direction].filter(d => d === 'BULLISH').length === 2) {
    score = 70 + (trend1h.strength + trend4h.strength + trend1d.strength) / 30 * 0.3;
  }
  // 2 of 3 aligned bearish
  else if ([trend1h.direction, trend4h.direction, trend1d.direction].filter(d => d === 'BEARISH').length === 2) {
    score = 70 + (trend1h.strength + trend4h.strength + trend1d.strength) / 30 * 0.3;
  }
  // Mixed signals
  else {
    score = 40;
  }

  return Math.min(100, score);
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

  // Trading variables
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const trades: Trade[] = [];
  let executedCount = 0;

  console.log(`\n⚙️  Executing Gradient Trend backtest (exhaustive analysis)...`);

  for (let i = 240; i < ticks.length - 1; i++) {
    const tick = ticks[i];
    const nextTick = ticks[i + 1];
    const recentPrices = prices.slice(0, i + 1);

    // Multi-timeframe gradient analysis
    const trend1h = calculateGradientTrend(recentPrices, 25);   // 25-candle = ~1 day
    const trend4h = calculateGradientTrend(recentPrices, 100);  // 100-candle = ~4 days
    const trend1d = calculateGradientTrend(recentPrices, 240);  // 240-candle = ~10 days

    // Calculate confluence
    const confluenceScore = calculateConfluenceScore(trend1h, trend4h, trend1d);

    // Generate signal based on confluence + gradient strength
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    // BULLISH signals: Confluence > 65 + 1h bullish trend
    if (confluenceScore > 65 && trend1h.direction === 'BULLISH') {
      signal = 'BUY';
      confidence = Math.min(0.95, (confluenceScore / 100) * 0.7 + (trend1h.strength / 100) * 0.3);
    }
    // BEARISH signals: Confluence > 65 + 1h bearish trend
    else if (confluenceScore > 65 && trend1h.direction === 'BEARISH') {
      signal = 'SELL';
      confidence = Math.min(0.95, (confluenceScore / 100) * 0.7 + (trend1h.strength / 100) * 0.3);
    }
    // Weaker bullish: Confluence > 50 + strong 1h bullish
    else if (confluenceScore > 50 && trend1h.direction === 'BULLISH' && trend1h.strength > 0.3) {
      signal = 'BUY';
      confidence = Math.min(0.80, (confluenceScore / 100) * 0.6 + (trend1h.strength / 100) * 0.4);
    }
    // Weaker bearish: Confluence > 50 + strong 1h bearish
    else if (confluenceScore > 50 && trend1h.direction === 'BEARISH' && trend1h.strength > 0.3) {
      signal = 'SELL';
      confidence = Math.min(0.80, (confluenceScore / 100) * 0.6 + (trend1h.strength / 100) * 0.4);
    }

    // Skip if no signal or very low confidence
    if (signal === 'HOLD' || confidence < 0.45) {
      continue;
    }

    // Execute trade
    const entryPrice = tick.close;
    const direction = signal === 'BUY' ? 'long' : 'short';

    // Position sizing based on confluence score
    const positionMultiplier = confluenceScore / 100;
    const positionSize = capital * 0.05 * positionMultiplier; // 5% base
    const shares = positionSize / entryPrice;

    // Apply slippage and commission
    const slippage = entryPrice * (SLIPPAGE_BPS / 10000);
    const actualEntryPrice = direction === 'long' ? entryPrice + slippage : entryPrice - slippage;
    const entryCommission = shares * actualEntryPrice * (COMMISSION_BPS / 10000);

    // Find exit based on gradient trend reversal or fixed take-profit/stop-loss
    let exitPrice = nextTick.close;
    let exitIndex = i + 1;
    const maxHoldCandles = 50;

    for (let j = i + 1; j < Math.min(i + maxHoldCandles, ticks.length); j++) {
      const checkTick = ticks[j];
      const exitPrices = prices.slice(0, j + 1);

      // Check gradient reversal
      const exitTrend1h = calculateGradientTrend(exitPrices, 25);

      // Exit conditions:
      // 1. Gradient reversal
      if (direction === 'long' && exitTrend1h.direction === 'BEARISH') {
        exitPrice = checkTick.close;
        exitIndex = j;
        break;
      }
      if (direction === 'short' && exitTrend1h.direction === 'BULLISH') {
        exitPrice = checkTick.close;
        exitIndex = j;
        break;
      }

      // 2. Hard stop-loss (2%)
      if (direction === 'long' && checkTick.low <= entryPrice * 0.98) {
        exitPrice = entryPrice * 0.98;
        exitIndex = j;
        break;
      }
      if (direction === 'short' && checkTick.high >= entryPrice * 1.02) {
        exitPrice = entryPrice * 1.02;
        exitIndex = j;
        break;
      }

      // 3. Take profit (3%)
      if (direction === 'long' && checkTick.high >= entryPrice * 1.03) {
        exitPrice = entryPrice * 1.03;
        exitIndex = j;
        break;
      }
      if (direction === 'short' && checkTick.low <= entryPrice * 0.97) {
        exitPrice = entryPrice * 0.97;
        exitIndex = j;
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
    const holdHours = (exitIndex - i);

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
      gradient_1h_strength: trend1h.strength,
      gradient_4h_strength: trend4h.strength,
      confluence_score: confluenceScore
    });

    executedCount++;

    // Progress indicator every 50 trades
    if (executedCount % 50 === 0) {
      console.log(`    [${executedCount} trades] Capital: $${capital.toFixed(2)} | Confluence Avg: ${(trades.slice(-50).reduce((sum, t) => sum + t.confluence_score, 0) / 50).toFixed(1)}`);
    }
  }

  console.log(`\n✅ Executed ${executedCount} trades`);

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

  const avgConfluenceScore = trades.reduce((sum, t) => sum + t.confluence_score, 0) / (trades.length || 1);

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
    avg_confluence_score: avgConfluenceScore,
    equity_curve: equityCurve
  };
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Gradient Trend Exhaustive - 365 Day Backtest                 ║');
    console.log('║  Multi-timeframe gradient confluence analysis                 ║');
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
    console.log('║           GRADIENT TREND EXHAUSTIVE RESULTS SUMMARY            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // BTC Results
    console.log('\n📊 BTC PERFORMANCE:');
    console.log(`   Trades: ${btcResults.total_trades}`);
    console.log(`   Win Rate: ${btcResults.win_rate.toFixed(2)}%`);
    console.log(`   PnL: $${btcResults.total_pnl.toFixed(2)} (${btcResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${btcResults.profit_factor.toFixed(2)}`);
    console.log(`   Sharpe Ratio: ${btcResults.sharpe_ratio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${btcResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${btcResults.final_capital.toFixed(2)}`);
    console.log(`   Avg Confluence: ${btcResults.avg_confluence_score.toFixed(1)}`);

    // ETH Results
    console.log('\n📊 ETH PERFORMANCE:');
    console.log(`   Trades: ${ethResults.total_trades}`);
    console.log(`   Win Rate: ${ethResults.win_rate.toFixed(2)}%`);
    console.log(`   PnL: $${ethResults.total_pnl.toFixed(2)} (${ethResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${ethResults.profit_factor.toFixed(2)}`);
    console.log(`   Sharpe Ratio: ${ethResults.sharpe_ratio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${ethResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${ethResults.final_capital.toFixed(2)}`);
    console.log(`   Avg Confluence: ${ethResults.avg_confluence_score.toFixed(1)}`);

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
      }
    };

    const resultsFile = './backtest-results-gradient-trend-365d.json';
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
