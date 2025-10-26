/**
 * Sentiment Indicator Component
 * Shows sentiment score with visual gauge
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SentimentData {
  success: boolean;
  symbol: string;
  sentimentScore: number;
  interpretation: 'bullish' | 'bearish' | 'neutral';
}

interface SentimentIndicatorProps {
  symbol: string;
  className?: string;
}

export function SentimentIndicator({ symbol, className }: SentimentIndicatorProps) {
  const { data, isLoading } = useQuery<SentimentData>({
    queryKey: ['sentiment', symbol],
    queryFn: async () => {
      const baseSymbol = symbol.split('/')[0]; // BTC/USDT -> BTC
      const response = await fetch(`/api/coingecko/sentiment/${baseSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch sentiment');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 300000,
  });

  if (isLoading || !data?.success) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-gray-400', className)}>
        <Minus className="w-4 h-4" />
        <span>--</span>
      </div>
    );
  }

  const score = data.sentimentScore;
  const getSentimentConfig = () => {
    if (score >= 70) return { 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bg: 'bg-green-50', 
      label: 'Bullish',
      barColor: 'bg-green-500'
    };
    if (score <= 30) return { 
      icon: TrendingDown, 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      label: 'Bearish',
      barColor: 'bg-red-500'
    };
    return { 
      icon: Minus, 
      color: 'text-gray-600', 
      bg: 'bg-gray-50', 
      label: 'Neutral',
      barColor: 'bg-gray-400'
    };
  };

  const config = getSentimentConfig();
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md', config.bg)}>
        <Icon className={cn('w-3.5 h-3.5', config.color)} />
        <span className={cn('text-xs font-medium', config.color)}>
          {score}
        </span>
      </div>
      
      {/* Mini sentiment bar */}
      <div className="hidden sm:flex items-center gap-1">
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn('h-full transition-all', config.barColor)}
            data-score={score}
          >
            <div className="w-full h-full" style={{ transform: `scaleX(${score / 100})`, transformOrigin: 'left' }} />
          </div>
        </div>
        <span className="text-xs text-gray-500">{config.label}</span>
      </div>
    </div>
  );
}

/**
 * Compact Sentiment Badge
 */
export function SentimentBadge({ symbol }: { symbol: string }) {
  const { data } = useQuery<SentimentData>({
    queryKey: ['sentiment', symbol],
    queryFn: async () => {
      const baseSymbol = symbol.split('/')[0];
      const response = await fetch(`/api/coingecko/sentiment/${baseSymbol}`);
      return response.json();
    },
    refetchInterval: 300000,
    staleTime: 300000,
  });

  if (!data?.success) return null;

  const score = data.sentimentScore;
  const getColor = () => {
    if (score >= 70) return 'bg-green-100 text-green-700 border-green-300';
    if (score <= 30) return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border',
      getColor()
    )}>
      {score}
    </span>
  );
}

