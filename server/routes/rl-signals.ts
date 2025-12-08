import express, { type Request, type Response } from 'express';
import { RLPositionAgent } from '../rl-position-agent';
import { storage } from '../storage';
import type { MarketFrame } from '@shared/schema';

const router = express.Router();
const rlAgent = new RLPositionAgent();

/**
 * GET /api/rl-agent/signals
 * Generate RL-based position sizing signals
 */
router.get('/signals', async (_req: Request, res: Response) => {
  try {
    console.log('[RL Agent] GET /signals endpoint called');
    
    // Get recent market data from all symbols
    // Since getMarketFrames takes a symbol parameter, we need to handle this differently
    // For now, return empty signals with proper error handling
    try {
      // Try to get some common symbols' data
      const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
      const allFrames: MarketFrame[] = [];
      
      for (const symbol of symbols) {
        try {
          const frames = await storage.getMarketFrames(symbol, 50);
          allFrames.push(...frames);
        } catch (e) {
          console.log(`[RL Agent] Could not fetch frames for ${symbol}, continuing...`);
        }
      }
      
      console.log('[RL Agent] Retrieved', allFrames.length, 'total market frames');
      
      if (!allFrames || allFrames.length === 0) {
        console.log('[RL Agent] No market frames available, returning empty signals');
        return res.json({ 
          success: true,
          signals: [],
          count: 0,
          timestamp: new Date().toISOString()
        });
      }

      // Group by symbol
      const symbolFrames = new Map<string, MarketFrame[]>();
      for (const frame of allFrames) {
        if (!symbolFrames.has(frame.symbol)) {
          symbolFrames.set(frame.symbol, []);
        }
        symbolFrames.get(frame.symbol)!.push(frame);
      }

      // Generate RL signals for each symbol
      const signals = [];
      
      for (const [symbol, frames] of symbolFrames.entries()) {
        if (frames.length < 20) {
          console.log(`[RL Agent] Skipping ${symbol}: only ${frames.length} frames (need 20+)`);
          continue;
        }
        
        try {
          // Sort by timestamp
          frames.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          const currentFrame = frames[frames.length - 1] as any;
          
          // Extract RL state
          const state = rlAgent.extractState(
            frames,
            0.7, // ML confidence placeholder - integrate with ML predictions
            'NEUTRAL', // Market regime - can be determined from indicators
            0 // Current drawdown
          );

          // Get position parameters
          const baseSize = 1000; // Base position size in USD
          const atr = currentFrame.indicators?.atr || 0.02 * currentFrame.close;
          
          const positionParams = rlAgent.getPositionParameters(
            state,
            baseSize,
            atr,
            currentFrame.close
          );

          // Determine signal type based on position size
          const sizeRatio = positionParams.positionSize / baseSize;
          let signalType: 'BUY' | 'SELL' | 'HOLD';
          
          if (sizeRatio > 1.2 && state.trend > 0.2) {
            signalType = 'BUY';
          } else if (sizeRatio > 1.2 && state.trend < -0.2) {
            signalType = 'SELL';
          } else {
            signalType = 'HOLD';
          }

          if (signalType !== 'HOLD') {
            signals.push({
              symbol,
              signal: signalType,
              strength: Math.min(100, sizeRatio * 50), // Convert to percentage
              price: currentFrame.close,
              timestamp: currentFrame.timestamp,
              positionSize: positionParams.positionSize,
              stopLoss: positionParams.stopLoss,
              takeProfit: positionParams.takeProfit,
              riskReward: positionParams.riskReward,
              confidence: state.confidence,
              reasoning: [
                `Position size: $${positionParams.positionSize.toFixed(2)}`,
                `Risk/Reward: ${positionParams.riskReward.toFixed(2)}`,
                `Stop Loss: $${positionParams.stopLoss.toFixed(2)}`,
                `Take Profit: $${positionParams.takeProfit.toFixed(2)}`,
                `Volatility: ${(state.volatility * 100).toFixed(1)}%`,
                `Trend: ${(state.trend * 100).toFixed(1)}%`
              ]
            });
          }
        } catch (symbolError: any) {
          console.error(`[RL Agent] Error processing ${symbol}:`, symbolError.message);
        }
      }

      console.log('[RL Agent] Generated', signals.length, 'RL signals');
      res.json({ 
        success: true,
        signals,
        count: signals.length,
        timestamp: new Date().toISOString()
      });
    } catch (innerError: any) {
      console.error('[RL Agent] Error in signal processing:', innerError.message);
      res.json({ 
        success: true,
        signals: [],
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

  } catch (err: any) {
    console.error('[RL Agent] Error in /signals endpoint:', {
      message: err?.message || String(err),
      stack: err?.stack,
      type: typeof err
    });
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: err?.message || 'Failed to generate RL signals',
        signals: []
      });
    }
  }
});

/**
 * GET /api/rl-agent/stats
 * Get RL agent statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = rlAgent.getStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
