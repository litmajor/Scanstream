/**
 * EXTRACT-TRADE-METADATA
 * 
 * Runs backtest with detailed logging enabled.
 * Outputs enriched trade CSV with signal conditions at entry time:
 * - timestamp, symbol, direction, entryPrice, exitPrice, pnlPct
 * - peg, pegZscore, ti, coherence, regime
 * - volBias, mtf4h, vwapDeviation, compressionScore
 * - exitReason, winner, exitCandle
 * 
 * Then analyzes: which conditions predict stop_hits vs time_stops?
 * 
 * Usage:
 *   pnpm exec tsx server/scripts/extract-trade-metadata.ts [symbol] [year]
 */

import fs from 'fs';
import path from 'path';
import BinanceDataFetcher from '../services/vfmd/binanceDataFetcher';
import VFMDPhysicsAgent from '../services/rpg-agents/VFMDPhysicsAgent';
import { MarketTick } from '../services/vfmd/types';

interface EnrichedTrade {
  timestamp: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  entryIndex: number;
  exitPrice: number;
  exitCandle: number;
  pnlPct: number;
  winner: boolean;
  exitReason: string;
  
  // Signal conditions at entry
  peg: number;
  pegZscore: number;
  turbulenceIndex: number;
  coherence: number;
  regime: string;
  volBias: number;
  mtf4hTrend: string;
  vwapDeviation: number;
  compressionScore: number;
  confidence: number;
}

async function extractTradeMetadata() {
  console.log('🔍 TRADE METADATA EXTRACTOR');
  console.log('='.repeat(80));
  console.log('');
  
  const args = process.argv.slice(2);
  const assetShort = args[0]?.toUpperCase() || 'BTC';
  const year = args[1] ? parseInt(args[1]) : 2024;
  
  const assetMap: Record<string, string> = {
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'SOL': 'SOLUSDT',
  };
  
  const symbol = assetMap[assetShort];
  if (!symbol) {
    console.error(`❌ Unknown asset: ${assetShort}`);
    process.exit(1);
  }
  
  // Load data
  console.log(`📊 Loading ${symbol} 1h candles for ${year}...`);
  const fetcher = new BinanceDataFetcher();
  
  const cacheFile = `./data/cache/${symbol}_1h_${year}.json`;
  let ticks: MarketTick[];
  
  if (fs.existsSync(cacheFile)) {
    console.log(`✅ Found cache: ${cacheFile}`);
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    ticks = Array.isArray(data) ? data : (data.data || data.ticks || data);
  } else {
    console.error(`❌ Cache not found: ${cacheFile}`);
    process.exit(1);
  }
  
  console.log(`✅ Loaded ${ticks.length} candles`);
  console.log(`   Period: ${ticks[0].timestamp} to ${ticks[ticks.length-1].timestamp}\n`);
  
  // Initialize agent
  const agent = new VFMDPhysicsAgent('backtest', 'balanced');
  const trades: EnrichedTrade[] = [];
  
  let position: { 
    entryIndex: number; 
    entryPrice: number; 
    direction: 'LONG' | 'SHORT'; 
    stopPrice: number;
    signal: any 
  } | null = null;
  
  console.log('⚙️  Simulating trades...');
  
  // Simulate trading
  for (let i = 100; i < ticks.length - 10; i++) {
    const historicalTicks = ticks.slice(0, i + 1);
    const signal = agent.generateSignal(historicalTicks);
    
    // Entry
    if (signal.action !== 'HOLD' && !position) {
      const metadata = (signal as any)?.metadata || {};
      
      position = {
        entryIndex: i,
        entryPrice: ticks[i].close,
        direction: signal.action === 'BUY' ? 'LONG' : 'SHORT',
        stopPrice: signal.stop ?? 0,
        signal: {
          peg: metadata.peg_tier_signal?.peg_current ?? 0,
          pegZscore: metadata.peg_tier_signal?.delta_peg ?? 0,
          turbulenceIndex: metadata.turbulence_adjustment ?? 1.0,
          coherence: metadata.trigger_state?.coherence ?? 0,
          regime: metadata.regime ?? 'unknown',
          volBias: metadata.trigger_state?.volume_bias ?? 0.5,
          mtf4hTrend: metadata.trigger_state?.mtf_4h_trend ?? 'flat',
          vwapDeviation: metadata.trigger_state?.vwap_deviation ?? 0,
          compressionScore: metadata.compressionScore ?? 0,
          confidence: signal.confidence ?? 0,
        }
      };
    }
    
    // Exit
    if (position) {
      let shouldExit = false;
      let exitReason = 'time_stop';
      let exitCandle = i - position.entryIndex;
      
      const nextSignal = agent.generateSignal(ticks.slice(0, i + 1));
      
      // Time stop (8 candles)
      if (exitCandle >= 8) {
        shouldExit = true;
        exitReason = 'time_stop';
      } 
      // Stop hit
      else if (position.stopPrice > 0) {
        const low = ticks[i].low;
        const high = ticks[i].high;
        
        if (position.direction === 'LONG' && low <= position.stopPrice) {
          shouldExit = true;
          exitReason = 'stop_hit';
        } else if (position.direction === 'SHORT' && high >= position.stopPrice) {
          shouldExit = true;
          exitReason = 'stop_hit';
        }
      }
      // Opposite signal
      else if ((position.direction === 'LONG' && nextSignal.action === 'SELL') ||
               (position.direction === 'SHORT' && nextSignal.action === 'BUY')) {
        shouldExit = true;
        exitReason = 'opposite_signal';
      }
      
      if (shouldExit) {
        const exitPrice = position.direction === 'LONG'
          ? Math.min(ticks[i].close, position.stopPrice > 0 ? position.stopPrice : ticks[i].close)
          : Math.max(ticks[i].close, position.stopPrice > 0 ? position.stopPrice : ticks[i].close);
        
        const pnlPct = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) / position.entryPrice - 0.0014
          : (position.entryPrice - exitPrice) / position.entryPrice - 0.0014;
        
        trades.push({
          timestamp: ticks[i].timestamp,
          symbol,
          direction: position.direction,
          entryPrice: position.entryPrice,
          entryIndex: position.entryIndex,
          exitPrice,
          exitCandle,
          pnlPct,
          winner: pnlPct > 0,
          exitReason,
          ...position.signal,
        });
        
        position = null;
      }
    }
  }
  
  console.log(`✅ Extracted ${trades.length} trades\n`);
  
  // Write CSV
  const outputDir = './data/trade-logs';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const csvPath = path.join(outputDir, `trades_${symbol}_1h_${year}.csv`);
  
  if (trades.length > 0) {
    const header = Object.keys(trades[0]).join(',');
    const rows = trades.map(t => 
      Object.values(t).map(v => 
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(',')
    );
    
    fs.writeFileSync(csvPath, [header, ...rows].join('\n'));
    console.log(`💾 Saved to: ${csvPath}\n`);
  }
  
  // Analyze
  analyzeTradeMetadata(trades);
}

