import React, { useState, useEffect } from 'react';
import { RegimePanel } from './RegimePanel';
import {
  TrendingUp, Activity, BarChart3, Zap,
  ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff,
  AlertTriangle, CheckCircle, Target, Gauge, Layers, Filter, Copy, Download
} from 'lucide-react';

interface Strategy {
  name: string;
  category: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
  confidence: number;
  winRate: number;
  description: string;
  timeframes: string[];
  bestFor: string;
  indicators: string[];
  performance?: {
    returns: number;
    drawdown: number;
    sharpeRatio: number;
  };
}

interface MarketCondition {
  condition: 'STRONG_UPTREND' | 'UPTREND' | 'RANGING' | 'DOWNTREND' | 'STRONG_DOWNTREND' | 'VOLATILE' | 'LOW_VOLATILITY';
  confidence: number;
  description: string;
  indicators: {
    ema20: number;
    ema50: number;
    adx: number;
    atr: number;
  };
}

interface AgentRecommendation {
  agent: string;
  alignment: number;
  strategies: string[];
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface StrategyPanelProps {
  symbol: string;
  isLoading?: boolean;
  onStrategySelect?: (strategy: string) => void;
  onAgentSelect?: (agent: string) => void;
  compact?: boolean;
  onRefresh?: () => void;
}

const STRATEGY_DATA: Strategy[] = [
  // Trend Following (4)
  {
    name: 'MACD Crossover',
    category: 'Trend Following',
    signal: 'NEUTRAL',
    strength: 3,
    confidence: 58,
    winRate: 58,
    description: 'MACD line crosses signal line',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'Strong trends',
    indicators: ['MACD', 'Signal Line', 'Histogram'],
    performance: { returns: 12.5, drawdown: 8.2, sharpeRatio: 1.52 }
  },
  {
    name: 'ADX Trend Filter',
    category: 'Trend Following',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 65,
    winRate: 65,
    description: 'ADX > 25 indicates strong trend',
    timeframes: ['1h', '4h', '1d', '1w'],
    bestFor: 'Trend confirmation',
    indicators: ['ADX', 'DI+', 'DI-'],
    performance: { returns: 15.3, drawdown: 6.5, sharpeRatio: 1.88 }
  },
  {
    name: 'Parabolic SAR',
    category: 'Trend Following',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 52,
    winRate: 52,
    description: 'SAR stop reversal indicator',
    timeframes: ['5m', '15m', '1h'],
    bestFor: 'Quick exits',
    indicators: ['SAR', 'Trend Direction'],
    performance: { returns: 10.2, drawdown: 11.5, sharpeRatio: 0.89 }
  },
  {
    name: 'Ichimoku Cloud',
    category: 'Trend Following',
    signal: 'NEUTRAL',
    strength: 4,
    confidence: 68,
    winRate: 68,
    description: 'Price above/below cloud + cross signals',
    timeframes: ['4h', '1d', '1w'],
    bestFor: 'Multi-timeframe trends',
    indicators: ['Tenkan', 'Kijun', 'Cloud', 'Chikou'],
    performance: { returns: 18.7, drawdown: 7.1, sharpeRatio: 2.15 }
  },

  // Momentum (3)
  {
    name: 'RSI Oversold/Overbought',
    category: 'Momentum',
    signal: 'NEUTRAL',
    strength: 3,
    confidence: 62,
    winRate: 62,
    description: 'RSI < 30 (oversold) or > 70 (overbought)',
    timeframes: ['5m', '15m', '1h', '4h'],
    bestFor: 'Mean reversion',
    indicators: ['RSI(14)', 'Divergence'],
    performance: { returns: 14.1, drawdown: 9.3, sharpeRatio: 1.52 }
  },
  {
    name: 'Stochastic Crossover',
    category: 'Momentum',
    signal: 'NEUTRAL',
    strength: 3,
    confidence: 63,
    winRate: 63,
    description: '%K crosses %D line',
    timeframes: ['15m', '1h', '4h'],
    bestFor: 'Short-term reversals',
    indicators: ['%K', '%D', 'Smoothing'],
    performance: { returns: 13.8, drawdown: 10.2, sharpeRatio: 1.35 }
  },
  {
    name: 'CCI Mean Reversion',
    category: 'Momentum',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 58,
    winRate: 58,
    description: 'CCI > 100 (overbought) or < -100 (oversold)',
    timeframes: ['1h', '4h'],
    bestFor: 'Ranging markets',
    indicators: ['CCI(20)', 'Levels'],
    performance: { returns: 11.9, drawdown: 8.7, sharpeRatio: 1.37 }
  },

  // Volatility (3)
  {
    name: 'Bollinger Squeeze',
    category: 'Volatility',
    signal: 'NEUTRAL',
    strength: 3,
    confidence: 68,
    winRate: 68,
    description: 'Bands narrow then expand (breakout)',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'Breakout entries',
    indicators: ['BB Upper', 'BB Lower', 'SMA', 'Bandwidth'],
    performance: { returns: 16.2, drawdown: 8.9, sharpeRatio: 1.82 }
  },
  {
    name: 'Bollinger Reversal',
    category: 'Volatility',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 65,
    winRate: 65,
    description: 'Price touches band + reversal signal',
    timeframes: ['5m', '15m', '1h', '4h'],
    bestFor: 'Mean reversion',
    indicators: ['BB Bands', 'Price Touch', 'Momentum'],
    performance: { returns: 14.5, drawdown: 9.1, sharpeRatio: 1.59 }
  },
  {
    name: 'Keltner Channel Breakout',
    category: 'Volatility',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 62,
    winRate: 62,
    description: 'Price breaks Keltner channel',
    timeframes: ['4h', '1d'],
    bestFor: 'Volatile markets',
    indicators: ['KC Upper', 'KC Lower', 'ATR'],
    performance: { returns: 12.8, drawdown: 10.5, sharpeRatio: 1.22 }
  },

  // Volume (3)
  {
    name: 'OBV Divergence',
    category: 'Volume',
    signal: 'NEUTRAL',
    strength: 3,
    confidence: 68,
    winRate: 68,
    description: 'Price and OBV divergence',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'Trend confirmation',
    indicators: ['OBV', 'Price', 'Divergence'],
    performance: { returns: 15.7, drawdown: 7.8, sharpeRatio: 2.01 }
  },
  {
    name: 'MFI Oversold/Overbought',
    category: 'Volume',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 63,
    winRate: 63,
    description: 'MFI < 20 or > 80 with volume',
    timeframes: ['1h', '4h'],
    bestFor: 'Volume confirmation',
    indicators: ['MFI(14)', 'Volume'],
    performance: { returns: 13.2, drawdown: 9.4, sharpeRatio: 1.40 }
  },
  {
    name: 'CMF Accumulation',
    category: 'Volume',
    signal: 'NEUTRAL',
    strength: 2,
    confidence: 60,
    winRate: 60,
    description: 'Chaikin Money Flow accumulation',
    timeframes: ['4h', '1d'],
    bestFor: 'Long-term trends',
    indicators: ['CMF', 'Volume', 'Close Price'],
    performance: { returns: 11.5, drawdown: 8.3, sharpeRatio: 1.38 }
  },

  // Combination (3)
  {
    name: 'Triple Confirmation',
    category: 'Combination',
    signal: 'NEUTRAL',
    strength: 5,
    confidence: 72,
    winRate: 72,
    description: 'RSI + MACD + Bollinger aligned',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'High-confidence entries',
    indicators: ['RSI', 'MACD', 'Bollinger'],
    performance: { returns: 19.3, drawdown: 5.2, sharpeRatio: 2.48 }
  },
  {
    name: 'Bollinger + RSI Double',
    category: 'Combination',
    signal: 'NEUTRAL',
    strength: 4,
    confidence: 68,
    winRate: 68,
    description: 'Bollinger band + RSI confirmation',
    timeframes: ['15m', '1h', '4h'],
    bestFor: 'Pullback entries',
    indicators: ['Bollinger', 'RSI', 'Volume'],
    performance: { returns: 16.8, drawdown: 6.9, sharpeRatio: 2.04 }
  },
  {
    name: 'Trend + Volume Confirmation',
    category: 'Combination',
    signal: 'NEUTRAL',
    strength: 4,
    confidence: 68,
    winRate: 68,
    description: 'Trend direction + volume spike',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'Breakout confirmation',
    indicators: ['Trend', 'Volume', 'Price Action'],
    performance: { returns: 17.1, drawdown: 7.4, sharpeRatio: 1.96 }
  },

  // Advanced (2)
  {
    name: 'Ichimoku + Fibonacci',
    category: 'Advanced',
    signal: 'NEUTRAL',
    strength: 5,
    confidence: 72,
    winRate: 72,
    description: 'Ichimoku cloud + Fib levels confluence',
    timeframes: ['4h', '1d', '1w'],
    bestFor: 'Major support/resistance',
    indicators: ['Ichimoku', 'Fibonacci', 'Confluence'],
    performance: { returns: 20.1, drawdown: 6.2, sharpeRatio: 2.55 }
  },
  {
    name: 'Elder Ray Power',
    category: 'Advanced',
    signal: 'NEUTRAL',
    strength: 4,
    confidence: 65,
    winRate: 65,
    description: 'Elder Ray Bull/Bear Power + EMA',
    timeframes: ['1h', '4h', '1d'],
    bestFor: 'Institutional moves',
    indicators: ['Bull Power', 'Bear Power', 'EMA'],
    performance: { returns: 17.8, drawdown: 7.9, sharpeRatio: 2.12 }
  }
];

const AGENT_SPECIALIZATIONS: Record<string, AgentRecommendation> = {
  'TrendRider': {
    agent: 'TrendRider',
    alignment: 95,
    strategies: ['MACD Crossover', 'ADX Trend Filter', 'Parabolic SAR', 'Ichimoku Cloud'],
    decision: 'BUY',
    confidence: 85,
    riskLevel: 'LOW'
  },
  'MomentumHunter': {
    agent: 'MomentumHunter',
    alignment: 92,
    strategies: ['RSI Oversold/Overbought', 'Stochastic Crossover', 'CCI Mean Reversion'],
    decision: 'BUY',
    confidence: 78,
    riskLevel: 'MEDIUM'
  },
  'VolatilityTrader': {
    agent: 'VolatilityTrader',
    alignment: 88,
    strategies: ['Bollinger Squeeze', 'Bollinger Reversal', 'Keltner Channel Breakout'],
    decision: 'BUY',
    confidence: 72,
    riskLevel: 'MEDIUM'
  },
  'VolumeAnalyzer': {
    agent: 'VolumeAnalyzer',
    alignment: 90,
    strategies: ['OBV Divergence', 'MFI Oversold/Overbought', 'CMF Accumulation'],
    decision: 'BUY',
    confidence: 75,
    riskLevel: 'LOW'
  },
  'PrecisionScalper': {
    agent: 'PrecisionScalper',
    alignment: 85,
    strategies: ['Triple Confirmation', 'Bollinger + RSI Double'],
    decision: 'HOLD',
    confidence: 65,
    riskLevel: 'HIGH'
  },
  'SwingTrader': {
    agent: 'SwingTrader',
    alignment: 92,
    strategies: ['Ichimoku + Fibonacci', 'Elder Ray Power', 'Trend + Volume Confirmation'],
    decision: 'BUY',
    confidence: 80,
    riskLevel: 'MEDIUM'
  }
};

export const StrategyPanel: React.FC<StrategyPanelProps> = ({
  symbol = 'BTC/USDT',
  isLoading = false,
  onStrategySelect,
  onAgentSelect,
  compact = false,
  onRefresh
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string>('Trend Following');
  const [selectedAgent, setSelectedAgent] = useState<string>('TrendRider');
  const [marketCondition, setMarketCondition] = useState<MarketCondition>({
    condition: 'UPTREND',
    confidence: 85,
    description: 'Strong uptrend detected. EMA20 > EMA50, ADX > 25',
    indicators: {
      ema20: 28150,
      ema50: 27900,
      adx: 32,
      atr: 150
    }
  });
  const [strategyAgreement, setStrategyAgreement] = useState(75);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  
  // Performance tracking state (history per strategy)
  const [performanceHistory, setPerformanceHistory] = useState<Record<string, Array<{ ts: number; winRate: number; returns?: number }>>>({});
  // Strategies state (allows server refresh)
  const [strategies, setStrategies] = useState<Strategy[]>(STRATEGY_DATA);
  const [liveSync, setLiveSync] = useState(false);
  const [pollInterval, setPollInterval] = useState<number>(30); // seconds
  const pollRef = React.useRef<number | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [regimeTimeframe, setRegimeTimeframe] = useState<string>('1h');

  // Export/Share UI state
  const [isExporting, setIsExporting] = useState(false);

  // Helper: load history from localStorage
  const loadPerformanceHistory = () => {
    try {
      const raw = localStorage.getItem('strategyPerformanceHistory');
      if (raw) setPerformanceHistory(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load strategy history', e);
    }
  };

  // Helper: save history to localStorage
  const savePerformanceHistory = (next: typeof performanceHistory) => {
    try {
      localStorage.setItem('strategyPerformanceHistory', JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save strategy history', e);
    }
  };

  useEffect(() => {
    loadPerformanceHistory();
  }, []);

  // Record a snapshot for a strategy (local optimistic + POST to server)
  const recordSnapshot = async (strategyName: string) => {
    const strategy = strategies.find(s => s.name === strategyName);
    if (!strategy) return;
    const entry = { ts: Date.now(), winRate: strategy.winRate, returns: strategy.performance?.returns };

    // Optimistic local update
    const next = { ...performanceHistory };
    next[strategyName] = next[strategyName] ? [...next[strategyName], entry] : [entry];
    setPerformanceHistory(next);
    savePerformanceHistory(next);

    // POST to server endpoint (best-effort). Backend may respond with updated history.
    try {
      const res = await fetch('/api/strategy/performance-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strategyName, entry })
      });

      if (res.ok) {
        const data = await res.json();
        // Server may return { history: { [name]: [...] } } or { updated: [...] } or { entry }
        if (data.history && typeof data.history === 'object') {
          setPerformanceHistory(data.history);
          savePerformanceHistory(data.history);
        } else if (data.updated && data.updated[strategyName]) {
          const serverHist = { ...performanceHistory, [strategyName]: data.updated[strategyName] };
          setPerformanceHistory(serverHist);
          savePerformanceHistory(serverHist);
        } else if (data.entry) {
          const merged = { ...performanceHistory };
          merged[strategyName] = merged[strategyName] ? [...merged[strategyName], data.entry] : [data.entry];
          setPerformanceHistory(merged);
          savePerformanceHistory(merged);
        }
      }
    } catch (e) {
      // Best-effort: keep optimistic local snapshot if server unavailable
      console.warn('Failed to POST snapshot to server', e);
    }
  };

  // Export strategies + agents + history as JSON file
  const exportAll = () => {
    setIsExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        strategies: strategies,
        agents: AGENT_SPECIALIZATIONS,
        history: performanceHistory
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scanstream_strategies_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch latest strategy registry (win rates, confidence) from server
  const fetchRegistry = async () => {
    try {
      const res = await fetch('/api/strategy/registry');
      if (!res.ok) return;
      const data = await res.json();
      // support both { strategies: [...] } and direct array
      const serverStrategies: Strategy[] = data.strategies || data;
      if (Array.isArray(serverStrategies) && serverStrategies.length) {
        setStrategies(serverStrategies);
      }
    } catch (e) {
      console.warn('Failed to fetch strategy registry', e);
    }
  };

  // Fetch performance history from server (optional endpoint)
  const fetchHistoryFromServer = async () => {
    try {
      const res = await fetch('/api/strategy/performance-history');
      if (!res.ok) return;
      const data = await res.json();
      const hist = data.history || data;
      if (hist && typeof hist === 'object') {
        setPerformanceHistory(hist);
        savePerformanceHistory(hist);
      }
    } catch (e) {
      // silent if endpoint missing
    }
  };

  // Polling control
  useEffect(() => {
    if (!liveSync) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // initial fetch
    fetchRegistry();

    const id = window.setInterval(() => fetchRegistry(), Math.max(5, pollInterval) * 1000);
    pollRef.current = id;
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [liveSync, pollInterval]);

  // Copy export JSON to clipboard
  const copyExportToClipboard = async () => {
    const payload = { strategies: STRATEGY_DATA, agents: AGENT_SPECIALIZATIONS, history: performanceHistory };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      // small visual cue could be added
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  // Clone (download) single agent configuration
  const cloneAgentConfig = (agentKey: string) => {
    const cfg = AGENT_SPECIALIZATIONS[agentKey];
    if (!cfg) return;
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_${agentKey}_config_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  // NEW: Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterMarketCondition, setFilterMarketCondition] = useState<string>('All');
  const [minWinRate, setMinWinRate] = useState<number>(0);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [filterWinRate, setFilterWinRate] = useState<number>(0);
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>(strategies);
  const [isLoadingMarketCondition, setIsLoadingMarketCondition] = useState(false);

  // Fetch market condition from backend
  const fetchMarketCondition = async () => {
    setIsLoadingMarketCondition(true);
    try {
      const response = await fetch('/api/strategy/market-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });

      if (response.ok) {
        const data = await response.json();
        setMarketCondition(data.marketCondition);
        setFilterMarketCondition(data.marketCondition.condition);
      }
    } catch (error) {
      console.error('Failed to fetch market condition:', error);
    } finally {
      setIsLoadingMarketCondition(false);
    }
  };

  // Filter strategies based on criteria
  useEffect(() => {
    let filtered = strategies;

    // Filter by win rate
    if (filterWinRate > 0) {
      filtered = filtered.filter(s => s.winRate >= filterWinRate);
    }

    // Filter by market condition
    if (filterMarketCondition) {
      filtered = filtered.filter(s => s.bestFor.toLowerCase().includes(filterMarketCondition.toLowerCase()));
    }

    // Filter by selected agent
    const agentStrategies = AGENT_SPECIALIZATIONS[selectedAgent]?.strategies || [];
    filtered = filtered.filter(s => agentStrategies.includes(s.name) || selectedAgent === 'MultiStrategy');

    setFilteredStrategies(filtered);

    // Recalculate strategy agreement
    const buyCount = filtered.filter(s => s.signal === 'BUY').length;
    const totalCount = filtered.length || 1;
    setStrategyAgreement(Math.round((buyCount / totalCount) * 100));
  }, [filterWinRate, filterMarketCondition, selectedAgent]);

  // Fetch market condition on mount and when symbol changes
  useEffect(() => {
    fetchMarketCondition();
  }, [symbol]);

  // Fetch registry and history optionally on mount
  useEffect(() => {
    // attempt to fetch server registry once on mount
    fetchRegistry();
    fetchHistoryFromServer();
  }, []);

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Trend Following': 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
      'Momentum': 'from-green-500/20 to-green-500/5 border-green-500/30',
      'Volatility': 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
      'Volume': 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
      'Combination': 'from-pink-500/20 to-pink-500/5 border-pink-500/30',
      'Advanced': 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30'
    };
    return colors[category] || 'from-slate-500/20 to-slate-500/5 border-slate-500/30';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Trend Following': <TrendingUp className="w-4 h-4" />,
      'Momentum': <Activity className="w-4 h-4" />,
      'Volatility': <Zap className="w-4 h-4" />,
      'Volume': <BarChart3 className="w-4 h-4" />,
      'Combination': <Layers className="w-4 h-4" />,
      'Advanced': <Target className="w-4 h-4" />
    };
    return icons[category];
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-green-400 bg-green-500/10';
      case 'SELL': return 'text-red-400 bg-red-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  // NEW: Helper function to get strategies for an agent
  const getStrategiesForAgent = (agent: string): Strategy[] => {
    if (agent === 'All') return strategies;
    const agentStrategies = AGENT_SPECIALIZATIONS[agent]?.strategies || [];
    return strategies.filter(s => agentStrategies.includes(s.name));
  };

  // NEW: Helper function to filter strategies based on all criteria
  const getFilteredStrategies = (strategies: Strategy[]): Strategy[] => {
    return strategies.filter(strategy => {
      // Filter by agent
      if (filterAgent !== 'All') {
        const agentStrategies = AGENT_SPECIALIZATIONS[filterAgent]?.strategies || [];
        if (!agentStrategies.includes(strategy.name)) return false;
      }

      // Filter by market condition (strategies marked as "best for")
      if (filterMarketCondition !== 'All') {
        // Check if strategy is good for this market condition
        const conditionMap: Record<string, string[]> = {
          'STRONG_UPTREND': ['MACD Crossover', 'ADX Trend Filter', 'Ichimoku Cloud', 'Elder Ray Power'],
          'UPTREND': ['MACD Crossover', 'ADX Trend Filter', 'OBV Divergence', 'Ichimoku Cloud'],
          'RANGING': ['RSI Oversold/Overbought', 'Stochastic Crossover', 'CCI Mean Reversion', 'Bollinger Reversal'],
          'DOWNTREND': ['Parabolic SAR', 'ADX Trend Filter', 'Elder Ray Power'],
          'VOLATILE': ['Bollinger Squeeze', 'Keltner Channel Breakout', 'CCI Mean Reversion'],
          'LOW_VOLATILITY': ['MACD Crossover', 'ADX Trend Filter']
        };
        if (!conditionMap[filterMarketCondition]?.includes(strategy.name)) return false;
      }

      // Filter by minimum win rate
      if (strategy.winRate < minWinRate) return false;

      // Filter by minimum confidence
      if (strategy.confidence < minConfidence) return false;

      return true;
    });
  };

  const categories = Array.from(new Set(strategies.map(s => s.category)));

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Quick Agent Selector */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <label className="text-xs font-semibold text-slate-400 uppercase">Active Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value);
              onAgentSelect?.(e.target.value);
            }}
            className="w-full mt-2 bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {Object.keys(AGENT_SPECIALIZATIONS).map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        </div>

        {/* Win Rate Filter */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Min Win Rate</label>
            <span className="text-sm font-bold text-green-400">{filterWinRate}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filterWinRate}
            onChange={(e) => setFilterWinRate(Number(e.target.value))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Market Condition */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Market Condition</label>
            <button
              onClick={() => fetchMarketCondition()}
              disabled={isLoadingMarketCondition}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {isLoadingMarketCondition ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div className="text-sm font-bold text-white truncate">{marketCondition.condition}</div>
          <div className="text-xs text-slate-400">{marketCondition.confidence}% confidence</div>
        </div>

        {/* Strategy Agreement */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Strategy Agreement</span>
            <span className="text-sm font-bold text-green-400">{strategyAgreement}%</span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all"
              style={{ width: `${strategyAgreement}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-2">{filteredStrategies.length} active strategies</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 rounded-lg border border-slate-700/50 p-6 space-y-6">
      {/* Header with Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-400" />
              Strategy Analysis - {symbol}
            </h2>
            <p className="text-xs text-slate-400 mt-1">19 strategies across 6 categories</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded transition flex items-center gap-2 ${
                showFilters ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-slate-700/50'
              }`}
            >
              <Filter className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">Filters</span>
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 hover:bg-slate-700/50 rounded transition disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {/* Export / Copy */}
            <button
              onClick={exportAll}
              disabled={isExporting}
              className="p-2 hover:bg-slate-700/50 rounded transition"
              title="Export strategies as JSON"
            >
              <Download className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={copyExportToClipboard}
              className="p-2 hover:bg-slate-700/50 rounded transition"
              title="Copy strategies JSON to clipboard"
            >
              <Copy className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Agent Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Filter by Agent</label>
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Agents</option>
                  {Object.keys(AGENT_SPECIALIZATIONS).map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>

              {/* Market Condition Filter */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Market Condition</label>
                <select
                  value={filterMarketCondition}
                  onChange={(e) => setFilterMarketCondition(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Conditions</option>
                  <option value="STRONG_UPTREND">Strong Uptrend</option>
                  <option value="UPTREND">Uptrend</option>
                  <option value="RANGING">Ranging</option>
                  <option value="DOWNTREND">Downtrend</option>
                  <option value="VOLATILE">Volatile</option>
                  <option value="LOW_VOLATILITY">Low Volatility</option>
                </select>
              </div>

              {/* Min Win Rate */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">
                  Min Win Rate: {minWinRate}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minWinRate}
                  onChange={(e) => setMinWinRate(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Min Confidence */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">
                  Min Confidence: {minConfidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            {/* Reset Filters Button */}
            <button
              onClick={() => {
                setFilterAgent('All');
                setFilterMarketCondition('All');
                setMinWinRate(0);
                setMinConfidence(0);
              }}
              className="text-xs text-slate-400 hover:text-slate-300 underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Market Condition */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">Market Condition</h3>
            <button
              onClick={() => fetchMarketCondition()}
              disabled={isLoadingMarketCondition}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {isLoadingMarketCondition ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{marketCondition.condition}</span>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-green-400">{marketCondition.confidence}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">{marketCondition.description}</p>
            {/* Regime panel (server-side authoritative regime) */}
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs text-slate-400">TF</label>
              <select
                value={regimeTimeframe}
                onChange={(e) => setRegimeTimeframe(e.target.value)}
                className="bg-slate-700/40 text-xs rounded px-2 py-1"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </div>
            <RegimePanel symbol={symbol} timeframe={regimeTimeframe} />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Strategy Agreement</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Consensus</span>
              <span className="text-sm font-bold text-green-400">{strategyAgreement}%</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all"
                style={{ width: `${strategyAgreement}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{filteredStrategies.length} active strategies</p>
          </div>
        </div>
      </div>

      {/* Filtering Controls */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Min Win Rate</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filterWinRate}
              onChange={(e) => setFilterWinRate(Number(e.target.value))}
              className="flex-1 accent-green-500"
            />
            <span className="text-sm font-bold text-green-400 w-8 text-right">{filterWinRate}%</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Filter by Best For</label>
          <select
            value={filterMarketCondition}
            onChange={(e) => setFilterMarketCondition(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Conditions</option>
            <option value="trend">Trends</option>
            <option value="ranging">Ranging</option>
            <option value="reversal">Reversals</option>
            <option value="breakout">Breakouts</option>
            <option value="volatility">Volatility</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Active Strategies</label>
          <div className="text-2xl font-bold text-blue-400">{filteredStrategies.length}</div>
            <div className="text-xs text-slate-400">of {strategies.length} total</div>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Recommended Agents</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(AGENT_SPECIALIZATIONS).map(([agentKey, agent]) => (
            <button
              key={agentKey}
              onClick={() => {
                setSelectedAgent(agentKey);
                setShowAgentDetails(true);
                onAgentSelect?.(agentKey);
              }}
              className={`p-3 rounded-lg border transition ${
                selectedAgent === agentKey
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-slate-700/30 border-slate-600/50 hover:border-slate-500/50'
              }`}
            >
              <div className="text-left">
                <div className="text-xs font-semibold text-white">{agent.agent}</div>
                <div className="text-xs text-slate-400 mt-1">
                  <span className={getSignalColor(agent.decision)}>
                    {agent.decision}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Details */}
      {showAgentDetails && selectedAgent && (
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-400">{AGENT_SPECIALIZATIONS[selectedAgent]?.agent} Analysis</h3>
            <button
              onClick={() => setShowAgentDetails(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-300">Agent Alignment:</span>
              <span className="text-blue-400 font-bold">{AGENT_SPECIALIZATIONS[selectedAgent]?.alignment}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Decision:</span>
              <span className={`font-bold ${getSignalColor(AGENT_SPECIALIZATIONS[selectedAgent]?.decision || 'NEUTRAL')}`}>
                {AGENT_SPECIALIZATIONS[selectedAgent]?.decision}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Confidence:</span>
              <span className="text-blue-400 font-bold">{AGENT_SPECIALIZATIONS[selectedAgent]?.confidence}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Risk Level:</span>
              <span className={`font-bold ${
                AGENT_SPECIALIZATIONS[selectedAgent]?.riskLevel === 'LOW' ? 'text-green-400' :
                AGENT_SPECIALIZATIONS[selectedAgent]?.riskLevel === 'MEDIUM' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {AGENT_SPECIALIZATIONS[selectedAgent]?.riskLevel}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-600">
              <p className="text-slate-300 mb-2">Specialized Strategies:</p>
              <div className="flex flex-wrap gap-1">
                {AGENT_SPECIALIZATIONS[selectedAgent]?.strategies.map(strat => (
                  <span key={strat} className="px-2 py-1 bg-slate-700/50 rounded text-slate-300 text-xs">
                    {strat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Strategy List */}
      <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase">Filtered Strategies ({filteredStrategies.length} of {strategies.length})</h3>
        
        {categories.map(category => {
          const strategies = filteredStrategies.filter(s => s.category === category);
          if (strategies.length === 0) return null;
          
          const isExpanded = expandedCategory === category;

          return (
            <div
              key={category}
              className={`bg-gradient-to-r ${getCategoryColor(category)} rounded-lg border p-0 overflow-hidden transition`}
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? '' : category)}
                className="w-full p-3 flex items-center justify-between hover:bg-black/20 transition"
              >
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <span className="font-semibold text-white">{category}</span>
                  <span className="text-xs text-slate-400">({strategies.length})</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Strategies List */}
              {isExpanded && (
                <div className="border-t border-current/20 divide-y divide-current/20">
                  {strategies.map(strategy => (
                    <div
                      key={strategy.name}
                      className="p-3 hover:bg-black/20 cursor-pointer transition group"
                      onClick={() => onStrategySelect?.(strategy.name)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm group-hover:text-blue-400 transition">
                            {strategy.name}
                          </div>
                          <div className="text-xs text-slate-300 mt-1">{strategy.description}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`px-2 py-1 rounded text-xs font-bold ${getSignalColor(strategy.signal)}`}>
                            {strategy.signal}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); recordSnapshot(strategy.name); }}
                              className="px-2 py-1 text-xs bg-slate-700/40 hover:bg-slate-700/60 rounded"
                              title="Record current performance"
                            >
                              Rec
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowHistoryFor(showHistoryFor === strategy.name ? null : strategy.name); }}
                              className="p-1 text-xs bg-slate-700/40 hover:bg-slate-700/60 rounded"
                              title="Toggle history"
                            >
                              <Eye className="w-4 h-4 text-slate-300" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-2 text-xs">
                        <div>
                          <span className="text-slate-400">Strength:</span>
                          <div className="text-white font-semibold">{strategy.strength}/5</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Confidence:</span>
                          <div className="text-white font-semibold">{strategy.confidence}%</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Win Rate:</span>
                          <div className="text-white font-semibold">{strategy.winRate}%</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Sharpe:</span>
                          <div className="text-white font-semibold">{strategy.performance?.sharpeRatio.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {strategy.timeframes.map(tf => (
                          <span key={tf} className="px-2 py-0.5 bg-slate-700/30 rounded text-xs text-slate-300">
                            {tf}
                          </span>
                        ))}
                      </div>
                      {/* History sparkline / list */}
                      {showHistoryFor === strategy.name && (
                        <div className="mt-2 text-xs text-slate-300">
                          {performanceHistory[strategy.name] && performanceHistory[strategy.name].length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">History</span>
                                <span className="text-slate-400">{performanceHistory[strategy.name].length} points</span>
                              </div>
                              <div className="w-full h-8">
                                {/* Simple sparkline */}
                                <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-8">
                                  {(() => {
                                    const points = performanceHistory[strategy.name].map(p => p.winRate);
                                    const max = Math.max(...points, 100);
                                    const min = Math.min(...points, 0);
                                    const len = points.length;
                                    const step = len > 1 ? 100 / (len - 1) : 100;
                                    const path = points.map((v, i) => {
                                      const x = (i * step).toFixed(2);
                                      const y = (20 - ((v - min) / (max - min || 1)) * 20).toFixed(2);
                                      return `${x},${y}`;
                                    }).join(' ');
                                    return <polyline fill="none" stroke="#60A5FA" strokeWidth="1.5" points={path} />;
                                  })()}
                                </svg>
                              </div>
                              <div className="text-xs text-slate-400">
                                {performanceHistory[strategy.name].slice(-5).reverse().map(e => (
                                  <div key={e.ts} className="flex justify-between">
                                    <span>{new Date(e.ts).toLocaleString()}</span>
                                    <span className="font-semibold">{e.winRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-slate-500">No history recorded yet. Click "Rec" to snapshot current performance.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredStrategies.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p>No strategies match your filters.</p>
            <p className="text-xs mt-2">Try adjusting the win rate or market condition filter.</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase">Avg Win Rate</div>
            <div className="text-lg font-bold text-green-400 mt-1">
              {(strategies.reduce((a, b) => a + b.winRate, 0) / Math.max(1, strategies.length)).toFixed(1)}%
            </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase">Avg Confidence</div>
          <div className="text-lg font-bold text-blue-400 mt-1">
            {(strategies.reduce((a, b) => a + b.confidence, 0) / Math.max(1, strategies.length)).toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase">Best Performer</div>
          <div className="text-lg font-bold text-purple-400 mt-1">
            {Math.max(...strategies.map(s => s.performance?.sharpeRatio || 0)).toFixed(2)} SR
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase">Strategies</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">{strategies.length}</div>
        </div>
      </div>
    </div>
  );
};

export default StrategyPanel;
