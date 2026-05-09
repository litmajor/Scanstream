/**
 * RL Feedback Loop — Integration Guide
 *
 * Shows exactly where to call TradeLifecycleManager in your existing
 * trade execution flow. This is NOT a standalone service — it hooks
 * into whatever executor/position-monitor you already have.
 *
 * 3 call sites:
 *   onTradeOpen()  → right after order fills
 *   onTradeTick()  → inside your position monitor loop (each bar)
 *   onTradeClose() → right after exit order fills
 */

import { RLPositionAgent } from './rl-position-agent';
import { TradeLifecycleManager, TradeOpenSnapshot } from './rl-feedback-loop';

// ─── Singleton setup (wire into your DI / service layer) ─────────────────────

export const rlAgent   = new RLPositionAgent();
export const rlFeedback = new TradeLifecycleManager(rlAgent);

// ─── Call site 1: After signal fires, before order placement ─────────────────
//
// In your ConsensusEngine / SignalOrchestrator, replace:
//
//   const sizing = rlAgent.getPositionParameters(state, baseSize, atr, price);
//
// With:
//
//   const decision = rlAgent.getFullDecision(state, baseSize, atr, price);
//
// Then pass decision.entryTiming into your order router:

export async function onSignalFired(
  symbol: string,
  direction: 'BUY' | 'SELL',
  signalPrice: number,
  consensusScore: number,
  clusterPassedGate: boolean,
  state: ReturnType<typeof rlAgent.extractState>,
  baseSize: number,
  atr: number
) {
  // Get ALL domain decisions in one call
  const decision = rlAgent.getFullDecision(state, baseSize, atr, signalPrice);

  // --- Entry timing: wait or enter now ---
  const { waitBars, entryType, limitOffsetPct } = decision.entryTiming;
  
  let fillPrice = signalPrice;

  if (entryType === 'LIMIT') {
    const limitPrice = direction === 'BUY'
      ? signalPrice * (1 - limitOffsetPct / 100)
      : signalPrice * (1 + limitOffsetPct / 100);
    
    // Place limit order and wait up to waitBars for fill
    // fillPrice = await orderRouter.placeLimitAndWait(symbol, direction, limitPrice, waitBars);
    fillPrice = limitPrice; // placeholder
  } else if (waitBars > 0) {
    // Wait N bars then market order
    // await sleep(waitBars * barDurationMs);
    // fillPrice = await orderRouter.placeMarket(symbol, direction);
  }

  // --- Source weights: pass into consensus engine ---
  // consensusEngine.setWeights(decision.sourceWeights);

  // --- Cluster threshold: pass into clustering validator ---
  // clusteringEngine.setThresholds(decision.clusterThreshold);

  // --- Place the actual order ---
  const tradeId = `${symbol}_${Date.now()}`;

  // await orderRouter.place({ symbol, direction, size: decision.sizing.positionSize, ... });

  // --- Register with feedback loop AFTER fill confirmed ---
  const snapshot: TradeOpenSnapshot = {
    tradeId,
    symbol,
    direction,
    entryState:           state,
    signalPrice,
    entryFillPrice:       fillPrice,
    entryTime:            Date.now(),
    domainActions: {
      positionSizing:    decision.sizing as any,   // cast — matches PositionSizingAction shape
      entryTiming:       decision.entryTiming,
      sourceWeights:     decision.sourceWeights,
      exitSequence:      decision.exitSequence,
      clusterThreshold:  decision.clusterThreshold,
    },
    consensusScoreAtEntry: consensusScore,
    clusterPassedGate,
    basePositionSize:     baseSize,
    atr,
  };

  rlFeedback.onTradeOpen(snapshot);

  return { tradeId, decision };
}

// ─── Call site 2: Inside your position monitor loop ──────────────────────────
//
// Your existing position monitor already polls prices.
// Add one line inside the loop:

export function onPositionTick(
  tradeId: string,
  currentPrice: number
) {
  rlFeedback.onTradeTick(tradeId, currentPrice, Date.now());

  // ... rest of your existing exit logic (TP/SL checks, microstructure, etc.)
}

// ─── Call site 3: After exit order fills ─────────────────────────────────────
//
// In your ExitOrchestrator, after position.close() confirms:

export async function onPositionClosed(
  tradeId: string,
  entryPrice: number,
  exitPrice: number,
  direction: 'BUY' | 'SELL',
  exitReason: 'TP_HIT' | 'SL_HIT' | 'CLUSTER_BREAKDOWN' | 'MICROSTRUCTURE' | 'TIME_LIMIT' | 'MANUAL',
  holdingBars: number,
  atr: number,
  plannedSLDistance: number  // ATR × slMultiplier
) {
  const isBuy = direction === 'BUY';

  const pnlDollars  = isBuy ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pnlPercent  = (pnlDollars / entryPrice) * 100;

  // riskRewardAchieved = how many R did we make?
  const riskAmount          = plannedSLDistance;          // 1R in price units
  const riskRewardAchieved  = riskAmount > 0 ? Math.abs(pnlDollars) / riskAmount : 0;

  // maxPossiblePnlPct is filled in by TradeLifecycleManager from live MFE tracking
  // Pass 0 here — it will use live.mfe internally
  const maxPossiblePnlPct = 0;

  rlFeedback.onTradeClose(tradeId, {
    exitPrice,
    exitTime:            Date.now(),
    exitReason,
    pnlDollars,
    pnlPercent,
    mfe:                 0,  // overridden from live tracking
    mae:                 0,  // overridden from live tracking
    maxPossiblePnlPct,
    riskRewardAchieved,
    holdingBars,
  });
}

