/**
 * Quick angle check
 */
import * as fs from 'fs';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';

try {
  console.error('Starting angle analysis...');
  
  const cacheFile = './data/cache/BTCUSDT_1h_365d.json';
  console.error(`Cache file: ${cacheFile}`);
  console.error(`Exists: ${fs.existsSync(cacheFile)}`);
  
  const rawData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const candles = Array.isArray(rawData) ? rawData : (rawData.data || rawData.ticks || []);
  
  console.log(`Loaded ${candles.length} candles`);
  
  const fieldConstructor = new FieldConstructor(50, 100);
  const angles: number[] = [];
  
  const windowSize = 100;
  console.log(`Processing with window size ${windowSize}...`);
  
  for (let i = windowSize; i < Math.min(windowSize + 100, candles.length); i++) {
    const slice = candles.slice(i - windowSize, i);
    const prices = slice.map(c => c.close);
    const field = fieldConstructor.constructField(prices);
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    angles.push(metrics.dominantAngle);
  }
  
  console.log(`Collected ${angles.length} angle samples`);
  console.log(`Angles (first 10): ${angles.slice(0, 10).map(a => a.toFixed(4)).join(', ')}`);
  
  const sorted = [...angles].sort((a, b) => a - b);
  const positiveCount = angles.filter(a => a > 0).length;
  const negativeCount = angles.filter(a => a < 0).length;
  const zeroCount = angles.filter(a => a === 0).length;
  
  console.log(`Positive angles: ${positiveCount}`);
  console.log(`Negative angles: ${negativeCount}`);
  console.log(`Zero angles: ${zeroCount}`);
  console.log(`Min: ${sorted[0].toFixed(4)}, Max: ${sorted[sorted.length-1].toFixed(4)}`);
  
} catch (err) {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
}
