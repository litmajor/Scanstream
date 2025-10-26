import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Search, TrendingUp, TrendingDown, Star, Download, BarChart3, Bell, BellOff, Zap, Activity, Target, Filter, ChevronDown, ChevronUp, Grid3x3, List, Sparkles } from 'lucide-react';

// Mock data for demonstration
const mockSignals = [
  {
    id: '1',
    symbol: 'BTC/USDT',
    exchange: 'binance',
    timeframe: '1h',
    signal: 'BUY',
    strength: 92,
    price: 45230.50,
    change: 3.24,
    volume: 1250000000,
    indicators: { rsi: 32, macd: 'bullish', ema: 'above', volume: 'very_high' },
    advanced: { opportunity_score: 87, bb_position: 0.25 },
    market_regime: { regime: 'bull', confidence: 78, volatility: 'high' },
    risk_reward: {
      entry_price: 45230.50,
      stop_loss: 44100,
      take_profit: 48500,
      stop_loss_pct: 2.5,
      take_profit_pct: 7.2,
      risk_reward_ratio: 2.88
    }
  },
  {
    id: '2',
    symbol: 'ETH/USDT',
    exchange: 'kucoinfutures',
    timeframe: '4h',
    signal: 'SELL',
    strength: 76,
    price: 3185.20,
    change: -1.82,
    volume: 890000000,
    indicators: { rsi: 71, macd: 'bearish', ema: 'below', volume: 'high' },
    advanced: { opportunity_score: 68, bb_position: 0.82 },
    market_regime: { regime: 'bear', confidence: 65, volatility: 'medium' },
    risk_reward: {
      entry_price: 3185.20,
      stop_loss: 3280,
      take_profit: 2990,
      stop_loss_pct: 2.98,
      take_profit_pct: 6.13,
      risk_reward_ratio: 2.06
    }
  },
  {
    id: '3',
    symbol: 'SOL/USDT',
    exchange: 'binance',
    timeframe: '1d',
    signal: 'BUY',
    strength: 95,
    price: 98.45,
    change: 6.78,
    volume: 2100000000,
    indicators: { rsi: 28, macd: 'bullish', ema: 'above', volume: 'very_high' },
    advanced: { opportunity_score: 94, bb_position: 0.15 },
    market_regime: { regime: 'bull', confidence: 89, volatility: 'high' },
    risk_reward: {
      entry_price: 98.45,
      stop_loss: 94.20,
      take_profit: 110.50,
      stop_loss_pct: 4.32,
      take_profit_pct: 12.24,
      risk_reward_ratio: 2.83
    }
  },
  {
    id: '4',
    symbol: 'AVAX/USDT',
    exchange: 'binance',
    timeframe: '1h',
    signal: 'BUY',
    strength: 84,
    price: 42.15,
    change: 2.91,
    volume: 450000000,
    indicators: { rsi: 38, macd: 'bullish', ema: 'above', volume: 'high' },
    advanced: { opportunity_score: 79, bb_position: 0.32 },
    market_regime: { regime: 'bull', confidence: 72, volatility: 'medium' },
    risk_reward: {
      entry_price: 42.15,
      stop_loss: 40.50,
      take_profit: 45.80,
      stop_loss_pct: 3.91,
      take_profit_pct: 8.66,
      risk_reward_ratio: 2.21
    }
  }
];

