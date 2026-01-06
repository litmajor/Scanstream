import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';

// Lazily import/get the integrity gate so this module can be imported
// before the gate is initialized in startup code.
async function getGate(): Promise<any | null> {
  try {
    const mod = await import('./services/market-data/integrity-gate');
    const g = (mod as any).getIntegrityGate;
    if (typeof g === 'function') {
      try {
        return await g();
      } catch (e) {
        return g();
      }
    }
    return g || null;
  } catch (err) {
    return null;
  }
}

export function initializeWebsocketBridge(server: http.Server, path = '/events') {
  const wss = new WebSocketServer({ server, path });
  
  // Also create a separate WebSocket server on /ws for raw connections (not Socket.IO)
  const rawWss = new WebSocketServer({ server, path: '/ws' });

  console.log('[WS-Bridge] WebSocket bridge listening at', path);
  console.log('[WS-Bridge] Raw WebSocket server listening at /ws');

  // Map of subscribed event names
  const eventNames = [
    'world.tick',
    'consensus.updated',
    'arb.signal',
    'execution.filled',
    'gap.detected',
    'gaps.detected',
    'aggregated.updated',
    'integrity.report',
    'candles.rejected',
    // PHASE 5: Real-time updates
    'phase5:signal:update',
    'phase5:agent:update',
    'phase5:regime:update',
    'phase5:signal:new'
  ];

  // Helper: forward message to clients
  function broadcast(obj: any) {
    const msg = JSON.stringify(obj);
    wss.clients.forEach((c: any) => {
      if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
  }

  // Subscribe to gate when available
  (async () => {
    const gate = await getGate();
    if (!gate) {
      console.warn('[WS-Bridge] Integrity gate not available — bridge will still accept clients but no gate events will be forwarded');
      return;
    }

    const subs: Array<{ evt: string; cb: (...a:any[])=>void }> = [];
    eventNames.forEach((evt) => {
      const cb = (payload: any) => {
        try {
          broadcast({ type: evt, payload });
        } catch (e) { /* ignore */ }
      };
      (gate as any).on(evt, cb);
      subs.push({ evt, cb });
    });

    wss.on('close', () => {
      subs.forEach(s => (gate as any).off(s.evt, s.cb));
    });
  })();

  // PHASE 5: Subscribe to Phase 5 real-time events
  (async () => {
    try {
      const { phase5EventBridge } = await import('./services/phase5-event-bridge');
      
      const phase5Subs: Array<{ evt: string; cb: (...a:any[])=>void }> = [];
      
      // Subscribe to Phase 5 signal events
      const onSignalNew = (data: any) => {
        try {
          broadcast({ type: 'phase5:signal:new', timestamp: Date.now(), payload: data });
        } catch (e) { /* ignore */ }
      };
      phase5EventBridge.on('phase5:signal:new', onSignalNew);
      phase5Subs.push({ evt: 'phase5:signal:new', cb: onSignalNew });

      // Subscribe to Phase 5 signal update events
      const onSignalUpdate = (data: any) => {
        try {
          broadcast({ type: 'phase5:signal:update', timestamp: Date.now(), payload: data });
        } catch (e) { /* ignore */ }
      };
      phase5EventBridge.on('phase5:signal:update', onSignalUpdate);
      phase5Subs.push({ evt: 'phase5:signal:update', cb: onSignalUpdate });

      // Subscribe to Phase 5 agent update events
      const onAgentUpdate = (data: any) => {
        try {
          broadcast({ type: 'phase5:agent:update', timestamp: Date.now(), payload: data });
        } catch (e) { /* ignore */ }
      };
      phase5EventBridge.on('phase5:agent:update', onAgentUpdate);
      phase5Subs.push({ evt: 'phase5:agent:update', cb: onAgentUpdate });

      // Subscribe to Phase 5 regime update events
      const onRegimeUpdate = (data: any) => {
        try {
          broadcast({ type: 'phase5:regime:update', timestamp: Date.now(), payload: data });
        } catch (e) { /* ignore */ }
      };
      phase5EventBridge.on('phase5:regime:update', onRegimeUpdate);
      phase5Subs.push({ evt: 'phase5:regime:update', cb: onRegimeUpdate });

      console.log('[WS-Bridge] Phase 5 real-time events subscribed');

      wss.on('close', () => {
        phase5Subs.forEach(s => phase5EventBridge.off(s.evt, s.cb));
      });
    } catch (err) {
      console.warn('[WS-Bridge] Phase 5 event bridge not available:', err);
    }
  })();

  wss.on('connection', (ws: any, req: any) => {
    const id = Math.random().toString(36).slice(2,8);
    console.log(`[WS-Bridge] client connected ${id} from ${req.socket.remoteAddress}`);
    ws.send(JSON.stringify({ type: 'welcome', timestamp: Date.now(), msg: 'Connected to Scanstream events' }));

    ws.on('message', (data: any) => {
      // Accept simple control messages (e.g., subscribe/unsubscribe) in future
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : null;
        if (parsed && parsed.type === 'ping') ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      } catch (err) { /* ignore invalid */ }
    });

    ws.on('close', () => console.log(`[WS-Bridge] client disconnected ${id}`));
  });

  // Raw WebSocket server at /ws for market data subscriptions
  rawWss.on('connection', (ws: any, req: any) => {
    const id = Math.random().toString(36).slice(2, 8);
    console.log(`[WS-Raw] client connected ${id} from ${req.socket.remoteAddress}`);
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to market data stream' }));

    ws.on('message', (data: any) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : null;
        if (!msg) return;

        // Handle subscription messages
        if (msg.type === 'subscribe') {
          console.log(`[WS-Raw] ${id} subscribed to ${msg.symbol}`);
          // In future: track subscription and send ticks for this symbol
          ws.send(JSON.stringify({ type: 'subscribed', symbol: msg.symbol, message: `Subscribed to ${msg.symbol}` }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.debug('[WS-Raw] Error processing message:', err);
      }
    });

    ws.on('error', (err: any) => {
      console.error(`[WS-Raw] Error on client ${id}:`, err);
    });

    ws.on('close', () => {
      console.log(`[WS-Raw] client disconnected ${id}`);
    });
  });

  return wss;
}

export default initializeWebsocketBridge;