function analyzeTradeMetadata(trades: EnrichedTrade[]) {
  console.log('='.repeat(80));
  console.log('📊 TRADE CONDITION ANALYSIS');
  console.log('='.repeat(80));
  
  const winners = trades.filter(t => t.winner);
  const losers = trades.filter(t => !t.winner);
  const timeStops = trades.filter(t => t.exitReason === 'time_stop');
  const stopHits = trades.filter(t => t.exitReason === 'stop_hit');
  const oppositeSignals = trades.filter(t => t.exitReason === 'opposite_signal');
  
  console.log(`\n📈 Overall stats:`);
  console.log(`   Total trades: ${trades.length}`);
  console.log(`   Winners: ${winners.length} (${(winners.length/trades.length*100).toFixed(1)}%)`);
  console.log(`   Losers: ${losers.length} (${(losers.length/trades.length*100).toFixed(1)}%)`);
  console.log(`   Avg PnL: ${(trades.reduce((s,t) => s + t.pnlPct, 0) / trades.length * 100).toFixed(3)}%`);
  
  console.log(`\n🎯 Exit reason breakdown:`);
  console.log(`   Time stops: ${timeStops.length} (${(timeStops.length/trades.length*100).toFixed(1)}%) | WR: ${timeStops.length > 0 ? (timeStops.filter(t => t.winner).length/timeStops.length*100).toFixed(1) : 'N/A'}%`);
  console.log(`   Stop hits: ${stopHits.length} (${(stopHits.length/trades.length*100).toFixed(1)}%) | WR: ${stopHits.length > 0 ? (stopHits.filter(t => t.winner).length/stopHits.length*100).toFixed(1) : 'N/A'}%`);
  console.log(`   Opposite signal: ${oppositeSignals.length} (${(oppositeSignals.length/trades.length*100).toFixed(1)}%) | WR: ${oppositeSignals.length > 0 ? (oppositeSignals.filter(t => t.winner).length/oppositeSignals.length*100).toFixed(1) : 'N/A'}%`);
  
  // Analyze which conditions predict stop_hits (losers)
  console.log(`\n⚠️ CONDITIONS IN LOSING TRADES (that predict stop_hits):`);
  
  // By regime
  const regimeStats = new Map<string, { total: number; stopHits: number; winners: number }>();
  for (const t of losers) {
    const key = t.regime;
    if (!regimeStats.has(key)) regimeStats.set(key, { total: 0, stopHits: 0, winners: 0 });
    const stats = regimeStats.get(key)!;
    stats.total++;
    if (t.exitReason === 'stop_hit') stats.stopHits++;
    if (t.winner) stats.winners++;
  }
  
  console.log(`\n   📍 By regime:`);
  for (const [regime, stats] of regimeStats) {
    const stopHitPct = (stats.stopHits / stats.total * 100).toFixed(1);
    const icon = stats.stopHits / stats.total > 0.6 ? '🔴' : stats.stopHits / stats.total > 0.4 ? '🟡' : '🟢';
    console.log(`   ${icon} ${regime.padEnd(15)} : ${stats.stopHits}/${stats.total} stop_hits (${stopHitPct}%)`);
  }
  
  // By PEG bucket
  const pegStats = new Map<string, { total: number; stopHits: number }>();
  for (const t of losers) {
    const bucket = t.pegZscore < -0.5 ? 'coiling' : t.pegZscore > 0.5 ? 'spent' : 'neutral';
    if (!pegStats.has(bucket)) pegStats.set(bucket, { total: 0, stopHits: 0 });
    const stats = pegStats.get(bucket)!;
    stats.total++;
    if (t.exitReason === 'stop_hit') stats.stopHits++;
  }
  
  console.log(`\n   🔹 By PEG bucket:`);
  for (const [bucket, stats] of pegStats) {
    const stopHitPct = (stats.stopHits / stats.total * 100).toFixed(1);
    const icon = stats.stopHits / stats.total > 0.6 ? '🔴' : stats.stopHits / stats.total > 0.4 ? '🟡' : '🟢';
    console.log(`   ${icon} ${bucket.padEnd(15)} : ${stats.stopHits}/${stats.total} stop_hits (${stopHitPct}%)`);
  }
  
  // By turbulence
  const turbStats = new Map<string, { total: number; stopHits: number }>();
  for (const t of losers) {
    const bucket = t.turbulenceIndex > 0.75 ? 'high_turb' : 'low_turb';
    if (!turbStats.has(bucket)) turbStats.set(bucket, { total: 0, stopHits: 0 });
    const stats = turbStats.get(bucket)!;
    stats.total++;
    if (t.exitReason === 'stop_hit') stats.stopHits++;
  }
  
  console.log(`\n   ⚡ By turbulence level:`);
  for (const [bucket, stats] of turbStats) {
    const stopHitPct = (stats.stopHits / stats.total * 100).toFixed(1);
    const icon = stats.stopHits / stats.total > 0.6 ? '🔴' : stats.stopHits / stats.total > 0.4 ? '🟡' : '🟢';
    console.log(`   ${icon} ${bucket.padEnd(15)} : ${stats.stopHits}/${stats.total} stop_hits (${stopHitPct}%)`);
  }
  
  console.log(`\n💡 EXCLUSION FILTER RECOMMENDATION:`);
  console.log(`\n   Add these filters to exclude stop_hit losers:`);
  
  let recs: string[] = [];
  for (const [regime, stats] of regimeStats) {
    if (stats.stopHits / stats.total > 0.6) {
      recs.push(`   ❌ regime = "${regime}"`);
    }
  }
  
  for (const [bucket, stats] of pegStats) {
    if (stats.stopHits / stats.total > 0.6) {
      recs.push(`   ❌ peg_bucket = "${bucket}"`);
    }
  }
  
  if (recs.length > 0) {
    recs.forEach(r => console.log(r));
  } else {
    console.log(`   (No single condition filters >60% of stop_hits)`);
    console.log(`    Try combinations of regime + PEG + turbulence)`);
  }
  
  console.log(`\n📊 Time-stops are your edge (WR ${(timeStops.filter(t => t.winner).length / Math.max(1, timeStops.length) * 100).toFixed(1)}%)`);
  console.log(`   They assume entry timing is early → patience works`);
  console.log(`\n   Stop-hits are losers (WR ${(stopHits.filter(t => t.winner).length / Math.max(1, stopHits.length) * 100).toFixed(1)}%)`);
  console.log(`   They mean entry timing was already late → protect immediately`);
  console.log(`\n   Goal: Identify conditions that predict "already late" entries`);
  console.log(`   Then skip those conditions (exclusion filter).`);
}

extractTradeMetadata().catch(console.error);
