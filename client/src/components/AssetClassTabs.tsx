import React from 'react';
import { TrendingUp, DollarSign, BarChart3, Zap, Grid3x3, Plus } from 'lucide-react';

export type AssetClass = 'crypto' | 'forex' | 'stocks' | 'commodities' | 'indices';

interface AssetClassTabsProps {
  activeClass: AssetClass;
  onClassChange: (assetClass: AssetClass) => void;
}

const ASSET_CLASSES: {
  id: AssetClass;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}[] = [
  {
    id: 'crypto',
    label: 'Cryptocurrencies',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Digital assets & tokens',
    color: 'from-orange-500 to-yellow-500',
  },
  {
    id: 'forex',
    label: 'Forex',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Currency pairs',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'stocks',
    label: 'Stocks',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Equities & companies',
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'commodities',
    label: 'Commodities',
    icon: <Zap className="w-5 h-5" />,
    description: 'Metals, energy, agriculture',
    color: 'from-red-500 to-pink-500',
  },
  {
    id: 'indices',
    label: 'Indices',
    icon: <Grid3x3 className="w-5 h-5" />,
    description: 'Market indices & benchmarks',
    color: 'from-purple-500 to-pink-500',
  },
];

export default function AssetClassTabs({ activeClass, onClassChange }: AssetClassTabsProps) {
  return (
    <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30 sticky top-0 z-50">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-3">Asset Classes</h2>
            <div className="flex gap-2 flex-wrap">
              {ASSET_CLASSES.map((assetClass) => {
                const isActive = activeClass === assetClass.id;
                return (
                  <button
                    key={assetClass.id}
                    onClick={() => onClassChange(assetClass.id)}
                    className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      isActive
                        ? `bg-gradient-to-r ${assetClass.color} text-white shadow-lg`
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {assetClass.icon}
                    <span className="font-medium">{assetClass.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Info */}
          <div className="text-right text-sm">
            <div className="text-slate-400">
              {ASSET_CLASSES.find((c) => c.id === activeClass)?.description}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
