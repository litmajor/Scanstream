
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  condition: (agent: any) => boolean;
  reward: {
    experience: number;
    skillPoints?: number;
    title?: string;
  };
}

export interface AgentAchievement {
  achievementId: string;
  unlockedAt: Date;
  agentName: string;
}

export class AchievementSystem {
  private achievements: Map<string, Achievement> = new Map();
  private unlockedAchievements: Map<string, AgentAchievement[]> = new Map();

  constructor() {
    this.initializeAchievements();
  }

  private initializeAchievements(): void {
    const achievements: Achievement[] = [
      {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Win your first trade',
        icon: '⚔️',
        tier: 'bronze',
        condition: (agent) => agent.stats.totalTrades > 0 && agent.stats.wins > 0,
        reward: { experience: 100 }
      },
      {
        id: 'winning_streak',
        name: 'Hot Streak',
        description: 'Win 5 trades in a row',
        icon: '🔥',
        tier: 'silver',
        condition: (agent) => agent.stats.winStreak >= 5,
        reward: { experience: 500, skillPoints: 1 }
      },
      {
        id: 'master_trader',
        name: 'Master Trader',
        description: 'Achieve 70%+ win rate with 50+ trades',
        icon: '👑',
        tier: 'gold',
        condition: (agent) => agent.stats.winRate >= 70 && agent.stats.totalTrades >= 50,
        reward: { experience: 2000, skillPoints: 3, title: 'Master' }
      },
      {
        id: 'profit_hunter',
        name: 'Profit Hunter',
        description: 'Generate $10,000+ in profit',
        icon: '💰',
        tier: 'gold',
        condition: (agent) => agent.stats.totalProfit >= 10000,
        reward: { experience: 1500, skillPoints: 2 }
      },
      {
        id: 'combo_master',
        name: 'Combo Master',
        description: 'Trigger 10 agent combos',
        icon: '⚡',
        tier: 'platinum',
        condition: (agent) => agent.stats.combosTriggered >= 10,
        reward: { experience: 3000, skillPoints: 5 }
      },
      {
        id: 'immortal',
        name: 'Immortal',
        description: 'Reach Level 50',
        icon: '🌟',
        tier: 'diamond',
        condition: (agent) => agent.level >= 50,
        reward: { experience: 10000, skillPoints: 10, title: 'Immortal' }
      },
      {
        id: 'legend',
        name: 'Living Legend',
        description: 'Achieve 80%+ win rate with 100+ trades',
        icon: '💎',
        tier: 'diamond',
        condition: (agent) => agent.stats.winRate >= 80 && agent.stats.totalTrades >= 100,
        reward: { experience: 15000, skillPoints: 15, title: 'Legend' }
      }
    ];

    achievements.forEach(achievement => {
      this.achievements.set(achievement.id, achievement);
    });
  }

  // Check and unlock achievements for an agent
  checkAchievements(agent: any): AgentAchievement[] {
    const newlyUnlocked: AgentAchievement[] = [];
    const agentUnlocked = this.unlockedAchievements.get(agent.name) || [];

    for (const [id, achievement] of this.achievements) {
      // Skip if already unlocked
      if (agentUnlocked.some(a => a.achievementId === id)) continue;

      // Check condition
      if (achievement.condition(agent)) {
        const unlocked: AgentAchievement = {
          achievementId: id,
          unlockedAt: new Date(),
          agentName: agent.name
        };

        agentUnlocked.push(unlocked);
        newlyUnlocked.push(unlocked);

        // Apply rewards
        agent.gainExperience(achievement.reward.experience);
        if (achievement.reward.skillPoints) {
          agent.stats.skillPoints += achievement.reward.skillPoints;
        }
        if (achievement.reward.title) {
          agent.title = achievement.reward.title;
        }

        console.log(`🏆 ${agent.name} unlocked: ${achievement.icon} ${achievement.name}!`);
      }
    }

    this.unlockedAchievements.set(agent.name, agentUnlocked);
    return newlyUnlocked;
  }

  // Get all achievements for an agent
  getAgentAchievements(agentName: string): {
    unlocked: Achievement[];
    locked: Achievement[];
    progress: number;
  } {
    const unlocked = (this.unlockedAchievements.get(agentName) || [])
      .map(ua => this.achievements.get(ua.achievementId)!)
      .filter(Boolean);

    const locked = Array.from(this.achievements.values())
      .filter(a => !unlocked.some(u => u.id === a.id));

    const progress = (unlocked.length / this.achievements.size) * 100;

    return { unlocked, locked, progress };
  }

  // Get leaderboard of achievement hunters
  getAchievementLeaderboard(): { agentName: string; achievements: number; latestUnlock: Date | null }[] {
    return Array.from(this.unlockedAchievements.entries())
      .map(([agentName, achievements]) => ({
        agentName,
        achievements: achievements.length,
        latestUnlock: achievements.length > 0
          ? achievements[achievements.length - 1].unlockedAt
          : null
      }))
      .sort((a, b) => b.achievements - a.achievements);
  }

  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }
}
