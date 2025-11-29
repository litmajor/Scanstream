
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

interface SignalUpdate {
  type: 'signal_new' | 'signal_update' | 'signal_alert';
  data: any;
  timestamp: number;
}

export class SignalWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private signalHistory: SignalUpdate[] = [];
  private maxHistorySize = 100;

  initialize(server: any): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/signals'
    });

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

    console.log('[WebSocket] Signal streaming service initialized');
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

  broadcastSignal(signal: any, updateType: 'new' | 'update' | 'alert' = 'new'): void {
    const update: SignalUpdate = {
      type: `signal_${updateType}` as any,
      data: signal,
      timestamp: Date.now()
    };

    // Add to history
    this.signalHistory.push(update);
    if (this.signalHistory.length > this.maxHistorySize) {
      this.signalHistory.shift();
    }

    // Broadcast to all connected clients
    const message = JSON.stringify(update);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    this.emit('signal_broadcast', update);
  }

  broadcastAlert(alert: any): void {
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
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      historySize: this.signalHistory.length,
      recentSignals: this.signalHistory.slice(-5)
    };
  }
}

export const signalWebSocketService = new SignalWebSocketService();
