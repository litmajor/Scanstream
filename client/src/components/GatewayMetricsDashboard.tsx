
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, TrendingUp, Database, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MetricsData {
  cache: {
    hitRate: number;
    entries: number;
    hits: number;
    misses: number;
  };
  rateLimits: Record<string, any>;
  exchanges: Record<string, any>;
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export default function GatewayMetricsDashboard() {
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  const { data: metrics } = useQuery<{ success: boolean; metrics: MetricsData }>({
    queryKey: ['/api/gateway/metrics/realtime'],
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery<{ success: boolean; alerts: Alert[] }>({
    queryKey: ['/api/gateway/alerts'],
    refetchInterval: 10000,
  });

  const { data: latencyHistory } = useQuery({
    queryKey: ['/api/gateway/metrics/exchange-latency'],
    refetchInterval: 15000,
  });

  const { data: usageHistory } = useQuery({
    queryKey: ['/api/gateway/metrics/rate-limit-usage'],
    refetchInterval: 15000,
  });

  const acknowledgeAlert = async (id: string) => {
    await fetch(`/api/gateway/alerts/${id}/acknowledge`, { method: 'POST' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gateway Performance Metrics</h1>
        <p className="text-muted-foreground">Real-time monitoring and alerts</p>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.alerts.filter(a => !a.acknowledged).length > 0 && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                Active Alerts ({alerts.alerts.filter(a => !a.acknowledged).length})
              </h3>
              <div className="space-y-2">
                {alerts.alerts.filter(a => !a.acknowledged).slice(0, 5).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-2 bg-white/50 dark:bg-slate-900/50 rounded">
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <span className="text-sm font-medium">{alert.title}</span>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-xs px-2 py-1 bg-yellow-200 dark:bg-yellow-900 rounded hover:bg-yellow-300 dark:hover:bg-yellow-800"
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Cache Hit Rate</h3>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold">
            {((metrics?.metrics.cache.hitRate || 0) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics?.metrics.cache.hits || 0} hits / {metrics?.metrics.cache.misses || 0} misses
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Cache Entries</h3>
            <Activity className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold">{metrics?.metrics.cache.entries || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Active cache entries</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Healthy Exchanges</h3>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold">
            {metrics ? Object.values(metrics.metrics.exchanges).filter((e: any) => e.healthy).length : 0}
            <span className="text-sm text-muted-foreground">
              /{metrics ? Object.keys(metrics.metrics.exchanges).length : 0}
            </span>
          </p>
        </Card>
      </div>

      {/* Exchange Latency Chart */}
      {latencyHistory?.success && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Exchange Latency Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyHistory.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9ca3af"
                tickFormatter={(val) => new Date(val).toLocaleTimeString()}
              />
              <YAxis stroke="#9ca3af" label={{ value: 'Latency (ms)', angle: -90 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              />
              <Legend />
              <Line type="monotone" dataKey="exchanges.binance" stroke="#3b82f6" name="Binance" />
              <Line type="monotone" dataKey="exchanges.coinbase" stroke="#10b981" name="Coinbase" />
              <Line type="monotone" dataKey="exchanges.kraken" stroke="#8b5cf6" name="Kraken" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Rate Limit Usage Chart */}
      {usageHistory?.success && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Rate Limit Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={usageHistory.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9ca3af"
                tickFormatter={(val) => new Date(val).toLocaleTimeString()}
              />
              <YAxis stroke="#9ca3af" label={{ value: 'Usage %', angle: -90 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              />
              <Legend />
              <Line type="monotone" dataKey="exchanges.binance" stroke="#3b82f6" name="Binance" />
              <Line type="monotone" dataKey="exchanges.coinbase" stroke="#10b981" name="Coinbase" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
