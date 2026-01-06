/**
 * Real Money Simulation
 * Account: $5,000
 * Risk per trade: 3%
 * Stop loss: 2.5%
 * Testing different target levels
 */

console.log('💰 REAL MONEY SIMULATION - $5,000 ACCOUNT');
console.log('='.repeat(70));
console.log();

const startingCapital = 5000;
const riskPerTrade = 0.03; // 3%
const stopLoss = 0.025; // 2.5%

// Simulate trades
function simulateTrades(asset: string, winRate: number, avgWinPct: number, avgLossPct: number, targetPct: number, holdingPeriod: number) {
  console.log(`\n📊 ${asset} Simulation`);
  console.log(`  Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`  Holding Period: ${holdingPeriod} bars`);
  console.log(`  Target: ${targetPct.toFixed(1)}% | Stop: ${stopLoss * 100}% | Risk/Reward: 1:${(targetPct / stopLoss).toFixed(2)}`);
  console.log('-'.repeat(70));

  // Calculate trades per year
  const barsPerYear = asset === 'BTC' ? 8760 : 8760;
  const tradesPerYear = asset === 'BTC' ? 91 : 169;

  // Simulate first 10 trades to show progression
  let equity = startingCapital;
  let wins = 0;
  let losses = 0;
  const trades = [];

  console.log('\nFirst 10 Trades:');
  console.log('Trade | Entry Equity | Risk $ | Position | Win/Loss | Exit Equity');
  console.log('------|--------------|--------|----------|----------|------------');

  for (let i = 0; i < 10; i++) {
    const isWin = Math.random() < winRate / 100;
    const riskDollars = equity * riskPerTrade;
    const stopLossDollars = riskDollars; // Stop loss = risk amount
    
    // For simulation, assume avg entry price
    const avgEntryPrice = asset === 'BTC' ? 95000 : 2500;
    const positionSize = riskDollars / (avgEntryPrice * stopLoss);
    
    let pnl: number;
    if (isWin) {
      pnl = riskDollars * (targetPct / stopLoss); // Risk/Reward payout
      wins++;
    } else {
      pnl = -riskDollars;
      losses++;
    }

    const newEquity = equity + pnl;
    trades.push({ equity, pnl, newEquity, isWin });

    const tradeResult = isWin ? 'WIN' : 'LOSS';
    const pnlStr = pnl > 0 ? `+$${pnl.toFixed(0)}` : `-$${Math.abs(pnl).toFixed(0)}`;
    console.log(`${(i + 1).toString().padEnd(5)} | $${equity.toFixed(0).padEnd(11)} | $${riskDollars.toFixed(0).padEnd(6)} | ${positionSize.toFixed(3).padEnd(8)} | ${tradeResult.padEnd(8)} | $${newEquity.toFixed(0)}`);

    equity = newEquity;
  }

  // Extrapolate to full year
  const totalTrades = tradesPerYear;
  const expectedWins = Math.round(totalTrades * (winRate / 100));
  const expectedLosses = totalTrades - expectedWins;
  
  // Calculate expected equity at end of year
  let yearEndEquity = startingCapital;
  for (let i = 0; i < totalTrades; i++) {
    const riskDollars = yearEndEquity * riskPerTrade;
    const isWin = i < expectedWins;
    
    let pnl: number;
    if (isWin) {
      pnl = riskDollars * (targetPct / stopLoss);
    } else {
      pnl = -riskDollars;
    }
    
    yearEndEquity += pnl;
  }

  const returnPct = ((yearEndEquity - startingCapital) / startingCapital) * 100;
  const totalProfit = yearEndEquity - startingCapital;

  console.log('\n📈 Year-End Projection:');
  console.log(`  Expected Trades: ${totalTrades}`);
  console.log(`  Expected Wins: ${expectedWins}`);
  console.log(`  Expected Losses: ${expectedLosses}`);
  console.log(`  Starting Capital: $${startingCapital.toFixed(0)}`);
  console.log(`  Year-End Equity: $${yearEndEquity.toFixed(0)}`);
  console.log(`  Total Profit: $${totalProfit.toFixed(0)}`);
  console.log(`  Return: ${returnPct.toFixed(1)}%`);

  if (yearEndEquity > startingCapital * 2) {
    console.log(`  🚀 EXCEPTIONAL: More than 2x in one year!`);
  } else if (yearEndEquity > startingCapital * 1.5) {
    console.log(`  ⭐ EXCELLENT: 50%+ return in one year!`);
  } else if (yearEndEquity > startingCapital * 1.2) {
    console.log(`  ✅ VERY GOOD: 20%+ return in one year!`);
  }

  return {
    yearEndEquity,
    totalProfit,
    returnPct,
    expectedWins,
    expectedLosses
  };
}

// BTC scenarios
console.log('\n' + '='.repeat(70));
console.log('BTC/USDT (90.1% Win Rate, 91 trades/year)');
console.log('='.repeat(70));

const btcResults = [
  { target: 2.0, name: 'Conservative (Current)' },
  { target: 3.0, name: 'Recommended' },
  { target: 4.0, name: 'Aggressive' }
];

const btcSimulations = btcResults.map(r => ({
  ...r,
  results: simulateTrades('BTC', 90.1, 0.036, 0.025, r.target, 30)
}));

// ETH scenarios
console.log('\n' + '='.repeat(70));
console.log('ETH/USDT (75.7% Win Rate, 169 trades/year)');
console.log('='.repeat(70));

const ethResults = [
  { target: 2.0, name: 'Conservative (Current)' },
  { target: 3.0, name: 'Recommended' },
  { target: 4.0, name: 'Aggressive' }
];

const ethSimulations = ethResults.map(r => ({
  ...r,
  results: simulateTrades('ETH', 75.7, 0.005, 0.025, r.target, 8)
}));

// Summary comparison
console.log('\n\n' + '='.repeat(70));
console.log('📊 SUMMARY: $5,000 ACCOUNT COMPARISON');
console.log('='.repeat(70));

console.log('\nBTC/USDT TARGETS:');
console.log('Target | Year-End Equity | Profit  | Return | Expected Trades');
console.log('-------|-----------------|---------|--------|----------------');
for (const sim of btcSimulations) {
  console.log(`${sim.target.toFixed(1)}%    | $${sim.results.yearEndEquity.toFixed(0).padEnd(14)} | $${sim.results.totalProfit.toFixed(0).padEnd(7)} | ${sim.results.returnPct.toFixed(1)}%  | ${sim.results.expectedWins + sim.results.expectedLosses}`);
}

console.log('\nETH/USDT TARGETS:');
console.log('Target | Year-End Equity | Profit  | Return | Expected Trades');
console.log('-------|-----------------|---------|--------|----------------');
for (const sim of ethSimulations) {
  console.log(`${sim.target.toFixed(1)}%    | $${sim.results.yearEndEquity.toFixed(0).padEnd(14)} | $${sim.results.totalProfit.toFixed(0).padEnd(7)} | ${sim.results.returnPct.toFixed(1)}%  | ${sim.results.expectedWins + sim.results.expectedLosses}`);
}

console.log('\n\n💡 KEY TAKEAWAYS:');
console.log('='.repeat(70));
console.log();
console.log('🏆 BEST CASE (Both 4% targets):');
console.log(`  • BTC: $5,000 → $${btcSimulations[2].results.yearEndEquity.toFixed(0)}`);
console.log(`  • ETH: $5,000 → $${ethSimulations[2].results.yearEndEquity.toFixed(0)}`);
console.log(`  • Combined potential: Turn $5k into $15k+ in one year`);
console.log();
console.log('🎯 RECOMMENDED (Both 3% targets):');
console.log(`  • BTC: $5,000 → $${btcSimulations[1].results.yearEndEquity.toFixed(0)}`);
console.log(`  • ETH: $5,000 → $${ethSimulations[1].results.yearEndEquity.toFixed(0)}`);
console.log(`  • More sustainable, still exceptional returns`);
console.log();
console.log('⚠️  REALITY CHECK:');
console.log('  • These are BACKTESTED results');
console.log('  • Live trading may have slippage, gaps, drawdowns');
console.log('  • Start small, validate edge in real money before scaling');
console.log('  • Consider risk of ruin (large consecutive losses)');
console.log();
console.log('🛡️  RISK MANAGEMENT SUGGESTION:');
console.log('  • Cap position to 3-5% of account per trade');
console.log('  • Keep max drawdown limit (e.g., stop if -20% from peak)');
console.log('  • Use trailing stops after 2% profit lock-in');
console.log('  • Monitor for regime changes that reduce win rate');
