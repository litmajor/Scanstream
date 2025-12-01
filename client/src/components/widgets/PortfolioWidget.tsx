import { Wallet, TrendingUp, Target, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import BaseWidget from './BaseWidget';

interface PortfolioWidgetProps {
  id: string;
  onRemove?: (id: string) => void;
}

interface PortfolioSummary {
  totalValue: number;
  performance: {
    totalReturn: number;
    winRate: number;
    totalTrades: number;
  };
}

export default function PortfolioWidget({
  id,
  onRemove,
}: PortfolioWidgetProps) {
  const { data: portfolio } = useQuery<PortfolioSummary>({
    queryKey: ['portfolio-summary'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/summary');
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      return response.json();
    },
    refetchInterval: 10000,
  });

  const balance = portfolio?.totalValue || 0;
  const totalReturn = portfolio?.performance?.totalReturn || 0;
  const winRate = portfolio?.performance?.winRate || 0;
  const totalTrades = portfolio?.performance?.totalTrades || 0;
  return (
    <BaseWidget
      id={id}
      title="Portfolio Summary"
      icon={Wallet}
      onRemove={onRemove}
      className="col-span-1"
    >
      <div className="space-y-3">
        {/* Balance */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Current Balance</span>
            <Wallet className="w-3 h-3 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-white">${balance.toLocaleString()}</p>
        </div>

        {/* Return */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Total Return</span>
            <TrendingUp className="w-3 h-3 text-green-400" />
          </div>
          <p className={`text-lg font-bold ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalReturn >= 0 ? '+' : ''}{(totalReturn * 100).toFixed(2)}%
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Win Rate</span>
            <Target className="w-3 h-3 text-purple-400" />
          </div>
          <p className="text-lg font-bold text-white">{(winRate * 100).toFixed(1)}%</p>
        </div>

        {/* Total Trades */}
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Total Trades</span>
            <Activity className="w-3 h-3 text-yellow-400" />
          </div>
          <p className="text-lg font-bold text-white">{totalTrades}</p>
        </div>
      </div>
    </BaseWidget>
  );
}
