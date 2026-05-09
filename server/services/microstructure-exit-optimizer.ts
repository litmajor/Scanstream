/**
 * Microstructure Exit Optimizer
 * 
 * Monitors market microstructure deterioration to trigger early exits
 * Works in sync with IntelligentExitManager for adaptive exit strategies
 * 
 * SIGNALS DETECTED:
 * 1. Spread Widening → Liquidity drying up
 * 2. Order Imbalance Reversal → Trend exhaustion
 * 3. Volume Spike → Potential reversal
 * 4. Depth Deterioration → Support breaking
 * 
 * ACTIONS:
 * - EXIT_URGENT: Immediate full exit (liquidity crisis)
 * - EXIT_STANDARD: Normal exit (trend exhaustion)
 * - TIGHTEN_STOP: Trail tighter (volume warning)
 * - REDUCE_SIZE: Exit 50% (reversal detected)
 * - STAY: Hold position
 */

export interface MicrostructureData {
  spread: number;                    // bid-ask spread in price units
  spreadPercent: number;             // spread as % of price
  bidVolume: number;                 // volume at bid
  askVolume: number;                 // volume at ask
  netFlow: number;                   // cumulative buy-sell pressure
  orderImbalance: 'BUY' | 'SELL' | 'BALANCED';  // imbalance direction
  volumeRatio: number;               // current volume / 20-period avg
  bidAskRatio: number;               // bid volume / ask volume
  price: number;                     // current price
}

export interface MicrostructureSignal {
  action: 'EXIT_URGENT' | 'EXIT_STANDARD' | 'REDUCE_SIZE' | 'TIGHTEN_STOP' | 'STAY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signals: string[];                 // Detected microstructure issues
  recommendation: string;
  adjustedStop?: number;             // Recommended adjusted stop (for TIGHTEN_STOP)
  priceReaction?: 'CONTINUATION' | 'WEAKNESS' | 'REVERSAL' | 'NEUTRAL';
  absorptionDetected?: boolean;
  sweepSequence?: MicrostructureSweepSequence;
  signalSequence?: MicrostructureSequence[];
  positionContext?: PositionContextAwareness;
}

// ============================================================================
// UPGRADE 1: PRICE REACTION TO MICROSTRUCTURE
// ============================================================================
export interface PriceReactionAnalysis {
  type: 'CONTINUATION' | 'WEAKNESS' | 'REVERSAL' | 'NEUTRAL';
  confidence: number;              // 0-100
  priceMovement: number;           // pixels/ticks moved
  momentumDirection: number;       // positive = up, negative = down
  reactionStrength: number;        // how decisive was the reaction?
  reasoning: string;
}

// ============================================================================
// UPGRADE 2: ABSORPTION DETECTION
// ============================================================================
export interface AbsorptionSignal {
  detected: boolean;
  type: 'BUY_ABSORPTION' | 'SELL_ABSORPTION' | 'NONE';
  volumeIn: number;               // Volume that came in against the trend
  priceMove: number;              // How much price moved (or didn't)
  absorptionRatio: number;        // volume / price change ratio (high = absorption)
  confidence: number;             // 0-100
  institutional: boolean;         // High volume suggests institutions
}

// ============================================================================
// UPGRADE 3: LIQUIDITY SWEEP → REACTION CHAIN
// ============================================================================
export interface MicrostructureSweepSequence {
  imbalanceSpike: boolean;
  imbalanceReversed: boolean;
  priceSnapBack: boolean;
  timingMs: number;              // How fast did snap-back occur?
  trapConfidence: number;        // 0-100, is this a trap/sweep?
  narrative: string;
}

// ============================================================================
// UPGRADE 4: SIGNAL SEQUENCING (Microstructure)
// ============================================================================
export type MicrostructureEventType = 'SPREAD_SPIKE' | 'IMBALANCE_FLIP' | 'VOLUME_SPIKE' | 'DEPTH_DROP' | 'SNAP_BACK' | 'ABSORPTION';

export interface MicrostructureSequence {
  events: MicrostructureEventType[];
  strength: number;              // How complete is this pattern? 0-100
  severity: number;              // 0-100
  narrative: string;             // Human readable
  timestamp: number;
}

