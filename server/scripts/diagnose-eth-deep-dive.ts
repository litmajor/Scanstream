/**
 * ETH Signal Deep Dive - Check if analyzeVFMD is working
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;

async function main() {
  try {
    console.log('🔬 DEEP DIVE: ETH Signal Analysis\n');
    
    const agent = new VFMDPhysicsAgent('backtest', 'balanced');
    agent.setAsset('ETH');
    
    // Load ETH data
    const cacheFile = `./data/cache/ETHUSDT_1h_${DATA_DAYS}d.json`;
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    
    console.log(`Loaded ${ticks.length} ETH candles\n`);

    // Analyze regimes first
    const regimes: string[] = [];
    for (let i = 20; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const analysis = agent.getAnalysisForUI(historicalTicks);
      regimes[i] = analysis?.regime?.classification || 'UNKNOWN';
    }

    // Check signals at specific indices with full analysis
    console.log('SIGNAL SAMPLE ANALYSIS:\n');
    
    const sampleIndices = [50, 100, 200, 500, 1000, 2000, 5000];
    
    for (const i of sampleIndices) {
      const historicalTicks = ticks.slice(0, i + 1);
      const signal = agent.generateSignal(historicalTicks);
      const regime = regimes[i];
      
      console.log(`Index ${i} (${new Date(ticks[i].timestamp).toISOString().split('T')[0]}):`);
      console.log(`  Regime: ${regime}`);
      console.log(`  Action: ${signal.action}`);
      console.log(`  Confidence: ${signal.confidence.toFixed(4)}`);
      console.log(`  Reason: ${signal.reason}`);
      
      if (signal.action === 'HOLD') {
        // Try to infer which gate failed
        if (signal.reason.includes('data')) {
          console.log(`  ➜ BLOCKER: analyzeVFMD returned null or insufficient data`);
        } else if (signal.reason.includes('Energy')) {
          console.log(`  ➜ BLOCKER: PEG energy gate failed`);
        } else if (signal.reason.includes('Permission')) {
          console.log(`  ➜ BLOCKER: TRIGGER permission gate failed`);
        } else if (signal.reason.includes('Profit')) {
          console.log(`  ➜ BLOCKER: Profit score too low`);
        } else {
          console.log(`  ➜ BLOCKER: Unknown reason`);
        }
      } else {
        console.log(`  ✅ SIGNAL GENERATED!`);
      }
      console.log('');
    }

    // Find first BUY/SELL signal if any exist
    console.log('\nSearching for first BUY/SELL signal...\n');
    let found = false;
    for (let i = 20; i < Math.min(5000, ticks.length - 1); i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const signal = agent.generateSignal(historicalTicks);
      
      if (signal.action !== 'HOLD') {
        console.log(`✅ FOUND at index ${i}:`);
        console.log(`   Date: ${new Date(ticks[i].timestamp).toISOString()}`);
        console.log(`   Regime: ${regimes[i]}`);
        console.log(`   Action: ${signal.action}`);
        console.log(`   Confidence: ${signal.confidence.toFixed(4)}`);
        console.log(`   Entry: ${signal.entry.toFixed(2)}`);
        console.log(`   Target: ${signal.target.toFixed(2)}`);
        console.log(`   Stop: ${signal.stop.toFixed(2)}`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('❌ No BUY/SELL signals found in first 5000 candles');
      console.log('\nThis indicates analyzeVFMD is working but filtering all signals.');
      console.log('Likely causes:');
      console.log('  1. PEG threshold (energy) is too strict for ETH');
      console.log('  2. TRIGGER threshold (permission) is too strict for ETH');
      console.log('  3. Profit score threshold still too high (need to lower further from 55→45)');
    }

  } catch (error) {
    console.error('❌ Deep dive failed:', error);
    process.exit(1);
  }
}

main();
