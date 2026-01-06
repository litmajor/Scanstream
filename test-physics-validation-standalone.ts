/**
 * Standalone Physics Validation Test
 * Can run without full server using ts-node
 */

import type { MarketTick } from './server/services/vfmd/types';

// Simple mock data generator
function generateMockMarketData(days: number, startPrice: number = 40000): MarketTick[] {
  const ticks: MarketTick[] = [];
  let price = startPrice;
  
  for (let i = 0; i < days * 24; i++) {
    // Generate realistic price movement
    const randomWalk = (Math.random() - 0.5) * 500;
    const trend = i % 200 < 100 ? 10 : -5; // Trend component
    price += randomWalk + trend;
    
    const open = price;
    const close = price + (Math.random() - 0.5) * 200;
    const high = Math.max(open, close) + Math.random() * 100;
    const low = Math.min(open, close) - Math.random() * 100;
    const volume = 1000 + Math.random() * 5000;
    
    ticks.push({
      timestamp: Date.now() - (days * 24 - i) * 3600000,
      open,
      high,
      low,
      close,
      volume,
      bidVolume: volume * 0.5,
      askVolume: volume * 0.5
    });
  }
  
  return ticks;
}

// Simplified PEG calculation
function calculateSimplePEG(ticks: MarketTick[], lookback: number = 20): number[] {
  const pegValues: number[] = [];
  
  for (let i = 0; i < ticks.length; i++) {
    if (i < lookback) {
      pegValues.push(0);
      continue;
    }
    
    // Simple PEG: measure price acceleration
    const segment = ticks.slice(i - lookback, i);
    const closes = segment.map(t => t.close);
    const prices = closes;
    
    // Calculate energy as sum of squared returns
    let energy = 0;
    for (let j = 1; j < prices.length; j++) {
      const ret = (prices[j] - prices[j-1]) / prices[j-1];
      energy += ret * ret;
    }
    
    pegValues.push(energy * 100);
  }
  
  return pegValues;
}

// Test function
async function runValidation() {
  console.log('🧪 STANDALONE PHYSICS VALIDATION TEST\n');
  console.log('=' .repeat(70));
  
  // Generate mock 30-day data
  console.log('📊 Generating 30 days of mock market data...');
  const ticks = generateMockMarketData(30);
  console.log(`✅ Generated ${ticks.length} data points\n`);
  
  // Calculate PEG values
  console.log('📈 Calculating PEG energy values...');
  const pegValues = calculateSimplePEG(ticks);
  console.log(`✅ Calculated PEG for ${pegValues.length} points\n`);
  
  // Run validation test: High PEG → Future volatility spike?
  console.log('🧬 TEST 1: PEG → Volatility Prediction');
  console.log('-'.repeat(70));
  
  const pegThreshold = 0.3; // Threshold for high PEG
  const lookAhead = 10; // Check next 10 candles
  
  let truePositives = 0;
  let falsePositives = 0;
  let testCount = 0;
  
  for (let i = 0; i < pegValues.length - lookAhead; i++) {
    if (pegValues[i] > pegThreshold) {
      // PEG spike detected - check future volatility
      const futureSegment = ticks.slice(i, i + lookAhead);
      
      // Calculate future volatility
      const returns = [];
      for (let j = 1; j < futureSegment.length; j++) {
        returns.push((futureSegment[j].close - futureSegment[j-1].close) / futureSegment[j-1].close);
      }
      const avgReturn = returns.reduce((a,b) => a + b) / returns.length;
      const volatility = Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2) / returns.length);
      
      // Baseline volatility (first segment)
      const baselineReturns = [];
      for (let j = 1; j < Math.min(50, ticks.length); j++) {
        baselineReturns.push((ticks[j].close - ticks[j-1].close) / ticks[j-1].close);
      }
      const baselineAvg = baselineReturns.reduce((a,b) => a + b) / baselineReturns.length;
      const baselineVolatility = Math.sqrt(baselineReturns.reduce((sum, r) => sum + (r - baselineAvg) ** 2) / baselineReturns.length);
      
      if (volatility > baselineVolatility * 1.5) {
        truePositives++;
      } else {
        falsePositives++;
      }
      
      testCount++;
    }
  }
  
  const precision = testCount > 0 ? truePositives / (truePositives + falsePositives || 1) : 0;
  const successRate = testCount > 0 ? truePositives / testCount : 0;
  
  console.log(`Sample Size: ${testCount} PEG spikes`);
  console.log(`True Positives: ${truePositives}`);
  console.log(`False Positives: ${falsePositives}`);
  console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
  console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`Status: ${successRate > 0.55 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test 2: Regime classification
  console.log('🎯 TEST 2: Regime Classification');
  console.log('-'.repeat(70));
  
  // Simple regime: if price above MA, it's "ACCUMULATION"
  let regimeCorrect = 0;
  let regimeTests = 0;
  
  for (let i = 30; i < ticks.length - 15; i++) {
    // Simple MA
    const ma = ticks.slice(i - 20, i).reduce((sum, t) => sum + t.close, 0) / 20;
    const regime = ticks[i].close > ma ? 'ACCUMULATION' : 'DISTRIBUTION';
    
    // Check future movement
    const futurePrice = ticks[i + 15].close;
    const priceMovement = (futurePrice - ticks[i].close) / ticks[i].close;
    
    if ((regime === 'ACCUMULATION' && priceMovement > 0.01) ||
        (regime === 'DISTRIBUTION' && priceMovement < -0.01)) {
      regimeCorrect++;
    }
    
    regimeTests++;
  }
  
  const regimeAccuracy = regimeTests > 0 ? regimeCorrect / regimeTests : 0;
  console.log(`Sample Size: ${regimeTests} regime classifications`);
  console.log(`Correct Predictions: ${regimeCorrect}`);
  console.log(`Accuracy: ${(regimeAccuracy * 100).toFixed(1)}%`);
  console.log(`Status: ${regimeAccuracy > 0.55 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Summary
  console.log('=' .repeat(70));
  console.log('📋 VALIDATION SUMMARY\n');
  console.log(`PEG Validation:     ${successRate > 0.55 ? '✅ PASS' : '❌ FAIL'} (${(successRate * 100).toFixed(1)}%)`);
  console.log(`Regime Validation:  ${regimeAccuracy > 0.55 ? '✅ PASS' : '❌ FAIL'} (${(regimeAccuracy * 100).toFixed(1)}%)`);
  console.log(`\nOverall Status: ${(successRate > 0.55 && regimeAccuracy > 0.55) ? '✅ TESTS PASS' : '⚠️ NEEDS WORK'}`);
  console.log('\nNote: This is a simplified test on mock data.');
  console.log('Real validation requires 180 days of actual market data and proper ground truth.');
}

// Run
runValidation().catch(console.error);
