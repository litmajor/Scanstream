/**
 * Order Flow Analyzer - Incorporates bid/ask imbalance and order flow metrics
 * into position sizing decisions
 * 
 * PURPOSE: Enhance position sizing with order flow confirmation
 * - Boost positions when order flow aligns with signal
 * - Reduce positions when order flow contradicts signal
 * - Track institutional vs retail order patterns
 */

export interface OrderFlowData {
  bidVolume: number;
  askVolume: number;
  netFlow: number;
  spread: number;
  spreadPercent: number;
  volume: number;
  volumeRatio?: number;
}

export interface OrderFlowAnalysis {
  orderFlowScore: number; // 0-1, where >0.6 is strong alignment
  orderFlowMultiplier: number; // Position sizing multiplier (0.6x - 1.6x)
  orderFlowStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY';
  reasoning: string[];
  components: {
    bidAskRatio: number;
    netFlowRatio: number;
    spreadScore: number;
    volumeScore: number;
  };
}

/**
 * Detects order flow conviction - whether institutional/smart money is buying/selling
 */
export class OrderFlowAnalyzer {
  /**
   * Analyze order flow to validate/contradict signal direction
   * 
   * @param orderFlow Current order flow metrics
   * @param signalDirection BUY or SELL signal
   * @param volumeProfile 'HEAVY' | 'NORMAL' | 'LIGHT' (from market regime detector)
   * @returns OrderFlow analysis with position sizing multiplier
   */
  static analyzeOrderFlow(
    orderFlow: OrderFlowData,
    signalDirection: 'BUY' | 'SELL',
    volumeProfile: 'HEAVY' | 'NORMAL' | 'LIGHT' = 'NORMAL'
  ): OrderFlowAnalysis {
    const reasoning: string[] = [];
    const components = {
      bidAskRatio: 0,
      netFlowRatio: 0,
      spreadScore: 0,
      volumeScore: 0
    };

    // ============================================================================
    // COMPONENT 1: BID-ASK RATIO (Direct order flow imbalance)
    // ============================================================================
    const bidAskTotal = orderFlow.bidVolume + orderFlow.askVolume;
    let bidAskRatio = 1.0;
    
    if (bidAskTotal > 0) {
      // Ratio > 1 = more buyers, Ratio < 1 = more sellers
      bidAskRatio = orderFlow.bidVolume / (orderFlow.askVolume || 0.0001);
      
      // Normalize to 0-1 scale: 2:1 buy → 0.66, 1:2 sell → 0.33
      const normalizedBidAsk = Math.log(bidAskRatio) / Math.log(2); // -1 to +1 scale
      components.bidAskRatio = (normalizedBidAsk + 1) / 2; // Convert to 0-1 scale
    }

    // Evaluate bid-ask alignment with signal
    const bidAskAlignment = signalDirection === 'BUY' 
      ? bidAskRatio > 1.2 ? 0.9 : bidAskRatio > 1.0 ? 0.7 : bidAskRatio > 0.8 ? 0.3 : 0.0
      : bidAskRatio < 0.83 ? 0.9 : bidAskRatio < 1.0 ? 0.7 : bidAskRatio < 1.25 ? 0.3 : 0.0;

    reasoning.push(
      `Bid-Ask: ${orderFlow.bidVolume.toFixed(0)} / ${orderFlow.askVolume.toFixed(0)} = ` +
      `${bidAskRatio.toFixed(2)}:1 (${signalDirection === 'BUY' ? 'Buy' : 'Sell'} alignment: ${(bidAskAlignment * 100).toFixed(0)}%)`
    );

    // ============================================================================
    // COMPONENT 2: NET FLOW RATIO (Cumulative buy/sell pressure)
    // ============================================================================
    let netFlowRatio = 0.5; // Neutral default
    
    if (bidAskTotal > 0) {
      // Net flow as % of total volume
      const netFlowPercent = orderFlow.netFlow / (bidAskTotal || 1);
      
      // Convert to 0-1 scale: +1.0 net → 1.0, -1.0 net → 0.0
      netFlowRatio = (netFlowPercent + 1) / 2;
      components.netFlowRatio = netFlowRatio;
    }

    // Evaluate net flow alignment
    const netFlowAlignment = signalDirection === 'BUY'
      ? netFlowRatio > 0.65 ? 0.95 : netFlowRatio > 0.55 ? 0.75 : netFlowRatio > 0.45 ? 0.3 : 0.0
      : netFlowRatio < 0.35 ? 0.95 : netFlowRatio < 0.45 ? 0.75 : netFlowRatio < 0.55 ? 0.3 : 0.0;

    reasoning.push(
      `Net Flow: ${orderFlow.netFlow.toFixed(0)} (${signalDirection === 'BUY' ? 'Buy' : 'Sell'} alignment: ${(netFlowAlignment * 100).toFixed(0)}%)`
    );

    // ============================================================================
    // COMPONENT 3: SPREAD QUALITY (Liquidity indicator)
    // ============================================================================
    let spreadScore = 0.7; // Default moderate score
    
    if (orderFlow.spreadPercent) {
      // Tighter spread = more liquidity = higher score
      if (orderFlow.spreadPercent < 0.05) {
        spreadScore = 1.0; // Excellent liquidity
        reasoning.push(`Spread: ${orderFlow.spreadPercent.toFixed(4)}% - Excellent liquidity`);
      } else if (orderFlow.spreadPercent < 0.1) {
        spreadScore = 0.9; // Very good
        reasoning.push(`Spread: ${orderFlow.spreadPercent.toFixed(4)}% - Very good liquidity`);
      } else if (orderFlow.spreadPercent < 0.2) {
        spreadScore = 0.7; // Good
        reasoning.push(`Spread: ${orderFlow.spreadPercent.toFixed(4)}% - Good liquidity`);
      } else if (orderFlow.spreadPercent < 0.5) {
        spreadScore = 0.5; // Moderate (caution)
        reasoning.push(`Spread: ${orderFlow.spreadPercent.toFixed(4)}% - Moderate liquidity`);
      } else {
        spreadScore = 0.3; // Poor (reduce position)
        reasoning.push(`Spread: ${orderFlow.spreadPercent.toFixed(4)}% - Poor liquidity, reduce position`);
      }
    }
    
    components.spreadScore = spreadScore;

    // ============================================================================
    // COMPONENT 4: VOLUME SCORE (Conviction indicator)
    // ============================================================================
    let volumeScore = 0.7; // Default
    
    if (orderFlow.volumeRatio) {
      // Volume ratio compared to average
      if (orderFlow.volumeRatio > 2.0) {
        volumeScore = 1.0; // Extreme volume = strong conviction
        reasoning.push(`Volume: ${orderFlow.volumeRatio.toFixed(2)}x average - Strong conviction`);
      } else if (orderFlow.volumeRatio > 1.5) {
        volumeScore = 0.9; // High volume
        reasoning.push(`Volume: ${orderFlow.volumeRatio.toFixed(2)}x average - High conviction`);
      } else if (orderFlow.volumeRatio > 1.0) {
        volumeScore = 0.7; // Above average
        reasoning.push(`Volume: ${orderFlow.volumeRatio.toFixed(2)}x average - Above average conviction`);
      } else if (orderFlow.volumeRatio > 0.7) {
        volumeScore = 0.5; // Below average (caution)
        reasoning.push(`Volume: ${orderFlow.volumeRatio.toFixed(2)}x average - Below average conviction`);
      } else {
        volumeScore = 0.3; // Very low volume = weak conviction
        reasoning.push(`Volume: ${orderFlow.volumeRatio.toFixed(2)}x average - Very low conviction`);
      }
    }
    
    components.volumeScore = volumeScore;

    // ============================================================================
    // COMPOSITE: Combine components with weights
    // ============================================================================
    // Weights favor order flow imbalance (bidAsk + netFlow) most heavily
    const orderFlowScore = (
      bidAskAlignment * 0.35 +      // Immediate bid-ask balance
      netFlowAlignment * 0.35 +     // Cumulative flow direction
      spreadScore * 0.15 +          // Liquidity quality
      volumeScore * 0.15            // Volume conviction
    );

    // ============================================================================
    // POSITION SIZING MULTIPLIER
    // ============================================================================
    // Map order flow score (0-1) to multiplier (0.6x - 1.6x)
    // - 0.0 (strong contradiction): 0.6x (reduce 40%)
    // - 0.5 (neutral): 1.0x (no change)
    // - 1.0 (strong alignment): 1.6x (increase 60%)
    
    const orderFlowMultiplier = 0.6 + (orderFlowScore * 1.0); // Range: 0.6 to 1.6
    
    let orderFlowStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY';
    if (orderFlowScore > 0.75) {
      orderFlowStrength = 'STRONG';
    } else if (orderFlowScore > 0.55) {
      orderFlowStrength = 'MODERATE';
    } else if (orderFlowScore > 0.35) {
      orderFlowStrength = 'WEAK';
    } else {
      orderFlowStrength = 'CONTRADICTORY';
    }

    reasoning.push(
      `Order Flow Composite: ${(orderFlowScore * 100).toFixed(1)}% (${orderFlowStrength}) ` +
      `→ ${orderFlowMultiplier.toFixed(2)}x position multiplier`
    );

    return {
      orderFlowScore,
      orderFlowMultiplier,
      orderFlowStrength,
      reasoning,
      components
    };
  }

