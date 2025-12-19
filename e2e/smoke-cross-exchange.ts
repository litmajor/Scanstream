import { EventEmitter } from 'events';
import { CrossExchangeAggregator } from '../server/services/aggregator/cross-exchange-aggregator';
import { DiscoveryAgent } from '../server/agents/discovery-agent';
import { ArbitrageAgent } from '../server/agents/arbitrage-agent';
import { PortfolioAgent } from '../server/agents/portfolio-agent';

// Simple smoke test: create an event bus, wire aggregator+agents, emit synthetic world.tick events
(async function run() {
  const gate = new EventEmitter();
  const aggregator = new CrossExchangeAggregator(gate, 60_000);
  const discovery = new DiscoveryAgent(gate);
  const arb = new ArbitrageAgent(gate, aggregator, /*arbThreshold=*/0.1);
  const portfolio = new PortfolioAgent(gate, aggregator);

  // Forward arb signals (ArbitrageAgent emits on its own emitter; forward to gate)
  arb.on('arb.signal', (sig: any) => gate.emit('arb.signal', sig));
  gate.on('arb.signal', (sig: any) => console.log('[SMOKE] arb.signal received on gate:', sig));

  // Forward aggregated.updated to console
  aggregator.on('aggregated.updated', ({ symbol, aggregated }: any) => {
    console.log('[SMOKE] aggregated.updated', symbol, 'spread=', aggregated.spread, 'conf=', aggregated.confidence, 'sources=', aggregated.sourcesSeen);
  });

  // Simulate ticks from three exchanges for same symbol
  const symbol = 'BTC/USDT';
  const timeframe = 60;
  const now = Date.now();

  const makeTick = (src: string, close: number, ts: number) => ({
    symbol,
    timeframe,
    source: src,
    candle: { ts, open: close * 0.995, high: close * 1.01, low: close * 0.99, close, volume: 100, isFinal: true },
    isFinal: true,
    worldTime: ts + timeframe * 1000,
    emitTime: Date.now(),
  });

  // Emit ticks spaced slightly apart
  gate.emit('world.tick', makeTick('exchangeA', 50000, now - 2000));
  gate.emit('world.tick', makeTick('exchangeB', 50000.5, now - 1500));
  gate.emit('world.tick', makeTick('exchangeC', 50001, now - 1000));

  // Emit a larger price on exchangeC to create an arb opportunity
  setTimeout(() => {
    gate.emit('world.tick', makeTick('exchangeC', 50010, Date.now()));
  }, 200);

  // Wait a moment for agents to process then exit
  setTimeout(() => {
    console.log('[SMOKE] Done');
    process.exit(0);
  }, 1000);
})();
