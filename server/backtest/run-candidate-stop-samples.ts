import * as path from 'path';
import * as fs from 'fs';
import { ConvexityBacktesterWithFoR, BacktestResult } from './convexity-backtester-with-for.ts';

type Candidate = { scoutTargetMultiplier: number; scoutStopMultiplier: number; name: string };

const candidates: Candidate[] = [
  { scoutTargetMultiplier: 2.4, scoutStopMultiplier: 1.4, name: 'Aggressive (2.4 / 1.4)' },
  { scoutTargetMultiplier: 2.0, scoutStopMultiplier: 1.0, name: 'Conservative (2.0 / 1.0)' },
];

const symbols = [
  { symbol: 'ETH/USDT', data: path.join(process.cwd(), 'data/cache/ETHUSDT_1h_365d.json') },
  { symbol: 'BTC/USDT', data: path.join(process.cwd(), 'data/cache/BTCUSDT_1h_365d.json') },
];

function printStopSamples(result: BacktestResult, backtester: ConvexityBacktesterWithFoR, dataPath: string, sampleCount = 20) {
  const stops = result.vfmdScoutTrades.filter(t => t.exitReason === 'STOP');
  console.log(`\n--- Stop samples (showing up to ${sampleCount}) — total stops: ${stops.length}`);
  if (stops.length === 0) return;

  const candles = (backtester as any).loadMarketData(dataPath) as any[];

  for (let i = 0; i < Math.min(sampleCount, stops.length); i++) {
    const s = stops[i];
    const entry = s.entryBar;
    const start = Math.max(0, entry - 3);
    const end = Math.min(candles.length - 1, entry + 5);
    const window = candles.slice(start, end + 1).map((c: any, idx: number) => ({
      bar: start + idx,
      close: c.close,
      high: c.high,
      low: c.low
    }));

    const stopPct = ((s.stop - s.entryPrice) / s.entryPrice * 100).toFixed(3);
    const pnl = (s.pnl || 0).toFixed(4);
    console.log(` Sample ${i + 1}: entryBar=${s.entryBar}, entry=${s.entryPrice.toFixed(4)}, stop=${s.stop.toFixed(4)}, stopPct=${stopPct}%, pnl=${pnl}, barsHeld=${(s.exitBar! - s.entryBar)}`);
    console.log('  Surrounding prices:');
    console.log('   ' + window.map(w => `${w.bar}:${w.close.toFixed(4)} [${w.low.toFixed(4)}-${w.high.toFixed(4)}]`).join(' | '));
  }
}

async function main() {
  for (const c of candidates) {
    console.log('\n' + '='.repeat(80));
    console.log(`Candidate: ${c.name} — target=${c.scoutTargetMultiplier}, stop=${c.scoutStopMultiplier}`);

    for (const s of symbols) {
      console.log('\n' + '-'.repeat(60));
      console.log(`Symbol: ${s.symbol}`);
      const backtester = new ConvexityBacktesterWithFoR('CandidateRunner');
      backtester.optimizationParams = {
        ...backtester.optimizationParams,
        scoutTargetMultiplier: c.scoutTargetMultiplier,
        scoutStopMultiplier: c.scoutStopMultiplier,
      } as any;

      const res: BacktestResult = backtester.run({ symbol: s.symbol, dataPath: s.data });

      // Print short summary
      const totalScouts = res.vfmdScoutTrades.length;
      const stopCount = res.vfmdScoutTrades.filter(t => t.exitReason === 'STOP').length;
      const targetCount = res.vfmdScoutTrades.filter(t => t.exitReason === 'TARGET').length;
      const timeoutCount = res.vfmdScoutTrades.filter(t => t.exitReason === 'TIMEOUT').length;
      const scoutPnl = res.vfmdScoutTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      console.log(` Summary — Scouts: ${totalScouts} | Stops: ${stopCount} | Targets: ${targetCount} | Timeouts: ${timeoutCount} | ScoutPnL: ${scoutPnl.toFixed(2)}`);

      // Print 20 stop-hit samples
      printStopSamples(res, backtester, s.data, 20);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
