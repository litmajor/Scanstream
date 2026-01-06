import * as fs from 'fs';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;

async function countETHSignals() {
  try {
    console.log('📊 ETH SIGNAL COUNTING');
    console.log('='.repeat(50));

    const agent = new VFMDPhysicsAgent('eth-counter', 'balanced');
    agent.setAsset('ETH');

    // Load ETH data from cache
    const cacheFile = `./data/cache/ETHUSDT_1h_${DATA_DAYS}d.json`;
    const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ticks: MarketTick[] = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);

    console.log(`\n✅ Loaded ${ticks.length} ETH candles`);
    if (ticks.length > 0) {
      console.log(`   Period: ${ticks[0].time} → ${ticks[ticks.length - 1].time}`);
    }

    // Count signals
    let buySignals = 0;
    let sellSignals = 0;
    const trades: Array<{index: number; action: string; confidence: number}> = [];

    console.log(`\n🔍 Analyzing ${ticks.length} candles...`);

    for (let i = 20; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const signal = agent.generateSignal(historicalTicks);

      if (signal.action !== 'HOLD') {
        trades.push({ index: i, action: signal.action, confidence: signal.confidence });

        if (signal.action === 'BUY') buySignals++;
        else if (signal.action === 'SELL') sellSignals++;
      }

      // Progress indicator
      if ((i + 1) % 1000 === 0) {
        console.log(`   ${i + 1}/${ticks.length}... (${buySignals + sellSignals} signals so far)`);
      }
    }

    // Summary
    const totalTrades = buySignals + sellSignals;
    console.log(`\n📈 SIGNAL SUMMARY:`);
    console.log(`   BUY signals:  ${buySignals}`);
    console.log(`   SELL signals: ${sellSignals}`);
    console.log(`   Total trades: ${totalTrades}`);
    console.log(`   Trade rate:   ${((totalTrades / ticks.length) * 100).toFixed(2)}%`);

    // Comparison with BTC
    console.log(`\n⚖️  COMPARISON:`);
    console.log(`   ETH (current): ${totalTrades} trades (${((totalTrades / ticks.length) * 100).toFixed(2)}%)`);
    console.log(`   BTC (target):  ~901 trades (~10.3%)`);
    console.log(`   Ratio: ${(totalTrades / 901).toFixed(2)}x of BTC`);

    // Show first 10 signals
    if (trades.length > 0) {
      console.log(`\n🎯 FIRST 10 SIGNALS:`);
      trades.slice(0, 10).forEach((trade, idx) => {
        console.log(`   ${idx + 1}. Index ${trade.index}: ${trade.action} (conf ${trade.confidence.toFixed(4)})`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

countETHSignals();
