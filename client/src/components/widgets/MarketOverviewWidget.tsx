import { BarChart3, TrendingUp, Layers, Activity } from 'lucide-react';
import BaseWidget from './BaseWidget';

interface MarketOverviewWidgetProps {
  id: string;
  fearGreedIndex: number;
  btcDominance: number;
  totalMarketCap: number;
  volume24h: number;
  onRemove?: (id: string) => void;
}

export default function MarketOverviewWidget({
  id,
  fearGreedIndex,
  btcDominance,
  totalMarketCap,
  volume24h,
  onRemove,
}: MarketOverviewWidgetProps) {
  return (
    <BaseWidget
      id={id}
      title="Market Overview"
      icon={BarChart3}
      onRemove={onRemove}
      className="col-span-1"
    >
      <div className="space-y-3">
        {/* Fear & Greed Index */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Fear & Greed</span>
            <Activity className="w-3 h-3 text-blue-400" />
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-slate-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  fearGreedIndex > 50 ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${fearGreedIndex}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${
              fearGreedIndex > 50 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {fearGreedIndex}
            </span>
          </div>
        </div>

        {/* BTC Dominance */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">BTC Dominance</span>
            <TrendingUp className="w-3 h-3 text-orange-400" />
          </div>
          <p className="text-lg font-bold text-white">{btcDominance.toFixed(1)}%</p>
        </div>

        {/* Market Cap */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Total Market Cap</span>
            <Layers className="w-3 h-3 text-purple-400" />
          </div>
          <p className="text-lg font-bold text-white">${totalMarketCap.toFixed(2)}T</p>
        </div>

        {/* 24h Volume */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">24h Volume</span>
            <BarChart3 className="w-3 h-3 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white">${volume24h.toFixed(1)}B</p>
        </div>
      </div>
    </BaseWidget>
  );
}
