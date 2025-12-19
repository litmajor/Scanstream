# WebSocket Real-Time Updates Implementation Guide

## Overview

The WebSocket system enables real-time agent activity streaming to all connected clients. This guide shows how to implement the server-side WebSocket endpoint.

## WebSocket Endpoint

**URL:** `ws://localhost:3000/api/ws/agents` (or `wss://` for HTTPS)

## Message Types

### 1. XP Gain
Sent when an agent earns XP from a trade

```json
{
  "type": "xp_gain",
  "timestamp": "2025-12-17T10:30:45.123Z",
  "data": {
    "agentName": "BreakoutHunter",
    "xp": 150,
    "newTotal": 2850,
    "reason": "Won trade on AAPL"
  }
}
```

### 2. Level Up
Sent when an agent reaches a new level

```json
{
  "type": "level_up",
  "timestamp": "2025-12-17T10:35:12.456Z",
  "data": {
    "agentName": "VFMD",
    "oldLevel": 25,
    "newLevel": 26,
    "xpRequired": 1000,
    "rewards": {
      "skillPoints": 5,
      "unlocks": ["Momentum Surge", "Reversal Detection"]
    }
  }
}
```

### 3. Mood Change
Sent when an agent's mood changes (focused, cautious, aggressive, tilted)

```json
{
  "type": "mood_change",
  "timestamp": "2025-12-17T10:40:22.789Z",
  "data": {
    "agentName": "TrendRider",
    "oldMood": "focused",
    "newMood": "aggressive",
    "reason": "Won 3 trades in a row",
    "moodModifiers": {
      "tradingIntensity": 1.2,
      "riskTolerance": 1.1,
      "decisionSpeed": 1.15
    }
  }
}
```

### 4. Trade Result
Sent when an agent completes a trade

```json
{
  "type": "trade_result",
  "timestamp": "2025-12-17T10:45:33.012Z",
  "data": {
    "agentName": "ML",
    "tradeId": "trade_12345",
    "symbol": "TSLA",
    "entryPrice": 245.50,
    "exitPrice": 248.75,
    "quantity": 100,
    "pnl": 325,
    "result": "win",
    "winRate": 0.68,
    "profitFactor": 1.85,
    "duration": 1245,
    "confidence": 0.92
  }
}
```

### 5. Combo Activation
Sent when a combo is triggered (2+ agents synergizing)

```json
{
  "type": "combo_activation",
  "timestamp": "2025-12-17T10:50:44.345Z",
  "data": {
    "comboId": "combo_98765",
    "comboName": "Perfect Storm",
    "agents": ["BreakoutHunter", "TrendRider", "GRADIENT_TREND"],
    "bonusMultiplier": 2.5,
    "impact": 95,
    "duration": 45,
    "estimatedPnLBoost": 450,
    "tradingRules": {
      "riskPerTrade": 0.05,
      "positionSize": 2.0,
      "entryConfidence": 0.95
    }
  }
}
```

### 6. Achievement Unlocked
Sent when an agent unlocks an achievement

```json
{
  "type": "achievement_unlocked",
  "timestamp": "2025-12-17T10:55:55.678Z",
  "data": {
    "agentName": "BreakoutHunter",
    "achievementId": "ach_67890",
    "achievementName": "Win Streak Master",
    "tier": "gold",
    "description": "Won 10 trades in a row",
    "rewards": {
      "xp": 500,
      "skillPoints": 10,
      "badge": "win-streak-master"
    },
    "stats": {
      "totalWins": 234,
      "winRate": 0.72,
      "bestStreak": 12
    }
  }
}
```

## Server Implementation (Node.js/Express)

### Basic WebSocket Setup with `ws` library

```typescript
import WebSocket from 'ws';
import { Server } from 'http';

export function setupWebSocket(server: Server) {
  const wss = new WebSocket.Server({ server, path: '/api/ws/agents' });

  const clients: Set<WebSocket> = new Set();

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected, total:', clients.size + 1);
    clients.add(ws);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('[WS] Received:', data.type);
        // Handle client messages if needed
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WS] Client disconnected, remaining:', clients.size);
    });

    ws.on('error', (error) => {
      console.error('[WS] Error:', error);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      timestamp: new Date().toISOString(),
      data: { connected: true, clientCount: clients.size }
    }));
  });

  return {
    broadcast: (message: WebSocketMessage) => {
      const payload = JSON.stringify(message);
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    },
    getClientCount: () => clients.size,
  };
}
```

