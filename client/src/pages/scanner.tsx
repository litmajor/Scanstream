import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw, Settings, Filter, Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Star, Download, BarChart3, Bell, BellOff, Calculator, Activity, Target, ChevronDown, ChevronUp, Grid3x3, List, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../lib/useWebSocket';
import { QuickScanButton } from '../components/QuickScanButton';
import { ScanProgress } from '../components/ScanProgress';
import { SymbolDetailModal } from '../components/SymbolDetailModal';

export default function ScannerPage() {
  const [, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    exchange: 'kucoinfutures',
    timeframe: 'medium',
    signal: 'all',
    minStrength: 0  // Changed from 50 to 0 to show all signals by default
  });
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [showPositionCalculator, setShowPositionCalculator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  
  // WebSocket for real-time scanner updates
  const [realTimeSignals, setRealTimeSignals] = useState<any[]>([]);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  
  // Load cached FastScanner results on mount
  useEffect(() => {
    const loadCachedResults = async () => {
      try {
        console.log('[Scanner] Fetching cached results from /api/scanner/results');
        const response = await fetch('/api/scanner/results');
        console.log('[Scanner] Response status:', response.status, response.ok);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Scanner] Received cached data:', data);
          
          if (data.success && data.signals && data.signals.length > 0) {
            console.log('[Scanner] ✅ Loaded', data.signals.length, 'cached FastScanner signals');
            setRealTimeSignals(data.signals);
            setLastScanTime(data.status?.lastScan?.timestamp ? new Date(data.status.lastScan.timestamp) : new Date());
          } else {
            console.log('[Scanner] ⚠️ No cached signals available yet');
          }
        } else {
          console.error('[Scanner] ❌ Failed to fetch cached results:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('[Scanner] ❌ Error loading cached results:', error);
      }
    };
    
    loadCachedResults();
  }, []);
  const [scanProgress, setScanProgress] = useState<{ total: number; remaining: number } | null>(null);
  const [selectedSymbolDetail, setSelectedSymbolDetail] = useState<any | null>(null);
  
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const { isConnected, lastMessage, send } = useWebSocket(wsUrl);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'quickScanComplete':
        console.log('[Scanner] Quick scan complete:', lastMessage.data);
        setRealTimeSignals(lastMessage.data.signals || []);
        setIsScanning(false);
        if (lastMessage.data.signals?.length > 0) {
          setScanProgress({
            total: lastMessage.data.signals.length,
            remaining: lastMessage.data.signals.length
          });
        }
        break;

      case 'symbolAnalyzed':
        console.log('[Scanner] Symbol analyzed:', lastMessage.data.symbol);
        // Update specific signal with deep data
        setRealTimeSignals(prev => prev.map(signal =>
          signal.symbol === lastMessage.data.symbol
            ? { ...signal, ...lastMessage.data.signal }
            : signal
        ));
        // Update progress
        setScanProgress(prev => prev ? {
          ...prev,
          remaining: Math.max(0, prev.remaining - 1)
        } : null);
        break;

      case 'analysisProgress':
        setScanProgress(prev => prev ? {
          ...prev,
          remaining: lastMessage.data.remaining
        } : null);
        break;

      case 'deepAnalysisComplete':
        console.log('[Scanner] All analysis complete!');
        setScanProgress(null);
        break;

      case 'scanError':
        console.error('[Scanner] Scan error:', lastMessage.error);
        setIsScanning(false);
        break;
    }
  }, [lastMessage]);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('scanner-watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load watchlist:', e);
      }
    }
  }, []);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('scanner-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        setAlertsEnabled(true);
      }
    }
  };

  // Watchlist management functions
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const isInWatchlist = (symbol: string) => watchlist.includes(symbol);

  // Export to CSV function
  const exportToCSV = () => {
    if (!scannerData?.signals || scannerData.signals.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Symbol', 'Signal', 'Strength', 'Opportunity Score', 'Price', 'Change %',
      'RSI', 'MACD', 'Volume', 'Entry', 'Stop Loss', 'Take Profit', 'R:R',
      'Timeframe', 'Timestamp'
    ];

    const rows = scannerData.signals.map((signal: any) => [
      signal.symbol,
      signal.signal,
      signal.strength,
      signal.advanced?.opportunity_score || 0,
      signal.price,
      signal.change,
      signal.indicators.rsi,
      signal.indicators.macd,
      signal.volume,
      signal.risk_reward?.entry_price || signal.price,
      signal.risk_reward?.stop_loss || '',
      signal.risk_reward?.take_profit || '',
      signal.risk_reward?.risk_reward_ratio || '',
      signal.timeframe,
      new Date(signal.timestamp).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scanner-signals-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate position size for a signal
  const calculatePosition = async (signal: any) => {
    if (!signal.risk_reward) return null;
    
    try {
      const response = await fetch('/api/position/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountBalance,
          riskPerTrade,
          entryPrice: signal.risk_reward.entry_price,
          stopLoss: signal.risk_reward.stop_loss,
          leverage: 1,
          feeRate: 0.001
        }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to calculate position:', e);
    }
    return null;
  };

  // Fetch scanner data from API
  const { data: scannerData, isLoading, error, refetch } = useQuery({
    queryKey: ['scanner-data', selectedFilters],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          exchange: selectedFilters.exchange,
          timeframe: selectedFilters.timeframe === 'all' ? '1h' : selectedFilters.timeframe,
          signal: selectedFilters.signal,
          minStrength: selectedFilters.minStrength.toString()
        });
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`/api/scanner/signals?${params}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[Scanner] Received data:', data);
        
        // If empty signals, try CoinGecko as fallback
        if (!data.signals || data.signals.length === 0) {
          console.log('[Scanner] No scanner signals, trying CoinGecko fallback...');
          try {
            const coinGeckoResponse = await fetch('/api/coingecko/signals?limit=50');
            if (coinGeckoResponse.ok) {
              const coinGeckoData = await coinGeckoResponse.json();
              if (coinGeckoData.success && coinGeckoData.signals && coinGeckoData.signals.length > 0) {
                console.log('[Scanner] ✅ Loaded', coinGeckoData.signals.length, 'signals from CoinGecko');
                return coinGeckoData;
              }
            }
          } catch (err) {
            console.warn('[Scanner] CoinGecko fallback failed:', err);
          }
          
          // Still no data, return empty structure
          console.log('[Scanner] No signals available from any source');
          return {
            signals: [],
            filters: data.filters || mockScannerData.filters,
            metadata: data.metadata || { count: 0, message: 'No signals available. System is starting up...' }
          };
        }
        
        return data;
      } catch (err) {
        console.error('Failed to fetch scanner data:', err);
        // Return empty data structure instead of mock data
        return {
          signals: [],
          filters: {
            exchanges: ['kucoinfutures', 'binance', 'coinbase', 'kraken'],
            timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
            signals: ['BUY', 'SELL', 'HOLD'],
            minStrength: 0,
            maxStrength: 100
          },
          metadata: { count: 0, message: 'Click Scan to load signals' }
        };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
    retry: 2, // Only retry twice
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickScan = () => {
    if (!isConnected) {
      alert('WebSocket not connected. Please refresh the page.');
      return;
    }
    setIsScanning(true);
    setScanProgress(null);
    send({ type: 'requestQuickScan' });
  };

  // Save scan results to localStorage for Dashboard access
  useEffect(() => {
    if (displaySignals && displaySignals.length > 0) {
      localStorage.setItem('latestScanResults', JSON.stringify({
        signals: displaySignals.slice(0, 10), // Top 10 signals
        timestamp: new Date().toISOString()
      }));
    }
  }, [displaySignals]);

  // Separate live signals (FastScanner via WebSocket) from full scan signals (Python API)
  const liveSignals = realTimeSignals || []; // FastScanner signals via WebSocket
  const fullScanSignals = scannerData?.signals || []; // Python scanner full scan results
  
  // Display both - prioritize live signals if available, otherwise show full scan
  const displaySignals = (liveSignals && liveSignals.length > 0) ? liveSignals : fullScanSignals;
  
  // Debug logging
  useEffect(() => {
    console.log('[Scanner] Display state:', {
      liveSignalsCount: liveSignals?.length || 0,
      fullScanSignalsCount: fullScanSignals?.length || 0,
      displaySignalsCount: displaySignals?.length || 0
    });
  }, [liveSignals, fullScanSignals, displaySignals]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeframe: selectedFilters.timeframe === 'all' ? 'medium' : selectedFilters.timeframe,
          exchange: selectedFilters.exchange,
          signal: selectedFilters.signal,
          minStrength: selectedFilters.minStrength,
          fullAnalysis: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }

      // After successful scan, refetch the data
      await refetch();
    } catch (err) {
      console.error('Scan error:', err);
      alert('Failed to trigger scan. Please ensure the scanner service is running.');
    } finally {
      setIsScanning(false);
    }
  };

  // Check for high-opportunity signals and send notifications
  useEffect(() => {
    if (!alertsEnabled || !scannerData?.signals) return;

    scannerData.signals.forEach((signal: any) => {
      const opportunityScore = signal.advanced?.opportunity_score || 0;
      if (opportunityScore >= alertThreshold && Notification.permission === 'granted') {
        new Notification('🎯 Excellent Trading Opportunity!', {
          body: `${signal.symbol}: ${opportunityScore}/100 opportunity score\nSignal: ${signal.signal} | R:R: ${signal.risk_reward?.risk_reward_ratio || 'N/A'}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: signal.symbol,  // Prevents duplicate notifications for same symbol
          requireInteraction: true
        });
      }
    });
  }, [scannerData, alertsEnabled, alertThreshold]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'SELL': return 'text-red-500 bg-red-100 dark:bg-red-900';
      case 'HOLD': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'text-green-500';
    if (strength >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getOpportunityGrade = (score: number) => {
    if (score >= 90) return { grade: 'S', color: 'from-purple-500 to-pink-500', text: 'text-purple-400' };
    if (score >= 80) return { grade: 'A+', color: 'from-green-500 to-emerald-500', text: 'text-green-400' };
    if (score >= 70) return { grade: 'A', color: 'from-green-500 to-teal-500', text: 'text-green-400' };
    if (score >= 60) return { grade: 'B', color: 'from-yellow-500 to-orange-500', text: 'text-yellow-400' };
    return { grade: 'C', color: 'from-orange-500 to-red-500', text: 'text-orange-400' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading scanner signals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Scanner</h2>
          <p className="text-slate-400 mb-4">Failed to load scanner signals</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setLocation('/')}
                className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                <span className="font-medium">Dashboard</span>
              </button>
              <div className="h-6 w-px bg-slate-700"></div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Signal Scanner
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Real-time market opportunities</p>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grid View"
                  aria-label="Switch to grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'compact' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compact View"
                  aria-label="Switch to compact view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all flex items-center space-x-2 text-slate-300 hover:text-white"
              >
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filters</span>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                className={`px-4 py-2.5 rounded-lg transition-all flex items-center space-x-2 font-medium ${
                  showWatchlistOnly 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 text-yellow-400' 
                    : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white'
                }`}
                title={showWatchlistOnly ? 'Show All Signals' : 'Show Watchlist Only'}
                aria-label={showWatchlistOnly ? 'Show all signals' : 'Show watchlist only'}
              >
                <Star className={`w-4 h-4 ${showWatchlistOnly ? 'fill-current' : ''}`} />
                <span>{watchlist.length}</span>
              </button>

              <button
                onClick={() => {
                  if (!notificationPermission || notificationPermission === 'default') {
                    requestNotificationPermission();
                  } else {
                    setAlertsEnabled(!alertsEnabled);
                  }
                }}
                className={`p-2.5 rounded-lg transition-all ${
                  alertsEnabled 
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 text-green-400' 
                    : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white'
                }`}
                title={alertsEnabled ? 'Disable Alerts' : 'Enable Alerts'}
                aria-label={alertsEnabled ? 'Disable alerts' : 'Enable alerts'}
              >
                {alertsEnabled ? <Bell className="w-4 h-4 fill-current" /> : <BellOff className="w-4 h-4" />}
              </button>

              <button
                onClick={exportToCSV}
                disabled={!scannerData?.signals || scannerData.signals.length === 0}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export to CSV"
                aria-label="Export signals to CSV"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={handleQuickScan}
                disabled={isScanning}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all flex items-center space-x-2 text-white font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl backdrop-blur-sm">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Exchange</label>
                  <select 
                    value={selectedFilters.exchange}
                    onChange={(e) => setSelectedFilters(prev => ({ ...prev, exchange: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    aria-label="Exchange filter"
                  >
                    <option value="all">All Exchanges</option>
                    {scannerData?.filters.exchanges.map((exchange: string) => (
                      <option key={exchange} value={exchange}>{exchange}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Timeframe</label>
                  <select 
                    value={selectedFilters.timeframe}
                    onChange={(e) => setSelectedFilters(prev => ({ ...prev, timeframe: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    aria-label="Timeframe filter"
                  >
                    <option value="scalping">1m - Scalping</option>
                    <option value="short">5m - Short</option>
                    <option value="medium">1h - Medium</option>
                    <option value="daily">1d - Daily</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Signal</label>
                  <select 
                    value={selectedFilters.signal}
                    onChange={(e) => setSelectedFilters(prev => ({ ...prev, signal: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    aria-label="Signal type filter"
                  >
                    <option value="all">All Signals</option>
                    {scannerData?.filters.signals.map((signal: string) => (
                      <option key={signal} value={signal}>{signal}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Min Strength: {selectedFilters.minStrength}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedFilters.minStrength}
                    onChange={(e) => setSelectedFilters(prev => ({ ...prev, minStrength: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    aria-label="Minimum signal strength filter"
                    title="Minimum signal strength"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-[1800px] mx-auto px-6 py-6">
        {/* Scan Progress */}
        {scanProgress && scanProgress.remaining > 0 && (
          <div className="mb-6">
            <ScanProgress total={scanProgress.total} remaining={scanProgress.remaining} />
          </div>
        )}

        {/* WebSocket Status */}
        {!isConnected && (
          <div className="mb-4 bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-yellow-200">
              ⚠️ WebSocket disconnected. Real-time updates unavailable.
            </p>
          </div>
        )}

        {/* Signal Source Indicator */}
        {liveSignals.length > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Zap className="w-5 h-5 text-green-400" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <span className="font-semibold text-green-400">Live Scanner Active</span>
            </div>
            <div className="h-4 w-px bg-green-500/30"></div>
            <span className="text-sm text-slate-300">
              {liveSignals.length} signals cached
            </span>
            {lastScanTime && (
              <>
                <div className="h-4 w-px bg-green-500/30"></div>
                <span className="text-sm text-slate-400">
                  Last scan: {lastScanTime.toLocaleTimeString()}
                </span>
              </>
            )}
            {scanProgress && (
              <>
                <div className="h-4 w-px bg-green-500/30"></div>
                <span className="text-sm text-slate-400">
                  Deep analysis: {scanProgress.total - scanProgress.remaining}/{scanProgress.total}
                </span>
              </>
            )}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Active Signals</p>
                <p className="text-2xl font-bold text-white">{displaySignals.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Avg Strength</p>
                <p className="text-2xl font-bold text-white">
                  {displaySignals.length > 0 ? Math.round(displaySignals.reduce((acc: number, s: any) => acc + s.strength, 0) / displaySignals.length) : 0}%
                </p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Watchlist</p>
                <p className="text-2xl font-bold text-white">{watchlist.length}</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">High Quality</p>
                <p className="text-2xl font-bold text-white">
                  {displaySignals.filter((s: any) => (s.advanced?.opportunity_score || 0) >= 80).length}
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Signals Grid */}
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4' 
          : 'space-y-3'
        }>
          {(displaySignals || [])
            .filter((signal: any) => signal && signal.symbol && (!showWatchlistOnly || isInWatchlist(signal.symbol)))
            .map((signal: any) => {
              // Safety check - ensure signal has required properties
              if (!signal || !signal.symbol || !signal.price) {
                console.warn('[Scanner] Invalid signal data:', signal);
                return null;
              }
              
              // Log the first signal to debug structure
              if (displaySignals.indexOf(signal) === 0) {
                console.log('[Scanner] First signal structure:', {
                  symbol: signal.symbol,
                  price: signal.price,
                  hasChange: 'change' in signal,
                  hasChange24h: 'change24h' in signal,
                  hasVolume: 'volume' in signal,
                  hasIndicators: 'indicators' in signal,
                  hasRsi: 'rsi' in signal,
                  hasMacd: 'macd' in signal,
                  hasSignal: 'signal' in signal,
                  hasStrength: 'strength' in signal,
                  hasTimeframe: 'timeframe' in signal,
                  hasExchange: 'exchange' in signal,
                  allKeys: Object.keys(signal)
                });
              }
              
              const opportunityGrade = getOpportunityGrade(signal.advanced?.opportunity_score || signal.strength || 0);
              
              // Wrap in try-catch to prevent crashes
              try {
                // Compact View
                if (viewMode === 'compact') {
                  return (
                    <div
                    key={signal.id || signal.symbol}
                    className="group bg-gradient-to-r from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 rounded-lg p-4 transition-all hover:shadow-lg hover:shadow-blue-500/5"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Symbol Info */}
                      <div className="flex items-center space-x-4 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(signal.symbol);
                          }}
                          className={`transition-all ${
                            watchlist.includes(signal.symbol)
                              ? 'text-yellow-400'
                              : 'text-slate-600 hover:text-yellow-400'
                          }`}
                          title={watchlist.includes(signal.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                          aria-label={watchlist.includes(signal.symbol) ? `Remove ${signal.symbol} from watchlist` : `Add ${signal.symbol} to watchlist`}
                        >
                          <Star className={`w-4 h-4 ${watchlist.includes(signal.symbol) ? 'fill-current' : ''}`} />
                        </button>
                        
                        <div className="min-w-[140px]">
                          <h3 className="text-base font-bold text-white">{signal.symbol}</h3>
                          <p className="text-xs text-slate-500">{signal.exchange} • {signal.timeframe}</p>
                        </div>

                        {/* Grade Badge */}
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${opportunityGrade.color} flex items-center justify-center shadow-md`}>
                          <span className="text-sm font-black text-white">{opportunityGrade.grade}</span>
                        </div>

                        {/* Signal Type */}
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          signal.signal === 'BUY' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {signal.signal}
                        </div>
                      </div>

                      {/* Middle: Price & Change */}
                      <div className="flex items-center space-x-8 flex-1 justify-center">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Price</p>
                          <p className="text-lg font-bold text-white">
                            ${signal.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500 mb-1">Change</p>
                          <span className={`flex items-center text-sm font-bold ${
                            (signal.change || signal.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {(signal.change || signal.change24h || 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {(signal.change || signal.change24h || 0) >= 0 ? '+' : ''}{(signal.change || signal.change24h || 0).toFixed(2)}%
                          </span>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500 mb-1">Strength</p>
                          <p className={`text-lg font-bold ${opportunityGrade.text}`}>{signal.strength || 0}%</p>
                        </div>
                      </div>

                      {/* Right: Indicators & Actions */}
                      <div className="flex items-center space-x-6">
                        <div className="flex space-x-3">
                          <div className="text-center">
                            <p className="text-xs text-slate-500 mb-1">RSI</p>
                            <p className={`text-sm font-bold ${
                              (signal.indicators?.rsi || signal.rsi || 50) < 30 ? 'text-green-400' :
                              (signal.indicators?.rsi || signal.rsi || 50) > 70 ? 'text-red-400' : 'text-slate-300'
                            }`}>
                              {signal.indicators?.rsi || signal.rsi || 'N/A'}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500 mb-1">R:R</p>
                            <p className={`text-sm font-bold ${
                              (signal.risk_reward?.risk_reward_ratio || 0) >= 2.5 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                              {(signal.risk_reward?.risk_reward_ratio || 0).toFixed(1)}
                            </p>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://www.tradingview.com/chart/?symbol=${signal.exchange.toUpperCase()}:${signal.symbol.replace('/', '')}`, '_blank');
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-blue-500/20"
                          >
                            Chart
                          </button>
                          <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-green-500/20">
                            Trade
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Grid View
              return (
                <div
                  key={signal.id || signal.symbol}
                  className="group bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer"
                  onClick={() => setSelectedSymbolDetail(signal)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSymbolDetail(signal)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-700/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(signal.symbol);
                          }}
                          className={`transition-all ${
                            watchlist.includes(signal.symbol)
                              ? 'text-yellow-400 scale-110'
                              : 'text-slate-600 hover:text-yellow-400 hover:scale-110'
                          }`}
                          title={watchlist.includes(signal.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                          aria-label={watchlist.includes(signal.symbol) ? `Remove ${signal.symbol} from watchlist` : `Add ${signal.symbol} to watchlist`}
                        >
                          <Star className={`w-5 h-5 ${watchlist.includes(signal.symbol) ? 'fill-current' : ''}`} />
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-white">{signal.symbol}</h3>
                          <p className="text-xs text-slate-500">{signal.exchange} • {signal.timeframe}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {liveSignals.length > 0 && liveSignals.includes(signal) && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/30">
                            <Zap className="w-3 h-3" />
                            LIVE
                          </div>
                        )}
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          signal.signal === 'BUY' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {signal.signal}
                        </div>
                      </div>
                    </div>

                    {/* Price & Change */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-white">
                          ${signal.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`flex items-center text-sm font-semibold ${
                            (signal.change || signal.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {(signal.change || signal.change24h || 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {(signal.change || signal.change24h || 0) >= 0 ? '+' : ''}{(signal.change || signal.change24h || 0).toFixed(2)}%
                          </span>
                          <span className="text-xs text-slate-500">
                            Vol: {signal.volume ? (signal.volume / 1000000).toFixed(0) : '0'}M
                          </span>
                        </div>
                      </div>

                      {/* Opportunity Grade Badge */}
                      <div className="text-center">
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${opportunityGrade.color} flex items-center justify-center shadow-lg`}>
                          <span className="text-2xl font-black text-white">{opportunityGrade.grade}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{signal.advanced?.opportunity_score || signal.strength}/100</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    {/* Signal Strength Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Signal Strength</span>
                        <span className={`text-sm font-bold ${opportunityGrade.text}`}>{signal.strength}%</span>
                      </div>
                      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${opportunityGrade.color} transition-all duration-500`}
                          style={{ width: `${signal.strength}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Market Regime */}
                    {signal.market_regime && (
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            signal.market_regime.regime === 'bull' ? 'bg-green-400' : 'bg-red-400'
                          } animate-pulse`}></div>
                          <span className="text-xs text-slate-400">Market Regime</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-bold ${
                            signal.market_regime.regime === 'bull' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {signal.market_regime.regime.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500">{signal.market_regime.confidence}%</span>
                          <span className="text-sm">
                            {signal.market_regime.volatility === 'high' ? '🔥' : signal.market_regime.volatility === 'medium' ? '📊' : '😴'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Indicators Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <p className="text-xs text-slate-500 mb-1">RSI</p>
                        <p className={`text-sm font-bold ${
                          (signal.indicators?.rsi || signal.rsi || 50) < 30 ? 'text-green-400' :
                          (signal.indicators?.rsi || signal.rsi || 50) > 70 ? 'text-red-400' : 'text-slate-300'
                        }`}>
                          {signal.indicators?.rsi || signal.rsi || 'N/A'}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <p className="text-xs text-slate-500 mb-1">MACD</p>
                        <p className={`text-sm font-bold capitalize ${
                          (signal.indicators?.macd || signal.macd || 'neutral') === 'bullish' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.indicators?.macd || signal.macd || 'N/A'}
                        </p>
                      </div>
                      {signal.advanced?.bb_position !== undefined && (
                        <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                          <p className="text-xs text-slate-500 mb-1">BB Position</p>
                          <p className={`text-sm font-bold ${
                            signal.advanced.bb_position < 0.3 ? 'text-green-400' :
                            signal.advanced.bb_position > 0.7 ? 'text-red-400' : 'text-slate-300'
                          }`}>
                            {(signal.advanced.bb_position * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                      <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <p className="text-xs text-slate-500 mb-1">Volume</p>
                        <p className="text-sm font-bold text-slate-300 capitalize">
                          {signal.indicators?.volume ? signal.indicators.volume.replace('_', ' ') : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Risk/Reward Section */}
                    {signal.risk_reward && signal.risk_reward.stop_loss && (
                      <div className="p-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg border border-slate-700/30">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-slate-400">Trade Plan</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            signal.risk_reward.risk_reward_ratio >= 2.5 
                              ? 'bg-green-500/20 text-green-400' 
                              : signal.risk_reward.risk_reward_ratio >= 1.5
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            R:R {signal.risk_reward.risk_reward_ratio.toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-xs text-slate-500 mb-1">Entry</p>
                            <p className="text-sm font-bold text-blue-400">
                              ${signal.risk_reward.entry_price.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500 mb-1">Stop Loss</p>
                            <p className="text-sm font-bold text-red-400">
                              ${signal.risk_reward.stop_loss.toLocaleString()}
                            </p>
                            <p className="text-xs text-red-400/60">{signal.risk_reward.stop_loss_pct.toFixed(2)}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500 mb-1">Target</p>
                            <p className="text-sm font-bold text-green-400">
                              ${signal.risk_reward.take_profit.toLocaleString()}
                            </p>
                            <p className="text-xs text-green-400/60">+{signal.risk_reward.take_profit_pct.toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://www.tradingview.com/chart/?symbol=${signal.exchange.toUpperCase()}:${signal.symbol.replace('/', '')}`, '_blank');
                        }}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Chart</span>
                      </button>
                      <button className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20">
                        <Zap className="w-4 h-4" />
                        <span>Trade</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
              } catch (error) {
                console.error('[Scanner] Error rendering signal:', signal.symbol, error);
                console.error('[Scanner] Signal data:', signal);
                return null;
              }
            })}
        </div>

        {/* Empty State */}
        {(!displaySignals || displaySignals.length === 0) && !isLoading && (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
              <Search className="w-16 h-16 text-slate-600 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Trading Signals Available</h3>
            <p className="text-slate-500 mb-6">
              {scannerData?.metadata?.message || 'The FastScanner runs automatically every 15 minutes. Click "Scan Market" to run a full scan now, or wait for the next automatic scan.'}
            </p>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Scan Market Now'}
            </button>
          </div>
        )}
      </div>

      {/* Symbol Detail Modal */}
      {selectedSymbolDetail && (
        <SymbolDetailModal
          signal={selectedSymbolDetail}
          onClose={() => setSelectedSymbolDetail(null)}
        />
      )}
    </div>
  );
}
