/**
 * ML LSTM Routes
 * 
 * Training and inference endpoints for LSTM models
 * Feeds predictions into consensus engine
 */

import type { Express } from 'express';
import { lstmTrainer, LSTMTrainingConfig } from '../services/lstm-trainer';
import { lstmInferenceEngine } from '../services/lstm-inference-engine';
import { mlSignalSource } from '../services/ml-signal-source';

export function registerMLLSTMRoutes(app: Express) {
  /**
   * POST /api/ml/lstm/train
   * Train LSTM models on historical data
   */
  app.post('/api/ml/lstm/train', async (req, res) => {
    try {
      const {
        symbols = ['BTC', 'ETH'],
        lookbackDays = 365,
        lookbackCandles = 100,
        validationSplit = 0.2,
        epochs = 50,
        batchSize = 32,
        learningRate = 0.001
      } = req.body;

      console.log(`[ML LSTM] Training request: ${symbols.join(', ')}, ${epochs} epochs`);

      const config: LSTMTrainingConfig = {
        symbols: Array.isArray(symbols) ? symbols : [symbols],
        lookbackDays,
        lookbackCandles,
        validationSplit,
        epochs,
        batchSize,
        learningRate,
        timeframe: '1h'
      };

      const startTime = Date.now();
      const result = await lstmTrainer.train(config);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      res.json({
        success: true,
        message: `Training complete in ${duration}s`,
        checkpoint: {
          symbol: result.checkpoint.symbol,
          trainedAt: new Date(result.checkpoint.trainedAt).toISOString(),
          dataPoints: result.checkpoint.dataPoints,
          config: result.checkpoint.config
        },
        metrics: {
          finalEpoch: result.metrics[result.metrics.length - 1] || null,
          bestAccuracy: Math.max(...result.metrics.map(m => m.accuracy)),
          averageLoss: (result.metrics.reduce((a, m) => a + m.trainLoss, 0) / result.metrics.length).toFixed(4),
          epochs: result.metrics.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[ML LSTM] Training error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Training failed'
      });
    }
  });

  /**
   * POST /api/ml/lstm/predict
   * Generate LSTM predictions for symbols
   */
  app.post('/api/ml/lstm/predict', async (req, res) => {
    try {
      const { symbols, timeframe = '1h', lookbackCandles = 100 } = req.body;

      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'symbols array required'
        });
      }

      console.log(`[ML LSTM] Prediction request: ${symbols.join(', ')}`);

      const predictions: any[] = [];
      const signals: any[] = [];

      for (const symbol of symbols) {
        try {
          // Get LSTM prediction
          const lstmPred = await lstmInferenceEngine.predict({
            symbol,
            timeframe: timeframe as any,
            lookbackCandles
          });

          if (lstmPred) {
            predictions.push({
              ...lstmPred
            });

            // Generate consensus signal
            const signal = await mlSignalSource.generateSignal(symbol);
            if (signal) {
              signals.push(signal);
            }
          }
        } catch (err) {
          console.error(`[ML LSTM] Error for ${symbol}:`, err);
        }
      }

      res.json({
        success: true,
        count: predictions.length,
        predictions,
        signals,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[ML LSTM] Prediction error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Prediction failed'
      });
    }
  });

  /**
   * GET /api/ml/lstm/model-info
   * Get info on trained LSTM models
   */
  app.get('/api/ml/lstm/model-info', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC';

      const loaded = await lstmInferenceEngine.loadCheckpoint(symbol);

      res.json({
        success: true,
        symbol,
        modelAvailable: loaded,
        message: loaded 
          ? `LSTM model available for ${symbol}`
          : `No trained model for ${symbol}. Run training first.`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get model info'
      });
    }
  });

  /**
   * POST /api/ml/lstm/consensus
   * Generate signals for consensus engine
   */
  app.post('/api/ml/lstm/consensus', async (req, res) => {
    try {
      const { symbols } = req.body;

      if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({
          success: false,
          error: 'symbols array required'
        });
      }

      console.log(`[ML LSTM] Consensus signal generation: ${symbols.join(', ')}`);

      const signals = await mlSignalSource.generateSignalBatch(symbols);

      // Score each signal for position sizing
      const scoredSignals = signals.map(signal => ({
        ...signal,
        positionSizing: mlSignalSource.scoreSignal(signal)
      }));

      res.json({
        success: true,
        count: scoredSignals.length,
        signals: scoredSignals,
        summary: {
          bullishSignals: scoredSignals.filter(s => s.signal === 'BUY').length,
          bearishSignals: scoredSignals.filter(s => s.signal === 'SELL').length,
          holdSignals: scoredSignals.filter(s => s.signal === 'HOLD').length,
          averageConfidence: scoredSignals.length > 0 
            ? (scoredSignals.reduce((a, s) => a + s.confidence, 0) / scoredSignals.length).toFixed(3)
            : 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[ML LSTM] Consensus generation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Consensus generation failed'
      });
    }
  });

  /**
   * GET /api/ml/lstm/status
   * System status for ML LSTM integration
   */
  app.get('/api/ml/lstm/status', (req, res) => {
    res.json({
      success: true,
      system: 'ML LSTM Integration',
      status: 'active',
      capabilities: [
        'LSTM training on 1h historical data',
        'Multi-target predictions (direction, price, volume, volatility, regime duration, velocity)',
        'Regime duration prediction (how long regime persists)',
        'Velocity profile confidence scoring',
        'ML consensus signals (BUY/SELL/HOLD)',
        'Position sizing based on confidence',
        'Integration with 3-source consensus engine (Scanner + ML + RL)'
      ],
      endpoints: [
        'POST /api/ml/lstm/train - Train models',
        'POST /api/ml/lstm/predict - Generate predictions',
        'POST /api/ml/lstm/consensus - Generate consensus signals',
        'GET /api/ml/lstm/model-info - Check model status'
      ],
      models: {
        predictedTargets: [
          'direction (BULLISH/BEARISH)',
          'price (next candle close)',
          'volume (next candle volume)',
          'volatility (predicted volatility level)',
          'regimeDuration (candles until regime change)',
          'velocityConfidence (movement expectations)'
        ],
        trainingSource: '1-hour historical candles',
        architecture: 'LSTM with 128 hidden units',
        timeframe: '1h candles -> multi-timeframe predictions'
      },
      timestamp: new Date().toISOString()
    });
  });
}
