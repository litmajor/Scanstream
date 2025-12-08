/**
 * RPG Trading Agent - Base Class
 *
 * Each agent is a specialized trader with:
 * - Identity and personality
 * - Level progression and XP
 * - Skill tree and abilities
 * - Performance tracking
 * - Mood/confidence states
 */

export type AgentType = 'BREAKOUT' | 'REVERSAL' | 'ML_PREDICTION' | 'MA_CROSSOVER' | 'SUPPORT_BOUNCE' | 'TREND_RIDER';
export type AgentPersonality = 'aggressive' | 'balanced' | 'conservative';
export type AgentMood = 'focused' | 'cautious' | 'aggressive' | 'tilted';
export type AgentRank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';

export interface AgentSkills {
  pattern_recognition: number;  // 1-10
  timing_precision: number;
  risk_management: number;
  exit_optimization: number;
  regime_awareness: number;
}

export interface TradeResult {
  profit: number;
  profit_pct: number;
  market_difficulty: number;  // 1-3x multiplier
  execution_quality: number;  // 0-1 score
  regime: string;
  duration_hours: number;
}

export interface AgentSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  target: number;
  stop: number;
  reason: string;
  agent_name: string;
  agent_level: number;
}

export interface Achievement {
  name: string;
  description: string;
  unlockedAt: Date;
  icon: string;
}

export class TradingAgent {
  // IDENTITY
  name: string;
  agent_type: AgentType;
  personality: AgentPersonality;

  // RPG STATS
  level: number = 1;
  xp: number = 0;
  xp_to_next_level: number = 1000;
  skill_points: number = 0;

  // SKILL TREE
  skills: AgentSkills = {
    pattern_recognition: 1,
    timing_precision: 1,
    risk_management: 1,
    exit_optimization: 1,
    regime_awareness: 1
  };

  // UNLOCKED ABILITIES
  abilities: string[] = ['basic_entry'];

  // PERFORMANCE TRACKING
  trades: number = 0;
  wins: number = 0;
  losses: number = 0;
  total_profit: number = 0;
  win_rate: number = 0;
  profit_factor: number = 0;
  sharpe: number = 0;
  max_drawdown: number = 0;

  // MOOD / STATE
  mood: AgentMood = 'focused';
  confidence: number = 0.5;

  // BATTLE STATS
  rank: AgentRank = 'Bronze';
  achievements: Achievement[] = [];

  // TRADE HISTORY
  recent_trades: TradeResult[] = [];
  winning_streak: number = 0;
  losing_streak: number = 0;

  // AGENT SPAWNING
  private canSpawnSubAgents: boolean = false;
  private subAgents: TradingAgent[] = [];

  constructor(name: string, agent_type: AgentType, personality: AgentPersonality) {
    this.name = name;
    this.agent_type = agent_type;
    this.personality = personality;
  }

  /**
   * Update performance after trade completion
   */
  updatePerformance(trade_result: TradeResult): void {
    this.trades += 1;
    this.recent_trades.push(trade_result);

    // Keep only last 100 trades
    if (this.recent_trades.length > 100) {
      this.recent_trades.shift();
    }

    if (trade_result.profit > 0) {
      this.wins += 1;
      this.winning_streak += 1;
      this.losing_streak = 0;

      const xp_earned = this.calculateXP(trade_result);
      this.xp += xp_earned;
      this.total_profit += trade_result.profit;

      // Mood improves on wins
      this.confidence = Math.min(1.0, this.confidence + 0.05);

      console.log(`✨ ${this.name} earned ${xp_earned} XP! (Win: +${trade_result.profit_pct.toFixed(2)}%)`);
    } else {
      this.losses += 1;
      this.losing_streak += 1;
      this.winning_streak = 0;
      this.total_profit += trade_result.profit;

      // Mood degrades on losses
      this.confidence = Math.max(0.0, this.confidence - 0.03);

      console.log(`😞 ${this.name} lost ${Math.abs(trade_result.profit_pct).toFixed(2)}%`);
    }

    // Check for level up
    if (this.xp >= this.xp_to_next_level) {
      this.levelUp();
    }

    // Update stats
    this.win_rate = this.wins / this.trades;
    this.profit_factor = this.calculateProfitFactor();
    this.sharpe = this.calculateSharpe();
    this.mood = this.updateMood();
    this.rank = this.updateRank();

    // Check for achievements
    this.checkAchievements();
  }

