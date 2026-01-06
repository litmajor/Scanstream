/**
 * Debug: Analyze Gradient Metrics to understand what's happening
 */

import * as fs from 'fs';
import type { MarketTick } from '../services/vfmd/types';

function calculateGradientMetrics(prices: number[], period: number) {
  if (prices.length < period + 5) {
    return {
      direction: 0,
      strength: 0,
      acceleration: 0,
      momentum: 0,
      priceAboveMid: false,
      distanceFromUpper: 0,
      distanceFromLower: 0,
      avgGradient: 0
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

  return { direction, strength, avgGradient };
}

async function main() {
  const pair = 'BTCUSDT';
  const cacheFile = `./data/cache/${pair}_1h_365d.json`;

  if (!fs.existsSync(cacheFile)) {
    console.error(`Cache file not found: ${cacheFile}`);
    process.exit(1);
  }

  const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
  const prices = ticks.map(t => t.close);

  console.log(`Analyzing ${prices.length} candles...\n`);

  // Sample analysis at different points
  const sampleIndices = [240, 500, 1000, 2000, 4000, 8000];

  for (const idx of sampleIndices) {
    if (idx < prices.length) {
      const metrics = calculateGradientMetrics(prices.slice(0, idx), 25);
      const price = prices[idx];
      
      console.log(`Index ${idx} (Candle #${idx})`);
      console.log(`  Price: $${price.toFixed(2)}`);
      console.log(`  Avg Gradient (over last 25): ${(metrics.avgGradient * 100).toFixed(4)}%`);
      console.log(`  Direction: ${metrics.direction === 1 ? 'BULLISH' : metrics.direction === -1 ? 'BEARISH' : 'NEUTRAL'}`);
      console.log(`  Strength: ${metrics.strength.toFixed(2)}`);
      console.log('');
    }
  }

  // Count how many times direction is 1, -1, or 0
  let dirCounts = { bullish: 0, bearish: 0, neutral: 0 };
  for (let i = 120; i < prices.length; i++) {
    const metrics = calculateGradientMetrics(prices.slice(0, i), 25);
    if (metrics.direction === 1) dirCounts.bullish++;
    else if (metrics.direction === -1) dirCounts.bearish++;
    else dirCounts.neutral++;
  }

  console.log('DIRECTION DISTRIBUTION (120 to end):');
  console.log(`  Bullish: ${dirCounts.bullish}`);
  console.log(`  Bearish: ${dirCounts.bearish}`);
  console.log(`  Neutral: ${dirCounts.neutral}`);
}

main();
