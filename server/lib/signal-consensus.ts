/**
 * Signal Consensus Engine
 * Shows how Scanner, ML, RL signals understand & validate each other
 * Resolves conflicts through weighted voting & reasoning
 */

export interface SourceSignal {
  source: 'scanner' | 'ml' | 'rl';
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  reasoning: string[];
}

export interface ConsensusResult {
  finalDecision: 'BUY' | 'SELL' | 'HOLD';
  agreementScore: number; // 0-100, how much sources agree
  confidenceScore: number; // 0-1, weighted confidence
  sourceBreakdown: {
    scanner: { vote: string; confidence: number; weight: number; contribution: number };
    ml: { vote: string; confidence: number; weight: number; contribution: number };
    rl: { vote: string; confidence: number; weight: number; contribution: number };
  };
  conflictAnalysis: string[];
  solidityReasons: string[];
}

export class SignalConsensusEngine {
  /**
   * Aggregate three independent signals into one unified decision
   * Each source operates independently, then votes on final direction
   */
  resolveSignalConsensus(
    scanner: SourceSignal,
    ml: SourceSignal,
    rl: SourceSignal,
    recentPerformance?: { scanner: number; ml: number; rl: number }
  ): ConsensusResult {
    // Adaptive weights: Use recent performance if available, otherwise default
    let weights = {
      scanner: 0.40,
      ml: 0.35,
      rl: 0.25
    };

    if (recentPerformance) {
      const total = recentPerformance.scanner + recentPerformance.ml + recentPerformance.rl;
      if (total > 0) {
        weights = {
          scanner: recentPerformance.scanner / total,
          ml: recentPerformance.ml / total,
          rl: recentPerformance.rl / total
        };
      }
    }

    // Step 1: Calculate weighted votes
    const scannerVote = this.directionToScore(scanner.direction) * weights.scanner;
    const mlVote = this.directionToScore(ml.direction) * weights.ml;
    const rlVote = this.directionToScore(rl.direction) * weights.rl;

    const totalVote = scannerVote + mlVote + rlVote;
    const normalizedVote = totalVote / (weights.scanner + weights.ml + weights.rl);

    // Step 2: Determine final direction
    const finalDecision: 'BUY' | 'SELL' | 'HOLD' = this.scoreToDirection(normalizedVote);

    // Step 3: Calculate agreement score (0-100)
    const agreementScore = this.calculateAgreement(scanner, ml, rl);

    // Step 4: Weighted confidence
    const confidenceScore =
      scanner.confidence * weights.scanner +
      ml.confidence * weights.ml +
      rl.confidence * weights.rl;

    // Step 5: Analyze conflicts
    const conflicts = this.identifyConflicts(scanner, ml, rl);

    // Step 6: Build reasoning
    const solidityReasons = this.buildSolidityReasons(
      scanner, ml, rl,
      finalDecision,
      agreementScore,
      confidenceScore
    );

    return {
      finalDecision,
      agreementScore,
      confidenceScore,
      sourceBreakdown: {
        scanner: {
          vote: scanner.direction,
          confidence: scanner.confidence,
          weight: weights.scanner,
          contribution: scannerVote
        },
        ml: {
          vote: ml.direction,
          confidence: ml.confidence,
          weight: weights.ml,
          contribution: mlVote
        },
        rl: {
          vote: rl.direction,
          confidence: rl.confidence,
          weight: weights.rl,
          contribution: rlVote
        }
      },
      conflictAnalysis: conflicts,
      solidityReasons
    };
  }

