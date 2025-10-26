import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Gauge, Search, ChartArea, Wallet, RefreshCw, Layers, Bot, Bell, Cog, BarChart3, ExpandIcon, Target, Wind, Waves, Activity } from 'lucide-react';
import { loadFrontendConfig } from '../lib/config';
import { TradingChart, ChartDataPoint } from '../components/TradingChart';
import { useLocation } from 'wouter';
import { useCoinGeckoChart } from '../hooks/useCoinGeckoChart';

// Local ErrorBoundary fallback (since 'react-error-boundary' is not installed)
function ErrorBoundary({ children, FallbackComponent }: { children: React.ReactNode, FallbackComponent: React.FC<{ error: Error }> }) {
  try {
    return <>{children}</>;
  } catch (error: any) {
    return <FallbackComponent error={error} />;
  }
}

// Define all necessary interfaces
interface PortfolioData {
  totalValue: number;
  availableCash: number;
  dayChange: number;
  dayChangePercent: number;
  equityCurve: Array<{ timestamp: number; value: number }>;
  metrics: Record<string, number>;
  trades: Array<any>;
  drawdownPeriods: Array<any>;
  monteCarloResults: {
    percentiles: Record<string, number>;
    probabilityOfProfit: number;
    worstCase: number;
    bestCase: number;
  };
}

interface MLInsights {
  predictions: Array<{
    timestamp: number;
    probability: number;
    outcome: string;
  }>;
  confidence: number;
  features: Record<string, number>;
}

interface ExchangeStatus {
  isOperational: boolean;
  latency: number;
  uptime: number;
}

interface MarketSentiment {
  fearGreedIndex: number;
  btcDominance: number;
  totalMarketCap: number;
  volume24h: number;
}

interface MultiTimeframeAnalysis {
  overallTrend: string;
  confluenceScore: number;
  timeframeAnalysis: Array<{
    timeframe: string;
    trend: string;
    strength: number;
  }>;
}

interface MarketFrame {
  timestamp: number;
  symbol: string;
  timeframe: string;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    bb: { upper: number; middle: number; lower: number };
    ema20: number;
    ema50: number;
    vwap: number;
    atr: number;
  };
  orderFlow: {
    bidVolume: number;
    askVolume: number;
    netFlow: number;
    largeOrders: number;
    smallOrders: number;
  };
  marketMicrostructure: {
    spread: number;
    depth: number;
    imbalance: number;
    toxicity: number;
  };
}

export type Signal = {
  id: string;
  symbol: string;
  timestamp: number;
  timeframe: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  price: number;
  reasoning: string[];
  riskReward: number;
  stopLoss: number;
  takeProfit: number;
  momentumLabel?: string;
  regimeState?: string;
  legacyLabel?: string;
  signalStrengthScore?: number;
  mlInsights?: MLInsights;
  compositeScore?: number;
  trendScore?: number;
  volumeScore?: number;
  volumeChange?: number;
  volumeRatio?: number;
  rsi?: number;
  macd?: {
    line: number;
    signal: number;
    histogram: number;
  };
  ema20?: number;
  ema50?: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  commission: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  alpha: number;
  beta: number;
  calmarRatio: number;
  sortinoRatio: number;
}