  /**
   * Detect institutional order patterns
   * Returns signal of whether large orders are accumulating or distributing
   */
  static detectInstitutionalFlow(
    bidVolume: number,
    askVolume: number,
    historicalAverageVolume: number,
    signalType: 'BUY' | 'SELL'
  ): {
    isAccumulating: boolean;
    confidence: number;
    reasoning: string;
  } {
    const totalVolume = bidVolume + askVolume;
    const institutionalThreshold = historicalAverageVolume * 2.5; // 2.5x is institutional size

    if (signalType === 'BUY') {
      // Institutional buying: bid volume way above ask
      const bidRatio = bidVolume / (askVolume + 1);
      const isAccumulating = bidVolume > institutionalThreshold && bidRatio > 2.0;
      const confidence = Math.min(1.0, bidVolume / institutionalThreshold);
      
      return {
        isAccumulating,
        confidence,
        reasoning: isAccumulating
          ? `Strong institutional buying detected: ${bidVolume.toFixed(0)} bid vs ${askVolume.toFixed(0)} ask`
          : `Insufficient institutional buying pressure`
      };
    } else {
      // Institutional selling: ask volume way above bid
      const askRatio = askVolume / (bidVolume + 1);
      const isAccumulating = askVolume > institutionalThreshold && askRatio > 2.0;
      const confidence = Math.min(1.0, askVolume / institutionalThreshold);
      
      return {
        isAccumulating,
        confidence,
        reasoning: isAccumulating
          ? `Strong institutional selling detected: ${askVolume.toFixed(0)} ask vs ${bidVolume.toFixed(0)} bid`
          : `Insufficient institutional selling pressure`
      };
    }
  }

  /**
   * Quick utility: Check if order flow contradicts the signal badly
   * Returns true if we should SKIP or REDUCE position
   */
  static shouldAvoidTrade(
    orderFlowAnalysis: OrderFlowAnalysis,
    minAcceptableMultiplier: number = 0.7
  ): boolean {
    return orderFlowAnalysis.orderFlowMultiplier < minAcceptableMultiplier;
  }
}

export const orderFlowAnalyzer = new OrderFlowAnalyzer();
