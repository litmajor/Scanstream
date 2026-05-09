import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw, Settings, Filter, Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Star, Download, BarChart3, Bell, BellOff, Calculator, Activity, Target, ChevronDown, ChevronUp, ChevronRight, Grid3x3, List, Zap } from 'lucide-react';
import { useSymbolUniverse } from '../hooks/useSymbolUniverse';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../lib/useWebSocket';
// Removed: import { QuickScanButton } from '../components/QuickScanButton';
import { ScanProgress } from '../components/ScanProgress';
import { SymbolDetailModal } from '../components/SymbolDetailModal';
import { FlowMetricsPanel } from '../components/FlowMetricsPanel';
import { SignalFilters } from '../components/SignalFilters'; // Import SignalFilters component
import ScannerAgentAnalysis from '../components/ScannerAgentAnalysis'; // Import new component
import EntryDialog, { PositionEntry } from '../components/EntryDialog';
import { StrategyPanel } from '../components/StrategyPanel'; // Import new strategy panel component

// NEW: Import ARM scanner components and services
import { scannerService, ScanRequest, MultiExchangeScanResponse } from '../services/scannerService';
import TopAssetsCard from '../components/TopAssetsCard';
import CrossExchangeSignalsPanel from '../components/CrossExchangeSignalsPanel';
import SignalDistributionChart from '../components/SignalDistributionChart';
import HistoricalTrendChart from '../components/HistoricalTrendChart';

// Types for scanner data
interface ScannerSignal {
  id?: string;
  symbol: string;
  name?: string;
  price?: number;
  // Price / volume / change (both common variants used in different APIs)
  change?: number;
  change24h?: number;
  volume?: number;
  volume24h?: number;
  marketCap?: number;
  market_cap?: number;
  exchange?: string;
  timeframe?: string;
  // Convenience / alternative pricing fields
  currentPrice?: number;
  signal?: string;
  strength?: number;
  relationships?: any[];
  market_regime?: any;
  advanced?: any;
  indicators?: any;
  rsi?: number | string;
  macd?: string | { signal?: string };
  orderFlow?: any;
  marketMicrostructure?: any;
  risk_reward?: any;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  consensus?: any;
  agentConsensus?: any;
}

interface ScannerResponse {
  signals: ScannerSignal[];
  filters?: any;
  metadata?: any;
}

