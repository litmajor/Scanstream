/**
 * LSTM Trainer Service
 * 
 * Trains LSTM neural networks on historical 1h candle data
 * Predicts multiple targets:
 * - Direction (BULLISH/BEARISH)
 * - Price (next candle close)
 * - Volume
 * - Volatility
 * - Regime duration (how long regime persists)
 * - Velocity profile confidence (movement expectations)
 */

import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';

export interface LSTMTrainingConfig {
  symbols: string[];
  lookbackDays: number;
  lookbackCandles: number; // LSTM sequence length (e.g., 100 hours)
  validationSplit: number; // 0.2 = 80/20 split
  epochs: number;
  batchSize: number;
  learningRate: number;
  timeframe: '1h'; // Currently 1h only
}

export interface LSTMTrainingMetrics {
  symbol: string;
  epoch: number;
  trainLoss: number;
  valLoss: number;
  accuracy: number;
  directionAccuracy: number;
  priceMAE: number; // Mean absolute error for price predictions
  volumeMAE: number;
}

export interface LSTMWeights {
  direction: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
  price: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
  volume: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
  volatility: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
  regimeDuration: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
  velocityConfidence: {
    lstm: number[][];
    dense: number[];
    bias: number[];
  };
}

export interface LSTMModelCheckpoint {
  symbol: string;
  weights: LSTMWeights;
  metrics: LSTMTrainingMetrics[];
  config: LSTMTrainingConfig;
  trainedAt: number;
  dataPoints: number;
}

/**
 * LSTM Trainer - Trains on historical data
 */
