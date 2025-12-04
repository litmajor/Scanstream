
import { db } from "../db-storage";
import { auditLogs, type InsertAuditLog } from "../../shared/schema";

type AuditAction = 
  | "SIGNAL_GENERATED" 
  | "TRADE_EXECUTED" 
  | "POSITION_CLOSED"
  | "POSITION_OPENED"
  | "STOP_LOSS_HIT"
  | "TAKE_PROFIT_HIT"
  | "MODEL_RETRAINED"
  | "STRATEGY_ACTIVATED"
  | "STRATEGY_DEACTIVATED"
  | "RISK_LIMIT_EXCEEDED"
  | "ALERT_TRIGGERED";

type EntityType = "Signal" | "Trade" | "Portfolio" | "Strategy" | "Model" | "Risk";
type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export class AuditLogger {
  /**
   * Log a system action with full context
   */
  async log(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    userId?: string;
    details: Record<string, any>;
    severity?: Severity;
  }): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        details: params.details,
        severity: params.severity || "INFO",
      };

      await db.insert(auditLogs).values(auditLog);
    } catch (error) {
      console.error("[AuditLogger] Failed to log audit entry:", error);
      // Don't throw - audit logging should never break main functionality
    }
  }

  /**
   * Log signal generation with full attribution
   */
  async logSignalGenerated(signalId: string, details: {
    symbol: string;
    type: string;
    confidence: number;
    sources: string[];
    patternDetails?: any;
    regimeState?: string;
  }): Promise<void> {
    await this.log({
      action: "SIGNAL_GENERATED",
      entityType: "Signal",
      entityId: signalId,
      details,
      severity: "INFO",
    });
  }

  /**
   * Log trade execution with signal linkage
   */
  async logTradeExecuted(tradeId: string, signalId: string, details: {
    symbol: string;
    side: string;
    entryPrice: number;
    quantity: number;
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
  }): Promise<void> {
    await this.log({
      action: "TRADE_EXECUTED",
      entityType: "Trade",
      entityId: tradeId,
      details: {
        ...details,
        signalId, // Critical: link trade back to signal
      },
      severity: "INFO",
    });
  }

  /**
   * Log position closure with P&L
   */
  async logPositionClosed(tradeId: string, details: {
    symbol: string;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    holdingPeriodHours: number;
    exitReason: string;
  }): Promise<void> {
    await this.log({
      action: "POSITION_CLOSED",
      entityType: "Trade",
      entityId: tradeId,
      details,
      severity: details.pnl < 0 ? "WARNING" : "INFO",
    });
  }

  /**
   * Log model drift detection
   */
  async logModelDrift(modelName: string, details: {
    driftScore: number;
    accuracy: number;
    dataPoints: number;
    isStale: boolean;
  }): Promise<void> {
    await this.log({
      action: "MODEL_RETRAINED",
      entityType: "Model",
      entityId: modelName,
      details,
      severity: details.isStale ? "WARNING" : "INFO",
    });
  }

  /**
   * Query audit logs by entity
   */
  async getLogsForEntity(entityType: EntityType, entityId: string, limit: number = 100) {
    return await db
      .select()
      .from(auditLogs)
      .where((logs) => 
        logs.entityType === entityType && logs.entityId === entityId
      )
      .orderBy((logs) => logs.timestamp)
      .limit(limit);
  }

  /**
   * Query recent critical events
   */
  async getCriticalEvents(hours: number = 24, limit: number = 50) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select()
      .from(auditLogs)
      .where((logs) => 
        logs.severity === "CRITICAL" || logs.severity === "ERROR"
      )
      .orderBy((logs) => logs.timestamp)
      .limit(limit);
  }
}

export const auditLogger = new AuditLogger();