  /**
   * Example: Show how BTC/USDT signals converge
   */
  static exampleBtcUsdtConsensus(): ConsensusResult {
    const engine = new SignalConsensusEngine();

    // Scanner sees technical patterns: BREAKOUT, ACCUMULATION, TREND_ESTABLISHMENT
    const scanner: SourceSignal = {
      source: 'scanner',
      direction: 'BUY',
      confidence: 0.79,
      reasoning: [
        'BREAKOUT detected above $45,200 resistance',
        'High volume confirms momentum',
        'EMA20 above EMA50 with clean separation',
        'Support at $44,600 provides safety'
      ]
    };

    // ML models see historical patterns: LSTM + Transformer + Ensemble
    const ml: SourceSignal = {
      source: 'ml',
      direction: 'BUY',
      confidence: 0.87,
      reasoning: [
        'LSTM predicts 72% probability of continued uptrend',
        'Transformer detects similar price action to 3 previous successful runs',
        'Ensemble agreement: 87% confidence on BUY',
        'Pattern similarity score: 0.91 to historical bull runs'
      ]
    };

    // RL agent has learned optimal actions through Q-learning
    const rl: SourceSignal = {
      source: 'rl',
      direction: 'BUY',
      confidence: 0.70,
      reasoning: [
        'Q-value for BUY action: +0.68 (high positive)',
        'Episode rewards trending up: [+45, +52, +48, +51]',
        'Exploration rate now 15% (mostly exploiting learned policy)',
        'State space similarity: 89% match to profitable historical states'
      ]
    };

    return engine.resolveSignalConsensus(scanner, ml, rl);
  }

  private directionToScore(direction: string): number {
    if (direction === 'BUY') return 1.0;
    if (direction === 'SELL') return -1.0;
    return 0; // HOLD
  }

  private scoreToDirection(score: number): 'BUY' | 'SELL' | 'HOLD' {
    if (score > 0.3) return 'BUY';
    if (score < -0.3) return 'SELL';
    return 'HOLD';
  }

  /**
   * Agreement score: How much do the sources agree?
   * 100 = all three same direction
   * 50 = 2 vs 1
   * 0 = all three different
   */
  private calculateAgreement(
    scanner: SourceSignal,
    ml: SourceSignal,
    rl: SourceSignal
  ): number {
    let agreement = 0;

    // Confidence-weighted agreement: High confidence unanimity > Low confidence unanimity
    const allAgree = scanner.direction === ml.direction && ml.direction === rl.direction;
    const twoAgree = (scanner.direction === ml.direction || ml.direction === rl.direction || scanner.direction === rl.direction);
    const avgConfidence = (scanner.confidence + ml.confidence + rl.confidence) / 3;

    if (allAgree) {
      agreement = 100 * avgConfidence; // 3/3 agreement weighted by confidence
    } else if (twoAgree) {
      agreement = 65 * avgConfidence; // 2/3 agreement weighted by confidence
    } else {
      agreement = 30 * avgConfidence; // Conflicting signals, heavy discount
    }

    // Boost agreement if strongest sources agree (min 70% confidence on both)
    if (scanner.confidence >= 0.70 && ml.confidence >= 0.70 && scanner.direction === ml.direction) {
      agreement = Math.min(100, agreement * 1.1); // +10% boost for strong technical + ML agreement
    }

    return Math.round(Math.max(0, Math.min(100, agreement)));
  }

  private identifyConflicts(
    scanner: SourceSignal,
    ml: SourceSignal,
    rl: SourceSignal
  ): string[] {
    const conflicts: string[] = [];

    if (scanner.direction !== ml.direction) {
      conflicts.push(
        `Scanner/ML divergence: ${scanner.direction} vs ${ml.direction} - ` +
        `Technical vs pattern recognition disagreement`
      );
    }

    if (ml.direction !== rl.direction) {
      conflicts.push(
        `ML/RL divergence: ${ml.direction} vs ${rl.direction} - ` +
        `Pattern recognition vs learned behavior disagreement`
      );
    }

    if (scanner.direction !== rl.direction) {
      conflicts.push(
        `Scanner/RL divergence: ${scanner.direction} vs ${rl.direction} - ` +
        `Technical vs adaptive learning disagreement`
      );
    }

    return conflicts;
  }

