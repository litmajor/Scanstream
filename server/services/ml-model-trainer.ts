
/**
 * ML Model Trainer Service
 * 
 * Implements real training on historical data with persistence
 */

import { storage } from '../storage';
import { MLModelStorage } from './ml-model-storage';

interface TrainingConfig {
  symbol: string;
  lookbackDays: number;
  validationSplit: number;
  epochs: number;
}

interface TrainingMetrics {
  trainLoss: number;
  valLoss: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

interface TrainedWeights {
  direction: number[];
  price: number[];
  volatility: number[];
  risk: number[];
}

export class MLModelTrainer {
  private learningRate = 0.001;
  private batchSize = 32;

  /**
   * Train models on historical market data
   */
  async trainModels(config: TrainingConfig): Promise<{
    weights: TrainedWeights;
    metrics: TrainingMetrics;
  }> {
    console.log(`[ML Trainer] Starting training for ${config.symbol}`);

    // 1. Fetch historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - config.lookbackDays);

    const frames = await storage.getMarketFrames(
      config.symbol,
      config.lookbackDays * 24 // Assuming hourly data
    );

    if (frames.length < 100) {
      throw new Error(`Insufficient data: ${frames.length} frames (minimum 100 required)`);
    }

    console.log(`[ML Trainer] Loaded ${frames.length} historical frames`);

    // 2. Prepare training data
    const { features, labels } = this.prepareTrainingData(frames);
    const splitIdx = Math.floor(features.length * (1 - config.validationSplit));
    
    const trainFeatures = features.slice(0, splitIdx);
    const trainLabels = labels.slice(0, splitIdx);
    const valFeatures = features.slice(splitIdx);
    const valLabels = labels.slice(splitIdx);

    console.log(`[ML Trainer] Training: ${trainFeatures.length}, Validation: ${valFeatures.length}`);

    // 3. Train direction classifier
    const directionWeights = this.trainBinaryClassifier(
      trainFeatures,
      trainLabels.direction,
      valFeatures,
      valLabels.direction,
      config.epochs
    );

    // 4. Train price predictor
    const priceWeights = this.trainRegressor(
      trainFeatures,
      trainLabels.price,
      valFeatures,
      valLabels.price,
      config.epochs
    );

    // 5. Train volatility predictor
    const volatilityWeights = this.trainRegressor(
      trainFeatures,
      trainLabels.volatility,
      valFeatures,
      valLabels.volatility,
      config.epochs
    );

    // 6. Train risk assessor
    const riskWeights = this.trainRegressor(
      trainFeatures,
      trainLabels.risk,
      valFeatures,
      valLabels.risk,
      config.epochs
    );

    // 7. Calculate final metrics
    const metrics = this.calculateMetrics(
      valFeatures,
      valLabels,
      { direction: directionWeights, price: priceWeights, volatility: volatilityWeights, risk: riskWeights }
    );

    // 8. Save trained weights
    const weights = {
      direction: directionWeights,
      price: priceWeights,
      volatility: volatilityWeights,
      risk: riskWeights
    };

    await MLModelStorage.saveWeights(weights, {
      version: '1.0',
      trainedAt: new Date().toISOString(),
      dataPoints: frames.length,
      accuracy: metrics.accuracy
    });

    console.log(`[ML Trainer] Training complete. Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);

    return { weights, metrics };
  }

  /**
   * Prepare training data from market frames
   */
  private prepareTrainingData(frames: any[]) {
    const features: number[][] = [];
    const labels = {
      direction: [] as number[],
      price: [] as number[],
      volatility: [] as number[],
      risk: [] as number[]
    };

    for (let i = 20; i < frames.length - 1; i++) {
      const frame = frames[i];
      const nextFrame = frames[i + 1];

      // Extract features (same as MLPredictionService)
      const f = this.extractFeatures(frames, i);
      features.push(f);

      // Direction label (1 = bullish, 0 = bearish)
      const priceChange = (nextFrame.price.close - frame.price.close) / frame.price.close;
      labels.direction.push(priceChange > 0 ? 1 : 0);

      // Price label
      labels.price.push(nextFrame.price.close);

      // Volatility label
      const recentPrices = frames.slice(Math.max(0, i - 10), i + 1).map(f => f.price.close);
      const volatility = this.calculateStdDev(recentPrices) / frame.price.close;
      labels.volatility.push(volatility);

      // Risk label (based on actual future volatility)
      const futureVol = this.calculateStdDev(
        frames.slice(i, Math.min(i + 10, frames.length)).map(f => f.price.close)
      ) / frame.price.close;
      labels.risk.push(Math.min(futureVol * 1000, 100)); // Scale to 0-100
    }

    return { features, labels };
  }

  /**
   * Extract features from a market frame
   */
  private extractFeatures(frames: any[], index: number): number[] {
    const features: number[] = [];
    const frame = frames[index];
    
    // Price features
    features.push(frame.price.close);
    for (const period of [1, 3, 5, 10]) {
      if (index >= period) {
        const prevPrice = frames[index - period].price.close;
        features.push((frame.price.close - prevPrice) / prevPrice);
      } else {
        features.push(0);
      }
    }

    // Momentum
    if (index >= 5) {
      const momentum5 = (frame.price.close - frames[index - 5].price.close) / frames[index - 5].price.close;
      features.push(momentum5);
    } else {
      features.push(0);
    }

    // RSI
    features.push((frame.indicators?.rsi || 50) / 100);

    // MACD
    features.push(frame.indicators?.macd?.macd || 0);

    // Volume ratio
    const recentVolumes = frames.slice(Math.max(0, index - 20), index + 1).map(f => f.volume);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    features.push(frame.volume / (avgVolume || 1));

    // Volatility
    const recentPrices = frames.slice(Math.max(0, index - 10), index + 1).map(f => f.price.close);
    const volatility = this.calculateStdDev(recentPrices);
    features.push(volatility / frame.price.close);

    return features;
  }

  /**
   * Train binary classifier (gradient descent)
   */
  private trainBinaryClassifier(
    trainX: number[][],
    trainY: number[],
    valX: number[][],
    valY: number[],
    epochs: number
  ): number[] {
    const numFeatures = trainX[0].length;
    let weights = Array(numFeatures).fill(0).map(() => Math.random() * 0.01 - 0.005);
    let bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      for (let i = 0; i < trainX.length; i++) {
        const x = trainX[i];
        const y = trainY[i];

        // Forward pass (sigmoid)
        const z = weights.reduce((sum, w, j) => sum + w * x[j], bias);
        const pred = 1 / (1 + Math.exp(-z));

        // Loss (binary cross-entropy)
        totalLoss += -(y * Math.log(pred + 1e-10) + (1 - y) * Math.log(1 - pred + 1e-10));

        // Backward pass
        const error = pred - y;
        for (let j = 0; j < weights.length; j++) {
          weights[j] -= this.learningRate * error * x[j];
        }
        bias -= this.learningRate * error;
      }

      if (epoch % 10 === 0) {
        const avgLoss = totalLoss / trainX.length;
        console.log(`[Classifier] Epoch ${epoch}, Loss: ${avgLoss.toFixed(4)}`);
      }
    }

    return [...weights, bias];
  }

  /**
   * Train regressor (gradient descent)
   */
  private trainRegressor(
    trainX: number[][],
    trainY: number[],
    valX: number[][],
    valY: number[],
    epochs: number
  ): number[] {
    const numFeatures = trainX[0].length;
    let weights = Array(numFeatures).fill(0).map(() => Math.random() * 0.01 - 0.005);
    let bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      for (let i = 0; i < trainX.length; i++) {
        const x = trainX[i];
        const y = trainY[i];

        // Forward pass
        const pred = weights.reduce((sum, w, j) => sum + w * x[j], bias);

        // Loss (MSE)
        const error = pred - y;
        totalLoss += error * error;

        // Backward pass
        for (let j = 0; j < weights.length; j++) {
          weights[j] -= this.learningRate * error * x[j];
        }
        bias -= this.learningRate * error;
      }

      if (epoch % 10 === 0) {
        const avgLoss = Math.sqrt(totalLoss / trainX.length);
        console.log(`[Regressor] Epoch ${epoch}, RMSE: ${avgLoss.toFixed(4)}`);
      }
    }

    return [...weights, bias];
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    features: number[][],
    labels: any,
    weights: TrainedWeights
  ): TrainingMetrics {
    let correct = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < features.length; i++) {
      const x = features[i];
      const actualDir = labels.direction[i];

      // Direction prediction
      const z = weights.direction.slice(0, -1).reduce((sum, w, j) => sum + w * x[j], weights.direction[weights.direction.length - 1]);
      const pred = 1 / (1 + Math.exp(-z));
      const predictedDir = pred > 0.5 ? 1 : 0;

      if (predictedDir === actualDir) correct++;
      if (predictedDir === 1 && actualDir === 1) truePositives++;
      if (predictedDir === 1 && actualDir === 0) falsePositives++;
      if (predictedDir === 0 && actualDir === 1) falseNegatives++;
    }

    const accuracy = correct / features.length;
    const precision = truePositives / (truePositives + falsePositives || 1);
    const recall = truePositives / (truePositives + falseNegatives || 1);
    const f1Score = 2 * (precision * recall) / (precision + recall || 1);

    return {
      trainLoss: 0,
      valLoss: 0,
      accuracy,
      precision,
      recall,
      f1Score
    };
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

export default new MLModelTrainer();
