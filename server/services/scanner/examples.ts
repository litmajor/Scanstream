/**
 * Scanner Optimization Examples
 * 
 * Real-world usage patterns and configuration examples.
 */

// ============ EXAMPLE 1: Minimal Setup ============
// Fastest scanning with minimal indicators
import { OptimizedContinuousMultiTimeframeScanner } from './continuous-scanner-optimized';

async function minimalExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD'],
    ['1h'],
    {
      indicatorProfile: 'conservative',  // Only essential indicators
      cacheTtlMs: 30_000,                // Fast cache expiration
      enableDiagnostics: false           // Minimal overhead
    }
  );

  scanner.on('processed', (event) => {
    // Handle results
    for (const result of event.results) {
      console.log(`${result.symbol}: ${result.score}`);
    }
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    // Your data fetch implementation
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 2: Balanced Production Setup ============
// Recommended for most trading systems

async function productionExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD', 'AAPL', 'MSFT'],
    ['1h', '4h', '1d'],
    {
      indicatorProfile: 'balanced',       // Good balance of speed & accuracy
      pollIntervalMs: 30_000,             // Scan every 30 seconds
      cacheTtlMs: 60_000,                 // 1 minute cache
      maxCacheEntries: 2000,              // Enough for 50+ symbol/timeframe pairs
      useWorkerPool: true,
      workerPoolSize: 2,
      maxPayloadBytes: 500_000,           // 500KB max payload
      enableDiagnostics: true,
      diagnosticsLogIntervalMs: 300_000,  // Health check every 5 minutes
      debug: false
    }
  );

  scanner.on('processed', (event) => {
    // Emit to API clients or save to database
    console.log(`Processed ${event.results.length} symbol/timeframe combinations`);
    event.results.forEach(r => {
      console.log(`  ${r.symbol}/${r.timeframe}: score=${r.score.toFixed(2)}`);
    });
  });

  scanner.on('diagnostics', (report) => {
    const { health } = report;
    console.log(`Cache hit rate: ${(health.cacheHitRate * 100).toFixed(0)}%`);
    if (health.warnings.length > 0) {
      console.warn('Performance warnings:', health.warnings);
    }
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 3: Custom Indicator Toggling ============
// Enable/disable indicators based on trading strategy

async function customIndicatorExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD'],
    ['1h', '4h', '1d'],
    { indicatorProfile: 'balanced' }
  );

  // Customize for Bitcoin
  // For intraday (1h): use momentum indicators
  scanner.setIndicatorEnabled('BTC/USD', '1h', 'rsi', true);
  scanner.setIndicatorEnabled('BTC/USD', '1h', 'stochastic', true);
  scanner.setIndicatorEnabled('BTC/USD', '1h', 'volumeProfile', false);

  // For swing trading (4h): use trend indicators
  scanner.setIndicatorEnabled('BTC/USD', '4h', 'ichimoku', true);
  scanner.setIndicatorEnabled('BTC/USD', '4h', 'adx', true);

  // For daily: use everything
  // (balanced profile already includes key indicators)

  scanner.on('processed', (event) => {
    event.results.forEach(r => {
      console.log(`${r.symbol}/${r.timeframe}:`);
      console.log(`  Score: ${r.score}`);
      console.log(`  Computed indicators: ${r.diagnostics?.computedIndicators.length || 0}`);
      console.log(`  Cached indicators: ${r.diagnostics?.cachedIndicators.length || 0}`);
    });
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 4: Real-Time Profile Switching ============
// Adapt to market conditions

async function adaptiveProfileExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD'],
    ['1h', '4h'],
    { indicatorProfile: 'balanced' }
  );

  let isHighVolatility = false;

  scanner.on('diagnostics', (report) => {
    // If memory usage is high, switch to conservative profile
    if (report.health.memoryUsageMB > 100) {
      console.log('High memory usage detected, switching to conservative profile');
      scanner.setIndicatorProfile('conservative');
      isHighVolatility = false;
    }

    // If payload is large and system is under stress, reduce indicators
    if (report.health.avgPayloadSizeBytes > 800_000) {
      console.log('Large payloads, switching to conservative profile');
      scanner.setIndicatorProfile('conservative');
    }
  });

  scanner.on('processed', (event) => {
    // Monitor score volatility
    const scores = event.results.map(r => r.score);
    const variance = calculateVariance(scores);

    if (variance > 0.8 && !isHighVolatility) {
      console.log('High score volatility detected, switching to aggressive profile for better signals');
      scanner.setIndicatorProfile('aggressive');
      isHighVolatility = true;
    } else if (variance < 0.3 && isHighVolatility) {
      console.log('Market calming, switching back to balanced profile');
      scanner.setIndicatorProfile('balanced');
      isHighVolatility = false;
    }
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 5: Cache Management ============
// Monitor and optimize cache behavior

async function cacheOptimizationExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD', 'ADA/USD', 'XRP/USD'],
    ['1m', '5m', '15m', '1h', '4h', '1d'],
    {
      indicatorProfile: 'balanced',
      cacheTtlMs: 120_000,      // 2 minute cache
      maxCacheEntries: 5000     // Large cache for many symbols
    }
  );

  // Monitor cache performance
  setInterval(() => {
    const stats = scanner.getCacheStats();
    console.log('Cache Statistics:');
    console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(0)}%`);
    console.log(`  Entries: ${stats.size}/${5000}`);
    console.log(`  Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(0)}MB`);

    if (stats.hitRate < 0.4) {
      console.warn('Low cache hit rate! Consider:');
      console.warn('  - Increasing cacheTtlMs');
      console.warn('  - Reducing number of symbols');
      console.warn('  - Reducing number of timeframes');
    }
  }, 60_000);

  scanner.on('processed', (event) => {
    // Process results
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 6: Payload Size Compliance ============
// Ensure payloads stay within limits for UI/logging

async function payloadComplianceExample() {
  const MAX_PAYLOAD_KB = 300; // Strict limit for mobile clients

  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD'],
    ['1h', '4h', '1d'],
    {
      indicatorProfile: 'balanced',
      maxPayloadBytes: MAX_PAYLOAD_KB * 1024,
      enableDiagnostics: true
    }
  );

  let oversizedCount = 0;

  scanner.on('warning', (warning) => {
    if (warning.type === 'PAYLOAD_OVERSIZED') {
      oversizedCount++;
      console.warn(`Oversized payload for ${warning.symbol}/${warning.timeframe}`);

      // Switch to conservative after multiple warnings
      if (oversizedCount >= 3) {
        console.log('Multiple oversized payloads, switching to conservative profile');
        scanner.setIndicatorProfile('conservative');
        oversizedCount = 0;
      }
    }
  });

  scanner.on('processed', (event) => {
    event.results.forEach(r => {
      if (r.diagnostics) {
        const sizeKb = r.diagnostics.payloadSizeBytes / 1024;
        if (sizeKb > MAX_PAYLOAD_KB * 0.9) {
          console.warn(`Warning: ${r.symbol}/${r.timeframe} payload approaching limit: ${sizeKb.toFixed(0)}KB`);
        }
      }
    });
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ EXAMPLE 7: Worker Pool Monitoring ============
// Track heavy indicator offloading

async function workerPoolExample() {
  const scanner = new OptimizedContinuousMultiTimeframeScanner(
    ['BTC/USD', 'ETH/USD'],
    ['1h', '4h', '1d'],
    {
      indicatorProfile: 'balanced',
      useWorkerPool: true,
      workerPoolSize: 3,  // 3 worker threads
      debug: true         // Enable worker logging
    }
  );

  scanner.on('diagnostics', (report) => {
    if (report.workerStats) {
      const { completed, failed, workersActive, tasksQueued } = report.workerStats;
      console.log('Worker Pool Status:');
      console.log(`  Completed: ${completed}, Failed: ${failed}`);
      console.log(`  Active workers: ${workersActive}`);
      console.log(`  Queued tasks: ${tasksQueued}`);

      if (tasksQueued > 5) {
        console.warn('Worker queue building up! Consider increasing workerPoolSize');
      }
    }
  });

  scanner.on('processed', (event) => {
    // Process results
  });

  scanner.start(async (symbols, timeframes, lookback) => {
    return fetchData(symbols, timeframes, lookback);
  });

  return scanner;
}

// ============ HELPER FUNCTIONS ============

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

async function fetchData(
  symbols: string[],
  timeframes: string[],
  lookback: number
): Promise<Record<string, Record<string, any[]>>> {
  // Implement your data fetching logic
  // Return structure: { symbol: { timeframe: [frames...] } }
  console.log(`Fetching ${symbols.length} symbols × ${timeframes.length} timeframes (${lookback} candles)`);
  return {};
}

// ============ USAGE ============

// Run one of the examples:
// await minimalExample();
// await productionExample();
// await customIndicatorExample();
// await adaptiveProfileExample();
// await cacheOptimizationExample();
// await payloadComplianceExample();
// await workerPoolExample();

export {
  minimalExample,
  productionExample,
  customIndicatorExample,
  adaptiveProfileExample,
  cacheOptimizationExample,
  payloadComplianceExample,
  workerPoolExample
};