// ============================================================================
// UPGRADE 5: POSITION CONTEXT AWARENESS
// ============================================================================
export interface PositionContextAwareness {
  entryQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Where did entry occur in structure?
  profitPercentage: number;     // How much profit are we in?
  tradeAge: number;             // How long have we been in trade (ms)?
  distanceFromEntry: number;    // Current price - entry price
  structurePhase: 'EARLY' | 'MID' | 'LATE' | 'EXHAUSTION'; // Where are we in move?
  riskReward: number;           // Current risk/reward ratio
  signalWeight: number;         // How much should we weight this signal? (0-1)
}

// ============================================================================
// UPGRADE 6: DEPTH PERSISTENCE & HIDDEN ORDERS
// ============================================================================
export interface DepthPersistenceData {
  depthLevel: number;           // Current visible depth
  depthHistory: number[];
  isRefilling: boolean;         // Depth recovering?
  isVanishing: boolean;         // Depth disappearing?
  refillRate: number;           // How quickly depth refills? positive = refilling
  estimatedHiddenOrders: number; // Based on refill behavior
  depthTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  liquidityQuality: 'REAL' | 'QUESTIONABLE' | 'ARTIFICIAL';
}

export class MicrostructureExitOptimizer {
  // Configuration - thresholds for microstructure detection
  private readonly SPREAD_WIDENING_THRESHOLD = 2.0;      // 2x normal = liquidity warning
  private readonly VOLUME_SPIKE_THRESHOLD = 1.8;         // 1.8x average = potential reversal
  private readonly ORDER_IMBALANCE_THRESHOLD = 0.3;      // 30% imbalance = significant
  private readonly DEPTH_DETERIORATION_THRESHOLD = 0.5;  // 50% depth loss = warning
  
  // History tracking for deterioration detection
  private spreadHistory: number[] = [];
  private volumeHistory: number[] = [];
  private orderFlowHistory: number[] = [];
  private depthHistory: number[] = [];
  private readonly HISTORY_LENGTH = 5;  // Track last 5 candles

  // ========== UPGRADE 1: Price Reaction Tracking ==========
  private priceHistory: number[] = [];
  private momentumHistory: number[] = [];
  
  // ========== UPGRADE 2: Absorption Detection ==========
  private absorptionHistory: AbsorptionSignal[] = [];
  
  // ========== UPGRADE 3: Sweep Sequence Tracking ==========
  private lastImbalanceFlip: number = 0;
  private lastSnapBackTime: number = 0;
  private sweepSequenceActive: boolean = false;
  
  // ========== UPGRADE 4: Signal Sequencing ==========
  private microstructureEventHistory: MicrostructureEventType[] = [];
  private eventTimestamps: number[] = [];
  private readonly EVENT_HISTORY_LENGTH = 10;
  
  // ========== UPGRADE 5: Position Context ==========
  private entryPrice: number = 0;
  private entryTime: number = 0;
  private entryQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'FAIR';
  
  // ========== UPGRADE 6: Depth Persistence ==========
  private depthRefillHistory: number[] = [];
  private depthLastUpdate: number = 0;

  constructor() {
    this.clearHistory();
  }