  /**
   * Award XP based on trade quality
   */
  private calculateXP(trade_result: TradeResult): number {
    const base_xp = 100;

    // Bonus XP multipliers
    const profit_multiplier = 1 + (trade_result.profit_pct / 5);  // +20% XP per 1% profit
    const difficulty_multiplier = trade_result.market_difficulty;  // 1-3x
    const execution_bonus = trade_result.execution_quality * 50;   // 0-50 XP

    // Winning streak bonus
    const streak_bonus = Math.min(this.winning_streak * 10, 100);

    const total_xp = base_xp * profit_multiplier * difficulty_multiplier + execution_bonus + streak_bonus;

    return Math.floor(total_xp);
  }

  /**
   * Level up and unlock new abilities
   */
  private levelUp(): void {
    this.level++;
    this.xp = this.xp - this.xp_to_next_level;
    this.xp_to_next_level = Math.floor(this.xp_to_next_level * 1.5);
    this.skill_points += 1;

    console.log(`🎉 ${this.name} LEVELED UP to Level ${this.level}!`);

    // Check for ability unlocks
    this.checkAbilityUnlocks();

    // Spawn sub-agent at level 25
    if (this.level === 25) {
      this.canSpawnSubAgents = true;
      console.log(`🌟 ${this.name} can now spawn sub-agents!`);
    }
  }

  /**
   * Unlock new abilities based on level
   */
  private checkAbilityUnlocks(): void {
    const unlocks: Record<number, string> = {
      3: 'dynamic_position_sizing',
      5: 'intelligent_exits',
      7: 'multi_timeframe_confirmation',
      10: 'regime_adaptation',
      12: 'velocity_based_targets',
      15: 'correlation_hedging',
      18: 'pattern_discovery',
      20: 'portfolio_optimization',
      25: 'strategy_creation'  // Can create new sub-agents
    };

    if (this.level in unlocks) {
      const new_ability = unlocks[this.level];
      this.abilities.push(new_ability);
      console.log(`✨ ${this.name} unlocked: ${new_ability}!`);

      // Award achievement
      this.achievements.push({
        name: `Level ${this.level} Master`,
        description: `Unlocked ${new_ability}`,
        unlockedAt: new Date(),
        icon: '🏆'
      });
    }
  }

  /**
   * Update mood based on recent performance
   */
  private updateMood(): AgentMood {
    if (this.losing_streak >= 5) return 'tilted';
    if (this.confidence > 0.7) return 'aggressive';
    if (this.confidence < 0.3) return 'cautious';
    return 'focused';
  }

  /**
   * Update rank based on overall performance
   */
  private updateRank(): AgentRank {
    if (this.sharpe > 2.5 && this.profit_factor > 3.0) return 'Master';
    if (this.sharpe > 2.0 && this.profit_factor > 2.5) return 'Diamond';
    if (this.sharpe > 1.5 && this.profit_factor > 2.0) return 'Platinum';
    if (this.sharpe > 1.0 && this.profit_factor > 1.5) return 'Gold';
    if (this.sharpe > 0.5 && this.profit_factor > 1.2) return 'Silver';
    return 'Bronze';
  }

