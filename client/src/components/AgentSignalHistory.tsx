import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area } from 'recharts';
import { Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { formatConfidence, formatPct } from '@/utils/formatting';

interface SignalHistory {
  timestamp: number;
  symbol: string;
  agent: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  accuracy: number;
  reason: string;
}

interface AgentSignalHistoryProps {
  signals: SignalHistory[];
  selectedAgent?: string;
  onAgentFilter?: (agent: string | null) => void;
}

export default function AgentSignalHistory({
  signals,
  selectedAgent,
  onAgentFilter
}: AgentSignalHistoryProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('24h');
  const [filteredAgent, setFilteredAgent] = useState<string | null>(selectedAgent || null);

  // Filter signals by time range
  const now = Date.now();
  const timeRangeMs = {
    '1h': 1000 * 60 * 60,
    '24h': 1000 * 60 * 60 * 24,
    '7d': 1000 * 60 * 60 * 24 * 7,
    'all': Infinity
  };

  const filtered = signals.filter(s => {
    const inRange = now - s.timestamp <= timeRangeMs[timeRange];
    const agentMatch = !filteredAgent || s.agent === filteredAgent;
    return inRange && agentMatch;
  });

  // Get unique agents for filter
  const agents = Array.from(new Set(signals.map(s => s.agent)));

  // Prepare chart data - group by time (1 hour buckets)
  const chartData = filtered.reduce((acc: any[], signal) => {
    const hour = Math.floor(signal.timestamp / (1000 * 60 * 60)) * (1000 * 60 * 60);
    const existing = acc.find(d => d.time === hour);

    if (existing) {
      existing[signal.signal]++;
      existing.confidence = (existing.confidence * existing.total + signal.confidence) / (existing.total + 1);
      existing.total++;
    } else {
      acc.push({
        time: hour,
        BUY: signal.signal === 'BUY' ? 1 : 0,
        SELL: signal.signal === 'SELL' ? 1 : 0,
        HOLD: signal.signal === 'HOLD' ? 1 : 0,
        confidence: signal.confidence,
        total: 1
      });
    }
    return acc;
  }, []);

  // Agent statistics
  const agentStats = agents.map(agent => {
    const agentSignals = filtered.filter(s => s.agent === agent);
    const buys = agentSignals.filter(s => s.signal === 'BUY').length;
    const sells = agentSignals.filter(s => s.signal === 'SELL').length;
    const holds = agentSignals.filter(s => s.signal === 'HOLD').length;
    const totalWins = agentSignals.filter(s => s.accuracy > 0.5).length;

    return {
      agent,
      signalCount: agentSignals.length,
      buys,
      sells,
      holds,
      avgConfidence: agentSignals.reduce((sum, s) => sum + s.confidence, 0) / agentSignals.length,
      winRate: agentSignals.length > 0 ? (totalWins / agentSignals.length) * 100 : 0
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Agent Signal History</h2>
        <p className="text-slate-400">Track what each agent has recommended over time</p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['1h', '24h', '7d', 'all'] as const).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            onClick={() => setTimeRange(range)}
            className="text-sm"
          >
            {range === 'all' ? 'All Time' : range.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Agent Filter */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter by Agent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!filteredAgent ? 'default' : 'outline'}
              onClick={() => {
                setFilteredAgent(null);
                onAgentFilter?.(null);
              }}
              size="sm"
            >
              All Agents ({filtered.length})
            </Button>
            {agents.map((agent) => {
              const count = filtered.filter(s => s.agent === agent).length;
              return (
                <Button
                  key={agent}
                  variant={filteredAgent === agent ? 'default' : 'outline'}
                  onClick={() => {
                    setFilteredAgent(agent);
                    onAgentFilter?.(agent);
                  }}
                  size="sm"
                >
                  {agent} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Signal Timeline Chart */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Signal Timeline</CardTitle>
          <CardDescription>BUY, SELL, and HOLD signals over time</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tickFormatter={(time) => new Date(time).toLocaleDateString()}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value) => value}
                />
                <Legend />
                <Bar dataKey="BUY" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="HOLD" stackId="a" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="SELL" stackId="a" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              No signals in this time range
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Statistics */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Agent Statistics</CardTitle>
          <CardDescription>Performance metrics for each agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="text-left py-3 px-4">Agent</th>
                  <th className="text-center py-3 px-4">Signals</th>
                  <th className="text-center py-3 px-4">
                    <span className="text-green-400">BUY</span>
                  </th>
                  <th className="text-center py-3 px-4">
                    <span className="text-yellow-400">HOLD</span>
                  </th>
                  <th className="text-center py-3 px-4">
                    <span className="text-red-400">SELL</span>
                  </th>
                  <th className="text-center py-3 px-4">Avg Confidence</th>
                  <th className="text-center py-3 px-4">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((stat) => (
                  <tr key={stat.agent} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4 font-semibold">{stat.agent}</td>
                    <td className="text-center py-3 px-4">{stat.signalCount}</td>
                    <td className="text-center py-3 px-4">
                      <span className="text-green-400 font-semibold">{stat.buys}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-yellow-400 font-semibold">{stat.holds}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-red-400 font-semibold">{stat.sells}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-blue-400 font-semibold">{formatConfidence(stat.avgConfidence)}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={stat.winRate > 50 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {formatPct(stat.winRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Signals List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>Latest {Math.min(10, filtered.length)} signals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filtered.slice(-10).reverse().map((signal, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm mb-1">
                      {signal.agent} • {signal.symbol}
                    </div>
                    <Badge
                      className={`text-xs font-bold border-0 ${
                        signal.signal === 'BUY'
                          ? 'bg-green-500/30 text-green-400'
                          : signal.signal === 'SELL'
                          ? 'bg-red-500/30 text-red-400'
                          : 'bg-yellow-500/30 text-yellow-400'
                      }`}
                    >
                      {signal.signal} ({formatConfidence(signal.confidence)})
                    </Badge>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    {new Date(signal.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <p className="text-xs text-slate-300 mb-2">{signal.reason}</p>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Accuracy:</span>
                    <span className={`ml-1 font-semibold ${signal.accuracy > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPct(signal.accuracy * 100)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
