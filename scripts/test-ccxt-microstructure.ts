/**
 * Test script for CCXT orderbook microstructure fetching
 * 
 * This script demonstrates the real-time orderbook depth data integration
 * that enriches the kline-based orderflow approximations.
 * 
 * Usage: npx ts-node scripts/test-ccxt-microstructure.ts
 */

import { BinanceDataFetcher } from '../server/services/vfmd/binanceDataFetcher';

async function testCCXTMicrostructure() {
  console.log('🧪 TESTING CCXT ORDERBOOK MICROSTRUCTURE INTEGRATION');
  console.log('='.repeat(80));
  console.log('');

  const fetcher = new BinanceDataFetcher();

  // Initialize CCXT first
  console.log('⚙️  Initializing CCXT Binance exchange...');
  await fetcher.initCCXT();
  console.log('✅ CCXT initialized\n');

  // Fetch multi-timeframe data with microstructure
  console.log('📊 Fetching 7-day multi-timeframe data (5 timeframes for demo)...');
  console.log('');

  const data = await fetcher.fetchMultiTimeframeData(
    ['BTCUSDT', 'ETHUSDT'],
    7,
    true // Include orderflow with microstructure
  );

  console.log('\n' + '='.repeat(80));
  console.log('📋 MICROSTRUCTURE DATA SAMPLE');
  console.log('='.repeat(80));
  console.log('');

  // Show sample data with microstructure enrichment
  for (const [symbol, timeframeMap] of data) {
    console.log(`\n${symbol}:`);
    console.log('-'.repeat(60));

    for (const [timeframe, candles] of timeframeMap) {
      if (candles.length === 0) continue;

      const latestCandle = candles[candles.length - 1];
      const orderFlow = latestCandle.orderFlow;

      console.log(`\n  ${timeframe}:`);
      console.log(`    Time: ${new Date(latestCandle.timestamp).toISOString()}`);
      console.log(`    Price: $${latestCandle.close.toFixed(2)}`);
      console.log(`    Volume: ${latestCandle.volume.toFixed(2)}`);

      if (orderFlow) {
        // Kline-based orderflow (always available)
        console.log(`    `);
        console.log(`    📊 Orderflow (Kline-based):`);
        console.log(`       Buy Volume: ${orderFlow.buyVolume?.toFixed(2)}`);
        console.log(`       Sell Volume: ${orderFlow.sellVolume?.toFixed(2)}`);
        console.log(`       Volume Ratio: ${(orderFlow.volumeRatio?.toFixed(3) || '0.000')}  [${orderFlow.dominantSide}]`);

        // CCXT microstructure (if available)
        if (orderFlow.hasMicrostructure) {
          console.log(`    `);
          console.log(`    🔬 Microstructure (CCXT OrderBook):`);
          console.log(`       Spread: $${orderFlow.spread?.toFixed(4)} (${orderFlow.spreadPercent?.toFixed(4)}%)`);
          console.log(`       Bid Volume: ${orderFlow.bidVolume?.toFixed(2)}`);
          console.log(`       Ask Volume: ${orderFlow.askVolume?.toFixed(2)}`);
          console.log(`       Imbalance: ${(orderFlow.imbalance?.toFixed(3) || '0.500')}  [Bid/Ask Ratio: ${orderFlow.bidAskRatio?.toFixed(2)}]`);
          console.log(`       Depth (Top 20): ${orderFlow.depth?.toFixed(2)}`);
        } else {
          console.log(`    `);
          console.log(`    ⚠️  Microstructure: Not available`);
        }
      }

      break; // Just show first timeframe
    }

    break; // Just show first symbol
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TEST COMPLETE');
  console.log('');
  console.log('📝 Summary:');
  console.log('  • Kline-based orderflow: Always available (historical)');
  console.log('  • CCXT microstructure: Available for latest candles with live data');
  console.log('  • Graceful fallback: If CCXT unavailable, continues with kline-based only');
  console.log('');
}

// Run test
testCCXTMicrostructure().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
