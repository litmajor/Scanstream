/**
 * VFMD VALIDATION FRAMEWORK - PRACTICAL GUIDE
 * ============================================
 * 
 * How to use the validation harness to:
 * 1. Confirm assumptions hold in real data
 * 2. Find what's working and what's not
 * 3. Optimize thresholds for your data
 * 4. Build confidence before live trading
 * 
 * Date: 2025-12-19
 * Status: Framework Complete - Ready for Testing
 */

import { VFMDBacktestValidator, type VFMDValidationReport, type RegimePerformance } from './vfmd-backtest-validator';
import type { MarketTick } from './types';

/**
 * STEP 1: Load Historical Data
 * 
 * Get 6-12 months of historical OHLCV data
 * Minimum requirements:
 * - 500+ bars (ticks)
 * - Multiple market conditions (uptrends, downtrends, consolidation)
 * - Real market data (not synthetic)
 */
export async function loadHistoricalData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<MarketTick[]> {
  // TODO: Implement data loader
  // Could use:
  // - PolygonIO API
  // - CoinGecko for crypto
  // - Your existing market data source
  
  // Must return MarketTick[] with:
  // { close, high, low, open, volume, timestamp }
  
  throw new Error('Implement data loader for your data source');
}

/**
 * STEP 2: Run Validation
 * 
 * Execute the validator on your data
 * Returns: Do the 3 core assumptions actually hold?
 */
export async function runValidation(): Promise<VFMDValidationReport> {
  const validator = new VFMDBacktestValidator();

  // Load 12 months of BTC data (example)
  const startDate = new Date('2023-12-19');
  const endDate = new Date('2024-12-19');
  
  const ticks = await loadHistoricalData('BTC/USD', startDate, endDate);

  // Run validation
  const report = validator.validateAssumptions(ticks);

  return report;
}

/**
 * STEP 3: Interpret Results
 * 
 * What each "verdict" means:
 */
