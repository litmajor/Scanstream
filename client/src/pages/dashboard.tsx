import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertCircle,
  ChevronDown,
  Settings,
  Plus,
  Eye,
  Filter,
  Clock,
  Target,
  X,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EntryDialog, { PositionEntry } from '../components/EntryDialog';
import { TradingChart } from '../components/TradingChart';

// ============================================================================
// PHASE 5: FRONTEND VISUALIZATION COMPONENTS
// ============================================================================
import SignalTransparency from '../components/SignalTransparency';
import ExtendedAgentLeaderboard from '../components/ExtendedAgentLeaderboard';
import SignalHistory from '../components/SignalHistory';
import RegimeDisplay from '../components/RegimeDisplay';

interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  rsi?: number | null;
  macd?: number | null;
  ema?: number | null;
}

interface CandleSignals {
  timestamp: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  avgConfidence: number;
  signals: Array<{
    agentName: string;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
  }>;
}

interface AgentSignal {
  agentName: string;
  agentType: 'SCANNER' | 'ML' | 'RL' | 'FLOW' | 'VFMD' | 'EXIT' | 'OPPOSITION' | 'MICROSTRUCTURE' | 
             'GRADIENT_TREND' | 'UT_BOT' | 'MEAN_REVERSION' | 'VOLUME_PROFILE' | 'MARKET_STRUCTURE';
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  accuracy: number;
  insights: {
    primary: string;
    dataPoints: Record<string, string | number>;
  };
}

interface AssetConsensus {
  symbol: string;
  price: number;
  priceChange: number;
  volume: number;
  consensusSignal: 'BUY' | 'SELL' | 'HOLD';
  buyAgents: number;
  holdAgents: number;
  sellAgents: number;
  avgConfidence: number;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: AgentSignal[];
}

interface PaperTradeMode {
  enabled: boolean;
  capital: number;
  pnl: number;
}

interface Alert {
  id: string;
  symbol: string;
  type: 'HIGH_CONVICTION' | 'ENTRY_READY' | 'STOP_HIT' | 'LIQUIDITY_WARNING' | 'DIVERGENCE';
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: number;
  actionable: boolean;
}

interface PaperTradingPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number;
  entryTime: string;
  stopLoss?: number;
  takeProfit?: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  pnl?: number;
  pnlPercent?: number;
  agentSignal?: string;
}

const AGENT_COLORS: Record<string, string> = {
  VFMD: 'bg-red-500/20 border-red-500/50 text-red-400',
  FLOW: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  GRADIENT_TREND: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  SCANNER: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  ML: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400',
  RL: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
  EXIT: 'bg-green-500/20 border-green-500/50 text-green-400',
  OPPOSITION: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  MICROSTRUCTURE: 'bg-pink-500/20 border-pink-500/50 text-pink-400',
  UT_BOT: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  MEAN_REVERSION: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  VOLUME_PROFILE: 'bg-lime-500/20 border-lime-500/50 text-lime-400',
  MARKET_STRUCTURE: 'bg-violet-500/20 border-violet-500/50 text-violet-400'
};

