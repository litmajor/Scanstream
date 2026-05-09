import fs from 'fs';

const data = JSON.parse(fs.readFileSync('ETH_OPTIMIZATION_RESULTS.json', 'utf-8'));
const results = Array.isArray(data) ? data : Object.values(data).flat();

// Filter for 3% target / 1.75% SL
const filtered = results.filter(r => r.config.target === 3 && r.config.stopLoss === 1.75);

// Sort by EV descending
filtered.sort((a, b) => b.expectedValue - a.expectedValue);

console.log('\n3% TARGET / 1.75% SL - TOP 10 CONFIGURATIONS:\n');
console.log('FoR | Hold | Trades | WR%   | EV%      | Annual%');
console.log('--- | ---- | ------ | ----- | -------- | --------');

for (let i = 0; i < Math.min(10, filtered.length); i++) {
  const r = filtered[i];
  const for_val = r.config.forThreshold;
  const hold = r.config.holdingBars;
  const trades = r.trades;
  const wr = (r.winRate * 100).toFixed(1);
  const ev = (r.expectedValue * 100).toFixed(4);
  const annual = (r.expectedValue * 100 * 252).toFixed(1);
  
  console.log(`${for_val}%  |  ${hold}  |  ${trades}    | ${wr}%  | ${ev}% | ${annual}%`);
}

console.log('\n');
