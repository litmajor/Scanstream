/**
 * Debug ETH FoR distribution with very low threshold
 */

import fs from 'fs';
import FailureOfReversionCalculator from '../services/vfmd/failureOfReversionCalculator.ts';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function calculateATR(candles: Candle[], period: number, index: number): number {
  if (index < period) return 0;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - (i > 0 ? candles[i - 1].close : candles[i].close)),
      Math.abs(candles[i].low - (i > 0 ? candles[i - 1].close : candles[i].close))
    );
    sum += tr;
  }
  return sum / period;
}

function calculateSMA(candles: Candle[], period: number, index: number): number {
  if (index < period - 1) return 0;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += candles[i].close;
  }
  return sum / period;
}

const dataPath = './data/cache/ETHUSDT_1h_365d.json';
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const candles: Candle[] = rawData.map((d: any) => ({
  timestamp: d.t || 0,
  open: d.o,
  high: d.h,
  low: d.l,
  close: d.c,
  volume: d.v
}));

console.log('\n' + '='.repeat(70));
console.log('DEBUG: ETH FoR Distribution Analysis');
console.log('='.repeat(70));

const forCalculator = new FailureOfReversionCalculator();
const forScores: number[] = [];
const thresholdCounts: Record<number, number> = {};
[10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(t => thresholdCounts[t] = 0);

for (let i = 10; i < candles.length; i++) {
  const currentPrice = candles[i].close;
  const fairPrice = calculateSMA(candles, 50, i);
  const atr = calculateATR(candles, 14, i);

  if (fairPrice === 0) continue;

  forCalculator.processTick(candles[i], fairPrice, currentPrice, atr);
  const forState = forCalculator.calculateFoR(currentPrice, fairPrice, atr);
  const forScorePct = forState.forScore * 100;

  forScores.push(forScorePct);

  // Count threshold crossings
  Object.keys(thresholdCounts).forEach(t => {
    const threshold = parseInt(t);
    if (forScorePct > threshold) {
      thresholdCounts[threshold]++;
    }
  });
}

const sorted = [...forScores].sort((a, b) => b - a);
const avg = forScores.reduce((a, b) => a + b, 0) / forScores.length;
const max = Math.max(...forScores);
const min = Math.min(...forScores);
const p95 = sorted[Math.floor(sorted.length * 0.05)];
const p50 = sorted[Math.floor(sorted.length * 0.50)];

console.log('\n📊 FoR SCORE STATISTICS:');
console.log(`  Average: ${avg.toFixed(2)}%`);
console.log(`  Max: ${max.toFixed(2)}%`);
console.log(`  Min: ${min.toFixed(2)}%`);
console.log(`  Median (50th): ${p50.toFixed(2)}%`);
console.log(`  P95: ${p95.toFixed(2)}%`);

console.log('\n📈 THRESHOLD CROSSING FREQUENCY:');
Object.keys(thresholdCounts)
  .sort((a, b) => parseInt(a) - parseInt(b))
  .forEach(t => {
    const threshold = parseInt(t);
    const count = thresholdCounts[threshold];
    const pct = ((count / forScores.length) * 100).toFixed(2);
    console.log(`  FoR > ${threshold}%: ${count} times (${pct}% of bars)`);
  });

console.log('\n📍 SAMPLE FoR SCORES (first 100 bars):');
for (let i = 0; i < Math.min(100, forScores.length); i += 10) {
  console.log(`  Bar ${i + 10}: ${forScores[i].toFixed(1)}%`);
}

console.log('\n' + '='.repeat(70));
