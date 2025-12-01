
/**
 * Market Intelligence Dashboard - Complete Edition
 * Comprehensive view of all available CoinGecko market data with custom analysis
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
import { TrendingUp, Search, BarChart3, Activity, DollarSign, Globe, Zap, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TopMoversWidget } from '@/components/TopMoversWidget';

interface GlobalMetrics {
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  markets: number;
  marketCapChangePercentage24h: number;
}

interface MarketRegime {
  regime: 'bull' | 'bear' | 'neutral' | 'volatile';
  confidence: number;
  trend_strength: number;
  volatility: string;
  atr_pct: number;
  suggested_opportunity_threshold: number;
  ema_alignment: any;
  returns: any;
}

interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  score: number;
  price_btc: number;
  market_cap_rank: number;
}

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
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch comprehensive market overview
  const { data: marketOverview } = useQuery({
    queryKey: ['market-overview-complete'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/market-overview');
      if (!response.ok) throw new Error('Failed to fetch market overview');
      return response.json();
    },
    refetchInterval: 300000, // 5 minutes
  });

  // Fetch trending coins
  const { data: trendingData } = useQuery({
    queryKey: ['trending-coins'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/trending');
      if (!response.ok) throw new Error('Failed to fetch trending');
      return response.json();
    },
    refetchInterval: 600000, // 10 minutes
  });

  // Fetch global metrics
  const { data: globalData } = useQuery({
    queryKey: ['global-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/global');
      if (!response.ok) throw new Error('Failed to fetch global metrics');
      return response.json();
    },
    refetchInterval: 300000,
  });

  // Fetch market regime analysis
  const { data: regimeData } = useQuery({
    queryKey: ['market-regime'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/regime');
      if (!response.ok) throw new Error('Failed to fetch regime');
      return response.json();
    },
    refetchInterval: 300000,
  });

  // Fetch fear & greed index
  const { data: fearGreedData } = useQuery({
    queryKey: ['fear-greed'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/fear-greed');
      if (!response.ok) throw new Error('Failed to fetch fear & greed');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
  });

  // Fetch scanner signals
  const { data: signals } = useQuery<{ signals: Signal[] }>({
    queryKey: ['scanner-signals'],
    queryFn: async () => {
      const response = await fetch('/api/scanner/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const filteredSignals = signals?.signals?.filter(s =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const global: GlobalMetrics | undefined = globalData?.data;
  const regime: MarketRegime | undefined = marketOverview?.regime;
  const trending: TrendingCoin[] = trendingData?.data || [];

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
              Market Intelligence Center
            </h1>
            <p className="text-slate-400 mt-1">
              Complete market analysis powered by CoinGecko & custom analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MarketRegimeBadge />
            {fearGreedData?.success && (
              <Badge variant="outline" className="text-sm">
                Fear & Greed: {fearGreedData.index}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="regime">Regime Analysis</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="movers">Top Movers</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="metrics">Global Metrics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Market Overview */}
              <div className="lg:col-span-1">
                <MarketOverview />
              </div>

              {/* Sentiment & Regime */}
              <div className="lg:col-span-2 space-y-4">
                {/* Fear & Greed Detailed */}
                {fearGreedData?.success && (
                  <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Fear & Greed Index
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold">{fearGreedData.index}</span>
                          <Badge className={
                            fearGreedData.index >= 75 ? "bg-green-500" :
                            fearGreedData.index >= 60 ? "bg-green-400" :
                            fearGreedData.index >= 45 ? "bg-yellow-400" :
                            fearGreedData.index >= 30 ? "bg-orange-400" : "bg-red-400"
                          }>
                            {fearGreedData.sentiment}
                          </Badge>
                        </div>
                        <Progress value={fearGreedData.index} className="h-2" />
                        
                        {fearGreedData.components && (
                          <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Market Cap</span>
                                <span className="text-white">{fearGreedData.components.marketCapChange}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Volume</span>
                                <span className="text-white">{fearGreedData.components.volume}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">BTC Dominance</span>
                                <span className="text-white">{fearGreedData.components.bitcoinDominance}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Momentum</span>
                                <span className="text-white">{fearGreedData.components.momentum}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Volatility</span>
                                <span className="text-white">{fearGreedData.components.volatility}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Asset Sentiment */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        {selectedSymbol} Analysis
                      </CardTitle>
                      <Input
                        placeholder="Change symbol..."
                        value={selectedSymbol}
                        onChange={(e) => setSelectedSymbol(e.target.value)}
                        className="w-32 h-8 text-sm bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SentimentChart symbol={selectedSymbol} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Regime Analysis Tab */}
          <TabsContent value="regime" className="space-y-6">
            {regime && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-400">Current Regime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize">{regime.regime}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Confidence: {regime.confidence}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-400">Trend Strength</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{regime.trend_strength.toFixed(1)}</div>
                    <Progress value={regime.trend_strength * 10} className="h-1 mt-2" />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-400">Volatility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize">{regime.volatility}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      ATR: {regime.atr_pct.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-400">Suggested Threshold</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{regime.suggested_opportunity_threshold}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Opportunity Score
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {regime?.ema_alignment && (
              <Card className="bg-slate-800/40 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">EMA Alignment Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(regime.ema_alignment).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-slate-300 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {regime?.returns && (
              <Card className="bg-slate-800/40 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Performance Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-400">20-Day Return</div>
                      <div className={`text-2xl font-bold ${regime.returns['20d'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {regime.returns['20d'] > 0 ? '+' : ''}{regime.returns['20d'].toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">50-Day Return</div>
                      <div className={`text-2xl font-bold ${regime.returns['50d'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {regime.returns['50d'] > 0 ? '+' : ''}{regime.returns['50d'].toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Top Movers Tab */}
          <TabsContent value="movers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gainers */}
              <Card className="bg-slate-800/40 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Top Gainers (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TopMoversWidget limit={10} />
                </CardContent>
              </Card>

              {/* Historical Performance Card */}
              <Card className="bg-slate-800/40 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Performance Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-400 space-y-2">
                    <p>• Track price changes across multiple timeframes</p>
                    <p>• Monitor ATH/ATL distances</p>
                    <p>• ROI since launch calculations</p>
                    <p>• Volume trends and patterns</p>
                    <div className="pt-4 border-t border-slate-700/50 mt-4">
                      <div className="text-xs text-slate-500">
                        Click on any coin in the list to see detailed historical data
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trending Tab */}
          <TabsContent value="trending" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trending.map((coin) => (
                <Card key={coin.id} className="bg-slate-800/40 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-lg text-white">{coin.symbol.toUpperCase()}</div>
                        <div className="text-sm text-slate-400">{coin.name}</div>
                      </div>
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                        #{coin.rank}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Market Cap Rank</span>
                        <span className="text-white">#{coin.market_cap_rank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trending Score</span>
                        <span className="text-white">{coin.score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Price (BTC)</span>
                        <span className="text-white">{coin.price_btc.toFixed(8)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search symbols..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
            </div>

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

          {/* Global Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6">
            {global && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Total Market Cap
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${(global.totalMarketCap / 1e12).toFixed(2)}T</div>
                      {global.marketCapChangePercentage24h && (
                        <div className={`text-sm mt-1 ${global.marketCapChangePercentage24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {global.marketCapChangePercentage24h >= 0 ? '+' : ''}{global.marketCapChangePercentage24h.toFixed(2)}% (24h)
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        24h Volume
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${(global.totalVolume / 1e9).toFixed(1)}B</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {((global.totalVolume / global.totalMarketCap) * 100).toFixed(1)}% of market cap
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        BTC Dominance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{global.btcDominance.toFixed(1)}%</div>
                      <Progress value={global.btcDominance} className="h-1 mt-2" />
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        ETH Dominance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{global.ethDominance?.toFixed(1) || 'N/A'}%</div>
                      {global.ethDominance && <Progress value={global.ethDominance} className="h-1 mt-2" />}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">Market Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Active Cryptocurrencies</span>
                          <span className="text-white font-semibold">{global.activeCryptocurrencies.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Total Markets</span>
                          <span className="text-white font-semibold">{global.markets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Alt Season Index</span>
                          <span className="text-white font-semibold">
                            {global.btcDominance < 45 ? 'Strong' : global.btcDominance < 50 ? 'Moderate' : 'Low'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">Market Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">Overall Health</span>
                            <span className="text-white">
                              {global.marketCapChangePercentage24h > 2 ? 'Excellent' :
                               global.marketCapChangePercentage24h > 0 ? 'Good' :
                               global.marketCapChangePercentage24h > -2 ? 'Fair' : 'Poor'}
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(100, Math.max(0, 50 + (global.marketCapChangePercentage24h * 10)))} 
                            className="h-2" 
                          />
                        </div>
                        <div className="pt-2 border-t border-slate-700">
                          <div className="text-sm text-slate-400">Market Sentiment</div>
                          <div className="text-lg font-semibold text-white">
                            {global.btcDominance > 55 ? 'Risk-Off' :
                             global.btcDominance < 45 ? 'Risk-On' : 'Balanced'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Attribution Footer */}
        <div className="text-center text-xs text-slate-500 pt-4">
          Market data provided by{' '}
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
