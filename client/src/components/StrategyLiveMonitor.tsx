import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, Pause, Play, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface LiveSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  timestamp: string;
  confidence: number;
  price: number;
}

interface ActiveTrade {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  quantity: number;
  entryTime: string;
}

interface StrategyHealth {
  strategyId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'error';
  lastSignal: string;
  signals24h: number;
  winRate: number;
  responseTime: number;
}

interface LiveMetrics {
  strategyId: string;
  name: string;
  totalPnl: number;
  totalPnlPercent: number;
  tradesOpen: number;
  winRate: number;
  sharpeRatio: number;
}

interface StrategyLiveMonitorProps {
  strategies: Array<{ id: string; name: string }>;
  onClose: () => void;
}

export default function StrategyLiveMonitor({
  strategies,
  onClose,
}: StrategyLiveMonitorProps) {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [strategyHealth, setStrategyHealth] = useState<StrategyHealth[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics[]>([]);
  const [pausedStrategies, setPausedStrategies] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'signals' | 'trades' | 'health' | 'metrics'>('signals');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Simulate WebSocket connection for live updates
    const connectWebSocket = () => {
      // In production, replace with actual WebSocket URL
      // const ws = new WebSocket('ws://localhost:3001/api/live-strategies');
      
      // For now, simulate data with intervals
      const interval = setInterval(() => {
        // Simulate new signals
        if (Math.random() > 0.7) {
          const newSignal: LiveSignal = {
            id: `signal-${Date.now()}`,
            strategyId: strategies[Math.floor(Math.random() * strategies.length)]?.id || '1',
            strategyName: strategies[Math.floor(Math.random() * strategies.length)]?.name || 'Strategy',
            symbol: 'BTC/USDT',
            action: Math.random() > 0.5 ? 'BUY' : 'SELL',
            timestamp: new Date().toISOString(),
            confidence: Math.floor(Math.random() * 40) + 60,
            price: 45000 + Math.random() * 5000,
          };
          setSignals((prev) => [newSignal, ...prev.slice(0, 49)]);
          
          // Show browser notification
          if (notificationsEnabled && Notification.permission === 'granted') {
            new Notification(`${newSignal.action} Signal`, {
              body: `${newSignal.strategyName} - ${newSignal.symbol} @ $${newSignal.price.toFixed(2)}`,
              icon: '/favicon.svg',
            });
          }
        }

        // Simulate active trades updates
        setActiveTrades((prev) =>
          prev.map((trade) => ({
            ...trade,
            currentPrice: trade.currentPrice + (Math.random() - 0.5) * 100,
            pnl: (trade.currentPrice - trade.entryPrice) * trade.quantity * (trade.side === 'LONG' ? 1 : -1),
            pnlPercent: ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100 * (trade.side === 'LONG' ? 1 : -1),
          }))
        );

        // Simulate health updates
        setStrategyHealth((prev) =>
          prev.map((health) => ({
            ...health,
            winRate: Math.max(0, Math.min(100, health.winRate + (Math.random() - 0.5) * 2)),
            responseTime: Math.max(0, health.responseTime + (Math.random() - 0.5) * 5),
            lastSignal: new Date().toISOString(),
          }))
        );

        // Simulate metrics updates
        setLiveMetrics((prev) =>
          prev.map((metric) => ({
            ...metric,
            totalPnl: metric.totalPnl + (Math.random() - 0.5) * 50,
            sharpeRatio: Math.max(0, metric.sharpeRatio + (Math.random() - 0.5) * 0.1),
          }))
        );
      }, 2000);

      return () => clearInterval(interval);
    };

    // Initialize mock data
    setStrategyHealth(
      strategies.map((s, i) => ({
        strategyId: s.id,
        name: s.name,
        status: i === 0 ? 'degraded' : 'healthy',
        lastSignal: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        signals24h: Math.floor(Math.random() * 50) + 10,
        winRate: Math.random() * 30 + 50,
        responseTime: Math.random() * 50 + 10,
      }))
    );

    setLiveMetrics(
      strategies.map((s) => ({
        strategyId: s.id,
        name: s.name,
        totalPnl: (Math.random() - 0.5) * 5000,
        totalPnlPercent: (Math.random() - 0.5) * 20,
        tradesOpen: Math.floor(Math.random() * 5) + 1,
        winRate: Math.random() * 20 + 50,
        sharpeRatio: Math.random() * 2 + 0.5,
      }))
    );

    setActiveTrades([
      {
        id: '1',
        strategyId: strategies[0]?.id || '1',
        strategyName: strategies[0]?.name || 'Strategy',
        symbol: 'BTC/USDT',
        side: 'LONG',
        entryPrice: 45000,
        currentPrice: 45200,
        pnl: 200,
        pnlPercent: 0.44,
        quantity: 0.1,
        entryTime: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        strategyId: strategies[1]?.id || '2',
        strategyName: strategies[1]?.name || 'Strategy',
        symbol: 'ETH/USDT',
        side: 'SHORT',
        entryPrice: 3000,
        currentPrice: 2980,
        pnl: 20,
        pnlPercent: 0.67,
        quantity: 1,
        entryTime: new Date(Date.now() - 7200000).toISOString(),
      },
    ]);

    const cleanup = connectWebSocket();

    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [strategies, notificationsEnabled]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const toggleStrategy = (strategyId: string) => {
    setPausedStrategies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(strategyId)) {
        newSet.delete(strategyId);
      } else {
        newSet.add(strategyId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'degraded':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Bell className="w-6 h-6 text-green-400" />
              <span>Live Strategy Monitor</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">Real-time strategy performance & signals</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`p-2 rounded-lg transition-all ${
                notificationsEnabled
                  ? 'bg-green-500/20 hover:bg-green-500/30'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? (
                <Bell className="w-5 h-5 text-green-400" />
              ) : (
                <BellOff className="w-5 h-5 text-slate-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Close monitor"
            >
              <span className="text-slate-400">✕</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="sticky top-0 bg-slate-800/95 border-b border-slate-700 px-6 pt-4">
            <div className="flex space-x-2">
              {[
                { id: 'signals', label: 'Signals Feed' },
                { id: 'trades', label: 'Active Trades' },
                { id: 'health', label: 'Strategy Health' },
                { id: 'metrics', label: 'Live Metrics' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-700 text-white border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Signals Feed */}
            {activeTab === 'signals' && (
              <div className="space-y-3">
                {signals.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">No signals yet...</div>
                ) : (
                  signals.map((signal) => (
                    <div
                      key={signal.id}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              signal.action === 'BUY'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {signal.action}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{signal.symbol}</h4>
                            <p className="text-sm text-slate-400">{signal.strategyName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">${signal.price.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">{signal.confidence}% confidence</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Active Trades */}
            {activeTab === 'trades' && (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Strategy</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Symbol</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Side</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">Entry</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">Current</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">P&L</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                        <td className="py-3 px-4 text-white font-medium">{trade.strategyName}</td>
                        <td className="py-3 px-4 text-slate-300">{trade.symbol}</td>
                        <td>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              trade.side === 'LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">${trade.entryPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-white font-medium">${trade.currentPrice.toFixed(2)}</td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          ${trade.pnl.toFixed(2)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Strategy Health */}
            {activeTab === 'health' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategyHealth.map((health) => {
                  const isPaused = pausedStrategies.has(health.strategyId);
                  return (
                    <div
                      key={health.strategyId}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white">{health.name}</h3>
                          <div
                            className={`inline-flex items-center space-x-1 px-2 py-1 rounded mt-1 text-xs ${getStatusColor(
                              health.status
                            )}`}
                          >
                            {getStatusIcon(health.status)}
                            <span className="capitalize">{health.status}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleStrategy(health.strategyId)}
                          className={`p-2 rounded-lg transition-all ${
                            isPaused
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                          }`}
                          title={isPaused ? 'Resume strategy' : 'Pause strategy'}
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-white">{health.winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Signals (24h)</p>
                          <p className="text-lg font-bold text-white">{health.signals24h}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Response Time</p>
                          <p className="text-lg font-bold text-white">{health.responseTime.toFixed(0)}ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Last Signal</p>
                          <p className="text-lg font-bold text-white">
                            {Math.floor((Date.now() - new Date(health.lastSignal).getTime()) / 60000)}m ago
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Live Metrics */}
            {activeTab === 'metrics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveMetrics.map((metric) => (
                  <div key={metric.strategyId} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <h3 className="font-semibold text-white mb-4">{metric.name}</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total P&L</p>
                        <p
                          className={`text-xl font-bold ${
                            metric.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          ${metric.totalPnl >= 0 ? '+' : ''}{metric.totalPnl.toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">P&L %</p>
                          <p
                            className={`font-semibold ${
                              metric.totalPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {metric.totalPnlPercent >= 0 ? '+' : ''}{metric.totalPnlPercent.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Trades</p>
                          <p className="font-semibold text-white">{metric.tradesOpen}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                          <p className="font-semibold text-white">{metric.winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Sharpe</p>
                          <p className="font-semibold text-white">{metric.sharpeRatio.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