  /**
   * Calculate profit factor
   */
  private calculateProfitFactor(): number {
    const winning_trades = this.recent_trades.filter(t => t.profit > 0);
    const losing_trades = this.recent_trades.filter(t => t.profit < 0);

    if (losing_trades.length === 0) return 999;

    const total_wins = winning_trades.reduce((sum, t) => sum + t.profit, 0);
    const total_losses = Math.abs(losing_trades.reduce((sum, t) => sum + t.profit, 0));

    return total_losses === 0 ? 999 : total_wins / total_losses;
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpe(): number {
    if (this.recent_trades.length < 10) return 0;

    const returns = this.recent_trades.map(t => t.profit_pct);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std_dev = Math.sqrt(variance);

    return std_dev === 0 ? 0 : (mean / std_dev) * Math.sqrt(252);  // Annualized
  }

  /**
   * Check for achievements
   */
  private checkAchievements(): void {
    // Winning streak achievements
    if (this.winning_streak === 5 && !this.hasAchievement('Hot Streak')) {
      this.achievements.push({
        name: 'Hot Streak',
        description: '5 wins in a row',
        unlockedAt: new Date(),
        icon: '🔥'
      });
    }

    if (this.winning_streak === 10 && !this.hasAchievement('Unstoppable')) {
      this.achievements.push({
        name: 'Unstoppable',
        description: '10 wins in a row',
        unlockedAt: new Date(),
        icon: '⚡'
      });
    }

    // Profit milestones
    if (this.total_profit > 10000 && !this.hasAchievement('Five Figures')) {
      this.achievements.push({
        name: 'Five Figures',
        description: 'Earned $10,000+',
        unlockedAt: new Date(),
        icon: '💰'
      });
    }

    // Win rate achievements
    if (this.trades >= 50 && this.win_rate > 0.65 && !this.hasAchievement('Sharpshooter')) {
      this.achievements.push({
        name: 'Sharpshooter',
        description: '65%+ win rate over 50 trades',
        unlockedAt: new Date(),
        icon: '🎯'
      });
    }
  }

  private hasAchievement(name: string): boolean {
    return this.achievements.some(a => a.name === name);
  }

  /**
   * Upgrade a skill with skill points
   */
  upgradeSkill(skill: keyof AgentSkills): boolean {
    if (this.skill_points <= 0) return false;
    if (this.skills[skill] >= 10) return false;

    this.skills[skill] += 1;
    this.skill_points -= 1;

    console.log(`📈 ${this.name} upgraded ${skill} to level ${this.skills[skill]}`);
    return true;
  }

  /**
   * Get agent status for UI display
   */
  getStatus() {
    return {
      name: this.name,
      type: this.agent_type,
      level: this.level,
      xp: this.xp,
      xp_to_next_level: this.xp_to_next_level,
      rank: this.rank,
      mood: this.mood,
      confidence: this.confidence,
      stats: {
        trades: this.trades,
        wins: this.wins,
        losses: this.losses,
        win_rate: this.win_rate,
        profit_factor: this.profit_factor,
        sharpe: this.sharpe,
        total_profit: this.total_profit
      },
      skills: this.skills,
      abilities: this.abilities,
      achievements: this.achievements,
      streaks: {
        winning: this.winning_streak,
        losing: this.losing_streak
      }
    };
  }

  /**
   * Spawn a specialized sub-agent
   */
  spawnSubAgent(specialization: string): TradingAgent | null {
    if (!this.canSpawnSubAgents || this.level < 25) {
      console.log(`❌ ${this.name} cannot spawn sub-agents yet (Level ${this.level}/25)`);
      return null;
    }

    if (this.subAgents.length >= 3) {
      console.log(`❌ ${this.name} already has maximum sub-agents (3)`);
      return null;
    }

    const subAgent = new TradingAgent(
      `${this.name}-${specialization}-${this.subAgents.length + 1}`,
      this.agent_type, // Sub-agent has the same type as parent
      this.personality // Sub-agent has the same personality as parent
    );

    // Sub-agents inherit 50% of parent's experience
    subAgent.xp = Math.floor(this.xp * 0.5);
    subAgent.level = Math.floor(this.level * 0.4); // Start at 40% of parent level

    this.subAgents.push(subAgent);

    console.log(`🎊 ${this.name} spawned ${subAgent.name} (Level ${subAgent.level})`);

    return subAgent;
  }

  getSubAgents(): TradingAgent[] {
    return this.subAgents;
  }
}