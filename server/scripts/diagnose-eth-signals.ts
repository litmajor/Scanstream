/**
 * ETH Standalone Diagnostic Backtest
 * 
 * Isolate ETH trading to identify which filter is blocking signal execution
 */

import * as fs from 'fs';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import type { MarketTick } from '../services/vfmd/types';

const DATA_DAYS = 365;
const INITIAL_CAPITAL = 1000;
const MAX_POSITION_SIZE = 0.4;
const SLIPPAGE_BPS = 2;
const COMMISSION_BPS = 1;

async function main() {
  try {
    console.log('🔍 ETH DIAGNOSTIC BACKTEST\n');
    
    const agent = new VFMDPhysicsAgent('backtest', 'balanced');
    agent.setAsset('ETH'); // Set ETH-specific thresholds (55 instead of 65)
    
    // Load ETH data
    console.log(`📊 Loading ${DATA_DAYS}-day ETH/USDT data...`);
    let ticks: MarketTick[];
    
    const cacheFile = `./data/cache/ETHUSDT_1h_${DATA_DAYS}d.json`;
    
    if (fs.existsSync(cacheFile)) {
      console.log(`✅ Loading from cache: ${cacheFile}`);
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      ticks = Array.isArray(cachedData) ? cachedData : (cachedData.data || cachedData.ticks || cachedData);
    } else {
      console.log(`Fetching from Binance...`);
      const fetcher = new BinanceDataFetcher();
      ticks = await fetcher.fetchHistoricalData('ETHUSDT', DATA_DAYS, '1h');
      fs.mkdirSync('./data/cache', { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(ticks, null, 2));
      console.log(`✅ Cached`);
    }
    
    console.log(`✅ Loaded ${ticks.length} candles (${new Date(ticks[0].timestamp).toISOString().split('T')[0]} to ${new Date(ticks[ticks.length - 1].timestamp).toISOString().split('T')[0]})\n`);

    // Analyze regimes
    console.log('Phase 1: Analyzing regimes...');
    const regimes: string[] = [];
    let currentRegime = '';

    for (let i = 20; i < ticks.length; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const analysis = agent.getAnalysisForUI(historicalTicks);
      const regime = analysis?.regime?.classification || 'UNKNOWN';
      regimes[i] = regime;

      if (regime !== currentRegime) {
        currentRegime = regime;
      }

      if (i % Math.ceil(ticks.length / 10) === 0) {
        console.log(`  [${i}/${ticks.length}] Regime: ${regime}`);
      }
    }
    console.log(`✅ Regimes analyzed\n`);

    // Scan signals with diagnostic info
    console.log('Phase 2: Scanning signals with diagnostics...\n');
    
    let signalCount = 0;
    let holdCount = 0;
    let lowConfidenceCount = 0;
    let tradeTaken = 0;
    let tradeFiltered = 0;
    
    const signalDistribution: Record<string, any> = {};
    const lowConfidenceSamples: any[] = [];
    const highConfidenceSamples: any[] = [];

    for (let i = 20; i < Math.min(100, ticks.length - 1); i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const tick = ticks[i];
      const regime = regimes[i] || 'UNKNOWN';

      const signal = agent.generateSignal(historicalTicks);
      signalCount++;

      if (!signalDistribution[regime]) {
        signalDistribution[regime] = { hold: 0, buy: 0, sell: 0, avgConfidence: 0, count: 0 };
      }
      signalDistribution[regime][signal.action.toLowerCase()] = (signalDistribution[regime][signal.action.toLowerCase()] || 0) + 1;
      signalDistribution[regime].count++;
      signalDistribution[regime].avgConfidence += signal.confidence;

      if (signal.action === 'HOLD') {
        holdCount++;
        continue;
      }

      const turbulentChopThreshold = regime === 'turbulent_chop' ? 0.25 : 0.3;
      
      if (signal.confidence < turbulentChopThreshold) {
        lowConfidenceCount++;
        if (lowConfidenceSamples.length < 10) {
          lowConfidenceSamples.push({
            index: i,
            regime,
            action: signal.action,
            confidence: signal.confidence,
            threshold: turbulentChopThreshold,
            gap: (turbulentChopThreshold - signal.confidence).toFixed(4)
          });
        }
        continue;
      }

      // Would take trade
      tradeTaken++;
      if (highConfidenceSamples.length < 10) {
        highConfidenceSamples.push({
          index: i,
          regime,
          action: signal.action,
          confidence: signal.confidence.toFixed(4),
          threshold: turbulentChopThreshold
        });
      }
    }

    console.log('SIGNAL ANALYSIS (first 80 candles):');
    console.log(`  Total signals checked: ${signalCount}`);
    console.log(`  HOLD signals: ${holdCount} (${(holdCount/signalCount*100).toFixed(1)}%)`);
    console.log(`  Low confidence filtered: ${lowConfidenceCount} (${(lowConfidenceCount/signalCount*100).toFixed(1)}%)`);
    console.log(`  Trades that would execute: ${tradeTaken}\n`);

    console.log('REGIME DISTRIBUTION:');
    for (const [regime, data] of Object.entries(signalDistribution)) {
      const regimeData = data as any;
      console.log(`  ${regime}:`);
      console.log(`    Hold: ${regimeData.hold || 0}, Buy: ${regimeData.buy || 0}, Sell: ${regimeData.sell || 0}`);
      console.log(`    Avg Confidence: ${(regimeData.avgConfidence / regimeData.count).toFixed(4)}`);
    }

    console.log('\nLOW CONFIDENCE SAMPLES (blocked):');
    if (lowConfidenceSamples.length === 0) {
      console.log('  (none found)');
    } else {
      lowConfidenceSamples.forEach(s => {
        console.log(`  Idx ${s.index}: ${s.regime} ${s.action} conf=${s.confidence.toFixed(4)} (need ${s.threshold}, gap=${s.gap})`);
      });
    }

    console.log('\nHIGH CONFIDENCE SAMPLES (would execute):');
    if (highConfidenceSamples.length === 0) {
      console.log('  (none found)');
    } else {
      highConfidenceSamples.forEach(s => {
        console.log(`  Idx ${s.index}: ${s.regime} ${s.action} conf=${s.confidence} (threshold=${s.threshold})`);
      });
    }

    // Full scan
    console.log('\n---\nFull Scan (all 8760 candles):\n');
    let fullHoldCount = 0;
    let fullLowConfidenceCount = 0;
    let fullTradeCount = 0;
    let profitScoreTooLowCount = 0;
    let pegFailCount = 0;
    let triggerFailCount = 0;
    const regimeSignalStats: Record<string, any> = {};
    const profitScores: number[] = [];

    for (let i = 20; i < ticks.length - 1; i++) {
      const historicalTicks = ticks.slice(0, i + 1);
      const regime = regimes[i] || 'UNKNOWN';
      const signal = agent.generateSignal(historicalTicks);

      if (!regimeSignalStats[regime]) {
        regimeSignalStats[regime] = { signals: 0, holds: 0, lowConf: 0, trades: 0, avgConf: 0 };
      }
      regimeSignalStats[regime].signals++;
      regimeSignalStats[regime].avgConf += signal.confidence;

      if (signal.action === 'HOLD') {
        fullHoldCount++;
        regimeSignalStats[regime].holds++;
        
        // Log to diagnose hold reasons
        if (i < 100) {
          if (signal.reason.includes('Profit potential')) {
            profitScoreTooLowCount++;
          } else if (signal.reason.includes('Energy')) {
            pegFailCount++;
          } else if (signal.reason.includes('Permission')) {
            triggerFailCount++;
          }
        }
        continue;
      }

      const threshold = regime === 'turbulent_chop' ? 0.25 : 0.3;
      if (signal.confidence < threshold) {
        fullLowConfidenceCount++;
        regimeSignalStats[regime].lowConf++;
        continue;
      }

      fullTradeCount++;
      regimeSignalStats[regime].trades++;
    }

    console.log(`FULL SCAN RESULTS:`);
    console.log(`  Total candles: ${ticks.length}`);
    console.log(`  Signals checked: ${ticks.length - 20}`);
    console.log(`  HOLD signals: ${fullHoldCount}`);
    console.log(`    - Profit score too low: ~${profitScoreTooLowCount} (sampled from first 100)`);
    console.log(`    - PEG energy fail: ~${pegFailCount}`);
    console.log(`    - TRIGGER permission fail: ~${triggerFailCount}`);
    console.log(`  Low confidence filtered: ${fullLowConfidenceCount}`);
    console.log(`  Trade-worthy signals: ${fullTradeCount}\n`);

    console.log('BY REGIME:');
    for (const [regime, stats] of Object.entries(regimeSignalStats)) {
      const s = stats as any;
      const tradeRate = s.signals > 0 ? (s.trades / s.signals * 100).toFixed(1) : '0.0';
      const lowConfRate = s.signals > 0 ? (s.lowConf / s.signals * 100).toFixed(1) : '0.0';
      console.log(`  ${regime}:`);
      console.log(`    Signals: ${s.signals}, Holds: ${s.holds}, LowConf: ${s.lowConf} (${lowConfRate}%), Trades: ${s.trades} (${tradeRate}%)`);
      console.log(`    Avg Confidence: ${(s.avgConf / s.signals).toFixed(4)}`);
    }

    // Proposed fixes
    console.log('\n' + '='.repeat(100));
    console.log('PROPOSED FIXES FOR ETH:\n');
    
    if (fullTradeCount === 0 && fullLowConfidenceCount > 0) {
      console.log('✅ ROOT CAUSE IDENTIFIED: Confidence threshold too high\n');
      console.log('RECOMMENDATION 1: Lower confidence thresholds for ETH');
      console.log(`  - Current: 0.3 (default), 0.25 (turbulent_chop)`);
      console.log(`  - Proposed: 0.25 (default), 0.2 (turbulent_chop)`);
      console.log(`  - This will capture more edge without destroying sharpe\n`);
      
      console.log('RECOMMENDATION 2: Add regime-specific thresholds');
      console.log(`  - Consolidation: 0.25 (currently 0.3)`);
      console.log(`  - Distribution: 0.28 (currently 0.3)`);
      console.log(`  - Turbulent Chop: 0.2 (currently 0.25)\n`);
    } else if (fullTradeCount > 0 && fullHoldCount > (ticks.length * 0.8)) {
      console.log('✅ ROOT CAUSE IDENTIFIED: Too many HOLD signals\n');
      console.log('RECOMMENDATION: Adjust regime thresholds for ETH');
      console.log(`  - Check volatility profile (PEG, TRIGGER thresholds)`);
      console.log(`  - ETH may need looser regime detection boundaries\n`);
    } else {
      console.log('⚠️  No clear blockers found - trades should execute');
      console.log(`  Trade-worthy signals: ${fullTradeCount}`);
      console.log('  If zero trades still execute, check position size calculation\n');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

main();
