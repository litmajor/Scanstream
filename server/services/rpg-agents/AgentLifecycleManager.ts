
import { TradingAgent } from './TradingAgent';

export type LifecycleStage = 'ROOKIE' | 'JOURNEYMAN' | 'EXPERT' | 'MASTER' | 'LEGEND';
export type AgentStatus = 'ACTIVE' | 'PROBATION' | 'HIBERNATING' | 'RETIRED';

export interface PerformanceReview {
  agent: TradingAgent;
  current_stage: LifecycleStage;
  status: AgentStatus;
  issues: string[];
  recommendations: string[];
  action_taken?: string;
}

export class AgentLifecycleManager {
  private MIN_WIN_RATE = 0.45;
  private MIN_PROFIT_FACTOR = 1.0;
  private MAX_LOSING_STREAK = 8;
  private PROBATION_DURATION_DAYS = 30;

  private probationStartDates: Map<string, Date> = new Map();
  private hibernatingAgents: Map<string, { reason: string; since: Date }> = new Map();

  /**
   * Determine agent's lifecycle stage
   */
  getLifecycleStage(agent: TradingAgent): LifecycleStage {
    if (agent.level >= 26) return 'LEGEND';
    if (agent.level >= 16) return 'MASTER';
    if (agent.level >= 6) return 'EXPERT';
    if (agent.level >= 1) return 'JOURNEYMAN';
    return 'ROOKIE';
  }

  /**
   * Review agent performance and recommend actions
   */
  reviewPerformance(agent: TradingAgent): PerformanceReview {
    const stage = this.getLifecycleStage(agent);
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: AgentStatus = 'ACTIVE';

    // Skip review for rookies (protected learning period)
    if (stage === 'ROOKIE') {
      return {
        agent,
        current_stage: stage,
        status: 'ACTIVE',
        issues: [],
        recommendations: ['Continue learning - protected period']
      };
    }

    // Check win rate
    if (agent.trades >= 20 && agent.win_rate < this.MIN_WIN_RATE) {
      issues.push(`Win rate ${(agent.win_rate * 100).toFixed(1)}% below threshold ${(this.MIN_WIN_RATE * 100).toFixed(0)}%`);
    }

    // Check profit factor
    if (agent.trades >= 20 && agent.profit_factor < this.MIN_PROFIT_FACTOR) {
      issues.push(`Profit factor ${agent.profit_factor.toFixed(2)} below threshold ${this.MIN_PROFIT_FACTOR}`);
    }

    // Check losing streak
    if (agent.losing_streak >= this.MAX_LOSING_STREAK) {
      issues.push(`Losing streak: ${agent.losing_streak} trades`);
    }

    // Check if already on probation
    const probationStart = this.probationStartDates.get(agent.name);
    if (probationStart) {
      const daysSinceProbation = (Date.now() - probationStart.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceProbation >= this.PROBATION_DURATION_DAYS) {
        // Probation period ended - evaluate
        if (issues.length === 0) {
          recommendations.push('Probation successful - restore full status');
          this.probationStartDates.delete(agent.name);
          status = 'ACTIVE';
        } else {
          recommendations.push('Probation failed - recommend hibernation or retirement');
          status = 'PROBATION';
        }
      } else {
        status = 'PROBATION';
        recommendations.push(`Continue probation (${Math.floor(daysSinceProbation)}/${this.PROBATION_DURATION_DAYS} days)`);
      }
    } else if (issues.length > 0) {
      // New performance issues detected
      if (issues.length >= 2) {
        recommendations.push('PROBATION recommended - reduce position sizes 50%');
        status = 'PROBATION';
      } else {
        recommendations.push('Monitor closely - 1 performance issue detected');
      }
    }

    // Check for hibernation candidates
    if (this.hibernatingAgents.has(agent.name)) {
      status = 'HIBERNATING';
      recommendations.push('Agent in hibernation - waiting for favorable market conditions');
    }

    return {
      agent,
      current_stage: stage,
      status,
      issues,
      recommendations
    };
  }

  /**
   * Put agent on probation
   */
  putOnProbation(agentName: string): void {
    this.probationStartDates.set(agentName, new Date());
    console.log(`⚠️ ${agentName} placed on PROBATION - 30 day evaluation period`);
  }

  /**
   * Hibernate an agent
   */
  hibernateAgent(agentName: string, reason: string): void {
    this.hibernatingAgents.set(agentName, {
      reason,
      since: new Date()
    });
    console.log(`💤 ${agentName} HIBERNATED - ${reason}`);
  }

  /**
   * Wake up a hibernating agent
   */
  wakeAgent(agentName: string): void {
    this.hibernatingAgents.delete(agentName);
    console.log(`🌅 ${agentName} AWAKENED from hibernation`);
  }

  /**
   * Check if agent should be awakened based on market conditions
   */
  checkWakeupConditions(agentName: string, marketRegime: string): boolean {
    const hibernationData = this.hibernatingAgents.get(agentName);
    if (!hibernationData) return false;

    // Example: Wake REVERSAL agents during SIDEWAYS markets
    if (agentName.includes('REVERSAL') && marketRegime === 'SIDEWAYS') {
      return true;
    }

    // Example: Wake BREAKOUT agents during TRENDING markets
    if (agentName.includes('BREAKOUT') && marketRegime.includes('TRENDING')) {
      return true;
    }

    return false;
  }

  /**
   * Get all agents on probation
   */
  getProbationAgents(): string[] {
    return Array.from(this.probationStartDates.keys());
  }

  /**
   * Get all hibernating agents
   */
  getHibernatingAgents(): Map<string, { reason: string; since: Date }> {
    return this.hibernatingAgents;
  }

  /**
   * Generate performance report for all agents
   */
  generateTeamReport(agents: TradingAgent[]): {
    active: PerformanceReview[];
    probation: PerformanceReview[];
    hibernating: PerformanceReview[];
    retired: PerformanceReview[];
  } {
    const reviews = agents.map(agent => this.reviewPerformance(agent));

    return {
      active: reviews.filter(r => r.status === 'ACTIVE'),
      probation: reviews.filter(r => r.status === 'PROBATION'),
      hibernating: reviews.filter(r => r.status === 'HIBERNATING'),
      retired: reviews.filter(r => r.status === 'RETIRED')
    };
  }
}
