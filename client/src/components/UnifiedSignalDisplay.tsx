
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Zap, Target, Brain, Bot, AlertCircle, ExternalLink, Star, Activity, ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SentimentBadge } from './coingecko/SentimentIndicator';
import { MarketRegimeBadge } from './coingecko/MarketRegimeBadge';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  stopLoss?: number;
  takeProfit?: number;
  holdingPeriod?: {
    candles: number;
    days: number;
    hours: number;
    confidence: number;
    reason: string;
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

interface QuickTradeModalProps {
  signal: Signal;
  onClose: () => void;
  onExecute: (trade: any) => void;
}

function QuickTradeModal({ signal, onClose, onExecute }: QuickTradeModalProps) {
  const [quantity, setQuantity] = useState('0.01');
  const [leverage, setLeverage] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');

  const handleExecute = () => {
    onExecute({
      symbol: signal.symbol,
      side: signal.signal,
      quantity: parseFloat(quantity),
      leverage: parseFloat(leverage),
      orderType,
      price: signal.price,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit
    });
    onClose();
  };

  const estimatedValue = parseFloat(quantity) * signal.price;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Quick Trade: {signal.symbol}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {signal.signal} signal with {signal.strength}% strength
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Order Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={orderType === 'market' ? 'default' : 'outline'}
                onClick={() => setOrderType('market')}
                className="flex-1"
              >
                Market
              </Button>
              <Button
                variant={orderType === 'limit' ? 'default' : 'outline'}
                onClick={() => setOrderType('limit')}
                className="flex-1"
              >
                Limit
              </Button>
            </div>
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-2 bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <Label>Leverage</Label>
            <Input
              type="number"
              step="1"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="mt-2 bg-slate-800 border-slate-700"
            />
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry Price:</span>
              <span className="font-bold">${signal.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Value:</span>
              <span className="font-bold">${estimatedValue.toFixed(2)}</span>
            </div>
            {signal.stopLoss && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Stop Loss:</span>
                <span className="text-red-400">${signal.stopLoss.toFixed(2)}</span>
              </div>
            )}
            {signal.takeProfit && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Take Profit:</span>
                <span className="text-green-400">${signal.takeProfit.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleExecute}
            className={cn(
              'font-bold',
              signal.signal === 'BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            )}
          >
            {signal.signal === 'BUY' ? <ArrowUpRight className="w-4 h-4 mr-2" /> : <ArrowDownRight className="w-4 h-4 mr-2" />}
            Execute {signal.signal}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnifiedSignalDisplay() {
  const { addNotification } = useNotifications();
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  // Fetch signals from all sources
  const { data: scannerSignals } = useQuery<Signal[]>({
    queryKey: ['scanner-signals'],
    queryFn: async () => {
      const res = await fetch('/api/scanner/signals');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || []).map((s: any) => ({
        symbol: s.symbol,
        exchange: s.exchange || 'scanner',
        signal: s.signal as 'BUY' | 'SELL' | 'HOLD',
        strength: s.strength || 0,
        price: s.price || s.currentPrice || 0,
        change: s.change || s.priceChange || 0,
        change24h: s.change24h || s.change || 0,
        timestamp: s.timestamp || Date.now(),
        source: 'scanner' as const,
        indicators: s.indicators,
      }));
    },
    refetchInterval: 30000,
  });

  const { data: gatewaySignals } = useQuery<Signal[]>({
    queryKey: ['gateway-signals'],
    queryFn: async () => {
      const res = await fetch('/api/gateway/signals');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || []).map((s: any) => ({
        symbol: s.symbol,
        exchange: s.exchange || 'aggregated',
        signal: s.signal as 'BUY' | 'SELL' | 'HOLD',
        strength: s.strength || 0,
        price: s.price || 0,
        change: s.change || 0,
        change24h: s.change24h || s.change || 0,
        timestamp: s.timestamp || Date.now(),
        source: 'gateway' as const,
        indicators: {
          rsi: s.indicators?.rsi,
          macd: s.indicators?.macd,
          volumeRatio: s.indicators?.volumeRatio,
        },
      }));
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
      return (data.signals || []).map((s: any) => ({
        symbol: s.symbol,
        exchange: s.exchange || 'strategy',
        signal: s.signal || s.type || 'HOLD',
        strength: s.strength || s.confidence * 100 || 0,
        price: s.price || s.currentPrice || 0,
        change: s.change || s.priceChange || 0,
        change24h: s.change24h || s.change || 0,
        timestamp: s.timestamp || Date.now(),
        source: 'strategy' as const,
        strategyName: s.strategyName || s.name,
        indicators: s.indicators,
      }));
    },
    refetchInterval: 30000,
  });

  // Query signal performance stats
  const { data: performanceStats } = useQuery({
    queryKey: ['signal-performance-stats'],
    queryFn: async () => {
      const res = await fetch('/api/gateway/signals/performance/stats');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 10000,
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/signals`);

    ws.onopen = () => {
      console.log('[WebSocket] Connected to signal stream');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'signal_new') {
          const newSignal = message.data;
          setLiveSignals(prev => [newSignal, ...prev.slice(0, 49)]);

          // Show notification for high-strength signals
          if (newSignal.strength >= 80) {
            addNotification(
              'signal',
              newSignal.strength >= 90 ? 'high' : 'medium',
              `New ${newSignal.signal} Signal`,
              `${newSignal.symbol} - Strength: ${newSignal.strength}%`,
              {
                actionLabel: 'View',
                metadata: {
                  symbol: newSignal.symbol,
                  price: `$${newSignal.price.toFixed(2)}`
                }
              }
            );
          }
        } else if (message.type === 'signal_alert') {
          addNotification(
            'alert',
            'urgent',
            message.data.title,
            message.data.message,
            {
              actionLabel: 'Trade Now',
              metadata: message.data.signal
            }
          );
        }
      } catch (error) {
        console.error('[WebSocket] Parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [addNotification]);

  // Combine all signals
  const allSignals = [
    ...liveSignals,
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

  const handleTrade = (trade: any) => {
    addNotification(
      'trade',
      'medium',
      'Trade Executed',
      `${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.price.toFixed(2)}`,
      {
        metadata: trade
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Unified Signals</h2>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
            wsConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          )}>
            {wsConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{wsConnected ? 'Live' : 'Offline'}</span>
          </div>
          {performanceStats && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Activity className="w-4 h-4" />
              <span>Win Rate: {performanceStats.winRate.toFixed(1)}%</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{unifiedSignals.length} symbols tracked</span>
            <span>•</span>
            <span>{allSignals.length} total signals</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="consensus" className="w-full">
        <TabsList className="bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger value="consensus">Consensus View</TabsTrigger>
          <TabsTrigger value="live">Live Stream ({liveSignals.length})</TabsTrigger>
          <TabsTrigger value="high-conviction">High Conviction</TabsTrigger>
        </TabsList>

        <TabsContent value="consensus" className="space-y-3">
          {unifiedSignals.map((unified) => (
            <SignalCard 
              key={unified.symbol} 
              unified={unified}
              onTrade={(signal) => setSelectedSignal(signal)}
            />
          ))}
        </TabsContent>

        <TabsContent value="live" className="space-y-3">
          {liveSignals.map((signal, idx) => (
            <Card key={`live-${idx}`} className="bg-slate-800/40 border-green-500/30 shadow-lg shadow-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-green-400 animate-pulse" />
                    <div>
                      <div className="font-bold text-white">{signal.symbol}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={signal.signal === 'BUY' ? 'default' : 'destructive'}>
                      {signal.signal}
                    </Badge>
                    <div className="text-sm text-slate-300">
                      {signal.strength.toFixed(0)}%
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSelectedSignal(signal)}
                      className="bg-blue-600 hover:bg-blue-500"
                    >
                      Trade
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="high-conviction" className="space-y-3">
          {unifiedSignals.filter(u => u.agreement >= 0.75 && u.sourceCount >= 2).map((unified) => (
            <SignalCard 
              key={unified.symbol} 
              unified={unified} 
              highlighted
              onTrade={(signal) => setSelectedSignal(signal)}
            />
          ))}
        </TabsContent>
      </Tabs>

      {selectedSignal && (
        <QuickTradeModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          onExecute={handleTrade}
        />
      )}
    </div>
  );
}

function SignalCard({ unified, highlighted = false, onTrade }: { unified: any; highlighted?: boolean; onTrade: (signal: Signal) => void }) {
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

  // Get ML holding period if available
  const mlSignal = unified.signals.find((s: Signal) => s.source === 'ml' && s.holdingPeriod);
  const holdingPeriod = mlSignal?.holdingPeriod;

  return (
    <Card className={cn(
      'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 transition-all',
      highlighted && 'border-yellow-500/50 shadow-lg shadow-yellow-500/10'
    )}>
      <CardContent className="p-5">
        <div className="space-y-4">
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
              {holdingPeriod && (
                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/30">
                  <Clock className="w-3 h-3" />
                  <span>Hold: {holdingPeriod.days > 0 ? `${holdingPeriod.days}d` : `${holdingPeriod.hours}h`}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{holdingPeriod.reason}</span>
                </div>
              )}
            </div>

            <div className="text-right space-y-2">
              <Badge 
                variant={unified.consensus === 'BUY' ? 'default' : unified.consensus === 'SELL' ? 'destructive' : 'secondary'}
                className="text-sm px-3 py-1"
              >
                {unified.consensus}
              </Badge>
              <Button
                size="sm"
                onClick={() => onTrade(unified.signals[0])}
                className={cn(
                  'w-full font-bold',
                  unified.consensus === 'BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                )}
              >
                Trade Now
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {unified.signals.map((signal: Signal, idx: number) => (
              <div 
                key={idx} 
                className={cn('px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1', getSourceColor(signal.source))}
              >
                {getSourceIcon(signal.source)}
                <span>{signal.source}</span>
              </div>
            ))}
          </div>
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
