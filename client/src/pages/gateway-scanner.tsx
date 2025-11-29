import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface Dataframe {
  symbol: string;
  signal: string;
  signalConfidence: number;
  close: number;
  rsi: number;
  ema20: number;
  ema50: number;
  macd: number;
  atr: number;
  trendDirection: string;
  volume: number;
  volumeTrend: string;
  priceChangePercent: number;
}

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'ADA/USDT',
  'DOT/USDT', 'LINK/USDT', 'XRP/USDT', 'DOGE/USDT', 'ATOM/USDT',
  'ARB/USDT', 'OP/USDT', 'AAVE/USDT', 'UNI/USDT', 'NEAR/USDT'
];

export default function GatewayScannerPage() {
  const [data, setData] = useState<Record<string, Dataframe>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const results: Record<string, Dataframe> = {};

        for (const symbol of SYMBOLS) {
          try {
            const encodedSymbol = symbol.replace('/', '%2F');
            const response = await fetch(
              `/api/gateway/dataframe/${encodedSymbol}?timeframe=1h&limit=100`
            );
            
            if (response.ok) {
              const json = await response.json();
              if (json.dataframe) {
                results[symbol] = json.dataframe;
              }
            }
          } catch (err) {
            console.error(`Failed to fetch ${symbol}:`, err);
          }
        }

        setData(results);
        if (Object.keys(results).length === 0) {
          setError('No data available from gateway');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getSignalColor = (signal: string) => {
    if (signal === 'BUY') return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
    if (signal === 'SELL') return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
    return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800';
  };

  const getTrendIcon = (direction: string) => {
    return direction === 'UPTREND' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading gateway scanner data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gateway Scanner Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time market analysis with 67-column technical indicators
        </p>
      </div>

      {error && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-300">Notice</p>
              <p className="text-yellow-800 dark:text-yellow-400 text-sm">{error}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SYMBOLS.map((symbol) => {
          const df = data[symbol];
          if (!df) return null;

          return (
            <Card key={symbol} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{symbol}</h3>
                    <p className="text-sm text-muted-foreground">
                      ${df.close?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(df.trendDirection || 'UPTREND')}
                    <Badge
                      className={`${getSignalColor(df.signal || 'HOLD')} border`}
                    >
                      {df.signal || 'HOLD'}
                    </Badge>
                  </div>
                </div>

                {/* Price Change */}
                {df.priceChangePercent !== undefined && (
                  <div className="text-sm">
                    <span className={df.priceChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {df.priceChangePercent >= 0 ? '+' : ''}{df.priceChangePercent?.toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Indicators Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">RSI</p>
                    <p className="text-sm font-mono">{df.rsi?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">MACD</p>
                    <p className="text-sm font-mono">{df.macd?.toFixed(3) || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">ATR</p>
                    <p className="text-sm font-mono">{df.atr?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">Volume</p>
                    <p className="text-sm font-mono">{(df.volume / 1000)?.toFixed(0)}k</p>
                  </div>
                </div>

                {/* Moving Averages */}
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Moving Averages</p>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                      EMA20: ${df.ema20?.toFixed(0) || 'N/A'}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                      EMA50: ${df.ema50?.toFixed(0) || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Signal Confidence */}
                <div className="border-t pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-semibold">Confidence</p>
                    <p className="text-sm font-mono">{df.signalConfidence?.toFixed(0)}%</p>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${df.signalConfidence || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {Object.keys(data).length === 0 && !error && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No data loaded from gateway</p>
        </Card>
      )}

      {/* Stats Footer */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-900">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{Object.keys(data).length}</p>
            <p className="text-sm text-muted-foreground">Symbols Loaded</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {Object.values(data).filter(d => d.signal === 'BUY').length}
            </p>
            <p className="text-sm text-muted-foreground">Buy Signals</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {Object.values(data).filter(d => d.signal === 'SELL').length}
            </p>
            <p className="text-sm text-muted-foreground">Sell Signals</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
