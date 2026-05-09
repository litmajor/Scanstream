#!/usr/bin/env node
/**
 * Multi-Timeframe Data Fetcher Script
 * 
 * Fetches all timeframes (1m to 1d) for BTC and ETH
 * Includes orderflow data for comprehensive market analysis
 * 
 * Usage:
 *   npx ts-node scripts/fetch-multi-timeframe.ts
 *   or
 *   pnpm run fetch:multi-tf
 */

import { BinanceDataFetcher } from '../server/services/vfmd/binanceDataFetcher.ts';

async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + '🚀 MULTI-TIMEFRAME DATA FETCHER' + ' '.repeat(26) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('');

  const fetcher = new BinanceDataFetcher();

  try {
    console.log('📊 Configuration:');
    console.log('   Symbols: BTCUSDT, ETHUSDT');
    console.log('   Timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d');
    console.log('   Period: 1 year (365 days)');
    console.log('   Include Orderflow: Yes');
    console.log('   Cache Location: ./data/cache/multi-timeframe/');
    console.log('');

    // Fetch all timeframes for BTC and ETH
    const startTime = Date.now();
    console.log('⏳ Starting fetch...\n');

    const allData = await fetcher.fetchMultiTimeframeData(
      ['BTCUSDT', 'ETHUSDT'],
      365,  // 365 days (1 year)
      true // Include orderflow
    );

    // Save to disk
    console.log('\n💾 Saving data to disk...\n');
    await fetcher.saveMultiTimeframeData(
      allData,
      './data/cache/multi-timeframe'
    );

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('📈 FETCH SUMMARY');
    console.log('═'.repeat(80));
    
    for (const [symbol, timeframeData] of allData) {
      console.log(`\n${symbol}:`);
      
      let totalCandles = 0;
      let totalOrderFlow = 0;

      for (const [timeframe, marketData] of timeframeData) {
        if (marketData.length === 0) continue;

        const withOrderFlow = marketData.filter(d => d.orderFlow).length;
        const avgBuyRatio = marketData.reduce((acc, d) => {
          if (!d.orderFlow) return acc;
          return acc + d.orderFlow.volumeRatio;
        }, 0) / (withOrderFlow || 1);

        const avgNetVolume = marketData.reduce((acc, d) => {
          if (!d.orderFlow) return acc;
          return acc + d.orderFlow.netVolume;
        }, 0) / (withOrderFlow || 1);

        totalCandles += marketData.length;
        totalOrderFlow += withOrderFlow;

        console.log(
          `  ${timeframe.padEnd(4)} │ Candles: ${marketData.length.toString().padEnd(4)} │ ` +
          `Orderflow: ${withOrderFlow.toString().padEnd(4)} │ ` +
          `Avg Buy Ratio: ${(avgBuyRatio * 100).toFixed(1).padEnd(5)}% │ ` +
          `Avg Net Vol: ${avgNetVolume.toFixed(0).padEnd(8)}`
        );
      }

      console.log(`  Total: ${totalCandles} candles, ${totalOrderFlow} with orderflow data`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ FETCH COMPLETE');
    console.log('═'.repeat(80));
    console.log(`\n⏱️  Time elapsed: ${elapsedSeconds}s`);
    console.log('📁 Data location: ./data/cache/multi-timeframe/');
    console.log('');
    console.log('📦 Data structure:');
    console.log('   data/cache/multi-timeframe/');
    console.log('   ├── BTCUSDT/');
    console.log('   │   ├── BTCUSDT_1m.json');
    console.log('   │   ├── BTCUSDT_5m.json');
    console.log('   │   ├── BTCUSDT_1h.json');
    console.log('   │   └── ... (all timeframes)');
    console.log('   └── ETHUSDT/');
    console.log('       ├── ETHUSDT_1m.json');
    console.log('       ├── ETHUSDT_5m.json');
    console.log('       ├── ETHUSDT_1h.json');
    console.log('       └── ... (all timeframes)');
    console.log('');
    console.log('📊 Each file contains:');
    console.log('   - OHLCV data (Open, High, Low, Close, Volume)');
    console.log('   - Orderflow metrics (Buy/Sell volumes, ratios, dominant side)');
    console.log('   - Timestamp and metadata');
    console.log('');
    console.log('🎯 Ready for analysis, backtesting, and strategy development!');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

main();
