/**
 * Commander Approval System
 * Core system for managing commander (overseer) approvals of agent decisions
 *
 * Implements the hybrid autonomy model:
 * - 90% of execution: agents trade autonomously
 * - 10% that matters: commander approves key decisions
 */

import { EventEmitter } from 'events';

// ============================================
// TYPES & INTERFACES
// ============================================

export type DecisionType =
  | 'TRADE_EXECUTION'
  | 'SPAWN_NEW_AGENT'
  | 'RETIRE_AGENT'
  | 'EVOLVE_AGENT'
  | 'HIBERNATION_REQUEST'
  | 'CAPITAL_REALLOCATION'
  | 'STRATEGY_CHANGE'
  | 'MARKET_EXPANSION';

export type ApprovalStatus =
  | 'AUTO_APPROVED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'MODIFIED';

export type AlertType =
  | 'DRAWDOWN_THRESHOLD_EXCEEDED'
  | 'AGENT_ANOMALY_DETECTED'
  | 'CONFLICT_BETWEEN_AGENTS'
  | 'SYSTEM_BEHAVIOR_ANOMALY'
  | 'CAPITAL_LIMIT_APPROACHING';

export type AutonomyLevel = 'FULL' | 'COMMANDER_REVIEW' | 'NONE';

export type CommanderAction =
  | 'APPROVE'
  | 'REJECT'
  | 'MODIFY'
  | 'LEARN_FROM_DECISION';

export interface AutonomyConfig {
  tradeExecution: {
    autonomy: AutonomyLevel;
    threshold: number;                 // Minimum confidence to trade
    maxPosition: number;                // Max position size
    dailyMaxLoss: number;               // Daily loss limit
  };
  agentProposal: {
    autonomy: AutonomyLevel;
    notification: 'DAILY_BRIEF' | 'ALERT';
    timeWindow: string;                 // Hours to decide (e.g., "48 hours")
    autoExecuteIfExpired: boolean;
  };
  strategyChange: {
    autonomy: AutonomyLevel;
    notification: 'DAILY_BRIEF' | 'ALERT';
    timeWindow: string;
    autoExecuteIfExpired: boolean;
  };
  emergencyResponse: {
    autonomy: AutonomyLevel;
    drawdownLimit: number;              // e.g., -8.0 for -8%
    conflictResolution: 'ESCALATE' | 'AUTO_RESOLVE';
    anomalyResponse: 'ALERT' | 'AUTO_PAUSE';
  };
}

export interface DecisionProposal {
  id: string;
  type: DecisionType;
  proposedAt: Date;
  proposedBy: string;                   // Agent name
  content: any;                         // Varies by type
  confidence: number;                   // 0-1
  expectedImpact: {
    pnl?: number;
    riskLevel?: string;
    capital?: number;
  };
  autonomyCheck: {
    required: AutonomyLevel;
    approved: boolean;
    reason?: string;
  };
  commanderReview?: {
    status: ApprovalStatus;
    decision: CommanderAction;
    decidedAt?: Date;
    notes?: string;
    modifiedParameters?: any;
  };
  outcome?: {
    pnl: number;
    trades: number;
    winRate: number;
    status: 'SUCCESS' | 'LEARNING' | 'FAILURE';
  };
}

export interface AlertNotification {
  id: string;
  type: AlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: Date;
  message: string;
  details: any;
  suggestedActions: string[];
  commanderResponse?: {
    action: string;
    decidedAt: Date;
    reason?: string;
  };
}

export interface DailyBriefing {
  date: Date;
  summary: {
    pnl: number;
    trades: number;
    winRate: number;
    agents: { active: number; hibernating: number };
  };
  activityFeed: Array<{
    time: string;
    agent: string;
    action: string;
    size?: string;
    reason?: string;
  }>;
  agentHealth: Record<string, { score: number; confidence: number }>;
  pendingApprovals: DecisionProposal[];
  emergentPatterns?: string[];
}

// ============================================
// COMMANDER APPROVAL SYSTEM
// ============================================

export class CommanderApprovalSystem extends EventEmitter {
  private decisions: Map<string, DecisionProposal> = new Map();
  private alerts: Map<string, AlertNotification> = new Map();
  private autonomyConfig: AutonomyConfig;
  private decisionHistory: DecisionProposal[] = [];
  private dailyStats: Map<string, any> = new Map();

