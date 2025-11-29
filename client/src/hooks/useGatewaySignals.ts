import { useQuery } from '@tanstack/react-query';

export interface GatewaySignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  signalConfidence: number;
  rsi: number;
  macd: number;
  atr: number;
  close: number;
  trendDirection: string;
  volume: number;
  priceChangePercent: number;
  ema20: number;
  ema50: number;
  timestamp: string;
}

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'ADA/USDT',
  'DOT/USDT', 'LINK/USDT', 'XRP/USDT', 'DOGE/USDT', 'ATOM/USDT',
  'ARB/USDT', 'OP/USDT', 'AAVE/USDT', 'UNI/USDT', 'NEAR/USDT'
];

export function useGatewaySignals() {
  return useQuery({
    queryKey: ['gateway-signals'],
    queryFn: async () => {
      const signals: GatewaySignal[] = [];
      
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
              signals.push({
                symbol,
                signal: df.signal || 'HOLD',
                signalConfidence: df.signalConfidence || 0,
                rsi: df.rsi || 0,
                macd: df.macd || 0,
                atr: df.atr || 0,
                close: df.close || 0,
                trendDirection: df.trendDirection || 'UPTREND',
                volume: df.volume || 0,
                priceChangePercent: df.priceChangePercent || 0,
                ema20: df.ema20 || 0,
                ema50: df.ema50 || 0,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error(`Failed to fetch ${symbol}:`, err);
        }
      }
      
      return signals;
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}