export default function ScannerPage() {
  const [, setLocation] = useLocation();
  const { symbols: universeSymbols } = useSymbolUniverse();
  
  // UI State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [showPositionCalculator, setShowPositionCalculator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [selectedScanResult, setSelectedScanResult] = useState<any | null>(null);
  const [showAgentAnalysisDialog, setShowAgentAnalysisDialog] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showTopSignals, setShowTopSignals] = useState(false);
  const [selectedSymbolDetail, setSelectedSymbolDetail] = useState<any | null>(null);
  
  // Trading State
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [entryAsset, setEntryAsset] = useState<any | null>(null);
  const [entrySide, setEntrySide] = useState<'LONG' | 'SHORT'>('LONG');
  
  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runAnalysisLoading, setRunAnalysisLoading] = useState(false);
  const [runAnalysisResults, setRunAnalysisResults] = useState<any | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string>('kucoinfutures');
  const [allExchangeSignals, setAllExchangeSignals] = useState<Map<string, any[]>>(new Map());
  const [selectedFilters, setSelectedFilters] = useState({
    exchange: 'kucoinfutures',
    timeframe: 'all',
    signal: 'all',
    minStrength: 0
  });

  // Filter state for the new SignalFilters component
  const [filters, setFilters] = useState({
    signalType: 'all',
    minConfidence: 0,
    trendDirection: 'all'
  });

  // WebSocket for real-time scanner updates
  const [realTimeSignals, setRealTimeSignals] = useState<any[]>([]);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [apiHealthy, setApiHealthy] = useState(true);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  
  // Watchlist and UI toggles
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  
  // Alerts
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number>(80);
  const [scanProgress, setScanProgress] = useState<{ total: number; remaining: number } | null>(null);

  // NEW: ARM Multi-Exchange Scanner State
  const [showArmScanner, setShowArmScanner] = useState(false);
  const [armScanLoading, setArmScanLoading] = useState(false);
  const [armScanResults, setArmScanResults] = useState<MultiExchangeScanResponse | null>(null);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['binance', 'coinbase', 'okx']);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  const [scannerServiceError, setScannerServiceError] = useState<string | null>(null);
  const [showHistoricalChart, setShowHistoricalChart] = useState(false);

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

  // Check Scanner API health periodically
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch('/api/scanner/status', { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          setApiHealthy(true);
          setScannerInitialized(data.scanner_initialized || false);
          console.log('[Scanner] API healthy, initialized:', data.scanner_initialized);
        } else {
          setApiHealthy(false);
          console.warn('[Scanner] API returned status:', response.status);
        }
      } catch (error) {
        setApiHealthy(false);
        console.warn('[Scanner] API health check failed:', error);
      }
    };

    // Check immediately
    checkApiHealth();

    // Then check every 10 seconds
    const interval = setInterval(checkApiHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/socket.io/?transport=websocket&v=${Date.now()}`;
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

  // Subscribe to symbol-specific WS messages when opening Agent Analysis
  useEffect(() => {
    if (!selectedScanResult) return;
    const symbol = selectedScanResult.symbol;
    if (!symbol) return;

    try {
      // Request subscription via WebSocket
      send({ type: 'subscribe', symbols: [symbol] });
      console.log('[Scanner] Subscribed to symbol via WS:', symbol);
    } catch (err) {
      console.warn('[Scanner] WS subscribe failed:', err);
    }

    return () => {
      try {
        send({ type: 'unsubscribe', symbols: [symbol] });
        console.log('[Scanner] Unsubscribed from symbol via WS:', symbol);
      } catch (err) {
        // ignore
      }
    };
  }, [selectedScanResult, send]);

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
  const { data: scannerData, isLoading, error, refetch } = useQuery<ScannerResponse, Error>({
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
            // This endpoint should now return all available CoinGecko data
            const coinGeckoResponse = await fetch('/api/coingecko/all');
            if (coinGeckoResponse.ok) {
              const coinGeckoData = await coinGeckoResponse.json();
              if (coinGeckoData.success && coinGeckoData.data && coinGeckoData.data.length > 0) {
                console.log('[Scanner] ✅ Loaded', coinGeckoData.data.length, 'assets from CoinGecko');
                // Map CoinGecko data to a structure similar to scanner signals for display
                const mappedSignals = coinGeckoData.data.map((asset: any) => ({
                  symbol: asset.symbol.toUpperCase(),
                  name: asset.name,
                  price: asset.current_price,
                  change24h: asset.price_change_percentage_24h,
                  volume24h: asset.total_volume,
                  marketCap: asset.market_cap,
                  exchange: 'CoinGecko', // Indicate source
                  timeframe: '24h', // Default timeframe for CoinGecko data
                  signal: asset.trend || 'NEUTRAL', // Add a basic signal based on trend if available
                  strength: Math.abs(asset.price_change_percentage_24h) > 5 ? Math.min(100, Math.abs(asset.price_change_percentage_24h) * 2) : 0, // Example strength calculation
                  // Include relationship data if available from CoinGecko or a secondary source
                  relationships: asset.related_coins || [], // Assuming CoinGecko might provide this
                  // Add custom analysis reports like regime
                  market_regime: {
                    regime: asset.market_regime?.regime || 'neutral',
                    confidence: asset.market_regime?.confidence || 50,
                    volatility: asset.market_regime?.volatility || 'medium'
                  },
                  advanced: {
                    opportunity_score: asset.coingecko_rank < 50 ? 90 : asset.coingecko_rank < 200 ? 75 : 60 // Example score based on rank
                  }
                }));
                return {
                  signals: mappedSignals,
                  filters: { // Mock filters if not provided by the API
                    exchanges: ['CoinGecko'],
                    timeframes: ['24h'],
                    signals: ['BUY', 'SELL', 'NEUTRAL', 'UP', 'DOWN'],
                    minStrength: 0,
                    maxStrength: 100
                  },
                  metadata: { count: mappedSignals.length, message: 'Displaying CoinGecko data' }
                };
              }
            }
          } catch (err) {
            console.warn('[Scanner] CoinGecko fallback failed:', err);
          }

          // Still no data, return empty structure (no mock fallbacks)
          console.log('[Scanner] No signals available from any source');
          return {
            signals: [],
            filters: data.filters || {
              exchanges: [],
              timeframes: [],
              signals: [],
              minStrength: 0,
              maxStrength: 100
            },
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

  // Removed handleQuickScan as QuickScanButton is removed
  // const handleQuickScan = () => {
  //   if (!isConnected) {
  //     alert('WebSocket not connected. Please refresh the page.');
  //     return;
  //   }
  //   setIsScanning(true);
  //   setScanProgress(null);
  //   send({ type: 'requestQuickScan' });
  // };

  // Separate live signals (FastScanner via WebSocket) from full scan signals (Python API)
  const liveSignals = realTimeSignals || []; // FastScanner signals via WebSocket
  const fullScanSignals = scannerData?.signals || []; // Python scanner full scan results

  // Display both - prioritize live signals if available, otherwise show full scan
  let displaySignals = (liveSignals && liveSignals.length > 0) ? liveSignals : fullScanSignals;

  // Apply filters to displaySignals
  if (filters.signalType !== 'all') {
    displaySignals = displaySignals.filter(s => s.signal === filters.signalType);
  }
  if (filters.minConfidence > 0) {
    displaySignals = displaySignals.filter((s: ScannerSignal) => (s.strength ?? 0) >= filters.minConfidence);
  }
  if (filters.trendDirection !== 'all') {
    displaySignals = displaySignals.filter(s => 
      (s as any).trendDirection?.toLowerCase().includes(filters.trendDirection) ||
      (s as any).trend === filters.trendDirection
    );
  }

  // Save scan results to localStorage for Dashboard access
  useEffect(() => {
    if (displaySignals && displaySignals.length > 0) {
      localStorage.setItem('latestScanResults', JSON.stringify({
        signals: displaySignals.slice(0, 10), // Top 10 signals
        timestamp: new Date().toISOString()
      }));
    }
  }, [displaySignals]);

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
          exchange: selectedExchange,
          signal: selectedFilters.signal,
          minStrength: selectedFilters.minStrength,
          fullAnalysis: true
        }),
      });

      if (response.status === 202) {
        const data = await response.json();
        console.log('✅ Scan queued in background:', data);
        alert(`✅ Scan Accepted!\n\n${data.message}\n\nMode: ${data.mode}\nExchanges: ${data.exchanges.join(', ')}\n\nThe scan is running in the background. Results will appear in the data grid as they complete.`);
        
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          if (pollCount > 60) {
            clearInterval(pollInterval);
            setIsScanning(false);
            alert('⏰ Scan polling timeout. Check results manually.');
            return;
          }
          
          try {
            const statusResponse = await fetch('/api/scanner/status');
            const status = await statusResponse.json();
            console.log(`[Scan Poll ${pollCount}] Status:`, status);
            
            if (status.last_scan) {
              console.log('📊 Scan results available, refreshing data...');
              await refetch();
              clearInterval(pollInterval);
              setIsScanning(false);
              console.log('✅ Scan complete and results loaded');
            }
          } catch (pollErr) {
            console.error('Poll error:', pollErr);
          }
        }, 5000);
        
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Scan failed: ${response.statusText}`);
      }

      const data = await response.json();
      setAllExchangeSignals(prev => {
        const updated = new Map(prev);
        updated.set(selectedExchange, data.signals || []);
        return updated;
      });
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Scan error:', err);
      alert(`❌ Failed to trigger scan: ${errorMessage}`);
    } finally {
      setIsScanning(false);
    }
  };

  // NEW: Handle Multi-Exchange ARM Scan
  const handleArmMultiExchangeScan = async () => {
    setArmScanLoading(true);
    setScannerServiceError(null);

    try {
      console.log('🚀 Starting ARM multi-exchange scan:', {
        symbols: selectedSymbols,
        exchanges: selectedExchanges
      });

      const scanRequest: ScanRequest = {
        symbols: selectedSymbols.length > 0 ? selectedSymbols : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        exchanges: selectedExchanges.length > 0 ? selectedExchanges : ['binance', 'coinbase', 'okx'],
        options: {
          timeframe: '1h',
          limit: 100,
          minVolume: 100000
        }
      };

      const results = await scannerService.multiExchangeScan(scanRequest) as MultiExchangeScanResponse;
      console.log('✅ ARM scan complete:', results);

      setArmScanResults(results);
      
      // Auto-play historical chart to demonstrate signal trends
      if (results.topAssets && results.topAssets.length > 0) {
        setShowHistoricalChart(true);
      }

      // Show success message
      alert(`✅ Multi-Exchange Scan Complete!\n\nFound ${results.totalResults} total results across ${results.exchanges?.length || 0} exchanges\n\nTop Asset: ${results.topAssets[0]?.symbol || 'N/A'}\nCross-Exchange Signals: ${results.crossExchangeSignals.length}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ ARM scan error:', error);
      setScannerServiceError(errorMessage);
      alert(`❌ Multi-Exchange Scan Failed: ${errorMessage}`);
    } finally {
      setArmScanLoading(false);
    }
  };

  // Run analysis on current signals
  const handleRunAnalysis = async () => {
    setRunAnalysisLoading(true);
    try {
      const body = {
        symbols: displaySignals.slice(0, 50).map((s: any) => s.symbol), // default to currently displayed symbols
        timeframe: selectedFilters.timeframe === 'all' ? '1h' : selectedFilters.timeframe
      };

      const resp = await fetch('/api/scanner/run-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Run analysis failed (${resp.status})`);
      }

      const data = await resp.json();
      if (data && data.success) {
        setRunAnalysisResults(data);
        // Use enriched results as primary display for immediate action
        if (data.results && Array.isArray(data.results)) {
          setRealTimeSignals(data.results);
        }
        setLastScanTime(data.timestamp ? new Date(data.timestamp) : new Date());
        // Persist to localStorage as before
        localStorage.setItem('latestScanResults', JSON.stringify({ signals: (data.results || []).slice(0, 10), timestamp: data.timestamp || new Date().toISOString() }));
      } else {
        throw new Error(data?.error || 'Run analysis returned no data');
      }
    } catch (err) {
      console.error('Run analysis error:', err);
      alert(`❌ Run Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRunAnalysisLoading(false);
    }
  };

  // NEW: Parallel scan multiple exchanges
  const handleParallelScan = async () => {
    const exchanges = ['binance', 'okx', 'bybit', 'kucoinfutures'];
    setIsScanning(true);

    try {
      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchanges, // Array = parallel mode
          timeframe: selectedFilters.timeframe === 'all' ? 'medium' : selectedFilters.timeframe,
          signal: selectedFilters.signal,
          minStrength: selectedFilters.minStrength,
          fullAnalysis: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Parallel scan complete:', data);
        
        const perf = data.metadata?.performance;
        if (perf) {
          alert(`✅ Parallel Scan Complete!\n\nFound ${data.metadata.count} signals\nTime: ${perf.parallel_duration}s\nSpeedup: ${perf.speedup}x faster\nTime saved: ${perf.time_saved_seconds}s`);
        }
        
        await refetch();
      } else {
        throw new Error('Parallel scan failed');
      }
    } catch (err) {
      console.error('Parallel scan error:', err);
      alert(`❌ Parallel scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // NEW: Start continuous scanner
  const handleStartContinuous = async () => {
    try {
      const symbolsToUse = (universeSymbols && universeSymbols.length) ? universeSymbols.map((s: any) => s.symbol).slice(0,10) : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
      const response = await fetch('/api/scanner/continuous/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolsToUse,
          exchanges: ['binance', 'kucoinfutures']
        }),
      });

      if (response.ok) {
        alert('✅ Continuous scanner started!\n\nMonitoring market every 5 seconds.\nGenerating signals every 30 seconds.');
      }
    } catch (err) {
      console.error('Failed to start continuous scanner:', err);
    }
  };

  // NEW: Stop continuous scanner
  const handleStopContinuous = async () => {
    try {
      await fetch('/api/scanner/continuous/stop', { method: 'POST' });
      alert('⏹️ Continuous scanner stopped');
    } catch (err) {
      console.error('Failed to stop continuous scanner:', err);
    }
  };

  // NEW: Download training data
  const handleDownloadTrainingData = async () => {
    try {
      const symbol = (universeSymbols && universeSymbols.length) ? universeSymbols[0].symbol : 'BTC/USDT';
      const response = await fetch(`/api/scanner/training-data/${symbol.replace('/', '%2F')}?days=30`);
      
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training-data-${symbol.replace('/', '_')}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download training data:', err);
    }
  };

  // NEW: Check confluence
  const handleCheckConfluence = async () => {
    try {
      const symbol = (universeSymbols && universeSymbols.length) ? universeSymbols[0].symbol : 'BTC/USDT';
      const response = await fetch(`/api/scanner/continuous/confluence/${symbol.replace('/', '%2F')}?min_score=60`);
      
      if (response.ok) {
        const data = await response.json();
        alert(`📊 Multi-Timeframe Confluence: ${symbol}\n\nConfluence: ${data.confluence ? '✅ Yes' : '❌ No'}\nTimeframes: ${data.timeframes_analyzed}\nAvg Score: ${data.average_score?.toFixed(1)}\nBullish: ${data.bullish_timeframes}\nBearish: ${data.bearish_timeframes}\nRecommendation: ${data.recommendation}`);
      }
    } catch (err) {
      console.error('Failed to check confluence:', err);
    }
  };

  const handleScanAllExchanges = async () => {
    const exchanges = ['kucoinfutures', 'binance', 'coinbase', 'kraken', 'okx', 'bybit'];
    setIsScanning(true);

    try {
      for (const exchange of exchanges) {
        const response = await fetch('/api/scanner/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeframe: selectedFilters.timeframe === 'all' ? 'medium' : selectedFilters.timeframe,
            exchange,
            signal: selectedFilters.signal,
            minStrength: selectedFilters.minStrength,
            fullAnalysis: true // Trigger deeper analysis/custom reports
          }),
        });

        // Handle 202 Accepted responses
        if (response.status === 202) {
          const data = await response.json();
          console.log(`✅ Scan queued for ${exchange}:`, data);
          continue; // Move to next exchange
        }

        if (response.ok) {
          const data = await response.json();
          setAllExchangeSignals(prev => {
            const updated = new Map(prev);
            updated.set(exchange, data.signals || []);
            return updated;
          });
        } else {
          console.warn(`⚠️ Scan failed for ${exchange}`);
        }
      }
      
      // After all scans queued, start polling
      console.log('📊 All exchange scans queued, polling for results...');
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > 60) {
          clearInterval(pollInterval);
          setIsScanning(false);
          alert('⏰ Multi-exchange scan polling timeout.');
          return;
        }
        
        try {
          const statusResponse = await fetch('/api/scanner/status');
          const status = await statusResponse.json();
          
          if (status.last_scan) {
            console.log('📊 Results available from multi-exchange scan');
            await refetch();
            clearInterval(pollInterval);
            setIsScanning(false);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 5000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Multi-exchange scan error:', err);
      alert(`❌ Failed to scan exchanges: ${errorMessage}`);
      setIsScanning(false);
    }
  };

  // Calculate top signals that appear across multiple exchanges
  const getTopConsistentSignals = () => {
    const signalMap = new Map<string, { count: number; exchanges: string[]; avgStrength: number; signals: any[] }>();

    allExchangeSignals.forEach((signals, exchange) => {
      signals.forEach(signal => {
        const key = signal.symbol;
        if (!signalMap.has(key)) {
          signalMap.set(key, { count: 0, exchanges: [], avgStrength: 0, signals: [] });
        }
        const entry = signalMap.get(key)!;
        entry.count++;
        entry.exchanges.push(exchange);
        entry.avgStrength = (entry.avgStrength * (entry.count - 1) + signal.strength) / entry.count;
        entry.signals.push({ ...signal, exchange });
      });
    });

    // Filter for signals appearing on 2+ exchanges with high strength
    return Array.from(signalMap.entries())
      .filter(([_, data]) => data.count >= 2 && data.avgStrength >= 60)
      .map(([symbol, data]) => ({
        symbol,
        exchangeCount: data.count,
        exchanges: data.exchanges,
        avgStrength: data.avgStrength,
        signals: data.signals
      }))
      .sort((a, b) => b.exchangeCount - a.exchangeCount || b.avgStrength - a.avgStrength);
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
          <p className="text-slate-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Market Data</h2>
          <p className="text-slate-400 mb-4">Failed to load market signals</p>
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
                  Market Intelligence
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Comprehensive market data and analysis</p>
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
                title={showWatchlistOnly ? 'Show All Data' : 'Show Watchlist Only'}
                aria-label={showWatchlistOnly ? 'Show all data' : 'Show watchlist only'}
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
                onClick={handleRunAnalysis}
                disabled={runAnalysisLoading || !apiHealthy}
                className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-2 font-semibold ${runAnalysisLoading ? 'bg-slate-700 text-slate-200' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500'}`}
                title="Run Analysis (13-agent consensus)"
                aria-label="Run analysis"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{runAnalysisLoading ? 'Running...' : 'Run Analysis'}</span>
              </button>

              {/* Removed Quick Scan Button */}
              {/* <QuickScanButton onScanComplete={handleQuickScan} /> */}

              {/* Scanner Controls Dropdown */}
              <div className="relative group">
                <button
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all flex items-center space-x-2 text-white font-semibold shadow-lg shadow-blue-500/20"
                >
                  <Search className="w-4 h-4" />
                  <span>Scanner Tools</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-2 space-y-1">
                    {/* NEW: ARM Scanner Option */}
                    <button
                      onClick={() => setShowArmScanner(!showArmScanner)}
                      disabled={armScanLoading}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2 disabled:opacity-50 font-semibold bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30"
                    >
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span>🔬 ARM Multi-Exchange Scan</span>
                    </button>
                    
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Search className="w-4 h-4" />
                      <span>Single Exchange ({selectedExchange})</span>
                    </button>
                    
                    <button
                      onClick={handleParallelScan}
                      disabled={isScanning}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Parallel Scan (4 exchanges)</span>
                    </button>
                    
                    <button
                      onClick={handleScanAllExchanges}
                      disabled={isScanning}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Activity className="w-4 h-4" />
                      <span>Scan All Exchanges (Sequential)</span>
                    </button>
                    
                    <div className="border-t border-slate-700 my-1"></div>
                    
                    <button
                      onClick={handleStartContinuous}
                      className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-slate-700 rounded flex items-center space-x-2"
                    >
                      <Activity className="w-4 h-4" />
                      <span>Start Continuous (5s)</span>
                    </button>
                    
                    <button
                      onClick={handleStopContinuous}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 rounded flex items-center space-x-2"
                    >
                      <Activity className="w-4 h-4" />
                      <span>Stop Continuous</span>
                    </button>
                    
                    <div className="border-t border-slate-700 my-1"></div>
                    
                    <button
                      onClick={handleCheckConfluence}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2"
                    >
                      <Target className="w-4 h-4" />
                      <span>Check Confluence (BTC)</span>
                    </button>
                    
                    <button
                      onClick={handleDownloadTrainingData}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 rounded flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Training Data</span>
                    </button>
                  </div>
                </div>
              </div>

              {allExchangeSignals.size >= 2 && (
                <button
                  onClick={() => setShowTopSignals(!showTopSignals)}
                  className={`px-6 py-2.5 rounded-lg transition-all flex items-center space-x-2 font-semibold shadow-lg ${
                    showTopSignals
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-yellow-500/20'
                      : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white'
                  }`}
                >
                  <Star className={`w-4 h-4 ${showTopSignals ? 'fill-current' : ''}`} />
                  <span>Top Consistent Signals ({getTopConsistentSignals().length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl backdrop-blur-sm">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Exchange to Scan</label>
                  <select 
                    value={selectedExchange}
                    onChange={(e) => setSelectedExchange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    aria-label="Exchange selector"
                  >
                    <option value="kucoinfutures">KuCoin Futures (Default)</option>
                    <option value="binance">Binance</option>
                    <option value="coinbase">Coinbase</option>
                    <option value="kraken">Kraken</option>
                    <option value="okx">OKX</option>
                    <option value="bybit">Bybit</option>
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
        {/* NEW: ARM Multi-Exchange Scanner Panel */}
        {showArmScanner && (
          <div className="mb-6 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-400" />
                🔬 ARM Multi-Exchange Scanner
              </h2>
              <button
                onClick={() => setShowArmScanner(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            {scannerServiceError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 text-red-300 text-sm rounded-lg">
                ❌ {scannerServiceError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Symbol Selection */}
              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Symbols to Scan</label>
                <div className="space-y-2">
                  {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT'].map(symbol => (
                    <label key={symbol} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSymbols.includes(symbol)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSymbols([...selectedSymbols, symbol]);
                          } else {
                            setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">{symbol}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Exchange Selection */}
              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Exchanges</label>
                <div className="space-y-2">
                  {['binance', 'coinbase', 'okx', 'bybit', 'kucoinfutures'].map(exchange => (
                    <label key={exchange} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedExchanges.includes(exchange)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExchanges([...selectedExchanges, exchange]);
                          } else {
                            setSelectedExchanges(selectedExchanges.filter(ex => ex !== exchange));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300 capitalize">{exchange}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-purple-300 mb-3">Scan Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-400">Symbols:</span>
                    <span className="ml-2 font-bold text-purple-300">{selectedSymbols.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Exchanges:</span>
                    <span className="ml-2 font-bold text-purple-300">{selectedExchanges.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Pairs:</span>
                    <span className="ml-2 font-bold text-green-400">{selectedSymbols.length * selectedExchanges.length}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 italic">ARM signal classification + cross-exchange detection</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleArmMultiExchangeScan}
              disabled={armScanLoading || selectedSymbols.length === 0 || selectedExchanges.length === 0}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {armScanLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Scanning across {selectedExchanges.length} exchanges...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start ARM Multi-Exchange Scan
                </>
              )}
            </button>
          </div>
        )}

        {/* NEW: ARM Scan Results Display */}
        {armScanResults && !showArmScanner && (
          <div className="space-y-6 mb-6">
            {/* Top Assets */}
            <TopAssetsCard
              assets={armScanResults.topAssets}
              loading={armScanLoading}
              onAssetClick={(asset) => {
                setSelectedScanResult(asset);
                setShowAgentAnalysisDialog(true);
              }}
            />

            {/* Cross-Exchange Signals */}
            <CrossExchangeSignalsPanel
              signals={armScanResults.crossExchangeSignals}
              loading={armScanLoading}
              onSignalClick={(signal) => {
                console.log('Cross-exchange signal clicked:', signal);
              }}
            />

            {/* Signal Distribution */}
            <SignalDistributionChart
              results={armScanResults.totalResults ? armScanResults.exchanges?.flatMap(e => e.topAssets) || [] : []}
              loading={armScanLoading}
            />

            {/* Historical Trend Chart (if enabled) */}
            {showHistoricalChart && armScanResults.topAssets.length > 0 && (
              <HistoricalTrendChart
                data={armScanResults.topAssets.map((asset: any) => ({
                  timestamp: Date.now(),
                  signal: asset.signal || 'NEUTRAL',
                  confidence: asset.strength || 0,
                  compositeScore: asset.compositeScore || asset.strength || 0
                }))}
                symbol={armScanResults.topAssets[0].symbol}
              />
            )}

            {/* Results Summary */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Scan Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/30 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-1">Total Results</p>
                  <p className="text-2xl font-bold text-white">{armScanResults.totalResults}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-1">Exchanges Scanned</p>
                  <p className="text-2xl font-bold text-blue-400">{armScanResults.exchanges?.length || 0}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-1">Cross-Exchange Signals</p>
                  <p className="text-2xl font-bold text-purple-400">{armScanResults.crossExchangeSignals.length}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-1">High Quality Assets</p>
                  <p className="text-2xl font-bold text-green-400">
                    {armScanResults.topAssets.filter((a: any) => (a.confidence || a.strength || 0) >= 75).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Consistent Signals */}
        {showTopSignals && allExchangeSignals.size >= 2 && (
          <div className="mb-6 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-700/50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 fill-current" />
              Top Consistent Signals Across Exchanges
            </h2>
            <p className="text-slate-300 mb-4">
              These signals appear on multiple exchanges with high strength - indicating strong market consensus
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getTopConsistentSignals().map((topSignal, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-yellow-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">{topSignal.symbol}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-bold">
                        {topSignal.exchangeCount}x Exchanges
                      </span>
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-bold">
                        {Math.round(topSignal.avgStrength)}% Avg
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Found on: {topSignal.exchanges.join(', ')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {topSignal.signals.map((sig: any, i: number) => (
                      <div key={i} className="text-xs bg-slate-900/50 rounded p-2">
                        <div className="font-bold text-blue-400">{sig.exchange}</div>
                        <div className="text-slate-300">{sig.strength}% - {sig.signal}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan Progress */}
        {scanProgress && scanProgress.remaining > 0 && (
          <div className="mb-6">
            <ScanProgress total={scanProgress.total} remaining={scanProgress.remaining} />
          </div>
        )}

        {/* API & Scanner Status */}
        {!apiHealthy && (
          <div className="mb-4 bg-red-900/20 border border-red-800 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-red-200">
              ❌ Scanner API unavailable. Cannot trigger scans.
            </p>
          </div>
        )}

        {apiHealthy && !scannerInitialized && (
          <div className="mb-4 bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-yellow-200">
              ⚠️ Scanner not initialized yet. Click "Scan" to initialize.
            </p>
          </div>
        )}

        {apiHealthy && scannerInitialized && (
          <div className="mb-4 bg-green-900/20 border border-green-800 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-green-200">
              ✅ Scanner API connected and initialized. Ready to scan.
            </p>
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
                  {displaySignals.length > 0 ? Math.round(displaySignals.reduce((acc: number, s: ScannerSignal) => acc + (s.strength ?? 0), 0) / displaySignals.length) : 0}%
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

        {/* Strategy Panel */}
        <div className="mb-8">
          <StrategyPanel
            symbol={selectedScanResult?.symbol || 'BTC/USDT'}
            isLoading={isLoading}
            onStrategySelect={(strategy) => {
              console.log('Strategy selected:', strategy);
            }}
            onAgentSelect={(agent) => {
              console.log('Agent selected:', agent);
            }}
            onRefresh={() => refetch()}
          />
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
                              setSelectedScanResult(signal);
                              setShowAgentAnalysisDialog(true);
                            }}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all text-sm"
                          >
                            Agents
                          </button>

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const pos = await calculatePosition(signal);
                              // Build asset payload for EntryDialog
                              // `signal` comes from external API and may have extra runtime-only
                              // properties (agentConsensus, strength, risk_reward, etc.) that
                              // are not present on the static `ScanResult` TS type. Cast to
                              // `any` here to safely access those optional runtime fields.
                              const s: any = signal as any;
                              const consensus = s.consensus || s.agentConsensus || { signal: s.signal || 'HOLD', confidence: (s.strength || 0) / 100, riskScore: 'MEDIUM' };
                              const asset = {
                                symbol: s.symbol,
                                currentPrice: s.price || s.currentPrice || 0,
                                consensusSignal: consensus.signal === 'BUY' ? 'BUY' : consensus.signal === 'SELL' ? 'SELL' : 'HOLD',
                                avgConfidence: (consensus.confidence || ((s.strength || 0) / 100)) * 100,
                                riskScore: consensus.riskScore || 'MEDIUM',
                                suggestedStopLoss: s.risk_reward?.stop_loss || s.suggestedStopLoss,
                                suggestedTakeProfit: s.risk_reward?.take_profit || s.suggestedTakeProfit
                              };

                              setEntryAsset(asset);
                              setEntrySide((consensus.signal === 'SELL') ? 'SHORT' : 'LONG');
                              setShowEntryDialog(true);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20"
                          >
                            <Zap className="w-4 h-4" />
                            <span>Trade</span>
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
                  className="group bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/5 text-left w-full"
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
                        <button
                          onClick={() => setSelectedSymbolDetail(signal)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                          title={`View details for ${signal.symbol}`}
                          aria-label={`View details for ${signal.symbol}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
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
                            signal.market_regime.regime === 'bull' ? 'bg-green-400' : 
                            signal.market_regime.regime === 'bear' ? 'bg-red-400' : 'bg-slate-400'
                          } animate-pulse`}></div>
                          <span className="text-xs text-slate-400">Market Regime</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-bold ${
                            signal.market_regime.regime === 'bull' ? 'text-green-400' : 
                            signal.market_regime.regime === 'bear' ? 'text-red-400' : 'text-slate-300'
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
                          (signal.indicators?.macd || signal.macd || 'neutral') === 'bullish' ? 'text-green-400' : 
                          (signal.indicators?.macd || signal.macd || 'neutral') === 'bearish' ? 'text-red-400' : 'text-slate-300'
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

                    {/* Flow Metrics Panel */}
                    <FlowMetricsPanel
                      orderFlow={signal.orderFlow}
                      microstructure={signal.marketMicrostructure}
                      symbol={signal.symbol}
                    />

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScanResult(signal);
                          setShowAgentAnalysisDialog(true);
                        }}
                        className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 flex-1"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Agents</span>
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          const pos = await calculatePosition(signal);
                          const s: any = signal as any;
                          const consensus = s.consensus || s.agentConsensus || { signal: s.signal || 'HOLD', confidence: (s.strength || 0) / 100, riskScore: 'MEDIUM' };
                          const asset = {
                            symbol: s.symbol,
                            currentPrice: s.price || s.currentPrice || 0,
                            consensusSignal: consensus.signal === 'BUY' ? 'BUY' : consensus.signal === 'SELL' ? 'SELL' : 'HOLD',
                            avgConfidence: (consensus.confidence || ((s.strength || 0) / 100)) * 100,
                            riskScore: consensus.riskScore || 'MEDIUM',
                            suggestedStopLoss: s.risk_reward?.stop_loss || s.suggestedStopLoss,
                            suggestedTakeProfit: s.risk_reward?.take_profit || s.suggestedTakeProfit
                          };

                          setEntryAsset(asset);
                          setEntrySide((consensus.signal === 'SELL') ? 'SHORT' : 'LONG');
                          setShowEntryDialog(true);
                        }}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20"
                      >
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
            <h3 className="text-xl font-bold text-white mb-2">No Market Data Available</h3>
            <p className="text-slate-500 mb-6">
              {scannerData?.metadata?.message || 'Market data is being fetched. Please try again in a moment, or click "Scan Market" to initiate a manual fetch.'}
            </p>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Queuing scan...' : 'Fetch Market Data'}
            </button>

            {/* Render the SignalFilters component */}
            <SignalFilters
              currentFilters={filters}
              onFilterChange={setFilters}
            />
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
      {/* Entry Dialog (opened when user clicks Trade) */}
      {entryAsset && (
        <EntryDialog
          isOpen={showEntryDialog}
          onClose={() => setShowEntryDialog(false)}
          onConfirm={async (entry: PositionEntry) => {
            try {
              const resp = await fetch('/api/paper-trading/open-position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...entry })
              });

              if (resp.ok) {
                const data = await resp.json();
                alert('Position opened (paper): ' + (data.id || 'ok'));
              } else {
                const err = await resp.json().catch(() => ({}));
                alert('Failed to open position: ' + (err.message || resp.statusText));
              }
            } catch (err) {
              console.error('Failed to open paper position:', err);
              alert('Error opening position');
            } finally {
              setShowEntryDialog(false);
            }
          }}
          asset={entryAsset}
          accountBalance={accountBalance}
          side={entrySide}
        />
      )}
      {/* Agent Analysis Drawer */}
      {showAgentAnalysisDialog && selectedScanResult && (
        <div className="fixed right-6 top-16 w-[420px] max-h-[80vh] overflow-auto z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Agent Analysis</h3>
              <button onClick={() => { setShowAgentAnalysisDialog(false); setSelectedScanResult(null); }} className="text-sm text-slate-400 hover:text-white">Close</button>
            </div>
            <ScannerAgentAnalysis scanResult={selectedScanResult} onTrade={(r) => {
              // Open entry dialog for selected result
              const consensus = r.consensus || r.agentConsensus || { signal: r.signal || 'HOLD', confidence: (r.strength || 0) / 100 };
              const asset = {
                symbol: r.symbol,
                currentPrice: r.price || r.currentPrice || 0,
                consensusSignal: consensus.signal === 'BUY' ? 'BUY' : consensus.signal === 'SELL' ? 'SELL' : 'HOLD',
                avgConfidence: (consensus.confidence || ((r.strength || 0) / 100)) * 100,
                riskScore: consensus.riskScore || 'MEDIUM',
                suggestedStopLoss: r.risk_reward?.stop_loss || r.suggestedStopLoss,
                suggestedTakeProfit: r.risk_reward?.take_profit || r.suggestedTakeProfit
              };
              setEntryAsset(asset);
              setEntrySide((consensus.signal === 'SELL') ? 'SHORT' : 'LONG');
              setShowEntryDialog(true);
              setShowAgentAnalysisDialog(false);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}