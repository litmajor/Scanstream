import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  message?: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  send: (data: any) => void;
  reconnect: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = () => {
    try {
      console.log('[WebSocket] Connecting to', url);
      const ws = new WebSocket(url.replace(/^http/, 'ws'));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        setIsConnected(true);
        console.log('[WebSocket] Connected');
      };

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data.toString());
          setLastMessage(parsed as WebSocketMessage);
        } catch (err) {
          console.warn('[WebSocket] Failed to parse message', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.warn('[WebSocket] Connection closed, scheduling reconnect');
        // Attempt reconnect with backoff
        reconnectAttempts.current++;
        const timeout = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts.current));
        reconnectTimeoutRef.current = setTimeout(() => connect(), timeout) as any;
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Error', err);
        ws.close();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  };

  const send = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  };

  const reconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttempts.current = 0;
    connect();
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { isConnected, lastMessage, send, reconnect };
}