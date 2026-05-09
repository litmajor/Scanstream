# 🔄 AGENTS & WORLD TICKS — Optional Subscription Guide

## Current Architecture

Agents are currently accessed via **pull model** (on-demand API calls):

```
UI/Client
  ↓ (polling every 30s)
GET /api/ml-signals?symbol=BTC/USDT
GET /api/rl-agent/signals?symbol=BTC/USDT
GET /api/physics-agents/vfmd?symbol=BTC/USDT
  ↓
Agent processes data
  ↓
Returns signal to client
```

This is **fine for dashboard display**. Agents get the latest data when asked.

---

## Optional: Push Model via World Ticks

For **real-time autonomous trading**, agents can optionally subscribe to world ticks:

```
Integrity Gate validates candle
  ↓
emit('world.tick', { symbol, candle, isFinal })
  ↓
Agent listens to world.tick
  ↓ (automatic, deterministic)
Agent analyzes candle instantly
  ↓
Executes trade or updates state
```

### When to Use Push Model

Use world tick subscription when:
- You need sub-100ms reaction time
- Agent should act automatically (not wait for UI polling)
- Building autonomous trading bots
- Testing with simulated time (replay)

Keep pull model when:
- Dashboard display (client controls polling)
- Periodic analysis (every 5 minutes)
- Backtesting (iterate through ticks manually)

---

## How Agents Subscribe to World Ticks

### Option A: Subscribe in Agent Constructor

```typescript
// server/services/rpg-agents/MLOracle.ts

import { getMarketDataLayer } from '../market-data/market-data-layer';
import type { WorldTick } from '../../types/market-data';

export class MLOracle extends TradingAgent {
  constructor(name: string) {
    super(name, 'ML_PREDICTION', 'balanced');
    
    // Subscribe to world ticks (optional)
    const mdl = getMarketDataLayer();
    mdl.on('world.tick', (tick: WorldTick) => {
      // Only process if this tick is for a symbol we care about
      if (this.isTracking(tick.symbol)) {
        this.onWorldTick(tick);
      }
    });
  }

  /**
   * Called when a world tick is emitted
   * This happens in real-time as validated candles arrive
   */
  private async onWorldTick(tick: WorldTick): Promise<void> {
    try {
      // Tick is guaranteed to be validated and canonical
      const signal = await this.analyzeCandle(tick.candle);
      
      // Store signal for later API call, or execute trade
      this.lastSignal = signal;
      
      console.log(`[${this.name}] Received world tick: ${tick.symbol} ${tick.candle.close}`);
    } catch (error) {
      console.error(`[${this.name}] Error processing world tick:`, error);
    }
  }

  /**
   * Analyze a single validated candle
   */
  private async analyzeCandle(candle: Candle): Promise<AgentSignal | null> {
    // Your analysis logic here
    // Candle is guaranteed to be:
    // ✅ Validated (passed integrity checks)
    // ✅ Finalized (history is frozen)
    // ✅ Continuous (no gaps)
    return null; // or AgentSignal
  }

  /**
   * Existing method for pull model (API call)
   * This still works independently
   */
  processSignal(marketData: any): AgentSignal | null {
    // Existing logic for on-demand analysis
    return null;
  }

  private isTracking(symbol: string): boolean {
    return ['BTC/USDT', 'ETH/USDT'].includes(symbol);
  }
}
```

### Option B: Create World Tick Handler Function

```typescript
// server/services/rpg-agents/world-tick-handler.ts

import { getMarketDataLayer } from '../market-data/market-data-layer';
import type { WorldTick } from '../../types/market-data';

/**
 * Initialize world tick handlers for all agents
 * Call this once at server startup
 */
export function initializeWorldTickHandlers(arena: AgentArena): void {
  const mdl = getMarketDataLayer();

  // Subscribe to all world ticks
  mdl.on('world.tick', (tick: WorldTick) => {
    // Find agents tracking this symbol
    const agents = arena
      .getAllAgents()
      .filter(a => a.isTrackingSymbol?.(tick.symbol));

    // Notify each agent
    for (const agent of agents) {
      agent.onWorldTick?.(tick).catch(err => {
        console.error(`[${agent.name}] World tick error:`, err);
      });
    }

    // Log for monitoring
    if (agents.length > 0) {
      console.log(
        `[WorldTickHandler] Notified ${agents.length} agents ` +
        `about ${tick.symbol} at ${tick.candle.close}`
      );
    }
  });

  console.log('[WorldTickHandler] ✅ World tick listeners initialized');
}
```

