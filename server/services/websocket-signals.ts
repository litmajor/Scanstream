import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';

interface SignalUpdate {
  type: 'signal_new' | 'signal_update' | 'signal_alert';
  data: any;
  timestamp: number;
}

interface SignalData {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  price: number;
  change24h?: number;
  volume?: number;
  timestamp: number;
  exchange?: string;
}

interface AlertData {
  title: string;
  message: string;
  signal?: SignalData;
  priority: 'high' | 'medium' | 'low';
}

interface GatewayHealthData {
  status: 'healthy' | 'degraded' | 'down';
  exchanges: Record<string, any>;
  cache: {
    hitRate: number;
    entries: number;
  };
  timestamp: Date;
}

export class SignalWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private signalHistory: SignalUpdate[] = [];
  private maxHistorySize = 100;

  private io: SocketIOServer | null = null;
  private connectedClients = 0;
  private healthBroadcastInterval: NodeJS.Timeout | null = null;

  initialize(server: Server | any): void {
    // Check if it's a WebSocketServer or an http server for Socket.IO
    if (server instanceof WebSocketServer) {
      this.wss = server;
      this.wss.on('connection', (ws: WebSocket) => {
        console.log('[WebSocket] New signal stream client connected');
        this.clients.add(ws);

        // Send recent signal history to new client
        ws.send(JSON.stringify({
          type: 'history',
          data: this.signalHistory.slice(-20),
          timestamp: Date.now()
        }));

        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleClientMessage(ws, data);
          } catch (error) {
            console.error('[WebSocket] Invalid message:', error);
          }
        });

        ws.on('close', () => {
          console.log('[WebSocket] Signal stream client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('[WebSocket] Client error:', error);
          this.clients.delete(ws);
        });
      });
      console.log('[WebSocket] Signal streaming service initialized (ws)');
    } else if (server && typeof server.listen === 'function') {
      // Assume it's an http server for Socket.IO
      this.io = new SocketIOServer(server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });

      this.io.on('connection', (socket) => {
        this.connectedClients++;
        console.log(`[WS] Client connected. Total clients: ${this.connectedClients}`);

        // Send initial gateway health on connection
        socket.emit('gateway_health', { status: 'connecting' });

        socket.on('disconnect', () => {
          this.connectedClients--;
          console.log(`[WS] Client disconnected. Total clients: ${this.connectedClients}`);
        });

        // Handle subscription to specific symbols
        socket.on('subscribe_symbol', (symbol: string) => {
          socket.join(`symbol:${symbol}`);
          console.log(`[WS] Client subscribed to ${symbol}`);
        });

        socket.on('unsubscribe_symbol', (symbol: string) => {
          socket.leave(`symbol:${symbol}`);
          console.log(`[WS] Client unsubscribed from ${symbol}`);
        });
      });

      // Start broadcasting gateway health every 10 seconds
      this.startHealthBroadcast();

      console.log('[WS] Signal WebSocket service initialized with Gateway integration (Socket.IO)');
    } else {
      console.error('[WebSocket] Invalid server object provided for initialization.');
    }
  }

  private handleClientMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Client can subscribe to specific symbols
        ws.send(JSON.stringify({
          type: 'subscribed',
          symbols: data.symbols || [],
          timestamp: Date.now()
        }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  private startHealthBroadcast() {
    if (this.healthBroadcastInterval) {
      clearInterval(this.healthBroadcastInterval);
    }

    this.healthBroadcastInterval = setInterval(async () => {
      if (this.connectedClients > 0 && this.io) {
        try {
          // Import here to avoid circular dependency issues if gateway routes depend on this service
          const gatewayModule = await import('../routes/gateway');
          const aggregator = gatewayModule.aggregator;
          const cacheManager = gatewayModule.cacheManager;

          if (!aggregator || !cacheManager) {
            console.error('[WS] Gateway aggregator or cacheManager not available for health check.');
            return;
          }

          const healthStatus = aggregator.getHealthStatus();
          const cacheStats = cacheManager.getStats();

          const healthData: GatewayHealthData = {
            status: Object.values(healthStatus).filter(e => e.healthy).length >= 3 ? 'healthy' : 'degraded',
            exchanges: healthStatus,
            cache: {
              hitRate: cacheStats.hitRate,
              entries: cacheStats.entries
            },
            timestamp: new Date()
          };

          this.broadcastGatewayHealth(healthData);
        } catch (error) {
          console.error('[WS] Error broadcasting health:', error);
        }
      }
    }, 10000); // Every 10 seconds
  }


  broadcastSignal(signal: SignalData, type: 'new' | 'update' | 'close') {
    if (!this.io) {
      // Fallback for ws if Socket.IO is not initialized
      const update: SignalUpdate = {
        type: `signal_${type}` as any,
        data: signal,
        timestamp: Date.now()
      };
      const message = JSON.stringify(update);
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      this.emit('signal_broadcast', update);
      return;
    }

    // Broadcast to all clients via Socket.IO
    this.io.emit('signal', {
      type,
      data: signal,
      timestamp: new Date()
    });

    // Also broadcast to symbol-specific room
    this.io.to(`symbol:${signal.symbol}`).emit('symbol_signal', {
      type,
      data: signal,
      timestamp: new Date()
    });

    console.log(`[WS] Broadcasted ${type} signal for ${signal.symbol}: ${signal.signal} (${signal.strength}%)`);
  }

  broadcastAlert(alert: AlertData) {
    if (!this.io) {
      // Fallback for ws if Socket.IO is not initialized
      const message = JSON.stringify({
        type: 'signal_alert',
        data: alert,
        timestamp: Date.now()
      });
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      return;
    }

    this.io.emit('alert', {
      ...alert,
      timestamp: new Date()
    });

    console.log(`[WS] Broadcasted ${alert.priority} priority alert: ${alert.title}`);
  }

  broadcastGatewayHealth(health: GatewayHealthData) {
    if (!this.io) return;

    this.io.emit('gateway_health', health);
  }

  broadcastPriceUpdate(symbol: string, priceData: any) {
    if (!this.io) return;

    this.io.to(`symbol:${symbol}`).emit('price_update', {
      symbol,
      ...priceData,
      timestamp: new Date()
    });
  }

  broadcastLiquidityUpdate(symbol: string, liquidityData: any) {
    if (!this.io) return;

    this.io.to(`symbol:${symbol}`).emit('liquidity_update', {
      symbol,
      ...liquidityData,
      timestamp: new Date()
    });
  }

  broadcastNotification(notification: {
    category: 'signal' | 'trade' | 'system' | 'alert';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    title: string;
    message: string;
    metadata?: Record<string, any>;
    actionLabel?: string;
    actionUrl?: string;
  }) {
    if (!this.io) return;

    this.io.emit('notification', {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      status: 'unread',
      timestamp: new Date()
    });

    console.log(`[WS] Broadcasted ${notification.priority} notification: ${notification.title}`);
  }

  shutdown() {
    if (this.healthBroadcastInterval) {
      clearInterval(this.healthBroadcastInterval);
      this.healthBroadcastInterval = null;
    }
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  getStats() {
    if (this.io) {
      return {
        connectedClients: this.connectedClients,
        initialized: this.io !== null,
        healthBroadcast: this.healthBroadcastInterval !== null
      };
    } else if (this.wss) {
      return {
        connectedClients: this.clients.size,
        initialized: this.wss !== null,
      };
    }
    return {
      connectedClients: 0,
      initialized: false,
      healthBroadcast: false
    };
  }
}

export const signalWebSocketService = new SignalWebSocketService();