export function interpretValidationReport(report: VFMDValidationReport): void {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          VFMD VALIDATION REPORT - INTERPRETATION GUIDE          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // =========================================================================
  // ASSUMPTION 1: PEG VALIDATION
  // =========================================================================
  console.log('📊 ASSUMPTION 1: PEG Spikes Before Breakouts\n');
  console.log(`   Verdict: ${report.pegValidation.verdict}`);
  console.log(`   PEG Spikes Detected: ${report.pegValidation.pegSpikesDetected}`);
  console.log(`   Followed by Move: ${report.pegValidation.spikesFollowedByMove} (${
    (report.pegValidation.spikesFollowedByMove / report.pegValidation.pegSpikesDetected * 100).toFixed(0)
  }%)`);
  console.log(`   False Positive Rate: ${(report.pegValidation.falsePositiveRate * 100).toFixed(0)}%`);
  console.log(`   Average Lead Time: ${report.pegValidation.avgLeadTime.toFixed(1)} bars`);
  console.log(`   Correlation (confidence vs profit): ${report.pegValidation.pegMoveCorrelation.toFixed(3)}\n`);

  if (report.pegValidation.verdict === 'VALID') {
    console.log('   ✅ GOOD: PEG is a useful leading indicator');
    console.log('   Action: Use as-is for BREAKOUT_TRANSITION regime\n');
  } else if (report.pegValidation.verdict === 'QUESTIONABLE') {
    console.log('   ⚠️  QUESTIONABLE: PEG has merit but needs tuning');
    console.log('   Action: Try adding confirmation filters (e.g., require coherence > 0.6)\n');
  } else {
    console.log('   ❌ INVALID: PEG is not a reliable signal');
    console.log('   Action: Disable BREAKOUT_TRANSITION regime or redesign\n');
  }

  // =========================================================================
  // ASSUMPTION 2: TI VALIDATION
  // =========================================================================
  console.log('📊 ASSUMPTION 2: TI Identifies Choppy Markets\n');
  console.log(`   Verdict: ${report.tiValidation.verdict}`);
  console.log(`   Chop Events Detected (TI > 2.0): ${report.tiValidation.chopDetected}`);
  console.log(`   Actually Choppy: ${report.tiValidation.actuallyChoppy} (${
    (report.tiValidation.chopAccuracy * 100).toFixed(0)
  }%)`);
  console.log(`   False Positive Rate: ${(report.tiValidation.falsePositiveRate * 100).toFixed(0)}%`);
  console.log(`   (Times TI > 2.0 but market trended anyway)\n`);

  if (report.tiValidation.verdict === 'VALID') {
    console.log('   ✅ GOOD: TI > 2.0 correctly identifies choppy markets');
    console.log('   Action: Use TURBULENT_CHOP regime to avoid bad trades\n');
  } else if (report.tiValidation.verdict === 'QUESTIONABLE') {
    console.log('   ⚠️  QUESTIONABLE: TI threshold (2.0) may be wrong');
    console.log('   Action: Grid search for optimal TI threshold (1.5-2.5)\n');
  } else {
    console.log('   ❌ INVALID: TI threshold is too sensitive or wrong');
    console.log('   Action: Recalibrate TI computation or use different metric\n');
  }

  // =========================================================================
  // ASSUMPTION 3: REGIME VALIDATION
  // =========================================================================
  console.log('📊 ASSUMPTION 3: Regime Classifier Improves Results\n');
  console.log(`   Overall Verdict: ${report.regimeValidation.verdict}`);
  console.log(`   Overall Win Rate: ${(report.regimeValidation.overallWinRate * 100).toFixed(1)}%`);
  console.log(`   Overall Sharpe Ratio: ${report.regimeValidation.overallSharpe.toFixed(2)}`);
  console.log(`   Best Regime: ${report.regimeValidation.bestPerformingRegime}`);
  console.log(`   Worst Regime: ${report.regimeValidation.worstPerformingRegime}\n`);

  console.log('   Performance by Regime:\n');
  for (const [regime, perf] of Object.entries(report.regimeValidation.regimePerformance)) {
    console.log(`   ${regime}:`);
    console.log(`     Signals: ${perf.signalCount}`);
    console.log(`     Win Rate: ${(perf.winRate * 100).toFixed(1)}%`);
    console.log(`     Avg Profit: ${(perf.avgProfit * 100).toFixed(2)}%`);
    console.log(`     Sharpe: ${perf.sharpeRatio.toFixed(2)}`);
    console.log(`     Max Drawdown: ${(perf.maxDrawdown * 100).toFixed(2)}%\n`);
  }

  if (report.regimeValidation.verdict === 'VALID') {
    console.log('   ✅ GOOD: Regime-specific configs improve results');
    console.log('   Action: Use current regime configs\n');
  } else if (report.regimeValidation.verdict === 'QUESTIONABLE') {
    console.log('   ⚠️  QUESTIONABLE: Some regimes work, others need tuning');
    console.log('   Action: Optimize worst-performing regimes\n');
  } else {
    console.log('   ❌ INVALID: Regime classification not helping');
    console.log('   Action: Redesign regime definitions or use fixed thresholds\n');
  }

  // =========================================================================
  // SUMMARY & RECOMMENDATIONS
  // =========================================================================
  console.log('📋 SUMMARY\n');
  console.log(`   Backtest Period: ${report.summary.backtestPeriod.start.toLocaleDateString()} to ${
    report.summary.backtestPeriod.end.toLocaleDateString()
  }`);
  console.log(`   Total Signals: ${report.summary.totalSignals}`);
  console.log(`   Completed Trades: ${report.summary.totalTrades}`);
  console.log(`   Overall Confidence: ${report.summary.confidence}/10\n`);

  if (report.summary.mainIssues.length > 0) {
    console.log('   🚨 Issues Found:\n');
    for (const issue of report.summary.mainIssues) {
      console.log(`     - ${issue}`);
    }
    console.log('');
  }

  if (report.summary.recommendations.length > 0) {
    console.log('   💡 Recommendations:\n');
    for (const rec of report.summary.recommendations) {
      console.log(`     - ${rec}`);
    }
    console.log('');
  }

  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

/**
 * STEP 4: Detailed Analysis
 * 
 * If validation report shows issues, dive deeper
 */
export function detailedAnalysis(report: VFMDValidationReport): void {
  console.log('\n🔍 DETAILED ANALYSIS - Drilling Into Issues\n');

  // If PEG is questionable
  if (report.pegValidation.verdict !== 'VALID') {
    console.log('❌ PEG Issue Detected\n');
    console.log('   Problem: PEG false positive rate is high\n');
    console.log('   Analysis Options:');
    console.log('   1. Does PEG need a higher threshold?');
    console.log('      Current: minPEG in RegimeClassifier.ts');
    console.log('      Try: Increase from 1.5 to 2.0 or 2.5\n');
    console.log('   2. Does PEG need confirmation filters?');
    console.log('      Try: Require coherenceScore > 0.7 alongside PEG\n');
    console.log('   3. Is the PEG computation itself wrong?');
    console.log('      Check: PhysicsCalculator.computePEG() implementation\n');
  }

  // If TI is questionable
  if (report.tiValidation.verdict !== 'VALID') {
    console.log('❌ TI Issue Detected\n');
    console.log('   Problem: TI threshold may be miscalibrated\n');
    console.log('   Next Steps:');
    console.log('   1. Run threshold grid search (1.0 to 3.0, step 0.2)');
    console.log('   2. For each threshold, measure:');
    console.log('      - % false positives (TI spike but market trends)');
    console.log('      - % true positives (TI spike and market is choppy)');
    console.log('   3. Find threshold with best trade-off\n');
  }

  // If regimes are questionable
  if (report.regimeValidation.verdict !== 'VALID') {
    console.log('❌ Regime Classification Issue Detected\n');
    console.log('   Problem: Some regime configs not helping\n');
    console.log('   Optimization Steps:');
    console.log('   1. Find worst-performing regime');
    console.log('   2. Check its config in RegimeClassifier.ts');
    console.log('   3. Grid search optimal values:');
    console.log('      - minConfidence: 0.3 to 0.7, step 0.05');
    console.log('      - positionSizeMultiplier: 0.5 to 2.0, step 0.1');
    console.log('      - profitTargetMultiplier: 1.5 to 3.0, step 0.2\n');
    console.log('   4. Measure Sharpe ratio for each combination');
    console.log('   5. Keep config with highest Sharpe\n');
  }
}

/**
 * STEP 5: Threshold Optimization
 * 
 * If validation shows issues, use this to find optimal values
 */
export async function optimizeThresholds(): Promise<void> {
  console.log('\n🔧 THRESHOLD OPTIMIZATION GUIDE\n');
  console.log('If validation report shows thresholds are not optimal:\n');

  console.log('OPTION 1: Grid Search (Recommended)\n');
  console.log('  For each regime, test all combinations:\n');
  console.log('  minConfidence values: [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]');
  console.log('  positionSizeMultiplier: [0.5, 0.75, 1.0, 1.25, 1.5]');
  console.log('  profitTargetMultiplier: [1.5, 2.0, 2.5, 3.0]\n');
  console.log('  For each combination:');
  console.log('    - Run backtest with those settings');
  console.log('    - Measure: Win rate, Sharpe, max drawdown');
  console.log('    - Keep configuration with best Sharpe\n');

  console.log('OPTION 2: Sensitivity Analysis\n');
  console.log('  Test how sensitive results are to each threshold:\n');
  console.log('  For each threshold:');
  console.log('    - Vary it ±20% in 5% steps');
  console.log('    - Measure impact on win rate');
  console.log('    - If impact is small: threshold is robust');
  console.log('    - If impact is large: threshold is critical\n');

  console.log('Expected Outcome:');
  console.log('  Optimized thresholds should:');
  console.log('  - Improve win rate by 2-5%');
  console.log('  - Increase Sharpe ratio by 0.2-0.5');
  console.log('  - Reduce maximum drawdown by 10-20%\n');
}

/**
 * STEP 6: Confidence Assessment
 * 
 * How confident should you be before going live?
 */
export function confidenceAssessment(report: VFMDValidationReport): void {
  const confidence = report.summary.confidence;

  console.log('\n📈 CONFIDENCE ASSESSMENT\n');
  console.log(`Your validation confidence score: ${confidence}/10\n`);

  if (confidence >= 8) {
    console.log('✅ HIGH CONFIDENCE: Ready for live trading');
    console.log('   - All three assumptions are validated');
    console.log('   - Regime configs are working');
    console.log('   - Win rate is acceptable (>52%)');
    console.log('   - Recommended: Start with 1-2 positions per signal\n');
  } else if (confidence >= 6) {
    console.log('⚠️  MODERATE CONFIDENCE: Proceed with caution');
    console.log('   - Some assumptions need tuning');
    console.log('   - Fix issues identified in report');
    console.log('   - Run another validation after fixes');
    console.log('   - Recommended: Paper trading only, not live\n');
  } else if (confidence >= 4) {
    console.log('❌ LOW CONFIDENCE: Do not trade live');
    console.log('   - Multiple assumptions failing');
    console.log('   - Significant redesign needed');
    console.log('   - Fix all issues before any live trading\n');
  } else {
    console.log('🚨 CRITICAL: System is broken');
    console.log('   - All assumptions failing');
    console.log('   - Complete redesign recommended');
    console.log('   - Consider scrapping current approach\n');
  }
}

/**
 * COMPLETE WORKFLOW
 */
export async function runCompleteValidationWorkflow(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    VFMD VALIDATION WORKFLOW                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Load data
  console.log('Step 1: Loading historical data...');
  // const ticks = await loadHistoricalData('BTC/USD', new Date('2023-12-19'), new Date('2024-12-19'));

  // Step 2: Run validation
  console.log('Step 2: Running validation suite...');
  const report = await runValidation();

  // Step 3: Interpret results
  console.log('Step 3: Interpreting results...');
  interpretValidationReport(report);

  // Step 4: Detailed analysis if needed
  if (report.summary.mainIssues.length > 0) {
    console.log('Step 4: Analyzing issues...');
    detailedAnalysis(report);

    console.log('Step 5: Optimizing thresholds...');
    await optimizeThresholds();
  }

  // Step 5: Confidence assessment
  console.log('Step 6: Assessing confidence...');
  confidenceAssessment(report);

  console.log('\n✅ Validation workflow complete!\n');
}

// Export for easy use
export default {
  runValidation,
  interpretValidationReport,
  detailedAnalysis,
  optimizeThresholds,
  confidenceAssessment,
  runCompleteValidationWorkflow
};
