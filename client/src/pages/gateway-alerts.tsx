
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, BellOff, CheckCircle, XCircle, AlertTriangle, Settings, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Alert {
  id: string;
  type: 'exchange_down' | 'high_rate_limit' | 'price_deviation' | 'low_cache_hit' | 'high_latency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  exchange?: string;
  metric?: any;
  timestamp: string;
  acknowledged: boolean;
}

interface Thresholds {
  rateLimitUsage: number;
  cacheHitRate: number;
  latency: number;
  consecutiveFailures: number;
  priceDeviation: number;
}

export default function GatewayAlertsPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('unacknowledged');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>({
    rateLimitUsage: 0.8,
    cacheHitRate: 0.7,
    latency: 500,
    consecutiveFailures: 3,
    priceDeviation: 0.02
  });
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['gatewayAlerts', filter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unacknowledged') params.append('acknowledged', 'false');
      if (severityFilter) params.append('severity', severityFilter);
      
      const res = await fetch(`/api/gateway/alerts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    refetchInterval: 5000
  });

  const alerts: Alert[] = alertsData?.alerts || [];

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gateway/alerts/${id}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to acknowledge');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatewayAlerts'] })
  });

  // Clear acknowledged mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gateway/alerts/acknowledged', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatewayAlerts'] })
  });

  // Update thresholds mutation
  const updateThresholdsMutation = useMutation({
    mutationFn: async (newThresholds: Thresholds) => {
      const res = await fetch('/api/gateway/alerts/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newThresholds)
      });
      if (!res.ok) throw new Error('Failed to update thresholds');
      return res.json();
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      default: return 'bg-blue-600';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5" />;
      case 'high': return <AlertTriangle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const handleUpdateThresholds = () => {
    updateThresholdsMutation.mutate(thresholds);
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setLocation('/')} className="flex items-center text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Dashboard
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Gateway Alerts
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2 hover:bg-slate-600"
              >
                <Settings className="w-4 h-4" />
                Thresholds
              </button>
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="px-4 py-2 bg-red-600 rounded-lg flex items-center gap-2 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Clear Acknowledged
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">Total Alerts</div>
            <div className="text-2xl font-bold text-white">{alerts.length}</div>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-xl border border-red-700/50">
            <div className="text-slate-400 text-sm mb-1">Critical</div>
            <div className="text-2xl font-bold text-red-400">
              {alerts.filter(a => a.severity === 'critical').length}
            </div>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-xl border border-orange-700/50">
            <div className="text-slate-400 text-sm mb-1">High</div>
            <div className="text-2xl font-bold text-orange-400">
              {alerts.filter(a => a.severity === 'high').length}
            </div>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">Unacknowledged</div>
            <div className="text-2xl font-bold text-white">
              {alerts.filter(a => !a.acknowledged).length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 mb-6">
          <div className="flex gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="all">All</option>
                <option value="unacknowledged">Unacknowledged</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Alert Thresholds</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Rate Limit Usage (%)</label>
                <input
                  type="number"
                  value={thresholds.rateLimitUsage * 100}
                  onChange={(e) => setThresholds({ ...thresholds, rateLimitUsage: parseFloat(e.target.value) / 100 })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Cache Hit Rate (%)</label>
                <input
                  type="number"
                  value={thresholds.cacheHitRate * 100}
                  onChange={(e) => setThresholds({ ...thresholds, cacheHitRate: parseFloat(e.target.value) / 100 })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Latency Threshold (ms)</label>
                <input
                  type="number"
                  value={thresholds.latency}
                  onChange={(e) => setThresholds({ ...thresholds, latency: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Price Deviation (%)</label>
                <input
                  type="number"
                  value={thresholds.priceDeviation * 100}
                  onChange={(e) => setThresholds({ ...thresholds, priceDeviation: parseFloat(e.target.value) / 100 })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={handleUpdateThresholds}
              className="mt-4 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Update Thresholds
            </button>
          </div>
        )}

        {/* Alerts List */}
        <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Alerts</h2>
          {isLoading ? (
            <div className="text-center text-slate-400 py-8">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <BellOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No alerts found
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${alert.acknowledged ? 'bg-slate-900/30 border-slate-700/20' : 'bg-slate-900/50 border-slate-700/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-white">{alert.title}</div>
                          <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(alert.severity)} text-white`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          {alert.exchange && (
                            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                              {alert.exchange}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-300 mb-2">{alert.message}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        disabled={acknowledgeMutation.isPending}
                        className="px-3 py-1 bg-green-600 rounded-lg flex items-center gap-1 hover:bg-green-700 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Acknowledge
                      </button>
                    )}
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
