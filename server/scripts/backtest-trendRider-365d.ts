/**
 * TrendRider Agent - 365 Day Backtest
 * Comprehensive trend-following strategy with EMA alignment, ADX confirmation, and gradient analysis
 */

import * as fs from 'fs';
import { TrendRider } from '../services/rpg-agents/TrendRider';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const SIGNAL_THRESHOLD = 0.3; // Lower threshold for trend following
const MAX_POSITION_SIZE = 0.5;
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
  size: number;
  reason?: string;
}

interface BacktestResults {
  asset: string;
  trades: Trade[];
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  total_pnl: number;
  total_pnl_percent: number;
  sharpe_ratio: number;
  max_drawdown: number;
  final_capital: number;
  equity_curve: number[];
  signal_distribution: { [key: string]: number };
}

// Helper: Calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Helper: Calculate ADX (simplified)
function calculateADX(ticks: MarketTick[], period: number = 14): number {
  if (ticks.length < period) return 20;
  let plus_dm = 0, minus_dm = 0;
  for (let i = Math.max(0, ticks.length - period); i < ticks.length; i++) {
    const prev = i > 0 ? ticks[i - 1] : ticks[i];
    const curr = ticks[i];
    const up = curr.high - prev.high;
    const down = prev.low - curr.low;
    if (up > down && up > 0) plus_dm += up;
    if (down > up && down > 0) minus_dm += down;
  }
  return Math.min(100, (plus_dm + minus_dm) / 2);
}

// Helper: Build market data object from ticks
function buildMarketData(ticks: MarketTick[], currentIndex: number) {
  const lookback = Math.min(250, currentIndex + 1);
  const recent = ticks.slice(Math.max(0, currentIndex - lookback), currentIndex + 1);
  
  const closes = recent.map(t => t.close);
  const prices = closes;
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, Math.min(200, closes.length));
  const adx = calculateADX(recent, 14);
  
  return {
    price: recent[recent.length - 1].close,
    ema20,
    ema50,
    ema200,
    adx,
    macd: { macd: 0, signal: 0, histogram: 0 }, // Simplified
    volume: recent[recent.length - 1].volume || 1,
    avg_volume: recent.reduce((sum, t) => sum + (t.volume || 1), 0) / recent.length,
    regime: 'unknown',
    high: recent[recent.length - 1].high,
    low: recent[recent.length - 1].low,
    close: recent[recent.length - 1].close,
    price_history: closes,
    symbol: null
  };
}