  /**
   * Main analysis method - detect microstructure deterioration
   * Call this every candle/price update
   */
  analyzeMicrostructure(
    current: MicrostructureData,
    previous?: MicrostructureData,
    signalType: 'BUY' | 'SELL' = 'BUY',
    entryPrice?: number,
    currentTime?: number
  ): MicrostructureSignal {
    const signals: string[] = [];
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let action: MicrostructureSignal['action'] = 'STAY';

    // Update entry context if provided
    if (entryPrice !== undefined) {
      this.entryPrice = entryPrice;
      if (!this.entryTime) this.entryTime = currentTime || Date.now();
    }

    // Update history
    this.updateHistory(current, currentTime);

    // ========== UPGRADE 1: Price Reaction Analysis ==========
    const priceReaction = this.analyzePriceReaction(current, previous, signalType);

    // ========== UPGRADE 2: Absorption Detection ==========
    const absorptionSignal = this.detectAbsorption(current, previous, signalType);
    if (absorptionSignal.detected) {
      signals.push(`Absorption detected: ${absorptionSignal.type} (ratio: ${absorptionSignal.absorptionRatio.toFixed(2)})`);
      severity = 'MEDIUM';
    }

    // ========== UPGRADE 3: Sweep + Reaction Chain ==========
    const sweepSequence = this.detectSweepSequence(current, previous, currentTime);
    if (sweepSequence.trapConfidence > 70) {
      signals.push(`Sweep trap detected: ${sweepSequence.narrative}`);
      severity = severity === 'LOW' ? 'MEDIUM' : severity;
    }

    // ========== UPGRADE 4: Signal Sequencing ==========
    this.trackMicrostructureSequence(current, previous, signalType);
    const sequences = this.detectMicrostructureSequences();

    // ========== UPGRADE 5: Position Context ==========
    const positionContext = this.buildPositionContext(current, signalType, currentTime);
    
    // ========== UPGRADE 6: Depth Persistence ==========
    const depthPersistence = this.analyzeDepthPersistence(current);

    // DETECTION 1: Spread Widening → Liquidity Crisis
    const spreadAnalysis = this.analyzeSpreadWidening(current, previous);
    if (spreadAnalysis.detected) {
      signals.push(spreadAnalysis.message);
      // UPGRADE 1: Check if price is still trending strongly
      if (priceReaction.type === 'CONTINUATION' && priceReaction.confidence > 70) {
        spreadAnalysis.severity *= 0.5; // Reduce severity - this is continuation, not weakness
        signals[signals.length - 1] += ' [BUT price continuing strong - not weakness]';
      }
      
      if (spreadAnalysis.severity > 0.8) {
        severity = 'CRITICAL';
        action = 'EXIT_URGENT';
      } else if (spreadAnalysis.severity > 0.6) {
        severity = 'HIGH';
        action = action === 'STAY' ? 'TIGHTEN_STOP' : action;
      }
    }

    // DETECTION 2: Order Imbalance Reversal → Trend Exhaustion
    const imbalanceAnalysis = this.analyzeOrderImbalanceReversal(
      current,
      previous,
      signalType
    );
    if (imbalanceAnalysis.detected) {
      signals.push(imbalanceAnalysis.message);
      if (imbalanceAnalysis.severity > 0.8) {
        severity = 'CRITICAL';
        action = 'EXIT_STANDARD';
      } else if (imbalanceAnalysis.severity > 0.5) {
        severity = action === 'STAY' ? 'MEDIUM' : severity;
        action = action === 'STAY' ? 'REDUCE_SIZE' : action;
      }
    }

    // DETECTION 3: Volume Spike → Potential Reversal
    const volumeAnalysis = this.analyzeVolumeSpike(current, signalType);
    if (volumeAnalysis.detected) {
      signals.push(volumeAnalysis.message);
      if (volumeAnalysis.severity > 0.7) {
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
        action = action === 'STAY' ? 'TIGHTEN_STOP' : action;
      }
    }

    // DETECTION 4: Depth Deterioration → Support Breaking
    const depthAnalysis = this.analyzeDepthDeterioration(current);
    if (depthAnalysis.detected) {
      signals.push(depthAnalysis.message);
      // UPGRADE 6: Factor in depth persistence
      if (depthPersistence.liquidityQuality === 'ARTIFICIAL' || depthPersistence.isVanishing) {
        depthAnalysis.severity *= 1.5; // Boost severity if liquidity is artificial/vanishing
        signals[signals.length - 1] += ` [Liquidity is ${depthPersistence.liquidityQuality}]`;
      }
      
      if (depthAnalysis.severity > 0.75) {
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
        action = action === 'STAY' ? 'TIGHTEN_STOP' : action;
      }
    }

    // Build recommendation
    const recommendation = this.buildRecommendation(action, signals);

    // Calculate adjusted stop if needed (tighter trailing)
    let adjustedStop: number | undefined;
    if (action === 'TIGHTEN_STOP') {
      // Trail tighter - use smaller multiplier
      const tightTrail = signalType === 'BUY'
        ? current.price * 0.995  // 0.5% trail for BUY
        : current.price * 1.005; // 0.5% trail for SELL
      adjustedStop = tightTrail;
    }

    // UPGRADE 5: Adjust signal weight based on position context
    const signalWeight = positionContext.signalWeight;
    const adjustedSeverityMultiplier = signalWeight;

    const result: MicrostructureSignal = {
      action: severity === 'CRITICAL' && signalWeight > 0.7 ? action : action,
      severity,
      signals,
      recommendation,
      adjustedStop,
      priceReaction: priceReaction.type,
      absorptionDetected: absorptionSignal.detected,
      sweepSequence,
      signalSequence: sequences.length > 0 ? sequences : undefined,
      positionContext
    };

    return result;
  }

