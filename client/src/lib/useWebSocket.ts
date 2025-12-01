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
      // Disable WebSocket for now in Replit environment - use polling instead
      // WebSocket will be re-enabled after proper endpoint configuration
      console.log('[WebSocket] WebSocket temporarily disabled - using polling mode');
      setIsConnected(false);
      return;
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