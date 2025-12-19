'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Users,
  Activity,
  Flame,
  Lightbulb,
  Settings
} from 'lucide-react';

interface AgentHealth {
  name: string;
  level: number;
  confidence: number;
  profitFactor: number;
  winRate: number;
  score: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  mood: string;
}

interface BriefingData {
  date: string;
  summary: {
    pnl: number;
    pnlPercent: number;
    trades: number;
    winRate: number;
    avgTrade: number;
    maxDrawdown: number;
  };
  agentsStatus: {
    active: number;
    hibernating: number;
    onProbation: number;
    total: number;
  };
  activityFeed: Array<{
    time: string;
    agent: string;
    action: string;
    symbol?: string;
    size?: string;
    reason?: string;
    status: 'ACTIVE' | 'CLOSED' | 'PROPOSED';
  }>;
  agentHealth: AgentHealth[];
  pendingApprovals: Array<{
    id: string;
    type: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    timeUntilExpire: string;
    impact: string;
  }>;
  activeAlerts: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  emergentPatterns?: string[];
  outlook: {
    marketTrend: string;
    recommendedFocus: string;
    riskLevel: string;
  };
}

export default function CommanderDashboard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'activity' | 'agents' | 'decisions' | 'alerts'>('overview');
  
  // Real data states
  const [marketData, setMarketData] = useState<any>(null);
  const [mlInsights, setMlInsights] = useState<any>(null);
  const [patterns, setPatterns] = useState<any>(null);
  const [portfolioMetrics, setPortfolioMetrics] = useState<any>(null);

  useEffect(() => {
    fetchBriefing();
    fetchRealData();
    
    const briefingInterval = setInterval(fetchBriefing, 60000); // Every 60 seconds
    const marketInterval = setInterval(fetchRealData, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(briefingInterval);
      clearInterval(marketInterval);
    };
  }, []);

  const fetchBriefing = async () => {
    try {
      const response = await fetch('/api/commander/briefing/daily');
      const data = await response.json();
      if (data.success) {
        setBriefing(data.briefing);
      }
    } catch (error) {
      console.error('Failed to fetch briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealData = async () => {
    try {
      // Fetch real market data
      const marketRes = await fetch('/api/commander/market-data');
      const marketJson = await marketRes.json();
      if (marketJson.success) {
        setMarketData(marketJson.marketData);
      }

      // Fetch ML predictions
      const mlRes = await fetch('/api/commander/ml-insights?symbol=BTC/USDT');
      const mlJson = await mlRes.json();
      if (mlJson.success) {
        setMlInsights(mlJson);
      }

      // Fetch patterns
      const patternRes = await fetch('/api/commander/patterns?symbol=BTC/USDT');
      const patternJson = await patternRes.json();
      if (patternJson.success) {
        setPatterns(patternJson);
      }

      // Fetch portfolio metrics
      const portfolioRes = await fetch('/api/commander/portfolio-metrics');
      const portfolioJson = await portfolioRes.json();
      if (portfolioJson.success) {
        setPortfolioMetrics(portfolioJson);
      }
    } catch (error) {
      console.error('Failed to fetch real data:', error);
    }
  };

  if (loading || !briefing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin text-purple-500 mb-4">
            <Zap className="w-12 h-12" />
          </div>
          <p className="text-slate-400">Loading commander briefing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
      {/* Epic Header */}
      <div className="text-center space-y-2 py-8 border-b border-purple-500/20">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
          🎮 Commander Control Center
        </h1>
        <p className="text-slate-400 text-lg">Strategic oversight • Agent ecosystem management • Portfolio command</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Today's P&L */}
        <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950 to-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">Today's P&L</p>
                <p className={`text-3xl font-bold ${briefing.summary.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${briefing.summary.pnl.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${briefing.summary.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {briefing.summary.pnlPercent > 0 ? '+' : ''}{briefing.summary.pnlPercent.toFixed(2)}%
                </p>
              </div>
              <TrendingUp className={`w-8 h-8 ${briefing.summary.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </CardContent>
        </Card>

        {/* Trades Today */}
        <Card className="border-2 border-blue-500/30 bg-gradient-to-br from-blue-950 to-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">Trades Today</p>
                <p className="text-3xl font-bold text-blue-400">{briefing.summary.trades}</p>
                <p className="text-xs text-blue-300 mt-1">{briefing.summary.winRate.toFixed(0)}% win rate</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Agents Active */}
        <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-950 to-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">Agents Active</p>
                <p className="text-3xl font-bold text-purple-400">{briefing.agentsStatus.active}</p>
                <p className="text-xs text-purple-300 mt-1">
                  {briefing.agentsStatus.hibernating} hibernating
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Trade */}
        <Card className="border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-950 to-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avg Trade</p>
                <p className="text-3xl font-bold text-cyan-400">${Math.abs(briefing.summary.avgTrade).toLocaleString()}</p>
                <p className="text-xs text-cyan-300 mt-1">Per trade</p>
              </div>
              <Target className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        {/* Max Drawdown */}
        <Card className="border-2 border-orange-500/30 bg-gradient-to-br from-orange-950 to-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">Max Drawdown</p>
                <p className="text-3xl font-bold text-orange-400">
                  -{briefing.summary.maxDrawdown.toFixed(1)}%
                </p>
                <p className="text-xs text-orange-300 mt-1">Today</p>
              </div>
              <Shield className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Market Data Cards */}
      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6 pt-4 border-t border-slate-700/50">
          <h3 className="col-span-full text-lg font-semibold text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Real Market Data
          </h3>
          
          {/* BTC Price */}
          {marketData[0] && (
            <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-950 to-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">BTC/USDT</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      ${marketData[0].price.toFixed(0)}
                    </p>
                    <p className={`text-xs mt-1 ${marketData[0].changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {marketData[0].changePercent > 0 ? '+' : ''}{marketData[0].changePercent.toFixed(2)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ML Prediction */}
          {mlInsights?.predictions?.direction && (
            <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-950 to-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">ML Prediction</p>
                    <p className={`text-2xl font-bold ${mlInsights.predictions.direction.direction === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                      {mlInsights.predictions.direction.direction === 'UP' ? '↑ UP' : '↓ DOWN'}
                    </p>
                    <p className="text-xs text-green-300 mt-1">
                      {(mlInsights.predictions.direction.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                  <Lightbulb className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pattern Detection */}
          {patterns?.patterns?.primaryPattern && (
            <Card className="border-2 border-violet-500/30 bg-gradient-to-br from-violet-950 to-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pattern</p>
                    <p className="text-2xl font-bold text-violet-400 truncate">
                      {patterns.patterns.primaryPattern}
                    </p>
                    <p className="text-xs text-violet-300 mt-1">
                      Strength: {patterns.patterns.strength}
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-violet-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Portfolio Return */}
          {portfolioMetrics?.metrics && (
            <Card className="border-2 border-pink-500/30 bg-gradient-to-br from-pink-950 to-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Portfolio Return</p>
                    <p className={`text-2xl font-bold ${portfolioMetrics.metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {portfolioMetrics.metrics.totalReturn >= 0 ? '+' : ''}{(portfolioMetrics.metrics.totalReturn * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-pink-300 mt-1">
                      {portfolioMetrics.metrics.totalTrades} trades
                    </p>
                  </div>
                  <Flame className="w-8 h-8 text-pink-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sharpe Ratio */}
          {portfolioMetrics?.metrics?.sharpeRatio !== undefined && (
            <Card className="border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-950 to-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Sharpe Ratio</p>
                    <p className="text-2xl font-bold text-indigo-400">
                      {portfolioMetrics.metrics.sharpeRatio.toFixed(2)}
                    </p>
                    <p className="text-xs text-indigo-300 mt-1">
                      Risk-adjusted return
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-indigo-400" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700/50">
        {(['overview', 'activity', 'agents', 'decisions', 'alerts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === tab
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Pending Approvals */}
          {briefing.pendingApprovals.length > 0 && (
            <Card className="border-2 border-yellow-500/30 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <Clock className="w-5 h-5" />
                  Pending Your Decision ({briefing.pendingApprovals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.pendingApprovals.map(decision => (
                  <div key={decision.id} className="border border-yellow-500/20 p-4 rounded-lg bg-yellow-950/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-100">{decision.description}</p>
                        <p className="text-sm text-slate-400 mt-1">{decision.impact}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            decision.priority === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                            decision.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {decision.priority}
                          </span>
                          <span className="text-xs text-slate-400">Expires in {decision.timeUntilExpire}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline" className="text-green-400 border-green-500/50">
                          ✓ Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/50">
                          ✗ Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Market Outlook */}
          <Card className="border-2 border-cyan-500/30 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
                Market Outlook & Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-slate-400">Market Trend</p>
                <p className="text-lg font-semibold text-cyan-400">{briefing.outlook.marketTrend}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Recommended Focus</p>
                <p className="text-lg font-semibold text-cyan-400">{briefing.outlook.recommendedFocus}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Risk Level</p>
                <p className="text-lg font-semibold text-orange-400">{briefing.outlook.riskLevel}</p>
              </div>
            </CardContent>
          </Card>

          {/* Emergent Patterns */}
          {briefing.emergentPatterns && briefing.emergentPatterns.length > 0 && (
            <Card className="border-2 border-pink-500/30 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pink-400">
                  <Flame className="w-5 h-5" />
                  Emergent Patterns Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {briefing.emergentPatterns.map((pattern, idx) => (
                  <div key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>{pattern}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {selectedTab === 'activity' && (
        <Card className="border-2 border-blue-500/30 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Live Activity Feed (Last 2 Hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {briefing.activityFeed.map((item, idx) => (
                <div key={idx} className="border-l-2 border-blue-500/30 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-blue-400">{item.time}</span>
                        <span className="text-sm font-semibold text-slate-200">{item.agent}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' :
                          item.status === 'CLOSED' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1">{item.action} {item.symbol ? `(${item.symbol})` : ''}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-300">{item.size}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AGENTS TAB */}
      {selectedTab === 'agents' && (
        <Card className="border-2 border-purple-500/30 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Agent Team Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {briefing.agentHealth.map(agent => (
                <div key={agent.name} className="border border-purple-500/20 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-100">{agent.name}</p>
                      <p className="text-xs text-slate-400">Level {agent.level} • {agent.mood}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${agent.score >= 7 ? 'text-emerald-400' : agent.score >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {agent.score.toFixed(1)}
                      </span>
                      <span className="text-xs">/10</span>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-xs text-slate-400">Win Rate: {agent.winRate.toFixed(0)}%</p>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(agent.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Confidence: {(agent.confidence * 100).toFixed(0)}%</p>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(agent.confidence * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trend */}
                  <div className="flex items-center gap-2">
                    {agent.trend === 'UP' && (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400">Trending Up</span>
                      </>
                    )}
                    {agent.trend === 'DOWN' && (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-red-400">Trending Down</span>
                      </>
                    )}
                    {agent.trend === 'STABLE' && (
                      <span className="text-xs text-slate-400">Stable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ALERTS TAB */}
      {selectedTab === 'alerts' && (
        <div>
          {briefing.activeAlerts.length > 0 ? (
            <Card className="border-2 border-red-500/30 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Active Alerts ({briefing.activeAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.activeAlerts.map((alert, idx) => (
                  <div key={idx} className={`border p-4 rounded-lg ${
                    alert.severity === 'CRITICAL' ? 'border-red-500/50 bg-red-950/10' :
                    alert.severity === 'HIGH' ? 'border-orange-500/50 bg-orange-950/10' :
                    'border-yellow-500/50 bg-yellow-950/10'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 mt-1 text-red-400" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-100">{alert.type}</p>
                        <p className="text-sm text-slate-300 mt-1">{alert.message}</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-yellow-400 border-yellow-500/50">
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-green-500/30 bg-slate-900/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-3 py-8">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <p className="text-slate-300">All systems nominal. No active alerts.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* DECISIONS TAB */}
      {selectedTab === 'decisions' && (
        <Card className="border-2 border-green-500/30 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              Decision History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">Recent decisions will be displayed here</p>
          </CardContent>
        </Card>
      )}

      {/* Emergency Controls Footer */}
      <div className="border-t border-slate-700/50 pt-6 flex gap-3 justify-end">
        <Button variant="outline" className="text-slate-400 border-slate-600 hover:border-slate-500">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        <Button variant="outline" className="text-red-400 border-red-500/50 hover:border-red-500">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Pause All
        </Button>
        <Button className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
          <CheckCircle className="w-4 h-4 mr-2" />
          Resume All
        </Button>
      </div>
    </div>
  );
}
