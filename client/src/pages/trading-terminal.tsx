import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import useTickCandles from '../hooks/useTickCandles';
import { useSymbolUniverse } from '../hooks/useSymbolUniverse';
import OrderbookPanel from '../components/OrderbookPanel';
import WorldTicksPanel from '../components/WorldTicksPanel';
import SymbolList from '../components/SymbolList';
import GlobalSummaryPanel from '../components/GlobalSummaryPanel';
import AgentPanel from '../components/AgentPanel';
import EventFeedPanel from '../components/EventFeedPanel';
import AnalyticsPanel from '../components/AnalyticsPanel';
import SymbolPanel from '../components/SymbolPanel';
import marketDataLayer, { validateWorldTick as validateMDLWorldTick } from '../lib/marketDataLayer';
import { getTopItems, AttentionItem } from '../lib/attention';
import type { UITick } from '../types';
import type { MarketFrame } from '../types/MarketFrame';
import { verifyDataLayerInvariants, setInvariantEnforcement, assertUITick } from '../lib/invariants';
import { Brain, RefreshCw, Layers, Bell, Cog, BarChart3, ExpandIcon, Target, Wind, Waves, Activity, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Search, ChevronDown, Wallet, TrendingUp, TrendingDown, Clock, BookOpen, Globe } from 'lucide-react';
import { loadFrontendConfig } from '../lib/config';
import { TradingChart } from '../components/TradingChart';
import usePerformanceMark from '../hooks/usePerformanceMark';
import TerminalLayout from '../components/TerminalLayout';
import { HeroSection } from '../components/HeroSection';
import { useLocation } from 'wouter';
import { useCoinGeckoChart } from '../hooks/useCoinGeckoChart';
import { useGatewaySignals } from '../hooks/useGatewaySignals';
import { GatewaySignalCard } from '../components/GatewaySignalCard';
import MarketStatusBar from '../components/MarketStatusBar';
import PerfObserver from '../components/PerfObserver';
import ThemeSelector from '@/components/ThemeSelector';
import PanelManager from '../components/PanelManager';
import { StatCard } from '../components/cards';
import FloatingChartToolbar from '../components/FloatingChartToolbar';
import NotificationHub from '../components/NotificationHub';
import { useNotifications } from '../contexts/NotificationContext';
import QuickActionsBar from '../components/QuickActionsBar';
import QuickTradeModal from '../components/QuickTradeModal';
import TradeExecutionPanel, { TradeOrder } from '../components/TradeExecutionPanel';
import PositionManagementPanel, { Position, Order, Trade as TradeHistory } from '../components/PositionManagementPanel';
import RiskManagementPanel from '../components/RiskManagementPanel';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import { TopMoversWidget } from '../components/TopMoversWidget';
import ReplayModeBanner from '../components/ReplayModeBanner';
import ReplayModeDesaturatedWrapper from '../components/ReplayModeDesaturatedWrapper';
import ReplayModeWatermark from '../components/ReplayModeWatermark';

// Local ErrorBoundary fallback (since 'react-error-boundary' is not installed)
function ErrorBoundary({ children, FallbackComponent }: { children: React.ReactNode, FallbackComponent: React.FC<{ error: Error }> }) {
  try {
    return <>{children}</>;
  } catch (error: any) {
    return <FallbackComponent error={error} />;
  }
}

// Type aliases for compatibility
type WorldTick = UITick;


export type Signal = {
  id: string;
  symbol: string;
  type?: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';
  strength: number; // 0..1
  price?: number;
  timestamp?: number;
  indicators?: Record<string, any>;
  marketMicrostructure: {
    spread: number;
    depth: number;
    imbalance: number;
    toxicity: number;
  };
  // Extended signal properties
  confidence?: number;
  momentum?: number;
  momentumLabel?: string;
  regimeState?: string;
  legacyLabel?: string;
  reasoning?: string[];
  riskReward?: number;
  stopLoss?: number;
  takeProfit?: number;
  signalStrengthScore?: number;
};

// Orderbook describes bid/ask levels
interface Orderbook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

// Chart data point type
type ChartPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number | null;
  macd?: { line: number; signal: number; histogram: number } | null;
  ema?: number | null;
};

// Trade type
type Trade = {
  id: string;
  symbol: string;
  entry_price: number;
  entry_time: number;
  exit_price?: number;
  exit_time?: number;
  size: number;
  side: 'long' | 'short';
  status: 'open' | 'closed' | 'pending';
  pnl?: number;
  pnl_percent?: number;
};

// Market Sentiment type
type MarketSentiment = {
  fear_greed_index: number;
  fearGreedIndex?: number;
  btc_dominance: number;
  btcDominance?: number;
  total_market_cap: number;
  totalMarketCap?: number;
  volume_24h: number;
  volume24h?: number;
  market_direction: 'bullish' | 'bearish' | 'neutral';
  updated_at: number;
};

// Portfolio Data type
type PortfolioData = {
  total_value: number;
  totalValue?: number;
  available_cash: number;
  availableCash?: number;
  buying_power: number;
  daily_change: number;
  dayChange?: number;
  daily_change_percent: number;
  dayChangePercent?: number;
  metrics?: {
    totalReturn?: number;
    winRate?: number;
    maxDrawdown?: number;
    currentBalance?: number;
    totalTrades?: number;
    sharpeRatio?: number;
  };
  positions: Array<{
    symbol: string;
    quantity: number;
    entry_price: number;
    current_price: number;
    unrealized_pnl: number;
    unrealized_pnl_percent: number;
  }>;
};

// Exchange Status type
type ExchangeStatus = {
  exchange: string;
  status: 'online' | 'offline' | 'degraded';
  last_update: number;
  trading_pairs: number;
  api_latency_ms: number;
  isOperational: boolean;
  latency: number;
};

// ML Insights type
type MLInsights = {
  prediction: 'up' | 'down' | 'neutral';
  confidence: number;
  model_version: string;
  updated_at: number;
  signals: Array<{ symbol: string; score: number }>;
};

// Multi-timeframe Analysis type
type MultiTimeframeAnalysis = {
  symbol: string;
  timeframes: Array<{
    tf: string;
    trend: 'up' | 'down' | 'sideways';
    strength: number;
    support: number;
    resistance: number;
  }>;
  overall_trend: 'up' | 'down' | 'sideways';
  score: number;
  updated_at: number;
};

