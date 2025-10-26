/**
 * Market Regime Badge
 * Shows current market regime with icon
 */

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface MarketRegimeData {
  success: boolean;
  regime: 'bull' | 'bear' | 'neutral' | 'volatile';
  confidence: number;
  btcDominance: number;
}

export function MarketRegimeBadge({ className }: { className?: string }) {
  const { data, isLoading } = useQuery<MarketRegimeData>({
    queryKey: ['market-regime'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/regime');
      if (!response.ok) throw new Error('Failed to fetch regime');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes (reduced from 1 min)
    staleTime: 180000, // 3 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (isLoading || !data?.success) {
    return (
      <div className={cn('px-2 py-1 rounded-md bg-slate-800 text-slate-400 text-xs', className)}>
        Loading...
      </div>
    );
  }

  const regimeConfig = {
    bull: {
      icon: TrendingUp,
      color: 'text-green-700',
      bg: 'bg-green-100',
      border: 'border-green-300',
      label: 'Bull',
      emoji: '🚀'
    },
    bear: {
      icon: TrendingDown,
      color: 'text-red-700',
      bg: 'bg-red-100',
      border: 'border-red-300',
      label: 'Bear',
      emoji: '🐻'
    },
    neutral: {
      icon: Minus,
      color: 'text-gray-700',
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      label: 'Neutral',
      emoji: '😐'
    },
    volatile: {
      icon: Zap,
      color: 'text-yellow-700',
      bg: 'bg-yellow-100',
      border: 'border-yellow-300',
      label: 'Volatile',
      emoji: '⚡'
    }
  };

  const config = regimeConfig[data.regime];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium',
        config.bg,
        config.color,
        config.border,
        className
      )}
      title={`Market Regime: ${config.label} (${data.confidence}% confidence, BTC ${data.btcDominance.toFixed(1)}% dominance)`}
    >
      <span>{config.emoji}</span>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
      <span className="text-[10px] opacity-70">{data.confidence}%</span>
    </div>
  );
}

/**
 * Compact Market Regime Indicator (just icon)
 */
export function MarketRegimeIcon() {
  const { data } = useQuery<MarketRegimeData>({
    queryKey: ['market-regime'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/regime');
      if (!response.ok) throw new Error('Failed to fetch regime');
      return response.json();
    },
    refetchInterval: 300000, // 5 minutes
    staleTime: 180000, // 3 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (!data?.success) return null;

  const regimeConfig = {
    bull: { emoji: '🚀', label: 'Bull Market' },
    bear: { emoji: '🐻', label: 'Bear Market' },
    neutral: { emoji: '😐', label: 'Neutral' },
    volatile: { emoji: '⚡', label: 'Volatile' }
  };

  const config = regimeConfig[data.regime];

  return (
    <span 
      className="text-lg cursor-help" 
      title={`${config.label} (${data.confidence}% confidence)`}
    >
      {config.emoji}
    </span>
  );
}

