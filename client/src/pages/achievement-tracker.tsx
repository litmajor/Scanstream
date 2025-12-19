import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Trophy, Star, Lock, Unlock, Filter, Search, ChevronDown, ArrowLeft,
  Zap, Target, Heart, TrendingUp, Award, Shield, Flame, Crown, Users,
  BarChart3, Rocket, Medal, Sparkles, Calendar, Percent, Clock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
  category: 'milestone' | 'combat' | 'strategy' | 'evolution' | 'special';
  progress: number; // 0-100
  target: number; // e.g., 100 wins = 100
  unlockedAt?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  reward: {
    xp: number;
    skillBonus?: string;
  };
}

interface AchievementStats {
  total: number;
  unlocked: number;
  locked: number;
  completion: number; // 0-100
  totalXpEarned: number;
}

// Achievement definitions
const ACHIEVEMENT_DATABASE: Achievement[] = [
  // Milestone Achievements
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Execute your first winning trade',
    icon: '⚔️',
    tier: 'bronze',
    category: 'milestone',
    progress: 100,
    target: 1,
    unlockedAt: '2024-01-15',
    rarity: 'common',
    reward: { xp: 100 }
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Achieve 100 total trades',
    icon: '💯',
    tier: 'silver',
    category: 'milestone',
    progress: 65,
    target: 100,
    rarity: 'uncommon',
    reward: { xp: 500 }
  },
  {
    id: 'thousand-trades',
    name: 'Thousand Trader',
    description: 'Complete 1,000 total trades',
    icon: '🎰',
    tier: 'gold',
    category: 'milestone',
    progress: 23,
    target: 1000,
    rarity: 'rare',
    reward: { xp: 5000 }
  },
  {
    id: 'level-50',
    name: 'Max Level',
    description: 'Reach level 50 (Agent mastery)',
    icon: '👑',
    tier: 'diamond',
    category: 'evolution',
    progress: 78,
    target: 50,
    rarity: 'epic',
    reward: { xp: 10000, skillBonus: 'All +5' }
  },

  // Combat Achievements
  {
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Win 10 trades in a row',
    icon: '🔥',
    tier: 'silver',
    category: 'combat',
    progress: 100,
    target: 10,
    unlockedAt: '2024-02-20',
    rarity: 'uncommon',
    reward: { xp: 750 }
  },
  {
    id: 'win-rate-champion',
    name: 'Win Rate Champion',
    description: 'Maintain 75%+ win rate for 50 trades',
    icon: '🏆',
    tier: 'gold',
    category: 'combat',
    progress: 92,
    target: 100,
    rarity: 'rare',
    reward: { xp: 2500 }
  },
  {
    id: 'profit-factory',
    name: 'Profit Factory',
    description: 'Achieve 2.0+ profit factor',
    icon: '💰',
    tier: 'platinum',
    category: 'combat',
    progress: 100,
    target: 100,
    unlockedAt: '2024-03-10',
    rarity: 'epic',
    reward: { xp: 5000 }
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Win 25 consecutive trades',
    icon: '⚡',
    tier: 'master',
    category: 'combat',
    progress: 44,
    target: 25,
    rarity: 'legendary',
    reward: { xp: 25000 }
  },

  // Strategy Achievements
  {
    id: 'risk-manager',
    name: 'Risk Manager',
    description: 'Keep max drawdown under 20%',
    icon: '🛡️',
    tier: 'silver',
    category: 'strategy',
    progress: 100,
    target: 100,
    unlockedAt: '2024-01-20',
    rarity: 'uncommon',
    reward: { xp: 600 }
  },
  {
    id: 'sharpe-master',
    name: 'Sharpe Master',
    description: 'Achieve Sharpe ratio of 2.5+',
    icon: '📊',
    tier: 'gold',
    category: 'strategy',
    progress: 88,
    target: 100,
    rarity: 'rare',
    reward: { xp: 3000 }
  },
  {
    id: 'portfolio-optimizer',
    name: 'Portfolio Optimizer',
    description: 'Successfully execute 50 multi-agent trades',
    icon: '🎯',
    tier: 'platinum',
    category: 'strategy',
    progress: 56,
    target: 50,
    rarity: 'epic',
    reward: { xp: 4000, skillBonus: 'Timing +3' }
  },
  {
    id: 'market-sage',
    name: 'Market Sage',
    description: 'Predict market direction correctly 80+ times',
    icon: '🔮',
    tier: 'diamond',
    category: 'strategy',
    progress: 68,
    target: 80,
    rarity: 'epic',
    reward: { xp: 6000 }
  },

  // Evolution Achievements
  {
    id: 'skill-master',
    name: 'Skill Master',
    description: 'Upgrade all skills to level 10',
    icon: '⭐',
    tier: 'gold',
    category: 'evolution',
    progress: 45,
    target: 5,
    rarity: 'rare',
    reward: { xp: 3500, skillBonus: 'All +2' }
  },
  {
    id: 'achievement-collector',
    name: 'Achievement Collector',
    description: 'Unlock 15 different achievements',
    icon: '🏅',
    tier: 'silver',
    category: 'evolution',
    progress: 100,
    target: 15,
    unlockedAt: '2024-03-05',
    rarity: 'uncommon',
    reward: { xp: 1000 }
  },
  {
    id: 'renaissance-agent',
    name: 'Renaissance Agent',
    description: 'Master all 5 skill categories equally',
    icon: '🎨',
    tier: 'platinum',
    category: 'evolution',
    progress: 72,
    target: 100,
    rarity: 'epic',
    reward: { xp: 8000, skillBonus: 'All +3' }
  },

  // Special Achievements
  {
    id: 'perfect-combo',
    name: 'Perfect Combo',
    description: 'Trigger a 3-agent combo successfully',
    icon: '✨',
    tier: 'gold',
    category: 'special',
    progress: 100,
    target: 1,
    unlockedAt: '2024-02-28',
    rarity: 'rare',
    reward: { xp: 2000 }
  },
  {
    id: 'synergy-expert',
    name: 'Synergy Expert',
    description: 'Trigger 5 different combo types',
    icon: '🔗',
    tier: 'platinum',
    category: 'special',
    progress: 60,
    target: 5,
    rarity: 'epic',
    reward: { xp: 5000 }
  },
  {
    id: 'legendary-status',
    name: 'Legendary Status',
    description: 'Reach Master rank and unlock all achievements',
    icon: '👑',
    tier: 'master',
    category: 'special',
    progress: 35,
    target: 100,
    rarity: 'legendary',
    reward: { xp: 50000, skillBonus: 'Permanent +10 All' }
  },
];

