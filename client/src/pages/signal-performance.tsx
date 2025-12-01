
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Target, Activity, DollarSign, Award, AlertCircle } from 'lucide-react';

interface SignalPerformance {
  signalId: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  pnl: number;
  pnlPercent: number;
  status: 'active' | 'hit_target' | 'hit_stop' | 'expired';
  createdAt: string;
  closedAt?: string;
}

interface PerformanceStats {
  totalSignals: number;
  activeSignals: number;
  winRate: number;
  avgPnl: number;
  avgPnlPercent: number;
}

export default function SignalPerformance() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Fetch performance stats
  const { data: stats } = useQuery<PerformanceStats>({
    queryKey: ['signal-performance-stats'],
    queryFn: async () => {
      const response = await fetch('/api/gateway/signals/performance/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch recent performance
  const { data: recentPerformance } = useQuery<SignalPerformance[]>({
    queryKey: ['signal-performance-recent'],
    queryFn: async () => {
      const response = await fetch('/api/gateway/signals/performance/recent?limit=50');
      if (!response.ok) throw new Error('Failed to fetch performance');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const filteredSignals = recentPerformance?.filter(s => 
    selectedStatus === 'all' || s.status === selectedStatus
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hit_target': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'hit_stop': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'active': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'expired': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hit_target': return <Target className="w-4 h-4 text-green-400" />;
      case 'hit_stop': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'active': return <Activity className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
              Signal Performance Tracker
            </h1>
            <p className="text-slate-400 text-sm">Track signal outcomes, win rates, and P&L attribution</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Total Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalSignals}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{stats.activeSignals}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</div>
              <Progress value={stats.winRate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Avg P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${stats.avgPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Avg P&L %
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.avgPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.avgPnlPercent >= 0 ? '+' : ''}{stats.avgPnlPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList className="bg-slate-800/50 border-slate-700 mb-4">
          <TabsTrigger value="all">All Signals</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="hit_target">Winners</TabsTrigger>
          <TabsTrigger value="hit_stop">Losers</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus}>
          <div className="grid grid-cols-1 gap-4">
            {filteredSignals.map((signal) => (
              <Card key={signal.signalId} className="bg-slate-800/40 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-white">{signal.symbol}</div>
                      <Badge className={`${getStatusColor(signal.status)} border`}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(signal.status)}
                          {signal.status.replace('_', ' ').toUpperCase()}
                        </div>
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${signal.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {signal.pnl >= 0 ? '+' : ''}${signal.pnl.toFixed(2)}
                      </div>
                      <div className={`text-sm ${signal.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {signal.pnlPercent >= 0 ? '+' : ''}{signal.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-slate-400">Entry</div>
                      <div className="text-white font-semibold">${signal.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Current</div>
                      <div className="text-white font-semibold">${signal.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Target</div>
                      <div className="text-green-400 font-semibold">${signal.targetPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Stop Loss</div>
                      <div className="text-red-400 font-semibold">${signal.stopLoss.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Created: {new Date(signal.createdAt).toLocaleString()}</span>
                      {signal.closedAt && (
                        <span>Closed: {new Date(signal.closedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar to target/stop */}
                  {signal.status === 'active' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Stop</span>
                        <span>Entry</span>
                        <span>Target</span>
                      </div>
                      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`absolute h-full ${signal.currentPrice >= signal.entryPrice ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{
                            left: '50%',
                            width: `${Math.abs(((signal.currentPrice - signal.entryPrice) / (signal.targetPrice - signal.entryPrice)) * 50)}%`,
                            transform: signal.currentPrice >= signal.entryPrice ? 'none' : 'scaleX(-1)'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredSignals.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No signals found for this status
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