const AGENT_ICONS: Record<string, string> = {
  VFMD: '👁️',
  FLOW: '🌀',
  GRADIENT_TREND: '📈',
  SCANNER: '🔍',
  ML: '🤖',
  RL: '🎰',
  EXIT: '🎬',
  OPPOSITION: '🚧',
  MICROSTRUCTURE: '💧',
  UT_BOT: '🛑',
  MEAN_REVERSION: '⤴️',
  VOLUME_PROFILE: '📊',
  MARKET_STRUCTURE: '🏗️'
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'top-volume' | 'top-confidence' | 'high-conviction' | 'all'>('top-volume');
  const [alertFilter, setAlertFilter] = useState<Alert['type'] | 'ALL'>('ALL');
  const [paperTradingMode, setPaperTradingMode] = useState<PaperTradeMode>({
    enabled: true,
    capital: 10000,
    pnl: 0
  });
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [entryAsset, setEntryAsset] = useState<any | null>(null);
  const [entrySide, setEntrySide] = useState<'LONG' | 'SHORT'>('LONG');
  const [showError, setShowError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(paperTradingMode);
  const [showAssetDetail, setShowAssetDetail] = useState(false);
  const [detailAsset, setDetailAsset] = useState<AssetConsensus | null>(null);
  
  // Interactive features state
  const [hoveredAgent, setHoveredAgent] = useState<AgentSignal | null>(null);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentSignal | null>(null);
  const [showAgentInspector, setShowAgentInspector] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeframeZoom, setTimeframeZoom] = useState<'1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1month'>('1h');
  const [chartCandles, setChartCandles] = useState<ChartDataPoint[]>([]);
  const [candleSignals, setCandleSignals] = useState<CandleSignals | null>(null);
  const [hoveredCandleTime, setHoveredCandleTime] = useState<number | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const chartDataRef = useRef<ChartDataPoint[]>([]);

  // Setup WebSocket for real-time asset price updates (Phase 2)
  useEffect(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'asset_update') {
            // Invalidate assets cache to trigger refetch with new data
            queryClient.invalidateQueries({ queryKey: ['assets-consensus'] });
          } else if (data.type === 'position_update') {
            // Invalidate positions cache on new position
            queryClient.invalidateQueries({ queryKey: ['paper-trading-positions'] });
          } else if (data.type === 'alert') {
            // Invalidate alerts cache
            queryClient.invalidateQueries({ queryKey: ['trading-alerts'] });
          }
        } catch (err) {
          console.warn('WebSocket message parse error:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.warn('WebSocket connection error (will use polling instead):', error);
      };

      return () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      };
    } catch (err) {
      console.warn('WebSocket setup error (will use polling):', err);
    }
  }, [queryClient]);

  // Fetch all asset consensus data
  const { data: assets, isLoading: assetsLoading, error: assetsError } = useQuery<AssetConsensus[]>({
    queryKey: ['assets-consensus'],
    queryFn: async () => {
      const response = await fetch('/api/agents/signals/asset-insights');
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      // Handle both array and object response formats
      return Array.isArray(data) ? data : (data.data || []);
    },
    refetchInterval: 5000,
    retry: 2
  });

  // Fetch paper trading positions (Phase 1)
  const { data: positions, isLoading: positionsLoading, error: positionsError } = useQuery<PaperTradingPosition[]>({
    queryKey: ['paper-trading-positions'],
    queryFn: async () => {
      const response = await fetch('/api/paper-trading/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.positions || []);
    },
    refetchInterval: 3000,
    retry: 1
  });

  // Fetch alerts
  const { data: alerts, error: alertsError } = useQuery<Alert[]>({
    queryKey: ['trading-alerts'],
    queryFn: async () => {
      const response = await fetch('/api/agents/signals/divergence-alert');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    },
    refetchInterval: 3000,
    retry: 1
  });

  // Load top scan results from localStorage and convert to alerts
  // Fetch top scan results from server instead of localStorage
  const { data: scanTopData } = useQuery({
    queryKey: ['scanner-top-signals'],
    queryFn: async () => {
      const resp = await fetch('/api/scanner/top?limit=5');
      if (!resp.ok) throw new Error('Failed to fetch top scanner signals');
      const data = await resp.json();
      return Array.isArray(data) ? { top: data } : data;
    },
    refetchInterval: 5000,
    retry: 1
  });

  // Show errors from API calls
  useEffect(() => {
    if (assetsError) setShowError('Failed to load assets: ' + (assetsError as any).message);
    else if (alertsError) setShowError('Failed to load alerts: ' + (alertsError as any).message);
    else if (positionsError) setShowError('Failed to load positions: ' + (positionsError as any).message);
    else setShowError(null);
  }, [assetsError, alertsError, positionsError]);

  const scanAlerts = useMemo(() => {
    try {
      const signals = (scanTopData?.top) || [];
      return signals.map((s: any, i: number) => ({
        id: `scan-${s.symbol}-${s.timestamp || i}`,
        symbol: s.symbol,
        type: 'ENTRY_READY' as const,
        message: `${s.symbol} ${s.consensus?.signal || 'HOLD'} (confidence: ${Math.round((s.confidence || 0) * 100) || Math.round((s.consensus?.confidence || 0) * 100)}%)`,
        severity: (s.confidence || 0) > 0.7 ? 'CRITICAL' as const : 'INFO' as const,
        timestamp: s.timestamp || Date.now(),
        actionable: true
      }));
    } catch (err) {
      return [] as Alert[];
    }
  }, [scanTopData]);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    const assetsArray = assets as AssetConsensus[];
    
    let filtered = assetsArray.filter((asset: AssetConsensus) => 
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply list filter
    switch (listFilter) {
      case 'top-volume':
        return filtered.sort((a: AssetConsensus, b: AssetConsensus) => b.volume - a.volume).slice(0, 15);
      case 'top-confidence':
        return filtered.sort((a: AssetConsensus, b: AssetConsensus) => b.avgConfidence - a.avgConfidence).slice(0, 15);
      case 'high-conviction':
        return filtered.filter((a: AssetConsensus) => a.buyAgents >= 6).sort((a: AssetConsensus, b: AssetConsensus) => b.buyAgents - a.buyAgents);
      default:
        return filtered;
    }
  }, [assets, searchQuery, listFilter]);

  // Get selected asset data
  const selectedAssetData = selectedAsset 
    ? (assets as AssetConsensus[] | null | undefined)?.find((a: AssetConsensus) => a.symbol === selectedAsset)
    : filteredAssets[0];

  // Combine API alerts with scan-derived alerts and filter
  const combinedAlerts = useMemo(() => {
    const alertsArray = (alerts as Alert[] | null | undefined) || [];
    return [...alertsArray, ...scanAlerts];
  }, [alerts, scanAlerts]);

  const filteredAlerts = useMemo(() => {
    if (!combinedAlerts) return [];
    return alertFilter === 'ALL'
      ? combinedAlerts
      : combinedAlerts.filter(a => a.type === alertFilter);
  }, [combinedAlerts, alertFilter]);

  // Calculate average confidence outside JSX
  const avgConfidence = useMemo(() => {
    const assetsArray = (assets as AssetConsensus[] | null | undefined) || [];
    if (!assetsArray || assetsArray.length === 0) return 0;
    const sum = assetsArray.reduce((acc: number, a: AssetConsensus) => acc + (a.avgConfidence || 0), 0);
    return (sum / assetsArray.length).toFixed(0);
  }, [assets]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    const positionsArray = (positions as PaperTradingPosition[] | null | undefined) || [];
    if (!positionsArray || positionsArray.length === 0) {
      return {
        winRate: 0,
        avgROI: 0,
        bestSymbol: '-',
        totalTrades: 0,
        winCount: 0,
        lossCount: 0
      };
    }

    const closedPositions = positionsArray.filter((p: PaperTradingPosition) => p.status === 'CLOSED');
    const totalPnL = closedPositions.reduce((sum: number, p: PaperTradingPosition) => sum + (p.pnl || 0), 0);
    const winCount = closedPositions.filter((p: PaperTradingPosition) => (p.pnl || 0) > 0).length;
    const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;
    const avgROI = closedPositions.length > 0 ? totalPnL / closedPositions.length : 0;

    // Find best performing symbol
    let bestSymbol = '-';
    let bestPnL = 0;
    closedPositions.forEach((p: PaperTradingPosition) => {
      if ((p.pnl || 0) > bestPnL) {
        bestPnL = p.pnl || 0;
        bestSymbol = p.symbol;
      }
    });

    return {
      winRate: winRate.toFixed(1),
      avgROI: avgROI.toFixed(2),
      bestSymbol,
      totalTrades: positionsArray.length,
      winCount,
      lossCount: closedPositions.length - winCount
    };
  }, [positions]);

  const getConsensusColor = (signal: string) => {
    return signal === 'BUY' ? 'text-green-400' : signal === 'SELL' ? 'text-red-400' : 'text-yellow-400';
  };

  const getRiskColor = (risk: string) => {
    return risk === 'LOW' ? 'bg-green-500/20 text-green-400' : 
           risk === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 
           'bg-red-500/20 text-red-400';
  };

  if (assetsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p>Loading market intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Trading Command Center
            </h1>
            <p className="text-slate-400 mt-1">13-Agent Intelligence Hub</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Pause/Replay Controls */}
            <div className="flex gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
              <Button
                variant={isPaused ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                className={isPaused ? "bg-orange-600 hover:bg-orange-700" : ""}
                title={isPaused ? "Resume real-time updates" : "Pause real-time updates"}
              >
                {isPaused ? "▶ Resume" : "⏸ Pause"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  alert('Replay feature: This would load historical data for debugging');
                }}
                title="Replay historical data for debugging"
              >
                ↻ Replay
              </Button>
            </div>

            {/* Timeframe Zoom Controls */}
            <div className="flex gap-1 bg-slate-900/50 p-2 rounded-lg border border-slate-800 overflow-x-auto">
              {(['1m', '5m', '15m', '1h', '1d', '1w', '1month'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={timeframeZoom === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframeZoom(tf)}
                  className="text-xs px-2 whitespace-nowrap"
                  title={`View ${tf} timeframe`}
                >
                  {tf}
                </Button>
              ))}
            </div>

            <div className="text-right">
              <div className="text-sm text-slate-400">Paper Trading</div>
              <div className="text-2xl font-bold text-green-400">
                ${paperTradingMode.capital.toLocaleString()}
              </div>
              {paperTradingMode.pnl !== 0 && (
                <div className={`text-sm ${paperTradingMode.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {paperTradingMode.pnl > 0 ? '+' : ''}{paperTradingMode.pnl.toFixed(2)}%
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => {
              setTempSettings(paperTradingMode);
              setShowSettings(true);
            }} title="Open settings">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">Active Positions</div>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">High Conviction Signals</div>
              <div className="text-2xl font-bold text-green-400">
                {(assets as AssetConsensus[] | null | undefined)?.filter((a: AssetConsensus) => a.buyAgents >= 6).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">Avg Confidence</div>
              <div className="text-2xl font-bold">
                {avgConfidence}%
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">Active Alerts</div>
              <div className="text-2xl font-bold text-orange-400">
                {filteredAlerts.length}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">Win Rate</div>
              <div className="text-2xl font-bold text-green-400">{performanceMetrics.winRate}%</div>
              <div className="text-xs text-slate-500 mt-1">{performanceMetrics.winCount}W / {performanceMetrics.lossCount}L</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-sm text-slate-400 mb-2">Avg ROI</div>
              <div className={`text-2xl font-bold ${parseFloat(performanceMetrics.avgROI as string) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performanceMetrics.avgROI}%
              </div>
              <div className="text-xs text-slate-500 mt-1">{performanceMetrics.totalTrades} trades</div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics Expanded */}
        {performanceMetrics.totalTrades > 0 && (
          <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Performance Summary
              </CardTitle>
              <CardDescription>Trading Statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-slate-400 mb-2">Total Trades</div>
                  <div className="text-3xl font-bold text-blue-400">{performanceMetrics.totalTrades}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-2">Winning Trades</div>
                  <div className="text-3xl font-bold text-green-400">{performanceMetrics.winCount}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-2">Losing Trades</div>
                  <div className="text-3xl font-bold text-red-400">{performanceMetrics.lossCount}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-2">Best Performer</div>
                  <div className="text-3xl font-bold text-purple-400">{performanceMetrics.bestSymbol}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        
        {/* LEFT: Asset Watchlist (25%) */}
        <div className="col-span-3 space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Market Watch</CardTitle>
              <CardDescription>Asset Selection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>

              {/* List Filters */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={listFilter === 'top-volume' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('top-volume')}
                >
                  Top Volume
                </Button>
                <Button
                  variant={listFilter === 'top-confidence' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('top-confidence')}
                >
                  Top Conf
                </Button>
                <Button
                  variant={listFilter === 'high-conviction' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('high-conviction')}
                  className="col-span-2"
                >
                  High Conviction
                </Button>
              </div>

              {/* Asset List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAssets.map((asset: AssetConsensus) => (
                  <div
                    key={asset.symbol}
                    className={`p-3 rounded-lg transition-all border ${
                      selectedAsset === asset.symbol
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        onClick={() => setSelectedAsset(asset.symbol)}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-semibold text-sm">{asset.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getConsensusColor(asset.consensusSignal)}`}
                        >
                          {asset.consensusSignal}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDetailAsset(asset);
                            setShowAssetDetail(true);
                          }}
                          className="p-0 h-auto w-auto hover:bg-slate-700"
                          title="View asset details"
                        >
                          <Eye className="w-4 h-4 text-blue-400" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span className="text-white">${asset.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Agents:</span>
                        <span className="text-green-400">{asset.buyAgents}/13</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conf:</span>
                        <span>{asset.avgConfidence.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: 13-Agent Signals (50%) */}
        <div className="col-span-6 space-y-4">
          {selectedAssetData ? (
            <>
              {/* Consensus Summary */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedAssetData.symbol}</CardTitle>
                      <CardDescription>
                        ${selectedAssetData.price.toFixed(2)} 
                        <span className={selectedAssetData.priceChange > 0 ? 'text-green-400 ml-2' : 'text-red-400 ml-2'}>
                          {selectedAssetData.priceChange > 0 ? '+' : ''}{selectedAssetData.priceChange.toFixed(2)}%
                        </span>
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-2" />
                      Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Consensus Type */}
                    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="text-sm text-slate-400 mb-2">Consensus Signal</div>
                      <div className={`text-3xl font-bold ${getConsensusColor(selectedAssetData.consensusSignal)}`}>
                        {selectedAssetData.consensusSignal}
                      </div>
                      <div className="text-xs text-slate-400 mt-2">
                        {selectedAssetData.buyAgents}/13 agents bullish
                      </div>
                    </div>

                    {/* Risk & Confidence */}
                    <div className="space-y-2">
                      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Risk Level</div>
                        <Badge className={`${getRiskColor(selectedAssetData.riskScore)} border-0`}>
                          {selectedAssetData.riskScore}
                        </Badge>
                      </div>
                      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Avg Confidence</div>
                        <div className="text-xl font-bold text-blue-400">
                          {selectedAssetData.avgConfidence.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vote Distribution */}
                  <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400 mb-3">Agent Distribution</div>
                    <div className="flex items-end gap-2 h-16">
                      <div className="flex-1 bg-green-500/30 rounded-t flex flex-col items-center justify-end pb-2">
                        <div className="text-xs text-green-400 font-bold">{selectedAssetData.buyAgents}</div>
                        <div className="text-xs text-slate-400">BUY</div>
                      </div>
                      <div className="flex-1 bg-yellow-500/30 rounded-t flex flex-col items-center justify-end pb-2">
                        <div className="text-xs text-yellow-400 font-bold">{selectedAssetData.holdAgents}</div>
                        <div className="text-xs text-slate-400">HOLD</div>
                      </div>
                      <div className="flex-1 bg-red-500/30 rounded-t flex flex-col items-center justify-end pb-2">
                        <div className="text-xs text-red-400 font-bold">{selectedAssetData.sellAgents}</div>
                        <div className="text-xs text-slate-400">SELL</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedAssetData?.signals.map((signal: AgentSignal) => (
                  <Card
                    key={signal.agentName}
                    className={`border cursor-pointer hover:shadow-lg transition-all ${
                      AGENT_COLORS[signal.agentType]
                    } ${hoveredAgent?.agentName === signal.agentName ? 'ring-2 ring-blue-400' : ''}`}
                    onMouseEnter={() => setHoveredAgent(signal)}
                    onMouseLeave={() => setHoveredAgent(null)}
                    onClick={() => {
                      setSelectedAgentDetail(signal);
                      setShowAgentInspector(true);
                    }}
                  >
                    <CardContent className="p-4">
                      {/* Agent Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{AGENT_ICONS[signal.agentType]}</span>
                          <div>
                            <div className="font-semibold text-sm">{signal.agentName}</div>
                            <div className="text-xs text-slate-400">{signal.agentType}</div>
                          </div>
                        </div>
                      </div>

                      {/* Signal */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-400 mb-1">Signal</div>
                        <Badge
                          className={`text-xs font-bold border-0 ${
                            signal.signal === 'BUY'
                              ? 'bg-green-500/30 text-green-400'
                              : signal.signal === 'SELL'
                              ? 'bg-red-500/30 text-red-400'
                              : 'bg-yellow-500/30 text-yellow-400'
                          }`}
                        >
                          {signal.signal} ({signal.confidence.toFixed(0)}%)
                        </Badge>
                      </div>

                      {/* Primary Insight */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-400 mb-1">Why</div>
                        <p className="text-xs text-slate-300">{signal.insights.primary}</p>
                      </div>

                      {/* Accuracy */}
                      <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Accuracy: {(signal.accuracy || 0).toFixed(0)}%</span>
                          <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100">Click to inspect →</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  size="lg"
                  onClick={() => {
                    if (selectedAssetData) {
                      setEntryAsset(selectedAssetData);
                      setEntrySide('LONG');
                      setShowEntryDialog(true);
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Long Entry
                </Button>
                <Button 
                  className="bg-red-600 hover:bg-red-700" 
                  size="lg"
                  onClick={() => {
                    if (selectedAssetData) {
                      setEntryAsset(selectedAssetData);
                      setEntrySide('SHORT');
                      setShowEntryDialog(true);
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Short Entry
                </Button>
              </div>
            </>
          ) : (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center text-slate-400">Select an asset to view signals</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Alerts & Notifications (25%) */}
        <div className="col-span-3 space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Alerts Center</CardTitle>
                <Filter className="w-4 h-4 text-slate-400" />
              </div>
              <CardDescription>Real-time Trading Signals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alert Filters */}
              <div className="flex flex-col gap-2 text-xs">
                <Button
                  variant={alertFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFilter('ALL')}
                  className="justify-start"
                >
                  All Alerts
                </Button>
                <Button
                  variant={alertFilter === 'HIGH_CONVICTION' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFilter('HIGH_CONVICTION')}
                  className="justify-start"
                >
                  High Conviction
                </Button>
                <Button
                  variant={alertFilter === 'ENTRY_READY' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFilter('ENTRY_READY')}
                  className="justify-start"
                >
                  Entry Ready
                </Button>
                <Button
                  variant={alertFilter === 'LIQUIDITY_WARNING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFilter('LIQUIDITY_WARNING')}
                  className="justify-start"
                >
                  Liquidity Warnings
                </Button>
              </div>

              {/* Alerts List */}
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {filteredAlerts.length > 0 ? (
                  filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-500/10 border-l-red-500'
                          : alert.severity === 'WARNING'
                          ? 'bg-yellow-500/10 border-l-yellow-500'
                          : 'bg-blue-500/10 border-l-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-semibold text-sm">{alert.symbol}</div>
                        <Badge variant="outline" className="text-xs">
                          {alert.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 mb-2">{alert.message}</p>
                      {alert.actionable && (
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => {
                          // Open Entry dialog prefilled from alert
                          const sym = alert.symbol;
                          const stored = localStorage.getItem('latestScanResults');
                          let found: any = null;
                          if (stored) {
                            try {
                              const data = JSON.parse(stored);
                              found = (data.signals || []).find((s: any) => s.symbol === sym) || null;
                            } catch (e) { found = null; }
                          }
                          const asset = found ? {
                            symbol: found.symbol,
                            currentPrice: found.price || found.currentPrice || 0,
                            consensusSignal: found.consensus?.signal || found.signal || 'HOLD',
                            avgConfidence: (found.consensus?.confidence || (found.strength || 0) / 100) * 100,
                            riskScore: found.consensus?.riskScore || 'MEDIUM',
                            suggestedStopLoss: found.risk_reward?.stop_loss || found.suggestedStopLoss,
                            suggestedTakeProfit: found.risk_reward?.take_profit || found.suggestedTakeProfit
                          } : {
                            symbol: sym,
                            currentPrice: 0,
                            consensusSignal: 'HOLD',
                            avgConfidence: 0,
                            riskScore: 'MEDIUM'
                          };
                          setEntryAsset(asset);
                          setEntrySide(asset.consensusSignal === 'SELL' ? 'SHORT' : 'LONG');
                          setShowEntryDialog(true);
                        }}>
                          <Zap className="w-3 h-3 mr-1" />
                          Act Now
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 text-sm py-8">
                    No alerts matching this filter
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Entry Dialog for Dashboard */}
      {entryAsset && (
        <EntryDialog
          isOpen={showEntryDialog}
          onClose={() => {
            setShowEntryDialog(false);
            setEntryAsset(null);
          }}
          onConfirm={async (entry: PositionEntry) => {
            try {
              const resp = await fetch('/api/paper-trading/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: entry.symbol,
                  side: entry.side === 'LONG' ? 'BUY' : 'SELL',
                  price: entry.entryPrice,
                  stopLoss: entry.stopLoss,
                  takeProfit: entry.takeProfit
                })
              });
              if (resp.ok) {
                const data = await resp.json();
                // Invalidate positions cache to trigger refetch
                queryClient.invalidateQueries({ queryKey: ['paper-trading-positions'] });
                setShowError(null);
                alert('Position opened (paper): ' + (data.tradeId || 'ok'));
              } else {
                const err = await resp.json().catch(() => ({}));
                setShowError('Failed to open position: ' + (err.message || resp.statusText));
              }
            } catch (err) {
              console.error('Failed to open paper position:', err);
              setShowError('Error opening position: ' + String(err));
            } finally {
              setShowEntryDialog(false);
              setEntryAsset(null);
            }
          }}
          asset={entryAsset}
          accountBalance={paperTradingMode.capital}
          side={entrySide}
        />
      )}

      {/* BOTTOM: Positions Table (Phase 1) */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
          <CardDescription>Current open trades</CardDescription>
        </CardHeader>
        <CardContent>
          {showError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{showError}</p>
              </div>
              <button 
                onClick={() => setShowError(null)}
                className="text-red-400 hover:text-red-300"
                title="Dismiss error message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {positionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <span className="ml-2 text-slate-400">Loading positions...</span>
            </div>
          ) : !positions || positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-sm">No active positions</div>
              <div className="text-xs text-slate-500 mt-2">Select an asset and click "Long Entry" or "Short Entry" to open a position</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Symbol</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Side</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Entry Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Current Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Size</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">PnL</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">PnL %</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Agent Signal</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const pnlColor = (position.pnl || 0) > 0 ? 'text-green-400' : (position.pnl || 0) < 0 ? 'text-red-400' : 'text-slate-400';
                    const sideColor = position.side === 'LONG' ? 'text-green-400' : 'text-red-400';
                    const entryTime = new Date(position.entryTime).toLocaleTimeString();
                    
                    return (
                      <tr key={position.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{position.symbol}</td>
                        <td className={`py-3 px-4 font-semibold ${sideColor}`}>{position.side}</td>
                        <td className="py-3 px-4 text-slate-300">${position.entryPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-300">${position.currentPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-300">{position.size}</td>
                        <td className={`py-3 px-4 font-semibold ${pnlColor}`}>
                          ${position.pnl?.toFixed(2) || '0.00'}
                        </td>
                        <td className={`py-3 px-4 font-semibold ${pnlColor}`}>
                          {(position.pnlPercent || 0) > 0 ? '+' : ''}{position.pnlPercent?.toFixed(2) || '0.00'}%
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {position.agentSignal || 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs"
                              title="Close position"
                              onClick={() => {
                                // TODO: Implement close position
                                alert('Close position: ' + position.symbol);
                              }}
                            >
                              Close
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-xs"
                              title="Edit stop loss and take profit"
                              onClick={() => {
                                // TODO: Implement edit SL/TP
                                alert('Edit SL/TP: ' + position.symbol);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-900 border-slate-700 w-full max-w-md max-h-96 overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Dashboard Settings
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Paper Trading Mode Toggle */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Paper Trading Mode</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={tempSettings.enabled}
                    onChange={(e) => setTempSettings({...tempSettings, enabled: e.target.checked})}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-600"
                    title="Toggle paper trading mode"
                  />
                  <span className={tempSettings.enabled ? 'text-green-400' : 'text-slate-400'}>
                    {tempSettings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Initial Capital */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Initial Capital ($)</label>
                <Input
                  type="number"
                  value={tempSettings.capital}
                  onChange={(e) => setTempSettings({...tempSettings, capital: parseFloat(e.target.value) || 10000})}
                  className="bg-slate-800 border-slate-600 text-white"
                  min="1000"
                  step="500"
                  placeholder="10000"
                  title="Enter initial capital amount"
                />
                <p className="text-xs text-slate-500 mt-1">Minimum: $1,000</p>
              </div>

              {/* Alert Preferences */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Alert Preferences</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-slate-800 border-slate-600" title="Enable high conviction alerts" />
                    <span className="text-sm text-slate-300">High Conviction Alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-slate-800 border-slate-600" title="Enable entry ready signals" />
                    <span className="text-sm text-slate-300">Entry Ready Signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-slate-800 border-slate-600" title="Enable liquidity warnings" />
                    <span className="text-sm text-slate-300">Liquidity Warnings</span>
                  </div>
                </div>
              </div>

              {/* Save Preferences */}
              <div className="border-t border-slate-700 pt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSettings(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setPaperTradingMode(tempSettings);
                    // Save to localStorage for persistence
                    localStorage.setItem('dashboard-settings', JSON.stringify(tempSettings));
                    setShowSettings(false);
                    alert('Settings saved successfully!');
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Asset Detail Modal */}
      {showAssetDetail && detailAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 sticky top-0 bg-slate-900 z-10">
              <div>
                <CardTitle className="text-2xl">{detailAsset.symbol}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className="text-white text-lg font-semibold">${detailAsset.price.toFixed(2)}</span>
                  <span className={detailAsset.priceChange > 0 ? 'text-green-400' : 'text-red-400'}>
                    {detailAsset.priceChange > 0 ? '+' : ''}{detailAsset.priceChange.toFixed(2)}%
                  </span>
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAssetDetail(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Consensus</div>
                  <div className={`text-lg font-bold ${getConsensusColor(detailAsset.consensusSignal)}`}>
                    {detailAsset.consensusSignal}
                  </div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Risk Level</div>
                  <Badge className={getRiskColor(detailAsset.riskScore)} variant="outline">
                    {detailAsset.riskScore}
                  </Badge>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Avg Confidence</div>
                  <div className="text-lg font-bold text-blue-400">{detailAsset.avgConfidence.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Volume</div>
                  <div className="text-lg font-bold text-purple-400">{(detailAsset.volume / 1e6).toFixed(1)}M</div>
                </div>
              </div>

              {/* Vote Distribution */}
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Agent Vote Distribution
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold">
                        <span className="text-green-400">Buy</span>: {detailAsset.buyAgents}/13 ({((detailAsset.buyAgents / 13) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 13 }).map((_, i) => (
                        <div 
                          key={`buy-${i}`}
                          className={`flex-1 h-2 rounded-sm ${i < detailAsset.buyAgents ? 'bg-green-500' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold">
                        <span className="text-yellow-400">Hold</span>: {detailAsset.holdAgents}/13 ({((detailAsset.holdAgents / 13) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 13 }).map((_, i) => (
                        <div 
                          key={`hold-${i}`}
                          className={`flex-1 h-2 rounded-sm ${i < detailAsset.holdAgents ? 'bg-yellow-500' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold">
                        <span className="text-red-400">Sell</span>: {detailAsset.sellAgents}/13 ({((detailAsset.sellAgents / 13) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 13 }).map((_, i) => (
                        <div 
                          key={`sell-${i}`}
                          className={`flex-1 h-2 rounded-sm ${i < detailAsset.sellAgents ? 'bg-red-500' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* All 13 Agent Signals */}
              <div>
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  13-Agent Analysis
                </div>
                <div className="space-y-3">
                  {detailAsset.signals.map((signal: AgentSignal, idx: number) => (
                    <div 
                      key={idx}
                      className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{AGENT_ICONS[signal.agentType]}</span>
                          <div>
                            <div className="font-semibold text-sm">{signal.agentName}</div>
                            <div className="text-xs text-slate-400">{signal.agentType}</div>
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            signal.signal === 'BUY' ? 'bg-green-500/20 text-green-400' :
                            signal.signal === 'SELL' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {signal.signal} ({signal.confidence.toFixed(0)}%)
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 mb-2">{signal.insights.primary}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Accuracy: {(signal.accuracy * 100).toFixed(1)}%</span>
                        <div className="flex gap-1">
                          {Object.entries(signal.insights.dataPoints).slice(0, 3).map(([key, val]) => (
                            <span key={key} className="text-slate-500">
                              {key}: <span className="text-slate-300">{typeof val === 'number' ? val.toFixed(2) : val}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entry Recommendations */}
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4 rounded-lg border border-blue-500/30">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  Entry/Exit Recommendations
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>Consensus Signal:</span>
                    <span className={`font-semibold ${getConsensusColor(detailAsset.consensusSignal)}`}>
                      {detailAsset.consensusSignal}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence Level:</span>
                    <span className="font-semibold text-blue-400">{detailAsset.avgConfidence.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suggested Entry:</span>
                    <span className="font-semibold text-green-400">${detailAsset.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Assessment:</span>
                    <Badge className={getRiskColor(detailAsset.riskScore)} variant="outline">
                      {detailAsset.riskScore}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setDetailAsset(null);
                    setShowAssetDetail(false);
                    setEntryAsset(detailAsset);
                    setEntrySide('LONG');
                    setShowEntryDialog(true);
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Long Entry
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setDetailAsset(null);
                    setShowAssetDetail(false);
                    setEntryAsset(detailAsset);
                    setEntrySide('SHORT');
                    setShowEntryDialog(true);
                  }}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Short Entry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAssetDetail(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Inspector Modal */}
      {showAgentInspector && selectedAgentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{AGENT_ICONS[selectedAgentDetail.agentType]}</span>
                <div>
                  <CardTitle className="text-2xl">{selectedAgentDetail.agentName}</CardTitle>
                  <CardDescription>{selectedAgentDetail.agentType}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAgentInspector(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Signal Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Current Signal</div>
                  <Badge 
                    className={`text-sm font-bold ${
                      selectedAgentDetail.signal === 'BUY' ? 'bg-green-500/30 text-green-400' :
                      selectedAgentDetail.signal === 'SELL' ? 'bg-red-500/30 text-red-400' :
                      'bg-yellow-500/30 text-yellow-400'
                    }`}
                  >
                    {selectedAgentDetail.signal}
                  </Badge>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Confidence</div>
                  <div className="text-2xl font-bold text-blue-400">{selectedAgentDetail.confidence.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Accuracy</div>
                  <div className="text-2xl font-bold text-purple-400">{(selectedAgentDetail.accuracy * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Primary Insight */}
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  Analysis
                </div>
                <p className="text-slate-300">{selectedAgentDetail.insights.primary}</p>
              </div>

              {/* Internal State - EMA, RSI, ATR, etc */}
              <div>
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Internal State & Indicators
                </div>
                <div className="space-y-3">
                  {Object.entries(selectedAgentDetail.insights.dataPoints || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-slate-800/30 rounded border border-slate-700/50">
                      <span className="text-sm text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-sm text-green-400">
                        {typeof value === 'number' ? value.toFixed(value < 100 ? 4 : 2) : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-3 rounded-lg border border-green-500/30">
                  <div className="text-xs text-green-400 mb-1">Win Rate</div>
                  <div className="text-lg font-bold text-green-300">{(selectedAgentDetail.accuracy * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3 rounded-lg border border-blue-500/30">
                  <div className="text-xs text-blue-400 mb-1">Signal Strength</div>
                  <div className="text-lg font-bold text-blue-300">{selectedAgentDetail.confidence.toFixed(1)}%</div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  Recommended Action
                </div>
                <div className={`text-sm p-2 rounded ${
                  selectedAgentDetail.signal === 'BUY' ? 'bg-green-500/20 text-green-300' :
                  selectedAgentDetail.signal === 'SELL' ? 'bg-red-500/20 text-red-300' :
                  'bg-yellow-500/20 text-yellow-300'
                }`}>
                  <strong>{selectedAgentDetail.signal} Signal</strong> - Based on {selectedAgentDetail.agentName} analysis with {selectedAgentDetail.confidence.toFixed(0)}% confidence. 
                  Consider entry/exit strategy accordingly.
                </div>
              </div>

              {/* Close Button */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAgentInspector(false)}
                >
                  Close Inspector
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    // Copy agent analysis to clipboard for sharing
                    const analysis = `${selectedAgentDetail.agentName} (${selectedAgentDetail.agentType})
Signal: ${selectedAgentDetail.signal} (${selectedAgentDetail.confidence.toFixed(1)}%)
Accuracy: ${(selectedAgentDetail.accuracy * 100).toFixed(1)}%
Analysis: ${selectedAgentDetail.insights.primary}`;
                    navigator.clipboard.writeText(analysis);
                    alert('Agent analysis copied to clipboard!');
                  }}
                >
                  Copy Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
