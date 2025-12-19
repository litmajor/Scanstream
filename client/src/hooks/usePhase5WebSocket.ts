import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface Phase5EventData {
  type: 'phase5:signal:update' | 'phase5:agent:update' | 'phase5:regime:update' | 'phase5:signal:new';
  timestamp: number;
  payload: any;
}

export function usePhase5WebSocket(enabled = true) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/events`;
      
      console.log('[Phase5WS] Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Phase5WS] Connected to WebSocket');
        wsRef.current = ws;
        
        // Send subscription message for Phase 5 events
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: [
            'phase5:signal:update',
            'phase5:agent:update',
            'phase5:regime:update',
            'phase5:signal:new'
          ]
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data: Phase5EventData = JSON.parse(event.data);
          
          // Handle Phase 5 events
          if (data.type === 'phase5:signal:update') {
            console.log('[Phase5WS] Signal update received:', data.payload);
            queryClient.invalidateQueries({ queryKey: ['phase5', 'signal-transparency'] });
          } else if (data.type === 'phase5:signal:new') {
            console.log('[Phase5WS] New signal received:', data.payload);
            queryClient.invalidateQueries({ queryKey: ['phase5', 'signal-history'] });
            queryClient.invalidateQueries({ queryKey: ['phase5', 'signal-transparency'] });
          } else if (data.type === 'phase5:agent:update') {
            console.log('[Phase5WS] Agent update received:', data.payload);
            queryClient.invalidateQueries({ queryKey: ['phase5', 'agent-leaderboard'] });
          } else if (data.type === 'phase5:regime:update') {
            console.log('[Phase5WS] Regime update received:', data.payload);
            queryClient.invalidateQueries({ queryKey: ['phase5', 'regime'] });
          }
        } catch (error) {
          console.error('[Phase5WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error: Event) => {
        console.error('[Phase5WS] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[Phase5WS] Disconnected from WebSocket, reconnecting in 3s...');
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (error) {
      console.error('[Phase5WS] Failed to connect:', error);
    }
  }, [enabled, queryClient]);

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
  }, [connect]);

  return wsRef.current;
}

export default usePhase5WebSocket;
