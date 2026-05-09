/**
 * Out-of-Sample Test
 * 
 * Tests for overfitting by running on data outside training period:
 * - Training period: 2023-2024 (implicit in physics calibration)
 * - Test period: 2025 (most recent data, never seen by thresholds)
 * 
 * If performance collapses on 2025 → overfitting to historical patterns
 * If performance holds → system generalizes across market conditions
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/backtest-out-of-sample-test.ts
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface OutOfSampleResult {
  period: string;
  start_date: string;
  end_date: string;
  days: number;
  btc_cov_ratio_pct: number;
  btc_trades: number;
  btc_win_rate: number;
  btc_profit: number;
  btc_profit_pct: number;
  btc_sharpe: number;
  btc_max_dd: number;
  eth_cov_ratio_pct: number;
  eth_trades: number;
  eth_win_rate: number;
  eth_profit: number;
  eth_profit_pct: number;
  eth_sharpe: number;
  eth_max_dd: number;
  combined_trades: number;
  combined_win_rate: number;
  combined_profit_pct: number;
  combined_sharpe: number;
  overfitting_signal: string;
}

async function runBacktestOnPeriod(
  asset: 'BTC' | 'ETH',
  days: number
): Promise<{
  startDate: string;
  endDate: string;
  trades: number;
  winRate: number;
  profit: number;
  profitPct: number;
  sharpe: number;
  maxDD: number;
  covRatio: number;
}> {
  const agent = new VFMDPhysicsAgent('oos-test', 'balanced');
  agent.setAsset(asset);
  
  const pair = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const cacheFile = `./data/cache/${pair}_1h_${days}d.json`;
  
  console.log(`    Fetching ${days}-day ${asset} data...`);
  
  let ticks: MarketTick[];
  if (fs.existsSync(cacheFile)) {
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  } else {
    const fetcher = new BinanceDataFetcher();
    ticks = await fetcher.fetchHistoricalData(pair, days, '1h');
    fs.mkdirSync('./data/cache', { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
  }

  if (ticks.length < 100) {
    throw new Error(`Insufficient data: ${ticks.length} candles`);
  }

  const startDate = new Date(ticks[0].timestamp).toISOString().split('T')[0];
  const endDate = new Date(ticks[ticks.length - 1].timestamp).toISOString().split('T')[0];

  let capital = 1000;
  let trades = 0;
  let wins = 0;
  const dailyReturns: number[] = [];
  const equityCurve = [1000];
  let checkCount = 0;
  let holdCount = 0;
  let tradeCount = 0;

  for (let i = 20; i < ticks.length - 1; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const signal = agent.generateSignal(historicalTicks);
    const tick = ticks[i];
    const nextTick = ticks[i + 1];

    checkCount++;
    if (signal.action === 'HOLD') {
      holdCount++;
      continue;
    }

    if (signal.confidence < 0.25) {
      continue;
    }

    const direction = signal.action === 'BUY' ? 'long' : 'short';
    const positionSize = Math.min((capital * 0.4) / tick.close, capital * 0.4);
    
    // Realistic costs
    const commissionBps = 1;
    const slippageBps = 2;
    const slippageFactor = 1 + (direction === 'long' ? slippageBps : -slippageBps) / 10000;
    const entryPrice = tick.close * slippageFactor;
    
    let exitPrice = nextTick.close;
    
    // Exit logic: opposite signal or 10 candles
    for (let j = i + 2; j < Math.min(i + 11, ticks.length); j++) {
      const nextSignal = agent.generateSignal(ticks.slice(0, j + 1));
      
      if ((direction === 'long' && nextSignal.action === 'SELL') ||
          (direction === 'short' && nextSignal.action === 'BUY')) {
        exitPrice = ticks[j].close;
        break;
      }
    }

    const pnl = direction === 'long'
      ? positionSize * (exitPrice - entryPrice)
      : positionSize * (entryPrice - exitPrice);
    
    const entryCommission = (entryPrice * positionSize * commissionBps / 10000);
    const exitCommission = (exitPrice * positionSize * commissionBps / 10000);
    const netPnl = pnl - entryCommission - exitCommission;
    
    capital += netPnl;
    if (netPnl > 0) wins++;
    
    trades++;
    tradeCount++;
    equityCurve.push(capital);
    dailyReturns.push((capital - equityCurve[equityCurve.length - 2]) / equityCurve[equityCurve.length - 2]);
  }

  const profit = capital - 1000;
  const profitPct = (profit / 1000) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const covRatio = checkCount > 0 ? ((checkCount - holdCount) / checkCount) * 100 : 0;
  
  // Sharpe
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

  // Max drawdown
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const peak = Math.max(...equityCurve.slice(0, i + 1));
    const dd = (equityCurve[i] - peak) / peak;
    maxDD = Math.min(maxDD, dd);
  }

  return { startDate, endDate, trades, winRate, profit, profitPct, sharpe, maxDD, covRatio };
}

async function main() {
  console.log('\n🔍 OUT-OF-SAMPLE TEST (Overfitting Detection)');
  console.log('='.repeat(90));
  console.log('Testing system robustness across different market periods\n');

  const results: OutOfSampleResult[] = [];

  // Period 1: Full year 2025 (most recent)
  console.log('📊 Period 1/2: 2025 Data (365 days) - Out-of-sample test');
  const year2025_btc = await runBacktestOnPeriod('BTC', 365);
  const year2025_eth = await runBacktestOnPeriod('ETH', 365);
  console.log(`  BTC: ${year2025_btc.trades} trades | ${year2025_btc.covRatio.toFixed(1)}% coverage | +${year2025_btc.profitPct.toFixed(2)}% | WR ${year2025_btc.winRate.toFixed(1)}%`);
  console.log(`  ETH: ${year2025_eth.trades} trades | ${year2025_eth.covRatio.toFixed(1)}% coverage | +${year2025_eth.profitPct.toFixed(2)}% | WR ${year2025_eth.winRate.toFixed(1)}%\n`);

  const combined_2025_pct = ((year2025_btc.profit + year2025_eth.profit) / 2000) * 100;
  const combined_2025_wr = ((year2025_btc.winRate * year2025_btc.trades + year2025_eth.winRate * year2025_eth.trades) / (year2025_btc.trades + year2025_eth.trades));
  const combined_2025_sharpe = (year2025_btc.sharpe + year2025_eth.sharpe) / 2;

  results.push({
    period: 'RECENT 2025 (recent market)',
    start_date: year2025_btc.startDate,
    end_date: year2025_btc.endDate,
    days: 365,
    btc_cov_ratio_pct: year2025_btc.covRatio,
    btc_trades: year2025_btc.trades,
    btc_win_rate: year2025_btc.winRate,
    btc_profit: year2025_btc.profit,
    btc_profit_pct: year2025_btc.profitPct,
    btc_sharpe: year2025_btc.sharpe,
    btc_max_dd: year2025_btc.maxDD,
    eth_cov_ratio_pct: year2025_eth.covRatio,
    eth_trades: year2025_eth.trades,
    eth_win_rate: year2025_eth.winRate,
    eth_profit: year2025_eth.profit,
    eth_profit_pct: year2025_eth.profitPct,
    eth_sharpe: year2025_eth.sharpe,
    eth_max_dd: year2025_eth.maxDD,
    combined_trades: year2025_btc.trades + year2025_eth.trades,
    combined_win_rate: combined_2025_wr,
    combined_profit_pct: combined_2025_pct,
    combined_sharpe: combined_2025_sharpe,
    overfitting_signal: ''
  });

  // Period 2: Last 6 months only
  console.log('📊 Period 2/2: Last 180 days (6 months) - Recent regime only');
  const recent180_btc = await runBacktestOnPeriod('BTC', 180);
  const recent180_eth = await runBacktestOnPeriod('ETH', 180);
  console.log(`  BTC: ${recent180_btc.trades} trades | ${recent180_btc.covRatio.toFixed(1)}% coverage | +${recent180_btc.profitPct.toFixed(2)}% | WR ${recent180_btc.winRate.toFixed(1)}%`);
  console.log(`  ETH: ${recent180_eth.trades} trades | ${recent180_eth.covRatio.toFixed(1)}% coverage | +${recent180_eth.profitPct.toFixed(2)}% | WR ${recent180_eth.winRate.toFixed(1)}%\n`);

  const combined_180_pct = ((recent180_btc.profit + recent180_eth.profit) / 2000) * 100;
  const combined_180_wr = ((recent180_btc.winRate * recent180_btc.trades + recent180_eth.winRate * recent180_eth.trades) / (recent180_btc.trades + recent180_eth.trades));
  const combined_180_sharpe = (recent180_btc.sharpe + recent180_eth.sharpe) / 2;

  results.push({
    period: 'RECENT 6MONTH (recent regime)',
    start_date: recent180_btc.startDate,
    end_date: recent180_btc.endDate,
    days: 180,
    btc_cov_ratio_pct: recent180_btc.covRatio,
    btc_trades: recent180_btc.trades,
    btc_win_rate: recent180_btc.winRate,
    btc_profit: recent180_btc.profit,
    btc_profit_pct: recent180_btc.profitPct,
    btc_sharpe: recent180_btc.sharpe,
    btc_max_dd: recent180_btc.maxDD,
    eth_cov_ratio_pct: recent180_eth.covRatio,
    eth_trades: recent180_eth.trades,
    eth_win_rate: recent180_eth.winRate,
    eth_profit: recent180_eth.profit,
    eth_profit_pct: recent180_eth.profitPct,
    eth_sharpe: recent180_eth.sharpe,
    eth_max_dd: recent180_eth.maxDD,
    combined_trades: recent180_btc.trades + recent180_eth.trades,
    combined_win_rate: combined_180_wr,
    combined_profit_pct: combined_180_pct,
    combined_sharpe: combined_180_sharpe,
    overfitting_signal: ''
  });

  // Analysis
  console.log('='.repeat(90));
  console.log('📈 OVERFITTING ANALYSIS\n');

  const profit_decline = ((combined_180_pct - combined_2025_pct) / combined_2025_pct) * 100;
  const wr_decline = ((combined_180_wr - combined_2025_wr) / combined_2025_wr) * 100;
  const sharpe_decline = ((combined_180_sharpe - combined_2025_sharpe) / combined_2025_sharpe) * 100;

  console.log('Performance Comparison (365d vs 180d):');
  console.log(`  Profit:  ${combined_2025_pct.toFixed(2)}% → ${combined_180_pct.toFixed(2)}% (${profit_decline > 0 ? '+' : ''}${profit_decline.toFixed(1)}% change)`);
  console.log(`  Win Rate: ${combined_2025_wr.toFixed(1)}% → ${combined_180_wr.toFixed(1)}% (${wr_decline > 0 ? '+' : ''}${wr_decline.toFixed(1)}% change)`);
  console.log(`  Sharpe:   ${combined_2025_sharpe.toFixed(3)} → ${combined_180_sharpe.toFixed(3)} (${sharpe_decline > 0 ? '+' : ''}${sharpe_decline.toFixed(1)}% change)\n`);

  const overfit = Math.abs(profit_decline) > 20;

  if (Math.abs(profit_decline) < 10 && Math.abs(wr_decline) < 5) {
    console.log('✅ STABLE: Performance consistent across periods → No overfitting detected');
    results[0].overfitting_signal = 'STABLE';
    results[1].overfitting_signal = 'STABLE';
  } else if (Math.abs(profit_decline) < 30 && Math.abs(wr_decline) < 10) {
    console.log('⚠️  MILD DRIFT: Some performance variation but not severe overfitting');
    results[0].overfitting_signal = 'MILD_DRIFT';
    results[1].overfitting_signal = 'MILD_DRIFT';
  } else {
    console.log('❌ OVERFITTING DETECTED: Major performance drop on recent data');
    results[0].overfitting_signal = 'OVERFITTING';
    results[1].overfitting_signal = 'OVERFITTING';
  }

  console.log('\nCoverage Ratio Analysis (% of candles trading):');
  console.log(`  365d: ${results[0].btc_cov_ratio_pct.toFixed(1)}% (BTC) | ${results[0].eth_cov_ratio_pct.toFixed(1)}% (ETH)`);
  console.log(`  180d: ${results[1].btc_cov_ratio_pct.toFixed(1)}% (BTC) | ${results[1].eth_cov_ratio_pct.toFixed(1)}% (ETH)`);

  if (results[0].btc_cov_ratio_pct > 20 || results[0].eth_cov_ratio_pct > 20) {
    console.log('\n⚠️  Coverage ratio > 20% suggests signal generation may be too loose');
  }

  // Market regime analysis
  console.log('\nMax Drawdown Comparison:');
  console.log(`  365d: BTC ${(results[0].btc_max_dd * 100).toFixed(2)}% | ETH ${(results[0].eth_max_dd * 100).toFixed(2)}%`);
  console.log(`  180d: BTC ${(results[1].btc_max_dd * 100).toFixed(2)}% | ETH ${(results[1].eth_max_dd * 100).toFixed(2)}%`);

  // Save results
  fs.writeFileSync(
    './backtest-oos-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Results saved to: ./backtest-oos-results.json\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
