/**
 * Debug: Analyze dominantAngle distribution
 */
import * as fs from 'fs';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import { PhysicsCalculator } from '../services/vfmd/physicsCalculator';

interface Candle {
  timestamp: number;
  close: number;
}

const cacheFile = './data/cache/BTCUSDT_1h_365d.json';

if (!fs.existsSync(cacheFile)) {
  console.error(`❌ File not found: ${cacheFile}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
const candles: Candle[] = Array.isArray(rawData) ? rawData : (rawData.data || rawData.ticks || []);

if (candles.length === 0) {
  console.error('❌ No candles loaded');
  process.exit(1);
}

console.log(`📊 Analyzing dominantAngle distribution across ${candles.length} candles\n`);

const fieldConstructor = new FieldConstructor(50, 100);
const angles: number[] = [];
const samples: { idx: number; angle: number; angleDeg: number }[] = [];

const windowSize = 100;
for (let i = windowSize; i < Math.min(windowSize + 500, candles.length); i++) {
  const slice = candles.slice(i - windowSize, i);
  const prices = slice.map(c => c.close);
  const field = fieldConstructor.constructField(prices);
  const metrics = PhysicsCalculator.computeAllMetrics(field);
  
  angles.push(metrics.dominantAngle);
  if (i % 50 === 0) {
    const angleDeg = (metrics.dominantAngle * 180) / Math.PI;
    samples.push({ idx: i, angle: metrics.dominantAngle, angleDeg });
  }
}

console.log('Samples of dominantAngle values:');
for (const s of samples) {
  console.log(`  Index ${s.idx}: angle=${s.angle.toFixed(4)} rad (${s.angleDeg.toFixed(1)}°)`);
}

// Stats
const sorted = [...angles].sort((a, b) => a - b);
const mean = angles.reduce((a, b) => a + b, 0) / (angles.length || 1);
const min = sorted[0] || 0;
const max = sorted[sorted.length - 1] || 0;
const p25 = sorted[Math.floor(sorted.length * 0.25)] || 0;
const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;

console.log('');
console.log('Angle Statistics (radians):');
if (angles.length > 0) {
  console.log(`  min=${min.toFixed(4)}, p25=${p25.toFixed(4)}, p50=${p50.toFixed(4)}, p75=${p75.toFixed(4)}, max=${max.toFixed(4)}, mean=${mean.toFixed(4)}`);
} else {
  console.log('  (no angles computed)');
}
console.log('');
console.log('Angle Statistics (degrees):');
if (angles.length > 0) {
  const meanDeg = (mean * 180) / Math.PI;
  const minDeg = (min * 180) / Math.PI;
  const maxDeg = (max * 180) / Math.PI;
  console.log(`  min=${minDeg.toFixed(1)}°, mean=${meanDeg.toFixed(1)}°, max=${maxDeg.toFixed(1)}°`);
} else {
  console.log('  (no angles computed)');
}
console.log('');

// Count negative angles
const negativeCount = angles.filter(a => a < -0.3).length;
const positiveCount = angles.filter(a => a > 0.3).length;
const neutralCount = angles.filter(a => Math.abs(a) <= 0.3).length;

console.log('Direction Bias (threshold ±0.3 rad = ±17.2°):');
console.log(`  LONG (angle > 0.3):       ${positiveCount} candles`);
console.log(`  SHORT (angle < -0.3):     ${negativeCount} candles`);
console.log(`  NEUTRAL (|angle| ≤ 0.3):  ${neutralCount} candles`);
console.log('');
if (angles.length > 0) {
  const longPct = ((positiveCount / angles.length) * 100).toFixed(1);
  const shortPct = ((negativeCount / angles.length) * 100).toFixed(1);
  console.log(`Distribution: LONG=${longPct}%, SHORT=${shortPct}%, NEUTRAL=${((neutralCount/angles.length)*100).toFixed(1)}%`);
}
console.log('');
console.log('Analysis: 2025 BTC was strong bull market → expect positive bias (LONG bias)');
console.log('SHORT signals would occur on local pullbacks/reversals within the bull trend.');
