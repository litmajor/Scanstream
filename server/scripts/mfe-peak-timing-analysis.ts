/**
 * MFE PEAK TIMING ANALYSIS
 * 
 * Discovers when the MFE (Maximum Favorable Excursion) peaks per regime.
 * This builds the ground truth for the EXIT WINDOW MODEL.
 * 
 * Question: On which candle (relative to entry) does the edge statistically expire?
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/mfe-peak-timing-analysis.ts
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

interface PeakCandle {
  regime: string;
  candleOffset: number; // 1, 2, 3, 4, 5, ... relative to entry candle
  mfeAchieved: number; // $ amount
  mfePercent: number; // %
  winOrLoss: 'win' | 'loss';
}

interface MFEPeakDistribution {
  regime: string;
  totalTrades: number;
  peakCandleDistribution: Record<number, number>; // {1: 23 trades peaked at candle 1, 2: 45 trades, ...}
  medianPeakCandle: number;
  avgPeakCandle: number;
  winningTradesOnly: {
    distribution: Record<number, number>;
    medianPeakCandle: number;
    avgPeakCandle: number;
  };
}

const SIGNAL_THRESHOLD = 0.3;
const INITIAL_CAPITAL = 1000;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;
const MAX_HOLD_CANDLES = 20; // Look ahead 20 candles to find MFE peak

async function analyzeMFEPeakTiming(): Promise<void> {
  console.log('\n' + '='.repeat(100));
  console.log('📊 MFE PEAK TIMING ANALYSIS - EXIT WINDOW DISCOVERY');
  console.log('='.repeat(100));
  console.log('');

  try {
    // Load BTC data
    console.log('📊 Loading 180-day BTC/USDT data...');
    const ticks = BinanceDataFetcher.loadFromFile('./data/cache/BTCUSDT_1h_180d.json');
    console.log(`✅ Loaded ${ticks.length} candles\n`);

    if (ticks.length < 100) {
      throw new Error(`Insufficient data: ${ticks.length} candles loaded, need at least 100`);
    }

    // Initialize agent
    console.log('🔧 Initializing VFMDPhysicsAgent...');
    const agent = new VFMDPhysicsAgent('VFMDAnalyzer', 'balanced');
    console.log('✅ Agent ready\n');

    // Build regime classification
    console.log('Phase 1: Classifying market regimes...');
    const regimes: string[] = [];
    for (let i = 0; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(Math.max(0, i - 100), i + 1);
      const signal = agent.generateSignal(historicalTicks);
      const metadata = (signal as any)?.metadata || {};
      regimes[i] = metadata?.regime_name || 'UNKNOWN';
    }
    console.log(`✅ Identified regimes\n`);

    // Analyze MFE peak timing
    console.log('Phase 2: Analyzing MFE peak candle timing...');
    const peakData: PeakCandle[] = [];
    const regimeDistributions: Map<string, MFEPeakDistribution> = new Map();
    
    let tradesAnalyzed = 0;

    for (let i = 100; i < ticks.length - MAX_HOLD_CANDLES; i++) {
      const tick = ticks[i];
      const historicalTicks = ticks.slice(Math.max(0, i - 100), i + 1);
      const signal = agent.generateSignal(historicalTicks);
      const regime = regimes[i] || 'UNKNOWN';

      // Only analyze valid trade signals
      if (signal.action === 'HOLD' || signal.confidence < 0.3) continue;

      const direction = signal.action === 'BUY' ? 'long' : signal.action === 'SELL' ? 'short' : null;
      if (!direction) continue;

      tradesAnalyzed++;

      // Entry price with slippage
      const slippageFactor = 1 + (direction === 'long' ? SLIPPAGE_BPS : -SLIPPAGE_BPS) / 10000;
      const entryPrice = tick.close * slippageFactor;

      // Find peak candle within lookahead window
      let peakCandle = 0;
      let peakPrice = entryPrice;
      let peakMFE = 0;

      for (let j = 1; j <= MAX_HOLD_CANDLES && i + j < ticks.length; j++) {
        const lookaheadTick = ticks[i + j];
        const candleHigh = lookaheadTick.high;
        const candleLow = lookaheadTick.low;

        let currentMFE: number;
        if (direction === 'long') {
          currentMFE = candleHigh - entryPrice;
          if (currentMFE > peakMFE) {
            peakMFE = currentMFE;
            peakPrice = candleHigh;
            peakCandle = j;
          }
        } else {
          currentMFE = entryPrice - candleLow;
          if (currentMFE > peakMFE) {
            peakMFE = currentMFE;
            peakPrice = candleLow;
            peakCandle = j;
          }
        }
      }

      // Determine if ultimately winning or losing trade
      const exitPrice = ticks[Math.min(i + 5, ticks.length - 1)].close;
      const pnl =
        direction === 'long'
          ? (exitPrice - entryPrice) * 100
          : (entryPrice - exitPrice) * 100;
      const winOrLoss = pnl > 0 ? 'win' : 'loss';

      // Record peak candle
      peakData.push({
        regime,
        candleOffset: peakCandle,
        mfeAchieved: peakMFE * 100,
        mfePercent: (peakMFE / entryPrice) * 100,
        winOrLoss,
      });

      // Initialize regime distribution if needed
      if (!regimeDistributions.has(regime)) {
        regimeDistributions.set(regime, {
          regime,
          totalTrades: 0,
          peakCandleDistribution: {},
          medianPeakCandle: 0,
          avgPeakCandle: 0,
          winningTradesOnly: {
            distribution: {},
            medianPeakCandle: 0,
            avgPeakCandle: 0,
          },
        });
      }

      // Update distribution
      const dist = regimeDistributions.get(regime)!;
      dist.totalTrades++;
      dist.peakCandleDistribution[peakCandle] = (dist.peakCandleDistribution[peakCandle] || 0) + 1;

      if (winOrLoss === 'win') {
        dist.winningTradesOnly.distribution[peakCandle] =
          (dist.winningTradesOnly.distribution[peakCandle] || 0) + 1;
      }
    }

    console.log(`✅ Analyzed ${tradesAnalyzed} trade signals\n`);

    // Calculate stats
    console.log('Phase 3: Computing peak candle statistics...\n');

    for (const [regime, dist] of regimeDistributions) {
      // All trades
      const allOffsets = Object.entries(dist.peakCandleDistribution)
        .flatMap(([offset, count]) => Array(count).fill(Number(offset)))
        .sort((a, b) => a - b);

      dist.avgPeakCandle = allOffsets.reduce((a, b) => a + b, 0) / allOffsets.length;
      dist.medianPeakCandle = allOffsets[Math.floor(allOffsets.length / 2)];

      // Winning trades only
      const winningOffsets = Object.entries(dist.winningTradesOnly.distribution)
        .flatMap(([offset, count]) => Array(count).fill(Number(offset)))
        .sort((a, b) => a - b);

      if (winningOffsets.length > 0) {
        dist.winningTradesOnly.avgPeakCandle =
          winningOffsets.reduce((a, b) => a + b, 0) / winningOffsets.length;
        dist.winningTradesOnly.medianPeakCandle =
          winningOffsets[Math.floor(winningOffsets.length / 2)];
      }
    }

    // Output results
    console.log('='.repeat(100));
    console.log('🎯 MFE PEAK CANDLE DISTRIBUTION (Ground Truth for Exit Windows)');
    console.log('='.repeat(100));
    console.log('');

    for (const [regime, dist] of regimeDistributions) {
      console.log(`📍 REGIME: ${regime.toUpperCase()}`);
      console.log(`   Total trades: ${dist.totalTrades}`);
      console.log(`   Peak candle distribution:`);

      const sortedOffsets = Object.entries(dist.peakCandleDistribution)
        .map(([offset, count]) => ({ offset: Number(offset), count }))
        .sort((a, b) => a.offset - b.offset);

      for (const { offset, count } of sortedOffsets) {
        const pct = ((count / dist.totalTrades) * 100).toFixed(1);
        const bar = '█'.repeat(Math.ceil((count / dist.totalTrades) * 40));
        console.log(`     Candle ${offset}: ${bar} ${count} trades (${pct}%)`);
      }

      console.log(`   📊 All trades: median=${dist.medianPeakCandle}, avg=${dist.avgPeakCandle.toFixed(1)}`);
      console.log(
        `   ✅ Winning trades (${Object.values(dist.winningTradesOnly.distribution).reduce((a, b) => a + b, 0)} total):`
      );
      console.log(
        `      Median=${dist.winningTradesOnly.medianPeakCandle}, Avg=${dist.winningTradesOnly.avgPeakCandle.toFixed(1)}`
      );

      // Winning trade distribution
      if (Object.keys(dist.winningTradesOnly.distribution).length > 0) {
        const sortedWinningOffsets = Object.entries(dist.winningTradesOnly.distribution)
          .map(([offset, count]) => ({ offset: Number(offset), count }))
          .sort((a, b) => a.offset - b.offset);

        for (const { offset, count } of sortedWinningOffsets.slice(0, 5)) {
          const pct = ((count / Object.values(dist.winningTradesOnly.distribution).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
          console.log(`        Candle ${offset}: ${count} wins (${pct}%)`);
        }
      }

      console.log('');
    }

    // Export raw data
    const exportData = {
      timestamp: new Date().toISOString(),
      totalTradesAnalyzed: tradesAnalyzed,
      regimeDistributions: Array.from(regimeDistributions.entries()).map(([regime, dist]) => ({
        regime,
        ...dist,
      })),
      peakDataSample: peakData.slice(0, 100),
    };

    const outputPath = './mfe-peak-timing-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Detailed results saved to: ${outputPath}`);

    console.log('\n' + '='.repeat(100));
    console.log('✅ MFE PEAK TIMING ANALYSIS COMPLETE');
    console.log('='.repeat(100));
    console.log('');
    console.log('Next step: Use these peak candle windows in the EXIT WINDOW MODEL');
    console.log('');
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeMFEPeakTiming().catch(console.error);
