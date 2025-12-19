import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Plus, TrendingUp, TrendingDown, Zap, Grid3x3, List } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import SymbolTable from '../components/SymbolTable';
import TopAssetsTable from '../components/TopAssetsTable';
import WatchlistManager from '../components/WatchlistManager';
import LiquidityHeatmap from '../components/LiquidityHeatmap';
import CorrelationMatrix from '../components/CorrelationMatrix';
import SymbolDetailsPanel from '../components/SymbolDetailsPanel';
import VolumeProfile from '../components/VolumeProfile';
import AssetClassTabs from '../components/AssetClassTabs';
import { useAssetClassData, type AssetClass } from '../hooks/useAssetClassData';

/**
 * SYMBOL UNIVERSE DASHBOARD
 * 
 * Centralized asset discovery, monitoring, and trading universe management
 */

export interface Symbol {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  spread: number;
  volatility: number;
  exchanges: string[];
  inWatchlist: boolean;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt?: string;
}

type TabType = 'symbols' | 'heatmap' | 'correlation' | 'volume' | 'watchlists';

export default function SymbolUniversePage() {
  const [activeTab, setActiveTab] = useState<TabType>('symbols');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssetClass, setActiveAssetClass] = useState<AssetClass>('crypto');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filters, setFilters] = useState({
    exchange: 'all',
    assetClass: 'all',
    marketCap: 'all',
    minVolume: 0,
    minLiquidity: 0,
    volatilityRange: { min: 0, max: 100 },
  });

  // Fetch symbols data (legacy Symbol Universe)
  const { data: symbolsData } = useQuery({
    queryKey: ['symbols', filters, searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          search: searchQuery,
          exchange: filters.exchange,
          assetClass: filters.assetClass,
          marketCap: filters.marketCap,
          minVolume: filters.minVolume.toString(),
          minLiquidity: filters.minLiquidity.toString(),
          minVolatility: filters.volatilityRange.min.toString(),
          maxVolatility: filters.volatilityRange.max.toString(),
        });

        const response = await fetch(`/api/symbols?${params}`);
        if (!response.ok) throw new Error('Failed to fetch symbols');
        return response.json();
      } catch (error) {
        console.error('Symbol fetch error:', error);
        return { data: [] };
      }
    },
    staleTime: 5000,
  });

  // Fetch asset class data (new multi-asset support)
  const { data: assetClassData, isLoading: assetClassLoading, error: assetClassError } = useAssetClassData(
    activeAssetClass,
    currentPage
  );

  // Fetch watchlists
  useEffect(() => {
    const fetchWatchlists = async () => {
      try {
        const response = await fetch('/api/watchlists');
        if (response.ok) {
          const data = await response.json();
          setWatchlists(data.data || []);
        }
      } catch (error) {
        console.error('Watchlist fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlists();
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    );

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'symbols' }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'symbol-update') {
        // Update symbols with real-time price data
        // This will be handled by React Query auto-updates
        console.log('Received symbol update:', message.data);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const symbols = symbolsData?.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                🌌 Symbol Universe
              </h1>
              <p className="text-sm text-slate-400 mt-1">Discover, analyze, and manage your trading universe</p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* View Mode Toggle */}
              {activeTab === 'symbols' && (
                <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    aria-label="Table view"
                    title="Table view"
                    className={`p-2 rounded transition-all ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    title="Grid view"
                    className={`p-2 rounded transition-all ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Filters Button */}
              <button className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all flex items-center space-x-2 text-slate-300 hover:text-white">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/20 sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex space-x-1">
            {[
              { id: 'symbols' as TabType, label: '📊 Symbols', icon: <TrendingUp className="w-4 h-4" /> },
              { id: 'heatmap' as TabType, label: '🔥 Liquidity Heatmap', icon: <Grid3x3 className="w-4 h-4" /> },
              { id: 'correlation' as TabType, label: '🔗 Correlation', icon: <Zap className="w-4 h-4" /> },
              { id: 'volume' as TabType, label: '📈 Volume Profile', icon: <TrendingUp className="w-4 h-4" /> },
              { id: 'watchlists' as TabType, label: '⭐ Watchlists', icon: <Star className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-slate-400">Loading Symbol Universe...</div>
          </div>
        ) : (
          <>
            {/* Symbols Tab */}
            {activeTab === 'symbols' && (
              <div className="space-y-6">
                {/* Asset Class Selection */}
                <AssetClassTabs activeClass={activeAssetClass} onClassChange={(assetClass) => {
                  setActiveAssetClass(assetClass);
                  setCurrentPage(1); // Reset to first page when changing asset class
                }} />

                {/* Top Assets Table for Selected Asset Class */}
                <TopAssetsTable
                  assets={assetClassData?.data || []}
                  assetClass={activeAssetClass}
                  isLoading={assetClassLoading}
                  error={assetClassError}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  itemsPerPage={100}
                />

                {/* Filter Panel for Legacy Symbol Universe */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mt-8">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">💎 Symbol Universe Analysis (Legacy)</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Exchange</label>
                      <select
                        value={filters.exchange}
                        onChange={(e) => setFilters({ ...filters, exchange: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                        aria-label="Select exchange"
                      >
                        <option value="all">All Exchanges</option>
                        <option value="binance">Binance</option>
                        <option value="coinbase">Coinbase</option>
                        <option value="kraken">Kraken</option>
                        <option value="okx">OKX</option>
                        <option value="bybit">Bybit</option>
                        <option value="kucoin">KuCoin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Asset Class</label>
                      <select
                        value={filters.assetClass}
                        onChange={(e) => setFilters({ ...filters, assetClass: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                        aria-label="Select asset class"
                      >
                        <option value="all">All Assets</option>
                        <option value="spot">Spot</option>
                        <option value="futures">Futures</option>
                        <option value="perpetual">Perpetual Swaps</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Market Cap</label>
                      <select
                        value={filters.marketCap}
                        onChange={(e) => setFilters({ ...filters, marketCap: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                        aria-label="Select market cap range"
                      >
                        <option value="all">All Caps</option>
                        <option value="micro">Micro (&lt;$100M)</option>
                        <option value="small">Small ($100M-$1B)</option>
                        <option value="mid">Mid ($1B-$10B)</option>
                        <option value="large">Large (&gt;$10B)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Min Volume (24h)</label>
                      <input
                        type="number"
                        placeholder="$0"
                        value={filters.minVolume}
                        onChange={(e) => setFilters({ ...filters, minVolume: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                        aria-label="Minimum 24-hour volume"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Min Liquidity</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filters.minLiquidity}
                        onChange={(e) => setFilters({ ...filters, minLiquidity: parseInt(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        aria-label="Minimum liquidity"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() =>
                          setFilters({
                            exchange: 'all',
                            assetClass: 'all',
                            marketCap: 'all',
                            minVolume: 0,
                            minLiquidity: 0,
                            volatilityRange: { min: 0, max: 100 },
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded text-sm font-medium text-slate-300 transition-all"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Symbol Table or Grid */}
                {symbols.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-slate-300">Recent Symbols</h3>
                    <SymbolTable
                      symbols={symbols}
                      viewMode={viewMode}
                      onSelectSymbol={(symbol: Symbol) => {
                        setSelectedSymbol(symbol);
                        setShowDetailsPanel(true);
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {/* Heatmap Tab */}
            {activeTab === 'heatmap' && <LiquidityHeatmap symbols={symbols} />}

            {/* Correlation Tab */}
            {activeTab === 'correlation' && <CorrelationMatrix symbols={symbols} />}

            {/* Volume Profile Tab */}
            {activeTab === 'volume' && <VolumeProfile symbols={symbols} selectedSymbol={selectedSymbol?.symbol} />}

            {/* Watchlists Tab */}
            {activeTab === 'watchlists' && <WatchlistManager watchlists={watchlists} setWatchlists={(lists) => setWatchlists(lists)} />}
          </>
        )}
      </div>

      {/* Details Panel */}
      {showDetailsPanel && selectedSymbol && (
        <SymbolDetailsPanel
          symbol={selectedSymbol}
          onClose={() => setShowDetailsPanel(false)}
          onAddToWatchlist={(watchlistId: string) => {
            console.log(`Added ${selectedSymbol.symbol} to watchlist ${watchlistId}`);
          }}
        />
      )}
    </div>
  );
}