// --- Custom WebSocket hook ---
function useWebSocket(url: string, onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exchangeRef = useRef<string>('binance');
  const reconnectAttemptsRef = useRef<number>(0);
  const onMessageRef = useRef(onMessage); // Store callback in ref to avoid reconnections
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // Start with 1 second
  
  // Update the callback ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any existing reconnection timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    console.log(`[WebSocket] Connecting to: ${url} (attempt ${reconnectAttemptsRef.current + 1})`);
    
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        
        // Send initial exchange setting
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'set_exchange', 
            exchange: exchangeRef.current 
          }));
        }
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type);
          // Use the ref to call the latest callback without causing reconnections
          onMessageRef.current(message);
        } catch (error) {
          console.error('[WebSocket] Message parsing error:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        console.log(`[WebSocket] Connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        
        // Only attempt reconnection if it wasn't a manual close and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          
          reconnectAttemptsRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page.');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, [url]); // Only depend on url, not onMessage

  const setExchange = useCallback((exchange: string) => {
    exchangeRef.current = exchange;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_exchange', exchange }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Only connect once on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only run once on mount

  return { isConnected, setExchange, disconnect };
}

// Enhanced type guard for MarketFrame
const validateMarketFrame = (frame: any): frame is MarketFrame => {
  return (
    frame &&
    typeof frame.timestamp === 'number' &&
    frame.price &&
    typeof frame.price.open === 'number' &&
    typeof frame.price.high === 'number' &&
    typeof frame.price.low === 'number' &&
    typeof frame.price.close === 'number' &&
    typeof frame.volume === 'number' &&
    frame.indicators &&
    typeof frame.indicators.rsi === 'number' &&
    frame.indicators.macd &&
    typeof frame.indicators.macd.line === 'number' &&
    typeof frame.indicators.macd.signal === 'number' &&
    typeof frame.indicators.macd.histogram === 'number' &&
    frame.indicators.bb &&
    typeof frame.indicators.bb.upper === 'number' &&
    typeof frame.indicators.bb.middle === 'number' &&
    typeof frame.indicators.bb.lower === 'number' &&
    typeof frame.indicators.ema20 === 'number' &&
    typeof frame.indicators.ema50 === 'number' &&
    typeof frame.indicators.vwap === 'number' &&
    typeof frame.indicators.atr === 'number' &&
    frame.orderFlow &&
    typeof frame.orderFlow.bidVolume === 'number' &&
    typeof frame.orderFlow.askVolume === 'number' &&
    typeof frame.orderFlow.netFlow === 'number' &&
    typeof frame.orderFlow.largeOrders === 'number' &&
    typeof frame.orderFlow.smallOrders === 'number' &&
    frame.marketMicrostructure &&
    typeof frame.marketMicrostructure.spread === 'number' &&
    typeof frame.marketMicrostructure.depth === 'number' &&
    typeof frame.marketMicrostructure.imbalance === 'number' &&
    typeof frame.marketMicrostructure.toxicity === 'number'
  );
};

export default function TradingTerminal() {
  const [, setLocation] = useLocation();
  // State declarations
  const [showMVIP, setShowMVIP] = useState(false);
  const [marketData, setMarketData] = useState<MarketFrame[]>([]);
  const [currentSignals, setCurrentSignals] = useState<Signal[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT'); // Fixed: Use CoinGecko format
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h'); // Changed to 1h for better CoinGecko data
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>('binance');
  const [currentPrice, setCurrentPrice] = useState(45000); // Start with mock BTC price
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [availableCash, setAvailableCash] = useState(0);
  const [dayChange, setDayChange] = useState(0);
  const [dayChangePercent, setDayChangePercent] = useState(0);
  const [fearGreedIndex, setFearGreedIndex] = useState(0);
  const [btcDominance, setBtcDominance] = useState(0);
  const [totalMarketCap, setTotalMarketCap] = useState(0);
  const [volume24h, setVolume24h] = useState(0);

  // Loading and error states
  const [loading, setLoading] = useState({
    signals: true,
    trades: true,
    sentiment: true,
    portfolio: true,
    exchange: true,
    ml: true,
    multiTF: true,
  });
  const [error, setError] = useState({
    signals: false,
    trades: false,
    sentiment: false,
    portfolio: false,
    exchange: false,
    ml: false,
    multiTF: false,
  });

  // Chart indicator toggles
  type ChartIndicatorKey = 'showVolume' | 'showRSI' | 'showMACD' | 'showEMA' | 'showPatterns';
  const [chartIndicators, setChartIndicators] = useState<Record<ChartIndicatorKey, boolean>>({
    showVolume: true,
    showRSI: true,
    showMACD: true,
    showEMA: true,
    showPatterns: false,
  });

  // WebSocket connection through Vite proxy
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use the proxy path /ws which will be forwarded to the backend server
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const { isConnected, setExchange } = useWebSocket(
    wsUrl,
    (message: any) => {
      switch (message.type) {
        case 'market_data': {
          const frame = message.data;
          if (validateMarketFrame(frame)) {
            setMarketData((prev: MarketFrame[]) => {
              const newData = [...prev, frame];
              return newData.slice(-200);
            });
            if (frame.symbol === selectedSymbol) {
              setCurrentPrice(frame.price.close);
              const change = frame.price.close - frame.price.open;
              setPriceChange(change);
              setPriceChangePercent((change / frame.price.open) * 100);
            }
            setIsRunning(true);
          }
          break;
        }
        case 'signal': {
          const signal = message.data as Signal;
          setCurrentSignals((prev: Signal[]) => {
            const newSignals = [signal, ...prev];
            return newSignals.slice(0, 10);
          });
          break;
        }
        case 'portfolio_update': {
          const portfolio = message.data;
          setPortfolioValue(portfolio.totalValue || 0);
          setAvailableCash(portfolio.availableCash || 0);
          setDayChange(portfolio.dayChange || 0);
          setDayChangePercent(portfolio.dayChangePercent || 0);
          break;
        }
        default:
          console.log('Unknown message type:', message.type);
      }
    }
  );

  // Load available exchanges from config
  useEffect(() => {
    loadFrontendConfig().then(cfg => {
      const exchanges = cfg.ui?.availableExchanges || [];
      setAvailableExchanges(exchanges);
      if (exchanges.length && !exchanges.includes(selectedExchange)) {
        setSelectedExchange(exchanges[0]);
      }
    }).catch(err => {
      console.error('Failed to load config:', err);
      setError(e => ({ ...e, exchange: true }));
    });
  }, [selectedExchange]);

  // Send selected exchange to backend when it changes
  useEffect(() => {
    setExchange(selectedExchange);
  }, [selectedExchange, setExchange]);

  // Fetch data with react-query
  const { data: latestSignals, refetch: refetchSignals, isLoading: signalsLoading, isError: signalsError } = useQuery<Signal[]>({
    queryKey: ['/api/signals/latest'],
    queryFn: () => fetch('/api/signals/latest').then(res => res.json()),
    refetchInterval: 5000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, signals: signalsLoading }));
    setError(e => ({ ...e, signals: signalsError }));
  }, [signalsLoading, signalsError]);

  const { data: activeTrades, refetch: refetchTrades, isLoading: tradesLoading, isError: tradesError } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
    queryFn: () => fetch('/api/trades?status=OPEN').then(res => res.json()),
    refetchInterval: 3000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, trades: tradesLoading }));
    setError(e => ({ ...e, trades: tradesError }));
  }, [tradesLoading, tradesError]);

  const { data: marketSentiment, refetch: refetchSentiment, isLoading: sentimentLoading, isError: sentimentError } = useQuery<MarketSentiment>({
    queryKey: ['/api/market-sentiment'],
    queryFn: () => fetch('/api/market-sentiment').then(res => res.json()),
    refetchInterval: 30000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, sentiment: sentimentLoading }));
    setError(e => ({ ...e, sentiment: sentimentError }));
    if (marketSentiment) {
      setFearGreedIndex(marketSentiment.fearGreedIndex || 0);
      setBtcDominance(marketSentiment.btcDominance || 0);
      setTotalMarketCap((marketSentiment.totalMarketCap || 0) / 1e12);
      setVolume24h((marketSentiment.volume24h || 0) / 1e9);
    }
  }, [marketSentiment, sentimentLoading, sentimentError]);

  const { data: portfolioSummary, refetch: refetchPortfolio, isLoading: portfolioLoading, isError: portfolioError } = useQuery<PortfolioData>({
    queryKey: ['/api/portfolio-summary'],
    queryFn: () => fetch('/api/portfolio-summary').then(res => res.json()),
    refetchInterval: 5000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, portfolio: portfolioLoading }));
    setError(e => ({ ...e, portfolio: portfolioError }));
    if (portfolioSummary) {
      setPortfolioValue(portfolioSummary.totalValue || 0);
      setAvailableCash(portfolioSummary.availableCash || 0);
      setDayChange(portfolioSummary.dayChange || 0);
      setDayChangePercent(portfolioSummary.dayChangePercent || 0);
    }
  }, [portfolioSummary, portfolioLoading, portfolioError]);

  const { data: exchangeStatus, refetch: refetchExchange, isLoading: exchangeLoading, isError: exchangeError } = useQuery<ExchangeStatus>({
    queryKey: ['/api/exchange/status'],
    queryFn: () => fetch('/api/exchange/status').then(res => res.json()),
    refetchInterval: 30000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, exchange: exchangeLoading }));
    setError(e => ({ ...e, exchange: exchangeError }));
  }, [exchangeLoading, exchangeError]);

  const { data: mlInsights, refetch: refetchML, isLoading: mlLoading, isError: mlError } = useQuery<MLInsights>({
    queryKey: ['/api/ml/insights'],
    queryFn: () => fetch('/api/ml/insights').then(res => res.json()),
    refetchInterval: 60000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, ml: mlLoading }));
    setError(e => ({ ...e, ml: mlError }));
  }, [mlLoading, mlError]);

  const { data: multiTimeframeAnalysis, refetch: refetchMultiTF, isLoading: multiTFLoading, isError: multiTFError } = useQuery<MultiTimeframeAnalysis>({
    queryKey: ['/api/analysis/multi-timeframe', selectedSymbol],
    queryFn: () => fetch(`/api/analysis/multi-timeframe?symbol=${selectedSymbol}`).then(res => res.json()),
    refetchInterval: 15000,
  });

  useEffect(() => {
    setLoading(l => ({ ...l, multiTF: multiTFLoading }));
    setError(e => ({ ...e, multiTF: multiTFError }));
  }, [multiTFLoading, multiTFError]);

  // Fetch chart data from CoinGecko with error recovery
  const { data: coinGeckoChartData, isLoading: isChartLoading, error: chartError, refetch: refetchChart } = useCoinGeckoChart(selectedSymbol, 7);
  
  // Chart data computation - use CoinGecko data if available, fallback to WebSocket data
  const chartData: ChartDataPoint[] = useMemo(() => {
    // First try CoinGecko data
    if (coinGeckoChartData && coinGeckoChartData.length > 0) {
      console.log(`[Chart] Using CoinGecko data for ${selectedSymbol}: ${coinGeckoChartData.length} candles`);
      return coinGeckoChartData;
    }
    
    // Fallback to WebSocket marketData
    const filteredData = marketData.filter(frame => frame.symbol === selectedSymbol);
    
    if (filteredData.length === 0) {
      console.log(`[Chart] No chart data available for ${selectedSymbol} - neither CoinGecko nor WebSocket`);
      return [];
    }
    
    console.log(`[Chart] Using WebSocket data for ${selectedSymbol}: ${filteredData.length} frames`);
    return filteredData.slice(-200).map(frame => ({
      timestamp: frame.timestamp,
      open: frame.price.open,
      high: frame.price.high,
      low: frame.price.low,
      close: frame.price.close,
      volume: frame.volume,
      rsi: frame.indicators?.rsi ?? null,
      macd: frame.indicators?.macd?.line ?? null,
      ema: frame.indicators?.ema20 ?? null,
    }));
  }, [coinGeckoChartData, marketData, selectedSymbol]);

  // Current market frame
  const currentFrame = useMemo(() => {
    return marketData.filter(frame => frame.symbol === selectedSymbol).slice(-1)[0] || null;
  }, [marketData, selectedSymbol]);

  // Flow Field data - Define interface and query AFTER chartData is available
  interface FlowFieldData {
    latestForce: number;
    averageForce: number;
    forceDirection: number;
    pressure: number;
    pressureTrend: 'rising' | 'falling' | 'stable';
    turbulence: number;
    turbulenceLevel: 'low' | 'medium' | 'high' | 'extreme';
    energyGradient: number;
    energyTrend: 'accelerating' | 'decelerating' | 'stable';
    dominantDirection: 'bullish' | 'bearish' | 'neutral';
  }

  const { data: flowFieldData, isLoading: flowFieldLoading } = useQuery<FlowFieldData>({
    queryKey: ['/api/analytics/flow-field', selectedSymbol, chartData.length],
    queryFn: async () => {
      // Transform chartData to flow field format
      if (!chartData || chartData.length < 2) {
        throw new Error('Insufficient data for flow field calculation');
      }
      
      const flowFieldPoints = chartData.map(d => ({
        timestamp: d.timestamp,
        price: d.close,
        volume: d.volume,
        bidVolume: d.volume * 0.52, // Estimate (could be from WebSocket)
        askVolume: d.volume * 0.48,
        high: d.high,
        low: d.low,
        open: d.open,
        close: d.close
      }));

      const response = await fetch('/api/analytics/flow-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: flowFieldPoints })
      });

      if (!response.ok) throw new Error('Flow field computation failed');
      const result = await response.json();
      return result.result;
    },
    enabled: chartData.length >= 2,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });

  // ML Predictions data
  interface MLPredictions {
    direction: {
      prediction: 'bullish' | 'bearish';
      probability: number;
      confidence: number;
      signal: 1 | 0;
    };
    price: {
      predicted: number;
      high: number;
      low: number;
      confidence: number;
      percentChange: number;
    };
    volatility: {
      predicted: number;
      level: 'low' | 'medium' | 'high' | 'extreme';
      confidence: number;
    };
    risk: {
      score: number;
      level: 'low' | 'medium' | 'high' | 'extreme';
      factors: string[];
    };
  }

  const { data: mlPredictions, isLoading: mlPredictionsLoading } = useQuery<MLPredictions>({
    queryKey: ['/api/ml/predictions', selectedSymbol, chartData.length],
    queryFn: async () => {
      if (!chartData || chartData.length < 20) {
        throw new Error('Insufficient data for ML predictions');
      }

      const response = await fetch('/api/ml/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartData })
      });

      if (!response.ok) throw new Error('ML prediction failed');
      const result = await response.json();
      return result.predictions;
    },
    enabled: chartData.length >= 20,
    refetchInterval: 45000, // Refresh every 45 seconds
    retry: 1,
  });

  // Update current price from chart data
  useEffect(() => {
    if (chartData.length > 0) {
      const latestCandle = chartData[chartData.length - 1];
      if (latestCandle && latestCandle.close) {
        setCurrentPrice(latestCandle.close);
        if (chartData.length > 1) {
          const previousCandle = chartData[chartData.length - 2];
          const change = latestCandle.close - (previousCandle?.close || latestCandle.open);
          setPriceChange(change);
          setPriceChangePercent((change / (previousCandle?.close || latestCandle.open)) * 100);
        }
      }
    }
  }, [chartData]);

  // Close symbol search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSymbolSearch) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-symbol-search]')) {
          setShowSymbolSearch(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSymbolSearch]);

  // Formatting utilities
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Signal counts
  const signals = useMemo(() => {
    return [
      ...(Array.isArray(latestSignals) ? latestSignals : []),
      ...(Array.isArray(currentSignals) ? currentSignals : []),
    ];
  }, [latestSignals, currentSignals]);

  const signalCounts = useMemo(() => ({
    strongBuy: signals.filter(s => s.type === 'BUY' && s.strength > 0.8).length,
    buy: signals.filter(s => s.type === 'BUY' && s.strength <= 0.8).length,
    hold: signals.filter(s => s.type === 'HOLD').length,
    sell: signals.filter(s => s.type === 'SELL' && s.strength <= 0.8).length,
    strongSell: signals.filter(s => s.type === 'SELL' && s.strength > 0.8).length,
  }), [signals]);

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="p-4 bg-bearish text-white rounded-lg">
      <h3 className="text-lg font-semibold">Error</h3>
      <p className="text-sm">{error.message}</p>
      <button
        className="mt-2 px-3 py-1 bg-bullish text-black rounded"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Top Bar */}
      <header className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                QuantumScanner Pro
              </h1>
              <p className="text-xs text-slate-500">Trading Terminal</p>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-700"></div>
          <nav className="flex items-center space-x-1" role="navigation">
            <button
              className="px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg text-sm font-medium text-white transition-colors"
              data-testid="nav-dashboard"
              aria-label="Dashboard"
            >
              <Gauge className="w-4 h-4 mr-2 inline" />
              Dashboard
            </button>
            <button
              onClick={() => setLocation('/scanner')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-scanner"
              aria-label="Scanner"
            >
              <Search className="w-4 h-4 mr-2 inline" />
              Scanner
            </button>
            <button
              onClick={() => setLocation('/strategies')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-strategies"
              aria-label="Strategies"
            >
              <Bot className="w-4 h-4 mr-2 inline" />
              Strategies
            </button>
            <button
              onClick={() => setLocation('/backtest')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-backtest"
              aria-label="Backtest"
            >
              <ChartArea className="w-4 h-4 mr-2 inline" />
              Backtest
            </button>
            <button
              onClick={() => setLocation('/portfolio')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-portfolio"
              aria-label="Portfolio"
            >
              <Wallet className="w-4 h-4 mr-2 inline" />
              Portfolio
            </button>
            <button
              onClick={() => setLocation('/ml-engine')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-ml"
              aria-label="ML Engine"
            >
              <Brain className="w-4 h-4 mr-2 inline" />
              ML Engine
            </button>
            <button
              onClick={() => setLocation('/multi-timeframe')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-timeframes"
              aria-label="Multi-Timeframe Analysis"
            >
              <Layers className="w-4 h-4 mr-2 inline" />
              Multi-TF
            </button>
            <button
              onClick={() => setLocation('/optimize')}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-medium hover:bg-slate-800/50 transition-colors"
              data-testid="nav-optimize"
              aria-label="Optimize"
            >
              <Bot className="w-4 h-4 mr-2 inline" />
              Optimize
            </button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-slate-400">Market</span>
              <span
                className={`font-mono font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}
                data-testid="market-status"
              >
                {isConnected ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <span className="text-slate-400">BTC:</span>
              <span className="text-white font-semibold">{formatCurrency(currentPrice)}</span>
              <span
                className={`font-semibold ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}
                data-testid="price-change"
              >
                {formatPercent(priceChangePercent)}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <span className="text-slate-400">24h Vol</span>
              <span className="font-mono font-semibold text-blue-400">{volume24h}B</span>
            </div>
            <button
              className="p-2 hover:bg-slate-800/50 border border-slate-700/50 rounded-lg transition-colors"
              data-testid="button-notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-400" />
            </button>
            <button
              className="p-2 hover:bg-slate-800/50 border border-slate-700/50 rounded-lg transition-colors"
              data-testid="button-settings"
              aria-label="Settings"
            >
              <Cog className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Market Overview */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="w-80 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border-r border-slate-700/50 flex flex-col relative" aria-label="Market Overview Sidebar">
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Top Signals</h2>
                <button
                  className="text-xs bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-all shadow-lg shadow-green-500/20"
                  onClick={() => refetchSignals()}
                  data-testid="button-refresh-signals"
                  aria-label="Refresh Signals"
                >
                  <RefreshCw className="w-3 h-3 mr-1 inline" />
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {signalsLoading && (
                  <div className="animate-pulse space-y-2">
                    <div className="h-12 bg-slate-700/30 rounded-lg" />
                    <div className="h-12 bg-slate-700/30 rounded-lg" />
                    <div className="h-12 bg-slate-700/30 rounded-lg" />
                  </div>
                )}
                {signalsError && (
                  <button
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-red-500/20 transition-all"
                    onClick={() => refetchSignals()}
                    aria-label="Retry loading signals"
                  >
                    Retry
                  </button>
                )}
                {signals.slice(0, 3).map((signal: Signal, index: number) => (
                  <div
                    key={index}
                    className={`bg-slate-800/30 rounded-lg p-3 border transition-all cursor-pointer hover:shadow-lg ${
                      signal.type === 'BUY' 
                        ? 'border-green-500/30 hover:border-green-500/50 hover:shadow-green-500/10' 
                        : 'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/10'
                    }`}
                    data-testid={`signal-card-${index}`}
                    tabIndex={0}
                    aria-label={`Signal card for ${signal.symbol}`}
                    role="button"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white" data-testid={`signal-symbol-${index}`}>
                          {signal.symbol}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                            signal.type === 'BUY' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                          data-testid={`signal-type-${index}`}
                        >
                          {signal.type}
                        </span>
                      </div>
                      <span
                        className="text-sm font-mono text-slate-300 font-semibold"
                        data-testid={`signal-price-${index}`}
                      >
                        {formatCurrency(signal.price)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {signal.momentumLabel && (
                        <span
                          className="text-xs bg-accent-purple/30 text-accent-purple px-2 py-0.5 rounded-full font-mono"
                          title="Momentum Label"
                        >
                          {signal.momentumLabel}
                        </span>
                      )}
                      {signal.regimeState && (
                        <span
                          className="text-xs bg-info/30 text-info px-2 py-0.5 rounded-full font-mono"
                          title="Regime State"
                        >
                          {signal.regimeState}
                        </span>
                      )}
                      {signal.legacyLabel && (
                        <span
                          className="text-xs bg-warning/30 text-warning px-2 py-0.5 rounded-full font-mono"
                          title="Legacy Label"
                        >
                          {signal.legacyLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400">Strength</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              signal.type === 'BUY' ? 'bg-green-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${signal.strength * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-mono ${
                            signal.type === 'BUY' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {(signal.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400">Confidence</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${signal.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-info">
                          {(signal.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">{signal.reasoning.join(', ')}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
                      <div className="text-xs">
                        <span className="text-gray-400">R/R:</span>
                        <span className="text-warning font-mono ml-1">{signal.riskReward.toFixed(1)}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-400">Time:</span>
                        <span className="text-gray-300 font-mono ml-1">
                          {new Date(signal.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {signals.length === 0 && !signalsLoading && !signalsError && (
                  <div className="text-center py-8 text-gray-400">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No signals detected</p>
                    <p className="text-xs">Scanning markets...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold mb-3 text-white">Market Sentiment</h3>
              <div className="space-y-4">
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Fear & Greed</span>
                    <span className="text-xs font-mono text-yellow-400" data-testid="fear-greed-index">
                      {fearGreedIndex}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gradient-to-r from-bearish via-warning to-bullish rounded-full relative">
                    <div
                      className="absolute top-0 w-1 h-2 bg-white rounded-full"
                      style={{ left: `${fearGreedIndex}%` }}
                    />
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">BTC Dominance</span>
                    <span className="text-xs font-mono text-blue-400" data-testid="btc-dominance">
                      {btcDominance.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full"
                      style={{ width: `${btcDominance}%` }}
                    />
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Total Market Cap</div>
                      <div className="text-sm font-mono text-white" data-testid="total-market-cap">
                        ${totalMarketCap.toFixed(2)}T
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">24h Vol</div>
                      <div className="text-sm font-mono text-slate-300" data-testid="volume-24h">
                        ${volume24h.toFixed(1)}B
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold mb-3 text-white">Signal Distribution</h3>
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-bullish rounded-full"></div>
                      <span className="text-sm">Strong Buy</span>
                    </div>
                    <span className="text-sm font-mono" data-testid="strong-buy-count">
                      {signalCounts?.strongBuy || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="text-sm">Buy</span>
                    </div>
                    <span className="text-sm font-mono" data-testid="buy-count">
                      {signalCounts?.buy || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-sm">Hold</span>
                    </div>
                    <span className="text-sm font-mono" data-testid="hold-count">
                      {signalCounts?.hold || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <span className="text-sm">Sell</span>
                    </div>
                    <span className="text-sm font-mono" data-testid="sell-count">
                      {signalCounts?.sell || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-bearish rounded-full"></div>
                      <span className="text-sm">Strong Sell</span>
                    </div>
                    <span className="text-sm font-mono" data-testid="strong-sell-count">
                      {signalCounts?.strongSell || 0}
                    </span>
                  </div>
                </div>
              </ErrorBoundary>
            </div>
          </div>
        </ErrorBoundary>

        {/* Main Content Area */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="flex-1 flex flex-col" aria-label="Main Content Area">
            <div className="flex-1 bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative" data-symbol-search>
                    <button
                      onClick={() => setShowSymbolSearch(!showSymbolSearch)}
                      className="flex items-center space-x-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all group"
                      aria-label="Select trading symbol"
                      aria-expanded={showSymbolSearch ? 'true' : 'false'}
                    >
                      <h2 className="text-xl font-bold font-mono" data-testid="selected-symbol">
                        {selectedSymbol}
                      </h2>
                      <Search className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                    {showSymbolSearch && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="text-xs text-slate-400 px-3 py-2 border-b border-slate-700 mb-2">
                          Select Symbol
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ARB/USDT', 'OP/USDT'].map(sym => (
                            <button
                              key={sym}
                              onClick={() => {
                                setSelectedSymbol(sym);
                                setShowSymbolSearch(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded text-sm font-mono transition-all ${
                                sym === selectedSymbol 
                                  ? 'bg-blue-600 text-white font-semibold' 
                                  : 'hover:bg-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span
                    className="px-2 py-1 rounded bg-slate-800/50 text-xs font-mono border border-slate-700/50"
                    data-testid="selected-exchange-chart"
                  >
                    {selectedExchange.charAt(0).toUpperCase() + selectedExchange.slice(1)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-mono text-white" data-testid="current-price">
                      {chartData.length > 0 
                        ? formatCurrency(chartData[chartData.length - 1]?.close || currentPrice)
                        : formatCurrency(currentPrice)}
                    </span>
                    <span
                      className={`text-sm font-mono ${
                        priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                      data-testid="price-change"
                    >
                      {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)} (
                      {formatPercent(priceChangePercent)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                    {['1m', '5m', '1h', '1d', '1w'].map((timeframe) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          selectedTimeframe === timeframe
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        data-testid={`timeframe-${timeframe}`}
                        aria-label={`Select ${timeframe} timeframe`}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>
                  <select
                    className="ml-2 px-3 py-1 text-xs rounded bg-slate-800/50 text-white border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={selectedExchange}
                    onChange={e => setSelectedExchange(e.target.value)}
                    data-testid="exchange-selector"
                    aria-label="Select Exchange"
                  >
                    {availableExchanges.map(ex => (
                      <option key={ex} value={ex}>
                        {ex.charAt(0).toUpperCase() + ex.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                    data-testid="chart-settings"
                    aria-label="Chart Settings"
                  >
                    <BarChart3 className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                    data-testid="chart-fullscreen"
                    aria-label="Toggle Fullscreen Chart"
                  >
                    <ExpandIcon className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="h-[calc(100%-4rem)] chart-container">
                {chartError ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/20">
                        <div className="w-8 h-8 rounded-full bg-yellow-500"></div>
                      </div>
                      <div className="text-lg font-semibold mb-2 text-slate-200">Chart Data Unavailable</div>
                      <div className="text-sm text-slate-400 mb-4">
                        {chartError instanceof Error ? chartError.message : 'Failed to load chart data. This might be due to rate limits or network issues.'}
                      </div>
                      <button
                        onClick={() => refetchChart()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center space-x-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry</span>
                      </button>
                      <p className="text-xs text-slate-500 mt-3">Or select a different symbol from the dropdown</p>
                    </div>
                  </div>
                ) : isChartLoading && chartData.length === 0 ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-slate-400 font-medium">Loading chart data from CoinGecko...</p>
                      <p className="text-xs text-slate-500 mt-2">Fetching {selectedSymbol} candlestick data</p>
                    </div>
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="w-full h-full flex gap-3">
                    {/* Main Chart Area - Left Side */}
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Enhanced Asset Info Header */}
                      <div className="bg-gradient-to-r from-slate-800/60 to-slate-800/40 rounded-lg p-3 mb-3 border border-slate-700/50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            {/* Asset Icon */}
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                              <span className="text-lg font-bold text-white">
                                {selectedSymbol.split('/')[0].substring(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-bold text-white">{selectedSymbol.split('/')[0]}</h3>
                                <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded">
                                  {selectedSymbol.split('/')[1]}
                                </span>
                                <div className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-xs font-mono text-green-400">
                                  ⚡ Live
                                </div>
                              </div>
                              <div className="flex items-center space-x-3 mt-1">
                                <span className="text-2xl font-mono font-bold text-white">
                                  ${chartData[chartData.length - 1]?.close?.toFixed(2) || '0.00'}
                                </span>
                                <span className={`text-sm font-mono px-2 py-1 rounded ${
                                  priceChangePercent >= 0 
                                    ? 'bg-green-500/10 text-green-400' 
                                    : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-2 gap-3 text-right">
                            <div>
                              <div className="text-xs text-slate-400">24h High</div>
                              <div className="text-sm font-mono font-bold text-green-400">
                                ${Math.max(...chartData.map(d => d.high)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">24h Low</div>
                              <div className="text-sm font-mono font-bold text-red-400">
                                ${Math.min(...chartData.map(d => d.low)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">24h Volume</div>
                              <div className="text-sm font-mono font-bold text-blue-400">
                                ${(chartData.reduce((sum, d) => sum + d.volume, 0) / 1e6).toFixed(2)}M
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">Candles</div>
                              <div className="text-sm font-mono font-bold text-purple-400">
                                {chartData.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chart Container */}
                      <div className="flex-1 min-h-0 bg-slate-800/20 rounded-lg border border-slate-700/50 p-2">
                        <TradingChart
                          data={chartData}
                          showVolume={true}
                          showRSI={chartData.some(d => d.rsi !== null)}
                          showMACD={chartData.some(d => d.macd !== null)}
                          showEMA={chartData.some(d => d.ema !== null)}
                          timeframe={selectedTimeframe}
                          height={600}
                          maxCandles={200}
                        />
                      </div>
                    </div>

                    {/* Right Side - Technical Indicators & Data */}
                    <div className="w-72 flex flex-col space-y-3 overflow-y-auto">
                      {/* Technical Indicators Panel */}
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                          <BarChart3 className="w-4 h-4 mr-2 text-blue-400" />
                          Technical Indicators
                        </h4>
                        <div className="space-y-3">
                          {/* RSI Indicator */}
                          {chartData[chartData.length - 1]?.rsi && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">RSI (14)</span>
                                <span className={`text-lg font-mono font-bold ${
                                  (chartData[chartData.length - 1]?.rsi || 50) > 70 ? 'text-red-400' :
                                  (chartData[chartData.length - 1]?.rsi || 50) < 30 ? 'text-green-400' : 'text-yellow-400'
                                }`}>
                                  {chartData[chartData.length - 1]?.rsi?.toFixed(1)}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    (chartData[chartData.length - 1]?.rsi || 50) > 70 ? 'bg-red-400' :
                                    (chartData[chartData.length - 1]?.rsi || 50) < 30 ? 'bg-green-400' : 'bg-yellow-400'
                                  }`}
                                  style={{ width: `${chartData[chartData.length - 1]?.rsi}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>Oversold</span>
                                <span>Neutral</span>
                                <span>Overbought</span>
                              </div>
                              <div className="mt-2 text-xs">
                                <span className={`px-2 py-1 rounded ${
                                  (chartData[chartData.length - 1]?.rsi || 50) > 70 ? 'bg-red-500/20 text-red-400' :
                                  (chartData[chartData.length - 1]?.rsi || 50) < 30 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {(chartData[chartData.length - 1]?.rsi || 50) > 70 ? '🔴 Overbought' :
                                   (chartData[chartData.length - 1]?.rsi || 50) < 30 ? '🟢 Oversold' : '🟡 Neutral'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* MACD Indicator */}
                          {chartData[chartData.length - 1]?.macd && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">MACD</span>
                                <span className={`text-sm font-mono font-bold ${
                                  chartData[chartData.length - 1]?.macd! > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {chartData[chartData.length - 1]?.macd?.toFixed(4)}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Signal:</span>
                                  <span className="text-slate-300 font-mono">Calculating...</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Histogram:</span>
                                  <span className="text-slate-300 font-mono">Calculating...</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Volume Analysis */}
                          <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-400">Volume Profile</span>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-500">Avg Volume</span>
                                  <span className="text-slate-300 font-mono">
                                    ${(chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length / 1e6).toFixed(2)}M
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Current</span>
                                  <span className={`font-mono font-bold ${
                                    chartData[chartData.length - 1]?.volume > (chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length)
                                      ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    ${(chartData[chartData.length - 1]?.volume / 1e6).toFixed(2)}M
                                  </span>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-slate-700/50">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  chartData[chartData.length - 1]?.volume > (chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length)
                                    ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {chartData[chartData.length - 1]?.volume > (chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length)
                                    ? '📈 Above Average' : '📉 Below Average'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* EMA Indicator */}
                          {chartData[chartData.length - 1]?.ema && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">EMA (20)</span>
                                <span className="text-sm font-mono font-bold text-purple-400">
                                  ${chartData[chartData.length - 1]?.ema?.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Current Price:</span>
                                  <span className="text-slate-300 font-mono">
                                    ${chartData[chartData.length - 1]?.close?.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Distance:</span>
                                  <span className={`font-mono font-bold ${
                                    chartData[chartData.length - 1]?.close! > chartData[chartData.length - 1]?.ema!
                                      ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {(((chartData[chartData.length - 1]?.close! - chartData[chartData.length - 1]?.ema!) / 
                                      chartData[chartData.length - 1]?.ema!) * 100).toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Market Statistics Panel */}
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                          <Target className="w-4 h-4 mr-2 text-purple-400" />
                          Market Statistics
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                            <span className="text-slate-400">24h Range</span>
                            <span className="font-mono text-slate-200">
                              ${Math.min(...chartData.map(d => d.low)).toFixed(2)} - ${Math.max(...chartData.map(d => d.high)).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                            <span className="text-slate-400">Price Change</span>
                            <span className={`font-mono font-bold ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                            <span className="text-slate-400">Total Volume</span>
                            <span className="font-mono text-blue-400 font-bold">
                              ${(chartData.reduce((sum, d) => sum + d.volume, 0) / 1e9).toFixed(3)}B
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                            <span className="text-slate-400">Timeframe</span>
                            <span className="font-mono text-slate-200">{selectedTimeframe}</span>
                          </div>
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-slate-400">Data Source</span>
                            <span className="text-green-400 font-medium">CoinGecko</span>
                          </div>
                        </div>
                      </div>

                      {/* Price Levels Panel */}
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                          <Layers className="w-4 h-4 mr-2 text-yellow-400" />
                          Key Levels
                        </h4>
                        <div className="space-y-2">
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-red-400 font-medium">Resistance</span>
                              <span className="text-sm font-mono font-bold text-red-400">
                                ${Math.max(...chartData.map(d => d.high)).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-red-400/70 mt-1">
                              +{(((Math.max(...chartData.map(d => d.high)) - chartData[chartData.length - 1]?.close!) / 
                                chartData[chartData.length - 1]?.close!) * 100).toFixed(2)}% away
                            </div>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-blue-400 font-medium">Current</span>
                              <span className="text-sm font-mono font-bold text-blue-400">
                                ${chartData[chartData.length - 1]?.close?.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-blue-400/70 mt-1">
                              Live price
                            </div>
                          </div>
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-green-400 font-medium">Support</span>
                              <span className="text-sm font-mono font-bold text-green-400">
                                ${Math.min(...chartData.map(d => d.low)).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-green-400/70 mt-1">
                              {(((chartData[chartData.length - 1]?.close! - Math.min(...chartData.map(d => d.low))) / 
                                chartData[chartData.length - 1]?.close!) * 100).toFixed(2)}% away
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Flow Field Panel */}
                      <div className="bg-gradient-to-br from-indigo-900/40 via-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-white flex items-center">
                            <Waves className="w-4 h-4 mr-2 text-indigo-400" />
                            Flow Field Analysis
                          </h4>
                          {flowFieldLoading && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400"></div>
                          )}
                        </div>
                        
                        {flowFieldData ? (
                          <div className="space-y-3">
                            {/* Force Indicator */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400 flex items-center">
                                  {flowFieldData.dominantDirection === 'bullish' ? <Activity className="w-3 h-3 mr-1 text-green-400" /> :
                                   flowFieldData.dominantDirection === 'bearish' ? <Activity className="w-3 h-3 mr-1 text-red-400" /> :
                                   <Activity className="w-3 h-3 mr-1 text-yellow-400" />}
                                  Force
                                </span>
                                <span className={`text-sm font-mono font-bold ${
                                  flowFieldData.dominantDirection === 'bullish' ? 'text-green-400' :
                                  flowFieldData.dominantDirection === 'bearish' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                  {(flowFieldData.latestForce * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                Avg: {(flowFieldData.averageForce * 100).toFixed(2)}%
                              </div>
                              <div className="mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  flowFieldData.dominantDirection === 'bullish' ? 'bg-green-500/20 text-green-400' :
                                  flowFieldData.dominantDirection === 'bearish' ? 'bg-red-500/20 text-red-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {flowFieldData.dominantDirection === 'bullish' ? '🟢 Bullish' :
                                   flowFieldData.dominantDirection === 'bearish' ? '🔴 Bearish' : '🟡 Neutral'}
                                </span>
                              </div>
                            </div>

                            {/* Pressure Indicator */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Pressure</span>
                                <span className={`text-sm font-mono font-bold ${
                                  flowFieldData.pressureTrend === 'rising' ? 'text-orange-400' : 'text-cyan-400'
                                }`}>
                                  {(flowFieldData.pressure * 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  flowFieldData.pressureTrend === 'rising' ? 'bg-orange-500/20 text-orange-400' :
                                  flowFieldData.pressureTrend === 'falling' ? 'bg-cyan-500/20 text-cyan-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {flowFieldData.pressureTrend === 'rising' ? '📈 Rising' :
                                   flowFieldData.pressureTrend === 'falling' ? '📉 Falling' : '➡️ Stable'}
                                </span>
                              </div>
                            </div>

                            {/* Turbulence Indicator */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400 flex items-center">
                                  <Wind className="w-3 h-3 mr-1" />
                                  Turbulence
                                </span>
                                <span className="text-sm font-mono font-bold text-purple-400">
                                  {(flowFieldData.turbulence * 10000).toFixed(2)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  flowFieldData.turbulenceLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                                  flowFieldData.turbulenceLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  flowFieldData.turbulenceLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {flowFieldData.turbulenceLevel === 'low' ? '🟢 Low' :
                                   flowFieldData.turbulenceLevel === 'medium' ? '🟡 Medium' :
                                   flowFieldData.turbulenceLevel === 'high' ? '🟠 High' : '🔴 Extreme'}
                                </span>
                              </div>
                            </div>

                            {/* Energy Gradient */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Energy</span>
                                <span className="text-sm font-mono font-bold text-blue-400">
                                  {(flowFieldData.energyGradient * 1000).toFixed(2)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  flowFieldData.energyTrend === 'accelerating' ? 'bg-blue-500/20 text-blue-400' :
                                  flowFieldData.energyTrend === 'decelerating' ? 'bg-purple-500/20 text-purple-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {flowFieldData.energyTrend === 'accelerating' ? '⚡ Accelerating' :
                                   flowFieldData.energyTrend === 'decelerating' ? '🔻 Decelerating' : '➡️ Stable'}
                                </span>
                              </div>
                            </div>

                            {/* View Full Analysis Link */}
                            <button
                              onClick={() => window.open(`/flow-field?symbol=${selectedSymbol}`, '_blank')}
                              className="w-full mt-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center space-x-2"
                            >
                              <Waves className="w-3 h-3" />
                              <span>View Full Flow Field</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Wind className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-slate-500">
                              {flowFieldLoading ? 'Computing flow field...' : 'Flow field data unavailable'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* ML Predictions Panel */}
                      <div className="bg-gradient-to-br from-purple-900/40 via-slate-800/60 to-slate-800/40 rounded-lg p-4 border border-purple-500/30 shadow-lg shadow-purple-500/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-white flex items-center">
                            <Brain className="w-4 h-4 mr-2 text-purple-400" />
                            ML Predictions
                          </h4>
                          {mlLoading && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400"></div>
                          )}
                        </div>

                        {mlPredictions ? (
                          <div className="space-y-3">
                            {/* Direction Prediction */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Next Candle</span>
                                <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${
                                  mlPredictions.direction.prediction === 'bullish' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {mlPredictions.direction.prediction === 'bullish' ? '🟢 BULLISH' : '🔴 BEARISH'}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Probability:</span>
                                  <span className="text-white font-mono">
                                    {(mlPredictions.direction.probability * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Confidence:</span>
                                  <span className="text-purple-400 font-mono font-bold">
                                    {(mlPredictions.direction.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-2">
                                  <div
                                    className="h-full bg-purple-400 rounded-full transition-all"
                                    style={{ width: `${mlPredictions.direction.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Price Prediction */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Price Target</span>
                                <span className="text-sm font-mono font-bold text-cyan-400">
                                  ${mlPredictions.price.predicted.toFixed(2)}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Change:</span>
                                  <span className={`font-mono font-bold ${
                                    mlPredictions.price.percentChange >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mlPredictions.price.percentChange >= 0 ? '+' : ''}
                                    {mlPredictions.price.percentChange.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Range:</span>
                                  <span className="text-slate-300 font-mono">
                                    ${mlPredictions.price.low.toFixed(2)} - ${mlPredictions.price.high.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Confidence:</span>
                                  <span className="text-cyan-400 font-mono">
                                    {(mlPredictions.price.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Volatility Prediction */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Volatility</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  mlPredictions.volatility.level === 'low' ? 'bg-green-500/20 text-green-400' :
                                  mlPredictions.volatility.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  mlPredictions.volatility.level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {mlPredictions.volatility.level.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                Predicted: {(mlPredictions.volatility.predicted * 100).toFixed(2)}%
                              </div>
                            </div>

                            {/* Risk Assessment */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Risk Level</span>
                                <span className={`text-sm font-mono font-bold ${
                                  mlPredictions.risk.level === 'low' ? 'text-green-400' :
                                  mlPredictions.risk.level === 'medium' ? 'text-yellow-400' :
                                  mlPredictions.risk.level === 'high' ? 'text-orange-400' :
                                  'text-red-400'
                                }`}>
                                  {mlPredictions.risk.score}/100
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    mlPredictions.risk.level === 'low' ? 'bg-green-400' :
                                    mlPredictions.risk.level === 'medium' ? 'bg-yellow-400' :
                                    mlPredictions.risk.level === 'high' ? 'bg-orange-400' :
                                    'bg-red-400'
                                  }`}
                                  style={{ width: `${mlPredictions.risk.score}%` }}
                                />
                              </div>
                              <div className="space-y-1">
                                {mlPredictions.risk.factors.slice(0, 2).map((factor, i) => (
                                  <div key={i} className="text-xs text-slate-400 flex items-start">
                                    <span className="mr-1">•</span>
                                    <span>{factor}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Model Info */}
                            <div className="text-xs text-center text-slate-500 pt-2 border-t border-slate-700/50">
                              4 ML models • Updated every 45s
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-slate-500">
                              {mlLoading ? 'Computing predictions...' : 'ML predictions unavailable'}
                            </p>
                            {!mlLoading && chartData.length < 20 && (
                              <p className="text-xs text-slate-600 mt-1">
                                Need 20+ candles for predictions
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="mb-4">
                        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                          isConnected ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'
                        }`}>
                          <div className={`w-8 h-8 rounded-full ${
                            isConnected ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                      </div>
                        <div className="text-lg font-semibold mb-2">
                          {isConnected ? 'Connected to Scanner' : 'Connecting to Scanner...'}
                        </div>
                        <div className="text-sm text-gray-500 mb-4">
                          {isConnected 
                            ? `Waiting for ${selectedSymbol} data from ${selectedExchange}` 
                            : 'Establishing WebSocket connection...'
                          }
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        WebSocket Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        {/* Right Sidebar - Portfolio Summary */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="w-80 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border-l border-slate-700/50 flex flex-col" aria-label="Portfolio Sidebar">
            {/* Portfolio Header */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Portfolio Summary</h3>
                <button
                  onClick={() => setLocation('/portfolio')}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View Details →
                </button>
              </div>
            </div>

            {/* Portfolio Metrics */}
            <div className="p-4 space-y-4 flex-1">
              {/* Total Return */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total Return</span>
                  <span className={`text-lg font-semibold ${
                    (portfolioSummary?.metrics?.totalReturn ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {((portfolioSummary?.metrics?.totalReturn ?? 0) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Current Balance */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Current Balance</span>
                  <span className="text-white font-semibold">
                    ${((portfolioSummary?.metrics?.currentBalance ?? 10000)).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Win Rate */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Win Rate</span>
                  <span className="text-white font-semibold">
                    {((portfolioSummary?.metrics?.winRate ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Total Trades */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total Trades</span>
                  <span className="text-white font-semibold">
                    {portfolioSummary?.metrics?.totalTrades ?? 0}
                  </span>
                </div>
              </div>

              {/* Max Drawdown */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Max Drawdown</span>
                  <span className="text-red-400 font-semibold">
                    {((portfolioSummary?.metrics?.maxDrawdown ?? 0) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Sharpe Ratio */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Sharpe Ratio</span>
                  <span className="text-white font-semibold">
                    {(portfolioSummary?.metrics?.sharpeRatio ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-t border-slate-700/50">
              <button
                onClick={() => setLocation('/portfolio')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
              >
                View Full Portfolio
              </button>
            </div>
          </div>
        </ErrorBoundary>
      </main>

      {/* Status Bar */}
      <footer className="bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 px-4 py-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-slate-400">WebSocket:</span>
              <span className={isConnected ? 'text-green-400' : 'text-red-400'} data-testid="connection-status">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Exchange:</span>
              <span className="text-blue-400" data-testid="status-exchange">
                {selectedExchange}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Latency:</span>
              <span className="text-yellow-400" data-testid="status-latency">
                {exchangeStatus?.latency || 0}ms
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Portfolio:</span>
              <span className="text-white font-mono" data-testid="status-portfolio-value">
                {formatCurrency(portfolioValue)}
              </span>
              <span className={`${dayChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({formatPercent(dayChangePercent)})
              </span>
            </div>
            <div className="text-slate-400">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}