  constructor(autonomyConfig?: Partial<AutonomyConfig>) {
    super();

    // Default: Hybrid model (recommended)
    this.autonomyConfig = {
      tradeExecution: {
        autonomy: 'FULL',
        threshold: 0.6,
        maxPosition: 2000,
        dailyMaxLoss: -5000
      },
      agentProposal: {
        autonomy: 'COMMANDER_REVIEW',
        notification: 'DAILY_BRIEF',
        timeWindow: '48 hours',
        autoExecuteIfExpired: false
      },
      strategyChange: {
        autonomy: 'COMMANDER_REVIEW',
        notification: 'ALERT',
        timeWindow: '24 hours',
        autoExecuteIfExpired: false
      },
      emergencyResponse: {
        autonomy: 'FULL',
        drawdownLimit: -8.0,
        conflictResolution: 'ESCALATE',
        anomalyResponse: 'ALERT'
      },
      ...autonomyConfig
    };
  }

  /**
   * Propose a decision (from agent)
   * Returns whether it's auto-approved or needs commander review
   */
  proposeDecision(proposal: Omit<DecisionProposal, 'id' | 'autonomyCheck' | 'proposedAt'>): DecisionProposal {
    const id = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const proposedAt = new Date();

    // Check autonomy level for this decision type
    const autonomyCheck = this.checkAutonomy(proposal.type, proposal.confidence);

    const decision: DecisionProposal = {
      id,
      proposedAt,
      autonomyCheck,
      ...proposal
    };

    this.decisions.set(id, decision);

    if (autonomyCheck.approved) {
      // Auto-approve and execute
      decision.commanderReview = {
        status: 'AUTO_APPROVED',
        decision: 'APPROVE',
        decidedAt: new Date()
      };
      this.emit('decision:auto-approved', decision);
    } else {
      // Queue for commander review
      this.emit('decision:pending-review', decision);
    }

    return decision;
  }

  /**
   * Commander approves/rejects/modifies a decision
   */
  reviewDecision(
    decisionId: string,
    action: CommanderAction,
    notes?: string,
    modifiedParameters?: any
  ): DecisionProposal | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    const decidedAt = new Date();

    if (action === 'APPROVE') {
      decision.commanderReview = {
        status: 'APPROVED',
        decision: 'APPROVE',
        decidedAt,
        notes
      };
      this.emit('decision:approved', decision);
    } else if (action === 'REJECT') {
      decision.commanderReview = {
        status: 'REJECTED',
        decision: 'REJECT',
        decidedAt,
        notes
      };
      this.emit('decision:rejected', decision);
    } else if (action === 'MODIFY') {
      decision.commanderReview = {
        status: 'MODIFIED',
        decision: 'MODIFY',
        decidedAt,
        notes,
        modifiedParameters
      };
      this.emit('decision:modified', decision);
    } else if (action === 'LEARN_FROM_DECISION') {
      // System learns from commander's pattern
      this.emit('decision:learn', decision);
    }

    // Record in history
    this.decisionHistory.push(decision);

