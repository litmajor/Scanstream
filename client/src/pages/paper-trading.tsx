
import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, TrendingUp, TrendingDown, DollarSign, Settings, Download } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PaperTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  entryTime: string;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  pnl?: number;
  pnlPercent?: number;
  source: 'ML' | 'RL' | 'GATEWAY' | 'MANUAL';
}

interface PaperTradingStatus {
  isRunning: boolean;
  balance: number;
  openPositions: number;
  totalTrades: number;
  metrics: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    profitFactor: number;
  };
  activeTrades: PaperTrade[];
  recentTrades: PaperTrade[];
  config: {
    enabled: boolean;
    sources: string[];
    minConfidence: number;
    maxPositionsPerSymbol: number;
    positionSizing: {
      type: string;
      value: number;
    };
    riskManagement: {
      useStopLoss: boolean;
      useTakeProfit: boolean;
      trailingStop: boolean;
      trailingStopPercent: number;
    };
  };
}

export default function PaperTradingPage() {
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const queryClient = useQueryClient();

  // Fetch paper trading status
  const { data: status, isLoading } = useQuery<PaperTradingStatus>({
    queryKey: ['paperTradingStatus'],
    queryFn: async () => {
      const res = await fetch('/api/paper-trading/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Start/Stop mutations
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/paper-trading/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paperTradingStatus'] })
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/paper-trading/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paperTradingStatus'] })
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/paper-trading/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalance: 10000 })
      });
      if (!res.ok) throw new Error('Failed to reset');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paperTradingStatus'] })
  });

  const handleToggle = () => {
    if (status?.isRunning) {
      stopMutation.mutate();
    } else {
      startMutation.mutate();
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your paper trading account? This will close all positions and reset your balance.')) {
      resetMutation.mutate();
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/paper-trading/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paper-trading-${new Date().toISOString()}.json`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading || !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setLocation('/')} className="flex items-center text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Dashboard
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Paper Trading {status.isRunning && '(AUTO)'}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={handleToggle}
                disabled={startMutation.isPending || stopMutation.isPending}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${status.isRunning ? 'bg-red-600' : 'bg-green-600'}`}
              >
                {status.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {status.isRunning ? 'Stop Auto' : 'Start Auto'}
              </button>
              <button 
                onClick={handleExport}
                className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Balance</div>
            <div className="text-2xl font-bold text-white">${status.balance.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Total Return</div>
            <div className={`text-2xl font-bold ${status.metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {status.metrics.totalReturn >= 0 ? '+' : ''}{(status.metrics.totalReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Win Rate</div>
            <div className="text-2xl font-bold text-white">{(status.metrics.winRate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Sharpe Ratio</div>
            <div className="text-2xl font-bold text-white">{status.metrics.sharpeRatio.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">Max Drawdown</div>
            <div className="text-2xl font-bold text-red-400">{(status.metrics.maxDrawdown * 100).toFixed(2)}%</div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Auto-Execution Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-400 mb-2">Active Sources</div>
                <div className="flex gap-2">
                  {status.config.sources.map(source => (
                    <span key={source} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-sm">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Min Confidence</div>
                <div className="text-white">{(status.config.minConfidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Position Sizing</div>
                <div className="text-white">{status.config.positionSizing.type}: {status.config.positionSizing.value}%</div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Risk Management</div>
                <div className="flex gap-2">
                  {status.config.riskManagement.useStopLoss && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Stop Loss</span>
                  )}
                  {status.config.riskManagement.useTakeProfit && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Take Profit</span>
                  )}
                  {status.config.riskManagement.trailingStop && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Trailing</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Open Positions */}
        <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Open Positions ({status.activeTrades.length})
          </h2>
          {status.activeTrades.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No open positions</div>
          ) : (
            <div className="space-y-3">
              {status.activeTrades.map((trade) => (
                <div key={trade.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white">{trade.symbol}</div>
                        <span className={`px-2 py-1 rounded text-xs ${trade.side === 'BUY' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                        <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                          {trade.source}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Entry: ${trade.entryPrice.toFixed(2)} | Size: {trade.quantity.toFixed(4)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        SL: ${trade.stopLoss.toFixed(2)} | TP: ${trade.takeProfit.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">
                        {new Date(trade.entryTime).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Trades</h2>
          {status.recentTrades.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No trades yet</div>
          ) : (
            <div className="space-y-3">
              {status.recentTrades.map((trade) => (
                <div key={trade.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white">{trade.symbol}</div>
                        <span className={`px-2 py-1 rounded text-xs ${trade.side === 'BUY' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                        <span className="px-2 py-1 bg-slate-600/20 text-slate-400 rounded text-xs">
                          {trade.exitReason}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice?.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                      </div>
                      <div className={`text-sm ${(trade.pnlPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(trade.pnlPercent || 0) >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
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
  );
}
