
import { db } from "../db-storage";
import { modelMetrics, type InsertModelMetric } from "../../shared/schema";
import { auditLogger } from "./audit-logger";

interface PredictionResult {
  predicted: number | string;
  actual: number | string;
  timestamp: Date;
}

export class ModelDriftDetector {
  private predictionBuffers: Map<string, PredictionResult[]> = new Map();
  private readonly bufferSize = 100; // Track last 100 predictions
  private readonly driftThreshold = 0.15; // 15% degradation triggers stale flag

  /**
   * Record a model prediction for drift tracking
   */
  recordPrediction(
    modelName: string,
    predicted: number | string,
    actual: number | string
  ): void {
    const buffer = this.predictionBuffers.get(modelName) || [];
    buffer.push({
      predicted,
      actual,
      timestamp: new Date(),
    });

    // Keep only last N predictions
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    this.predictionBuffers.set(modelName, buffer);
  }

  /**
   * Calculate model performance metrics
   */
  private calculateMetrics(predictions: PredictionResult[]): {
    accuracy: number;
    precision: number;
    recall: number;
  } {
    if (predictions.length === 0) {
      return { accuracy: 0, precision: 0, recall: 0 };
    }

    // For classification tasks
    let correct = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const pred of predictions) {
      const isCorrect = pred.predicted === pred.actual;
      if (isCorrect) correct++;

      const predictedPositive = pred.predicted === 1 || pred.predicted === "BUY";
      const actualPositive = pred.actual === 1 || pred.actual === "BUY";

      if (predictedPositive && actualPositive) truePositives++;
      if (predictedPositive && !actualPositive) falsePositives++;
      if (!predictedPositive && actualPositive) falseNegatives++;
    }

    const accuracy = correct / predictions.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;

    return { accuracy, precision, recall };
  }

  /**
   * Calculate drift score (0 = no drift, 1 = complete drift)
   */
  private calculateDriftScore(
    currentAccuracy: number,
    historicalAccuracy: number
  ): number {
    if (historicalAccuracy === 0) return 0;
    const degradation = (historicalAccuracy - currentAccuracy) / historicalAccuracy;
    return Math.max(0, Math.min(1, degradation));
  }

  /**
   * Evaluate model and log metrics
   */
  async evaluateModel(modelName: string, historicalAccuracy?: number): Promise<void> {
    const predictions = this.predictionBuffers.get(modelName);
    if (!predictions || predictions.length < 10) {
      console.log(`[ModelDrift] Insufficient data for ${modelName}`);
      return;
    }

    const metrics = this.calculateMetrics(predictions);
    const baselineAccuracy = historicalAccuracy || 0.55; // Default baseline
    const driftScore = this.calculateDriftScore(metrics.accuracy, baselineAccuracy);
    const isStale = driftScore > this.driftThreshold;

    // Log to database
    const metricRecord: InsertModelMetric = {
      modelName,
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      driftScore,
      dataPoints: predictions.length,
      isStale,
    };

    await db.insert(modelMetrics).values(metricRecord);

    // Log to audit trail if model is stale
    if (isStale) {
      await auditLogger.logModelDrift(modelName, {
        driftScore,
        accuracy: metrics.accuracy,
        dataPoints: predictions.length,
        isStale,
      });

      console.warn(`⚠️ [ModelDrift] ${modelName} is stale! Accuracy: ${(metrics.accuracy * 100).toFixed(1)}% (baseline: ${(baselineAccuracy * 100).toFixed(1)}%)`);
    }
  }

  /**
   * Get latest metrics for a model
   */
  async getLatestMetrics(modelName: string, limit: number = 10) {
    return await db
      .select()
      .from(modelMetrics)
      .where((m) => m.modelName === modelName)
      .orderBy((m) => m.timestamp)
      .limit(limit);
  }

  /**
   * Check if any models are stale
   */
  async getStaleModels() {
    return await db
      .select()
      .from(modelMetrics)
      .where((m) => m.isStale === true)
      .orderBy((m) => m.timestamp);
  }

  /**
   * Clear prediction buffer for a model (after retraining)
   */
  clearBuffer(modelName: string): void {
    this.predictionBuffers.delete(modelName);
  }
}

export const modelDriftDetector = new ModelDriftDetector();