  // ============================================================================
  // UPGRADE 1: PRICE REACTION TO MICROSTRUCTURE
  // ============================================================================

  /**
   * Analyze price reaction to microstructure signals
   * Should price keep trending strongly despite wide spreads? That's strength, not weakness.
   */
  private analyzePriceReaction(
    current: MicrostructureData,
    previous: MicrostructureData | undefined,
    signalType: 'BUY' | 'SELL'
  ): PriceReactionAnalysis {
    this.priceHistory.push(current.price);
    if (this.priceHistory.length > 10) this.priceHistory.shift();

    const priceMove = previous ? current.price - previous.price : 0;
    const momentum = priceMove * (signalType === 'BUY' ? 1 : -1); // Positive = expected direction

    this.momentumHistory.push(momentum);
    if (this.momentumHistory.length > 5) this.momentumHistory.shift();

    // Calculate momentum trend
    const avgMomentum = this.momentumHistory.reduce((a, b) => a + b, 0) / this.momentumHistory.length;
    const momentumDirection = avgMomentum > 0 ? 1 : -1;

    // Analyze reaction strength
    const reactionStrength = Math.abs(priceMove) / (current.spread + 0.001);

    let type: 'CONTINUATION' | 'WEAKNESS' | 'REVERSAL' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;

    // CONTINUATION: Price moving decisively in signal direction despite signals
    if (momentum > 0 && reactionStrength > 2.0) {
      type = 'CONTINUATION';
      confidence = Math.min(90, 60 + reactionStrength * 10);
    }
    // WEAKNESS: Price not responding or moving against signal
    else if (momentum <= 0 && reactionStrength < 1.0) {
      type = 'WEAKNESS';
      confidence = Math.min(90, 60 + (1 - reactionStrength) * 20);
    }
    // REVERSAL: Sharp move counter to signal direction
    else if (momentum < -priceMove * 2 && reactionStrength > 1.5) {
      type = 'REVERSAL';
      confidence = 85;
    }

    return {
      type,
      confidence,
      priceMovement: priceMove,
      momentumDirection: momentumDirection * 100,
      reactionStrength,
      reasoning: `Price reaction: ${type} (momentum: ${momentum > 0 ? 'strong' : 'weak'})`
    };
  }

  // ============================================================================
  // UPGRADE 2: ABSORPTION DETECTION
  // ============================================================================

  /**
   * Detect absorption: Heavy volume enters but price doesn't move much
   * This is institutional defense/absorption pattern
   */
  private detectAbsorption(
    current: MicrostructureData,
    previous: MicrostructureData | undefined,
    signalType: 'BUY' | 'SELL'
  ): AbsorptionSignal {
    if (!previous) {
      return {
        detected: false,
        type: 'NONE',
        volumeIn: 0,
        priceMove: 0,
        absorptionRatio: 0,
        confidence: 0,
        institutional: false
      };
    }

    const priceMove = Math.abs(current.price - previous.price);
    const volumeIn = current.bidVolume + current.askVolume;  // Estimate volume from depth
    const bidAskImbalance = Math.abs(current.bidVolume - current.askVolume);
    
    // Heavy volume but small price move = absorption
    const isHeavyVolume = current.volumeRatio > 1.5;
    const isSmallMove = priceMove < (current.spread * 2);
    
    const absorptionRatio = isSmallMove && volumeIn > 0 ? volumeIn / (priceMove + 0.001) : 0;

    // Absorption: volume / price is very high (little price for lot of volume)
    const isAbsorption = absorptionRatio > 50 && isHeavyVolume;

    if (!isAbsorption) {
      return {
        detected: false,
        type: 'NONE',
        volumeIn,
        priceMove,
        absorptionRatio,
        confidence: 0,
        institutional: false
      };
    }

    // Determine type: which direction is being absorbed?
    const type = signalType === 'BUY'
      ? current.askVolume > current.bidVolume ? 'BUY_ABSORPTION' : 'SELL_ABSORPTION'
      : current.bidVolume > current.askVolume ? 'SELL_ABSORPTION' : 'BUY_ABSORPTION';

    const confidence = Math.min(100, 60 + absorptionRatio / 10);
    const institutional = current.volumeRatio > 2.0 && (current.bidVolume + current.askVolume) > 10000;

    return {
      detected: true,
      type,
      volumeIn,
      priceMove,
      absorptionRatio,
      confidence,
      institutional
    };
  }