### Usage Example: Broadcasting Events

```typescript
import { setupWebSocket } from './websocket';

const app = express();
const server = http.createServer(app);
const { broadcast } = setupWebSocket(server);

// When agent earns XP
app.post('/api/agents/:agentId/xp', (req, res) => {
  const { agentId } = req.params;
  const { xp } = req.body;

  // Update agent XP in database...
  const agent = await Agent.findById(agentId);
  agent.xp += xp;
  await agent.save();

  // Broadcast to all connected clients
  broadcast({
    type: 'xp_gain',
    timestamp: new Date().toISOString(),
    data: {
      agentName: agent.name,
      xp,
      newTotal: agent.xp,
      reason: req.body.reason || 'Trade completed'
    }
  });

  res.json({ success: true });
});

// When agent levels up
app.post('/api/agents/:agentId/level-up', (req, res) => {
  const { agentId } = req.params;
  const agent = await Agent.findById(agentId);

  if (agent.xp >= agent.xp_to_next_level) {
    agent.level += 1;
    agent.xp -= agent.xp_to_next_level;
    agent.xp_to_next_level = Math.floor(agent.xp_to_next_level * 1.1);
    await agent.save();

    broadcast({
      type: 'level_up',
      timestamp: new Date().toISOString(),
      data: {
        agentName: agent.name,
        oldLevel: agent.level - 1,
        newLevel: agent.level,
        xpRequired: agent.xp_to_next_level,
        rewards: {
          skillPoints: 5,
          unlocks: agent.getNewUnlocks()
        }
      }
    });
  }

  res.json({ success: true, agent });
});

// When combo activates
app.post('/api/agents/combos/activate', (req, res) => {
  const { comboName, agents, multiplier, impact } = req.body;

  broadcast({
    type: 'combo_activation',
    timestamp: new Date().toISOString(),
    data: {
      comboName,
      agents,
      bonusMultiplier: multiplier,
      impact,
      duration: req.body.duration || 30,
      estimatedPnLBoost: req.body.pnlBoost || 0
    }
  });

  res.json({ success: true });
});

server.listen(3000, () => {
  console.log('Server with WebSocket running on port 3000');
});
```

## Client Integration (Already Implemented)

The client automatically:

1. **Connects via `useWebSocket` hook:**
   ```typescript
   const { isConnected, lastMessage, send } = useWebSocket({
     url: 'ws://localhost:3000/api/ws/agents',
     onMessage: (message) => { /* handle event */ },
     onConnect: () => console.log('Connected'),
     reconnectAttempts: 5,
   });
   ```

2. **Broadcasts to `RealtimeProvider`:**
   - Converts raw messages to typed `RealtimeEvent` objects
   - Manages event history (last 100 events)
   - Provides `useRealtime()` hook for consuming events

3. **Displays in components:**
   - `RealtimeEventFeed` - Fixed position notification stack
   - `RealtimeUpdatesPage` - Full event history with filtering
   - Individual components can subscribe via `useRealtime()`

## Event Flow

```
Server Event (Trade completed)
    ↓
broadcast({ type: 'trade_result', data: {...} })
    ↓
WebSocket message sent to all clients
    ↓
useWebSocket receives message
    ↓
RealtimeProvider converts to RealtimeEvent
    ↓
Events pushed to state array
    ↓
RealtimeEventFeed displays notification
    ↓
RealtimeUpdatesPage shows in history
    ↓
useRealtime() makes data available everywhere
```

## Reconnection Logic

- **Automatic reconnection** if connection drops
- **5 attempts** with 3-second delay between each
- **Status indicator** shows "Live" (green pulse) or "Offline" (red)
- **Event history preserved** across reconnections

## Performance Considerations

1. **Event limit**: Last 100 events stored in memory
2. **Polling alternative**: If WebSocket unavailable, can poll `/api/agents/activities`
3. **Connection pooling**: Multiple clients share single event stream
4. **Type safety**: All messages have strict TypeScript interfaces

## Testing WebSocket Locally

```bash
# Start server with WebSocket enabled
npm start

# In browser console:
const ws = new WebSocket('ws://localhost:3000/api/ws/agents');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Next Steps

1. Implement server endpoint to broadcast events
2. Connect trading engine to event broadcasting
3. Test with real agent activity
4. Monitor WebSocket connection health
5. Add metrics dashboard for event volume/types
