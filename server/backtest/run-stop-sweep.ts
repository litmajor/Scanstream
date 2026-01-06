import * as path from 'path';
import * as fs from 'fs';
import { ConvexityBacktesterWithFoR } from './convexity-backtester-with-for.ts';

interface SweepResult {
  symbol: string;
  scoutTargetMultiplier: number;
  scoutStopMultiplier: number;
  totalScouts: number;
  foRTriggers: number;
  scoutWinRate: number;
  scoutAggregatePnl: number;
  scoutStops: number;
  scoutTargets: number;
  scoutTimeouts: number;
}

async function runSweep() {
  const stops = [0.5, 0.7, 1.0, 1.4, 2.0];
  const target = 2.0;
  const base = process.cwd();
  const symbols = [
    { symbol: 'ETH/USDT', data: path.join(base, 'data/cache/ETHUSDT_1h_365d.json') },
    { symbol: 'BTC/USDT', data: path.join(base, 'data/cache/BTCUSDT_1h_365d.json') },
  ];

  const results: SweepResult[] = [];

  for (const s of symbols) {
    console.log(`\nRunning sweep for ${s.symbol}`);
    for (const stopMult of stops) {
      const backtester = new ConvexityBacktesterWithFoR('SweepRunner');
      backtester.optimizationParams = {
        scoutTargetMultiplier: target,
        scoutStopMultiplier: stopMult,
        convexStopLossPercent: 0.02,
        convexMaxHoldingBars: 50,
        forConfidenceThreshold: 0.45,
        signalGenerationInterval: 20,
      } as any;

      const res = backtester.run({ symbol: s.symbol, dataPath: s.data });

      const r: SweepResult = {
        symbol: s.symbol,
        scoutTargetMultiplier: target,
        scoutStopMultiplier: stopMult,
        totalScouts: res.vfmdScoutTrades?.length || 0,
        foRTriggers: res.diagnostics?.forTriggers || 0,
        scoutWinRate: res.diagnostics?.scoutWinRate || 0,
        scoutAggregatePnl: res.vfmdScoutTrades ? res.vfmdScoutTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) : 0,
        scoutStops: res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'STOP').length : 0,
        scoutTargets: res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'TARGET').length : 0,
        scoutTimeouts: res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'TIMEOUT').length : 0,
      };

      results.push(r);

      console.log(` StopMult: ${stopMult.toFixed(2)} | Scouts: ${r.totalScouts} | FoR: ${r.foRTriggers} | Stops: ${r.scoutStops} | Targets: ${r.scoutTargets} | Timeout: ${r.scoutTimeouts} | ScoutPnl: ${r.scoutAggregatePnl}`);
    }
  }

  const out = 'run-stop-sweep-results.csv';
  const header = 'symbol,scoutTargetMultiplier,scoutStopMultiplier,totalScouts,foRTriggers,scoutWinRate,scoutAggregatePnl,scoutStops,scoutTargets,scoutTimeouts\n';
  const lines = results.map(r => `${r.symbol},${r.scoutTargetMultiplier},${r.scoutStopMultiplier},${r.totalScouts},${r.foRTriggers},${r.scoutWinRate},${r.scoutAggregatePnl},${r.scoutStops},${r.scoutTargets},${r.scoutTimeouts}`).join('\n');
  fs.writeFileSync(out, header + lines);
  console.log(`\nSaved results to ${out}`);
}

runSweep().catch(err => { console.error(err); process.exit(1); });
