
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Zap, Target, Brain, Bot, AlertCircle, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SentimentBadge } from './coingecko/SentimentIndicator';
import { MarketRegimeBadge } from './coingecko/MarketRegimeBadge';

interface Signal {
  symbol: string;
  exchange?: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  price: number;
  change?: number;
  change24h?: number;
  timestamp: number;
  source: 'scanner' | 'gateway' | 'ml' | 'strategy';
  confidence?: number;
  indicators?: {
    rsi?: number;
    macd?: number;
    volumeRatio?: number;
  };
}

interface CompositeScore {
  compositeScore: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  breakdown: {
    technical: { score: number; contribution: number };
    sentiment: { score: number; contribution: number; isTrending: boolean };
    marketRegime: { score: number; contribution: number; regime: string };
  };
}

export function UnifiedSignalDisplay() {
  // Fetch signals from all sources
  const { data: scannerSignals } = useQuery<Signal[]>({
    queryKey: ['scanner-signals'],
    queryFn: async () => {
      const res = await fetch('/api/scanner/signals');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'scanner' as const }));
    },
    refetchInterval: 30000,
  });

  const { data: gatewaySignals } = useQuery<Signal[]>({
    queryKey: ['gateway-signals'],
    queryFn: async () => {
      const res = await fetch('/api/gateway/signals');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'gateway' as const }));
    },
    refetchInterval: 30000,
  });

  const { data: mlSignals } = useQuery<Signal[]>({
    queryKey: ['ml-signals'],
    queryFn: async () => {
      const res = await fetch('/api/ml-engine/predictions');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.predictions || []).map((p: any) => ({
        symbol: p.symbol,
        signal: p.direction,
        strength: p.confidence * 100,
        price: p.price,
        timestamp: p.timestamp,
        source: 'ml' as const,
        confidence: p.confidence,
      }));
    },
    refetchInterval: 45000,
  });

  const { data: strategySignals } = useQuery<Signal[]>({
    queryKey: ['strategy-signals'],
    queryFn: async () => {
      const res = await fetch('/api/strategies/signals');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'strategy' as const }));
    },
    refetchInterval: 30000,
  });

  // Combine and deduplicate signals by symbol
  const allSignals = [
    ...(scannerSignals || []),
    ...(gatewaySignals || []),
    ...(mlSignals || []),
    ...(strategySignals || []),
  ];

  // Group by symbol and calculate consensus
  const signalsBySymbol = allSignals.reduce((acc, signal) => {
    if (!acc[signal.symbol]) {
      acc[signal.symbol] = [];
    }
    acc[signal.symbol].push(signal);
    return acc;
  }, {} as Record<string, Signal[]>);

  // Create unified signals with consensus
  const unifiedSignals = Object.entries(signalsBySymbol).map(([symbol, signals]) => {
    const buyCount = signals.filter(s => s.signal === 'BUY').length;
    const sellCount = signals.filter(s => s.signal === 'SELL').length;
    const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    const latestPrice = signals[0]?.price || 0;
    const latestChange = signals[0]?.change24h || signals[0]?.change || 0;
    
    const consensus: 'BUY' | 'SELL' | 'HOLD' = 
      buyCount > sellCount ? 'BUY' : 
      sellCount > buyCount ? 'SELL' : 'HOLD';

    const agreement = Math.max(buyCount, sellCount) / signals.length;

    return {
      symbol,
      signals,
      consensus,
      agreement,
      strength: avgStrength,
      price: latestPrice,
      change24h: latestChange,
      sourceCount: signals.length,
    };
  }).sort((a, b) => b.strength - a.strength);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'scanner': return <Target className="w-3 h-3" />;
      case 'gateway': return <Zap className="w-3 h-3" />;
      case 'ml': return <Brain className="w-3 h-3" />;
      case 'strategy': return <Bot className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'scanner': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'gateway': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'ml': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'strategy': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Unified Signals</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{unifiedSignals.length} symbols tracked</span>
          <span>•</span>
          <span>{allSignals.length} total signals</span>
        </div>
      </div>

      <Tabs defaultValue="consensus" className="w-full">
        <TabsList className="bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger value="consensus">Consensus View</TabsTrigger>
          <TabsTrigger value="all">All Signals</TabsTrigger>
          <TabsTrigger value="high-conviction">High Conviction</TabsTrigger>
        </TabsList>

        <TabsContent value="consensus" className="space-y-3">
          {unifiedSignals.map((unified) => (
            <SignalCard key={unified.symbol} unified={unified} />
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {allSignals.sort((a, b) => b.timestamp - a.timestamp).map((signal, idx) => (
            <Card key={`${signal.symbol}-${signal.source}-${idx}`} className="bg-slate-800/40 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1', getSourceColor(signal.source))}>
                      {getSourceIcon(signal.source)}
                      {signal.source.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white">{signal.symbol}</div>
                      <div className="text-xs text-slate-400">${signal.price.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={signal.signal === 'BUY' ? 'default' : signal.signal === 'SELL' ? 'destructive' : 'secondary'}>
                      {signal.signal}
                    </Badge>
                    <div className="text-sm text-slate-300">
                      {signal.strength.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="high-conviction" className="space-y-3">
          {unifiedSignals.filter(u => u.agreement >= 0.75 && u.sourceCount >= 2).map((unified) => (
            <SignalCard key={unified.symbol} unified={unified} highlighted />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SignalCard({ unified, highlighted = false }: { unified: any; highlighted?: boolean }) {
  const { data: compositeData } = useQuery<CompositeScore>({
    queryKey: ['composite-score', unified.symbol],
    queryFn: async () => {
      const latestSignal = unified.signals[0];
      const response = await fetch('/api/analytics/composite-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: unified.symbol,
          rsi: latestSignal?.indicators?.rsi || 50,
          macd: latestSignal?.indicators?.macd || 0,
          volumeRatio: latestSignal?.indicators?.volumeRatio || 1,
          priceChange24h: unified.change24h || 0,
          momentum: 0,
          includeSentiment: true,
        }),
      });
      return response.json();
    },
    staleTime: 300000,
  });

  return (
    <Card className={cn(
      'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 transition-all',
      highlighted && 'border-yellow-500/50 shadow-lg shadow-yellow-500/10'
    )}>
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white">{unified.symbol}</h3>
                <SentimentBadge symbol={unified.symbol} />
                {unified.agreement >= 0.75 && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-2xl font-bold text-white">${unified.price.toFixed(2)}</span>
                <span className={cn(
                  'flex items-center gap-1',
                  unified.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {unified.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {unified.change24h.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="text-right">
              <Badge 
                variant={unified.consensus === 'BUY' ? 'default' : unified.consensus === 'SELL' ? 'destructive' : 'secondary'}
                className="text-sm px-3 py-1"
              >
                {unified.consensus}
              </Badge>
              <div className="text-xs text-slate-400 mt-1">
                {(unified.agreement * 100).toFixed(0)}% agreement
              </div>
            </div>
          </div>

          {/* Sources */}
          <div className="flex flex-wrap gap-2">
            {unified.signals.map((signal: Signal, idx: number) => (
              <div 
                key={idx} 
                className={cn('px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1', getSourceColor(signal.source))}
              >
                {getSourceIcon(signal.source)}
                <span>{signal.source}</span>
                <span className="opacity-60">•</span>
                <span>{signal.signal}</span>
              </div>
            ))}
          </div>

          {/* Composite Score */}
          {compositeData && (
            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Composite Score</span>
                <span className={cn(
                  'text-sm font-bold px-2 py-0.5 rounded',
                  compositeData.compositeScore >= 75 ? 'bg-green-500/20 text-green-400' :
                  compositeData.compositeScore >= 60 ? 'bg-green-500/10 text-green-400' :
                  compositeData.compositeScore >= 40 ? 'bg-slate-500/20 text-slate-300' :
                  compositeData.compositeScore >= 25 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {compositeData.compositeScore.toFixed(1)}/100
                </span>
              </div>

              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    compositeData.compositeScore >= 75 ? 'bg-green-500' :
                    compositeData.compositeScore >= 60 ? 'bg-green-400' :
                    compositeData.compositeScore >= 40 ? 'bg-slate-400' :
                    compositeData.compositeScore >= 25 ? 'bg-orange-400' : 'bg-red-500'
                  )}
                  style={{ width: `${compositeData.compositeScore}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <MarketRegimeBadge />
                <button 
                  onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=${unified.symbol}`, '_blank')}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <span>Chart</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'scanner': return <Target className="w-3 h-3" />;
    case 'gateway': return <Zap className="w-3 h-3" />;
    case 'ml': return <Brain className="w-3 h-3" />;
    case 'strategy': return <Bot className="w-3 h-3" />;
    default: return <AlertCircle className="w-3 h-3" />;
  }
}

function getSourceColor(source: string) {
  switch (source) {
    case 'scanner': return 'bg-green-500/10 text-green-400 border-green-500/30';
    case 'gateway': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'ml': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'strategy': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}
