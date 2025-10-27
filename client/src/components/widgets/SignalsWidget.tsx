import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import BaseWidget from './BaseWidget';

interface Signal {
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  change: number;
}

interface SignalsWidgetProps {
  id: string;
  signals: Signal[];
  onRemove?: (id: string) => void;
}

export default function SignalsWidget({
  id,
  signals,
  onRemove,
}: SignalsWidgetProps) {
  return (
    <BaseWidget
      id={id}
      title="Top Signals"
      icon={Zap}
      onRemove={onRemove}
      className="col-span-1"
    >
      <div className="space-y-2">
        {signals.length > 0 ? (
          signals.slice(0, 5).map((signal, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg border ${
                signal.type === 'BUY'
                  ? 'bg-green-900/20 border-green-700/30'
                  : 'bg-red-900/20 border-red-700/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white">{signal.symbol}</span>
                {signal.type === 'BUY' ? (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">${signal.price.toFixed(2)}</span>
                <span className={`font-semibold ${signal.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {signal.change >= 0 ? '+' : ''}{signal.change.toFixed(2)}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-slate-500 text-sm">
            No signals available
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