type FilterCategory = 'all' | 'milestone' | 'combat' | 'strategy' | 'evolution' | 'special';
type FilterStatus = 'all' | 'unlocked' | 'locked';

const AchievementTracker: React.FC = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate stats
  const stats: AchievementStats = useMemo(() => {
    const total = ACHIEVEMENT_DATABASE.length;
    const unlocked = ACHIEVEMENT_DATABASE.filter(a => a.unlockedAt).length;
    const totalXp = ACHIEVEMENT_DATABASE
      .filter(a => a.unlockedAt)
      .reduce((sum, a) => sum + a.reward.xp, 0);
    
    return {
      total,
      unlocked,
      locked: total - unlocked,
      completion: Math.round((unlocked / total) * 100),
      totalXpEarned: totalXp
    };
  }, []);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    return ACHIEVEMENT_DATABASE.filter(achievement => {
      // Search filter
      if (searchTerm && !achievement.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'all' && achievement.category !== filterCategory) {
        return false;
      }

      // Status filter
      if (filterStatus === 'unlocked' && !achievement.unlockedAt) {
        return false;
      }
      if (filterStatus === 'locked' && achievement.unlockedAt) {
        return false;
      }

      return true;
    });
  }, [searchTerm, filterCategory, filterStatus]);

  // Group by category
  const groupedAchievements = useMemo(() => {
    const grouped: Record<string, Achievement[]> = {};
    filteredAchievements.forEach(achievement => {
      if (!grouped[achievement.category]) {
        grouped[achievement.category] = [];
      }
      grouped[achievement.category].push(achievement);
    });
    return grouped;
  }, [filteredAchievements]);

  const tierColors: Record<string, { bg: string; text: string; border: string }> = {
    bronze: { bg: '#8B4513', text: '#D2B48C', border: '#CD7F32' },
    silver: { bg: '#708090', text: '#C0C0C0', border: '#C0C0C0' },
    gold: { bg: '#8B8000', text: '#FFD700', border: '#FFD700' },
    platinum: { bg: '#6F6F6F', text: '#E5E4E2', border: '#E5E4E2' },
    diamond: { bg: '#0B5394', text: '#B9F2FF', border: '#B9F2FF' },
    master: { bg: '#4B0082', text: '#FF00FF', border: '#FF00FF' },
  };

  const rarityColors: Record<string, string> = {
    common: '#808080',
    uncommon: '#00FF00',
    rare: '#0099FF',
    epic: '#9933FF',
    legendary: '#FFD700',
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    milestone: <Target size={20} />,
    combat: <Flame size={20} />,
    strategy: <BarChart3 size={20} />,
    evolution: <TrendingUp size={20} />,
    special: <Sparkles size={20} />,
  };

  const categoryNames: Record<string, string> = {
    milestone: 'Milestones',
    combat: 'Combat',
    strategy: 'Strategy',
    evolution: 'Evolution',
    special: 'Special',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/agent-roster')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={32} className="text-amber-400" />
            <h1 className="text-4xl font-bold text-white">Achievement Tracker</h1>
          </div>
          <p className="text-slate-400 text-lg">Unlock achievements to level up and earn rewards</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-300 text-sm font-semibold mb-1">Total</div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>

          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <div className="text-green-300 text-sm font-semibold mb-1">Unlocked</div>
            <div className="text-3xl font-bold text-white">{stats.unlocked}</div>
          </div>

          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="text-red-300 text-sm font-semibold mb-1">Locked</div>
            <div className="text-3xl font-bold text-white">{stats.locked}</div>
          </div>

          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <div className="text-purple-300 text-sm font-semibold mb-1">Completion</div>
            <div className="text-3xl font-bold text-white">{stats.completion}%</div>
          </div>

          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <div className="text-amber-300 text-sm font-semibold mb-1">XP Earned</div>
            <div className="text-2xl font-bold text-white">{stats.totalXpEarned.toLocaleString()}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white">Overall Progress</h2>
            <span className="text-2xl font-bold text-white">{stats.completion}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-all duration-500"
              style={{ width: `${stats.completion}%` }}
            />
          </div>
          <div className="mt-3 text-slate-400 text-sm">
            {stats.unlocked} of {stats.total} achievements unlocked
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search achievements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="all">All Categories</option>
                <option value="milestone">Milestones</option>
                <option value="combat">Combat</option>
                <option value="strategy">Strategy</option>
                <option value="evolution">Evolution</option>
                <option value="special">Special</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="all">All Status</option>
                <option value="unlocked">Unlocked</option>
                <option value="locked">Locked</option>
              </select>
            </div>
          </div>
        </div>

        {/* Achievements by Category */}
        <div className="space-y-8">
          {Object.entries(groupedAchievements).length > 0 ? (
            Object.entries(groupedAchievements).map(([category, achievements]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-blue-400">{categoryIcons[category as keyof typeof categoryIcons]}</div>
                  <h2 className="text-2xl font-bold text-white">{categoryNames[category as keyof typeof categoryNames]}</h2>
                  <span className="text-slate-400">({achievements.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {achievements.map((achievement) => {
                    const tierStyle = tierColors[achievement.tier];
                    const isUnlocked = !!achievement.unlockedAt;

                    return (
                      <div
                        key={achievement.id}
                        className={`relative rounded-lg border-2 p-4 transition-all duration-300 cursor-pointer ${
                          isUnlocked 
                            ? 'bg-slate-700/50 hover:bg-slate-700/70' 
                            : 'bg-slate-800/50 hover:bg-slate-800/70 opacity-75'
                        }`}
                        style={{
                          borderColor: isUnlocked ? tierStyle.border : '#444',
                        }}
                        onClick={() => setExpandedId(expandedId === achievement.id ? null : achievement.id)}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-4xl">{achievement.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-white truncate">{achievement.name}</h3>
                                {isUnlocked ? (
                                  <Unlock size={16} className="text-green-400 flex-shrink-0" />
                                ) : (
                                  <Lock size={16} className="text-slate-500 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ 
                                    backgroundColor: tierStyle.bg,
                                    color: tierStyle.text,
                                    border: `1px solid ${tierStyle.border}`
                                  }}
                                >
                                  {achievement.tier.toUpperCase()}
                                </div>
                                <div 
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ color: rarityColors[achievement.rarity] }}
                                >
                                  {achievement.rarity.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">{achievement.progress}/{achievement.target}</span>
                            <span className="text-white font-semibold">{Math.round((achievement.progress / achievement.target) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-slate-300 text-sm mb-3">{achievement.description}</p>

                        {/* Reward */}
                        <div className="bg-slate-700/30 rounded p-2 mb-3 text-xs">
                          <div className="flex items-center gap-2 text-amber-400">
                            <Zap size={14} />
                            <span className="font-semibold">{achievement.reward.xp} XP</span>
                          </div>
                          {achievement.reward.skillBonus && (
                            <div className="flex items-center gap-2 text-blue-400 mt-1">
                              <Star size={14} />
                              <span className="font-semibold">Bonus: {achievement.reward.skillBonus}</span>
                            </div>
                          )}
                        </div>

                        {/* Unlock Date */}
                        {isUnlocked && achievement.unlockedAt && (
                          <div className="text-slate-400 text-xs flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </div>
                        )}

                        {/* Expand Button */}
                        {expandedId === achievement.id && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="text-xs text-slate-400 space-y-2">
                              <div><strong>ID:</strong> {achievement.id}</div>
                              <div><strong>Category:</strong> {achievement.category}</div>
                              <div><strong>Tier:</strong> {achievement.tier}</div>
                              <div><strong>Status:</strong> {isUnlocked ? '✅ Unlocked' : '🔒 Locked'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Trophy size={48} className="mx-auto mb-4 text-slate-500 opacity-50" />
              <p className="text-slate-400 text-lg">No achievements found matching your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementTracker;
