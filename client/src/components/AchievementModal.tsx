import React, { useEffect } from 'react';
import { X, Trophy, Lock, Unlock, Zap, Star } from 'lucide-react';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
  category: 'milestone' | 'combat' | 'strategy' | 'evolution' | 'special';
  progress: number;
  target: number;
  unlockedAt?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  reward: {
    xp: number;
    skillBonus?: string;
  };
}

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: Achievement[];
}

const AchievementModal: React.FC<AchievementModalProps> = ({ isOpen, onClose, achievements }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const unlocked = achievements.filter(a => a.unlockedAt).length;
  const completion = Math.round((unlocked / achievements.length) * 100);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-3xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={28} className="text-amber-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Achievements</h2>
              <p className="text-slate-400 text-sm">{unlocked} of {achievements.length} unlocked</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition"
          >
            <X size={24} className="text-slate-300" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex justify-between mb-2">
            <span className="text-slate-400">Progress</span>
            <span className="text-white font-bold">{completion}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Achievement Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => {
              const tierStyle = tierColors[achievement.tier];
              const isUnlocked = !!achievement.unlockedAt;

              return (
                <div
                  key={achievement.id}
                  className={`rounded-lg border-2 p-3 transition-all ${
                    isUnlocked 
                      ? 'bg-slate-700/50' 
                      : 'bg-slate-800/50 opacity-60'
                  }`}
                  style={{
                    borderColor: isUnlocked ? tierStyle.border : '#444',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl flex-shrink-0">{achievement.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-sm truncate">{achievement.name}</h3>
                        {isUnlocked ? (
                          <Unlock size={14} className="text-green-400 flex-shrink-0" />
                        ) : (
                          <Lock size={14} className="text-slate-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mb-2">{achievement.description}</p>
                      
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-slate-500">{achievement.progress}/{achievement.target}</span>
                          <span className="text-white font-semibold">{Math.round((achievement.progress / achievement.target) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Tier and Reward */}
                      <div className="flex items-center gap-2 text-xs">
                        <div 
                          className="px-1.5 py-0.5 rounded"
                          style={{ 
                            backgroundColor: tierStyle.bg,
                            color: tierStyle.text,
                            border: `0.5px solid ${tierStyle.border}`
                          }}
                        >
                          {achievement.tier.toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1 text-amber-400">
                          <Zap size={12} />
                          {achievement.reward.xp}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementModal;
