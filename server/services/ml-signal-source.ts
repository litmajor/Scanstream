/**
 * ML Signal Source for Consensus Engine
 * 
 * Converts LSTM predictions into consensus-compatible signals
 * Feeds ML source into 3-source voting (Scanner + ML + RL)
 */

import { LSTMInferenceEngine, LSTMPredictionOutput } from './lstm-inference-engine';
import { MLPredictions } from './ml-predictions';

export interface MLConsensusSignal {
  symbol: string;
  source: 'ml-lstm';
  timestamp: number;
  
  // Consensus fields
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  strength: number; // 0-100
  
  // Prediction details
  predictions: {
    lstm: LSTMPredictionOutput | null;
    classical: MLPredictions | null;
  };
  
  // Reasoning
  reasoning: string[];
  
  // Quality metadata
  dataPoints: number;
  modelsUsed: string[];
}

/**
 * ML Signal Source - Generates consensus signals from ML predictions
 */
export class MLSignalSource {
  constructor(
    private lstmEngine: LSTMInferenceEngine
  ) {}

  /**
   * Generate ML consensus signal
   */
  async generateSignal(
    symbol: string,
    classicalPredictions?: MLPredictions
  ): Promise<MLConsensusSignal | null> {
    try {
      // Generate LSTM prediction
      const lstmPrediction = await this.lstmEngine.predict({
        symbol,
        timeframe: '1h',
        lookbackCandles: 100
      });

      if (!lstmPrediction) {
        console.warn(`[ML Signal Source] No LSTM predictions available for ${symbol}`);
        return null;
      }

      // Combine LSTM + classical predictions
      const signal = this.aggregateSignals(lstmPrediction, classicalPredictions, symbol);
      
      return signal;

    } catch (error) {
      console.error(`[ML Signal Source] Error generating signal for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Aggregate LSTM + classical ML predictions
   */
  private aggregateSignals(
    lstm: LSTMPredictionOutput,
    classical: MLPredictions | undefined,
    symbol: string
  ): MLConsensusSignal {
    const reasoning: string[] = [];
    const modelsUsed: string[] = ['LSTM'];

    // Start with LSTM signal
    let signal: 'BUY' | 'SELL' | 'HOLD' = lstm.direction.prediction === 'BULLISH' ? 'BUY' : 'SELL';
    let confidence = lstm.direction.confidence;
    let strength = lstm.direction.strength;

    // Add classical ML if available
    if (classical) {
      modelsUsed.push('Classical-ML');
      
      const classicalSignal = classical.direction.prediction === 'BULLISH' || 
                              classical.direction.prediction === 'bullish' 
        ? 'BUY' 
        : 'SELL';

      // Adjust confidence based on agreement
      if (classicalSignal === signal) {
        confidence = Math.min(1, confidence + 0.1);
        reasoning.push('✓ LSTM & Classical ML agree');
      } else {
        confidence *= 0.7; // Reduce confidence on disagreement
        reasoning.push('⚠ LSTM & Classical ML disagree');
      }
    }

    // Add reasoning from LSTM
    reasoning.push(`LSTM Direction: ${lstm.direction.prediction} (${(lstm.direction.confidence * 100).toFixed(1)}%)`);
    reasoning.push(`Price Target: $${lstm.price.predicted.toFixed(2)} (${lstm.price.changePercent > 0 ? '+' : ''}${lstm.price.changePercent.toFixed(2)}%)`);
    reasoning.push(`Regime Duration: ~${lstm.regimeDuration.candles} candles (${(lstm.regimeDuration.confidence * 100).toFixed(0)}% confidence)`);
    reasoning.push(`Volatility: ${lstm.volatility.level.toUpperCase()} (${(lstm.volatility.confidence * 100).toFixed(0)}%)`);
    reasoning.push(`Historical Move: Avg 1D $${lstm.velocityProfile.expected1DMove.toFixed(0)} (${lstm.velocityProfile.expected1DPercent.toFixed(2)}%)`);

    // Add risk factors
    if (lstm.riskAssessment.factors.length > 0) {
      reasoning.push(`Risk Factors: ${lstm.riskAssessment.factors.join(', ')}`);
    }

    // Hold signals for weak confidence
    if (confidence < 0.55) {
      signal = 'HOLD';
      reasoning.push('Confidence too low - recommend HOLD');
    }

    // Hold if volatility is extreme
    if (lstm.volatility.level === 'extreme') {
      signal = 'HOLD';
      reasoning.push('Extreme volatility detected - recommend HOLD');
    }

    return {
      symbol,
      source: 'ml-lstm',
      timestamp: Date.now(),
      signal,
      confidence: Math.min(1, Math.max(0, confidence)),
      strength,
      predictions: {
        lstm,
        classical: classical || null
      },
      reasoning,
      dataPoints: 100,
      modelsUsed
    };
  }

  /**
   * Batch generate signals for multiple symbols
   */
  async generateSignalBatch(
    symbols: string[],
    classicalPredictions?: Record<string, MLPredictions>
  ): Promise<MLConsensusSignal[]> {
    const signals: MLConsensusSignal[] = [];

    for (const symbol of symbols) {
      try {
        const signal = await this.generateSignal(
          symbol,
          classicalPredictions?.[symbol]
        );
        
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        console.error(`[ML Signal Source] Error for ${symbol}:`, error);
      }
    }

    return signals;
  }

  /**
   * Score ML signal for position sizing
   */
  scoreSignal(signal: MLConsensusSignal): {
    positionSizePercent: number; // 0-1
    confidence: number;
    riskLevel: string;
  } {
    const baseScore = signal.confidence * signal.strength / 100;
    
    let positionSizePercent = baseScore;
    let riskLevel: string;

    // Scale position based on confidence
    if (signal.confidence > 0.85) {
      positionSizePercent = Math.min(1, baseScore * 1.2);
      riskLevel = 'low';
    } else if (signal.confidence > 0.70) {
      positionSizePercent = baseScore;
      riskLevel = 'medium';
    } else if (signal.confidence > 0.55) {
      positionSizePercent = baseScore * 0.7;
      riskLevel = 'medium-high';
    } else {
      positionSizePercent = baseScore * 0.5;
      riskLevel = 'high';
    }

    // Reduce position for extreme volatility
    if (signal.predictions.lstm?.volatility.level === 'extreme') {
      positionSizePercent *= 0.5;
      riskLevel = 'extreme';
    }

    return {
      positionSizePercent: Math.min(1, Math.max(0, positionSizePercent)),
      confidence: signal.confidence,
      riskLevel
    };
  }
}

export const mlSignalSource = new MLSignalSource(require('./lstm-inference-engine').lstmInferenceEngine);
