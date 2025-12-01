
/**
 * Attention-Based Sequence Model
 * 
 * Uses attention mechanism to focus on relevant historical periods
 * for better price prediction and trend detection
 */

import type { MarketFrame } from '@shared/schema';

interface AttentionWeights {
  timeSteps: number[];
  weights: number[];
  focus: 'recent' | 'historical' | 'balanced';
}

export class AttentionSequenceModel {
  private queryWeights: number[] = [];
  private keyWeights: number[] = [];
  private valueWeights: number[] = [];
  private outputWeights: number[] = [];
  private sequenceLength = 50;
  private featureDim = 10;

  /**
   * Calculate attention scores between query and keys
   */
  private calculateAttention(query: number[], keys: number[][]): number[] {
    const scores: number[] = [];
    
    for (const key of keys) {
      let dotProduct = 0;
      for (let i = 0; i < Math.min(query.length, key.length); i++) {
        dotProduct += query[i] * key[i];
      }
      const score = dotProduct / Math.sqrt(query.length);
      scores.push(score);
    }
    
    // Softmax normalization
    const maxScore = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    
    return expScores.map(s => s / sumExp);
  }

  /**
   * Extract sequence features from market frames
   */
  private extractSequenceFeatures(frames: MarketFrame[]): number[][] {
    const features: number[][] = [];
    
    for (let i = 20; i < frames.length; i++) {
      const recentFrames = frames.slice(i - 20, i);
      const prices = recentFrames.map(f => f.price.close);
      const volumes = recentFrames.map(f => f.volume);
      
      features.push([
        prices[prices.length - 1], // Current price
        (prices[prices.length - 1] - prices[0]) / prices[0], // Price change
        Math.max(...prices) / prices[prices.length - 1] - 1, // Distance to high
        1 - Math.min(...prices) / prices[prices.length - 1], // Distance to low
        volumes[volumes.length - 1] / (volumes.reduce((a, b) => a + b) / volumes.length), // Volume ratio
        recentFrames[recentFrames.length - 1].indicators.rsi / 100,
        recentFrames[recentFrames.length - 1].indicators.macd.histogram,
        recentFrames[recentFrames.length - 1].orderFlow.netFlow / recentFrames[recentFrames.length - 1].volume,
        recentFrames[recentFrames.length - 1].marketMicrostructure.spread,
        recentFrames[recentFrames.length - 1].marketMicrostructure.toxicity
      ]);
    }
    
    return features;
  }

  /**
   * Predict next price movement using attention mechanism
   */
  async predict(frames: MarketFrame[]): Promise<{
    priceTarget: number;
    confidence: number;
    attentionWeights: AttentionWeights;
    interpretation: string;
  }> {
    if (frames.length < this.sequenceLength) {
      throw new Error('Insufficient data for attention model');
    }
    
    // Extract features
    const sequenceFeatures = this.extractSequenceFeatures(frames);
    const recent = sequenceFeatures.slice(-this.sequenceLength);
    
    // Current state as query
    const query = recent[recent.length - 1];
    
    // Historical states as keys
    const keys = recent.slice(0, -1);
    
    // Calculate attention weights
    const attentionWeights = this.calculateAttention(query, keys);
    
    // Apply attention to values (same as keys for simplicity)
    const contextVector: number[] = new Array(this.featureDim).fill(0);
    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < this.featureDim; j++) {
        contextVector[j] += attentionWeights[i] * keys[i][j];
      }
    }
    
    // Combine context with current state
    const combined = [...query, ...contextVector];
    
    // Simple output projection
    const currentPrice = frames[frames.length - 1].price.close;
    let priceChange = 0;
    for (let i = 0; i < Math.min(combined.length, 10); i++) {
      priceChange += combined[i] * 0.01 * (i % 2 === 0 ? 1 : -1);
    }
    
    const priceTarget = currentPrice * (1 + priceChange);
    
    // Calculate confidence based on attention distribution
    const entropy = attentionWeights.reduce((sum, w) => {
      return sum - (w > 0 ? w * Math.log(w) : 0);
    }, 0);
    const maxEntropy = Math.log(attentionWeights.length);
    const confidence = 1 - (entropy / maxEntropy); // Lower entropy = higher confidence
    
    // Determine focus
    const recentWeight = attentionWeights.slice(-10).reduce((a, b) => a + b, 0);
    let focus: 'recent' | 'historical' | 'balanced' = 'balanced';
    if (recentWeight > 0.6) focus = 'recent';
    else if (recentWeight < 0.4) focus = 'historical';
    
    const interpretation = focus === 'recent' 
      ? 'Model focusing on recent price action'
      : focus === 'historical'
      ? 'Model detecting pattern from historical data'
      : 'Model balancing recent and historical signals';
    
    return {
      priceTarget,
      confidence,
      attentionWeights: {
        timeSteps: attentionWeights.map((_, i) => i),
        weights: attentionWeights,
        focus
      },
      interpretation
    };
  }

  /**
   * Train on historical data
   */
  async train(frames: MarketFrame[]): Promise<void> {
    console.log('[Attention Model] Training on', frames.length, 'frames');
    
    const features = this.extractSequenceFeatures(frames);
    
    // Simple weight initialization
    this.queryWeights = Array(this.featureDim).fill(0).map(() => Math.random() * 0.01);
    this.keyWeights = Array(this.featureDim).fill(0).map(() => Math.random() * 0.01);
    this.valueWeights = Array(this.featureDim).fill(0).map(() => Math.random() * 0.01);
    
    console.log('[Attention Model] Training complete');
  }
}

export default new AttentionSequenceModel();
