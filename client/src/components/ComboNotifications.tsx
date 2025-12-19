import React, { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Zap, X, Clock, Users, TrendingUp } from 'lucide-react';

export interface ComboNotification {
  id: string;
  timestamp: string;
  comboName: string;
  agents: string[];
  bonusMultiplier: number;
  description: string;
  impact: number; // -100 to 100
  duration: number; // seconds
}

interface ComboNotificationsContextType {
  notifications: ComboNotification[];
  addNotification: (combo: ComboNotification) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// Predefined combo database
export const COMBO_DATABASE = [
  {
    name: 'Divergence Surge',
    agents: ['VFMD', 'Flow'],
    bonusMultiplier: 1.5,
    description: 'VFMD + Flow physics create powerful entry signals'
  },
  {
    name: 'Triple Threat',
    agents: ['BreakoutHunter', 'VFMD', 'FLOW'],
    bonusMultiplier: 2.0,
    description: 'Three agents in perfect harmony'
  },
  {
    name: 'Smart Exit',
    agents: ['EXIT', 'OPPOSITION', 'Volume Profile'],
    bonusMultiplier: 1.8,
    description: 'Orchestrated exit with support resistance'
  },
  {
    name: 'ML Consensus',
    agents: ['ML', 'RL', 'Scanner'],
    bonusMultiplier: 1.7,
    description: 'Machine learning agents voting together'
  },
  {
    name: 'Perfect Storm',
    agents: ['BreakoutHunter', 'TrendRider', 'GRADIENT_TREND'],
    bonusMultiplier: 2.5,
    description: 'Breakout + trend + gradient = unstoppable'
  },
  {
    name: 'Reversal Master',
    agents: ['ReversalMaster', 'MeanReversion', 'OPPOSITION'],
    bonusMultiplier: 1.9,
    description: 'Reversal detection at critical levels'
  },
  {
    name: 'Risk Fortress',
    agents: ['RiskManager', 'MICROSTRUCTURE', 'UT_BOT'],
    bonusMultiplier: 1.6,
    description: 'Defensive combo for risk management'
  }
];

// Toast Component
const ComboToast: React.FC<{ combo: ComboNotification; onClose: () => void }> = ({ combo, onClose }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const impactColor = combo.impact > 50 ? 'bg-green-600' : combo.impact > 0 ? 'bg-blue-600' : 'bg-yellow-600';
  const impactLabel = combo.impact > 50 ? 'Excellent' : combo.impact > 0 ? 'Good' : 'Neutral';

  return (
    <div
      className={`bg-gradient-to-r from-purple-900/90 to-blue-900/90 border border-purple-500/50 rounded-lg p-4 shadow-2xl transition-all duration-300 ${
        fadeOut ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl">⚡</div>
          <h3 className="text-lg font-bold text-white">{combo.comboName}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700/50 rounded transition"
        >
          <X size={18} className="text-slate-300" />
        </button>
      </div>

      <p className="text-slate-300 text-sm mb-3">{combo.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">Bonus Multiplier</div>
          <div className="text-lg font-bold text-yellow-400">{combo.bonusMultiplier}x</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">Agents</div>
          <div className="text-lg font-bold text-blue-400">{combo.agents.length}</div>
        </div>
        <div className={`${impactColor} bg-opacity-20 rounded p-2 border border-opacity-30`}>
          <div className="text-xs text-slate-200 mb-1">Impact</div>
          <div className="text-lg font-bold" style={{ color: impactColor.replace('bg-', '').replace('-600', '-400') }}>
            {impactLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Users size={14} />
        <span>{combo.agents.join(' + ')}</span>
      </div>
    </div>
  );
};

// Combo Activity Feed Component
interface ComboActivityFeedProps {
  combos: ComboNotification[];
  onClear: () => void;
}

export const ComboActivityFeed: React.FC<ComboActivityFeedProps> = ({ combos, onClear }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-amber-400" />
          <h2 className="text-xl font-bold text-white">Combo Activity Feed</h2>
        </div>
        {combos.length > 0 && (
          <button
            onClick={onClear}
            className="px-3 py-1 text-sm font-semibold bg-slate-700 hover:bg-slate-600 rounded transition text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {combos.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {combos.map((combo, idx) => (
            <div key={idx} className="bg-slate-700/30 rounded-lg p-3 border-l-4 border-purple-500">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-white">{combo.comboName}</h3>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(combo.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-2">{combo.description}</p>

              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div>
                  <span className="text-slate-400">Multiplier:</span>
                  <span className="text-yellow-400 font-bold ml-1">{combo.bonusMultiplier}x</span>
                </div>
                <div>
                  <span className="text-slate-400">Agents:</span>
                  <span className="text-blue-400 font-bold ml-1">{combo.agents.length}</span>
                </div>
                <div>
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-green-400 font-bold ml-1">{combo.duration}s</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {combo.agents.map((agent, i) => (
                  <span key={i} className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded">
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Zap size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No combos triggered yet</p>
          <p className="text-xs mt-1">Combos appear here when agents work together</p>
        </div>
      )}
    </div>
  );
};

// Combo Notification Container
interface ComboNotificationContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ComboNotificationContainer: React.FC<ComboNotificationContainerProps> = ({ 
  position = 'top-right' 
}) => {
  const [toasts, setToasts] = useState<ComboNotification[]>([]);

  // Fetch active combos
  const { data: combosData } = useQuery({
    queryKey: ['active-combos'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/agents/combos');
        if (!response.ok) return [];
        const result = await response.json();
        return result.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 10000,
  });

  // Add new combo notification
  const addComboNotification = useCallback((combo: ComboNotification) => {
    setToasts(prev => [...prev, combo]);
  }, []);

  // Remove toast
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Demo: Periodically generate random combos (remove in production)
  useEffect(() => {
    const demoTimer = setTimeout(() => {
      if (combosData && combosData.length === 0 && Math.random() > 0.7) {
        const randomCombo = COMBO_DATABASE[Math.floor(Math.random() * COMBO_DATABASE.length)];
        addComboNotification({
          id: `combo-${Date.now()}`,
          timestamp: new Date().toISOString(),
          comboName: randomCombo.name,
          agents: randomCombo.agents,
          bonusMultiplier: randomCombo.bonusMultiplier,
          description: randomCombo.description,
          impact: Math.floor(Math.random() * 100),
          duration: randomCombo.bonusMultiplier > 2 ? 30 : 20,
        });
      }
    }, 8000);

    return () => clearTimeout(demoTimer);
  }, [combosData, addComboNotification]);

  const positionClasses = {
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-40 space-y-3 pointer-events-none`}>
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ComboToast 
            combo={toast} 
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default ComboNotificationContainer;
