/**
 * PEG Threshold Optimizer
 * 
 * Finds optimal PEG threshold to maximize precision + recall.
 * Your current threshold (2.0) is too high (83% precision, 42% recall).
 * 
 * Target: >70% precision AND >60% recall
 */

import { MarketTick } from './types';
import { FieldConstructor } from './fieldConstructor';
import { PhysicsCalculator } from './physicsCalculator';

interface ThresholdTestResult {
  threshold: number;
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  totalSignals: number;
}

export class PEGThresholdOptimizer {
  private fieldConstructor: FieldConstructor;

  constructor() {
    this.fieldConstructor = new FieldConstructor(50, 100);
  }

  /**
   * Test multiple PEG thresholds to find optimal value
   * 
   * Grid search over thresholds: 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5
   * 
   * @param ticks - Historical market data
   * @param minMovePercent - Minimum price move to count as "success"
   * @param lookAhead - How many bars to check for price move
   * @returns Array of results sorted by F1 score
   */
  async optimizePEGThreshold(
    ticks: MarketTick[],
    minMovePercent: number = 0.015,
    lookAhead: number = 15
  ): Promise<ThresholdTestResult[]> {
    
    console.log('🔍 OPTIMIZING PEG THRESHOLD...');
    console.log('=' .repeat(70));
    console.log(`Data: ${ticks.length} candles`);
    console.log(`Min move: ${(minMovePercent * 100).toFixed(1)}%`);
    console.log(`Look ahead: ${lookAhead} bars`);
    console.log('');

    // Test these thresholds
    const thresholds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
    
    const results: ThresholdTestResult[] = [];

    for (const threshold of thresholds) {
      console.log(`Testing threshold: ${threshold}...`);
      
      const result = await this.testSingleThreshold(
        ticks,
        threshold,
        minMovePercent,
        lookAhead
      );
      
      results.push(result);
      
      console.log(`  Precision: ${(result.precision * 100).toFixed(1)}%`);
      console.log(`  Recall: ${(result.recall * 100).toFixed(1)}%`);
      console.log(`  F1 Score: ${(result.f1Score * 100).toFixed(1)}%`);
      console.log(`  Signals: ${result.totalSignals}`);
      console.log('');
    }

    // Sort by F1 score (best balance of precision and recall)
    results.sort((a, b) => b.f1Score - a.f1Score);

    this.printOptimizationResults(results);

    return results;
  }

  /**
   * Test a single PEG threshold value
   */
  private async testSingleThreshold(
    ticks: MarketTick[],
    threshold: number,
    minMovePercent: number,
    lookAhead: number
  ): Promise<ThresholdTestResult> {
    
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let totalSignals = 0;

    // Track all PEG values and actual moves
    const pegValues: number[] = [];
    const actualMoves: boolean[] = [];

    for (let i = 100; i < ticks.length - lookAhead; i++) {
      const window = ticks.slice(i - 100, i);
      const prices = window.map(t => t.close);
      
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);
      
      // Calculate actual price move
      const currentPrice = ticks[i].close;
      let maxMove = 0;
      for (let j = 1; j <= lookAhead; j++) {
        const move = Math.abs(ticks[i + j].close - currentPrice) / currentPrice;
        if (move > maxMove) {
          maxMove = move;
        }
      }
      
      const actuallyMoved = maxMove > minMovePercent;
      
      pegValues.push(metrics.peg);
      actualMoves.push(actuallyMoved);
      
      // Check if PEG triggered
      if (metrics.peg > threshold) {
        totalSignals++;
        
        if (actuallyMoved) {
          truePositives++;
        } else {
          falsePositives++;
        }
      } else {
        // PEG didn't trigger but move happened
        if (actuallyMoved) {
          falseNegatives++;
        }
      }
    }