### Option C: Agent Arena Broadcasts World Ticks

```typescript
// server/services/rpg-agents/AgentArena.ts

import { getMarketDataLayer } from '../market-data/market-data-layer';
import type { WorldTick } from '../../types/market-data';

export class AgentArena {
  // ... existing code ...

  initialize(): void {
    // ... existing initialization ...

    // NEW: Subscribe arena to world ticks
    const mdl = getMarketDataLayer();
    mdl.on('world.tick', (tick: WorldTick) => {
      this.broadcastWorldTick(tick);
    });
  }

  /**
   * Broadcast world tick to all registered agents
   */
  private broadcastWorldTick(tick: WorldTick): void {
    for (const agent of this.agents.values()) {
      // Skip if agent doesn't implement handler
      if (!('onWorldTick' in agent)) continue;

      // Call handler asynchronously (don't block)
      (agent as any).onWorldTick(tick).catch((err: any) => {
        console.warn(`[Arena] Agent ${agent.name} world tick error:`, err.message);
      });
    }
  }
}
```

---

## API: Agent Methods for World Tick Support

### Optional Interface for Agents

```typescript
// server/services/rpg-agents/TradingAgent.ts

export interface WorldTickHandler {
  /**
   * Called when a world tick is emitted
   * 
   * This method is:
   * - Optional (agents can ignore world ticks)
   * - Asynchronous (don't block)
   * - Received only if agent subscribes
   */
  onWorldTick(tick: WorldTick): Promise<void>;

  /**
   * Check if agent is tracking this symbol
   * Prevents unnecessary processing
   */
  isTrackingSymbol(symbol: string): boolean;
}

export class TradingAgent implements Partial<WorldTickHandler> {
  /**
   * Override this method to handle world ticks
   */
  async onWorldTick(tick: WorldTick): Promise<void> {
    // Default: do nothing
    // Subclasses can override
  }

  /**
   * Override this to filter symbols
   */
  isTrackingSymbol(symbol: string): boolean {
    // Default: track all
    return true;
  }
}
```

---

## Example: Real-Time ML Agent

```typescript
// server/services/rpg-agents/MLOracle.ts

export class MLOracle extends TradingAgent {
  private tradingSymbols = new Set<string>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  private lastCandles = new Map<string, Candle>();

  constructor(name: string) {
    super(name, 'ML_PREDICTION', 'balanced');
    
    // Subscribe to world ticks at construction
    const mdl = getMarketDataLayer();
    mdl.on('world.tick', (tick) => this.onWorldTick(tick));
  }

  /**
   * Real-time reaction to world ticks
   * Emitted when integrity gate validates a candle
   */
  async onWorldTick(tick: WorldTick): Promise<void> {
    if (!this.isTrackingSymbol(tick.symbol)) return;

    // Store for later API calls
    this.lastCandles.set(tick.symbol, tick.candle);

    // Optional: Run lightweight analysis
    const quickSignal = await this.quickAnalyze(tick.candle);
    
    if (quickSignal?.action === 'BUY') {
      // Could trigger autonomous trade here
      console.log(`[${this.name}] ⚡ Buy signal detected for ${tick.symbol}`);
    }
  }

  /**
   * Lightweight analysis for world tick
   * (heavy analysis can stay in processSignal for API)
   */
  private async quickAnalyze(candle: Candle): Promise<AgentSignal | null> {
    // Quick checks only
    if (candle.volume > 1000000 && candle.close > candle.open) {
      return {
        action: 'BUY',
        confidence: 0.7,
        entry: candle.close,
        target: candle.close * 1.02,
        stop: candle.close * 0.98,
        reason: 'Volume + momentum',
        agent_name: this.name,
        agent_level: this.level,
      };
    }
    return null;
  }

  /**
   * Full analysis for API calls
   * (client pulls this on-demand)
   */
  processSignal(marketData: any): AgentSignal | null {
    // Existing logic for dashboard display
    // Can use this.lastCandles for context
    return null;
  }

  isTrackingSymbol(symbol: string): boolean {
    return this.tradingSymbols.has(symbol);
  }
}
```

---

## Server Startup Integration

### Initialize World Tick Broadcasting