// ─── How source weights flow into consensus engine ───────────────────────────
//
// Replace the static weights in your ConsensusEngine with:
//
//   const state = rlAgent.extractState(frames, mlConfidence, regime, drawdown);
//   const weights = rlAgent.selectActionForDomain('SOURCE_WEIGHTING', state, false) as SourceWeightAction;
//
//   const score =
//     scannerConf * weights.scannerWeight +
//     mlConf      * weights.mlWeight      +
//     rlConf      * weights.rlWeight;
//
// ─── How cluster threshold flows into ClusterValidator ───────────────────────
//
//   const threshold = rlAgent.selectActionForDomain('CLUSTER_THRESHOLD', state, false) as ClusterThresholdAction;
//
//   const passes =
//     clusterMetrics.cluster_strength >= threshold.minClusterStrength &&
//     clusterMetrics.follow_through   >= threshold.minFollowThrough   &&
//     clusterMetrics.directional_ratio >= threshold.minDirectionalRatio;

// ─── Monitoring & Diagnostics ────────────────────────────────────────────────

export class RLDiagnosticsDashboard {
  constructor(private readonly agent: RLPositionAgent, private readonly feedback: TradeLifecycleManager) {}

  /**
   * 1. Domain Learning Progress
   */
  getDomainProgress() {
    const stats = this.agent.getDomainStats();
    const progress: Record<string, { qTableSize: number; experienceCount: number; convergencePercent: number }> = {};
    
    for (const [domain, stat] of stats) {
      progress[domain as string] = {
        qTableSize: stat.qTableSize,
        experienceCount: stat.experienceCount,
        convergencePercent: Math.min(100, (stat.experienceCount / 500) * 100)
      };
    }
    
    return progress;
  }

  /**
   * 2. Verify Exploration Happening
   */
  checkExplorationRates() {
    const regimes = ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'];
    const domains = ['POSITION_SIZING', 'ENTRY_TIMING', 'SOURCE_WEIGHTING', 'EXIT_SEQUENCING', 'CLUSTER_THRESHOLD'];
    const exploration: Record<string, Record<string, { experiences: number; expectedExplorationRate: number }>> = {};
    
    for (const domain of domains) {
      exploration[domain] = {};
      
      for (const regime of regimes) {
        const count = this.agent.getDomainExperienceCount(domain as any, regime);
        let explorationRate = 0.5; // Default
        
        if (count > 500) explorationRate = 0.05;
        else if (count > 200) explorationRate = 0.15;
        else if (count > 50) explorationRate = 0.30;
        
        exploration[domain][regime] = {
          experiences: count,
          expectedExplorationRate: explorationRate
        };
      }
    }
    
    return exploration;
  }

  /**
   * 3. Get Domain Statistics
   */
  getDomainStats() {
    const stats = this.agent.getDomainStats();
    const result: Record<string, { qTableSize: number; experienceCount: number }> = {};
    
    for (const [domain, stat] of stats) {
      result[domain as string] = {
        qTableSize: stat.qTableSize,
        experienceCount: stat.experienceCount
      };
    }
    
    return result;
  }

  /**
   * 4. System Health Check
   */
  getSystemHealth() {
    return {
      openTrades: this.feedback.openTradeCount,
      closedTrades: this.feedback.closedTradeCount,
      pendingIds: this.feedback.pendingTradeIds,
      domainStats: this.getDomainProgress(),
      explorationRates: this.checkExplorationRates()
    };
  }
}

// ─── Integration Validation Checklist ──────────────────────────────────────────

/**
 * Before going live:
 *
 * - [ ] Compile check: TypeScript compiles without errors
 *       tsc --noEmit src/rl-position-agent.ts src/rl-feedback-loop.ts src/rl-feedback-integration.ts
 *
 * - [ ] Call site 1: Signal fires → getFullDecision() returns all 5 domains
 *       assert(decision.sizing != null);
 *       assert(decision.entryTiming != null);
 *       assert(decision.sourceWeights != null);
 *       assert(decision.exitSequence != null);
 *       assert(decision.clusterThreshold != null);
 *
 * - [ ] Call site 2: onPositionTick() updates MFE/MAE correctly
 *       Trade: BUY @ 100
 *       Price: 102 → MFE should be 102
 *       Price: 99  → MAE should be 99
 *
 * - [ ] Call site 3: onTradeClose() triggers learning
 *       After close, domain Q-tables should have qTableSize > 0
 *       Each domain should update with its domain-specific reward
 *
 * - [ ] Reward signals are reasonable
 *       ENTRY_TIMING:     -10 to +10 (slippage penalty + pnl bonus)
 *       SOURCE_WEIGHTING: -5 to +4 (consensus accuracy)
 *       EXIT_SEQUENCING:  -5 to +5 (capture ratio)
 *       CLUSTER_THRESHOLD: -6 to +4 (gate accuracy)
 *
 * - [ ] Every 32 trades, replay is triggered
 *       After trade 32, 64, 96, etc., verify logs show "Batch replay triggered"
 *
 * - [ ] Pending trades drain after close
 *       openTradeCount should return to 0 after onTradeClose() called
 */