export default function TradingScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    exchange: 'all',
    timeframe: 'medium',
    signal: 'all',
    minStrength: 70
  });
  const [watchlist, setWatchlist] = useState(['BTC/USDT', 'SOL/USDT']);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [expandedSignal, setExpandedSignal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'compact'

  const toggleWatchlist = (symbol) => {
    setWatchlist(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const displaySignals = mockSignals.filter(signal => 
    signal.strength >= selectedFilters.minStrength &&
    (!showWatchlistOnly || watchlist.includes(signal.symbol))
  );

  const getOpportunityGrade = (score) => {
    if (score >= 90) return { grade: 'S', color: 'from-purple-500 to-pink-500', text: 'text-purple-400' };
    if (score >= 80) return { grade: 'A+', color: 'from-green-500 to-emerald-500', text: 'text-green-400' };
    if (score >= 70) return { grade: 'A', color: 'from-green-500 to-teal-500', text: 'text-green-400' };
    if (score >= 60) return { grade: 'B', color: 'from-yellow-500 to-orange-500', text: 'text-yellow-400' };
    return { grade: 'C', color: 'from-orange-500 to-red-500', text: 'text-orange-400' };
  };

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
              <button className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]">
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
              >
                <Star className={`w-4 h-4 ${showWatchlistOnly ? 'fill-current' : ''}`} />
                <span>{watchlist.length}</span>
              </button>

              <button
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`p-2.5 rounded-lg transition-all ${
                  alertsEnabled 
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 text-green-400' 
                    : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                {alertsEnabled ? <Bell className="w-4 h-4 fill-current" /> : <BellOff className="w-4 h-4" />}
              </button>

              <button className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white">
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsScanning(!isScanning)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all flex items-center space-x-2 text-white font-semibold shadow-lg shadow-blue-500/20"
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
                  <select className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors">
                    <option>All Exchanges</option>
                    <option>Binance</option>
                    <option>KuCoin Futures</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Timeframe</label>
                  <select className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors">
                    <option>All Timeframes</option>
                    <option>1m - Scalping</option>
                    <option>1h - Medium</option>
                    <option>1d - Daily</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Signal</label>
                  <select className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors">
                    <option>All Signals</option>
                    <option>Buy Only</option>
                    <option>Sell Only</option>
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
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-[1800px] mx-auto px-6 py-6">
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
                  {Math.round(displaySignals.reduce((acc, s) => acc + s.strength, 0) / displaySignals.length)}%
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
                  {displaySignals.filter(s => s.advanced.opportunity_score >= 80).length}
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
          {displaySignals.map((signal) => {
            const opportunityGrade = getOpportunityGrade(signal.advanced.opportunity_score);
            const isExpanded = expandedSignal === signal.id;
            
            // Compact View
            if (viewMode === 'compact') {
              return (
                <div
                  key={signal.id}
                  className="group bg-gradient-to-r from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 rounded-lg p-4 transition-all hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Symbol Info */}
                    <div className="flex items-center space-x-4 flex-1">
                      <button
                        onClick={() => toggleWatchlist(signal.symbol)}
                        className={`transition-all ${
                          watchlist.includes(signal.symbol)
                            ? 'text-yellow-400'
                            : 'text-slate-600 hover:text-yellow-400'
                        }`}
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
                          ${signal.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-1">Change</p>
                        <span className={`flex items-center text-sm font-bold ${
                          signal.change >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                          {signal.change >= 0 ? '+' : ''}{signal.change.toFixed(2)}%
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-1">Strength</p>
                        <p className={`text-lg font-bold ${opportunityGrade.text}`}>{signal.strength}%</p>
                      </div>
                    </div>

                    {/* Right: Indicators & Actions */}
                    <div className="flex items-center space-x-6">
                      <div className="flex space-x-3">
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">RSI</p>
                          <p className={`text-sm font-bold ${
                            signal.indicators.rsi < 30 ? 'text-green-400' :
                            signal.indicators.rsi > 70 ? 'text-red-400' : 'text-slate-300'
                          }`}>
                            {signal.indicators.rsi}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">R:R</p>
                          <p className={`text-sm font-bold ${
                            signal.risk_reward.risk_reward_ratio >= 2.5 ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {signal.risk_reward.risk_reward_ratio.toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-blue-500/20">
                          Chart
                        </button>
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-green-500/20">
                          Trade
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700/30 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Market Regime</p>
                        <span className={`text-sm font-bold ${
                          signal.market_regime.regime === 'bull' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.market_regime.regime.toUpperCase()} ({signal.market_regime.confidence}%)
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Entry</p>
                        <p className="text-sm font-bold text-blue-400">${signal.risk_reward.entry_price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Stop Loss</p>
                        <p className="text-sm font-bold text-red-400">${signal.risk_reward.stop_loss.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Take Profit</p>
                        <p className="text-sm font-bold text-green-400">${signal.risk_reward.take_profit.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            
            // Grid View (original design)
            return (
              <div
                key={signal.id}
                className="group bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/5"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-slate-700/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleWatchlist(signal.symbol)}
                        className={`transition-all ${
                          watchlist.includes(signal.symbol)
                            ? 'text-yellow-400 scale-110'
                            : 'text-slate-600 hover:text-yellow-400 hover:scale-110'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${watchlist.includes(signal.symbol) ? 'fill-current' : ''}`} />
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-white">{signal.symbol}</h3>
                        <p className="text-xs text-slate-500">{signal.exchange} • {signal.timeframe}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
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
                          signal.change >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                          {signal.change >= 0 ? '+' : ''}{signal.change.toFixed(2)}%
                        </span>
                        <span className="text-xs text-slate-500">
                          Vol: {(signal.volume / 1000000).toFixed(0)}M
                        </span>
                      </div>
                    </div>

                    {/* Opportunity Grade Badge */}
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${opportunityGrade.color} flex items-center justify-center shadow-lg`}>
                        <span className="text-2xl font-black text-white">{opportunityGrade.grade}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{signal.advanced.opportunity_score}/100</p>
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

                  {/* Indicators Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">RSI</p>
                      <p className={`text-sm font-bold ${
                        signal.indicators.rsi < 30 ? 'text-green-400' :
                        signal.indicators.rsi > 70 ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {signal.indicators.rsi}
                      </p>
                    </div>
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">MACD</p>
                      <p className={`text-sm font-bold capitalize ${
                        signal.indicators.macd === 'bullish' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {signal.indicators.macd}
                      </p>
                    </div>
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">BB Position</p>
                      <p className={`text-sm font-bold ${
                        signal.advanced.bb_position < 0.3 ? 'text-green-400' :
                        signal.advanced.bb_position > 0.7 ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {(signal.advanced.bb_position * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Volume</p>
                      <p className="text-sm font-bold text-slate-300 capitalize">
                        {signal.indicators.volume.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Risk/Reward Section */}
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

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    <button className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20">
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
          })}
        </div>

        {/* Empty State */}
        {displaySignals.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
              <Search className="w-16 h-16 text-slate-600 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Signals Found</h3>
            <p className="text-slate-500">Try adjusting your filters or run a new scan</p>
          </div>
        )}
      </div>
    </div>
  );
}