#!/usr/bin/env tsx
import { HistoricalBacktester } from './server/services/historical-backtester.js';

async function testBacktest() {
  const backtester = new HistoricalBacktester();
  
  const config = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-01'),
    assets: ['BTC']
  };
  
  try {
    console.log('Starting backtest...');
    const result = await backtester.runHistoricalBacktest(config);
    console.log('Backtest complete!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Backtest error:', error);
    process.exit(1);
  }
}

testBacktest();
