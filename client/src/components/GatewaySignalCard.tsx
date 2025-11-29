import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { GatewaySignal } from '@/hooks/useGatewaySignals';

export function GatewaySignalCard({ signal }: { signal: GatewaySignal }) {
  const getSignalColor = (sig: string) => {
    if (sig === 'BUY') return 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30';
    if (sig === 'SELL') return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
    return 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30';
  };

  const getTrendIcon = (direction: string) => {
    return direction === 'UPTREND' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const confidenceColor = signal.signalConfidence >= 75 ? 'text-green-600 dark:text-green-400' : 
                          signal.signalConfidence >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400';

  return (
    <Card className="p-3 hover:shadow-md transition-all border-l-2 border-l-blue-500">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-bold text-sm text-white">{signal.symbol}</h3>
            <p className="text-xs text-slate-400">${signal.close.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon(signal.trendDirection)}
            <Badge className={`text-xs border ${getSignalColor(signal.signal)}`}>
              {signal.signal}
            </Badge>
          </div>
        </div>

        {/* Price Change */}
        <div className="text-xs font-mono">
          <span className={signal.priceChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}>
            {signal.priceChangePercent >= 0 ? '+' : ''}{signal.priceChangePercent.toFixed(2)}%
          </span>
        </div>

        {/* Key Indicators */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="bg-slate-800 p-1.5 rounded">
            <p className="text-slate-500 font-semibold text-xs">RSI</p>
            <p className="text-white font-mono">{signal.rsi.toFixed(1)}</p>
          </div>
          <div className="bg-slate-800 p-1.5 rounded">
            <p className="text-slate-500 font-semibold text-xs">MACD</p>
            <p className="text-white font-mono">{signal.macd.toFixed(4)}</p>
          </div>
        </div>

        {/* Confidence Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">Confidence</span>
            <span className={`text-xs font-bold ${confidenceColor}`}>
              {signal.signalConfidence.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${
                signal.signalConfidence >= 75 ? 'bg-green-500' :
                signal.signalConfidence >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${signal.signalConfidence}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
