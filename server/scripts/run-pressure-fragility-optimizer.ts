/**
 * Run Pressure-Fragility Optimizer on cached market data
 * Loads 1h OHLCV data from cache and optimizes signal quality thresholds
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runPressureFragilityOptimization } from '../services/vfmd/peg-optimizer';
import { MarketTick } from '../services/vfmd/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Load cached market data
// ─────────────────────────────────────────────────────────────────────────────

function loadCachedData(pair: string, year: string): MarketTick[] {
  const cacheDir = path.join(__dirname, '../../data/cache');
  const cacheFile = path.join(cacheDir, `${pair}_1h_${year}.json`);

  if (!fs.existsSync(cacheFile)) {
    console.error(`❌ Cache file not found: ${cacheFile}`);
    console.log(`   Available cache files in ${cacheDir}:`);
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
      files.forEach(f => console.log(`   - ${f}`));
    } else {
      console.log(`   (No cache directory exists)`);
    }
    process.exit(1);
  }

  console.log(`📦 Loading cached data from: ${cacheFile}`);
  const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const candles = Array.isArray(data) ? data : (data.data || data.ticks || data);
  console.log(`   ✅ Loaded ${candles.length} candles from ${pair}`);
  return candles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 PRESSURE-FRAGILITY OPTIMIZER');
  console.log('='.repeat(70));

  try {
    // Load BTC 2025 data (most comprehensive recent data)
    const btcData = loadCachedData('BTCUSDT', '2025');
    console.log('');

    // Run optimization
    console.log('🚀 Running optimizer on BTC 1h candles...');
    const report = await runPressureFragilityOptimization(
      btcData,
      0.015,  // 1.5% min move
      15      // 15 candle look-ahead
    );

    console.log('\n✅ Optimization complete!');
    console.log('');
    console.log('📋 Recommendation:');
    console.log(JSON.stringify(report.recommendation, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
