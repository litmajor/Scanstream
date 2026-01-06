/**
 * CONSERVATIVE MONEY SIMULATION
 * Accounts for realistic drawdowns and market regime changes
 */

console.log('💰 CONSERVATIVE MONEY SIMULATION - $5,000 ACCOUNT');
console.log('='.repeat(70));
console.log();
console.log('Key assumptions:');
console.log('  • Starting capital: $5,000');
console.log('  • Risk per trade: 3% of current equity');
console.log('  • Stop loss: 2.5%');
console.log('  • Win rate: Backtest average (90% BTC, 76% ETH)');
console.log('  • REALISTIC DRAWDOWN: -20% from peak = pause for recovery');
console.log('  • Market regime change: Every 3 months, win rate drops 15%');
console.log('  • Slippage: 0.1% on entry + 0.1% on exit');
console.log();
console.log('='.repeat(70));
console.log();

const startingCapital = 5000;
const riskPerTrade = 0.03;
const maxDrawdownPercent = -0.20; // Stop if -20% from peak
const slippagePercent = 0.002; // 0.1% entry + 0.1% exit

function simulateConservative(
  asset: string,
  baseWinRate: number,
  tradesPerYear: number,
  targetPct: number
) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${asset} - Target: ${targetPct}% | Base WR: ${baseWinRate}% | Trades/Year: ${tradesPerYear}`);
  console.log('='.repeat(70));

  const stopLossRatio = targetPct / 2.5;
  let equity = startingCapital;
  let peakEquity = startingCapital;
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let paused = false;
  let pausedAt = 0;

  // Simulate with regime changes
  const tradesPerRegime = Math.floor(tradesPerYear / 4); // 4 quarters
  let currentWinRate = baseWinRate;

  for (let i = 0; i < tradesPerYear; i++) {
    // Every quarter, reduce win rate by 15% to simulate regime change
    if (i > 0 && i % tradesPerRegime === 0) {
      currentWinRate = Math.max(50, baseWinRate - 15);
      console.log(`   [Q${Math.ceil((i + 1) / tradesPerRegime)}] Win rate adjusted to ${currentWinRate.toFixed(1)}% (market regime change)`);
    }

    // Check drawdown
    const drawdown = (equity - peakEquity) / peakEquity;
    if (drawdown <= maxDrawdownPercent && !paused) {
      paused = true;
      pausedAt = equity;
      console.log(`   ⚠️  PAUSE at trade ${i + 1}: Drawdown ${(drawdown * 100).toFixed(1)}% from peak. Pausing trading.`);
      continue; // Skip this trade, wait for recovery
    }

    // Recovery check - resume if back to 90% of peak
    if (paused && equity >= peakEquity * 0.90) {
      paused = false;
      console.log(`   ✅ RESUME at trade ${i + 1}: Equity recovered to $${equity.toFixed(0)}`);
    }

    if (paused) {
      continue; // Still paused, skip trade
    }

    totalTrades++;
    const riskDollars = equity * riskPerTrade;
    const slippage = riskDollars * slippagePercent;

    // Determine win/loss based on current win rate
    const isWin = Math.random() < currentWinRate / 100;

    let pnlDollars: number;
    if (isWin) {
      pnlDollars = riskDollars * stopLossRatio - slippage;
      wins++;
    } else {
      pnlDollars = -riskDollars - slippage;
      losses++;
    }

    equity = Math.max(0, equity + pnlDollars); // Can't go below 0

    if (equity > peakEquity) {
      peakEquity = equity;
    }
  }

  const finalEquity = equity;
  const totalProfit = finalEquity - startingCapital;
  const returnPct = (totalProfit / startingCapital) * 100;
  const actualWinRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  console.log(`\n📊 Year-End Summary:`);
  console.log(`  Starting Capital: $${startingCapital.toFixed(0)}`);
  console.log(`  Trades Executed: ${totalTrades} (out of ${tradesPerYear} attempted)`);
  console.log(`  Actual Wins/Losses: ${wins}/${losses}`);
  console.log(`  Actual Win Rate: ${actualWinRate.toFixed(1)}%`);
  console.log(`  Peak Equity: $${peakEquity.toFixed(0)}`);
  console.log(`  Final Equity: $${finalEquity.toFixed(0)}`);
  console.log(`  Total Profit: $${totalProfit.toFixed(0)}`);
  console.log(`  Return: ${returnPct.toFixed(1)}%`);

  if (returnPct > 100) {
    console.log(`  ⭐ EXCELLENT - 2x+ return with realistic constraints`);
  } else if (returnPct > 50) {
    console.log(`  ✅ GOOD - 50%+ return accounts for drawdowns`);
  } else if (returnPct > 0) {
    console.log(`  ✓ POSITIVE - Held equity with regime changes`);
  } else {
    console.log(`  ❌ NEGATIVE - Market conditions unfavorable`);
  }

  return { finalEquity, totalProfit, returnPct, actualWinRate };
}

// Run simulations
const results: any[] = [];

console.log('\n🔵 BTC/USDT SIMULATIONS');
const btcResults = [
  { target: 2.0, trades: 91, wr: 90.1 },
  { target: 3.0, trades: 91, wr: 90.1 },
  { target: 4.0, trades: 91, wr: 90.1 }
];

for (const r of btcResults) {
  const sim = simulateConservative(`BTC (${r.target}%)`, r.wr, r.trades, r.target);
  results.push({ asset: 'BTC', target: r.target, ...sim });
}

console.log('\n🟢 ETH/USDT SIMULATIONS');
const ethResults = [
  { target: 2.0, trades: 169, wr: 75.7 },
  { target: 3.0, trades: 169, wr: 75.7 },
  { target: 4.0, trades: 169, wr: 75.7 }
];

for (const r of ethResults) {
  const sim = simulateConservative(`ETH (${r.target}%)`, r.wr, r.trades, r.target);
  results.push({ asset: 'ETH', target: r.target, ...sim });
}

// Summary table
console.log(`\n\n${'='.repeat(70)}`);
console.log('📊 SUMMARY: WITH REALISTIC DRAWDOWN CONSTRAINTS');
console.log('='.repeat(70));

console.log('\nBTC/USDT:');
console.log('Target | Final Equity | Profit  | Return');
console.log('-------|--------------|---------|--------');
for (const r of results.filter(x => x.asset === 'BTC')) {
  console.log(
    `${r.target.toFixed(1)}%    | $${r.finalEquity.toFixed(0).padEnd(12)} | $${r.totalProfit.toFixed(0).padEnd(7)} | ${r.returnPct.toFixed(1)}%`
  );
}

console.log('\nETH/USDT:');
console.log('Target | Final Equity | Profit  | Return');
console.log('-------|--------------|---------|--------');
for (const r of results.filter(x => x.asset === 'ETH')) {
  console.log(
    `${r.target.toFixed(1)}%    | $${r.finalEquity.toFixed(0).padEnd(12)} | $${r.totalProfit.toFixed(0).padEnd(7)} | ${r.returnPct.toFixed(1)}%`
  );
}

console.log(`\n${'='.repeat(70)}`);
console.log('💡 REALISTIC INTERPRETATION:');
console.log('='.repeat(70));

const btc3 = results.find(r => r.asset === 'BTC' && r.target === 3.0);
const eth3 = results.find(r => r.asset === 'ETH' && r.target === 3.0);

console.log();
console.log(`BTC (3% target): $5,000 → $${btc3.finalEquity.toFixed(0)} (+${btc3.returnPct.toFixed(0)}%)`);
console.log(`ETH (3% target): $5,000 → $${eth3.finalEquity.toFixed(0)} (+${eth3.returnPct.toFixed(0)}%)`);
console.log();
console.log('🎯 RECOMMENDATION:');
if (btc3.returnPct > 100 && eth3.returnPct > 100) {
  console.log('   ✅ Both assets show 100%+ returns even with drawdown pauses');
  console.log('   → Trade BTC for more consistent results (90% WR)');
  console.log('   → Trade ETH for higher frequency (169 trades vs 91)');
  console.log('   → Start with 1-2% risk (not 3%) until you hit 50+ trades');
} else if (btc3.returnPct > 50 || eth3.returnPct > 50) {
  console.log('   ✅ Realistic 50%+ returns with proper risk management');
  console.log('   → These are achievable goals with discipline');
  console.log('   → Paper trade first to validate');
} else {
  console.log('   ⚠️  Results show need for further optimization');
  console.log('   → Focus on win rate improvement');
  console.log('   → Test on live data before deploying');
}

console.log();
console.log('⚠️  KEY ASSUMPTIONS:');
console.log('   • Drawdown pause: If equity drops 20%, pause for recovery');
console.log('   • Regime change: Every 3 months, win rate -15% (market volatility)');
console.log('   • Slippage: 0.2% total per trade (0.1% entry + 0.1% exit)');
console.log('   • Randomization: Real trades vary month to month');
console.log();
console.log('🛡️  NEXT STEPS:');
console.log('   1. Paper trade 50+ times on live data');
console.log('   2. Monitor: Are you hitting 80%+ win rate? 2%+ avg win?');
console.log('   3. If live WR < backtest WR by >10%, adjust parameters');
console.log('   4. Start real money with 1% risk per trade (not 3%)');
console.log('   5. Scale to 3% after 100 live trades with consistent results');
