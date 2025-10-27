import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import BaseWidget from './BaseWidget';

interface ChartWidgetProps {
  id: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  onRemove?: (id: string) => void;
}

export default function ChartWidget({
  id,
  symbol,
  price,
  change,
  changePercent,
  onRemove,
}: ChartWidgetProps) {
  return (
    <BaseWidget
      id={id}
      title={`${symbol} Chart`}
      icon={BarChart3}
      onRemove={onRemove}
      className="col-span-2 row-span-2"
    >
      <div className="h-full flex flex-col">
        {/* Price Display */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-white">${price.toFixed(2)}</span>
            <div className={`flex items-center space-x-1 ${changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {changePercent >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400">{symbol}</p>
        </div>

        {/* Mini Chart (Placeholder) */}
        <div className="flex-1 bg-slate-900/30 rounded-lg border border-slate-700/30 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Chart View</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-900/30 rounded border border-slate-700/30">
            <p className="text-slate-500 mb-0.5">High</p>
            <p className="text-green-400 font-semibold">${(price * 1.02).toFixed(2)}</p>
          </div>
          <div className="p-2 bg-slate-900/30 rounded border border-slate-700/30">
            <p className="text-slate-500 mb-0.5">Low</p>
            <p className="text-red-400 font-semibold">${(price * 0.98).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
