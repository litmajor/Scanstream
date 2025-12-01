/* stylelint-disable-next-line */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, X, ChevronDown } from 'lucide-react';

interface FullDataframe {
  [key: string]: any;
}

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
  fullData?: FullDataframe;
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
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    momentum: true,
    volatility: true,
    volume: true,
    trend: true,
    patterns: true,
    risk: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const results: Record<string, Dataframe> = {};
        let successCount = 0;

        for (const symbol of SYMBOLS) {
          try {
            const encodedSymbol = symbol.replace('/', '%2F');
            const response = await fetch(
              `/api/gateway/dataframe/${encodedSymbol}?timeframe=1h&limit=100`
            );
            
            if (response.ok) {
              const json = await response.json();
              if (json.dataframe) {
                const df = json.dataframe;
                const hasPrice = df.close && df.close > 0;
                
                results[symbol] = {
                  symbol: df.symbol || symbol,
                  signal: df.signal || 'HOLD',
                  signalConfidence: df.trendStrength || 0,
                  close: df.close || 0,
                  rsi: df.rsi || 50,
                  ema20: df.ema20 || 0,
                  ema50: df.ema50 || 0,
                  macd: df.macd || 0,
                  atr: df.atr || 0,
                  trendDirection: df.trendDirection || 'UPTREND',
                  volume: df.volume || 0,
                  volumeTrend: df.volumeTrend || 'DECREASING',
                  priceChangePercent: df.momentum || 0,
                  fullData: df
                };
                
                if (hasPrice) successCount++;
              }
            }
          } catch (err) {
            console.error(`Failed to fetch ${symbol}:`, err);
          }
        }

        setData(results);
        if (Object.keys(results).length === 0) {
          setError('No data available from gateway - ensure exchange connection is active');
        } else if (successCount === 0) {
          setError('Gateway connected but prices unavailable - checking exchange feeds...');
        } else {
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getProgressBarWidth = (confidence: number) => {
    return `${Math.min(100, confidence || 0)}%`;
  };

  const formatValue = (value: any, decimals = 2) => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'number') return value.toFixed(decimals);
    return String(value);
  };

  const TechDataSection = ({ title, icon, data: sectionData }: { title: string; icon: string; data: Array<[string, any]> }) => {
    const sectionKey = title.toLowerCase().replace(/\s+/g, '_');
    const isExpanded = expandedSections[sectionKey] ?? true;
    
    return (
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold">
            <span>{icon}</span>
            <span>{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        {isExpanded && (
          <div className="p-4 space-y-2 bg-slate-50 dark:bg-slate-900">
            {sectionData.map(([label, value], idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-semibold">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading gateway scanner data...</p>
        </div>
      </div>
    );
  }

  const selectedData = selectedSymbol ? data[selectedSymbol]?.fullData : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gateway Scanner Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time market analysis with 70+ technical indicators - Click any symbol for detailed analysis
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

      {selectedSymbol && selectedData ? (
        <Card className="p-6 border-primary bg-slate-50 dark:bg-slate-900">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{selectedSymbol}</h2>
              <p className="text-muted-foreground">${selectedData.close?.toFixed(2) || 'N/A'}</p>
            </div>
            <button
              onClick={() => setSelectedSymbol(null)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Close detail view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
            <TechDataSection
              title="📊 Momentum Indicators"
              icon="📊"
              data={[
                ['RSI (14)', selectedData.rsi14],
                ['RSI (7)', selectedData.rsi7],
                ['RSI (21)', selectedData.rsi21],
                ['MACD', selectedData.macd],
                ['MACD Signal', selectedData.macdSignal],
                ['MACD Histogram', selectedData.macdHistogram],
                ['ROC (12)', selectedData.roc],
                ['Momentum', selectedData.momentum],
              ]}
            />

            <TechDataSection
              title="📈 Volatility & Bands"
              icon="📈"
              data={[
                ['ATR', selectedData.atr],
                ['Volatility', selectedData.volatility],
                ['BB Upper', selectedData.bbUpper],
                ['BB Lower', selectedData.bbLower],
                ['BB Width %', selectedData.bbWidthPercent],
                ['Keltner', selectedData.keltner],
              ]}
            />

            <TechDataSection
              title="🔄 Trend Analysis"
              icon="🔄"
              data={[
                ['EMA 12', selectedData.ema12],
                ['EMA 20', selectedData.ema20],
                ['EMA 50', selectedData.ema50],
                ['SMA 200', selectedData.sma200],
                ['Trend Direction', selectedData.trendDirection],
                ['Trend Strength', `${selectedData.trendStrength?.toFixed(1)}%`],
              ]}
            />

            <TechDataSection
              title="📦 Volume Analysis"
              icon="📦"
              data={[
                ['Volume', selectedData.volume],
                ['Volume SMA', selectedData.volumeSMA],
                ['Volume Change', selectedData.volumeChange],
                ['On Balance Volume', selectedData.onBalanceVolume],
              ]}
            />

            <TechDataSection
              title="🎯 Stochastic"
              icon="🎯"
              data={[
                ['Stoch %K', selectedData.stochK],
                ['Stoch %D', selectedData.stochD],
                ['Stoch RSI', selectedData.stochRSI],
              ]}
            />

            <TechDataSection
              title="🎪 Support/Resistance"
              icon="🎪"
              data={[
                ['Support', selectedData.support],
                ['Resistance', selectedData.resistance],
                ['Price to Support', selectedData.priceToSupport],
              ]}
            />

            <TechDataSection
              title="⚠️ Risk Metrics"
              icon="⚠️"
              data={[
                ['Drawdown %', `${selectedData.drawdown?.toFixed(2)}%`],
                ['Price Range', selectedData.priceRange],
                ['Price Change %', `${selectedData.priceChangePercent?.toFixed(2)}%`],
              ]}
            />

            <TechDataSection
              title="✨ Signal"
              icon="✨"
              data={[
                ['Type', selectedData.signal],
                ['Strength', `${selectedData.signalStrength?.toFixed(1)}%`],
                ['Confidence', `${selectedData.signalConfidence?.toFixed(1)}%`],
              ]}
            />
          </div>

          <button
            onClick={() => setSelectedSymbol(null)}
            className="mt-6 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Back to Scanner
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYMBOLS.map((symbol) => {
            const df = data[symbol];
            if (!df && Object.keys(data).length > 0) return null;

            return (
              <Card
                key={symbol}
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:border-primary"
                onClick={() => setSelectedSymbol(symbol)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{symbol}</h3>
                      <p className="text-sm text-muted-foreground">${df?.close?.toFixed(2) || 'Loading...'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(df?.trendDirection || 'UPTREND')}
                      <Badge className={`${getSignalColor(df?.signal || 'HOLD')} border`}>
                        {df?.signal || 'HOLD'}
                      </Badge>
                    </div>
                  </div>

                  {df?.priceChangePercent !== undefined && (
                    <div className="text-sm">
                      <span className={df.priceChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {df.priceChangePercent >= 0 ? '+' : ''}{df.priceChangePercent?.toFixed(2)}%
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div><p className="text-xs text-muted-foreground">RSI</p><p className="text-sm font-mono">{df?.rsi?.toFixed(1) || 'N/A'}</p></div>
                    <div><p className="text-xs text-muted-foreground">MACD</p><p className="text-sm font-mono">{df?.macd?.toFixed(3) || 'N/A'}</p></div>
                    <div><p className="text-xs text-muted-foreground">ATR</p><p className="text-sm font-mono">{df?.atr?.toFixed(2) || 'N/A'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Volume</p><p className="text-sm font-mono">{df?.volume ? (df.volume / 1000).toFixed(0) : '0'}k</p></div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground font-semibold mb-1">Confidence</p>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono">{df?.signalConfidence?.toFixed(0) || '0'}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: getProgressBarWidth(df?.signalConfidence) } as React.CSSProperties} 
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {Object.keys(data).length === 0 && !error && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No data loaded from gateway</p>
        </Card>
      )}

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
