import * as path from 'path';
import * as fs from 'fs';
import { ConvexityBacktesterWithFoR, BacktestResult } from './convexity-backtester-with-for.ts';

type RiskCandidate = { scoutTargetMultiplier: number; scoutStopMultiplier: number; name: string };

const candidates: RiskCandidate[] = [
  { scoutTargetMultiplier: 2.5, scoutStopMultiplier: 0.7, name: 'HighPnL (2.5 / 0.7)' },
  { scoutTargetMultiplier: 2.4, scoutStopMultiplier: 0.7, name: 'HighPnL2 (2.4 / 0.7)' },
  { scoutTargetMultiplier: 2.0, scoutStopMultiplier: 0.7, name: 'Baseline (2.0 / 0.7)' },
  { scoutTargetMultiplier: 2.4, scoutStopMultiplier: 1.4, name: 'LowStop (2.4 / 1.4)' },
];

const symbols = [
  { symbol: 'ETH/USDT', data: path.join(process.cwd(), 'data/cache/ETHUSDT_1h_365d.json') },
  { symbol: 'BTC/USDT', data: path.join(process.cwd(), 'data/cache/BTCUSDT_1h_365d.json') },
];

interface RiskMetrics {
  pnl: number;
  stops: number;
  targets: number;
  timeouts: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  winStreak: number;
  lossStreak: number;
  winRate: number;
}

function computeRiskMetrics(result: BacktestResult): RiskMetrics {
  const trades = result.vfmdScoutTrades;
  if (trades.length === 0) {
    return {
      pnl: 0,
      stops: 0,
      targets: 0,
      timeouts: 0,
      maxDrawdown: 0,
      sharpe: 0,
      sortino: 0,
      winStreak: 0,
      lossStreak: 0,
      winRate: 0,
    };
  }

  // Basic metrics
  const pnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const stops = trades.filter(t => t.exitReason === 'STOP').length;
  const targets = trades.filter(t => t.exitReason === 'TARGET').length;
  const timeouts = trades.filter(t => t.exitReason === 'TIMEOUT').length;
  const wins = trades.filter(t => (t.pnl || 0) > 0);
  const losses = trades.filter(t => (t.pnl || 0) < 0);
  const winRate = (wins.length / trades.length) * 100;

  // Cumulative P&L for drawdown calculation
  let cumPnl = 0;
  let maxCumPnl = 0;
  let maxDrawdown = 0;
  const pnlSeries: number[] = [];
  const dailyReturns: number[] = [];

  for (const trade of trades) {
    const tradePnl = trade.pnl || 0;
    cumPnl += tradePnl;
    pnlSeries.push(cumPnl);
    dailyReturns.push(tradePnl);

    if (cumPnl > maxCumPnl) {
      maxCumPnl = cumPnl;
    }
    const drawdown = ((maxCumPnl - cumPnl) / Math.abs(maxCumPnl) * 100);
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Sharpe ratio (assume 0% risk-free rate, 252 trading periods per year)
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Sortino ratio (downside deviation only)
  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(Math.min(r, 0), 2), 0) / dailyReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);
  const sortino = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0;

  // Win/loss streaks
  let winStreak = 0;
  let lossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (const trade of trades) {
    const tradePnl = trade.pnl || 0;
    if (tradePnl > 0) {
      winStreak++;
      lossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else if (tradePnl < 0) {
      lossStreak++;
      winStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
  }

  return {
    pnl,
    stops,
    targets,
    timeouts,
    maxDrawdown,
    sharpe,
    sortino,
    winStreak: maxWinStreak,
    lossStreak: maxLossStreak,
    winRate,
  };
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('RISK ANALYSIS: SCOUT DRAWDOWN & RISK-ADJUSTED RETURNS');
  console.log('='.repeat(100));

  for (const s of symbols) {
    console.log('\n' + '-'.repeat(100));
    console.log(`SYMBOL: ${s.symbol}`);
    console.log('-'.repeat(100));

    console.log(
      `\n${'Config'.padEnd(25)} | ${'PnL'.padEnd(12)} | ${'Stops'.padEnd(8)} | ${'Targets'.padEnd(8)} | ${'MaxDD%'.padEnd(8)} | ${'Sharpe'.padEnd(8)} | ${'Sortino'.padEnd(8)} | ${'WinStrk'.padEnd(8)} | ${'LossStrk'.padEnd(8)} | ${'WinRate%'.padEnd(8)}`
    );
    console.log('-'.repeat(140));

    for (const c of candidates) {
      const backtester = new ConvexityBacktesterWithFoR('RiskAnalysis');
      backtester.optimizationParams = {
        ...backtester.optimizationParams,
        scoutTargetMultiplier: c.scoutTargetMultiplier,
        scoutStopMultiplier: c.scoutStopMultiplier,
      } as any;

      const res: BacktestResult = backtester.run({ symbol: s.symbol, dataPath: s.data });
      const metrics = computeRiskMetrics(res);

      console.log(
        `${c.name.padEnd(25)} | ${metrics.pnl.toFixed(2).padEnd(12)} | ${metrics.stops.toString().padEnd(8)} | ${metrics.targets.toString().padEnd(8)} | ${metrics.maxDrawdown.toFixed(2).padEnd(8)} | ${metrics.sharpe.toFixed(2).padEnd(8)} | ${metrics.sortino.toFixed(2).padEnd(8)} | ${metrics.winStreak.toString().padEnd(8)} | ${metrics.lossStreak.toString().padEnd(8)} | ${metrics.winRate.toFixed(2).padEnd(8)}`
      );
    }
  }

  // Aggregate table (combined ETH + BTC)
  console.log('\n' + '='.repeat(100));
  console.log('AGGREGATE METRICS (Combined ETH + BTC)');
  console.log('='.repeat(100));

  console.log(
    `\n${'Config'.padEnd(25)} | ${'Combined PnL'.padEnd(15)} | ${'Avg MaxDD%'.padEnd(12)} | ${'Avg Sharpe'.padEnd(12)} | ${'Avg Sortino'.padEnd(12)}`
  );
  console.log('-'.repeat(80));

  for (const c of candidates) {
    let totalPnl = 0;
    let totalMaxDD = 0;
    let totalSharpe = 0;
    let totalSortino = 0;

    for (const s of symbols) {
      const backtester = new ConvexityBacktesterWithFoR('RiskAnalysis');
      backtester.optimizationParams = {
        ...backtester.optimizationParams,
        scoutTargetMultiplier: c.scoutTargetMultiplier,
        scoutStopMultiplier: c.scoutStopMultiplier,
      } as any;

      const res: BacktestResult = backtester.run({ symbol: s.symbol, dataPath: s.data });
      const metrics = computeRiskMetrics(res);

      totalPnl += metrics.pnl;
      totalMaxDD += metrics.maxDrawdown;
      totalSharpe += metrics.sharpe;
      totalSortino += metrics.sortino;
    }

    const avgMaxDD = totalMaxDD / symbols.length;
    const avgSharpe = totalSharpe / symbols.length;
    const avgSortino = totalSortino / symbols.length;

    console.log(
      `${c.name.padEnd(25)} | ${totalPnl.toFixed(2).padEnd(15)} | ${avgMaxDD.toFixed(2).padEnd(12)} | ${avgSharpe.toFixed(2).padEnd(12)} | ${avgSortino.toFixed(2).padEnd(12)}`
    );
  }

  console.log('\n' + '='.repeat(100));
}

main().catch(err => { console.error(err); process.exit(1); });