  // ============================================================================
  // UPGRADE 3: LIQUIDITY SWEEP → REACTION CHAIN
  // ============================================================================

  /**
   * Detect sweep sequences: imbalance spike → imbalance flip → price snap back = trap
   * This reveals engineered liquidity and stop hunts
   */
  private detectSweepSequence(
    current: MicrostructureData,
    previous: MicrostructureData | undefined,
    currentTime: number = Date.now()
  ): MicrostructureSweepSequence {
    if (!previous) {
      return {
        imbalanceSpike: false,
        imbalanceReversed: false,
        priceSnapBack: false,
        timingMs: 0,
        trapConfidence: 0,
        narrative: 'No previous data'
      };
    }

    // Stage 1: Imbalance Spike (heavy one-sided volume)
    const prevImbalanceRatio = (previous.bidVolume + 1) / (previous.askVolume + 1);
    const currImbalanceRatio = (current.bidVolume + 1) / (current.askVolume + 1);
    const imbalanceSpike = Math.abs(Math.log(currImbalanceRatio / prevImbalanceRatio)) > 0.5;

    // Stage 2: Imbalance Reversal (flips to opposite side)
    const imbalanceReversed = (currImbalanceRatio > 1 && prevImbalanceRatio < 1) ||
                             (currImbalanceRatio < 1 && prevImbalanceRatio > 1);

    // Stage 3: Price Snap Back (price quickly reverses)
    const recentMoves = this.priceHistory.slice(-3);
    const priceSnapBack = recentMoves.length > 1 &&
                          recentMoves[recentMoves.length - 1] * recentMoves[recentMoves.length - 2] < 0; // Direction changes

    const timingMs = currentTime - this.lastImbalanceFlip;
    const isFastReaction = timingMs < 500 && timingMs > 0; // Snap back within 500ms = trap signal

    const trapConfidence =  imbalanceSpike && imbalanceReversed && priceSnapBack && isFastReaction
      ? 85
      : imbalanceSpike && imbalanceReversed ? 60 : 20;

    const narrative = imbalanceSpike && imbalanceReversed && priceSnapBack
      ? `Sweep trap: imbalance spike → flip → snap back (${timingMs}ms)`
      : 'Mixed signals';

    if (imbalanceReversed) {
      this.lastImbalanceFlip = currentTime;
    }

    return {
      imbalanceSpike,
      imbalanceReversed,
      priceSnapBack,
      timingMs,
      trapConfidence,
      narrative
    };
  }

  // ============================================================================
  // UPGRADE 4: SIGNAL SEQUENCING
  // ============================================================================

  /**
   * Track microstructure event sequences
   */
  private trackMicrostructureSequence(
    current: MicrostructureData,
    previous: MicrostructureData | undefined,
    signalType: 'BUY' | 'SELL'
  ): void {
    if (!previous) return;

    const events: MicrostructureEventType[] = [];
    const now = Date.now();

    // Detect which events occurred
    const spreadRatio = current.spreadPercent / (previous.spreadPercent + 0.001);
    if (spreadRatio > 1.5) events.push('SPREAD_SPIKE');

    const imbalanceFlip = (current.bidAskRatio > 1.2 && previous.bidAskRatio < 0.8) ||
                          (current.bidAskRatio < 0.8 && previous.bidAskRatio > 1.2);
    if (imbalanceFlip) events.push('IMBALANCE_FLIP');

    if (current.volumeRatio > this.VOLUME_SPIKE_THRESHOLD) events.push('VOLUME_SPIKE');

    const depthRatio = (current.bidVolume + current.askVolume) / (previous.bidVolume + previous.askVolume + 1);
    if (depthRatio < 0.5) events.push('DEPTH_DROP');

    // Add events to history
    for (const event of events) {
      this.microstructureEventHistory.push(event);
      this.eventTimestamps.push(now);
    }

    // Maintain length
    while (this.microstructureEventHistory.length > this.EVENT_HISTORY_LENGTH) {
      this.microstructureEventHistory.shift();
      this.eventTimestamps.shift();
    }
  }

