
import { Router } from "express";
import { modelDriftDetector } from "../services/model-drift-detector";

const router = Router();

/**
 * Get latest metrics for a specific model
 */
router.get("/metrics/:modelName", async (req, res) => {
  try {
    const { modelName } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const metrics = await modelDriftDetector.getLatestMetrics(modelName, limit);

    res.json({
      success: true,
      modelName,
      count: metrics.length,
      metrics,
      latestAccuracy: metrics[0]?.accuracy,
      isStale: metrics[0]?.isStale,
    });
  } catch (error) {
    console.error("[ModelDrift] Error fetching model metrics:", error);
    res.status(500).json({ error: "Failed to fetch model metrics" });
  }
});

/**
 * Get all stale models that need retraining
 */
router.get("/stale-models", async (req, res) => {
  try {
    const staleModels = await modelDriftDetector.getStaleModels();

    res.json({
      success: true,
      count: staleModels.length,
      models: staleModels,
      warning: staleModels.length > 0 
        ? `${staleModels.length} model(s) require retraining`
        : null,
    });
  } catch (error) {
    console.error("[ModelDrift] Error fetching stale models:", error);
    res.status(500).json({ error: "Failed to fetch stale models" });
  }
});

/**
 * Record a prediction for drift tracking
 */
router.post("/record-prediction", async (req, res) => {
  try {
    const { modelName, predicted, actual } = req.body;

    if (!modelName || predicted === undefined || actual === undefined) {
      return res.status(400).json({ 
        error: "Missing required fields: modelName, predicted, actual" 
      });
    }

    modelDriftDetector.recordPrediction(modelName, predicted, actual);

    res.json({
      success: true,
      message: "Prediction recorded",
    });
  } catch (error) {
    console.error("[ModelDrift] Error recording prediction:", error);
    res.status(500).json({ error: "Failed to record prediction" });
  }
});

/**
 * Trigger model evaluation
 */
router.post("/evaluate/:modelName", async (req, res) => {
  try {
    const { modelName } = req.params;
    const { historicalAccuracy } = req.body;

    await modelDriftDetector.evaluateModel(modelName, historicalAccuracy);

    const latestMetrics = await modelDriftDetector.getLatestMetrics(modelName, 1);

    res.json({
      success: true,
      modelName,
      metrics: latestMetrics[0],
    });
  } catch (error) {
    console.error("[ModelDrift] Error evaluating model:", error);
    res.status(500).json({ error: "Failed to evaluate model" });
  }
});

export default router;