    // Calculate metrics
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      threshold,
      precision,
      recall,
      f1Score,
      truePositives,
      falsePositives,
      falseNegatives,
      totalSignals
    };
  }

  /**
   * Print optimization results table
   */
  private printOptimizationResults(results: ThresholdTestResult[]) {
    console.log('=' .repeat(70));
    console.log('PEG THRESHOLD OPTIMIZATION RESULTS');
    console.log('=' .repeat(70));
    console.log('');
    console.log('Threshold | Precision | Recall | F1 Score | Signals | Status');
    console.log('-'.repeat(70));
    
    for (const result of results) {
      const status = this.getStatusEmoji(result);
      console.log(
        `${result.threshold.toFixed(2).padEnd(9)} | ` +
        `${(result.precision * 100).toFixed(1).padStart(9)}% | ` +
        `${(result.recall * 100).toFixed(1).padStart(6)}% | ` +
        `${(result.f1Score * 100).toFixed(1).padStart(8)}% | ` +
        `${result.totalSignals.toString().padStart(7)} | ` +
        `${status}`
      );
    }
    
    console.log('=' .repeat(70));
    console.log('');
    
    // Recommend best threshold
    const best = results[0];
    console.log('🎯 RECOMMENDED THRESHOLD:', best.threshold);
    console.log(`   Precision: ${(best.precision * 100).toFixed(1)}%`);
    console.log(`   Recall: ${(best.recall * 100).toFixed(1)}%`);
    console.log(`   F1 Score: ${(best.f1Score * 100).toFixed(1)}%`);
    console.log(`   Total Signals: ${best.totalSignals}`);
    console.log('');
    
    // Explain trade-offs
    console.log('📊 THRESHOLD TRADE-OFFS:');
    console.log('  Lower threshold (e.g., 0.5):');
    console.log('    ✅ Higher recall (catches more moves)');
    console.log('    ❌ Lower precision (more false signals)');
    console.log('    💡 Use for: High-frequency trading, capturing all opportunities');
    console.log('');
    console.log('  Higher threshold (e.g., 2.0):');
    console.log('    ✅ Higher precision (fewer false signals)');
    console.log('    ❌ Lower recall (misses many moves)');
    console.log('    💡 Use for: Conservative trading, high-confidence entries');
    console.log('');
    console.log('  Optimal balance (F1 maximized):');
    console.log(`    ⭐ Threshold: ${best.threshold}`);
    console.log('    💡 Best overall performance');
    console.log('');
  }

  /**
   * Get status emoji based on results
   */
  private getStatusEmoji(result: ThresholdTestResult): string {
    if (result.precision > 0.7 && result.recall > 0.6) {
      return '🎯 EXCELLENT';
    } else if (result.precision > 0.6 && result.recall > 0.5) {
      return '✅ GOOD';
    } else if (result.f1Score > 0.5) {
      return '⚠️  ACCEPTABLE';
    } else {
      return '❌ POOR';
    }
  }

  /**
   * Visualize PEG distribution vs actual moves
   * Helps understand if PEG values are meaningful
   */
  async visualizePEGDistribution(
    ticks: MarketTick[],
    minMovePercent: number = 0.015,
    lookAhead: number = 15
  ): Promise<{
    movesPEG: number[]; // PEG values when moves occurred
    noMovesPEG: number[]; // PEG values when no move
    summary: string;
  }> {
    
    const movesPEG: number[] = [];
    const noMovesPEG: number[] = [];

    for (let i = 100; i < ticks.length - lookAhead; i++) {
      const window = ticks.slice(i - 100, i);
      const prices = window.map(t => t.close);
      const field = this.fieldConstructor.constructField(prices);
      const metrics = PhysicsCalculator.computeAllMetrics(field);
      
      // Check if move occurred
      const currentPrice = ticks[i].close;
      let maxMove = 0;
      for (let j = 1; j <= lookAhead; j++) {
        const move = Math.abs(ticks[i + j].close - currentPrice) / currentPrice;
        if (move > maxMove) maxMove = move;
      }
      
      if (maxMove > minMovePercent) {
        movesPEG.push(metrics.peg);
      } else {
        noMovesPEG.push(metrics.peg);
      }
    }

    // Calculate statistics
    const avgMovePEG = this.average(movesPEG);
    const avgNoMovePEG = this.average(noMovesPEG);
    const separation = avgMovePEG - avgNoMovePEG;

    const summary = `
PEG DISTRIBUTION ANALYSIS
=========================
When moves occur:
  Average PEG: ${avgMovePEG.toFixed(4)}
  Samples: ${movesPEG.length}

When no moves occur:
  Average PEG: ${avgNoMovePEG.toFixed(4)}
  Samples: ${noMovesPEG.length}

Separation: ${separation.toFixed(4)}

${separation > 0.5 
  ? '✅ Good separation - PEG is meaningful signal'
  : '❌ Poor separation - PEG may not be useful'
}
    `.trim();

    console.log(summary);

    return { movesPEG, noMovesPEG, summary };
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

/**
 * Quick run function for validation endpoint
 */
export async function runPEGOptimization(
  ticks: MarketTick[]
): Promise<{
  results: ThresholdTestResult[];
  recommendation: {
    threshold: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
}> {
  const optimizer = new PEGThresholdOptimizer();
  
  // Run optimization
  const results = await optimizer.optimizePEGThreshold(ticks);
  
  // Run distribution analysis
  await optimizer.visualizePEGDistribution(ticks);
  
  // Return best threshold
  const best = results[0];
  
  return {
    results,
    recommendation: {
      threshold: best.threshold,
      precision: best.precision,
      recall: best.recall,
      f1Score: best.f1Score
    }
  };
}

export default PEGThresholdOptimizer;