  private buildSolidityReasons(
    scanner: SourceSignal,
    ml: SourceSignal,
    rl: SourceSignal,
    decision: string,
    agreement: number,
    confidence: number
  ): string[] {
    const reasons: string[] = [];

    // Strong consensus
    if (agreement >= 85) {
      reasons.push(`✓ STRONG CONSENSUS (${agreement}%): All three sources aligned`);
    } else if (agreement >= 65) {
      reasons.push(`✓ GOOD CONSENSUS (${agreement}%): Two sources strongly agree`);
    } else {
      reasons.push(`⚠ MODERATE CONSENSUS (${agreement}%): Sources partially aligned`);
    }

    // Confidence assessment
    if (confidence >= 0.80) {
      reasons.push(`✓ HIGH CONFIDENCE (${(confidence * 100).toFixed(1)}%): Strong signal across sources`);
    } else if (confidence >= 0.65) {
      reasons.push(`✓ GOOD CONFIDENCE (${(confidence * 100).toFixed(1)}%): Reasonable signal strength`);
    } else {
      reasons.push(`⚠ MODERATE CONFIDENCE (${(confidence * 100).toFixed(1)}%): Caution advised`);
    }

    // Source strength breakdown
    if (scanner.confidence >= 0.75 && ml.confidence >= 0.75) {
      reasons.push(`✓ Technical & ML agreement: Foundation is solid`);
    }

    if (rl.confidence >= 0.70 && (decision === 'BUY' || decision === 'SELL')) {
      reasons.push(`✓ RL convergence: Learning model has learned this pattern`);
    }

    // Risk assessment
    if (agreement < 50) {
      reasons.push(`⚠ CONFLICT WARNING: Sources are disagreeing - higher risk`);
    }

    return reasons;
  }
}

/**
 * Real-world example of signal convergence
 */
export function demonstrateSignalConvergence() {
  const consensus = SignalConsensusEngine.exampleBtcUsdtConsensus();

  console.log('\n=== BTC/USDT SIGNAL CONVERGENCE ===\n');

  console.log('SCANNER (40% weight):');
  console.log(`  Vote: ${consensus.sourceBreakdown.scanner.vote}`);
  console.log(`  Confidence: ${(consensus.sourceBreakdown.scanner.confidence * 100).toFixed(1)}%`);
  console.log(`  Contribution to final decision: ${(consensus.sourceBreakdown.scanner.contribution * 100).toFixed(1)}%`);
  console.log('  Reasoning:');
  console.log('    - Detects BREAKOUT above key resistance');
  console.log('    - Volume confirms momentum');
  console.log('    - EMA alignment bullish\n');

  console.log('ML MODEL (35% weight):');
  console.log(`  Vote: ${consensus.sourceBreakdown.ml.vote}`);
  console.log(`  Confidence: ${(consensus.sourceBreakdown.ml.confidence * 100).toFixed(1)}%`);
  console.log(`  Contribution to final decision: ${(consensus.sourceBreakdown.ml.contribution * 100).toFixed(1)}%`);
  console.log('  Reasoning:');
  console.log('    - Pattern recognition: 91% similarity to past bull runs');
  console.log('    - LSTM forecast: 72% probability uptrend continues');
  console.log('    - Ensemble: 87% confidence\n');

  console.log('RL AGENT (25% weight):');
  console.log(`  Vote: ${consensus.sourceBreakdown.rl.vote}`);
  console.log(`  Confidence: ${(consensus.sourceBreakdown.rl.confidence * 100).toFixed(1)}%`);
  console.log(`  Contribution to final decision: ${(consensus.sourceBreakdown.rl.contribution * 100).toFixed(1)}%`);
  console.log('  Reasoning:');
  console.log('    - Q-value: +0.68 (strong positive action value)');
  console.log('    - Recent episodes profitable: [+45, +52, +48, +51]');
  console.log('    - State match: 89% to known winners\n');

  console.log('=== UNIFIED CONSENSUS ===');
  console.log(`Final Decision: ${consensus.finalDecision}`);
  console.log(`Agreement Score: ${consensus.agreementScore}/100`);
  console.log(`Confidence: ${(consensus.confidenceScore * 100).toFixed(1)}%`);
  console.log('\nSolidity Reasons:');
  consensus.solidityReasons.forEach(reason => console.log(`  ${reason}`));

  console.log('\nConflicts: ' + (consensus.conflictAnalysis.length === 0 ? 'None - full alignment!' : ''));
  consensus.conflictAnalysis.forEach(conflict => console.log(`  ⚠ ${conflict}`));
}
