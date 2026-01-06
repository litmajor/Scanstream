import * as path from 'path';
import * as fs from 'fs';
import { ConvexityBacktesterWithFoR } from './convexity-backtester-with-for.ts';

function range(start: number, end: number, step: number) {
  const out: number[] = [];
  for (let v = start; v <= end + 1e-9; v = +(v + step).toFixed(12)) out.push(+v.toFixed(6));
  return out;
}

async function runSweep() {
  const stopVals = range(0.7, 1.4, 0.1);
  const targetVals = range(1.8, 2.5, 0.1);
  const base = process.cwd();
  const symbols = [
    { symbol: 'ETH/USDT', data: path.join(base, 'data/cache/ETHUSDT_1h_365d.json') },
    { symbol: 'BTC/USDT', data: path.join(base, 'data/cache/BTCUSDT_1h_365d.json') },
  ];

  const outFile = path.join(base, 'run-target-stop-sweep-results.csv');
  const header = 'symbol,scoutTargetMultiplier,scoutStopMultiplier,totalScouts,foRTriggers,scoutWinRate,scoutAggregatePnl,scoutStops,scoutTargets,scoutTimeouts\n';
  fs.writeFileSync(outFile, header);

  for (const s of symbols) {
    console.log(`\nRunning 2D sweep for ${s.symbol}`);
    for (const t of targetVals) {
      for (const stop of stopVals) {
        const backtester = new ConvexityBacktesterWithFoR('Sweep2D');
        backtester.optimizationParams = {
          scoutTargetMultiplier: t,
          scoutStopMultiplier: stop,
          convexStopLossPercent: 0.02,
          convexMaxHoldingBars: 50,
          forConfidenceThreshold: 0.45,
          signalGenerationInterval: 20,
        } as any;

        // run may be sync or return a promise
        const res = await Promise.resolve(backtester.run({ symbol: s.symbol, dataPath: s.data }));

        const totalScouts = res.vfmdScoutTrades?.length || 0;
        const foRTriggers = res.diagnostics?.forTriggers || 0;
        const scoutWinRate = res.diagnostics?.scoutWinRate || 0;
        const scoutAggregatePnl = res.vfmdScoutTrades ? res.vfmdScoutTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) : 0;
        const scoutStops = res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'STOP').length : 0;
        const scoutTargets = res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'TARGET').length : 0;
        const scoutTimeouts = res.vfmdScoutTrades ? res.vfmdScoutTrades.filter((t: any) => t.exitReason === 'TIMEOUT').length : 0;

        const line = `${s.symbol},${t},${stop},${totalScouts},${foRTriggers},${scoutWinRate},${scoutAggregatePnl},${scoutStops},${scoutTargets},${scoutTimeouts}\n`;
        fs.appendFileSync(outFile, line);

        console.log(` T=${t.toFixed(2)} S=${stop.toFixed(2)} | Scouts:${totalScouts} FoR:${foRTriggers} Stops:${scoutStops} Targets:${scoutTargets} TO:${scoutTimeouts} PnL:${scoutAggregatePnl}`);
      }
    }
  }

  console.log(`\nSaved results to ${outFile}`);
}

runSweep().catch(err => { console.error(err); process.exit(1); });