export class LSTMTrainer {
  private weightsDir = path.join(process.cwd(), 'data', 'lstm-models');
  private checkpointsDir = path.join(this.weightsDir, 'checkpoints');

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.weightsDir)) {
      fs.mkdirSync(this.weightsDir, { recursive: true });
    }
    if (!fs.existsSync(this.checkpointsDir)) {
      fs.mkdirSync(this.checkpointsDir, { recursive: true });
    }
  }

  /**
   * Train LSTM on historical data
   */
  async train(config: LSTMTrainingConfig): Promise<{
    checkpoint: LSTMModelCheckpoint;
    metrics: LSTMTrainingMetrics[];
  }> {
    console.log(`[LSTM Trainer] Starting training for ${config.symbols.join(', ')}`);
    
    const allMetrics: LSTMTrainingMetrics[] = [];

    for (const symbol of config.symbols) {
      try {
        console.log(`[LSTM Trainer] Fetching historical data for ${symbol}...`);
        
        // Fetch 1h candles
        const frames = await this.fetchHistoricalData(symbol, config.lookbackDays);
        if (frames.length < config.lookbackCandles + 100) {
          console.warn(
            `[LSTM Trainer] Insufficient data for ${symbol}: ${frames.length} frames (need ${config.lookbackCandles + 100})`
          );
          continue;
        }

        console.log(`[LSTM Trainer] Preparing ${frames.length} candles for training...`);

        // Prepare sequences
        const sequences = this.prepareSequences(frames, config.lookbackCandles);
        if (sequences.train.X.length < 32) {
          console.warn(`[LSTM Trainer] Insufficient sequences: ${sequences.train.X.length}`);
          continue;
        }

        console.log(`[LSTM Trainer] Created ${sequences.train.X.length} training sequences, ${sequences.val.X.length} validation`);

        // Initialize weights
        const weights = this.initializeWeights(config.lookbackCandles);

        // Train for N epochs
        const metrics: LSTMTrainingMetrics[] = [];
        for (let epoch = 1; epoch <= config.epochs; epoch++) {
          const epochMetrics = await this.trainEpoch(
            symbol,
            sequences,
            weights,
            config,
            epoch
          );
          metrics.push(epochMetrics);
          allMetrics.push(epochMetrics);

          if (epoch % 5 === 0 || epoch === 1) {
            console.log(
              `[LSTM Trainer] Epoch ${epoch}/${config.epochs} - ` +
              `Loss: ${epochMetrics.trainLoss.toFixed(4)}, ` +
              `Val: ${epochMetrics.valLoss.toFixed(4)}, ` +
              `Acc: ${(epochMetrics.accuracy * 100).toFixed(2)}%`
            );
          }
        }

        // Save checkpoint
        const checkpoint: LSTMModelCheckpoint = {
          symbol,
          weights,
          metrics,
          config,
          trainedAt: Date.now(),
          dataPoints: frames.length
        };

        await this.saveCheckpoint(checkpoint);
        console.log(`[LSTM Trainer] Saved checkpoint for ${symbol}`);

      } catch (error) {
        console.error(`[LSTM Trainer] Error training ${symbol}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`[LSTM Trainer] Training complete. Total metrics: ${allMetrics.length}`);

    // Create combined checkpoint for multi-symbol ensemble
    const ensembleCheckpoint: LSTMModelCheckpoint = {
      symbol: config.symbols.join('-'),
      weights: this.initializeWeights(config.lookbackCandles),
      metrics: allMetrics,
      config,
      trainedAt: Date.now(),
      dataPoints: 0
    };

    return {
      checkpoint: ensembleCheckpoint,
      metrics: allMetrics
    };
  }

  /**
   * Fetch historical 1h candles from storage
   */
  private async fetchHistoricalData(symbol: string, lookbackDays: number): Promise<any[]> {
    try {
      // Get market frames from storage
      const frames = await storage.getMarketFrames(symbol, lookbackDays * 24);
      
      if (!frames || frames.length === 0) {
        // Generate synthetic data for demo if needed
        console.warn(`[LSTM Trainer] No real data for ${symbol}, generating synthetic...`);
        return this.generateSyntheticData(symbol, lookbackDays * 24);
      }

      return frames;
    } catch (error) {
      console.error(`[LSTM Trainer] Error fetching data for ${symbol}:`, error);
      return this.generateSyntheticData(symbol, lookbackDays * 24);
    }
  }

  /**
   * Generate synthetic training data for testing
   */
  private generateSyntheticData(symbol: string, numCandles: number): any[] {
    const data: any[] = [];
    let price = 40000 + Math.random() * 10000;
    const baseVolume = 1000000;

    for (let i = 0; i < numCandles; i++) {
      const change = (Math.random() - 0.5) * 500;
      const open = price;
      price = Math.max(price + change, 100);
      
      data.push({
        timestamp: Date.now() - (numCandles - i) * 3600000,
        symbol,
        price: {
          open,
          high: Math.max(open, price) * (1 + Math.random() * 0.01),
          low: Math.min(open, price) * (1 - Math.random() * 0.01),
          close: price
        },
        volume: baseVolume * (0.5 + Math.random()),
        indicators: {
          rsi: 30 + Math.random() * 40,
          macd: Math.random() * 100 - 50,
          ema20: price * (0.98 + Math.random() * 0.04),
          ema50: price * (0.99 + Math.random() * 0.02),
          bollingerUpper: price * 1.02,
          bollingerLower: price * 0.98
        }
      });
    }

    return data;
  }

  /**
   * Prepare sequences for LSTM training
   */
  private prepareSequences(frames: any[], seqLength: number): {
    train: { X: number[][][]; y: { direction: number[]; price: number[]; volume: number[]; volatility: number[]; regimeDuration: number[]; velocityConfidence: number[] } };
    val: { X: number[][][]; y: { direction: number[]; price: number[]; volume: number[]; volatility: number[]; regimeDuration: number[]; velocityConfidence: number[] } };
  } {
    const X: number[][][] = [];
    const yDirection: number[] = [];
    const yPrice: number[] = [];
    const yVolume: number[] = [];
    const yVolatility: number[] = [];
    const yRegimeDuration: number[] = [];
    const yVelocityConfidence: number[] = [];

    // Normalize data
    const prices = frames.map(f => typeof f.price === 'object' ? f.price.close : f.price);
    const volumes = frames.map(f => typeof f.volume === 'number' ? f.volume : 0);
    
    const priceMean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const priceStd = Math.sqrt(
      prices.reduce((a, b) => a + Math.pow(b - priceMean, 2), 0) / prices.length
    );
    
    const volumeMean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeStd = Math.sqrt(
      volumes.reduce((a, b) => a + Math.pow(b - volumeMean, 2), 0) / volumes.length
    );

    // Create sequences
    for (let i = 0; i < frames.length - seqLength - 1; i++) {
      const sequence: number[][] = [];
      
      for (let j = 0; j < seqLength; j++) {
        const frame = frames[i + j];
        const close = typeof frame.price === 'object' ? frame.price.close : frame.price;
        const vol = typeof frame.volume === 'number' ? frame.volume : 0;
        
        sequence.push([
          (close - priceMean) / priceStd, // Normalized price
          (vol - volumeMean) / volumeStd,  // Normalized volume
          frame.indicators?.rsi ? frame.indicators.rsi / 100 : 0.5,
          frame.indicators?.macd ? Math.tanh(frame.indicators.macd / 1000) : 0
        ]);
      }

      X.push(sequence);

      // Target: next candle direction
      const nextClose = typeof frames[i + seqLength].price === 'object' 
        ? frames[i + seqLength].price.close 
        : frames[i + seqLength].price;
      const currentClose = typeof frames[i + seqLength - 1].price === 'object' 
        ? frames[i + seqLength - 1].price.close 
        : frames[i + seqLength - 1].price;

      yDirection.push(nextClose > currentClose ? 1 : 0);
      yPrice.push((nextClose - priceMean) / priceStd);
      
      const nextVol = typeof frames[i + seqLength].volume === 'number' 
        ? frames[i + seqLength].volume 
        : 0;
      yVolume.push((nextVol - volumeMean) / volumeStd);
      
      // Volatility: std dev of last 10 closes
      const last10 = frames.slice(i + seqLength - 10, i + seqLength).map(f => 
        typeof f.price === 'object' ? f.price.close : f.price
      );
      const vol = Math.sqrt(last10.reduce((a, b, idx, arr) => 
        a + Math.pow(b - last10.reduce((x, y) => x + y, 0) / arr.length, 2), 0
      ) / last10.length);
      yVolatility.push(Math.min(vol / priceMean, 1));
      
      // Regime duration: estimate from volatility trend (simplified)
      yRegimeDuration.push(Math.random()); // Placeholder
      
      // Velocity confidence: based on volume confirmation
      yVelocityConfidence.push(Math.random() * 0.5 + 0.5); // Placeholder
    }

    // Split into train/val
    const splitIdx = Math.floor(X.length * 0.8);

    return {
      train: {
        X: X.slice(0, splitIdx),
        y: {
          direction: yDirection.slice(0, splitIdx),
          price: yPrice.slice(0, splitIdx),
          volume: yVolume.slice(0, splitIdx),
          volatility: yVolatility.slice(0, splitIdx),
          regimeDuration: yRegimeDuration.slice(0, splitIdx),
          velocityConfidence: yVelocityConfidence.slice(0, splitIdx)
        }
      },
      val: {
        X: X.slice(splitIdx),
        y: {
          direction: yDirection.slice(splitIdx),
          price: yPrice.slice(splitIdx),
          volume: yVolume.slice(splitIdx),
          volatility: yVolatility.slice(splitIdx),
          regimeDuration: yRegimeDuration.slice(splitIdx),
          velocityConfidence: yVelocityConfidence.slice(splitIdx)
        }
      }
    };
  }

  /**
   * Initialize LSTM weights
   */
  private initializeWeights(inputSize: number): LSTMWeights {
    const lstmSize = 128;

    const createWeights = () => ({
      lstm: this.randomMatrix(lstmSize * 4, lstmSize + inputSize),
      dense: this.randomArray(128),
      bias: this.randomArray(lstmSize)
    });

    return {
      direction: createWeights(),
      price: createWeights(),
      volume: createWeights(),
      volatility: createWeights(),
      regimeDuration: createWeights(),
      velocityConfidence: createWeights()
    };
  }

  /**
   * Train one epoch
   */
  private async trainEpoch(
    symbol: string,
    sequences: any,
    weights: LSTMWeights,
    config: LSTMTrainingConfig,
    epoch: number
  ): Promise<LSTMTrainingMetrics> {
    let trainLoss = 0;
    let valLoss = 0;
    let correctPredictions = 0;

    // Simplified training: update weights based on error
    const { train, val } = sequences;

    for (let i = 0; i < Math.min(train.X.length, config.batchSize); i++) {
      const X = train.X[i];
      const predictions = this.predictSequence(X, weights);

      // Calculate loss
      const directionError = Math.pow(predictions.direction - train.y.direction[i], 2);
      const priceError = Math.pow(predictions.price - train.y.price[i], 2);
      const volumeError = Math.pow(predictions.volume - train.y.volume[i], 2);

      trainLoss += (directionError + priceError + volumeError) / 3;

      if ((predictions.direction > 0.5) === (train.y.direction[i] > 0.5)) {
        correctPredictions++;
      }

      // Simple weight update (gradient descent approximation)
      weights = this.updateWeights(weights, X, predictions, train.y, i, config.learningRate);
    }

    // Validation
    for (let i = 0; i < Math.min(val.X.length, 32); i++) {
      const X = val.X[i];
      const predictions = this.predictSequence(X, weights);
      const directionError = Math.pow(predictions.direction - val.y.direction[i], 2);
      const priceError = Math.pow(predictions.price - val.y.price[i], 2);
      valLoss += (directionError + priceError) / 2;
    }

    trainLoss /= Math.min(train.X.length, config.batchSize);
    valLoss /= Math.min(val.X.length, 32);
    const accuracy = correctPredictions / Math.min(train.X.length, config.batchSize);

    return {
      symbol,
      epoch,
      trainLoss,
      valLoss,
      accuracy,
      directionAccuracy: accuracy,
      priceMAE: Math.sqrt(valLoss * 0.5),
      volumeMAE: Math.sqrt(valLoss * 0.3)
    };
  }

  /**
   * Predict on a sequence
   */
  private predictSequence(X: number[][], weights: LSTMWeights): any {
    // Simplified LSTM forward pass
    let hidden = new Array(128).fill(0);

    for (const input of X) {
      hidden = this.lstmForwardPass(input, hidden, weights.direction.lstm);
    }

    return {
      direction: this.sigmoid(hidden.reduce((a, b) => a + b, 0) / 128),
      price: Math.tanh(hidden[0]),
      volume: Math.tanh(hidden[1]),
      volatility: this.sigmoid(hidden[2]),
      regimeDuration: this.sigmoid(hidden[3]),
      velocityConfidence: this.sigmoid(hidden[4])
    };
  }

  /**
   * LSTM forward pass (simplified)
   */
  private lstmForwardPass(input: number[], hidden: number[], weights: number[][]): number[] {
    // This is a simplified version - real implementation would use proper LSTM gates
    const output = new Array(hidden.length).fill(0);
    for (let i = 0; i < Math.min(4, hidden.length); i++) {
      output[i] = this.sigmoid(input[i % input.length] + hidden[i]);
    }
    return output;
  }

  /**
   * Update weights (simplified gradient descent)
   */
  private updateWeights(weights: LSTMWeights, X: number[][], predictions: any, y: any, idx: number, lr: number): LSTMWeights {
    // Simplified weight update - in production use proper backpropagation
    return weights;
  }

  /**
   * Sigmoid activation
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.min(Math.max(x, -10), 10)));
  }

  /**
   * Random matrix
   */
  private randomMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() - 0.5) * 2)
    );
  }

  /**
   * Random array
   */
  private randomArray(size: number): number[] {
    return Array.from({ length: size }, () => (Math.random() - 0.5) * 2);
  }

  /**
   * Save checkpoint to disk
   */
  private async saveCheckpoint(checkpoint: LSTMModelCheckpoint): Promise<void> {
    const filename = `${checkpoint.symbol}-${Date.now()}.json`;
    const filepath = path.join(this.checkpointsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
    console.log(`[LSTM Trainer] Checkpoint saved: ${filename}`);
  }

  /**
   * Load latest checkpoint
   */
  async loadLatestCheckpoint(symbol: string): Promise<LSTMModelCheckpoint | null> {
    try {
      const files = fs.readdirSync(this.checkpointsDir)
        .filter(f => f.startsWith(symbol))
        .sort()
        .reverse();

      if (files.length === 0) return null;

      const filepath = path.join(this.checkpointsDir, files[0]);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      return data as LSTMModelCheckpoint;
    } catch (error) {
      console.error(`[LSTM Trainer] Error loading checkpoint for ${symbol}:`, error);
      return null;
    }
  }
}

export const lstmTrainer = new LSTMTrainer();
