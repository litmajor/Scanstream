import { useState } from 'react';
import { X, Star, Share2, Heart, TrendingUp, Users, MessageCircle, Search, Filter, Download, Crown } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Strategy {
  id: string;
  name: string;
  description: string;
  author: string;
  authorId: string;
  rating: number;
  reviews: number;
  downloads: number;
  followers: number;
  isFollowing: boolean;
  isPremium: boolean;
  price: number;
  categories: string[];
  performance: {
    winRate: number;
    sharpeRatio: number;
    totalReturn: number;
  };
  version: string;
  lastUpdated: string;
}

interface StrategyMarketplaceProps {
  onClose: () => void;
}

export default function StrategyMarketplace({ onClose }: StrategyMarketplaceProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'my-strategies' | 'following' | 'leaderboard'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'downloads' | 'performance' | 'recent'>('rating');

  // Mock data
  const mockStrategies: Strategy[] = [
    {
      id: '1',
      name: 'Golden Cross Momentum',
      description: 'Trend-following strategy using moving average crossovers with volume confirmation',
      author: 'TradingMaster',
      authorId: 'user1',
      rating: 4.8,
      reviews: 127,
      downloads: 2543,
      followers: 890,
      isFollowing: false,
      isPremium: true,
      price: 49.99,
      categories: ['Trend Following', 'Momentum'],
      performance: { winRate: 68.5, sharpeRatio: 2.1, totalReturn: 145.3 },
      version: '2.3.1',
      lastUpdated: '2024-01-15',
    },
    {
      id: '2',
      name: 'Mean Reversion Bot',
      description: 'Scalping strategy using RSI mean reversion in ranging markets',
      author: 'CryptoPro',
      authorId: 'user2',
      rating: 4.6,
      reviews: 89,
      downloads: 1890,
      followers: 567,
      isFollowing: true,
      isPremium: false,
      price: 0,
      categories: ['Mean Reversion', 'Scalping'],
      performance: { winRate: 72.3, sharpeRatio: 1.9, totalReturn: 98.7 },
      version: '1.8.5',
      lastUpdated: '2024-01-12',
    },
    {
      id: '3',
      name: 'Volume Breakout System',
      description: 'Breakout strategy using volume analysis and Fibonacci extensions',
      author: 'TradeAlgo',
      authorId: 'user3',
      rating: 4.9,
      reviews: 203,
      downloads: 3124,
      followers: 1245,
      isFollowing: false,
      isPremium: true,
      price: 79.99,
      categories: ['Breakout', 'Volume Analysis'],
      performance: { winRate: 64.2, sharpeRatio: 2.3, totalReturn: 167.8 },
      version: '3.1.0',
      lastUpdated: '2024-01-18',
    },
  ];

  const leaderboardData = [
    { rank: 1, name: 'Golden Cross Momentum', author: 'TradingMaster', score: 9850, change: '+5' },
    { rank: 2, name: 'Volume Breakout System', author: 'TradeAlgo', score: 9420, change: '+2' },
    { rank: 3, name: 'Mean Reversion Bot', author: 'CryptoPro', score: 8930, change: '-1' },
    { rank: 4, name: 'MACD Divergence', author: 'SignalMaster', score: 8650, change: '+3' },
    { rank: 5, name: 'Bollinger Squeeze', author: 'VolatilityKing', score: 8420, change: '+1' },
  ];

  const categories = ['all', 'Trend Following', 'Mean Reversion', 'Breakout', 'Momentum', 'Scalping', 'Volume Analysis'];

  const getFilteredStrategies = () => {
    let filtered = mockStrategies;

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.categories.includes(filterCategory));
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'performance':
          return b.performance.totalReturn - a.performance.totalReturn;
        case 'recent':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });
  };

  const handleFollow = (strategyId: string) => {
    // Toggle follow status
    console.log('Toggle follow:', strategyId);
  };

  const handleShare = (strategyId: string) => {
    console.log('Share strategy:', strategyId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-400" />
              <span>Strategy Marketplace</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">Discover, share, and trade strategies with the community</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="Close marketplace"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex space-x-2 bg-slate-700/50 rounded-lg p-2 border border-slate-600 mb-6">
            {[
              { id: 'browse', label: 'Browse', icon: Search },
              { id: 'my-strategies', label: 'My Strategies', icon: Download },
              { id: 'following', label: 'Following', icon: Heart },
              { id: 'leaderboard', label: 'Leaderboard', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Browse Tab */}
          {activeTab === 'browse' && (
            <div>
              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search strategies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  aria-label="Filter by category"
                  title="Filter by category"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="capitalize">
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  aria-label="Sort strategies"
                  title="Sort strategies"
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="downloads">Sort by Downloads</option>
                  <option value="performance">Sort by Performance</option>
                  <option value="recent">Sort by Recent</option>
                </select>
              </div>

              {/* Strategy Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getFilteredStrategies().map((strategy) => (
                  <div
                    key={strategy.id}
                    className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-blue-500/50 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                          {strategy.isPremium && (
                            <Crown className="w-4 h-4 text-yellow-400" title="Premium Strategy" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400">by {strategy.author}</p>
                      </div>
                      <button
                        onClick={() => handleFollow(strategy.id)}
                        className={`p-1 rounded-lg transition-colors ${
                          strategy.isFollowing ? 'text-red-400 hover:bg-red-500/20' : 'text-slate-400 hover:bg-slate-600'
                        }`}
                        aria-label={strategy.isFollowing ? 'Unfollow strategy' : 'Follow strategy'}
                        title={strategy.isFollowing ? 'Unfollow' : 'Follow'}
                      >
                        <Heart className={`w-5 h-5 ${strategy.isFollowing ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-300 mb-3 line-clamp-2">{strategy.description}</p>

                    {/* Performance */}
                    <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-slate-600">
                      <div>
                        <p className="text-xs text-slate-400">Win Rate</p>
                        <p className="text-sm font-semibold text-green-400">{strategy.performance.winRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Sharpe</p>
                        <p className="text-sm font-semibold text-blue-400">{strategy.performance.sharpeRatio}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Return</p>
                        <p className="text-sm font-semibold text-purple-400">+{strategy.performance.totalReturn}%</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-white">{strategy.rating}</span>
                        <span className="text-xs text-slate-400">({strategy.reviews})</span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Download className="w-4 h-4" />
                          <span>{strategy.downloads}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{strategy.followers}</span>
                        </div>
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {strategy.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-1 bg-slate-600/50 rounded text-xs text-slate-300"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-white text-sm font-medium transition-all">
                        {strategy.isPremium ? `$${strategy.price}` : 'Free'}
                      </button>
                      <button
                        onClick={() => handleShare(strategy.id)}
                        className="p-2 bg-slate-600/50 hover:bg-slate-600 rounded-lg transition-colors"
                        title="Share strategy"
                      >
                        <Share2 className="w-4 h-4 text-slate-300" />
                      </button>
                      <button
                        className="p-2 bg-slate-600/50 hover:bg-slate-600 rounded-lg transition-colors"
                        title="View details"
                      >
                        <MessageCircle className="w-4 h-4 text-slate-300" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span>Top Strategies Leaderboard</span>
                </h3>
                <div className="space-y-3">
                  {leaderboardData.map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex items-center space-x-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' :
                        entry.rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                        entry.rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{entry.name}</h4>
                        <p className="text-sm text-slate-400">by {entry.author}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-400">{entry.score.toLocaleString()}</p>
                        <p className={`text-xs ${entry.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.change}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* My Strategies / Following Tabs */}
          {(activeTab === 'my-strategies' || activeTab === 'following') && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {activeTab === 'my-strategies' ? 'No Strategies Published' : 'Not Following Anyone'}
              </h3>
              <p className="text-slate-400 mb-6">
                {activeTab === 'my-strategies'
                  ? 'Start sharing your strategies with the community'
                  : 'Follow strategy creators to stay updated'}
              </p>
              <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-white font-medium transition-all">
                {activeTab === 'my-strategies' ? 'Publish Strategy' : 'Browse Strategies'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
