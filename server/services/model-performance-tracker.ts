/**
 * Model Performance Tracker
 * 
 * Tracks prediction accuracy, backtesting, and model performance metrics
 */

export interface PredictionRecord {
  symbol: string;
  timestamp: number;
  prediction: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    priceTarget?: number;
  };
  actual?: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    priceChange: number;
  };
  correct?: boolean;
  error?: number; // Price prediction error %
}

export interface ModelMetrics {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number; // %
  avgConfidence: number;
  winRate: number; // % of correct predictions
  avgPriceError: number; // % error in price predictions
  precision: number; // True positives / (True positives + False positives)
  recall: number; // True positives / (True positives + False negatives)
  f1Score: number;
}

export class ModelPerformanceTracker {
  private predictions: PredictionRecord[] = [];
  private readonly maxHistory = 10000;

  /**
   * Record a prediction for backtesting
   */
  recordPrediction(record: PredictionRecord) {
    this.predictions.push(record);
    
    // Keep only recent predictions
    if (this.predictions.length > this.maxHistory) {
      this.predictions = this.predictions.slice(-this.maxHistory);
    }
  }

  /**
   * Validate prediction against actual market movement
   */
  validatePrediction(
    symbol: string,
    predictedDirection: 'UP' | 'DOWN' | 'NEUTRAL',
    actualChange: number,
    predictedPrice?: number,
    actualPrice?: number
  ) {
    const actualDirection = actualChange > 0 ? 'UP' : actualChange < 0 ? 'DOWN' : 'NEUTRAL';
    const isCorrect = predictedDirection === actualDirection;
    
    const record: PredictionRecord = {
      symbol,
      timestamp: Date.now(),
      prediction: {
        direction: predictedDirection,
        confidence: 0.75, // Set during prediction
        priceTarget: predictedPrice
      },
      actual: {
        direction: actualDirection,
        priceChange: actualChange
      },
      correct: isCorrect,
      error: predictedPrice && actualPrice ? Math.abs((actualPrice - predictedPrice) / predictedPrice * 100) : 0
    };

    this.recordPrediction(record);
    return record;
  }

  /**
   * Calculate model metrics for all predictions
   */
  calculateMetrics(symbolFilter?: string): ModelMetrics {
    const records = symbolFilter 
      ? this.predictions.filter(p => p.symbol === symbolFilter)
      : this.predictions;

    if (records.length === 0) {
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        accuracy: 0,
        avgConfidence: 0,
        winRate: 0,
        avgPriceError: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };
    }

    const verified = records.filter(r => r.actual);
    const correct = verified.filter(r => r.correct).length;
    
    // Calculate precision (true positives / all predictions)
    const truePositives = verified.filter(r => r.correct && r.actual?.direction === 'UP').length;
    const falsePositives = verified.filter(r => !r.correct && r.prediction.direction === 'UP').length;
    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    
    // Calculate recall (true positives / all actual ups)
    const totalActualUps = verified.filter(r => r.actual?.direction === 'UP').length;
    const recall = totalActualUps > 0 ? truePositives / totalActualUps : 0;
    
    // F1 Score
    const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Average confidence
    const avgConfidence = records.reduce((sum, r) => sum + r.prediction.confidence, 0) / records.length;

    // Average price error
    const priceErrors = verified.filter(r => r.error).map(r => r.error || 0);
    const avgPriceError = priceErrors.length > 0 
      ? priceErrors.reduce((a, b) => a + b, 0) / priceErrors.length 
      : 0;

    return {
      totalPredictions: records.length,
      correctPredictions: correct,
      accuracy: verified.length > 0 ? (correct / verified.length) * 100 : 0,
      avgConfidence,
      winRate: verified.length > 0 ? (correct / verified.length) * 100 : 0,
      avgPriceError,
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100
    };
  }

  /**
   * Get prediction history for backtesting
   */
  getPredictionHistory(symbol?: string, limit: number = 100): PredictionRecord[] {
    const records = symbol
      ? this.predictions.filter(p => p.symbol === symbol)
      : this.predictions;

    return records.slice(-limit);
  }

  /**
   * Clear old predictions beyond a certain time
   */
  pruneOldPredictions(daysToKeep: number = 30) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    this.predictions = this.predictions.filter(p => p.timestamp > cutoffTime);
  }
}

// Global singleton
let tracker: ModelPerformanceTracker | null = null;

export function getPerformanceTracker(): ModelPerformanceTracker {
  if (!tracker) {
    tracker = new ModelPerformanceTracker();
  }
  return tracker;
}
