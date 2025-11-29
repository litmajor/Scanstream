
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface GatewayHealth {
  success: boolean;
  health: {
    uptime: number;
    totalRequests: number;
    cacheHitRate: number;
    activeExchanges: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  exchanges: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    successRate: number;
  }>;
}

export default function GatewayHealthPanel() {
  const { data: health, isLoading } = useQuery<GatewayHealth>({
    queryKey: ['/api/gateway/health'],
    queryFn: () => fetch('/api/gateway/health').then(res => res.json()),
    refetchInterval: 5000,
  });

  if (isLoading || !health?.success) {
    return (
      <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center space-x-2 text-slate-400">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading Gateway Status...</span>
        </div>
      </div>
    );
  }

  const { health: stats, exchanges } = health;

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-white flex items-center">
          <Zap className="w-4 h-4 mr-2 text-yellow-400" />
          Gateway Agent Status
        </h4>
        <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
          ⚡ {stats.activeExchanges} Active
        </span>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
          <div className="text-xs text-slate-400">Cache Hit Rate</div>
          <div className="text-lg font-mono font-bold text-green-400">
            {(stats.cacheHitRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/30">
          <div className="text-xs text-slate-400">Latency (p95)</div>
          <div className="text-lg font-mono font-bold text-blue-400">
            {stats.latency.p95}ms
          </div>
        </div>
      </div>

      {/* Exchange Status */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">Exchange Health</div>
        {exchanges.map((exchange, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-slate-900/40 rounded p-2 border border-slate-700/30"
          >
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  exchange.status === 'healthy'
                    ? 'bg-green-400'
                    : exchange.status === 'degraded'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-xs text-white capitalize">{exchange.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">{exchange.latency}ms</span>
              <span className="text-xs text-green-400">
                {(exchange.successRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total Requests */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Total Requests</span>
          <span className="text-white font-mono">{stats.totalRequests.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