```typescript
// server/index.ts

import { initializeWorldTickHandlers } from './services/rpg-agents/world-tick-handler';
import { getAgentArena } from './services/rpg-agents/AgentArena';

async function startServer() {
  // ... existing initialization ...

  // Initialize integrity gate and world ticks
  const integrityGate = getIntegrityGate();
  console.log('[Server] ✅ Integrity gate initialized');

  // Initialize MDL
  const mdl = getMarketDataLayer();
  console.log('[Server] ✅ Market Data Layer initialized');

  // Set up agents to listen to world ticks
  const arena = getAgentArena();
  initializeWorldTickHandlers(arena);
  console.log('[Server] ✅ World tick broadcasting enabled');

  // Log world ticks for debugging
  mdl.on('world.tick', (tick) => {
    console.log(
      `[WorldTick] ${tick.symbol}:${tick.timeframe}s ` +
      `close=${tick.candle.close} final=${tick.isFinal}`
    );
  });

  // ... rest of startup ...
}
```

---

## Testing World Ticks Locally

### Manual Test: Listen to Events

```typescript
// test/world-tick-test.ts

import { getMarketDataLayer } from '../server/services/market-data/market-data-layer';
import { getIntegrityGate } from '../server/services/market-data/integrity-gate';

async function testWorldTicks() {
  const mdl = getMarketDataLayer();
  const gate = getIntegrityGate();

  // Subscribe to world ticks
  let tickCount = 0;
  mdl.on('world.tick', (tick) => {
    tickCount++;
    console.log(
      `[Test] Tick ${tickCount}: ${tick.symbol} ${tick.candle.close} ` +
      `final=${tick.isFinal}`
    );
  });

  // Simulate candle validation
  const result = await gate.storeValidatedCandles('BTC/USDT', 3600, [
    {
      ts: Date.now() - 3600000,
      open: 45000,
      high: 45500,
      low: 44800,
      close: 45234,
      volume: 100000,
      isFinal: true,
      source: 'test',
    },
  ]);

  console.log(`[Test] Emitted ${result.ticks.length} world ticks`);
  console.log(`[Test] Total world ticks received: ${tickCount}`);
}
```

### Test Output (Expected)

```
[Server] ✅ Integrity gate initialized
[Server] ✅ Market Data Layer initialized
[Server] ✅ World tick broadcasting enabled
[IntegrityGate] ✅ World Tick: BTC/USDT 3600s close=45234.10 final=true
[WorldTick] BTC/USDT:3600s close=45234.10 final=true
[MLOracle] Received world tick: BTC/USDT at 45234.10
[Test] Tick 1: BTC/USDT 45234.10 final=true
[Test] Emitted 1 world ticks
[Test] Total world ticks received: 1
```

---

## Migration Path

### Phase 1: Keep Pull Model (Current)
- Agents respond to API calls (on-demand)
- Dashboard polls agents every 30s
- ✅ Works, no changes needed

### Phase 2: Add Push Model (Optional)
- Agents optionally subscribe to world ticks
- Real-time analysis happens automatically
- Pull model still works for backward compatibility
- ✅ Best of both worlds

### Phase 3: Autonomous Trading (Future)
- Agents execute trades based on world ticks
- Arena orchestrates multi-agent consensus
- Pull model for monitoring only
- ✅ Real-time autonomous system

---

## Verification Checklist

- [ ] Integrity gate emits 'world.tick' events ✅
- [ ] MarketDataLayer broadcasts events correctly ✅
- [ ] Agents CAN subscribe to 'world.tick' if they want to
- [ ] Agents still work via API calls (pull model)
- [ ] Pull and push models don't conflict
- [ ] Server logs show world tick emissions
- [ ] Tests verify event propagation

---

## Conclusion

**Agents don't NEED to subscribe to world ticks.** The pull model (API calls) continues to work perfectly.

But now **agents CAN subscribe** if they need real-time reactions.

This gives you flexibility:
- **Dashboard**: Use pull model (client controls polling)
- **Autonomous bot**: Use push model (agent controls reactions)
- **Both**: Use both simultaneously!

The critical guarantees remain:
- ✅ World Ticks only see validated data
- ✅ Agents can rely on canonical facts
- ✅ No double-counting, no race conditions
- ✅ Deterministic replay still works

---

**Last Updated:** 2025-12-13  
**Status:** 📖 Guidance complete (implementation optional)
