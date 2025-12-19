/**
 * Daily Briefing System
 * Generates commander briefings with activity feed, agent health, pending decisions
 */

import { PaperTradingEngine } from '../../paper-trading-engine';
import { AgentArena } from './AgentArena';

export interface BriefingActivityItem {
  time: string;
  agent: string;
  action: string;
  symbol?: string;
  size?: string;
  reason?: string;
  status: 'ACTIVE' | 'CLOSED' | 'PROPOSED';
}

export interface AgentHealthScore {
  name: string;
  level: number;
  confidence: number;
  profitFactor: number;
  winRate: number;
  score: number;  // 0-10
  trend: 'UP' | 'DOWN' | 'STABLE';
  mood: string;   // "Confident", "Cautious", etc
}

export interface BriefingPendingDecision {
  id: string;
  type: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  timeUntilExpire: string;
  impact: string;
}

export interface CommanderBriefing {
  date: Date;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  
  // Quick stats
  summary: {
    pnl: number;
    pnlPercent: number;
    trades: number;
    winRate: number;
    avgTrade: number;
    maxDrawdown: number;
  };
  
  agentsStatus: {
    active: number;
    hibernating: number;
    onProbation: number;
    total: number;
  };
  
  // Live activity (last 2 hours)
  activityFeed: BriefingActivityItem[];
  
  // Agent health
  agentHealth: AgentHealthScore[];
  
  // What needs your decision
  pendingApprovals: BriefingPendingDecision[];
  
  // Alerts
  activeAlerts: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  
  // What the system learned
  emergentPatterns?: string[];
  
  // What's next
  outlook: {
    marketTrend: string;
    recommendedFocus: string;
    riskLevel: string;
  };
}

export class DailyBriefingSystem {
  constructor(
    private arena: AgentArena,
    private tradingEngine: PaperTradingEngine
  ) {}

  /**
   * Generate daily briefing
   */
  async generateDailyBriefing(): Promise<CommanderBriefing> {
    const now = new Date();
    
    // Get trading stats
    const summary = await this.getTradingStats();
    const activityFeed = await this.getActivityFeed();
    const agentHealth = await this.getAgentHealthScores();
    const pendingApprovals = this.getPendingApprovals();
    const activeAlerts = this.getActiveAlerts();
    const emergentPatterns = this.detectEmergentPatterns();
    const outlook = this.generateOutlook();

    return {
      date: now,
      period: 'DAILY',
      summary,
      agentsStatus: this.getAgentStatus(),
      activityFeed,
      agentHealth,
      pendingApprovals,
      activeAlerts,
      emergentPatterns,
      outlook
    };
  }

  /**
   * Get trading stats for the day
   */
  private async getTradingStats(): Promise<CommanderBriefing['summary']> {
    const status = this.tradingEngine.getStatus();
    const trades = [...status.recentTrades, ...status.activeTrades];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysTrades = trades.filter((t: any) => new Date(t.entryTime).getTime() >= today.getTime());
    
    let pnl = 0;
    let wins = 0;
    
    todaysTrades.forEach((trade: any) => {
      if (trade.exitTime && trade.exitPrice) {
        const tradePnL = trade.side === 'BUY' 
          ? (trade.exitPrice - trade.entryPrice) * (trade.quantity || 1)
          : (trade.entryPrice - trade.exitPrice) * (trade.quantity || 1);
        pnl += tradePnL;
        if (tradePnL > 0) wins++;
      }
    });

    const status2 = this.tradingEngine.getStatus();
    const capital = status2.balance || 10000;
    const pnlPercent = capital > 0 ? (pnl / capital) * 100 : 0;
    const winRate = todaysTrades.length > 0 ? (wins / todaysTrades.length) * 100 : 0;
    const avgTrade = todaysTrades.length > 0 ? pnl / todaysTrades.length : 0;
    const maxDrawdown = this.calculateDrawdown(todaysTrades);

    return {
      pnl,
      pnlPercent,
      trades: todaysTrades.length,
      winRate,
      avgTrade,
      maxDrawdown
    };
  }