async function runBacktest(asset: 'BTC' | 'ETH'): Promise<BacktestResults> {
  const agent = new TrendRider(`${asset}-TrendRider`);
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
  console.log(`   Date range: ${ticks[0].timestamp} to ${ticks[ticks.length - 1].timestamp}`);
  console.log(`   Duration: ${(ticks.length / 24).toFixed(1)} days`);

  // Trading variables
  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  const equityCurve: number[] = [INITIAL_CAPITAL];
  const trades: Trade[] = [];
  const signalDistribution: { [key: string]: number } = {};
  let signalCheckCount = 0;
  let holdSignalCount = 0;
  let lowConfidenceCount = 0;
  let executedCount = 0;

  console.log(`\n⚙️  Executing TrendRider backtest...`);

  for (let i = 50; i < ticks.length - 1; i++) {
    const tick = ticks[i];
    const nextTick = ticks[i + 1];

    // Build market data from ticks
    const marketData = buildMarketData(ticks, i);

    // Generate signal from TrendRider
    const signal = agent.processSignal(marketData);
    signalCheckCount++;

    if (!signal) {
      holdSignalCount++;
      continue;
    }

    // Track signal type
    if (!signalDistribution[signal.action]) {
      signalDistribution[signal.action] = 0;
    }
    signalDistribution[signal.action]++;

    // Skip HOLD signals
    if (signal.action === 'HOLD') {
      holdSignalCount++;
      continue;
    }

    // Skip low confidence signals
    if (signal.confidence < SIGNAL_THRESHOLD) {
      lowConfidenceCount++;
      continue;
    }

    // Execute trade
    const direction = signal.action === 'BUY' ? 'long' : 'short';
    const entryPrice = signal.entry || nextTick.close;
    const targetPrice = signal.target;
    const stopPrice = signal.stop;

    // Position sizing based on confidence
    let positionMultiplier = 0.5;
    if (signal.confidence >= 0.7) {
      positionMultiplier = 1.0;
    } else if (signal.confidence >= 0.6) {
      positionMultiplier = 0.8;
    } else if (signal.confidence >= 0.5) {
      positionMultiplier = 0.6;
    }

    const positionSize = Math.min(MAX_POSITION_SIZE * positionMultiplier, capital * 0.1);
    const shares = positionSize / entryPrice;

    // Apply slippage and commission
    const slippage = entryPrice * (SLIPPAGE_BPS / 10000);
    const actualEntryPrice = direction === 'long' ? entryPrice + slippage : entryPrice - slippage;
    const entryCommission = shares * actualEntryPrice * (COMMISSION_BPS / 10000);

    // Find exit - use target or stop or time-based
    let exitPrice = nextTick.close;
    let exitIndex = i + 1;
    let exited = false;

    // Look ahead up to 50 candles for target/stop
    for (let j = i + 1; j < Math.min(i + 50, ticks.length); j++) {
      const checkTick = ticks[j];

      if (direction === 'long') {
        if (checkTick.high >= targetPrice) {
          exitPrice = targetPrice;
          exitIndex = j;
          exited = true;
          break;
        }
        if (checkTick.low <= stopPrice) {
          exitPrice = stopPrice;
          exitIndex = j;
          exited = true;
          break;
        }
      } else {
        if (checkTick.low <= targetPrice) {
          exitPrice = targetPrice;
          exitIndex = j;
          exited = true;
          break;
        }
        if (checkTick.high >= stopPrice) {
          exitPrice = stopPrice;
          exitIndex = j;
          exited = true;
          break;
        }
      }
    }

    // If no target/stop hit, use close price at exit index
    if (!exited && exitIndex < ticks.length) {
      exitPrice = ticks[exitIndex].close;
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
      size: shares,
      reason: exited ? (direction === 'long' ? 'target/stop' : 'target/stop') : 'time-exit'
    });

    executedCount++;

    // Progress indicator every 100 trades
    if (executedCount % 100 === 0) {
      console.log(`    [${executedCount} trades] Capital: $${capital.toFixed(2)} | Last PnL: ${tradePnLPercent.toFixed(2)}%`);
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
    equity_curve: equityCurve,
    signal_distribution: signalDistribution
  };
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     TrendRider Agent - 365 Day Backtest                        ║');
    console.log('║     Multi-timeframe gradient + EMA + ADX trend following       ║');
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
    console.log('║                    TRENDLIDER RESULTS SUMMARY                   ║');
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
    console.log(`   Avg Win: $${btcResults.avg_win.toFixed(2)}`);
    console.log(`   Avg Loss: $${btcResults.avg_loss.toFixed(2)}`);
    console.log(`   Signal Distribution:`, btcResults.signal_distribution);

    // ETH Results
    console.log('\n📊 ETH PERFORMANCE:');
    console.log(`   Trades: ${ethResults.total_trades}`);
    console.log(`   Win Rate: ${ethResults.win_rate.toFixed(2)}%`);
    console.log(`   PnL: $${ethResults.total_pnl.toFixed(2)} (${ethResults.total_pnl_percent.toFixed(2)}%)`);
    console.log(`   Profit Factor: ${ethResults.profit_factor.toFixed(2)}`);
    console.log(`   Sharpe Ratio: ${ethResults.sharpe_ratio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${ethResults.max_drawdown.toFixed(2)}%`);
    console.log(`   Final Capital: $${ethResults.final_capital.toFixed(2)}`);
    console.log(`   Avg Win: $${ethResults.avg_win.toFixed(2)}`);
    console.log(`   Avg Loss: $${ethResults.avg_loss.toFixed(2)}`);
    console.log(`   Signal Distribution:`, ethResults.signal_distribution);

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

    // Save results to file
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

    const resultsFile = './backtest-results-trendRider-365d.json';
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
