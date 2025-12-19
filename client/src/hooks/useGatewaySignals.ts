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
      // Fetch all symbols in PARALLEL instead of sequential loop
      // This dramatically reduces total load time
      const promises = SYMBOLS.map(async (symbol) => {
        try {
          const encodedSymbol = symbol.replace('/', '%2F');
          const response = await fetch(
            `/api/gateway/dataframe/${encodedSymbol}?timeframe=1h&limit=100`,
            { signal: AbortSignal.timeout(5000) } // 5 second timeout per request
          );
          
          if (response.ok) {
            const json = await response.json();
            if (json.dataframe) {
              const df = json.dataframe;
              return {
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
              };
            }
          }
          return null;
        } catch (err) {
          // Avoid noisy errors when backend is not available; return null for this symbol.
          // Keep a debug log for developers, but don't spam the console in normal usage.
          if (typeof console !== 'undefined' && (process.env.NODE_ENV === 'development')) {
            console.debug(`Failed to fetch ${symbol}:`, err);
          }
          return null;
        }
      });

      // Wait for all requests to complete
      const results = await Promise.all(promises);
      
      // Filter out null results (failed requests)
      return results.filter((signal): signal is GatewaySignal => signal !== null);
    },
    refetchInterval: 60000, // Increased from 30s to 60s to allow full load before next refresh
    staleTime: 55000,       // Increased from 25s to 55s
    gcTime: 5 * 60 * 1000,  // Keep cached data for 5 minutes
  });
}