  /**
   * Get recent activity feed
   */
  private async getActivityFeed(): Promise<BriefingActivityItem[]> {
    const status = this.tradingEngine.getStatus();
    const trades = [...status.recentTrades, ...status.activeTrades];
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const recentTrades = trades
      .filter((t: any) => new Date(t.entryTime).getTime() >= twoHoursAgo.getTime())
      .sort((a: any, b: any) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
      .slice(0, 10);

    return recentTrades.map((trade: any) => ({
      time: new Date(trade.entryTime).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      agent: trade.source || 'UNKNOWN',
      action: `${trade.side} ${trade.symbol}`,
      symbol: trade.symbol,
      size: `$${(trade.quantity || 0).toLocaleString()}`,
      reason: trade.exitReason || 'Normal signal',
      status: trade.exitTime ? 'CLOSED' : 'ACTIVE'
    }));
  }

  /**
   * Calculate agent health scores
   */
  private async getAgentHealthScores(): Promise<AgentHealthScore[]> {
    const agents = this.arena.getAllAgents();
    
    return agents.map((agent: any) => {
      const status = this.tradingEngine.getStatus();
      const allTrades = [...status.recentTrades, ...status.activeTrades];
      const agentTrades = allTrades.filter((t: any) => t.source === agent.name);
      
      let wins = 0;
      let losses = 0;
      let totalPnL = 0;

      agentTrades.forEach((trade: any) => {
        if (trade.exitTime && trade.exitPrice) {
          const tradePnL = trade.side === 'BUY'
            ? (trade.exitPrice - trade.entryPrice) * (trade.quantity || 1)
            : (trade.entryPrice - trade.exitPrice) * (trade.quantity || 1);
          totalPnL += tradePnL;
          if (tradePnL > 0) wins++;
          else losses++;
        }
      });

      const winRate = agentTrades.length > 0 ? (wins / agentTrades.length) * 100 : 0;
      const profitFactor = losses > 0 
        ? (wins * 100) / (losses * 100)
        : wins > 0 ? 999 : 0;

      // Score calculation: 0-10
      let score = 5; // baseline
      score += Math.min(winRate / 10, 3);  // Up to +3 for win rate
      score += Math.min(profitFactor / 5, 2);  // Up to +2 for profit factor
      score = Math.max(0, Math.min(10, score));

      // Determine mood
      let mood = 'Cautious';
      if (score >= 8) mood = 'Confident';
      else if (score >= 6.5) mood = 'Optimistic';
      else if (score < 4) mood = 'Struggling';

      // Trend (simplified)
      const recentTrades = agentTrades.slice(-5);
      let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
      if (recentTrades.length > 0) {
        const recentWins = recentTrades.filter((t: any) => {
          if (t.exitTime && t.exitPrice) {
            return t.side === 'BUY'
              ? t.exitPrice > t.entryPrice
              : t.entryPrice > t.exitPrice;
          }
          return false;
        }).length;
        if (recentWins > recentTrades.length * 0.6) trend = 'UP';
        else if (recentWins < recentTrades.length * 0.4) trend = 'DOWN';
      }

      return {
        name: agent.name,
        level: agent.level,
        confidence: Math.random() * 0.3 + 0.6,  // 60-90% for demo
        profitFactor,
        winRate,
        score: parseFloat(score.toFixed(1)),
        trend,
        mood
      };
    });
  }

  /**
   * Get pending approvals from approval system
   */
  private getPendingApprovals(): BriefingPendingDecision[] {
    // This connects to CommanderApprovalSystem
    // For now, return sample data
    return [
      {
        id: 'decision_001',
        type: 'SPAWN_NEW_AGENT',
        description: 'GAPFADER_ZETA: Gap-filling overnight trading (+$1,200-$1,800/month)',
        priority: 'MEDIUM',
        timeUntilExpire: '38 hours',
        impact: 'Allocate $8,000, +15% monthly potential'
      },
      {
        id: 'decision_002',
        type: 'EVOLVE_AGENT',
        description: 'Level up TrendRider (Level 5 → 6, unlock duration mastery)',
        priority: 'LOW',
        timeUntilExpire: '24 hours',
        impact: '+15% on trend trades, better exits'
      }
    ];
  }

  /**
   * Get active alerts
   */
  private getActiveAlerts(): Array<{ type: string; severity: string; message: string }> {
    // Connect to CommanderApprovalSystem.getActiveAlerts()
    return [];
  }

  /**
   * Detect emergent patterns (simplified)
   */
  private detectEmergentPatterns(): string[] {
    const patterns: string[] = [];

    // Example patterns that could be detected
    patterns.push('Gap fills in morning hours: 73% win rate, avg +$380');
    patterns.push('Volume amplification: 82% win rate, avg +$520');
    patterns.push('Support confluence combo: 81% win rate, avg +$450');

    return patterns;
  }

  /**
   * Generate market outlook
   */
  private generateOutlook(): CommanderBriefing['outlook'] {
    return {
      marketTrend: 'Strong Uptrend',
      recommendedFocus: 'Breakout trading + Trend following',
      riskLevel: 'Moderate'
    };
  }

  /**
   * Get agent status summary
   */
  private getAgentStatus(): CommanderBriefing['agentsStatus'] {
    const agents = this.arena.getAllAgents();
    const active = agents.filter((a: any) => a.status === 'ACTIVE').length;
    const hibernating = agents.filter((a: any) => a.status === 'HIBERNATING').length;
    const onProbation = agents.filter((a: any) => a.status === 'ON_PROBATION').length;

    return {
      active,
      hibernating,
      onProbation,
      total: agents.length
    };
  }

  /**
   * Calculate drawdown
   */
  private calculateDrawdown(trades: any[]): number {
    if (trades.length === 0) return 0;

    let peak = 0;
    let maxDD = 0;
    let runningPnL = 0;

    trades.forEach((trade: any) => {
      if (trade.exitTime && trade.exitPrice) {
        const tradePnL = trade.side === 'BUY'
          ? (trade.exitPrice - trade.entryPrice) * (trade.quantity || 1)
          : (trade.entryPrice - trade.exitPrice) * (trade.quantity || 1);
        runningPnL += tradePnL;

        if (runningPnL > peak) {
          peak = runningPnL;
        }

        const drawdown = peak - runningPnL;
        if (drawdown > maxDD) {
          maxDD = drawdown;
        }
      }
    });

    return maxDD;
  }
}
