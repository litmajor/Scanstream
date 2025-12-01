
/**
 * Training Script for Dynamic Position Sizer RL Agent
 * 
 * Phase 2: Training & Validation
 * - Trains RL Agent on historical trades (backtest data)
 * - Validates Kelly Criterion accuracy (predicted vs actual edge)
 * - Generates performance reports
 */

import { dynamicPositionSizer } from '../services/dynamic-position-sizer';
import { signalPerformanceTracker } from '../services/signal-performance-tracker';
import { storage } from '../storage';

interface HistoricalTrade {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  confidence: number;
  pattern: string;
  regime: string;
  volatility: number;
  takeProfit: number;
  stopLoss: number;
  sizeMultiplier: number;
  maxDrawdown?: number;
}

export class PositionSizerTrainer {
  /**
   * Train RL Agent on historical trade data
   */
  async trainOnHistoricalData(): Promise<void> {
    console.log('[Trainer] Starting RL Agent training...');
    
    // Step 1: Load historical trades from database
    const historicalTrades = await this.loadHistoricalTrades();
    console.log(`[Trainer] Loaded ${historicalTrades.length} historical trades`);
    
    if (historicalTrades.length === 0) {
      console.log('[Trainer] No historical data found. Generating sample data...');
      await this.generateSampleTrainingData();
      return;
    }
    
    // Step 2: Convert to training format
    const trainingData = this.prepareTrainingData(historicalTrades);
    console.log(`[Trainer] Prepared ${trainingData.length} training examples`);
    
    // Step 3: Train RL Agent
    await dynamicPositionSizer.trainOnHistoricalTrades(trainingData);
    
    // Step 4: Validate Kelly Criterion accuracy
    const kellyValidation = this.validateKellyCriterion(historicalTrades);
    console.log('[Trainer] Kelly Criterion Validation:', kellyValidation);
    
    // Step 5: Generate performance report
    const report = this.generateTrainingReport(historicalTrades, kellyValidation);
    console.log('[Trainer] Training Report:', JSON.stringify(report, null, 2));
    
    // Step 6: Save report to file
    await this.saveTrainingReport(report);
    
    console.log('[Trainer] Training complete!');
  }
  
  /**
   * Load historical trades from database
   */
  private async loadHistoricalTrades(): Promise<HistoricalTrade[]> {
    try {
      // Get recent signal performances (closed trades only)
      const performances = signalPerformanceTracker.getRecentPerformance(1000);
      
      return performances
        .filter(p => p.status === 'hit_target' || p.status === 'hit_stop')
        .map(p => ({
          symbol: p.symbol,
          entryPrice: p.entryPrice,
          exitPrice: p.currentPrice,
          entryTime: p.createdAt,
          exitTime: p.closedAt || p.createdAt,
          confidence: 0.7, // Default, should come from signal metadata
          pattern: (p as any).primaryPattern || 'BREAKOUT',
          regime: 'TRENDING', // Default, should come from signal metadata
          volatility: Math.abs(p.entryPrice - p.currentPrice) / p.entryPrice,
          takeProfit: p.targetPrice,
          stopLoss: p.stopLoss,
          sizeMultiplier: 1.0, // Default
          maxDrawdown: p.maxDrawdown
        }));
    } catch (error) {
      console.error('[Trainer] Failed to load historical trades:', error);
      return [];
    }
  }
  
  /**
   * Prepare historical trades for RL training
   */
  private prepareTrainingData(trades: HistoricalTrade[]): any[] {
    return trades.map(trade => {
      const pnlPercent = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      const riskReward = Math.abs(trade.takeProfit - trade.entryPrice) / Math.abs(trade.stopLoss - trade.entryPrice);
      const holdingPeriodHours = (trade.exitTime.getTime() - trade.entryTime.getTime()) / (1000 * 60 * 60);
      
      return {
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        confidence: trade.confidence,
        regime: trade.regime,
        volatility: trade.volatility,
        takeProfit: trade.takeProfit,
        stopLoss: trade.stopLoss,
        sizeMultiplier: trade.sizeMultiplier,
        maxDrawdown: trade.maxDrawdown || 0,
        pnlPercent,
        riskReward,
        holdingPeriodHours,
        // Additional features for RL state
        trend: pnlPercent > 0 ? 1 : -1,
        momentum: pnlPercent,
        volumeRatio: 1.0, // Would need volume data
        rsi: 50 + (pnlPercent * 100) // Approximate
      };
    });
  }
  