// --- Custom WebSocket hook ---
function useWebSocket(url: string, onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  // In browser environments setTimeout returns a number ID
  const reconnectTimerRef = useRef<number | null>(null);
  const onMessageRef = useRef<(data: any) => void>(onMessage); // Store callback in ref to avoid reconnections
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // Start with 1 second
  const reconnectAttemptsRef = useRef(0); // Track reconnection attempts
  const exchangeRef = useRef('binance'); // Default exchange

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
          reconnectTimerRef.current = window.setTimeout(() => {
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
      window.clearTimeout(reconnectTimerRef.current);
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

// Helper function to map incoming UITick to WorldTick format
const mapIncomingTick = (tick: UITick): WorldTick => {
  return {
    ...tick,
    symbol: tick.symbol || 'UNKNOWN',
    volume: tick.volume || 0,
    state: tick.state || { mode: 'LIVE' },
  } as WorldTick;
};

// Enhanced type guard for MarketFrame
const validateMarketFrame = (frame: any): frame is MarketFrame => {
  return (
    frame &&
    typeof frame.symbol === 'string' &&
    typeof frame.open === 'number' &&
    typeof frame.high === 'number' &&
    typeof frame.low === 'number' &&
    typeof frame.close === 'number' &&
    typeof frame.volume === 'number' &&
    frame.quality &&
    frame.meta &&
    typeof frame.meta.tsOpen === 'number' &&
    typeof frame.meta.tsClose === 'number'
  );
};

export default function TradingTerminal() {
  // Perf mark for the entire terminal page
  try { usePerformanceMark('TradingTerminal'); } catch (e) {}
  const [, setLocation] = useLocation();

  // Initialize invariant enforcement based on environment
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    // Enable invariant checks in dev/test, can disable in production for perf
    setInvariantEnforcement(isDev || process.env.REACT_APP_ENFORCE_INVARIANTS === 'true');
  }, []);

  // State declarations
  const [showMVIP, setShowMVIP] = useState(false);
  const [marketData, setMarketData] = useState<MarketFrame[]>([]);
  const [currentSignals, setCurrentSignals] = useState<Signal[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT'); // Fixed: Use CoinGecko format
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '1d' | '3d' | '1w' | '1month'>('1h'); // Changed to 1h for better CoinGecko data
  const [hoveredCandleTime, setHoveredCandleTime] = useState<number | null>(null);
  const [candleSignals, setCandleSignals] = useState<{ timestamp: number; signals: Signal[] } | null>(null);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>('binance');
  const [currentPrice, setCurrentPrice] = useState(0); // Will be set from real data
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [availableCash, setAvailableCash] = useState(0);
  const [dayChange, setDayChange] = useState(0);
  const [dayChangePercent, setDayChangePercent] = useState(0);
  
  // Position and Risk Management
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<TradeHistory[]>([]);
  const [dailyLoss, setDailyLoss] = useState(0);
  
  const [fearGreedIndex, setFearGreedIndex] = useState(0);
  const [btcDominance, setBtcDominance] = useState(0);
  const [totalMarketCap, setTotalMarketCap] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [gatewayOHLCV, setGatewayOHLCV] = useState<any>(null); // State for Gateway OHLCV data
  const [orderbook, setOrderbook] = useState<Orderbook>({ bids: [], asks: [] });
  const [worldTicks, setWorldTicks] = useState<WorldTick[]>([]);
  const [useFeed, setUseFeed] = useState<boolean>(true);
  // Global UI state
  const [env, setEnv] = useState<'dev' | 'prod'>('dev');
  const [workspace, setWorkspace] = useState<string>('Default');
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isLiveMode') === 'true'
    } catch (e) {
      return false
    }
  });
  const [liveEnabledConfirmed, setLiveEnabledConfirmed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('liveEnabledConfirmed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showEnableLiveModal, setShowEnableLiveModal] = useState(false);
  const [universe, setUniverse] = useState<string>('Market Universe');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>([]);
  const [showLeftRail, setShowLeftRail] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showPanelManager, setShowPanelManager] = useState<boolean>(false);
  // Replay state for Analytics -> World Tick replay
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayPlayback, setReplayPlayback] = useState<WorldTick[]>([]);
  const replaySourceRef = useRef<WorldTick[] | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const replayIndexRef = useRef<number>(0);
  const [replayIntervalMs, setReplayIntervalMs] = useState<number>(200);

  // Backfill (MDL requestReplay) UI state and handler
  const [backfillInProgress, setBackfillInProgress] = useState(false);
  const [backfillCount, setBackfillCount] = useState(0);
  const backfillCountRef = useRef(0);

  // Load pinned symbols from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pinnedSymbols');
      if (saved) setPinnedSymbols(JSON.parse(saved));
    } catch (err) {
      // ignore
    }
  }, []);

  // Load persisted env/workspace/universe
  useEffect(() => {
    try {
      const e = localStorage.getItem('env');
      const w = localStorage.getItem('workspace');
      const u = localStorage.getItem('universe');
      if (e) setEnv(e === 'prod' ? 'prod' : 'dev');
      if (w) setWorkspace(w);
      if (u) setUniverse(u);
    } catch (err) {}
  }, []);

  // Persist and load left-rail (collapsed) preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('showLeftRail');
      if (saved !== null) setShowLeftRail(JSON.parse(saved));
    } catch (err) {}
  }, []);

  // Initialize demo positions, orders, and trades for UI testing
  // Load positions/trades from backend instead of demo data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Fetch paper-trading positions (if available)
        const posResp = await fetch('/api/paper-trading/positions');
        if (posResp.ok) {
          const json = await posResp.json();
          if (mounted && json?.positions) setPositions(json.positions as Position[]);
        }

        // Fetch open trades
        const tradesResp = await fetch('/api/trades?status=OPEN');
        if (tradesResp.ok) {
          const openTrades = await tradesResp.json();
          if (mounted) setTrades(openTrades as TradeHistory[]);
        }

        // Fetch orders if endpoint exists (best-effort)
        try {
          const ordersResp = await fetch('/api/orders');
          if (ordersResp.ok) {
            const ordersJson = await ordersResp.json();
            if (mounted) setOrders(ordersJson as Order[]);
          }
        } catch (err) {
          // ignore - orders endpoint may not exist
        }

        // Fetch portfolio summary for daily loss estimate
        try {
          const portfolioResp = await fetch('/api/portfolio-summary');
          if (portfolioResp.ok) {
            const p = await portfolioResp.json();
            if (mounted) setDailyLoss(Math.max(0, p.dayChange || 0));
          }
        } catch (err) { /* ignore */ }
      } catch (err) {
        console.warn('[TradingTerminal] Failed to load positions/trades from backend', err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('showLeftRail', JSON.stringify(showLeftRail));
    } catch (err) {}
  }, [showLeftRail]);

  const togglePin = (sym: string) => {
    setPinnedSymbols(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [sym, ...prev];
      try {
        localStorage.setItem('pinnedSymbols', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

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
  // Candle clustering toggle
  const [showClustering, setShowClustering] = useState(false);
  const [clusteringData, setClusteringData] = useState<any>(null);

  // Layout control states - Load from localStorage with defaults
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => {
    const saved = localStorage.getItem('showLeftSidebar');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showRightSidebar, setShowRightSidebar] = useState(() => {
    const saved = localStorage.getItem('showRightSidebar');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [focusMode, setFocusMode] = useState(false);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const prevLeftSidebarRef = useRef<boolean | null>(null);
  const prevRightSidebarRef = useRef<boolean | null>(null);
  const prevLeftRailRef = useRef<boolean | null>(null);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      const next = !prev;
      if (next) {
        prevLeftSidebarRef.current = showLeftSidebar;
        prevRightSidebarRef.current = showRightSidebar;
        prevLeftRailRef.current = showLeftRail;
        setShowLeftSidebar(false);
        setShowRightSidebar(false);
        setShowLeftRail(false);
        setIsChartFullscreen(true);
      } else {
        if (prevLeftSidebarRef.current !== null) setShowLeftSidebar(prevLeftSidebarRef.current);
        if (prevRightSidebarRef.current !== null) setShowRightSidebar(prevRightSidebarRef.current);
        if (prevLeftRailRef.current !== null) setShowLeftRail(prevLeftRailRef.current);
        setIsChartFullscreen(false);
      }
      return next;
    });
  }, [showLeftSidebar, showRightSidebar, showLeftRail]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showQuickTradeModal, setShowQuickTradeModal] = useState(false);

  // Notifications
  const {
    notifications,
    unreadCount,
    settings,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    toggleSound,
    addNotification
  } = useNotifications();

  // Gateway Signals
  const { data: gatewaySignals = [], refetch: refetchGatewaySignals } = useGatewaySignals();

  // Symbol Universe (centralized canonical symbols)
  const { symbols: universeSymbols = [], loading: universeLoading } = useSymbolUniverse({ autoLoad: true, watchChanges: true });

  // Backfill handler
  const handleBackfill = useCallback(async () => {
    if (!selectedSymbol) {
      addNotification('system', 'low', 'Backfill failed', 'No symbol selected for backfill');
      return;
    }
    const mdSym = selectedSymbol.replace('/', '');
    setBackfillInProgress(true);
    setBackfillCount(0);
    backfillCountRef.current = 0;

    // Create temporary subscription that collects replayed ticks and updates progress
    const tmp = marketDataLayer.subscribe(mdSym, { timeframe: selectedTimeframe, includeIndicators: useFeed, rateLimitMs: 0, bufferMax: 1000 }, (tick: UITick) => {
      try {
        // Verify invariants: tick from replay should be UITick with mode='REPLAY'
        assertUITick(tick);
        verifyDataLayerInvariants(tick, { source: 'network', mode: 'backtest' });

        const mapped = mapIncomingTick(tick);
        setWorldTicks(prev => {
          const merged = [mapped, ...prev];
          return merged.slice(0, 400);
        });
        backfillCountRef.current = backfillCountRef.current + 1;
        setBackfillCount(backfillCountRef.current);
      } catch (err) {
        // log invariant violations but don't halt backfill
        console.warn('[Backfill] invariant check', err);
      }
    });

    try {
      // Request last 5 minutes by default
      const from = Date.now() - 5 * 60 * 1000;
      await tmp.requestReplay(from, Date.now());
      addNotification('system', 'low', 'Backfill complete', `Replayed ${backfillCountRef.current} ticks for ${selectedSymbol}`);
    } catch (err) {
      addNotification('system', 'high', 'Backfill failed', `${String(err)}`);
    } finally {
      try { tmp.unsubscribe(); } catch (e) {}
      setBackfillInProgress(false);
      // keep count visible briefly
      setTimeout(() => setBackfillCount(0), 2500);
    }
  }, [selectedSymbol, selectedTimeframe, useFeed, addNotification]);

  // Symbols list from world ticks, market data, and gateway signals
  const symbolsList = useMemo(() => {
    const s = new Set<string>();
    (worldTicks || []).forEach(t => t.symbol && s.add(t.symbol));
    (marketData || []).forEach(m => m.symbol && s.add(m.symbol));
    (gatewaySignals || []).forEach(g => g.symbol && s.add(g.symbol));
    return Array.from(s).sort();
  }, [worldTicks, marketData, gatewaySignals]);

  // Auto-hide timer refs
  const leftSidebarTimerRef = useRef<number | null>(null);
  const rightSidebarTimerRef = useRef<number | null>(null);
  const AUTO_HIDE_DELAY = 30000; // 30 seconds

  // Save sidebar preferences to localStorage
  useEffect(() => {
    localStorage.setItem('showLeftSidebar', JSON.stringify(showLeftSidebar));
  }, [showLeftSidebar]);

  useEffect(() => {
    localStorage.setItem('showRightSidebar', JSON.stringify(showRightSidebar));
  }, [showRightSidebar]);

  // Demo/test notifications removed — intentionally no mocked alerts injected here
  useEffect(() => {
    // intentionally blank
  }, []);

  // Keyboard shortcuts: S for Signals, P for Portfolio, F for Fullscreen, 1-5 for Timeframes
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Sidebar toggles
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowLeftSidebar((prev: boolean) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setShowRightSidebar((prev: boolean) => !prev);
      }

      // Chart fullscreen
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsChartFullscreen(prev => !prev);
      }

      // Shift+F toggles Focus Mode (preserves sidebars)
      else if ((e.shiftKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        toggleFocusMode();
      }

      // ESC to exit fullscreen
      else if (e.key === 'Escape' && isChartFullscreen) {
        setIsChartFullscreen(false);
      }

      // Timeframe shortcuts (1-9, 0 for quick access to common timeframes)
      else if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(e.key)) {
        e.preventDefault();
        const timeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '1d', '1w'] as const;
        const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
        if (idx < timeframes.length) setSelectedTimeframe(timeframes[idx]);
      }

      // Quick Actions shortcut (Q)
      else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQuickActions(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isChartFullscreen]);

  // Auto-hide functionality for left sidebar
  const resetLeftSidebarTimer = useCallback(() => {
    if (leftSidebarTimerRef.current) {
      window.clearTimeout(leftSidebarTimerRef.current);
    }
    leftSidebarTimerRef.current = window.setTimeout(() => {
      setShowLeftSidebar(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  // Auto-hide functionality for right sidebar
  const resetRightSidebarTimer = useCallback(() => {
    if (rightSidebarTimerRef.current) {
      window.clearTimeout(rightSidebarTimerRef.current);
    }
    rightSidebarTimerRef.current = window.setTimeout(() => {
      setShowRightSidebar(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  // Setup auto-hide when sidebars are opened
  useEffect(() => {
    if (showLeftSidebar) {
      resetLeftSidebarTimer();
    } else if (leftSidebarTimerRef.current) {
      clearTimeout(leftSidebarTimerRef.current);
    }
    return () => {
      if (leftSidebarTimerRef.current) {
        clearTimeout(leftSidebarTimerRef.current);
      }
    };
  }, [showLeftSidebar, resetLeftSidebarTimer]);

  useEffect(() => {
    if (showRightSidebar) {
      resetRightSidebarTimer();
    } else if (rightSidebarTimerRef.current) {
      clearTimeout(rightSidebarTimerRef.current);
    }
    return () => {
      if (rightSidebarTimerRef.current) {
        clearTimeout(rightSidebarTimerRef.current);
      }
    };
  }, [showRightSidebar, resetRightSidebarTimer]);

  // Signal details opener (listens to SignalCard CTA events)
  const [openSignalDetails, setOpenSignalDetails] = useState<{ symbol: string; signal?: string } | null>(null);

  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const ce = ev as CustomEvent;
        const payload = ce.detail || {};
        if (payload.symbol) {
          setSelectedSymbol(payload.symbol);
          setShowRightSidebar(true);
          setOpenSignalDetails({ symbol: payload.symbol, signal: payload.signal });
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('scanstream:openSignalDetails', handler as EventListener);
    return () => window.removeEventListener('scanstream:openSignalDetails', handler as EventListener);
  }, []);

  // Preview chart data for Signal Details (always call hooks at top-level)
  const previewSymbol = openSignalDetails?.symbol || selectedSymbol;
  const previewTicks = useMemo(() => (worldTicks || []).filter(t => t.symbol === previewSymbol), [worldTicks, previewSymbol]);
  const { candles: previewCandles } = useTickCandles(previewTicks, selectedTimeframe, { minTicks: 5, lookback: 200 });

  const previewChartData = useMemo(() => {
    // Prefer aggregated previewCandles
    if (Array.isArray(previewCandles) && previewCandles.length > 0) {
      const mapped = previewCandles.map((c: any) => ({
        timestamp: c.timestamp || Date.now(),
        open: Number(c.open || 0),
        high: Number(c.high || 0),
        low: Number(c.low || 0),
        close: Number(c.close || 0),
        volume: Number(c.volume || 0),
        rsi: c.rsi ?? null,
        macd: c.macd ?? null,
        ema: c.ema ?? null,
      })).filter(d => !(d.open === 0 && d.high === 0 && d.low === 0 && d.close === 0));
      if (mapped.length > 0) return mapped;
    }

    // Fallback to recent marketData frames for symbol
    const frames = (marketData || []).filter(f => f.symbol === previewSymbol).slice(-100);
    if (frames.length > 0) {
      const mapped = frames.map(f => ({
        timestamp: f.meta?.tsClose || Date.now(),
        open: Number(f.open || 0),
        high: Number(f.high || 0),
        low: Number(f.low || 0),
        close: Number(f.close || 0),
        volume: Number(f.volume || 0),
        rsi: f.indicators?.rsi ?? null,
        macd: f.indicators?.macd?.line ?? null,
        ema: f.indicators?.ema20 ?? null,
      })).filter(d => !(d.open === 0 && d.high === 0 && d.low === 0 && d.close === 0));
      if (mapped.length > 0) return mapped;
    }

    // Nothing usable
    return [] as any[];
  }, [previewCandles, marketData, previewSymbol]);

  // WebSocket connection through Vite proxy
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Connect to WebSocket for real-time updates
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  // Gateway Agent WebSocket hook
  const { isConnected: isGatewayConnected, setExchange } = useWebSocket(
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
              setCurrentPrice(frame.close);
              const change = frame.close - frame.open;
              setPriceChange(change);
              setPriceChangePercent((change / frame.open) * 100);
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
        case 'ohlcv': { // Handle OHLCV data from Gateway Agent
          setGatewayOHLCV(message.data);
          break;
        }
        case 'orderbook': {
          try {
            const ob = message.data as Orderbook;
            if (ob && (Array.isArray(ob.bids) || Array.isArray(ob.asks))) {
              setOrderbook(ob);
            }
          } catch (err) {
            console.error('Failed to parse orderbook message', err);
          }
          break;
        }
        // world ticks are delivered via MarketDataLayer subscriptions
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
  // Fetch agents list for AgentPanel
  const { data: agents = [], refetch: refetchAgents } = useQuery<{ id: string; name: string; status: string; lastSignal?: string }[]>({
    queryKey: ['/api/agents'],
    queryFn: () => fetch('/api/agents').then(r => r.ok ? r.json() : []),
    staleTime: 10000, // Data fresh for 10 seconds
    refetchInterval: 0, // No auto-refetch
    refetchOnWindowFocus: true,
  });

  const { data: latestSignals, refetch: refetchSignals, isLoading: signalsLoading, isError: signalsError } = useQuery<Signal[]>({
    queryKey: ['/api/signals/latest'],
    queryFn: () => safeFetchJson('/api/signals/latest'),
    staleTime: 5000, // Real-time signals: fresh for 5 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, signals: signalsLoading }));
    setError(e => ({ ...e, signals: signalsError }));
  }, [signalsLoading, signalsError]);

  const { data: activeTrades, refetch: refetchTrades, isLoading: tradesLoading, isError: tradesError } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
    queryFn: () => safeFetchJson('/api/trades?status=OPEN'),
    staleTime: 3000, // Trades: fresh for 3 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, trades: tradesLoading }));
    setError(e => ({ ...e, trades: tradesError }));
  }, [tradesLoading, tradesError]);

  const { data: marketSentiment, refetch: refetchSentiment, isLoading: sentimentLoading, isError: sentimentError } = useQuery<MarketSentiment>({
    queryKey: ['/api/market-sentiment'],
    queryFn: () => safeFetchJson('/api/market-sentiment'),
    staleTime: 30000, // Market sentiment: fresh for 30 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, sentiment: sentimentLoading }));
    setError(e => ({ ...e, sentiment: sentimentError }));
    if (marketSentiment) {
      setFearGreedIndex(marketSentiment.fearGreedIndex || 0);
      setBtcDominance(marketSentiment.btcDominance || 0);
      // Backend already returns values in trillions (T) and billions (B)
      setTotalMarketCap(marketSentiment.totalMarketCap || 0);
      setVolume24h(marketSentiment.volume24h || 0);
    }
  }, [marketSentiment, sentimentLoading, sentimentError]);

  const { data: portfolioSummary, refetch: refetchPortfolio, isLoading: portfolioLoading, isError: portfolioError } = useQuery<PortfolioData>({
    queryKey: ['/api/portfolio-summary'],
    queryFn: () => safeFetchJson('/api/portfolio-summary'),
    staleTime: 10000, // Portfolio: fresh for 10 seconds
    refetchInterval: 0, // No auto-refetch
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
    queryFn: () => safeFetchJson('/api/exchange/status'),
    staleTime: 30000, // Exchange status: fresh for 30 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, exchange: exchangeLoading }));
    setError(e => ({ ...e, exchange: exchangeError }));
  }, [exchangeLoading, exchangeError]);

  const { data: mlInsights, refetch: refetchML, isLoading: mlLoading, isError: mlError } = useQuery<MLInsights>({
    queryKey: ['/api/ml/insights'],
    queryFn: () => safeFetchJson('/api/ml/insights'),
    staleTime: 60000, // ML insights: fresh for 60 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, ml: mlLoading }));
    setError(e => ({ ...e, ml: mlError }));
  }, [mlLoading, mlError]);

  const { data: multiTimeframeAnalysis, refetch: refetchMultiTF, isLoading: multiTFLoading, isError: multiTFError } = useQuery<MultiTimeframeAnalysis>({
    queryKey: ['/api/analysis/multi-timeframe', selectedSymbol],
    queryFn: () => safeFetchJson(`/api/analysis/multi-timeframe?symbol=${selectedSymbol}`),
    staleTime: 15000, // Multi-timeframe: fresh for 15 seconds
    refetchInterval: 0, // No auto-refetch
  });

  useEffect(() => {
    setLoading(l => ({ ...l, multiTF: multiTFLoading }));
    setError(e => ({ ...e, multiTF: multiTFError }));
  }, [multiTFLoading, multiTFError]);

  // Fetch real price data for selected symbol
  const { data: priceData } = useQuery({
    queryKey: ['/api/gateway/price', selectedSymbol],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/gateway/price/${selectedSymbol}`);
        if (!response.ok) return null;
        return response.json();
      } catch (e) {
        return null;
      }
    },
    staleTime: 3000, // Price data: fresh for 3 seconds
    refetchInterval: 0, // No auto-refetch (WebSocket for real-time)
  });

  // Update current price from real data
  useEffect(() => {
    if (priceData?.price) {
      setCurrentPrice(priceData.price);
      if (priceData.priceChange !== undefined) {
        setPriceChange(priceData.priceChange);
      }
      if (priceData.priceChangePercent !== undefined) {
        setPriceChangePercent(priceData.priceChangePercent);
      }
    }
  }, [priceData]);

  // Fetch live ticker data for multiple symbols (for MarketStatusBar)
  const { data: liveTickerData } = useQuery({
    queryKey: ['/api/gateway/ticker', universeSymbols.map(s => s.symbol).join(',')],
    queryFn: async () => {
      try {
        const symbols = (universeSymbols || []).slice(0, 5).map((s: any) => s.symbol);
        if (!symbols || symbols.length === 0) return null;
        const response = await fetch(`/api/gateway/ticker?symbols=${symbols.join(',')}`);
        if (!response.ok) return null;
        const data = await response.json();
        // Convert to TickerItem format
        return symbols.map(sym => {
          const priceInfo = data[sym] || { price: 0, change: 0, changePercent: 0 };
          return {
            symbol: sym.split('/')[0],
            price: priceInfo.price || 0,
            change: priceInfo.change || 0,
            changePercent: priceInfo.changePercent || 0,
          };
        });
      } catch (e) {
        console.warn('Failed to fetch ticker data:', e);
        return null;
      }
    },
    staleTime: 3000, // Ticker data: fresh for 3 seconds
    refetchInterval: 0, // No auto-refetch (WebSocket for real-time)
  });

  // Subscribe to market data layer for live ticks for the selected symbol/timeframe
  useEffect(() => {
    if (!selectedSymbol) return;
    // normalize symbol for MDL (e.g. BTC/USDT -> BTCUSDT)
    const mdSymbol = selectedSymbol.replace('/', '');
    const opts = { timeframe: selectedTimeframe, includeIndicators: useFeed, rateLimitMs: 0, bufferMax: 400 };
    const handle = marketDataLayer.subscribe(mdSymbol, opts, (tick: UITick) => {
      try {
        // Verify invariants: tick should always be UITick (never RawTick)
        assertUITick(tick);
        verifyDataLayerInvariants(tick, { source: 'network', mode: 'live' });

        // UITick is already safe and annotated; reuse mapIncomingTick for backward compat
        const mapped = mapIncomingTick(tick as any);
        setWorldTicks(prev => {
          const merged = [mapped, ...prev];
          return merged.slice(0, 400);
        });
        if (tick.symbol === mdSymbol || tick.symbol === selectedSymbol) {
          setCurrentPrice(tick.price);
        }
      } catch (err) {
        console.error('marketDataLayer handler error', err);
      }
    });

    return () => {
      try { handle.unsubscribe(); } catch (err) {}
    };
  }, [selectedSymbol, selectedTimeframe, useFeed]);

  // Listen for MDL connection/retry/error events to surface reliability
  const [mdConnected, setMdConnected] = useState(false);
  const [mdRetryInfo, setMdRetryInfo] = useState<{ attempt?: number; delay?: number } | null>(null);
  useEffect(() => {
    const onConnected = () => setMdConnected(true);
    const onDisconnected = () => setMdConnected(false);
    const onRetry = (info: any) => setMdRetryInfo(info);
    const onError = (err: any) => {
      // Keep MDL errors non-fatal and quieter in the console — surface via UI state instead
      console.warn('MDL error', err);
    };
    marketDataLayer.addEventListener('connected', onConnected);
    marketDataLayer.addEventListener('disconnected', onDisconnected);
    marketDataLayer.addEventListener('retry', onRetry);
    marketDataLayer.addEventListener('error', onError);
    return () => {
      marketDataLayer.removeEventListener('connected', onConnected);
      marketDataLayer.removeEventListener('disconnected', onDisconnected);
      marketDataLayer.removeEventListener('retry', onRetry);
      marketDataLayer.removeEventListener('error', onError);
    };
  }, []);

  // Helper: safe fetch that returns null on non-ok or parse errors
  const safeFetchJson = async (input: RequestInfo, init?: RequestInit) => {
    try {
      const res = await fetch(input, init);
      if (!res.ok) return null;
      try {
        return await res.json();
      } catch (err) {
        return null;
      }
    } catch (err) {
      return null;
    }
  };

  // Fetch chart data from CoinGecko with error recovery
  const { data: coinGeckoChartData, isLoading: isChartLoading, error: chartError, refetch: refetchChart } = useCoinGeckoChart(selectedSymbol, 7);

  // Choose ticks source: live feed or replay playback
  const ticksForAggregation = isReplaying ? replayPlayback : worldTicks;
  // Use the tick-aggregation hook first; fall back to other sources as needed
  const { candles: feedCandles } = useTickCandles(ticksForAggregation, selectedTimeframe, { minTicks: 10, lookback: 400 });

  const chartData: ChartPoint[] = useMemo(() => {
    // 1) Prefer aggregated feed if available
    if (feedCandles && feedCandles.length > 0) {
      return feedCandles as ChartPoint[];
    }

    // 2) Fallback to Gateway Agent data if available
    if (gatewayOHLCV?.success && gatewayOHLCV.candles?.length > 0) {
      console.log(`[Chart] Using Gateway Agent data for ${selectedSymbol}: ${gatewayOHLCV.candles.length} candles`);
      return gatewayOHLCV.candles.map((candle: any) => ({
        timestamp: candle[0] || candle.timestamp,
        open: candle[1] || candle.open,
        high: candle[2] || candle.high,
        low: candle[3] || candle.low,
        close: candle[4] || candle.close,
        volume: candle[5] || candle.volume,
        // Extract all live indicators from gateway response
        rsi: candle.rsi ?? null,
        macd: candle.macd ?? null,
        ema: candle.ema ?? null,
      }));
    }

    // 3) Then try CoinGecko data
    if (coinGeckoChartData && coinGeckoChartData.length > 0) {
      console.log(`[Chart] Using CoinGecko data for ${selectedSymbol}: ${coinGeckoChartData.length} candles`);
      return coinGeckoChartData as unknown as ChartPoint[];
    }

    // 4) Fallback to WebSocket marketData frames
    const filteredData = marketData.filter(frame => frame.symbol === selectedSymbol);
    if (filteredData.length === 0) {
      console.log(`[Chart] No chart data available for ${selectedSymbol} - worldTicks, Gateway, CoinGecko, and WebSocket all empty`);
      return [];
    }

    console.log(`[Chart] Using WebSocket data for ${selectedSymbol}: ${filteredData.length} frames`);
    return filteredData.slice(-200).map(frame => ({
      timestamp: frame.meta?.tsClose || Date.now(),
      open: frame.open,
      high: frame.high,
      low: frame.low,
      close: frame.close,
      volume: frame.volume,
      rsi: frame.indicators?.rsi ?? null,
      macd: frame.indicators?.macd ? {
        line: frame.indicators.macd.line,
        signal: frame.indicators.macd.signal,
        histogram: frame.indicators.macd.histogram,
      } : null,
      ema: frame.indicators?.ema20 ?? null,
    }));
  }, [feedCandles, gatewayOHLCV, coinGeckoChartData, marketData, selectedSymbol, useFeed]);

  // tradingChartData is a simplified shape expected by the `TradingChart` component
  const tradingChartData = useMemo(() => chartData.map(c => ({
    timestamp: c.timestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    rsi: c.rsi ?? null,
    macd: c.macd?.line ?? null,
    ema: c.ema ?? null,
  })), [chartData]);

  // Current market frame
  const currentFrame = useMemo(() => {
    return marketData.filter(frame => frame.symbol === selectedSymbol).slice(-1)[0] || null;
  }, [marketData, selectedSymbol]);

  // Fetch clustering data when enabled
  const { data: clusterData } = useQuery({
    queryKey: ['clustering', selectedSymbol, chartData?.length],
    queryFn: async () => {
      if (!chartData || chartData.length < 20) return null;

      const response = await fetch('/api/analytics/candle-clustering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: chartData })
      });

      return response.json();
    },
    enabled: showClustering && !!chartData && chartData.length >= 20,
    refetchInterval: 60000
  });

  useEffect(() => {
    if (clusterData) {
      setClusteringData(clusterData);
    }
  }, [clusterData]);

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
    holdingPeriod?: { // Added holdingPeriod interface
      days: number;
      hours: number;
      candles: number;
      confidence: number;
      reason: string;
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

  // Simple replay controller used by AnalyticsPanel
  const startReplay = (speedMs?: number) => {
    if (!worldTicks || worldTicks.length === 0) return;
    // prepare source as chronological (oldest first)
    const src = [...worldTicks].slice().reverse();
    replaySourceRef.current = src;
    setReplayPlayback([]);
    replayIndexRef.current = 0;
    setIsReplaying(true);
    if (speedMs) setReplayIntervalMs(speedMs);

    // clear any existing timer
    if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }

    replayTimerRef.current = window.setInterval(() => {
      const srcRef = replaySourceRef.current;
      if (!srcRef) return;
      const idx = replayIndexRef.current;
      if (idx >= srcRef.length) {
        // end
        if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
        setIsReplaying(false);
        return;
      }
      const next = srcRef[idx];
      setReplayPlayback(prev => [...prev, next]);
      replayIndexRef.current = idx + 1;
    }, replayIntervalMs);
  };

  const stopReplay = () => {
    if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
    replaySourceRef.current = null;
    setIsReplaying(false);
    setReplayPlayback([]);
  };

  const pauseReplay = () => {
    if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
    setIsReplaying(false);
  };

  const resumeReplay = () => {
    if (!replaySourceRef.current) return;
    if (replayTimerRef.current) return; // already running
    setIsReplaying(true);
    replayTimerRef.current = window.setInterval(() => {
      const srcRef = replaySourceRef.current;
      if (!srcRef) return;
      const idx = replayIndexRef.current;
      if (idx >= srcRef.length) {
        if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
        setIsReplaying(false);
        return;
      }
      const next = srcRef[idx];
      setReplayPlayback(prev => [...prev, next]);
      replayIndexRef.current = idx + 1;
    }, replayIntervalMs);
  };

  const setReplaySpeed = (ms: number) => {
    setReplayIntervalMs(ms);
    // if currently playing, restart interval with new speed
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = window.setInterval(() => {
        const srcRef = replaySourceRef.current;
        if (!srcRef) return;
        const idx = replayIndexRef.current;
        if (idx >= srcRef.length) {
          if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
          setIsReplaying(false);
          return;
        }
        const next = srcRef[idx];
        setReplayPlayback(prev => [...prev, next]);
        replayIndexRef.current = idx + 1;
      }, ms);
    }
  };

  const seekReplay = (index: number) => {
    const src = replaySourceRef.current;
    if (!src) return;
    const idx = Math.max(0, Math.min(index, src.length - 1));
    replayIndexRef.current = idx;
    setReplayPlayback(src.slice(0, idx + 1));
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) { window.clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
    };
  }, []);

  // Agent control API: toggle (pause/enable)
  const toggleAgentApi = async (id: string) => {
    try {
      await fetch(`/api/agents/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to toggle agent', err);
    } finally {
      try { await refetchAgents(); } catch (e) {}
    }
  };

  // Compute per-symbol spreads from latest marketData frames and fallback to orderbook
  const spreadsBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    // latest MarketFrame per symbol
    const latest: Record<string, MarketFrame> = {};
    (marketData || []).forEach((m: any) => {
      if (!m || !m.symbol) return;
      const prev = latest[m.symbol];
      if (!prev || (m.meta?.tsClose || 0) > (prev.meta?.tsClose || 0)) latest[m.symbol] = m;
    });
    Object.keys(latest).forEach(sym => {
      const frame = latest[sym];
      const spread = frame?.microstructure?.spread;
      if (typeof spread === 'number') map.set(sym, spread);
      else if (frame) map.set(sym, Math.abs(frame.high - frame.low));
    });

    // fallback: if orderbook looks like for selectedSymbol, compute spread
    if (orderbook && selectedSymbol) {
      try {
        const bestBid = (orderbook.bids && orderbook.bids.length) ? orderbook.bids[0].price : undefined;
        const bestAsk = (orderbook.asks && orderbook.asks.length) ? orderbook.asks[0].price : undefined;
        if (bestBid !== undefined && bestAsk !== undefined) {
          map.set(selectedSymbol, Math.max(0, bestAsk - bestBid));
        }
      } catch (err) {}
    }

    // convert to plain object
    const out: Record<string, number> = {};
    map.forEach((v, k) => { out[k] = v; });
    return out;
  }, [marketData, orderbook, selectedSymbol]);

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

  // Screenshot helper (lightweight): export chart using html2canvas if available, otherwise notify
  const takeChartScreenshot = useCallback(async () => {
    try {
      const el = document.querySelector('.chart-container') as HTMLElement | null;
      if (!el) {
        addNotification('system', 'low', 'Screenshot Failed', 'Chart element not found');
        return;
      }

      const html2canvas = (window as any).html2canvas;
      if (html2canvas && typeof html2canvas === 'function') {
        const canvas: HTMLCanvasElement = await html2canvas(el, { backgroundColor: null });
        canvas.toBlob((blob) => {
          if (!blob) {
            addNotification('system', 'low', 'Screenshot Failed', 'Unable to create image blob');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedSymbol || 'chart'}-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          addNotification('system', 'low', 'Screenshot Saved', 'Chart screenshot saved to downloads');
        });
        return;
      }

      addNotification('system', 'low', 'Screenshot Unavailable', 'Install html2canvas for screenshots, or use Export CSV');
    } catch (err) {
      console.error('Screenshot error', err);
      addNotification('system', 'high', 'Screenshot Error', String(err));
    }
  }, [selectedSymbol, addNotification]);

  // Export chart data as CSV
  const exportChartCSV = useCallback(() => {
    try {
      if (!chartData || chartData.length === 0) {
        addNotification('system', 'low', 'Export Failed', 'No chart data to export');
        return;
      }

      const lines = ['timestamp,open,high,low,close,volume'];
      for (const c of chartData) {
        lines.push(`${c.timestamp},${c.open},${c.high},${c.low},${c.close},${c.volume}`);
      }
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSymbol || 'chart'}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addNotification('system', 'low', 'Export Complete', 'Chart data exported as CSV');
    } catch (err) {
      console.error('Export error', err);
      addNotification('system', 'high', 'Export Error', String(err));
    }
  }, [chartData, selectedSymbol, addNotification]);

  // Signal counts
  const signals = useMemo(() => {
    return [
      ...(Array.isArray(latestSignals) ? latestSignals : []),
      ...(Array.isArray(currentSignals) ? currentSignals : []),
    ];
  }, [latestSignals, currentSignals]);

  // Memoized render nodes to reduce churn in signal-heavy UIs
  const gatewaySignalNodes = useMemo(() => {
    if (!gatewaySignals || gatewaySignals.length === 0) return null;
    return gatewaySignals.slice(0, 6).map((signal) => (
      <GatewaySignalCard key={signal.symbol} signal={signal} />
    ));
  }, [gatewaySignals]);

  const latestSignalNodes = useMemo(() => {
    if (!signals || signals.length === 0) return null;
    return signals.slice(0, 3).map((signal: Signal, index: number) => (
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
            {signal.price !== undefined && signal.price !== null ? formatCurrency(signal.price) : 'N/A'}
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
                style={{ width: `${((signal.confidence as number ?? 0) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-info">
              {(((signal.confidence as number ?? 0) * 100)).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">{(signal.reasoning as string[] ?? []).join(', ')}</div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
          <div className="text-xs">
            <span className="text-gray-400">R/R:</span>
            <span className="text-warning font-mono ml-1">{((signal.riskReward as number ?? 0)).toFixed(1)}</span>
          </div>
          <div className="text-xs">
            <span className="text-gray-400">Time:</span>
            <span className="text-gray-300 font-mono ml-1">
              {signal.timestamp ? new Date(signal.timestamp as number).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    ));
  }, [signals]);

  // Memoize trading chart props at top level (moved from IIFE to fix React hooks violation)
  const tradingChartProps = useMemo(() => ({
    data: tradingChartData,
    showVolume: chartIndicators.showVolume,
    showRSI: chartIndicators.showRSI,
    showMACD: chartIndicators.showMACD,
    showEMA: chartIndicators.showEMA,
    showPatterns: chartIndicators.showPatterns,
    timeframe: selectedTimeframe,
    height: 600,
    maxCandles: 200,
    onCandleHover: setHoveredCandleTime,
  }), [tradingChartData, chartIndicators, selectedTimeframe, setHoveredCandleTime]);

  // Extract signals for hovered candle
  const hoveredCandleSignals = useMemo(() => {
    if (!hoveredCandleTime || !signals || signals.length === 0) return null;
    
    const candleSignalsForTime = signals.filter(s => {
      // Match signals within the candle's timeframe window
      const signalTime = s.timestamp ?? Date.now();
      // Approximate candle time window (in milliseconds)
      const timeframeMs: Record<string, number> = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '1h': 3600000,
        '1d': 86400000,
        '1w': 604800000,
        '1month': 2592000000
      };
      const windowSize = timeframeMs[selectedTimeframe] || 3600000;
      return Math.abs(signalTime - hoveredCandleTime) < windowSize;
    });

    if (candleSignalsForTime.length === 0) return null;

    return {
      timestamp: hoveredCandleTime,
      signals: candleSignalsForTime,
      totalSignals: candleSignalsForTime.length,
      buyCount: candleSignalsForTime.filter(s => s.type === 'BUY').length,
      sellCount: candleSignalsForTime.filter(s => s.type === 'SELL').length,
      holdCount: candleSignalsForTime.filter(s => s.type === 'HOLD').length
    };
  }, [hoveredCandleTime, signals, selectedTimeframe]);

  const signalCounts = useMemo(() => ({
    strongBuy: signals.filter(s => s.type === 'BUY' && s.strength > 0.8).length,
    buy: signals.filter(s => s.type === 'BUY' && s.strength <= 0.8).length,
    hold: signals.filter(s => s.type === 'HOLD').length,
    sell: signals.filter(s => s.type === 'SELL' && s.strength <= 0.8).length,
    strongSell: signals.filter(s => s.type === 'SELL' && s.strength > 0.8).length,
  }), [signals]);

  // Attention items (top 1-3) for the Attention Bar
  const topItems = useMemo(() => getTopItems({ signals, notifications, mdlRetryInfo: mdRetryInfo }), [signals, notifications, mdRetryInfo]);

  /* DUPLICATE MEMOIZED SIGNAL NODES - START (removed) */
  /*
  const gatewaySignalNodes = useMemo(() => {
    if (!gatewaySignals || gatewaySignals.length === 0) return null;
    return gatewaySignals.slice(0, 6).map((signal) => (
      <GatewaySignalCard key={signal.symbol} signal={signal} />
    ));
  }, [gatewaySignals]);

  const latestSignalNodes = useMemo(() => {
    if (!signals || signals.length === 0) return null;
    return signals.slice(0, 3).map((signal: Signal, index: number) => {
      return (
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
              {signal.price !== undefined && signal.price !== null ? formatCurrency(signal.price) : 'N/A'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {signal.momentumLabel && (
              <span className="text-xs bg-accent-purple/30 text-accent-purple px-2 py-0.5 rounded-full font-mono" title="Momentum Label">
                {signal.momentumLabel}
              </span>
            )}
            {signal.regimeState && (
              <span className="text-xs bg-info/30 text-info px-2 py-0.5 rounded-full font-mono" title="Regime State">
                {signal.regimeState}
              </span>
            )}
            {signal.legacyLabel && (
              <span className="text-xs bg-warning/30 text-warning px-2 py-0.5 rounded-full font-mono" title="Legacy Label">
                {signal.legacyLabel}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">Strength</div>
            <div className="text-xs font-mono text-slate-300 font-semibold">{signal.strength ?? 0}</div>
          </div>
        </div>
      );
    });
  */
  /* DUPLICATE MEMOIZED SIGNAL NODES - END */

  const handleAttentionClick = useCallback(async (item: AttentionItem) => {
    try {
      if (item?.symbol) {
        setSelectedSymbol(item.symbol);
        setShowLeftRail(true);
        // Enter focus mode for quick inspection
        if (!focusMode) toggleFocusMode();
      } else if (item.id === 'mdl_retry') {
        // Attempt a small backfill for the selected symbol (last 5 minutes)
        if (!selectedSymbol) {
          addNotification('system', 'low', 'Backfill failed', 'No symbol selected for backfill');
          return;
        }
        const mdSym = selectedSymbol.replace('/', '');
        const tmp = marketDataLayer.subscribe(mdSym, { timeframe: selectedTimeframe, includeIndicators: useFeed, rateLimitMs: 0, bufferMax: 400 }, () => {});
        try {
          await tmp.requestReplay(Date.now() - 5 * 60 * 1000, Date.now());
          addNotification('system', 'low', 'Backfill complete', `Replayed last 5m for ${selectedSymbol}`);
        } catch (err) {
          addNotification('system', 'high', 'Backfill failed', `${String(err)}`);
        } finally {
          try { tmp.unsubscribe(); } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Attention click handler error', err);
    }
  }, [signals, notifications, mdRetryInfo, selectedSymbol, selectedTimeframe, useFeed, focusMode]);

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

  // Panels to hand off to TerminalLayout (start with Top Signals, World Ticks, Event Feed)
  const panels = [
    {
      id: 'top-signals',
      title: 'Top Signals',
      content: (
        <div>
          <div className="p-4 border-b border-slate-700/50 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Top Signals</h2>
              <button
                className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
                onClick={() => {
                  try { refetchSignals(); } catch (e) {}
                  try { refetchGatewaySignals(); } catch (e) {}
                }}
                data-testid="button-refresh-signals"
                aria-label="Refresh Signals"
              >
                <RefreshCw className="w-3 h-3 mr-1 inline" />
                Refresh
              </button>
            </div>
          </div>

          {/* Gateway Scanner Signals */}
          {gatewaySignals && gatewaySignals.length > 0 && (
            <div className="p-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-indigo-400 mb-3 uppercase tracking-wide">Gateway Scanner</h3>
              <div className="grid grid-cols-2 gap-2">
                {gatewaySignalNodes}
              </div>
            </div>
          )}

          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Latest Signals</h3>
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
              {latestSignalNodes}
              {signals.length === 0 && !signalsLoading && !signalsError && (
                <div className="text-center py-8 text-gray-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No signals detected</p>
                  <p className="text-xs">Scanning markets...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'world-ticks',
      title: 'World Ticks',
      content: (
        <div className="p-2">
          <WorldTicksPanel ticks={worldTicks} limit={50} />
        </div>
      ),
    },
    {
      id: 'event-feed',
      title: 'Event Feed',
      content: (
        <div className="p-2">
          <EventFeedPanel ticks={worldTicks} signals={currentSignals} alerts={[]} />
        </div>
      ),
    },
    {
      id: 'orderbook',
      title: 'Orderbook',
      content: (
        <div className="p-2">
          <OrderbookPanel orderbook={orderbook} />
        </div>
      ),
    },
    {
      id: 'positions',
      title: 'Positions',
      content: (
        <div className="p-2">
          <PositionManagementPanel positions={positions} trades={trades} orders={orders} />
        </div>
      ),
    },
    {
      id: 'risk',
      title: 'Risk',
      content: (
        <div className="p-2">
          <RiskManagementPanel portfolioValue={portfolioValue} dailyLoss={dailyLoss} />
        </div>
      ),
    },
  ];

  const { colors } = useTheme();

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: colors.background, color: colors.text }}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Professional Market Status Bar */}
      <MarketStatusBar
        isConnected={isGatewayConnected}
        currentPrice={currentPrice}
        priceChange={priceChange}
        priceChangePercent={priceChangePercent}
        volume24h={volume24h}
        portfolioValue={portfolioValue}
        dayChangePercent={dayChangePercent}
        exchangeStatus={exchangeStatus}
        mdlConnected={mdConnected}
        mdlRetryInfo={mdRetryInfo}
        topItems={topItems}
        onAttentionClick={handleAttentionClick}
        selectedSymbol={selectedSymbol}
        onBackfill={handleBackfill}
        backfillInProgress={backfillInProgress}
        backfillCount={backfillCount}
        liveTickerData={liveTickerData || undefined}
      />
      {/* Performance observer (Phase 4) */}
      <PerfObserver thresholdMs={50} />

      {/* Replay Mode Banner */}
      <ReplayModeBanner
        isReplaying={isReplaying}
        currentTime={replayPlayback.length}
        totalTime={worldTicks.length}
        onResume={() => resumeReplay()}
        onReset={() => stopReplay()}
      />

      {/* Top Bar */}
      <header className="relative border-b backdrop-blur-xl px-6 py-3 flex items-center justify-between" style={{ borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <div className="flex items-center space-x-3">
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
              {/* Live / Paper badge */}
              <div className="ml-4">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isLiveMode ? 'bg-red-600 text-theme' : 'bg-theme-card text-theme-secondary'}`} title="Trading Mode">
                  {isLiveMode ? 'LIVE' : 'PAPER'}
                </span>
              </div>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
            {/* Layout Controls */}
            <div className="h-6 w-px bg-theme-card"></div>
            <button
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className={`p-2 hover:bg-theme-surface border border-theme rounded-lg transition-all ${
                showLeftSidebar ? 'bg-blue-500/20 border-blue-500/50' : ''
              }`}
              title={showLeftSidebar ? 'Hide Market Overview' : 'Show Market Overview'}
              aria-label={showLeftSidebar ? 'Hide left sidebar' : 'Show left sidebar'}
            >
              {showLeftSidebar ?
                <PanelLeftClose className="w-4 h-4 text-blue-400" /> :
                <PanelLeftOpen className="w-4 h-4 text-theme-secondary" />
              }
            </button>
            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className={`p-2 hover:bg-theme-surface border border-theme rounded-lg transition-all ${
                showRightSidebar ? 'bg-blue-500/20 border-blue-500/50' : ''
              }`}
              title={showRightSidebar ? 'Hide Portfolio' : 'Show Portfolio'}
              aria-label={showRightSidebar ? 'Hide right sidebar' : 'Show right sidebar'}
            >
              {showRightSidebar ?
                <PanelRightClose className="w-4 h-4 text-blue-400" /> :
                <PanelRightOpen className="w-4 h-4 text-theme-secondary" />
              }
            </button>
            <button
              onClick={() => { toggleFocusMode(); }}
              className={`p-2 hover:bg-theme-surface border border-theme rounded-lg transition-all ${
                focusMode ? 'bg-purple-500/20 border-purple-500/50' : ''
              }`}
              title={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
              aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            >
              {focusMode ?
                <Minimize2 className="w-4 h-4 text-purple-400" /> :
                <Maximize2 className="w-4 h-4 text-theme-secondary" />
              }
            </button>

                    <div className="h-6 w-px bg-theme-card"></div>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 hover:bg-theme-surface border border-theme rounded-lg transition-colors group"
                      data-testid="button-notifications"
                      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                    >
                      <Bell className={`w-4 h-4 transition-colors ${unreadCount > 0 ? 'text-blue-400 animate-pulse' : 'text-theme-secondary group-hover:text-theme'}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] text-center animate-in zoom-in duration-200">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
            <button
                className="p-2 hover:bg-theme-surface border border-theme rounded-lg transition-colors"
                data-testid="button-settings"
                aria-label="Settings"
                onClick={() => setShowSettingsModal(true)}
              >
                <Cog className="w-4 h-4 text-theme-secondary" />
              </button>
              <button
                className="p-2 hover:bg-theme-surface border border-theme rounded-lg transition-colors"
                title="Panel Manager"
                aria-label="Open Panel Manager"
                onClick={() => setShowPanelManager(true)}
              >
                <Layers className="w-4 h-4 text-theme-secondary" />
              </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettingsModal(false)} />
          <div className="relative z-70 bg-theme-surface rounded-lg p-6 w-96 border border-theme shadow-xl">
            <h3 className="text-lg font-bold mb-3">Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-theme-secondary">Environment</label>
                <select className="w-full mt-1 px-2 py-1 rounded bg-theme-card text-theme border border-theme" value={env} onChange={e => setEnv(e.target.value as 'dev'|'prod')}>
                  <option value="dev">Development</option>
                  <option value="prod">Production</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-theme-secondary">Workspace</label>
                <input className="w-full mt-1 px-2 py-1 rounded bg-theme-card text-theme border border-theme" value={workspace} onChange={e => setWorkspace(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-theme-secondary">Universe</label>
                <select className="w-full mt-1 px-2 py-1 rounded bg-theme-card text-theme border border-theme" value={universe} onChange={e => setUniverse(e.target.value)}>
                  <option>Market Universe</option>
                  <option>Portfolio Universe</option>
                  <option>Research Universe</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeSelector />
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button className="px-3 py-1 rounded bg-slate-700 text-slate-200" onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={() => {
                try { localStorage.setItem('env', env); localStorage.setItem('workspace', workspace); localStorage.setItem('universe', universe); } catch (err) {}
                setShowSettingsModal(false);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {showPanelManager && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPanelManager(false)} />
          <div className="relative z-70 bg-theme-surface rounded-lg p-6 w-96 border border-theme shadow-xl">
            <PanelManager />
            <div className="mt-4 text-right">
              <button className="px-3 py-1 rounded bg-slate-700 text-slate-200" onClick={() => setShowPanelManager(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      <TerminalLayout
        panels={panels}
        defaultPanels={[
          { id: 'top-signals', title: 'Top Signals', position: 'docked', collapsed: false },
          { id: 'world-ticks', title: 'World Ticks', position: 'docked', collapsed: false },
          { id: 'event-feed', title: 'Event Feed', position: 'docked', collapsed: false },
          { id: 'orderbook', title: 'Orderbook', position: 'docked', collapsed: false },
          { id: 'positions', title: 'Positions', position: 'docked', collapsed: false },
          { id: 'risk', title: 'Risk', position: 'docked', collapsed: false },
        ]}
        hero={{ symbol: selectedSymbol, name: selectedSymbol, price: currentPrice || 0, change24h: priceChangePercent || 0 }}
      >
        <div className="flex-1 flex overflow-auto relative">
        {/* Floating Action Buttons */}
        {!showLeftSidebar && (
          <button
            onClick={() => setShowLeftSidebar(true)}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 group"
            title="Show Signals Panel (Press S)"
            aria-label="Show signals panel"
          >
            <BarChart3 className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Signals (S)
            </span>
          </button>
        )}

        {!showRightSidebar && (
          <button
            onClick={() => setShowRightSidebar(true)}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 group"
            title="Show Portfolio Panel (Press P)"
            aria-label="Show portfolio panel"
          >
            <Wallet className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute right-full mr-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Portfolio (P)
            </span>
          </button>
        )}

        {/* Left Sidebar - Market Overview (Overlay Mode) */}
        {showLeftSidebar && (
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div
              className="absolute left-0 top-0 bottom-0 w-80 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border-r border-slate-700/50 flex flex-col z-40 shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto"
              aria-label="Market Overview Sidebar"
                    onMouseEnter={() => {
                if (leftSidebarTimerRef.current) {
                  window.clearTimeout(leftSidebarTimerRef.current as number);
                }
              }}
              onMouseLeave={() => resetLeftSidebarTimer()}
            >
            <div className="p-4 border-b border-slate-700/50 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Top Signals</h2>
                <button
                  className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
                  onClick={() => {
                    refetchSignals();
                    refetchGatewaySignals();
                  }}
                  data-testid="button-refresh-signals"
                  aria-label="Refresh Signals"
                >
                  <RefreshCw className="w-3 h-3 mr-1 inline" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Gateway Scanner Signals */}
            {gatewaySignals && gatewaySignals.length > 0 && (
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-sm font-semibold text-indigo-400 mb-3 uppercase tracking-wide">Gateway Scanner</h3>
                <div className="grid grid-cols-2 gap-2">
                  {gatewaySignalNodes}
                </div>
              </div>
            )}

            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Latest Signals</h3>
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
                {latestSignalNodes}
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

            {/* Top Movers Section */}
            <div className="p-4 border-b border-slate-700/50">
              <TopMoversWidget limit={5} />
            </div>
            <GlobalSummaryPanel totalSignals={signals.length} reliability={{ 'binance': 0.98, 'coinbase': 0.96 }} activePositions={0} />

            <div className="p-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold mb-2 text-white">Symbols</h3>
              <div className="h-64">
                <SymbolList
                  symbols={symbolsList}
                  worldTicks={worldTicks}
                  orderbook={orderbook}
                  signals={signals}
                  pinned={pinnedSymbols}
                  spreads={spreadsBySymbol}
                  onTogglePin={togglePin}
                  onSelect={(sym: string) => { setSelectedSymbol(sym); setShowLeftSidebar(false); }}
                />
              </div>
            </div>

            {/* Agents from backend (polled) */}
            <AgentPanel agents={agents as any} onToggle={toggleAgentApi} />

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
        )}

            {/* Main Content Area - With Fullscreen Support */}
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <div className={`flex-1 flex flex-col ${isChartFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : ''}`} aria-label="Main Content Area">
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
                          {(
                            (universeSymbols && universeSymbols.length > 0)
                              ? universeSymbols.slice(0, 50).map((s: any) => s.symbol)
                              : symbolsList
                          ).map((sym: string) => (
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
                      {priceChange >= 0 ? '+' : ''}{formatPercent(priceChangePercent)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50 overflow-x-auto">
                    {(['1m', '5m', '15m', '1h', '1d', '1w', '1month'] as const).map((timeframe) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap ${
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
                    onClick={() => setUseFeed(prev => !prev)}
                    className={`ml-2 px-2 py-1 text-xs rounded transition-all font-medium ${useFeed ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    title={useFeed ? 'Using feed' : 'Using external sources'}
                    aria-pressed={useFeed}
                    data-testid="toggle-use-feed"
                  >
                    {useFeed ? 'Feed' : 'Ext'}
                  </button>
                  <button
                    onClick={() => setShowLeftRail(prev => !prev)}
                    className={`ml-2 px-2 py-1 text-xs rounded transition-all font-medium ${showLeftRail ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    title={showLeftRail ? 'Collapse Left Rail' : 'Expand Left Rail'}
                    data-testid="toggle-left-rail"
                  >
                    {showLeftRail ? 'Rail' : 'Rail'}
                  </button>
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
                    onClick={() => setIsChartFullscreen(!isChartFullscreen)}
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
                      <p className="text-slate-400 font-medium">Loading chart data...</p>
                      <p className="text-xs text-slate-500 mt-2">Fetching {selectedSymbol} candlestick data</p>
                    </div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ReplayModeDesaturatedWrapper isReplaying={isReplaying}>
                    <div className="w-full h-full flex gap-3 relative">
                      {/* Replay Watermark */}
                      <ReplayModeWatermark isReplaying={isReplaying} position="top-right" opacity={0.1} />
                      
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
                                  {priceChange >= 0 ? '+' : ''}{formatPercent(priceChangePercent)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-2 gap-3 text-right">
                            <div>
                              <div className="text-xs text-slate-400">24h High</div>
                                <div className="text-sm font-mono font-bold text-green-400">
                                ${Math.max(...chartData.map((d: ChartPoint) => d.high)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">24h Low</div>
                                <div className="text-sm font-mono font-bold text-red-400">
                                ${Math.min(...chartData.map((d: ChartPoint) => d.low)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">24h Volume</div>
                                <div className="text-sm font-mono font-bold text-blue-400">
                                ${(chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / 1e6).toFixed(2)}M
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

                      {/* Symbol Panel - Detailed symbol information */}
                      <div className="mb-3">
                        <SymbolPanel 
                          symbol={selectedSymbol} 
                          latest={chartData[chartData.length - 1] as ChartPoint || undefined}
                          signals={signals.filter(s => s.symbol === selectedSymbol)}
                        />
                      </div>

                      {/* Chart Container */}
                      <div className="flex-1 min-h-0 bg-slate-800/20 rounded-lg border border-slate-700/50 p-2 relative">
                        {/* Use memoized props directly instead of IIFE */}
                        <TradingChart {...tradingChartProps} />

                        {/* Candlestick Hover Signals Tooltip */}
                        {hoveredCandleSignals && (
                          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 rounded-lg p-4 z-10 max-w-xs shadow-2xl">
                            <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <span className="text-blue-400">📍</span>
                              Candle Signals
                            </div>
                            
                            {/* Signal Counts */}
                            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                              <div className="bg-green-500/20 border border-green-500/50 rounded p-2 text-center">
                                <div className="text-green-400 font-bold">{hoveredCandleSignals.buyCount}</div>
                                <div className="text-slate-400">BUY</div>
                              </div>
                              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded p-2 text-center">
                                <div className="text-yellow-400 font-bold">{hoveredCandleSignals.holdCount}</div>
                                <div className="text-slate-400">HOLD</div>
                              </div>
                              <div className="bg-red-500/20 border border-red-500/50 rounded p-2 text-center">
                                <div className="text-red-400 font-bold">{hoveredCandleSignals.sellCount}</div>
                                <div className="text-slate-400">SELL</div>
                              </div>
                            </div>

                            {/* Signal Details */}
                            <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                              {hoveredCandleSignals.signals.slice(0, 5).map((signal, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/30">
                                  <div className="flex-1">
                                    <div className="font-mono text-slate-300">{signal.symbol}</div>
                                    <div className="text-slate-500">{signal.reasoning?.[0] || 'No reasoning'}</div>
                                  </div>
                                  <div className={`font-bold ml-2 ${
                                    signal.type === 'BUY' ? 'text-green-400' :
                                    signal.type === 'SELL' ? 'text-red-400' :
                                    'text-yellow-400'
                                  }`}>
                                    {signal.type}
                                  </div>
                                </div>
                              ))}
                              {hoveredCandleSignals.signals.length > 5 && (
                                <div className="text-slate-500 text-center py-2">
                                  +{hoveredCandleSignals.signals.length - 5} more signals
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Floating Chart Toolbar */}
                          <FloatingChartToolbar
                          selectedTimeframe={selectedTimeframe}
                          onTimeframeChange={(tf) => setSelectedTimeframe(tf as '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1month')}
                          isFullscreen={false}
                          onFullscreenToggle={() => {}}
                          onScreenshot={() => { takeChartScreenshot(); }}
                          onExport={() => { exportChartCSV(); }}
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
                        <div className="flex flex-wrap gap-2 mb-3">
                          <button
                            onClick={() => setChartIndicators((prev: Record<ChartIndicatorKey, boolean>) => ({ ...prev, showVolume: !prev.showVolume }))}
                            className={`p-2 rounded transition-colors ${chartIndicators.showVolume ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            title="Toggle Volume"
                          >
                            Volume
                          </button>
                          <button
                            onClick={() => setChartIndicators((prev: Record<ChartIndicatorKey, boolean>) => ({ ...prev, showRSI: !prev.showRSI }))}
                            className={`p-2 rounded transition-colors ${chartIndicators.showRSI ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            title="Toggle RSI"
                          >
                            RSI
                          </button>
                          <button
                            onClick={() => setChartIndicators((prev: Record<ChartIndicatorKey, boolean>) => ({ ...prev, showMACD: !prev.showMACD }))}
                            className={`p-2 rounded transition-colors ${chartIndicators.showMACD ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            title="Toggle MACD"
                          >
                            MACD
                          </button>
                          <button
                            onClick={() => setChartIndicators((prev: Record<ChartIndicatorKey, boolean>) => ({ ...prev, showEMA: !prev.showEMA }))}
                            className={`p-2 rounded transition-colors ${chartIndicators.showEMA ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            title="Toggle EMA"
                          >
                            EMA
                          </button>
                          <button
                            onClick={() => setShowClustering(!showClustering)}
                            className={`p-2 rounded transition-colors ${showClustering ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            title="Toggle Candle Clustering"
                          >
                            Clusters
                          </button>
                        </div>
                        <div className="space-y-3">
                          {/* RSI Indicator */}
                          {chartData[chartData.length - 1]?.rsi !== null && chartIndicators.showRSI && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">RSI (14) - <span className="text-green-400">Live</span></span>
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
                          {chartData[chartData.length - 1]?.macd && chartIndicators.showMACD && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">MACD - <span className="text-green-400">Live</span></span>
                                <span className={`text-sm font-mono font-bold ${
                                  (chartData[chartData.length - 1]?.macd?.line ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {(chartData[chartData.length - 1]?.macd?.line ?? 0).toFixed(4)}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Signal:</span>
                                  <span className="text-slate-300 font-mono">{(chartData[chartData.length - 1]?.macd?.signal ?? 0).toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Histogram:</span>
                                    <span className={`font-mono ${
                                    (chartData[chartData.length - 1]?.macd?.histogram ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                                  }`}> 
                                    {(chartData[chartData.length - 1]?.macd?.histogram ?? 0).toFixed(4)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Volume Analysis */}
                          {chartIndicators.showVolume && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Volume - <span className="text-green-400">Live</span></span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">Avg Volume</span>
                                      <span className="text-slate-300 font-mono">
                                      ${(chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / chartData.length / 1e6).toFixed(2)}M
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Current</span>
                                      <span className={`font-mono font-bold ${
                                      ((chartData[chartData.length - 1]?.volume ?? 0) > (chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / chartData.length))
                                        ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                      ${((chartData[chartData.length - 1]?.volume ?? 0) / 1e6).toFixed(2)}M
                                    </span>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-slate-700/50">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                    ((chartData[chartData.length - 1]?.volume ?? 0) > (chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / chartData.length))
                                      ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {(chartData[chartData.length - 1]?.volume ?? 0) > (chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / chartData.length)
                                      ? '📈 Above Average' : '📉 Below Average'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* EMA Indicator */}
                          {chartData[chartData.length - 1]?.ema !== null && chartIndicators.showEMA && (
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">EMA (20) - <span className="text-green-400">Live</span></span>
                                <span className="text-sm font-mono font-bold text-purple-400">
                                  ${chartData[chartData.length - 1]?.ema?.toFixed(2)}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
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
                              ${Math.min(...chartData.map((d: ChartPoint) => d.low)).toFixed(2)} - ${Math.max(...chartData.map((d: ChartPoint) => d.high)).toFixed(2)}
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
                              ${(chartData.reduce((sum: number, d: ChartPoint) => sum + (d.volume ?? 0), 0) / 1e9).toFixed(3)}B
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                            <span className="text-slate-400">Timeframe</span>
                            <span className="font-mono text-slate-200">{selectedTimeframe}</span>
                          </div>
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-slate-400">Data Source</span>
                            {gatewayOHLCV?.success ? (
                              <span className="text-green-400 font-medium">
                                ⚡ Live ({gatewayOHLCV.source || selectedExchange})
                              </span>
                            ) : (
                              <span className="text-yellow-400 font-medium">
                                CoinGecko
                              </span>
                            )}
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

                      {/* Orderbook Panel */}
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-white flex items-center">
                            <BookOpen className="w-4 h-4 mr-2 text-yellow-400" />
                            Orderbook
                          </h4>
                          <span className="text-xs text-slate-400">{orderbook.bids.length + orderbook.asks.length} levels</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <div className="text-slate-400 text-xs mb-1">Bids</div>
                            <div className="space-y-1">
                              {orderbook.bids.slice(0, 6).map((b, i) => (
                                <div key={`bid-${i}`} className="flex justify-between text-green-400">
                                  <span>${b.price.toFixed(2)}</span>
                                  <span className="text-slate-300">{(b.size).toFixed(4)}</span>
                                </div>
                              ))}
                              {orderbook.bids.length === 0 && (
                                <div className="text-slate-500">No bids</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-xs mb-1">Asks</div>
                            <div className="space-y-1">
                              {orderbook.asks.slice(0, 6).map((a, i) => (
                                <div key={`ask-${i}`} className="flex justify-between text-red-400">
                                  <span>${a.price.toFixed(2)}</span>
                                  <span className="text-slate-300">{(a.size).toFixed(4)}</span>
                                </div>
                              ))}
                              {orderbook.asks.length === 0 && (
                                <div className="text-slate-500">No asks</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* World Ticks Panel */}
                      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-white flex items-center">
                            <Globe className="w-4 h-4 mr-2 text-cyan-400" />
                            World Ticks
                          </h4>
                          <span className="text-xs text-slate-400">Latest</span>
                        </div>
                        <div className="space-y-2 text-xs font-mono">
                          {worldTicks.length === 0 && (
                            <div className="text-slate-500">No recent ticks</div>
                          )}
                          {worldTicks.slice(0, 8).map((t, i) => (
                            <div key={`tick-${i}`} className="flex justify-between items-center">
                              <div className="text-slate-300">{t.symbol || 'N/A'}</div>
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-bold text-slate-300">
                                  ${(t.price ?? 0).toFixed(2)}
                                </div>
                                <div className="text-slate-500">{(t.volume ?? 0).toFixed(4)}</div>
                              </div>
                            </div>
                          ))}
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
                          {mlPredictionsLoading && (
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

                            {/* Risk Assessment Card */}
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">Risk Score</span>
                                <span className={`text-xs px-2 py-1 rounded font-bold ${
                                  mlPredictions.risk.level === 'low' ? 'bg-green-500/20 text-green-400' :
                                  mlPredictions.risk.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  mlPredictions.risk.level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {mlPredictions.risk.level.toUpperCase()}
                                </span>
                              </div>
                              <div className="relative w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                                <div
                                  className={`absolute inset-y-0 left-0 transition-all ${
                                    mlPredictions.risk.score < 25 ? 'bg-green-500' :
                                    mlPredictions.risk.score < 50 ? 'bg-yellow-500' :
                                    mlPredictions.risk.score < 75 ? 'bg-orange-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${mlPredictions.risk.score}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-500">Score:</span>
                                <span className="text-sm font-bold text-white">{mlPredictions.risk.score}/100</span>
                              </div>
                              {mlPredictions.risk.factors.slice(0, 2).map((factor, i) => (
                                <div key={i} className="text-xs text-slate-400 flex items-start gap-1 mt-1">
                                  <span className="text-orange-400">•</span>
                                  <span>{factor}</span>
                                </div>
                              ))}
                            </div>

                            {/* Holding Period Card */}
                            {mlPredictions.holdingPeriod && (
                              <div className="bg-slate-900/40 rounded-lg p-3 border border-purple-500/30">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-slate-400">Optimal Hold Time</span>
                                  <Clock className="w-3 h-3 text-purple-400" />
                                </div>
                                <div className="text-center mb-2">
                                  <div className="text-2xl font-bold text-purple-400">
                                    {mlPredictions.holdingPeriod.days > 0
                                      ? `${mlPredictions.holdingPeriod.days}d`
                                      : `${mlPredictions.holdingPeriod.hours}h`
                                    }
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    ({mlPredictions.holdingPeriod.candles} candles)
                                  </div>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Confidence:</span>
                                    <span className="text-purple-400 font-mono">
                                      {(mlPredictions.holdingPeriod.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="relative w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className="absolute inset-y-0 left-0 bg-purple-500 transition-all"
                                      style={{ width: `${mlPredictions.holdingPeriod.confidence * 100}%` }}
                                    />
                                  </div>
                                  <div className="mt-2 text-xs text-slate-400 italic">
                                    "{mlPredictions.holdingPeriod.reason}"
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-slate-500">
                              {mlPredictionsLoading ? 'Computing predictions...' : 'ML predictions unavailable'}
                            </p>
                            {!mlPredictionsLoading && chartData.length < 20 && (
                              <p className="text-xs text-slate-600 mt-1">
                                Need 20+ candles for predictions
                              </p>
                            )}
                          </div>
                        )}

                      {/* Orderbook Panel - Shows bid/ask levels */}
                      <OrderbookPanel orderbook={orderbook} limit={8} />

                      {/* Trade Execution Panel - Execute trades with risk management */}
                      <TradeExecutionPanel
                        symbol={selectedSymbol}
                        currentPrice={currentPrice}
                        availableCash={portfolioValue}
                        maxLeverage={1}
                        onExecuteTrade={(trade: TradeOrder) => {
                          (async () => {
                            try {
                              const payload = {
                                symbol: trade.symbol,
                                side: trade.side,
                                price: trade.entryPrice,
                                quantity: trade.positionSize,
                                stopLoss: trade.stopLoss,
                                takeProfit: trade.takeProfit,
                              };

                              const endpoint = isLiveMode ? '/api/live-trading/execute' : '/api/paper-trading/trade';
                              const body = isLiveMode
                                ? {
                                    symbol: trade.symbol,
                                    type: trade.side?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
                                    price: trade.entryPrice,
                                    quantity: trade.positionSize,
                                    stopLoss: trade.stopLoss,
                                    takeProfit: trade.takeProfit,
                                  }
                                : payload;

                              const resp = await fetch(endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                              });

                              if (isLiveMode && !liveEnabledConfirmed) {
                                // Safety: block live execution until explicit confirmation
                                setShowEnableLiveModal(true);
                                addNotification('trade', 'high', 'Live Trading Blocked', 'Please confirm enabling Live Trading before placing real orders.');
                                return;
                              }

                              if (!resp.ok) throw new Error(`Trade failed: ${resp.statusText}`);
                              const json = await resp.json();

                              addNotification('trade', 'high', 'Order Created', json.message || 'Order created');
                              // Refresh trades list
                              try {
                                const tradesResp = await fetch('/api/trades?status=OPEN');
                                if (tradesResp.ok) {
                                  const openTrades = await tradesResp.json();
                                  setTrades(openTrades as TradeHistory[]);
                                }
                              } catch (e) { /* ignore */ }
                            } catch (err) {
                              console.error('Execute trade error', err);
                              addNotification('trade', 'high', 'Order Failed', String(err));
                            }
                          })();
                        }}
                      />

                      {/* Position Management Panel - View open positions, orders, and trade history */}
                      <PositionManagementPanel
                        positions={positions}
                        orders={orders}
                        trades={trades}
                        onClosePosition={(positionId: string) => {
                          (async () => {
                            try {
                              addNotification('trade', 'medium', 'Close Requested', `Position ${positionId} close requested`);
                              const endpoint = isLiveMode
                                ? `/api/live-trading/close/${encodeURIComponent(positionId)}`
                                : `/api/paper-trading/close/${encodeURIComponent(positionId)}`;
                              const resp = await fetch(endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ exitPrice: currentPrice }),
                              });
                              if (!resp.ok) throw new Error(`Close failed: ${resp.statusText}`);
                              addNotification('trade', 'medium', 'Close Executed', `Position ${positionId} closed`);
                              // Refresh positions and trades
                              try {
                                const posResp = await fetch('/api/paper-trading/positions');
                                if (posResp.ok) {
                                  const json = await posResp.json();
                                  setPositions(json.positions || []);
                                }
                                const tradesResp = await fetch('/api/trades?status=OPEN');
                                if (tradesResp.ok) setTrades(await tradesResp.json());
                              } catch (e) { /* ignore */ }
                            } catch (err) {
                              console.error('Close position error', err);
                              addNotification('trade', 'high', 'Close Failed', String(err));
                            }
                          })();
                        }}
                        onCancelOrder={(orderId: string) => {
                          console.log('Cancel order:', orderId);
                          setOrders(orders.filter(o => o.id !== orderId));
                          addNotification('trade', 'medium', 'Order Cancelled', `Order ${orderId} cancelled`);
                        }}
                      />

                      {/* Risk Management Panel - Configure risk settings and position sizing */}
                      <RiskManagementPanel
                        portfolioValue={portfolioValue}
                        currentRisk={positions.reduce((sum, p) => sum + (p.unrealized_pnl < 0 ? Math.abs(p.unrealized_pnl) : 0), 0)}
                        dailyLoss={dailyLoss}
                        onSettingsChange={(settings: any) => {
                          console.log('Risk settings updated:', settings);
                          try { localStorage.setItem('riskSettings', JSON.stringify(settings)); } catch (e) {}
                          // Best-effort: push to backend config
                          (async () => {
                            try {
                              await fetch('/api/paper-trading/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
                            } catch (err) {
                              console.warn('Failed to persist risk settings to backend', err);
                            }
                          })();
                        }}
                      />

                      {/* Correlation Heatmap - Symbol correlation matrix and sector performance */}
                      <CorrelationHeatmap
                        onSymbolSelect={(symbol: string) => {
                          console.log('Correlation pair selected:', symbol);
                          addNotification('signal', 'medium', 'Symbol Selected', `Analyzing correlation pair: ${symbol}`);
                          // Navigate to symbol chart view
                          try {
                            setSelectedSymbol(symbol);
                            setShowSymbolSearch(false);
                            // Optionally change route if chart route exists
                            try { setLocation(`/chart/${encodeURIComponent(symbol)}`); } catch (e) { /* ignore if routing not desired */ }
                          } catch (err) { console.warn(err); }
                        }}
                      />

                      {/* World Ticks Panel - Shows real-time market trades */}
                      <WorldTicksPanel ticks={worldTicks} limit={12} />

                      {/* Event feed and analytics */}
                      <EventFeedPanel ticks={worldTicks} signals={signals} alerts={notifications} />
                      <AnalyticsPanel
                        isReplaying={isReplaying}
                        speedMs={replayIntervalMs}
                        position={Math.max(0, replayPlayback.length - 1)}
                        duration={replaySourceRef.current ? replaySourceRef.current.length : worldTicks.length}
                        onStart={(ms?: number) => startReplay(ms)}
                        onPause={() => pauseReplay()}
                        onStop={() => stopReplay()}
                        onSetSpeed={(ms: number) => setReplaySpeed(ms)}
                        onSeek={(idx: number) => seekReplay(idx)}
                      />
                      </div>
                    </div>
                  </div>
                  </ReplayModeDesaturatedWrapper>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="mb-4">
                        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                          isGatewayConnected ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'
                        }`}>
                          <div className={`w-8 h-8 rounded-full ${
                            isGatewayConnected ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                      </div>
                        <div className="text-lg font-semibold mb-2">
                          {isGatewayConnected ? 'Connected to Scanner' : 'Connecting to Scanner...'}
                        </div>
                        <div className="text-sm text-gray-500 mb-4">
                          {isGatewayConnected
                            ? `Waiting for ${selectedSymbol} data from ${selectedExchange}`
                            : 'Establishing WebSocket connection...'
                          }
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        WebSocket Status: {isGatewayConnected ? '✅ Connected' : '❌ Disconnected'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        {/* Right Sidebar - Portfolio Summary (Overlay Mode) */}
        {showRightSidebar && (
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-40 shadow-2xl animate-in slide-in-from-right duration-300"
              aria-label="Portfolio Sidebar"
              onMouseEnter={() => {
                if (rightSidebarTimerRef.current) {
                  window.clearTimeout(rightSidebarTimerRef.current as number);
                }
              }}
              onMouseLeave={() => resetRightSidebarTimer()}
            >
            {/* Signal Details (if opened from a SignalCard) */}
            {openSignalDetails && (
              <div className="p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">Signal Details</h3>
                  <button className="text-slate-400 hover:text-white" onClick={() => setOpenSignalDetails(null)} aria-label="Close details">✕</button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono text-white">{openSignalDetails.symbol}</div>
                      <div className="text-xs text-slate-400">Triggered by: {openSignalDetails.signal ?? 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{currentPrice ? `$${currentPrice.toFixed(2)}` : '—'}</div>
                      <div className={`text-xs ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>{priceChangePercent ? `${priceChangePercent.toFixed(2)}%` : ''}</div>
                    </div>
                  </div>

                  {/* Compact preview chart */}
                  <div className="mt-3 mb-2">
                    <div className="h-28">
                      {previewChartData && previewChartData.length > 0 ? (
                        <TradingChart
                          data={previewChartData}
                          height={120}
                          maxCandles={40}
                          showVolume={false}
                          showRSI={false}
                          showMACD={false}
                          showEMA={false}
                          timeframe={selectedTimeframe}
                        />
                      ) : (
                        <div className="h-28 flex items-center justify-center text-xs text-slate-500">No preview data</div>
                      )}
                    </div>
                  </div>

                  {/* Signal metadata and reasoning */}
                  {(() => {
                    const sym = openSignalDetails.symbol;
                    // Prefer currentSignals then latestSignals
                    const sig = currentSignals.find(s => s.symbol === sym) || latestSignals?.find((s: any) => s.symbol === sym) || null;
                    if (!sig) {
                      return <div className="text-xs text-slate-400">No enriched signal data available for this symbol.</div>;
                    }

                    return (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-300">Type: <span className="font-medium">{sig.type || 'N/A'}</span> • Strength: <span className="font-mono">{(sig.strength || 0).toFixed(2)}</span></div>
                        {sig.reasoning && sig.reasoning.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 mb-1">Reasoning</div>
                            <ul className="text-xs list-disc list-inside text-slate-300">
                              {sig.reasoning.slice(0,5).map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Indicators */}
                        {sig.indicators && Object.keys(sig.indicators).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 mb-1">Indicators</div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                              {Object.entries(sig.indicators).slice(0,6).map(([k,v]) => (
                                <div key={k} className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-mono">{String(v)}</span></div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Market microstructure */}
                        {sig.marketMicrostructure && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 mb-1">Market Micro</div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                              <div>Spread: <span className="font-mono">{sig.marketMicrostructure.spread}</span></div>
                              <div>Depth: <span className="font-mono">{sig.marketMicrostructure.depth}</span></div>
                              <div>Imbalance: <span className="font-mono">{sig.marketMicrostructure.imbalance}</span></div>
                              <div>Toxicity: <span className="font-mono">{sig.marketMicrostructure.toxicity}</span></div>
                            </div>
                          </div>
                        )}

                        {/* Recent ticks */}
                        <div>
                          <div className="text-xs font-semibold text-slate-400 mb-1">Recent Ticks</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {(worldTicks.filter(t => t.symbol === openSignalDetails.symbol).slice(0,10) || []).map((t, i) => (
                              <div key={i} className="text-xs text-slate-300 flex justify-between"><span className="font-mono text-slate-400">{new Date(t.ts || Date.now()).toLocaleTimeString()}</span><span>{t.price ? `$${t.price.toFixed(2)}` : '-'}</span></div>
                            ))}
                            {worldTicks.filter(t => t.symbol === openSignalDetails.symbol).length === 0 && (
                              <div className="text-xs text-slate-500">No recent ticks for this symbol.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button onClick={() => { setShowQuickTradeModal(true); }} className="col-span-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded">Quick Trade</button>
                    <button onClick={() => { addNotification('system','low', 'Watch added', `Watching ${openSignalDetails.symbol}`); }} className="col-span-1 bg-slate-700 text-white py-2 rounded">Watch</button>
                    <button onClick={() => { navigator.clipboard?.writeText(openSignalDetails.symbol); addNotification('system','low','Copied', openSignalDetails.symbol); }} className="col-span-1 bg-slate-800 text-white py-2 rounded">Copy</button>
                  </div>
                </div>
              </div>
            )}
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

            {/* Portfolio Metrics - Using Unified StatCard */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <StatCard
                title="Total Return"
                value={`${((portfolioSummary?.metrics?.totalReturn ?? 0) * 100).toFixed(2)}%`}
                change={(portfolioSummary?.metrics?.totalReturn ?? 0) * 100}
                icon={TrendingUp}
                variant={(portfolioSummary?.metrics?.totalReturn ?? 0) >= 0 ? 'success' : 'error'}
                size="sm"
              />

              <StatCard
                title="Current Balance"
                value={`$${((portfolioSummary?.metrics?.currentBalance ?? 10000)).toLocaleString()}`}
                icon={Wallet}
                size="sm"
              />

              <StatCard
                title="Win Rate"
                value={`${((portfolioSummary?.metrics?.winRate ?? 0) * 100).toFixed(1)}%`}
                icon={Target}
                variant="info"
                size="sm"
              />

              <StatCard
                title="Total Trades"
                value={portfolioSummary?.metrics?.totalTrades ?? 0}
                icon={Activity}
                size="sm"
              />

              <StatCard
                title="Max Drawdown"
                value={`${((portfolioSummary?.metrics?.maxDrawdown ?? 0) * 100).toFixed(2)}%`}
                icon={TrendingDown}
                variant="warning"
                size="sm"
              />

              <StatCard
                title="Sharpe Ratio"
                value={(portfolioSummary?.metrics?.sharpeRatio ?? 0).toFixed(2)}
                icon={BarChart3}
                size="sm"
              />
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
        )}
        </div>
      </TerminalLayout>

      {/* Status Bar */}
      <footer className="bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 px-4 py-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isGatewayConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-slate-400">WebSocket:</span>
              <span className={isGatewayConnected ? 'text-green-400' : 'text-red-400'} data-testid="connection-status">
                {isGatewayConnected ? 'Connected' : 'Disconnected'}
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

              {/* Notification Hub */}
              <NotificationHub
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDismiss={dismissNotification}
                onClearAll={clearAll}
                soundEnabled={settings.soundEnabled}
                onToggleSound={toggleSound}
              />

              {/* Live / Paper toggle */}
              <div className="flex items-center space-x-3 mb-2">
                <div>
                  <button
                    onClick={() => {
                      // If enabling Live and not yet confirmed, show modal first
                      if (!isLiveMode && !liveEnabledConfirmed) {
                          setShowEnableLiveModal(true);
                          return;
                        }
                        const next = !isLiveMode
                        try { localStorage.setItem('isLiveMode', String(next)) } catch (e) {}
                        setIsLiveMode(next);
                    }}
                    className={`px-3 py-1 rounded-md font-medium ${isLiveMode ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200'}`}
                    title="Toggle Live / Paper mode"
                  >
                    {isLiveMode ? 'LIVE MODE' : 'Paper mode'}
                  </button>
                </div>
                {isLiveMode && (
                  <div className="text-xs text-red-400">Live trading enabled — ensure testMode off only with confirmation</div>
                )}
              </div>

              {/* Quick Actions Bar */}
              <QuickActionsBar
                currentSymbol={selectedSymbol}
                onQuickTrade={() => setShowQuickTradeModal(true)}
                onQuickScan={() => {
                  addNotification('system', 'medium', 'Quick Scan Started', `Scanning ${selectedSymbol} and market...`, {
                    metadata: { symbol: selectedSymbol, exchange: selectedExchange }
                  });

                  // Implement actual market scanning logic
                  setTimeout(() => {
                    // Scan current symbol signals
                    const currentSymbolSignals = signals.filter(s => s.symbol === selectedSymbol);
                    const strongSignals = currentSymbolSignals.filter(s => s.strength >= 0.75);
                    
                    // Scan all symbols for opportunities
                    const scanResults: any[] = [];
                    const uniqueSymbols = new Set(signals.map(s => s.symbol));
                    
                    uniqueSymbols.forEach(symbol => {
                      const symbolSignals = signals.filter(s => s.symbol === symbol);
                      if (symbolSignals.length === 0) return;
                      
                      const avgStrength = symbolSignals.reduce((sum, s) => sum + s.strength, 0) / symbolSignals.length;
                      const buySignals = symbolSignals.filter(s => s.type === 'BUY').length;
                      const sellSignals = symbolSignals.filter(s => s.type === 'SELL').length;
                      
                      // Calculate opportunity score (0-100)
                      const signalScore = avgStrength * 100;
                      const consensusScore = Math.abs(buySignals - sellSignals) * 10;
                      const opportunityScore = Math.min(100, (signalScore + consensusScore) / 2);
                      
                      if (opportunityScore >= 60 || strongSignals.length > 0) {
                        scanResults.push({
                          symbol,
                          opportunity: opportunityScore,
                          signals: symbolSignals.length,
                          buySignals,
                          sellSignals,
                          avgStrength,
                          type: buySignals > sellSignals ? 'buy' : 'sell'
                        });
                      }
                    });
                    
                    // Sort by opportunity score
                    scanResults.sort((a, b) => b.opportunity - a.opportunity);
                    const topOpportunities = scanResults.slice(0, 5);
                    
                    addNotification('signal', 'high', 'Scan Complete', 
                      `Found ${topOpportunities.length} high-probability opportunities with ${strongSignals.length} strong signals on ${selectedSymbol}`, 
                      {
                        actionLabel: 'View Results',
                        metadata: { 
                          opportunities: topOpportunities.length, 
                          strongSignals: strongSignals.length,
                          topSymbols: topOpportunities.map(r => r.symbol).slice(0, 3).join(', ')
                        }
                      }
                    );
                    
                    // Log scan results for debugging
                    console.log('Market Scan Results:', {
                      timestamp: new Date().toISOString(),
                      scannedSymbols: uniqueSymbols.size,
                      currentSymbol: selectedSymbol,
                      currentSymbolSignals: strongSignals.length,
                      topOpportunities: topOpportunities.slice(0, 3)
                    });
                  }, 1500);
                }}
                onAddToWatchlist={() => {
                  addNotification('system', 'low', 'Added to Watchlist', `${selectedSymbol} added to your watchlist`, {
                    metadata: { symbol: selectedSymbol }
                  });
                }}
                onSetPriceAlert={() => {
                  addNotification('system', 'low', 'Price Alert Created', `You'll be notified when ${selectedSymbol} reaches your target`, {
                    metadata: { symbol: selectedSymbol, targetPrice: currentPrice * 1.05 }
                  });
                }}
                onTakeScreenshot={() => {
                  (async () => {
                    await takeChartScreenshot();
                  })();
                }}
                onShareChart={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  addNotification('system', 'low', 'Link Copied', 'Chart link copied to clipboard', {
                    metadata: { url: window.location.href }
                  });
                }}
              />

              {/* Enable Live Trading Confirmation Modal (simple inline) */}
              {showEnableLiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-slate-900 p-6 rounded-lg w-96 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-2">Enable Live Trading</h3>
                    <p className="text-sm text-slate-400 mb-4">Live trading will place real orders on exchanges. To proceed, type <span className="font-mono">ENABLE LIVE</span> below and click Confirm.</p>
                    <input
                      autoFocus
                      placeholder="Type ENABLE LIVE to confirm"
                      id="enable-live-input"
                      className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 mb-3 text-white"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setShowEnableLiveModal(false)}
                        className="px-3 py-1 rounded bg-slate-700 text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          try {
                            const el = (document.getElementById('enable-live-input') as HTMLInputElement | null);
                            if (!el || el.value.trim() !== 'ENABLE LIVE') {
                              addNotification('system', 'high', 'Confirmation Failed', 'You must type ENABLE LIVE to confirm.');
                              return;
                            }
                            localStorage.setItem('liveEnabledConfirmed', 'true');
                            setLiveEnabledConfirmed(true);
                            setShowEnableLiveModal(false);
                            try { localStorage.setItem('isLiveMode', 'true') } catch (e) {}
                            setIsLiveMode(true);
                            addNotification('system', 'high', 'Live Enabled', 'Live trading enabled locally. Server-side live config may still require testMode toggling.');
                          } catch (err) {
                            console.error('Enable Live error', err);
                            addNotification('system', 'high', 'Enable Live Error', String(err));
                          }
                        }}
                        className="px-3 py-1 rounded bg-red-600 text-white"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Trade Modal */}
              <QuickTradeModal
                isOpen={showQuickTradeModal}
                onClose={() => setShowQuickTradeModal(false)}
                symbol={selectedSymbol}
                currentPrice={currentPrice}
              />
            </div>
          );
        }