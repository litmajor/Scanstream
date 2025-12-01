/**
 * Kelly Criterion Validator
 * Compares predicted edge vs actual returns by pattern and regime
 * Generates validation metrics for position sizing accuracy
 */

import { type TradeRecord, type KellyValidation, type PatternStats } from '@shared/schema';

interface KellyValidationResult {
  validations: KellyValidation[];
  overallAccuracy: number;
  avgEdgeError: number;
  avgKellyError: number;
  recommendations: string[];
}

export class KellyValidator {
  private readonly KELLY_FRACTION = 0.25;

  calculateKellyPercent(winRate: number, avgWin: number, avgLoss: number): number {
    if (avgWin <= 0 || avgLoss <= 0) return 0;
    const kellyFull = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    return Math.max(0, Math.min(1, kellyFull * this.KELLY_FRACTION));
  }

  calculateEdge(winRate: number, avgWin: number, avgLoss: number): number {
    return winRate * avgWin - (1 - winRate) * avgLoss;
  }

  validateByPattern(trades: TradeRecord[]): KellyValidationResult {
    const patternGroups = new Map<string, TradeRecord[]>();
    
    for (const trade of trades) {
      const existing = patternGroups.get(trade.pattern) || [];
      existing.push(trade);
      patternGroups.set(trade.pattern, existing);
    }

    const validations: KellyValidation[] = [];
    let totalEdgeError = 0;
    let totalKellyError = 0;
    let validCount = 0;

    for (const [pattern, patternTrades] of patternGroups.entries()) {
      if (patternTrades.length < 20) continue;

      const wins = patternTrades.filter(t => t.actualPnlPercent > 0);
      const losses = patternTrades.filter(t => t.actualPnlPercent <= 0);

      const actualWinRate = wins.length / patternTrades.length;
      const actualAvgWin = wins.length > 0
        ? wins.reduce((sum, t) => sum + t.actualPnlPercent, 0) / wins.length / 100
        : 0;
      const actualAvgLoss = losses.length > 0
        ? Math.abs(losses.reduce((sum, t) => sum + t.actualPnlPercent, 0) / losses.length / 100)
        : 0;

      const predictedAvgWin = patternTrades.reduce((sum, t) => sum + t.profitTargetPercent, 0) / patternTrades.length / 100;
      const predictedAvgLoss = patternTrades.reduce((sum, t) => sum + t.stopLossPercent, 0) / patternTrades.length / 100;
      const predictedWinRate = patternTrades.filter(t => t.hitTarget).length / patternTrades.length;

      const predictedEdge = this.calculateEdge(predictedWinRate, predictedAvgWin, predictedAvgLoss);
      const actualEdge = this.calculateEdge(actualWinRate, actualAvgWin, actualAvgLoss);
      const edgeError = Math.abs(predictedEdge - actualEdge);

      const predictedKelly = this.calculateKellyPercent(predictedWinRate, predictedAvgWin, predictedAvgLoss);
      const actualKelly = this.calculateKellyPercent(actualWinRate, actualAvgWin, actualAvgLoss);
      const kellyError = Math.abs(predictedKelly - actualKelly);

      const stdDev = Math.sqrt(
        patternTrades.reduce((sum, t) => sum + Math.pow(t.actualPnlPercent - actualEdge * 100, 2), 0) / patternTrades.length
      ) / 100;
      const margin = 1.96 * stdDev / Math.sqrt(patternTrades.length);

      validations.push({
        pattern,
        predictedEdge,
        actualEdge,
        edgeError,
        predictedKelly,
        actualKelly,
        kellyError,
        sampleSize: patternTrades.length,
        confidence95: {
          lower: actualEdge - margin,
          upper: actualEdge + margin
        }
      });

      totalEdgeError += edgeError;
      totalKellyError += kellyError;
      validCount++;
    }

    const avgEdgeError = validCount > 0 ? totalEdgeError / validCount : 0;
    const avgKellyError = validCount > 0 ? totalKellyError / validCount : 0;
    const overallAccuracy = 1 - avgEdgeError;

    const recommendations = this.generateRecommendations(validations);

    return {
      validations,
      overallAccuracy: Math.max(0, overallAccuracy),
      avgEdgeError,
      avgKellyError,
      recommendations
    };
  }

  private generateRecommendations(validations: KellyValidation[]): string[] {
    const recs: string[] = [];

    for (const v of validations) {
      if (v.edgeError > 0.02) {
        if (v.predictedEdge > v.actualEdge) {
          recs.push(`${v.pattern}: Reduce profit targets (overpredicting edge by ${(v.edgeError * 100).toFixed(1)}%)`);
        } else {
          recs.push(`${v.pattern}: Can increase position size (underpredicting edge by ${(v.edgeError * 100).toFixed(1)}%)`);
        }
      }

      if (v.kellyError > 0.01) {
        if (v.predictedKelly > v.actualKelly) {
          recs.push(`${v.pattern}: Current Kelly ${(v.predictedKelly * 100).toFixed(2)}% too aggressive, use ${(v.actualKelly * 100).toFixed(2)}%`);
        }
      }

      if (v.confidence95.lower < 0 && v.confidence95.upper > 0) {
        recs.push(`${v.pattern}: Edge not statistically significant (95% CI crosses zero)`);
      }
    }

    return recs;
  }

  validateByRegime(trades: TradeRecord[]): Map<string, KellyValidationResult> {
    const regimeGroups = new Map<string, TradeRecord[]>();
    
    for (const trade of trades) {
      const existing = regimeGroups.get(trade.regime) || [];
      existing.push(trade);
      regimeGroups.set(trade.regime, existing);
    }

    const results = new Map<string, KellyValidationResult>();
    for (const [regime, regimeTrades] of regimeGroups.entries()) {
      results.set(regime, this.validateByPattern(regimeTrades));
    }

    return results;
  }

  getPatternStats(trades: TradeRecord[]): PatternStats[] {
    const patternGroups = new Map<string, TradeRecord[]>();
    
    for (const trade of trades) {
      const existing = patternGroups.get(trade.pattern) || [];
      existing.push(trade);
      patternGroups.set(trade.pattern, existing);
    }

    const stats: PatternStats[] = [];

    for (const [pattern, patternTrades] of patternGroups.entries()) {
      if (patternTrades.length < 10) continue;

      const wins = patternTrades.filter(t => t.actualPnlPercent > 0);
      const losses = patternTrades.filter(t => t.actualPnlPercent <= 0);

      const winRate = wins.length / patternTrades.length;
      const avgProfit = wins.length > 0
        ? wins.reduce((sum, t) => sum + t.actualPnlPercent, 0) / wins.length / 100
        : 0;
      const avgLoss = losses.length > 0
        ? Math.abs(losses.reduce((sum, t) => sum + t.actualPnlPercent, 0) / losses.length / 100)
        : 0;

      const expectancy = this.calculateEdge(winRate, avgProfit, avgLoss);
      const kellyPercent = this.calculateKellyPercent(winRate, avgProfit, avgLoss);

      const returns = patternTrades.map(t => t.actualPnlPercent / 100);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = stdDev > 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;

      stats.push({
        pattern,
        winRate,
        avgProfit,
        avgLoss,
        totalTrades: patternTrades.length,
        expectancy,
        kellyPercent,
        sharpeRatio
      });
    }

    return stats.sort((a, b) => b.expectancy - a.expectancy);
  }
}

export const kellyValidator = new KellyValidator();
