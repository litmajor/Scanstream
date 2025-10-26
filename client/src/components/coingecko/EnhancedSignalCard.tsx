/**
 * Enhanced Signal Card with Sentiment
 * Shows signal with composite score including sentiment and regime
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SentimentBadge } from './SentimentIndicator';

interface Signal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  price: number;
  change: number;
  rsi?: number;
  macd?: number;
  volumeRatio?: number;
  momentum?: number;
}

interface EnhancedSignalCardProps {
  signal: Signal;
  onSelect?: () => void;
}

interface CompositeScoreData {
  success: boolean;
  compositeScore: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  breakdown: {
    technical: { score: number; contribution: number };
    sentiment: { score: number; contribution: number; isTrending: boolean };
    marketRegime: { score: number; contribution: number; regime: string };
  };
}

export function EnhancedSignalCard({ signal, onSelect }: EnhancedSignalCardProps) {
  const { data: compositeData, isLoading } = useQuery<CompositeScoreData>({
    queryKey: ['composite-score', signal.symbol],
    queryFn: async () => {
      const response = await fetch('/api/analytics/composite-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: signal.symbol,
          rsi: signal.rsi || 50,
          macd: signal.macd || 0,
          volumeRatio: signal.volumeRatio || 1,
          priceChange24h: signal.change || 0,
          momentum: signal.momentum || 0,
          includeSentiment: true
        })
      });
      return response.json();
    },
    staleTime: 300000, // 5 minutes
  });

  const getSignalColor = (sig: string) => {
    if (sig === 'BUY') return 'text-green-600 bg-green-50 border-green-200';
    if (sig === 'SELL') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getRecommendationConfig = (rec?: string) => {
    switch (rec) {
      case 'strong_buy':
        return { label: 'Strong Buy', color: 'text-green-700 bg-green-100', icon: '🟢' };
      case 'buy':
        return { label: 'Buy', color: 'text-green-600 bg-green-50', icon: '🟡' };
      case 'sell':
        return { label: 'Sell', color: 'text-orange-600 bg-orange-50', icon: '🟠' };
      case 'strong_sell':
        return { label: 'Strong Sell', color: 'text-red-700 bg-red-100', icon: '🔴' };
      default:
        return { label: 'Hold', color: 'text-gray-600 bg-gray-50', icon: '⚪' };
    }
  };

  const recommendation = getRecommendationConfig(compositeData?.recommendation);

  return (
    <Card 
      className={cn(
        'cursor-pointer hover:shadow-lg transition-all bg-slate-800/40 border-slate-700/50 backdrop-blur-sm hover:border-slate-600',
        compositeData?.recommendation === 'strong_buy' && 'border-green-500/50'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">{signal.symbol}</span>
                <SentimentBadge symbol={signal.symbol} />
                {compositeData?.breakdown.sentiment.isTrending && (
                  <span className="text-yellow-500" title="Trending">⭐</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-white">${signal.price.toFixed(2)}</span>
                <span className={cn(
                  'text-sm font-medium flex items-center gap-1',
                  signal.change >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {signal.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {signal.change.toFixed(2)}%
                </span>
              </div>
            </div>
            
            {/* Signal Badge */}
            <div className={cn(
              'px-3 py-1 rounded-md border text-sm font-semibold',
              signal.signal === 'BUY' && 'bg-green-500/20 border-green-500/50 text-green-400',
              signal.signal === 'SELL' && 'bg-red-500/20 border-red-500/50 text-red-400',
              signal.signal === 'HOLD' && 'bg-slate-500/20 border-slate-500/50 text-slate-400'
            )}>
              {signal.signal}
            </div>
          </div>

          {/* Composite Score */}
          {compositeData && (
            <div className="space-y-2 pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Composite Score</span>
                <span className={cn(
                  'text-sm font-bold px-2 py-0.5 rounded',
                  compositeData.compositeScore >= 75 ? 'bg-green-500/20 text-green-400' :
                  compositeData.compositeScore >= 60 ? 'bg-green-500/10 text-green-400' :
                  compositeData.compositeScore >= 40 ? 'bg-slate-500/20 text-slate-300' :
                  compositeData.compositeScore >= 25 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {compositeData.compositeScore.toFixed(1)}
                  <span className="text-xs opacity-70">/100</span>
                </span>
              </div>

              {/* Score Bar */}
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all transform origin-left',
                    compositeData.compositeScore >= 75 ? 'bg-green-500' :
                    compositeData.compositeScore >= 60 ? 'bg-green-400' :
                    compositeData.compositeScore >= 40 ? 'bg-slate-400' :
                    compositeData.compositeScore >= 25 ? 'bg-orange-400' : 'bg-red-500'
                  )}
                  data-score={compositeData.compositeScore}
                >
                  <div className="w-full h-full" style={{ transform: `scaleX(${compositeData.compositeScore / 100})`, transformOrigin: 'left' }} />
                </div>
              </div>

              {/* Recommendation */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Recommendation</span>
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded',
                  compositeData.recommendation === 'strong_buy' && 'bg-green-500/20 text-green-400',
                  compositeData.recommendation === 'buy' && 'bg-green-500/10 text-green-400',
                  compositeData.recommendation === 'hold' && 'bg-slate-500/20 text-slate-300',
                  compositeData.recommendation === 'sell' && 'bg-orange-500/20 text-orange-400',
                  compositeData.recommendation === 'strong_sell' && 'bg-red-500/20 text-red-400'
                )}>
                  {recommendation.icon} {recommendation.label}
                </span>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="text-center">
                  <div className="text-slate-400">Technical</div>
                  <div className="font-semibold text-white">{compositeData.breakdown.technical.score.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Sentiment</div>
                  <div className="font-semibold text-white">{compositeData.breakdown.sentiment.score.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Regime</div>
                  <div className="font-semibold text-white capitalize">{compositeData.breakdown.marketRegime.regime}</div>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="pt-2 border-t border-slate-700/50">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                Calculating composite score...
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