    return decision;
  }

  /**
   * Create an alert for commander
   */
  createAlert(
    type: AlertType,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    message: string,
    details: any,
    suggestedActions: string[]
  ): AlertNotification {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const alert: AlertNotification = {
      id,
      type,
      severity,
      createdAt: new Date(),
      message,
      details,
      suggestedActions
    };

    this.alerts.set(id, alert);
    this.emit('alert:created', alert);

    return alert;
  }

  /**
   * Commander responds to alert
   */
  respondToAlert(alertId: string, action: string, reason?: string): AlertNotification | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.commanderResponse = {
      action,
      decidedAt: new Date(),
      reason
    };

    this.emit('alert:responded', alert);
    return alert;
  }

  /**
   * Check if decision should be auto-approved based on autonomy config
   */
  private checkAutonomy(type: DecisionType, confidence: number): { required: AutonomyLevel; approved: boolean; reason?: string } {
    switch (type) {
      case 'TRADE_EXECUTION':
        if (this.autonomyConfig.tradeExecution.autonomy === 'FULL' && confidence >= this.autonomyConfig.tradeExecution.threshold) {
          return { required: 'FULL', approved: true };
        }
        return { required: 'FULL', approved: false, reason: 'Confidence below threshold or manual approval required' };

      case 'SPAWN_NEW_AGENT':
      case 'RETIRE_AGENT':
      case 'EVOLVE_AGENT':
      case 'HIBERNATION_REQUEST':
      case 'CAPITAL_REALLOCATION':
      case 'STRATEGY_CHANGE':
      case 'MARKET_EXPANSION':
        if (this.autonomyConfig.agentProposal.autonomy === 'FULL') {
          return { required: 'FULL', approved: true };
        }
        return { required: 'COMMANDER_REVIEW', approved: false, reason: 'Requires commander review' };

      default:
        return { required: 'NONE', approved: false };
    }
  }

  /**
   * Get pending decisions
   */
  getPendingDecisions(): DecisionProposal[] {
    return Array.from(this.decisions.values()).filter(d => !d.commanderReview);
  }

  /**
   * Get decision history
   */
  getDecisionHistory(limit: number = 50): DecisionProposal[] {
    return this.decisionHistory.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertNotification[] {
    return Array.from(this.alerts.values()).filter(a => !a.commanderResponse);
  }

  /**
   * Update autonomy config
   */
  updateAutonomyConfig(updates: Partial<AutonomyConfig>): void {
    this.autonomyConfig = {
      ...this.autonomyConfig,
      ...updates
    };
    this.emit('autonomy:updated', this.autonomyConfig);
  }

  /**
   * Get current autonomy config
   */
  getAutonomyConfig(): AutonomyConfig {
    return this.autonomyConfig;
  }

  /**
   * Record daily statistics for briefing
   */
  recordDailyStats(date: Date, stats: any): void {
    const dateKey = date.toISOString().split('T')[0];
    this.dailyStats.set(dateKey, stats);
  }

  /**
   * Get daily statistics
   */
  getDailyStats(date: Date): any {
    const dateKey = date.toISOString().split('T')[0];
    return this.dailyStats.get(dateKey);
  }

  /**
   * Get a specific decision
   */
  getDecision(id: string): DecisionProposal | undefined {
    return this.decisions.get(id);
  }

  /**
   * Get a specific alert
   */
  getAlert(id: string): AlertNotification | undefined {
    return this.alerts.get(id);
  }

  /**
   * Set autonomy to FULL (hands-off mode)
   */
  setFullAutonomy(): void {
    this.updateAutonomyConfig({
      tradeExecution: { ...this.autonomyConfig.tradeExecution, autonomy: 'FULL' },
      agentProposal: { ...this.autonomyConfig.agentProposal, autonomy: 'FULL' },
      strategyChange: { ...this.autonomyConfig.strategyChange, autonomy: 'FULL' },
      emergencyResponse: { ...this.autonomyConfig.emergencyResponse, autonomy: 'FULL' }
    });
    this.emit('mode:changed', 'FULL_AUTONOMY');
  }

  /**
   * Set autonomy to NONE (hands-on mode)
   */
  setFullManualControl(): void {
    this.updateAutonomyConfig({
      tradeExecution: { ...this.autonomyConfig.tradeExecution, autonomy: 'NONE' },
      agentProposal: { ...this.autonomyConfig.agentProposal, autonomy: 'NONE' },
      strategyChange: { ...this.autonomyConfig.strategyChange, autonomy: 'NONE' },
      emergencyResponse: { ...this.autonomyConfig.emergencyResponse, autonomy: 'NONE' }
    });
    this.emit('mode:changed', 'FULL_MANUAL_CONTROL');
  }

  /**
   * Set autonomy to HYBRID (default recommended)
   */
  setHybridMode(): void {
    this.updateAutonomyConfig({
      tradeExecution: { ...this.autonomyConfig.tradeExecution, autonomy: 'FULL' },
      agentProposal: { ...this.autonomyConfig.agentProposal, autonomy: 'COMMANDER_REVIEW' },
      strategyChange: { ...this.autonomyConfig.strategyChange, autonomy: 'COMMANDER_REVIEW' },
      emergencyResponse: { ...this.autonomyConfig.emergencyResponse, autonomy: 'FULL' }
    });
    this.emit('mode:changed', 'HYBRID_OPTIMAL');
  }
}
