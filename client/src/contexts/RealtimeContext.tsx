import React, { createContext, useContext, useCallback, useState } from 'react';
import { WebSocketMessage, useWebSocket } from '@/hooks/useWebSocket';

interface RealtimeEvent {
  id: string;
  type: 'xp_gain' | 'level_up' | 'mood_change' | 'trade_result' | 'combo_activation' | 'achievement_unlocked';
  agentName: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  data: any;
  timestamp: Date;
  read: boolean;
}

interface RealtimeContextType {
  isConnected: boolean;
  events: RealtimeEvent[];
  markAsRead: (eventId: string) => void;
  clearEvent: (eventId: string) => void;
  clearAll: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    let event: RealtimeEvent | null = null;

    switch (message.type) {
      case 'xp_gain': {
        const { agentName, xp, newTotal } = message.data;
        event = {
          id: `xp_${Date.now()}`,
          type: 'xp_gain',
          agentName,
          title: `+${xp} XP`,
          description: `${agentName} earned ${xp} XP (Total: ${newTotal})`,
          icon: '⭐',
          color: 'bg-yellow-500',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      case 'level_up': {
        const { agentName, newLevel } = message.data;
        event = {
          id: `levelup_${Date.now()}`,
          type: 'level_up',
          agentName,
          title: `Level ${newLevel}!`,
          description: `${agentName} reached Level ${newLevel}!`,
          icon: '🎉',
          color: 'bg-green-500',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      case 'mood_change': {
        const { agentName, oldMood, newMood, reason } = message.data;
        const moodEmojis: Record<string, string> = {
          focused: '🎯',
          cautious: '⚠️',
          aggressive: '🔥',
          tilted: '😤',
        };
        event = {
          id: `mood_${Date.now()}`,
          type: 'mood_change',
          agentName,
          title: `Mood: ${oldMood} → ${newMood}`,
          description: `${agentName}'s mood shifted: ${reason}`,
          icon: moodEmojis[newMood] || '😊',
          color: 'bg-blue-500',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      case 'trade_result': {
        const { agentName, symbol, result, pnl, winRate } = message.data;
        const isWin = result === 'win';
        event = {
          id: `trade_${Date.now()}`,
          type: 'trade_result',
          agentName,
          title: `Trade ${isWin ? 'WIN' : 'LOSS'}: ${symbol}`,
          description: `${agentName} ${result} on ${symbol} (+${pnl} | Win Rate: ${winRate}%)`,
          icon: isWin ? '📈' : '📉',
          color: isWin ? 'bg-green-500' : 'bg-red-500',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      case 'combo_activation': {
        const { comboName, agents, multiplier, impact } = message.data;
        event = {
          id: `combo_${Date.now()}`,
          type: 'combo_activation',
          agentName: agents.join(' + '),
          title: `⚡ ${comboName}`,
          description: `${comboName} activated! ${agents.length} agents synergizing (${multiplier}x multiplier, ${impact}% impact)`,
          icon: '⚡',
          color: 'bg-purple-500',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      case 'achievement_unlocked': {
        const { agentName, achievementName, tier } = message.data;
        const tierColors: Record<string, string> = {
          bronze: 'bg-amber-600',
          silver: 'bg-slate-400',
          gold: 'bg-yellow-500',
          platinum: 'bg-blue-300',
        };
        event = {
          id: `achievement_${Date.now()}`,
          type: 'achievement_unlocked',
          agentName,
          title: `🏆 ${achievementName}`,
          description: `${agentName} unlocked: ${achievementName} (${tier} tier)`,
          icon: '🏆',
          color: tierColors[tier] || 'bg-amber-600',
          data: message.data,
          timestamp: new Date(message.timestamp),
          read: false,
        };
        break;
      }

      default:
        break;
    }

    if (event) {
      setEvents((prev) => [event!, ...prev.slice(0, 99)]); // Keep last 100 events
    }
  }, []);

  const { isConnected: wsConnected } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => setIsConnected(true),
    onDisconnect: () => setIsConnected(false),
  });

  const markAsRead = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, read: true } : e))
    );
  }, []);

  const clearEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  const clearAll = useCallback(() => {
    setEvents([]);
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected: wsConnected,
        events,
        markAsRead,
        clearEvent,
        clearAll,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
};
