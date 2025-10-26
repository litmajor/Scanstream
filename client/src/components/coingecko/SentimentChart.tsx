/**
 * Sentiment Chart Component
 * Displays sentiment score over time with visual chart
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

interface SentimentChartProps {
  symbol: string;
}

export function SentimentChart({ symbol }: SentimentChartProps) {
  const { data: sentimentData, isLoading, error } = useQuery({
    queryKey: ['sentiment', symbol],
    queryFn: async () => {
      const baseSymbol = symbol.split('/')[0];
      const response = await fetch(`/api/coingecko/sentiment/${baseSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch sentiment');
      return response.json();
    },
    refetchInterval: 300000, // 5 minutes
    staleTime: 180000, // 3 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (isLoading) {
    return (
      <Card className="w-full bg-transparent border-0">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !sentimentData?.success) {
    return (
      <Card className="w-full bg-transparent border-0">
        <CardContent className="py-4">
          <p className="text-xs text-slate-400 text-center">
            Sentiment data unavailable for {symbol}
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = sentimentData.sentimentScore;

  // Create data points for gauge visualization
  const gaugeData = Array.from({ length: 101 }, (_, i) => ({
    value: i,
    score: i <= score ? score : 0,
    zone: i < 30 ? 'bearish' : i > 70 ? 'bullish' : 'neutral'
  }));

  return (
    <Card className="w-full bg-transparent border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white">Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Score Display */}
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {score}
              <span className="text-sm text-slate-400">/100</span>
            </div>
            <div className="text-xs text-slate-400 capitalize">
              {sentimentData.interpretation}
            </div>
          </div>

          {/* Gauge Chart */}
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={gaugeData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="sentimentGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="30%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="50%" stopColor="#84cc16" stopOpacity={0.4} />
                  <stop offset="70%" stopColor="#22c55e" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <XAxis dataKey="value" hide />
              <YAxis hide domain={[0, 100]} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="url(#sentimentGradient)"
                fill="url(#sentimentGradient)"
                strokeWidth={2}
              />
              <ReferenceLine x={score} stroke="#000" strokeWidth={2} strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="2 2" opacity={0.3} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="2 2" opacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex justify-between text-xs px-2">
            <span className="text-red-400">Bearish</span>
            <span className="text-slate-400">Neutral</span>
            <span className="text-green-400">Bullish</span>
          </div>

          {/* Breakdown */}
          <div className="pt-2 border-t border-slate-700/50 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Social Sentiment</span>
              <span className="font-medium text-white">{score > 60 ? 'Positive' : score < 40 ? 'Negative' : 'Mixed'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Confidence Level</span>
              <span className="font-medium text-white">{score > 70 || score < 30 ? 'High' : 'Medium'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

