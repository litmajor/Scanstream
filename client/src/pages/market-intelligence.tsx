/**
 * Market Intelligence Dashboard
 * Comprehensive view of market data with CoinGecko sentiment
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MarketOverview, 
  SentimentChart, 
  MarketRegimeBadge, 
  EnhancedSignalCard 
} from '@/components/coingecko';
import { TrendingUp, Search, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Signal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  price: number;
  change: number;
  volume: number;
  rsi?: number;
  macd?: number;
  volumeRatio?: number;
  momentum?: number;
}

export default function MarketIntelligence() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');

  // Fetch scanner signals (mock data for now - replace with actual scanner API)
  const { data: signals } = useQuery<{ signals: Signal[] }>({
    queryKey: ['scanner-signals'],
    queryFn: async () => {
      // This would be your actual scanner API endpoint
      // For now, returning mock data
      return {
        signals: [
          {
            symbol: 'BTC/USDT',
            signal: 'BUY',
            strength: 85,
            price: 67421,
            change: 3.42,
            volume: 38291900000,
            rsi: 35,
            macd: 0.5,
            volumeRatio: 2.3,
            momentum: 0.6
          },
          {
            symbol: 'ETH/USDT',
            signal: 'BUY',
            strength: 72,
            price: 3542,
            change: 2.15,
            volume: 18291900000,
            rsi: 45,
            macd: 0.2,
            volumeRatio: 1.8,
            momentum: 0.3
          },
          {
            symbol: 'SOL/USDT',
            signal: 'HOLD',
            strength: 55,
            price: 142.5,
            change: -1.25,
            volume: 1829190000,
            rsi: 52,
            macd: -0.1,
            volumeRatio: 1.2,
            momentum: 0.1
          }
        ]
      };
    },
    refetchInterval: 60000,
  });

  const filteredSignals = signals?.signals.filter(s =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="relative container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Market Intelligence
            </h1>
            <p className="text-slate-400 mt-1">
              Comprehensive market analysis powered by technical indicators and sentiment data
            </p>
          </div>
          <MarketRegimeBadge />
        </div>

      {/* Top Section - Market Overview and Selected Asset */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Overview */}
        <div className="lg:col-span-1">
          <MarketOverview />
        </div>

        {/* Selected Asset Analysis */}
        <div className="lg:col-span-2">
          <Card className="h-full bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  {selectedSymbol} Analysis
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Change symbol..."
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-32 h-8 text-sm bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SentimentChart symbol={selectedSymbol} />
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Signals Section */}
        <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Enhanced Signals
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search symbols..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-48 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="bg-slate-900/50 border-slate-700">
                <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">All Signals</TabsTrigger>
                <TabsTrigger value="buy" className="data-[state=active]:bg-slate-700">Buy Signals</TabsTrigger>
                <TabsTrigger value="sell" className="data-[state=active]:bg-slate-700">Sell Signals</TabsTrigger>
                <TabsTrigger value="trending" className="data-[state=active]:bg-slate-700">Trending</TabsTrigger>
              </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSignals.map((signal) => (
                  <EnhancedSignalCard
                    key={signal.symbol}
                    signal={signal}
                    onSelect={() => setSelectedSymbol(signal.symbol)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="buy" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSignals
                  .filter((s) => s.signal === 'BUY')
                  .map((signal) => (
                    <EnhancedSignalCard
                      key={signal.symbol}
                      signal={signal}
                      onSelect={() => setSelectedSymbol(signal.symbol)}
                    />
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="sell" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSignals
                  .filter((s) => s.signal === 'SELL')
                  .map((signal) => (
                    <EnhancedSignalCard
                      key={signal.symbol}
                      signal={signal}
                      onSelect={() => setSelectedSymbol(signal.symbol)}
                    />
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="trending" className="mt-4">
              <div className="text-center text-slate-400 py-8">
                Trending signals will show coins with high sentiment scores
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

        {/* Attribution Footer */}
        <div className="text-center text-xs text-slate-500">
          Market sentiment and global data provided by{' '}
          <a
            href="https://www.coingecko.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-300 transition-colors"
          >
            CoinGecko
          </a>
        </div>
      </div>
    </div>
  );
}

