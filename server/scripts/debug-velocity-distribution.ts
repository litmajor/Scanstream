import fs from 'fs';
import path from 'path';
import { FieldConstructor } from '../services/vfmd/fieldConstructor';
import TriggerCalculator from '../services/vfmd/triggerCalculator';
import type { VectorField } from '../services/vfmd/types';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function loadCandles(filePath: string): Candle[] {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : (data.data || data.ticks || []);
}

function candlesToVectorField(candles: Candle[]): VectorField {
  const fieldConstructor = new FieldConstructor(50, 100);
  const prices = candles.map(c => c.close);
  return fieldConstructor.constructField(prices);
}

const candlesCachePath = path.join(process.cwd(), 'data', 'cache', 'BTCUSDT_1h_365d.json');
const candles = loadCandles(candlesCachePath);

// Test compression PEG calculation on actual data
const windowSize = 100;

// Collect velocity samples from multiple windows
const velocitySamples = [];
const compressionSamples = [];
const spatialGradientSamples = [];

for (let i = windowSize; i < Math.min(windowSize + 200, candles.length); i++) {
  const slice = candles.slice(i - windowSize, i);
  const field = candlesToVectorField(slice);
  
  // Use ACTUAL TriggerCalculator method
  const compressionPEG = TriggerCalculator.computeCompressionPEG(field, 10);
  
  // Also compute spatial gradients for debugging
  const regionSize = 10;
  const data = field.data;
  const t = field.temporalWindow;
  
  // Calculate spatial gradient magnitude at recent time window
  let recentGradientEnergy = 0;
  let recentCount = 0;

  const startT = Math.max(0, t - regionSize);
  for (let j = startT; j < t; j++) {
    for (let s = 0; s < field.spatialBins - 1; s++) {
      const [vx1, ax1] = data[s][j];
      const [vx2, ax2] = data[s + 1][j];
      
      const dvx = Math.abs(vx2 - vx1);
      const dax = Math.abs(ax2 - ax1);
      
      recentGradientEnergy += Math.sqrt(dvx * dvx + dax * dax);
      recentCount++;
    }
  }

  // Calculate historical gradient for baseline
  const historicalStart = Math.max(0, t - regionSize * 3);
  const historicalEnd = Math.max(historicalStart + 1, t - regionSize);
  
  let historicalGradientEnergy = 0;
  let historicalCount = 0;

  for (let j = historicalStart; j < historicalEnd && j < t; j++) {
    for (let s = 0; s < field.spatialBins - 1; s++) {
      const [vx1, ax1] = data[s][j];
      const [vx2, ax2] = data[s + 1][j];
      
      const dvx = Math.abs(vx2 - vx1);
      const dax = Math.abs(ax2 - ax1);
      
      historicalGradientEnergy += Math.sqrt(dvx * dvx + dax * dax);
      historicalCount++;
    }
  }

  if (recentCount > 0 && historicalCount > 0) {
    const recentGradient = recentGradientEnergy / recentCount;
    const historicalGradient = historicalGradientEnergy / historicalCount;
    const baselineGradient = Math.max(historicalGradient, 1e-6);
    const ratio = recentGradient / baselineGradient;
    
    // Extract velocities for separate analysis
    const velocities: number[] = [];
    for (let s = 0; s < field.spatialBins; s++) {
      for (let j = Math.max(0, t - regionSize * 3); j < t; j++) {
        velocities.push(Math.abs(data[s][j][0]));
      }
    }
    
    velocitySamples.push(...velocities);
    compressionSamples.push({
      candle: i,
      compressionPEG: compressionPEG.toFixed(6),
    });
    spatialGradientSamples.push({
      candle: i,
      recentGradient: recentGradient.toFixed(6),
      historicalGradient: historicalGradient.toFixed(6),
      ratio: ratio.toFixed(6),
    });
  }
}

// Analyze velocity distribution
const uniqueVelocities = new Set(velocitySamples.map(v => v.toFixed(8)));
const minVel = velocitySamples.reduce((a, b) => Math.min(a, b));
const maxVel = velocitySamples.reduce((a, b) => Math.max(a, b));
const sumVel = velocitySamples.reduce((a, b) => a + b, 0);
console.log(`\n📊 VELOCITY DISTRIBUTION Analysis`);
console.log(`Total velocity samples: ${velocitySamples.length}`);
console.log(`Unique velocity values: ${uniqueVelocities.size}`);
console.log(`Min velocity: ${minVel.toFixed(8)}`);
console.log(`Max velocity: ${maxVel.toFixed(8)}`);
console.log(`Mean velocity: ${(sumVel / velocitySamples.length).toFixed(8)}`);

// Check if velocities are mostly 0
const nonZeroVelocities = velocitySamples.filter(v => v > 1e-10);
console.log(`\nNon-zero velocities: ${nonZeroVelocities.length} (${(100 * nonZeroVelocities.length / velocitySamples.length).toFixed(1)}%)`);

// Analyze compression PEG (using actual TriggerCalculator method)
const uniqueCompressions = new Set(compressionSamples.map(c => c.compressionPEG));
const pegValues = compressionSamples.map(c => parseFloat(c.compressionPEG));
const minPEG = pegValues.reduce((a, b) => Math.min(a, b));
const maxPEG = pegValues.reduce((a, b) => Math.max(a, b));
const sumPEG = pegValues.reduce((a, b) => a + b, 0);

console.log(`\n📊 COMPRESSION PEG Distribution (using TriggerCalculator.computeCompressionPEG):`);
console.log(`Total PEG samples: ${compressionSamples.length}`);
console.log(`Unique compression values: ${uniqueCompressions.size}`);
console.log(`Min PEG: ${minPEG.toFixed(6)}`);
console.log(`Max PEG: ${maxPEG.toFixed(6)}`);
console.log(`Mean PEG: ${(sumPEG / pegValues.length).toFixed(6)}`);

// Show first 10 compression samples
console.log(`\nFirst 10 compression PEG samples:`);
compressionSamples.slice(0, 10).forEach((c, i) => {
  console.log(`  ${i+1}. candle ${c.candle}: compressionPEG=${c.compressionPEG}`);
});

// Check distribution details
console.log(`\nFirst 10 spatial gradient details (for debugging):`);
spatialGradientSamples.slice(0, 10).forEach((g, i) => {
  console.log(`  ${i+1}. candle ${compressionSamples[i].candle}: recentGrad=${g.recentGradient}, histGrad=${g.historicalGradient}, ratio=${g.ratio}`);
});

// Analyze spatial gradients
const ratios = spatialGradientSamples.map(g => parseFloat(g.ratio));
const minRatio = ratios.reduce((a, b) => Math.min(a, b));
const maxRatio = ratios.reduce((a, b) => Math.max(a, b));
const sumRatio = ratios.reduce((a, b) => a + b, 0);

console.log(`\n📊 Spatial Gradient Ratio Statistics (recent/historical):`);
console.log(`Min ratio: ${minRatio.toFixed(6)}, Max ratio: ${maxRatio.toFixed(6)}`);
console.log(`Mean ratio: ${(sumRatio / ratios.length).toFixed(6)}`);