  /**
   * Detect complete microstructure sequences
   */
  private detectMicrostructureSequences(): MicrostructureSequence[] {
    const sequences: MicrostructureSequence[] = [];

    // Common patterns: SPREAD_SPIKE → IMBALANCE_FLIP → DEPTH_DROP (collapse sequence)
    const collapsePattern: MicrostructureEventType[] = ['SPREAD_SPIKE', 'IMBALANCE_FLIP', 'DEPTH_DROP'];
    if (this.matchesPattern(collapsePattern)) {
      sequences.push({
        events: collapsePattern,
        strength: 90,
        severity: 85,
        narrative: 'Liquidity Collapse: spread → imbalance → depth drop',
        timestamp: this.eventTimestamps[this.eventTimestamps.length - 1] || 0
      });
    }

    return sequences;
  }

  /**
   * Check if event history contains a pattern (allows gaps)
   */
  private matchesPattern(pattern: MicrostructureEventType[]): boolean {
    let patternIndex = 0;
    for (let i = 0; i < this.microstructureEventHistory.length && patternIndex < pattern.length; i++) {
      if (this.microstructureEventHistory[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }
    return patternIndex === pattern.length;
  }

  // ============================================================================
  // UPGRADE 5: POSITION CONTEXT AWARENESS
  // ============================================================================

  /**
   * Build position context to weight signals appropriately
   * Early trade = ignore weak signals, late trade = exit on weak signals
   */
  private buildPositionContext(
    current: MicrostructureData,
    signalType: 'BUY' | 'SELL',
    currentTime: number = Date.now()
  ): PositionContextAwareness {
    const profitPercentage = this.entryPrice > 0
      ? ((current.price - this.entryPrice) / this.entryPrice) * 100
      : 0;

    const tradeAge = currentTime - this.entryTime;
    const distanceFromEntry = current.price - this.entryPrice;

    // Determine structure phase
    let structurePhase: 'EARLY' | 'MID' | 'LATE' | 'EXHAUSTION' = 'MID';
    if (tradeAge < 60000) structurePhase = 'EARLY';      // < 1 min
    else if (tradeAge < 300000) structurePhase = 'MID';   // < 5 min
    else if (tradeAge < 900000) structurePhase = 'LATE';  // < 15 min
    else structurePhase = 'EXHAUSTION';                   // > 15 min

    // Risk/reward calculation (simplified)
    const riskReward = Math.abs(distanceFromEntry) > 0 ? profitPercentage / Math.max(0.5, Math.abs(distanceFromEntry)) : 1;

    // Signal weight: How much should we trust this signal?
    let signalWeight = 0.5;
    if (structurePhase === 'EARLY') signalWeight = 0.3;   // Early = low weight (harder exits)
    else if (structurePhase === 'MID') signalWeight = 0.6;
    else if (structurePhase === 'LATE') signalWeight = 0.8;
    else if (structurePhase === 'EXHAUSTION') signalWeight = 1.0; // Exits heavily weighted

    return {
      entryQuality: this.entryQuality,
      profitPercentage,
      tradeAge,
      distanceFromEntry,
      structurePhase,
      riskReward,
      signalWeight
    };
  }

  // ============================================================================
  // UPGRADE 6: DEPTH PERSISTENCE & HIDDEN ORDERS
  // ============================================================================

  /**
   * Analyze depth persistence to detect hidden orders and liquidity quality
   * Real liquidity refills quickly; artificial liquidity vanishes
   */
  private analyzeDepthPersistence(current: MicrostructureData): DepthPersistenceData {
    const totalDepth = current.bidVolume + current.askVolume;

    this.depthRefillHistory.push(totalDepth);
    if (this.depthRefillHistory.length > 10) {
      this.depthRefillHistory.shift();
    }

    // Calculate refill rate (how fast does depth recover?)
    const refillRate = this.depthRefillHistory.length > 1
      ? (totalDepth - this.depthRefillHistory[0]) / (this.depthRefillHistory.length - 1)
      : 0;

    // Determine depth trend
    const isRefilling = refillRate > 100;    // Recovering
    const isVanishing = refillRate < -500;   // Disappearing fast
    const isStable = Math.abs(refillRate) < 100;

    let depthTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' = 'STABLE';
    if (isRefilling) depthTrend = 'IMPROVING';
    else if (isVanishing) depthTrend = 'DETERIORATING';

    // Estimate hidden orders based on refill behavior
    // If depth disappears quickly then refills = likely hidden orders being consumed/replenished
    const estimatedHiddenOrders = isRefilling ? totalDepth * 0.3 : 0;

    // Liquidity quality assessment
    let liquidityQuality: 'REAL' | 'QUESTIONABLE' | 'ARTIFICIAL' = 'REAL';
    if (isVanishing && totalDepth < 1000) liquidityQuality = 'ARTIFICIAL'; // Thin + disappearing = fake
    else if (isRefilling && totalDepth > 5000) liquidityQuality = 'REAL';   // Deep + recovering = real
    else liquidityQuality = 'QUESTIONABLE';

    return {
      depthLevel: totalDepth,
      depthHistory: [...this.depthRefillHistory],
      isRefilling,
      isVanishing,
      refillRate,
      estimatedHiddenOrders,
      depthTrend,
      liquidityQuality
    };
  }

  /**
   * Detect spread widening - indicator of drying liquidity
   */
  private analyzeSpreadWidening(
    current: MicrostructureData,
    previous?: MicrostructureData
  ): { detected: boolean; severity: number; message: string } {
    // Calculate average spread from history
    const avgSpread = this.spreadHistory.length > 0
      ? this.spreadHistory.reduce((a, b) => a + b, 0) / this.spreadHistory.length
      : current.spreadPercent;

    // Check for widening
    const spreadRatio = current.spreadPercent / Math.max(avgSpread, 0.001);
    const isWidening = spreadRatio > this.SPREAD_WIDENING_THRESHOLD;

    if (!isWidening) {
      return {
        detected: false,
        severity: 0,
        message: ''
      };
    }

    // Severity based on how much wider
    const severity = Math.min(
      (spreadRatio - this.SPREAD_WIDENING_THRESHOLD) / this.SPREAD_WIDENING_THRESHOLD,
      1.0
    );

    const message = `Spread Widening: ${(spreadRatio * 100 - 100).toFixed(1)}% (${current.spreadPercent.toFixed(4)}% vs avg ${avgSpread.toFixed(4)}%) - Liquidity drying`;

    return {
      detected: true,
      severity,
      message
    };
  }

  /**
   * Detect order imbalance reversal - trend exhaustion signal
   */
  private analyzeOrderImbalanceReversal(
    current: MicrostructureData,
    previous?: MicrostructureData,
    signalType: 'BUY' | 'SELL' = 'BUY'
  ): { detected: boolean; severity: number; message: string } {
    // Check if order imbalance has flipped against us
    const isFlipped = signalType === 'BUY'
      ? current.orderImbalance === 'SELL'  // Buyers were pushing, now sellers
      : current.orderImbalance === 'BUY';  // Sellers were pushing, now buyers

    if (!isFlipped) {
      return {
        detected: false,
        severity: 0,
        message: ''
      };
    }

    // Check net flow intensity
    const netFlowStrength = Math.abs(current.netFlow);
    const flowThreshold = 500;  // Significant flow threshold

    if (netFlowStrength < flowThreshold) {
      return {
        detected: false,
        severity: 0,
        message: ''
      };
    }

    // Calculate severity based on flow reversal strength
    const severity = Math.min(netFlowStrength / 2000, 1.0);

    const direction = signalType === 'BUY' ? 'SELLERS' : 'BUYERS';
    const message = `Order Imbalance Reversal: ${direction} pushing back (net flow: ${current.netFlow.toFixed(0)}) - Trend exhaustion`;

    return {
      detected: true,
      severity,
      message
    };
  }

  /**
   * Detect volume spikes - potential reversal indicator
   */
  private analyzeVolumeSpike(
    current: MicrostructureData,
    signalType: 'BUY' | 'SELL' = 'BUY'
  ): { detected: boolean; severity: number; message: string } {
    // Check if volume is spiking
    const isSpike = current.volumeRatio > this.VOLUME_SPIKE_THRESHOLD;

    if (!isSpike) {
      return {
        detected: false,
        severity: 0,
        message: ''
      };
    }

    // Analyze if spike is in expected direction or against us
    const expectedDirection = signalType === 'BUY'
      ? current.bidAskRatio > 1.2  // Should be more bid volume
      : current.bidAskRatio < 0.8; // Should be more ask volume

    const severity = expectedDirection
      ? 0.3  // Low severity - volume supporting trend
      : 0.7; // High severity - volume against us

    const message = expectedDirection
      ? `Volume Spike (${(current.volumeRatio * 100).toFixed(0)}% of avg) in expected direction - Monitor for pullback`
      : `Volume Spike (${(current.volumeRatio * 100).toFixed(0)}% of avg) against trend - Potential reversal`;

    return {
      detected: true,
      severity,
      message
    };
  }

  /**
   * Detect depth deterioration - support/resistance breaking
   */
  private analyzeDepthDeterioration(
    current: MicrostructureData
  ): { detected: boolean; severity: number; message: string } {
    // Simple depth proxy: if bid-ask volumes are very unbalanced, depth is likely poor
    const totalDepth = current.bidVolume + current.askVolume;
    const avgDepth = this.depthHistory.length > 0
      ? this.depthHistory.reduce((a, b) => a + b, 0) / this.depthHistory.length
      : totalDepth;

    const depthRatio = totalDepth / Math.max(avgDepth, 1);
    const isDeterioration = depthRatio < (1 - this.DEPTH_DETERIORATION_THRESHOLD);

    if (!isDeterioration) {
      return {
        detected: false,
        severity: 0,
        message: ''
      };
    }

    const severity = Math.min(
      (1 - this.DEPTH_DETERIORATION_THRESHOLD - (1 - depthRatio)) /
      this.DEPTH_DETERIORATION_THRESHOLD,
      1.0
    );

    const message = `Depth Deterioration: ${(depthRatio * 100).toFixed(0)}% of normal - Limited liquidity for exits`;

    return {
      detected: true,
      severity,
      message
    };
  }

  /**
   * Build human-readable recommendation
   */
  private buildRecommendation(
    action: MicrostructureSignal['action'],
    signals: string[]
  ): string {
    switch (action) {
      case 'EXIT_URGENT':
        return '🚨 URGENT: Exit immediately - liquidity crisis detected';
      case 'EXIT_STANDARD':
        return '⚠️ EXIT: Microstructure deterioration signals trend exhaustion';
      case 'REDUCE_SIZE':
        return '⚡ REDUCE: Exit 50% position - reversal detected';
      case 'TIGHTEN_STOP':
        return '🔒 TIGHTEN: Trail stop tighter - deterioration warning';
      case 'STAY':
        return '✓ HOLD: Microstructure stable';
      default:
        return 'Unknown action';
    }
  }

  /**
   * Update internal history for trend detection
   */
  private updateHistory(data: MicrostructureData, currentTime: number = Date.now()): void {
    this.spreadHistory.push(data.spreadPercent);
    this.volumeHistory.push(data.volumeRatio);
    this.orderFlowHistory.push(data.netFlow);
    this.depthHistory.push(data.bidVolume + data.askVolume);
    this.priceHistory.push(data.price);

    // Keep history length constant
    if (this.spreadHistory.length > this.HISTORY_LENGTH) {
      this.spreadHistory.shift();
      this.volumeHistory.shift();
      this.orderFlowHistory.shift();
      this.depthHistory.shift();
    }
    
    if (this.priceHistory.length > 10) {
      this.priceHistory.shift();
    }

    // Update depth last update time for persistence tracking
    this.depthLastUpdate = currentTime;
  }

  /**
   * Clear history (on trade start)
   */
  private clearHistory(): void {
    this.spreadHistory = [];
    this.volumeHistory = [];
    this.orderFlowHistory = [];
    this.depthHistory = [];
    this.priceHistory = [];
    this.momentumHistory = [];
    this.microstructureEventHistory = [];
    this.eventTimestamps = [];
    this.depthRefillHistory = [];
  }

  /**
   * Set entry context for a new trade
   */
  setEntryContext(entryPrice: number, quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'FAIR', entryTime?: number): void {
    this.entryPrice = entryPrice;
    this.entryQuality = quality;
    this.entryTime = entryTime || Date.now();
  }

  /**
   * Reset for new trade
   */
  reset(): void {
    this.clearHistory();
    this.entryPrice = 0;
    this.entryTime = 0;
    this.entryQuality = 'FAIR';
    this.sweepSequenceActive = false;
    this.lastImbalanceFlip = 0;
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      spreadHistory: [...this.spreadHistory],
      volumeHistory: [...this.volumeHistory],
      orderFlowHistory: [...this.orderFlowHistory],
      depthHistory: [...this.depthHistory]
    };
  }

  /**
   * Factory method for easy instantiation
   */
  static create(): MicrostructureExitOptimizer {
    return new MicrostructureExitOptimizer();
  }
}

// Export for global access
export const microstructureOptimizer = {
  create: () => MicrostructureExitOptimizer.create()
};
