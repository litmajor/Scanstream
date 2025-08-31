import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Gauge, Search, ChartArea, Wallet, RefreshCw, Layers, Bot, Bell, Cog, BarChart3, ExpandIcon, Target } from 'lucide-react';
import { loadFrontendConfig } from '../lib/config';
import { TradingChart, ChartDataPoint } from '../components/TradingChart';
import PortfolioVisualizer from '../components/PortfolioVisualizer';

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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    wsRef.current = new WebSocket(url);
    
    wsRef.current.onopen = () => {
      setIsConnected(true);
      wsRef.current?.send(JSON.stringify({ type: 'set_exchange', exchange: exchangeRef.current }));
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [url, onMessage]);

  const setExchange = useCallback((exchange: string) => {
    exchangeRef.current = exchange;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_exchange', exchange }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  return { isConnected, setExchange };
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
  // State declarations
  const [showMVIP, setShowMVIP] = useState(false);
  const [marketData, setMarketData] = useState<MarketFrame[]>([]);
  const [currentSignals, setCurrentSignals] = useState<Signal[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>('kucoinfutures');
  const [currentPrice, setCurrentPrice] = useState(0);
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

  // WebSocket connection to dedicated port 8765
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.hostname}:8765/ws`;
  
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

  // Chart data computation
  const chartData: ChartDataPoint[] = useMemo(() => {
    const filteredData = marketData.filter(frame => frame.symbol === selectedSymbol);
    if (filteredData.length === 0) return [];
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
  }, [marketData, selectedSymbol]);

  // Current market frame
  const currentFrame = useMemo(() => {
    return marketData.filter(frame => frame.symbol === selectedSymbol).slice(-1)[0] || null;
  }, [marketData, selectedSymbol]);

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
    <div className="h-screen bg-dark-400 text-white overflow-hidden">
      {/* Top Bar */}
      <header className="bg-dark-300 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-bullish to-accent-purple rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold">QuantumScanner Pro</h1>
          </div>
          <nav className="flex items-center space-x-1" role="navigation">
            <button
              className="px-4 py-2 bg-dark-100 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-dashboard"
              aria-label="Dashboard"
            >
              <Gauge className="w-4 h-4 mr-2 inline" />
              Dashboard
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-scanner"
              aria-label="Scanner"
            >
              <Search className="w-4 h-4 mr-2 inline" />
              Scanner
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-backtest"
              aria-label="Backtest"
            >
              <ChartArea className="w-4 h-4 mr-2 inline" />
              Backtest
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-portfolio"
              aria-label="Portfolio"
            >
              <Wallet className="w-4 h-4 mr-2 inline" />
              Portfolio
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-ml"
              aria-label="ML Engine"
            >
              <Brain className="w-4 h-4 mr-2 inline" />
              ML Engine
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-timeframes"
              aria-label="Multi-Timeframe Analysis"
            >
              <Layers className="w-4 h-4 mr-2 inline" />
              Multi-TF
            </button>
            <button
              className="px-4 py-2 text-gray-400 rounded-lg text-sm font-medium hover:bg-dark-200 transition-colors"
              data-testid="nav-optimize"
              aria-label="Optimize"
            >
              <Bot className="w-4 h-4 mr-2 inline" />
              Optimize
            </button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bullish animate-pulse' : 'bg-bearish'}`} />
              <span className="text-gray-400">Market</span>
              <span
                className={`font-mono ${isConnected ? 'text-bullish' : 'text-bearish'}`}
                data-testid="market-status"
              >
                {isConnected ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="text-sm text-gray-400">|</div>
            <div className="text-sm font-mono">
              <span className="text-gray-400">BTC:</span>
              <span className="text-white">{formatCurrency(currentPrice)}</span>
              <span
                className={`ml-1 ${priceChangePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}
                data-testid="price-change"
              >
                {formatPercent(priceChangePercent)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">24h Volume</span>
              <span className="font-mono text-info">{volume24h}B</span>
            </div>
            <button
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
              data-testid="button-notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
              data-testid="button-settings"
              aria-label="Settings"
            >
              <Cog className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Market Overview */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="w-80 bg-dark-300 border-r border-gray-700 flex flex-col" aria-label="Market Overview Sidebar">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Top Signals</h2>
                <button
                  className="text-xs bg-bullish text-black px-2 py-1 rounded font-medium hover:bg-green-400 transition-colors"
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
                    <div className="h-12 bg-gray-700 rounded" />
                    <div className="h-12 bg-gray-700 rounded" />
                    <div className="h-12 bg-gray-700 rounded" />
                  </div>
                )}
                {signalsError && (
                  <button
                    className="bg-bearish text-white px-3 py-2 rounded"
                    onClick={() => refetchSignals()}
                    aria-label="Retry loading signals"
                  >
                    Retry
                  </button>
                )}
                {signals.slice(0, 3).map((signal: Signal, index: number) => (
                  <div
                    key={index}
                    className={`bg-dark-200 rounded-lg p-3 border border-gray-600 hover:border-${
                      signal.type === 'BUY' ? 'bullish' : 'bearish'
                    } transition-colors cursor-pointer`}
                    data-testid={`signal-card-${index}`}
                    tabIndex={0}
                    aria-label={`Signal card for ${signal.symbol}`}
                    role="button"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-semibold" data-testid={`signal-symbol-${index}`}>
                          {signal.symbol}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            signal.type === 'BUY' ? 'bg-bullish text-black' : 'bg-bearish text-white'
                          }`}
                          data-testid={`signal-type-${index}`}
                        >
                          {signal.type}
                        </span>
                      </div>
                      <span
                        className="text-sm font-mono text-gray-300"
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
                        <div className="w-16 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              signal.type === 'BUY' ? 'bg-bullish' : 'bg-bearish'
                            }`}
                            style={{ width: `${signal.strength * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-mono ${
                            signal.type === 'BUY' ? 'text-bullish' : 'text-bearish'
                          }`}
                        >
                          {(signal.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400">Confidence</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-info rounded-full"
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

            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold mb-3">Market Sentiment</h3>
              <div className="space-y-4">
                <div className="bg-dark-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Fear & Greed</span>
                    <span className="text-xs font-mono text-warning" data-testid="fear-greed-index">
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
                <div className="bg-dark-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">BTC Dominance</span>
                    <span className="text-xs font-mono text-info" data-testid="btc-dominance">
                      {btcDominance.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full"
                      style={{ width: `${btcDominance}%` }}
                    />
                  </div>
                </div>
                <div className="bg-dark-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Total Market Cap</div>
                      <div className="text-sm font-mono text-white" data-testid="total-market-cap">
                        ${totalMarketCap.toFixed(2)}T
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">24h Vol</div>
                      <div className="text-sm font-mono text-gray-300" data-testid="volume-24h">
                        ${volume24h.toFixed(1)}B
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold mb-3">Signal Distribution</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-bullish rounded-full"></div>
                    <span className="text-sm">Strong Buy</span>
                  </div>
                  <span className="text-sm font-mono" data-testid="strong-buy-count">
                    {signalCounts.strongBuy}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-sm">Buy</span>
                  </div>
                  <span className="text-sm font-mono" data-testid="buy-count">
                    {signalCounts.buy}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm">Hold</span>
                  </div>
                  <span className="text-sm font-mono" data-testid="hold-count">
                    {signalCounts.hold}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-sm">Sell</span>
                  </div>
                  <span className="text-sm font-mono" data-testid="sell-count">
                    {signalCounts.sell}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-bearish rounded-full"></div>
                    <span className="text-sm">Strong Sell</span>
                  </div>
                  <span className="text-sm font-mono" data-testid="strong-sell-count">
                    {signalCounts.strongSell}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ErrorBoundary>

        {/* Main Content Area */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="flex-1 flex flex-col" aria-label="Main Content Area">
            <div className="flex-1 bg-dark-300 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-bold font-mono" data-testid="selected-symbol">
                    {selectedSymbol}
                  </h2>
                  <span
                    className="ml-2 px-2 py-1 rounded bg-dark-200 text-xs font-mono border border-gray-600"
                    data-testid="selected-exchange-chart"
                  >
                    {selectedExchange.charAt(0).toUpperCase() + selectedExchange.slice(1)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-mono text-white" data-testid="current-price">
                      {formatCurrency(currentPrice)}
                    </span>
                    <span
                      className={`text-sm font-mono ${
                        priceChangePercent >= 0 ? 'text-bullish' : 'text-bearish'
                      }`}
                      data-testid="price-change"
                    >
                      {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)} (
                      {formatPercent(priceChangePercent)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex bg-dark-200 rounded-lg p-1">
                    {['1m', '5m', '1h', '1d', '1w'].map((timeframe) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          selectedTimeframe === timeframe
                            ? 'bg-bullish text-black font-medium'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        data-testid={`timeframe-${timeframe}`}
                        aria-label={`Select ${timeframe} timeframe`}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>
                  <select
                    className="ml-2 px-3 py-1 text-xs rounded bg-dark-200 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-bullish"
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
                    className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
                    data-testid="chart-settings"
                    aria-label="Chart Settings"
                  >
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
                    data-testid="chart-fullscreen"
                    aria-label="Toggle Fullscreen Chart"
                  >
                    <ExpandIcon className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="h-[calc(100%-4rem)] bg-dark-400 rounded-lg border border-gray-600 p-4 relative">
                {chartData.length > 0 ? (
                  <TradingChart
                    data={chartData}
                    showVolume={chartIndicators.showVolume}
                    showRSI={chartIndicators.showRSI}
                    showMACD={chartIndicators.showMACD}
                    showEMA={chartIndicators.showEMA}
                    showPatterns={chartIndicators.showPatterns}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-pulse mb-4">
                        <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4"></div>
                        <div className="w-32 h-4 bg-gray-700 rounded mx-auto mb-2"></div>
                        <div className="w-24 h-3 bg-gray-700 rounded mx-auto"></div>
                      </div>
                      <p className="text-gray-400 text-sm">Loading chart data...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        {/* Right Sidebar - Portfolio & Performance */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="w-80 bg-dark-300 border-l border-gray-700 flex flex-col" aria-label="Portfolio Sidebar">
            <PortfolioVisualizer
              data={{
                equityCurve: portfolioSummary?.equityCurve?.map((pt: any) => ({
                  date: pt.timestamp ? new Date(pt.timestamp) : new Date(),
                  value: pt.value ?? 0,
                })) || [],
                metrics: {
                  totalReturn: portfolioSummary?.metrics?.totalReturn ?? 0,
                  annualizedReturn: portfolioSummary?.metrics?.annualizedReturn ?? 0,
                  winRate: portfolioSummary?.metrics?.winRate ?? 0,
                  avgWin: portfolioSummary?.metrics?.avgWin ?? 0,
                  avgLoss: portfolioSummary?.metrics?.avgLoss ?? 0,
                  profitFactor: portfolioSummary?.metrics?.profitFactor ?? 0,
                  totalTrades: portfolioSummary?.metrics?.totalTrades ?? 0,
                  maxDrawdown: portfolioSummary?.metrics?.maxDrawdown ?? 0,
                  averageDrawdown: portfolioSummary?.metrics?.averageDrawdown ?? 0,
                  maxDrawdownDuration: portfolioSummary?.metrics?.maxDrawdownDuration ?? 0,
                  yearlyReturns: (typeof portfolioSummary?.metrics?.yearlyReturns === 'object' && portfolioSummary?.metrics?.yearlyReturns !== null)
                    ? portfolioSummary.metrics.yearlyReturns as Record<string, number>
                    : {},
                  sharpeRatio: portfolioSummary?.metrics?.sharpeRatio ?? 0,
                  sortinoRatio: portfolioSummary?.metrics?.sortinoRatio ?? 0,
                  calmarRatio: portfolioSummary?.metrics?.calmarRatio ?? 0,
                  volatility: portfolioSummary?.metrics?.volatility ?? 0,
                  kelly: portfolioSummary?.metrics?.kelly ?? 0,
                  var95: portfolioSummary?.metrics?.var95 ?? 0,
                  cvar95: portfolioSummary?.metrics?.cvar95 ?? 0,
                  consecutiveWins: portfolioSummary?.metrics?.consecutiveWins ?? 0,
                  consecutiveLosses: portfolioSummary?.metrics?.consecutiveLosses ?? 0,
                  largestWin: portfolioSummary?.metrics?.largestWin ?? 0,
                  largestLoss: portfolioSummary?.metrics?.largestLoss ?? 0,
                  avgTradeDuration: portfolioSummary?.metrics?.avgTradeDuration ?? 0,
                  monthlyReturns: (typeof portfolioSummary?.metrics?.monthlyReturns === 'object' && portfolioSummary?.metrics?.monthlyReturns !== null)
                    ? portfolioSummary.metrics.monthlyReturns as Record<string, number>
                    : {},
                },
                trades: [],
                drawdownPeriods: [],
                monteCarloResults: {
                  percentiles: {},
                  probabilityOfProfit: 0,
                  worstCase: 0,
                  bestCase: 0,
                },
              }}
            />
          </div>
        </ErrorBoundary>
      </main>

      {/* Status Bar */}
      <footer className="bg-dark-400 border-t border-gray-700 px-4 py-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bullish animate-pulse' : 'bg-bearish'}`} />
              <span className="text-gray-400">WebSocket:</span>
              <span className={isConnected ? 'text-bullish' : 'text-bearish'} data-testid="connection-status">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">Exchange:</span>
              <span className="text-info" data-testid="status-exchange">
                {selectedExchange}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">Latency:</span>
              <span className="text-warning" data-testid="status-latency">
                {exchangeStatus?.latency || 0}ms
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">Portfolio:</span>
              <span className="text-white font-mono" data-testid="status-portfolio-value">
                {formatCurrency(portfolioValue)}
              </span>
              <span className={`${dayChangePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                ({formatPercent(dayChangePercent)})
              </span>
            </div>
            <div className="text-gray-400">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}