
import { Router } from "express";
import { auditLogger } from "../services/audit-logger";

const router = Router();

/**
 * Get audit logs for a specific entity
 */
router.get("/entity/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await auditLogger.getLogsForEntity(
      entityType as any,
      entityId,
      limit
    );

    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("[AuditLogs] Error fetching entity logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

/**
 * Get recent critical events
 */
router.get("/critical", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await auditLogger.getCriticalEvents(hours, limit);

    res.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("[AuditLogs] Error fetching critical events:", error);
    res.status(500).json({ error: "Failed to fetch critical events" });
  }
});

/**
 * Get signal attribution (trace trade back to signal)
 */
router.get("/signal-attribution/:tradeId", async (req, res) => {
  try {
    const { tradeId } = req.params;

    const tradeLogs = await auditLogger.getLogsForEntity("Trade", tradeId, 10);
    const tradeExecution = tradeLogs.find((log) => log.action === "TRADE_EXECUTED");

    if (!tradeExecution) {
      return res.status(404).json({ error: "Trade execution log not found" });
    }

    const signalId = (tradeExecution.details as any).signalId;
    const signalLogs = await auditLogger.getLogsForEntity("Signal", signalId, 1);

    res.json({
      success: true,
      tradeId,
      signalId,
      tradeDetails: tradeExecution.details,
      signalDetails: signalLogs[0]?.details,
    });
  } catch (error) {
    console.error("[AuditLogs] Error fetching signal attribution:", error);
    res.status(500).json({ error: "Failed to fetch signal attribution" });
  }
});

export default router;
