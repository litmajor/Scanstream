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
    signalType: 'BUY' | 'SELL' = 'BUY'
  ): MicrostructureSignal {
    const signals: string[] = [];
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let action: MicrostructureSignal['action'] = 'STAY';

    // Update history
    this.updateHistory(current);

    // DETECTION 1: Spread Widening → Liquidity Crisis
    const spreadAnalysis = this.analyzeSpreadWidening(current, previous);
    if (spreadAnalysis.detected) {
      signals.push(spreadAnalysis.message);
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

    return {
      action,
      severity,
      signals,
      recommendation,
      adjustedStop
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
  private updateHistory(data: MicrostructureData): void {
    this.spreadHistory.push(data.spreadPercent);
    this.volumeHistory.push(data.volumeRatio);
    this.orderFlowHistory.push(data.netFlow);
    this.depthHistory.push(data.bidVolume + data.askVolume);

    // Keep history length constant
    if (this.spreadHistory.length > this.HISTORY_LENGTH) {
      this.spreadHistory.shift();
      this.volumeHistory.shift();
      this.orderFlowHistory.shift();
      this.depthHistory.shift();
    }
  }

  /**
   * Clear history (on trade start)
   */
  private clearHistory(): void {
    this.spreadHistory = [];
    this.volumeHistory = [];
    this.orderFlowHistory = [];
    this.depthHistory = [];
  }

  /**
   * Reset for new trade
   */
  reset(): void {
    this.clearHistory();
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
