import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap, Target, Eye, Clock, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface Signal {
  symbol: string;
  exchange?: string;
  signal: string;
  strength: number;
  price: number;
  change?: number;
  change24h?: number;
  volume?: number;
  timestamp: number;
  indicators?: {
    rsi?: number;
    macd?: number;
  };
  advanced?: {
    opportunity_score?: number;
  };
}

interface EnhancedSignalsListProps {
  signals: Signal[];
  isLoading?: boolean;
}

interface CategorizedSignals {
  earlyRisers: Signal[];
  crossExchange: Signal[];
  consistent: Signal[];
  highMomentum: Signal[];
  weakening: Signal[];
}

export default function EnhancedSignalsList({ signals, isLoading }: EnhancedSignalsListProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'earlyRisers' | 'crossExchange' | 'consistent' | 'highMomentum'>('all');

  // Categorize signals based on characteristics
  const categorizedSignals: CategorizedSignals = useMemo(() => {
    const categories: CategorizedSignals = {
      earlyRisers: [],
      crossExchange: [],
      consistent: [],
      highMomentum: [],
      weakening: []
    };

    // Group by symbol to find cross-exchange opportunities
    const symbolGroups = new Map<string, Signal[]>();
    signals.forEach(signal => {
      const existing = symbolGroups.get(signal.symbol) || [];
      symbolGroups.set(signal.symbol, [...existing, signal]);
    });

    signals.forEach(signal => {
      const change = signal.change24h || signal.change || 0;
      const strength = signal.strength || 0;
      const rsi = signal.indicators?.rsi || 50;
      
      // Early Risers: Recent strength increase, not overbought
      if (change > 2 && change < 10 && rsi < 70 && strength > 60) {
        categories.earlyRisers.push(signal);
      }

      // Cross-Exchange: Same symbol on multiple exchanges
      const symbolSignals = symbolGroups.get(signal.symbol) || [];
      if (symbolSignals.length > 1 && strength > 50) {
        categories.crossExchange.push(signal);
      }

      // Consistent: High strength, stable indicators
      if (strength > 70 && rsi > 40 && rsi < 80) {
        categories.consistent.push(signal);
      }

      // High Momentum: Strong recent movement
      if (Math.abs(change) > 5 && strength > 65) {
        categories.highMomentum.push(signal);
      }

      // Weakening: Declining strength
      if (strength < 50 && change < 0) {
        categories.weakening.push(signal);
      }
    });

    return categories;
  }, [signals]);

  const displaySignals = useMemo(() => {
    if (selectedCategory === 'all') return signals;
    if (selectedCategory === 'earlyRisers') return categorizedSignals.earlyRisers;
    if (selectedCategory === 'crossExchange') return categorizedSignals.crossExchange;
    if (selectedCategory === 'consistent') return categorizedSignals.consistent;
    if (selectedCategory === 'highMomentum') return categorizedSignals.highMomentum;
    return signals;
  }, [selectedCategory, signals, categorizedSignals]);

  const categoryStats = [
    { 
      id: 'all', 
      name: 'All Signals', 
      count: signals.length, 
      icon: Activity,
      color: 'blue'
    },
    { 
      id: 'earlyRisers', 
      name: 'Early Risers', 
      count: categorizedSignals.earlyRisers.length, 
      icon: Zap,
      color: 'green',
      description: 'New opportunities with momentum'
    },
    { 
      id: 'crossExchange', 
      name: 'Cross-Exchange', 
      count: categorizedSignals.crossExchange.length, 
      icon: Target,
      color: 'purple',
      description: 'Available on multiple exchanges'
    },
    { 
      id: 'consistent', 
      name: 'Consistent', 
      count: categorizedSignals.consistent.length, 
      icon: TrendingUp,
      color: 'cyan',
      description: 'Stable high-quality signals'
    },
    { 
      id: 'highMomentum', 
      name: 'High Momentum', 
      count: categorizedSignals.highMomentum.length, 
      icon: ArrowUpRight,
      color: 'orange',
      description: 'Strong recent price action'
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Analyzing market signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-3">
        {categoryStats.map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? `bg-${category.color}-600 text-white shadow-lg`
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={category.description}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{category.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                isActive ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                {category.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Signals List */}
      <div className="space-y-3">
        {displaySignals.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Eye className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No signals in this category</p>
          </div>
        ) : (
          displaySignals.map((signal, index) => {
            const change = signal.change24h || signal.change || 0;
            const isPositive = change >= 0;
            const strength = signal.strength || 0;
            const opportunityScore = signal.advanced?.opportunity_score || 0;
            
            // Determine badge
            let badge = null;
            if (categorizedSignals.earlyRisers.includes(signal)) {
              badge = { text: 'Early', color: 'green' };
            } else if (categorizedSignals.crossExchange.includes(signal)) {
              badge = { text: 'Multi-Exchange', color: 'purple' };
            } else if (categorizedSignals.consistent.includes(signal)) {
              badge = { text: 'Consistent', color: 'cyan' };
            } else if (categorizedSignals.highMomentum.includes(signal)) {
              badge = { text: 'High Momentum', color: 'orange' };
            }

            return (
              <div
                key={`${signal.symbol}-${signal.exchange}-${index}`}
                className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 hover:bg-slate-800/60 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  {/* Left: Symbol and Exchange */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{signal.symbol}</h3>
                      {signal.exchange && (
                        <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 uppercase">
                          {signal.exchange}
                        </span>
                      )}
                      {badge && (
                        <span className={`text-xs px-2 py-1 rounded bg-${badge.color}-500/20 text-${badge.color}-400 font-medium`}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div>
                        <span className="text-slate-500">Price: </span>
                        <span className="text-white font-mono">${signal.price.toFixed(2)}</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        <span className="font-semibold">{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics */}
                  <div className="flex flex-col items-end space-y-2">
                    {/* Strength Bar */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-500">Strength:</span>
                      <div className="relative w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 transition-all ${
                            strength > 75 ? 'bg-green-500' :
                            strength > 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{strength}%</span>
                    </div>

                    {/* Opportunity Score */}
                    {opportunityScore > 0 && (
                      <div className="flex items-center space-x-2">
                        <Target className="h-3 w-3 text-purple-400" />
                        <span className="text-xs text-slate-400">Score: </span>
                        <span className="text-xs font-bold text-purple-400">{opportunityScore}/100</span>
                      </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center space-x-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Indicators */}
                {signal.indicators && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center space-x-6 text-xs">
                    {signal.indicators.rsi && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">RSI:</span>
                        <span className={`font-mono ${
                          signal.indicators.rsi > 70 ? 'text-red-400' :
                          signal.indicators.rsi < 30 ? 'text-green-400' :
                          'text-slate-300'
                        }`}>
                          {signal.indicators.rsi.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {signal.indicators.macd && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">MACD:</span>
                        <span className={`font-mono ${
                          signal.indicators.macd > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.indicators.macd.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {signal.volume && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">Volume:</span>
                        <span className="text-slate-300 font-mono">
                          ${(signal.volume / 1000000).toFixed(2)}M
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