  /**
   * Validate Kelly Criterion accuracy
   */
  private validateKellyCriterion(trades: HistoricalTrade[]): {
    predictedEdge: number;
    actualEdge: number;
    accuracy: number;
    samples: number;
  } {
    const wins = trades.filter(t => t.exitPrice > t.entryPrice);
    const losses = trades.filter(t => t.exitPrice <= t.entryPrice);
    
    const winRate = wins.length / trades.length;
    const avgWin = wins.reduce((sum, t) => sum + ((t.exitPrice - t.entryPrice) / t.entryPrice), 0) / wins.length || 0;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + ((t.exitPrice - t.entryPrice) / t.entryPrice), 0) / losses.length || 0);
    
    // Kelly % = (Win% × Avg Win - Loss% × Avg Loss) / Avg Win
    const predictedEdge = ((winRate * avgWin) - ((1 - winRate) * avgLoss)) / (avgWin || 1);
    
    // Actual edge = average PnL per trade
    const actualEdge = trades.reduce((sum, t) => sum + ((t.exitPrice - t.entryPrice) / t.entryPrice), 0) / trades.length;
    
    // Accuracy = how close predicted edge is to actual edge
    const accuracy = 1 - Math.abs(predictedEdge - actualEdge) / Math.max(Math.abs(actualEdge), 0.01);
    
    return {
      predictedEdge: Math.round(predictedEdge * 10000) / 100, // %
      actualEdge: Math.round(actualEdge * 10000) / 100, // %
      accuracy: Math.round(accuracy * 100),
      samples: trades.length
    };
  }
  
  /**
   * Generate training performance report
   */
  private generateTrainingReport(trades: HistoricalTrade[], kellyValidation: any): any {
    const rlStats = dynamicPositionSizer.getStats();
    
    // Calculate position size distribution
    const sizeDistribution = {
      under1pct: trades.filter(t => t.sizeMultiplier < 0.01).length,
      oneToTwo: trades.filter(t => t.sizeMultiplier >= 0.01 && t.sizeMultiplier < 0.02).length,
      twoToFour: trades.filter(t => t.sizeMultiplier >= 0.02 && t.sizeMultiplier < 0.04).length,
      overFour: trades.filter(t => t.sizeMultiplier >= 0.04).length
    };
    
    // Win rate by position size bracket
    const winRateBySize = {
      small: this.calculateWinRate(trades.filter(t => t.sizeMultiplier < 0.01)),
      medium: this.calculateWinRate(trades.filter(t => t.sizeMultiplier >= 0.01 && t.sizeMultiplier < 0.02)),
      large: this.calculateWinRate(trades.filter(t => t.sizeMultiplier >= 0.02))
    };
    
    return {
      timestamp: new Date().toISOString(),
      totalTrades: trades.length,
      kellyValidation,
      rlStats,
      sizeDistribution,
      winRateBySize,
      recommendations: this.generateRecommendations(kellyValidation, winRateBySize)
    };
  }
  
  /**
   * Calculate win rate for trade subset
   */
  private calculateWinRate(trades: HistoricalTrade[]): number {
    if (trades.length === 0) return 0;
    const wins = trades.filter(t => t.exitPrice > t.entryPrice).length;
    return Math.round((wins / trades.length) * 100);
  }
  
  /**
   * Generate recommendations based on training results
   */
  private generateRecommendations(kellyValidation: any, winRateBySize: any): string[] {
    const recommendations: string[] = [];
    
    // Kelly accuracy check
    if (kellyValidation.accuracy < 80) {
      recommendations.push(`⚠️ Kelly accuracy is ${kellyValidation.accuracy}% - consider adjusting win/loss estimates`);
    } else {
      recommendations.push(`✅ Kelly accuracy is ${kellyValidation.accuracy}% - good predictive power`);
    }
    
    // Win rate progression check
    if (winRateBySize.large > winRateBySize.small + 5) {
      recommendations.push(`✅ Larger positions have ${winRateBySize.large}% win rate vs ${winRateBySize.small}% for small - good sizing logic`);
    } else if (winRateBySize.large < winRateBySize.small) {
      recommendations.push(`⚠️ Larger positions underperforming (${winRateBySize.large}% vs ${winRateBySize.small}%) - review confidence thresholds`);
    }
    
    // Sample size check
    if (kellyValidation.samples < 50) {
      recommendations.push(`⚠️ Only ${kellyValidation.samples} samples - need more data for reliable training`);
    } else if (kellyValidation.samples > 200) {
      recommendations.push(`✅ ${kellyValidation.samples} samples - sufficient for training`);
    }
    
    return recommendations;
  }
  
  /**
   * Save training report to file
   */
  private async saveTrainingReport(report: any): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const reportPath = path.join(process.cwd(), 'POSITION_SIZER_TRAINING_REPORT.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[Trainer] Report saved to ${reportPath}`);
  }
  
  /**
   * Generate sample training data for initial training
   */
  private async generateSampleTrainingData(): Promise<void> {
    console.log('[Trainer] Generating 100 sample trades for initial training...');
    
    const sampleTrades = [];
    
    // Generate diverse sample trades
    for (let i = 0; i < 100; i++) {
      const confidence = 0.5 + Math.random() * 0.45; // 50-95%
      const regime = ['TRENDING', 'CHOPPY', 'VOLATILE'][Math.floor(Math.random() * 3)];
      const volatility = 0.01 + Math.random() * 0.04; // 1-5%
      
      // Simulate outcome based on confidence
      const winProbability = confidence * 0.9; // Higher confidence = higher win probability
      const isWin = Math.random() < winProbability;
      
      const entryPrice = 100 + Math.random() * 10;
      const pnlPercent = isWin 
        ? (0.01 + Math.random() * 0.04) // 1-5% win
        : -(0.005 + Math.random() * 0.025); // 0.5-3% loss
      
      const exitPrice = entryPrice * (1 + pnlPercent);
      
      sampleTrades.push({
        symbol: 'BTC/USDT',
        entryPrice,
        exitPrice,
        confidence,
        regime,
        volatility,
        takeProfit: entryPrice * 1.03,
        stopLoss: entryPrice * 0.98,
        sizeMultiplier: confidence, // Simple initial strategy
        maxDrawdown: isWin ? -0.01 : -0.03,
        pnlPercent,
        riskReward: 1.5,
        holdingPeriodHours: 24,
        trend: isWin ? 1 : -1,
        momentum: pnlPercent,
        volumeRatio: 1.0,
        rsi: 50 + (pnlPercent * 100)
      });
    }
    
    // Train on sample data
    await dynamicPositionSizer.trainOnHistoricalTrades(sampleTrades);
    
    console.log('[Trainer] Sample training complete. RL Agent initialized with:', dynamicPositionSizer.getStats());
  }
}

// Export singleton
export const positionSizerTrainer = new PositionSizerTrainer();

// CLI execution (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await positionSizerTrainer.trainOnHistoricalData();
      process.exit(0);
    } catch (error) {
      console.error('[Trainer] Training failed:', error);
      process.exit(1);
    }
  })();
}
