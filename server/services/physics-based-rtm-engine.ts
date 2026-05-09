/**
 * Physics-Based Return-to-Mean (RTM) Engine
 * 
 * Detects high-probability mean-reversion conditions using vector field physics,
 * orderbook microstructure, and coherence analysis.
 * 
 * Four pillars:
 * 1. Reversion Quality: depth of pullback relative to initial deviation
 * 2. Curl Score: rotational chaos in the market vector field
 * 3. Coherence Score: directional alignment (inverted for RTM trigger)
 * 4. Turbulence Index: measure of chaotic energy dissipation
 */

import type { MarketFrame } from '../../shared/schema';

export interface OrderFlowSnapshot {
  asks: Array<{ price: number; volume: number }>;
  bids: Array<{ price: number; volume: number }>;
  bidVolume: number;
  askVolume: number;
  spread: number;
  spreadPercent: number;
  depth: number;
  imbalance: number; // -1 to +1 (positive = bid-heavy)
  timestamp: number;
}

export interface RTMMetric {
  // Individual pillars (0-1 normalized)
  reversionQuality: number;     // (|D_entry| - |D_min|) / |D_entry|
  curlScore: number;            // Rotational energy in price field
  coherenceScore: number;       // Directional alignment (inverted for RTM: high = bad)
  turbulenceIndex: number;      // Volatility concentration (0+)
  divergenceSink: number;       // Field divergence magnitude (0-1)
  
  // Orderbook signals
  bidAskImbalance: number;      // -1 (sell pressure) to +1 (buy pressure)
  spreadQuality: number;        // 0 (tight) to 1 (wide); lower = better liquidity
  
  // Composite metrics
  rtmSignalStrength: number;    // 0-1, final RTM trigger confidence
  rtmTrigger: boolean;          // True if all pillars align for mean-reversion
  
  // Force-Decay Metrics (NEW: Permission slip for Convexity)
  decayStrength: number;        // 0-1, how fast is reversion quality decaying?
  depthCompression: number;     // 0-1, are pullbacks getting shallower?
  timeCompression: number;      // 0-1, are pullbacks ending faster?
  volatilityParadox: boolean;   // True if price deviation ↑ but snap-back volatility ↓
  forPermissionSlip: boolean;   // True if decay patterns prove mean-reversion failed
  forConfidence: number;        // 0-1, how certain is the FoR permission?
  
  // Metadata
  regime: 'TRENDING' | 'NEUTRAL' | 'CHOPPY';
  confidence: number;           // 0-1, how certain is the RTM signal
  reasoning: string[];          // Human-readable explanation
}

export interface VectorFieldState {
  gradient: number;             // ∇p (price slope)
  divergence: number;           // ∇·F (field expansion/contraction)
  curl: number;                 // Curl(F) (rotational energy)
  laplacian: number;            // ∇²p (curvature)
}

/**
 * Physics-Based RTM Engine
 */
export class PhysicsBasedRTMEngine {
  private historyBuffer: {
    price: number;
    gradient: number;
    curl: number;
    coherence: number;
    turbulence: number;
    reversionQuality: number;
    timestamp: number;
  }[] = [];

  private readonly bufferSize = 100; // Keep last 100 candles for history
  
  // Track pullback sequences for Depth/Time Compression
  private pullbackSequence: {
    depth: number;
    duration: number;
    timestamp: number;
  }[] = [];

  constructor() {}

  /**
   * Calculate RTM metric for a given market frame and orderflow state
   * 
   * @param frame Current market frame with indicators
   * @param frames Historical frames for context
   * @param orderFlow Current orderbook state
   * @param entryPrice Entry price (for reversion quality calculation)
   * @returns RTM metric with trigger signal
   */
  calculateRTMMetric(
    frame: MarketFrame,
    frames: MarketFrame[],
    orderFlow: OrderFlowSnapshot,
    entryPrice: number
  ): RTMMetric {
    const reasoning: string[] = [];

    // Validate inputs
    if (!frame || !frame.price || !frames || frames.length === 0 || !orderFlow) {
      return {
        reversionQuality: 0,
        curlScore: 0,
        coherenceScore: 0,
        turbulenceIndex: 0,
        divergenceSink: 0,
        bidAskImbalance: 0,
        spreadQuality: 0,
        rtmSignalStrength: 0,
        rtmTrigger: false,
        regime: 'NEUTRAL',
        confidence: 0,
        decayStrength: 0,
        depthCompression: 0,
        timeCompression: 0,
        volatilityParadox: false,
        forPermissionSlip: false,
        forConfidence: 0,
        reasoning: ['INVALID_INPUT: Missing frame, frames, or orderFlow']
      };
    }

    // Step 1: Calculate Reversion Quality (R_i)
    const reversionQuality = this.calculateReversionQuality(frame, frames, entryPrice);
    reasoning.push(`Reversion Quality: ${(reversionQuality * 100).toFixed(1)}% (pullback depth)`);

    // Step 2: Calculate Curl Score (Rotational Energy)
    const curlScore = this.calculateCurlScore(frames);
    reasoning.push(`Curl Score: ${(curlScore * 100).toFixed(1)}% (rotational chaos)`);

    // Step 3: Calculate Coherence Score (Directional Alignment)
    const coherenceScore = this.calculateCoherenceScore(frames);
    reasoning.push(`Coherence Score: ${(coherenceScore * 100).toFixed(1)}% (directional alignment)`);

    // Step 4: Calculate Turbulence Index (Chaotic Energy)
    const turbulenceIndex = this.calculateTurbulenceIndex(frames);
    reasoning.push(`Turbulence Index: ${turbulenceIndex.toFixed(2)} (chaotic energy)`);

    // Step 5: Calculate Divergence Sink (Field Energy Absorption)
    const divergenceSink = this.calculateDivergenceSink(frames);
    reasoning.push(`Divergence Sink: ${(divergenceSink * 100).toFixed(1)}% (momentum drainage)`);

    // Step 6: Extract Orderbook Signals
    const bidAskImbalance = this.calculateBidAskImbalance(orderFlow);
    const spreadQuality = this.calculateSpreadQuality(orderFlow);
    reasoning.push(`Bid-Ask Imbalance: ${bidAskImbalance.toFixed(2)} (${bidAskImbalance > 0.3 ? 'buy-heavy' : bidAskImbalance < -0.3 ? 'sell-heavy' : 'neutral'})`);
    reasoning.push(`Spread Quality: ${(spreadQuality * 100).toFixed(1)}% (${spreadQuality < 0.3 ? 'tight' : spreadQuality < 0.6 ? 'normal' : 'wide'})`);

    // Step 7: Determine Regime
    const regime = this.classifyRegime(coherenceScore, turbulenceIndex);
    reasoning.push(`Market Regime: ${regime}`);

    // Step 8: Calculate Composite RTM Signal (Regime-Adaptive Weights)
    const { rtmSignalStrength, weights } = this.calculateCompositeRTM(
      reversionQuality,
      curlScore,
      coherenceScore,
      turbulenceIndex,
      divergenceSink,
      bidAskImbalance,
      spreadQuality,
      regime
    );

    reasoning.push(`Composite RTM (weights: R=${weights.reversion.toFixed(2)} Curl=${weights.curl.toFixed(2)} Coherence=${weights.coherence.toFixed(2)} TI=${weights.turbulence.toFixed(2)}): ${(rtmSignalStrength * 100).toFixed(1)}%`);

    // Step 9: Determine Trigger Threshold (Regime-Adaptive)
    const triggerThreshold = this.getTriggerThreshold(regime);
    const rtmTrigger = this.evaluateTriggerConditions(
      reversionQuality,
      curlScore,
      coherenceScore,
      turbulenceIndex,
      divergenceSink,
      bidAskImbalance,
      rtmSignalStrength,
      triggerThreshold
    );

    if (rtmTrigger) {
      reasoning.push(`🚨 RTM TRIGGER FIRED (${(rtmSignalStrength * 100).toFixed(1)}% > ${(triggerThreshold * 100).toFixed(1)}% threshold)`);
    }

    // Step 10: Calculate Confidence
    const confidence = this.calculateConfidence(reversionQuality, curlScore, coherenceScore, turbulenceIndex, rtmTrigger);

    // Step 11: Calculate Force-Decay Metrics for FoR Permission Slip
    const decayStrength = this.calculateDecayStrength();
    reasoning.push(`Decay Strength: ${(decayStrength * 100).toFixed(1)}% (reversion quality degradation)`);

    const framePrice = (frame.price as any)?.close ?? 0;
    const frameOpen = (frame.price as any)?.open ?? 0;
    const currentPullbackDepth = framePrice < frameOpen 
      ? (frameOpen - framePrice) / framePrice 
      : 0;
    const depthCompression = this.calculateDepthCompression(currentPullbackDepth);
    reasoning.push(`Depth Compression: ${(depthCompression * 100).toFixed(1)}% (pullback shallowing)`);

    const timeCompression = this.calculateTimeCompression(frames.length);
    reasoning.push(`Time Compression: ${(timeCompression * 100).toFixed(1)}% (pullback speed-up)`);

    const recentFramePrice = ((frames[Math.max(0, frames.length - 20)] as any)?.price as any)?.close ?? 0;
    const priceDeviation = Math.abs(framePrice - recentFramePrice);
    const volatilityParadox = this.detectVolatilityParadox(frames, priceDeviation);
    reasoning.push(`Volatility Paradox: ${volatilityParadox ? 'DETECTED' : 'not detected'} (deviation↑ vol↓)`);

    // Step 12: Evaluate FoR Permission Slip
    const forSlip = this.evaluateFoRPermissionSlip(
      decayStrength,
      depthCompression,
      timeCompression,
      volatilityParadox
    );

    reasoning.push(`FoR Permission Slip: ${forSlip.forPermissionSlip ? '✓ GRANTED' : '✗ DENIED'} (confidence: ${(forSlip.forConfidence * 100).toFixed(1)}%)`);

    // Store in history for temporal analysis
    const currentPrice = ((frame.price as any)?.close ?? 0);
    this.updateHistory(currentPrice, coherenceScore, turbulenceIndex, reversionQuality);

    return {
      reversionQuality,
      curlScore,
      coherenceScore,
      turbulenceIndex,
      divergenceSink,
      bidAskImbalance,
      spreadQuality,
      rtmSignalStrength,
      rtmTrigger,
      regime,
      confidence,
      decayStrength,
      depthCompression,
      timeCompression,
      volatilityParadox,
      forPermissionSlip: forSlip.forPermissionSlip,
      forConfidence: forSlip.forConfidence,
      reasoning
    };
  }

  /**
   * Calculate Reversion Quality: (|D_entry| - |D_min|) / |D_entry|
   * Measures how deep the pullback was relative to the initial deviation
   */
  private calculateReversionQuality(
    frame: MarketFrame,
    frames: MarketFrame[],
    entryPrice: number
  ): number {
    if (frames.length < 5) return 0;

    // Validate frame structure
    const framePrice = this.getFramePrice(frame);
    if (!frame || !framePrice || typeof framePrice !== 'number') {
      return 0;
    }

    const currentPrice = framePrice;
    const initialDeviation = Math.abs(entryPrice - entryPrice); // Distance from entry at entry = 0
    
    // For live trading: assume entry = frames[-N] price; find deepest pullback since then
    let deepestPullback = currentPrice;
    for (let i = Math.max(0, frames.length - 50); i < frames.length; i++) {
      const framePrice = (frames[i] as any)?.price?.close ?? 0;
      if (typeof framePrice === 'number') {
        deepestPullback = Math.min(deepestPullback, framePrice);
      }
    }

    const currentDeviation = Math.abs(currentPrice - entryPrice);
    const pullbackDepth = Math.abs(deepestPullback - entryPrice);

    // R_i = (|D_entry| - |D_min|) / |D_entry|
    // If price bounced back toward entry: R_i high (good reversion)
    // If price stayed low: R_i low (poor reversion)
    
    if (currentDeviation === 0) return 0; // No deviation yet
    const reversionQuality = Math.max(0, (pullbackDepth - currentDeviation) / (pullbackDepth || 1));
    
    return Math.min(1, Math.max(0, reversionQuality));
  }

  /**
   * Calculate Curl Score: rotational energy in the price vector field
   * High curl = market is "spinning" rather than trending linearly
   */
  private calculateCurlScore(frames: MarketFrame[]): number {
    if (frames.length < 10) return 0;

    const recentFrames = frames.slice(-10);
    
    // Calculate discrete curl using price changes and volume
    let curlEnergy = 0;
    for (let i = 1; i < recentFrames.length; i++) {
      const prevFrame = recentFrames[i - 1];
      const currFrame = recentFrames[i];
      
      const currPrice = this.getFramePrice(currFrame);
      const prevPrice = this.getFramePrice(prevFrame);
      const priceChange = currPrice - prevPrice;
      const volumeRatio = (currFrame as any).volume / ((prevFrame as any).volume || 1);
      
      // Curl = price oscillation × volume imbalance
      // High oscillation + changing volume = rotational chaos
      const oscillation = Math.abs(priceChange) / (prevPrice || 1);
      curlEnergy += Math.abs(oscillation * Math.log(volumeRatio + 1));
    }

    // Normalize to 0-1
    const normalizedCurl = Math.min(1, curlEnergy / 2); // Empirical scaling
    return normalizedCurl;
  }

  /**
   * Calculate Coherence Score: directional alignment of recent price moves
   * High coherence = all candles going in same direction (trending)
   * Low coherence = candles oscillating (choppy)
   */
  private calculateCoherenceScore(frames: MarketFrame[]): number {
    if (frames.length < 5) return 0.5; // Neutral

    const recentFrames = frames.slice(-20);
    let upCandles = 0;
    let downCandles = 0;
    
    for (let i = 1; i < recentFrames.length; i++) {
      const currPrice = this.getFramePrice(recentFrames[i]);
      const prevPrice = this.getFramePrice(recentFrames[i - 1]);
      const change = currPrice - prevPrice;
      if (change > 0) upCandles++;
      else if (change < 0) downCandles++;
    }

    const totalCandles = upCandles + downCandles;
    if (totalCandles === 0) return 0.5;

    // Coherence = concentration of moves in one direction
    const dominantRatio = Math.max(upCandles, downCandles) / totalCandles;
    
    // Return as 0-1 score: 0.5 = random, 1.0 = perfectly aligned
    return dominantRatio;
  }

  /**
   * Calculate Turbulence Index: concentration of volatility in recent bars
   * High TI = recent volatility is extreme (not evenly distributed)
   * Low TI = volatility is steady (healthy)
   */
  private calculateTurbulenceIndex(frames: MarketFrame[]): number {
    if (frames.length < 20) return 0;

    const recentFrames = frames.slice(-20);
    
    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < recentFrames.length; i++) {
      const currPrice = this.getFramePrice(recentFrames[i]);
      const prevPrice = this.getFramePrice(recentFrames[i - 1]);
      const ret = prevPrice > 0 ? Math.log(currPrice / prevPrice) : 0;
      returns.push(ret);
    }

    // Volatility of volatility (second moment)
    const avgAbsRet = returns.reduce((s, r) => s + Math.abs(r), 0) / returns.length;
    const squaredDev = returns.map(r => Math.pow(Math.abs(r) - avgAbsRet, 2));
    const variance = squaredDev.reduce((s, d) => s + d, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Turbulence = stdDev of absolute returns (normalized)
    const turbulence = stdDev > 0 ? Math.min(5, stdDev / 0.001) : 0; // Scaled to 0-5+
    
    return turbulence;
  }

  /**
   * Calculate Divergence Sink: measures field energy absorption
   * Positive divergence = sources (energy generation) → trend continuation
   * Negative divergence = sinks (energy absorption) → momentum fading
   */
  private calculateDivergenceSink(frames: MarketFrame[]): number {
    if (frames.length < 10) return 0.5;

    const recentFrames = frames.slice(-10);
    
    // Divergence ≈ rate of volume change relative to price movement
    let volumeAcceleration = 0;
    for (let i = 2; i < recentFrames.length; i++) {
      const volChange = Math.log((recentFrames[i] as any).volume / ((recentFrames[i - 1] as any).volume || 1));
      const currPrice = this.getFramePrice(recentFrames[i]);
      const prevPrice = this.getFramePrice(recentFrames[i - 1]);
      const priceChange = prevPrice > 0 ? Math.log(currPrice / prevPrice) : 0;
      
      // If volume is declining while price oscillates = energy sink
      volumeAcceleration += volChange * Math.sign(priceChange); // Aligned = positive, opposed = negative
    }

    // Normalize: negative acceleration (sinking) → high sink score (0-1)
    const sinkScore = Math.min(1, Math.max(0, -volumeAcceleration / 10));
    return sinkScore;
  }

  /**
   * Calculate Bid-Ask Imbalance: normalized log ratio of bid vs ask volume
   * Returns -1 (all selling) to +1 (all buying)
   */
  private calculateBidAskImbalance(orderFlow: OrderFlowSnapshot): number {
    const bidAskRatio = orderFlow.bidVolume / (orderFlow.askVolume || 0.0001);
    const logRatio = Math.log(bidAskRatio) / Math.log(2); // Log base 2
    
    // Normalize to -1 to +1
    return Math.max(-1, Math.min(1, logRatio / 2));
  }

  /**
   * Calculate Spread Quality: measures liquidity health
   * Tight spread (low score) = good liquidity
   * Wide spread (high score) = poor liquidity
   */
  private calculateSpreadQuality(orderFlow: OrderFlowSnapshot): number {
    const { spreadPercent } = orderFlow;
    
    if (spreadPercent < 0.05) return 0.1; // Excellent
    if (spreadPercent < 0.1) return 0.3;  // Good
    if (spreadPercent < 0.2) return 0.5;  // Normal
    if (spreadPercent < 0.5) return 0.7;  // Poor
    return 1.0; // Very poor
  }

  /**
   * Classify market regime based on coherence and turbulence
   */
  private classifyRegime(coherenceScore: number, turbulenceIndex: number): 'TRENDING' | 'NEUTRAL' | 'CHOPPY' {
    if (coherenceScore > 0.65 && turbulenceIndex < 1.5) {
      return 'TRENDING';
    } else if (coherenceScore < 0.45 || turbulenceIndex > 2.0) {
      return 'CHOPPY';
    }
    return 'NEUTRAL';
  }

  /**
   * Calculate composite RTM signal with regime-adaptive weights
   */
  private calculateCompositeRTM(
    reversionQuality: number,
    curlScore: number,
    coherenceScore: number,
    turbulenceIndex: number,
    divergenceSink: number,
    bidAskImbalance: number,
    spreadQuality: number,
    regime: 'TRENDING' | 'NEUTRAL' | 'CHOPPY'
  ): { rtmSignalStrength: number; weights: { reversion: number; curl: number; coherence: number; turbulence: number } } {
    let weights = { reversion: 0.3, curl: 0.25, coherence: 0.2, turbulence: 0.25 };

    if (regime === 'TRENDING') {
      // Suppress RTM triggers in strong trends
      weights = { reversion: 0.25, curl: 0.15, coherence: 0.4, turbulence: 0.2 };
    } else if (regime === 'CHOPPY') {
      // Amplify RTM triggers in choppy markets (reversion is more likely)
      weights = { reversion: 0.35, curl: 0.35, coherence: 0.1, turbulence: 0.2 };
    }

    // Invert coherence for RTM (high coherence = bad for mean-reversion)
    const invertedCoherence = 1 - coherenceScore;

    // Normalize turbulence to 0-1 scale
    const normalizedTurbulence = Math.min(1, turbulenceIndex / 3.0);

    // Composite
    const composite =
      weights.reversion * reversionQuality +
      weights.curl * curlScore +
      weights.coherence * invertedCoherence +
      weights.turbulence * normalizedTurbulence;

    // Add orderbook boost/penalty
    const orderFlowBoost = Math.max(0, bidAskImbalance * 0.1); // Buy imbalance helps RTM
    const spreadPenalty = Math.max(0, spreadQuality * 0.1);    // Wide spread hurts execution quality

    const rtmSignalStrength = Math.min(1, Math.max(0, composite + orderFlowBoost - spreadPenalty));

    return { rtmSignalStrength, weights };
  }

  /**
   * Get trigger threshold (regime-adaptive)
   */
  private getTriggerThreshold(regime: 'TRENDING' | 'NEUTRAL' | 'CHOPPY'): number {
    switch (regime) {
      case 'TRENDING':
        return 0.72; // High threshold (suppress false RTM in trends)
      case 'CHOPPY':
        return 0.55; // Low threshold (mean-reversion is likely)
      case 'NEUTRAL':
      default:
        return 0.65; // Balanced
    }
  }

  /**
   * Evaluate if all pillars align for RTM trigger
   */
  private evaluateTriggerConditions(
    reversionQuality: number,
    curlScore: number,
    coherenceScore: number,
    turbulenceIndex: number,
    divergenceSink: number,
    bidAskImbalance: number,
    rtmSignalStrength: number,
    triggerThreshold: number
  ): boolean {
    // All four pillars must be present (AND logic)
    const reversionQualityOK = reversionQuality > 0.60;
    const curlOK = curlScore > 0.65;
    const coherenceOK = coherenceScore < 0.48; // Low coherence (alignment broken)
    const turbulenceOK = turbulenceIndex > 1.7;
    const divergenceOK = divergenceSink > 0.55; // Strong energy sink

    // Additional: orderflow must not strongly contradict
    const orderFlowOK = Math.abs(bidAskImbalance) > 0.2 || divergenceOK;

    // Composite check
    const compositeOK = rtmSignalStrength > triggerThreshold;

    // RTM trigger = most pillars + strong composite
    return (
      compositeOK &&
      (reversionQualityOK || curlOK || coherenceOK || turbulenceOK) && // At least 3 of 4
      orderFlowOK
    );
  }

  /**
   * Calculate final confidence score for the RTM signal
   */
  private calculateConfidence(
    reversionQuality: number,
    curlScore: number,
    coherenceScore: number,
    turbulenceIndex: number,
    rtmTrigger: boolean
  ): number {
    if (!rtmTrigger) return 0.3; // Low confidence if no trigger

    // Confidence increases with alignment of all pillars
    const pillars = [
      reversionQuality > 0.65 ? 1 : 0,
      curlScore > 0.70 ? 1 : 0,
      coherenceScore < 0.45 ? 1 : 0,
      turbulenceIndex > 2.0 ? 1 : 0
    ];

    const pillarsActive = pillars.reduce((a, b) => a + b, 0);
    const baseConfidence = 0.5 + (pillarsActive / 4) * 0.5; // 0.5–1.0

    return Math.min(1, baseConfidence);
  }

  /**
   * Calculate Decay Strength: How fast is Reversion Quality degrading?
   * Measures if the elasticity of mean-reversion is dying
   * 
   * @returns 0-1 scale (0 = no decay, 1 = rapid decay)
   */
  private calculateDecayStrength(): number {
    if (this.historyBuffer.length < 5) return 0;

    const window = Math.min(20, this.historyBuffer.length);
    const recentHistory = this.historyBuffer.slice(-window);

    // Get Reversion Quality values from history
    // Note: We track reversionQuality in the buffer
    const qualities = recentHistory.map(h => h.reversionQuality);

    if (qualities.length < 2) return 0;

    // Calculate degradation: Are recent values lower than older values?
    const oldQuality = qualities[0];
    const newQuality = qualities[qualities.length - 1];

    // Degradation rate: negative = decaying (good signal)
    const degradation = (newQuality - oldQuality) / (Math.abs(oldQuality) + 0.01);

    // Decay Strength: 0 = no decay, 1 = rapid decay
    // We want negative degradation (decline) to map to high decay strength
    const decayStrength = Math.max(0, -degradation / 2); // Divide by 2 for reasonable scaling
    
    return Math.min(1, decayStrength);
  }

  /**
   * Calculate Depth Compression: Are pullbacks getting shallower?
   * Signals that opposing liquidity is being exhausted
   * 
   * @param currentPullbackDepth - Current pullback magnitude
   * @returns 0-1 scale (0 = no compression, 1 = rapid shallowing)
   */
  private calculateDepthCompression(currentPullbackDepth: number): number {
    // Validate input
    if (typeof currentPullbackDepth !== 'number' || currentPullbackDepth < 0) {
      return 0;
    }

    // Add current pullback to sequence
    this.pullbackSequence.push({
      depth: Math.max(0, currentPullbackDepth),
      duration: 1, // Placeholder
      timestamp: Date.now()
    });

    // Keep last 15 pullbacks
    if (this.pullbackSequence.length > 15) {
      this.pullbackSequence.shift();
    }

    if (this.pullbackSequence.length < 5) return 0;

    // Calculate trend: Are depths shrinking?
    const recentSequence = this.pullbackSequence.slice(-10);
    const depths = recentSequence.map(p => p.depth).filter(d => typeof d === 'number');

    if (depths.length < 2) return 0;

    // Simple regression: how much are depths decreasing?
    let totalChange = 0;
    for (let i = 1; i < depths.length; i++) {
      totalChange += Math.max(0, depths[i - 1] - depths[i]); // Positive = shallower
    }

    const avgChange = totalChange / depths.length;
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

    if (avgDepth <= 0) return 0;

    // Compression ratio: 0 = no change, 1 = depths halved each bar
    const compressionRatio = Math.min(1, Math.max(0, (avgChange / avgDepth) * 2));

    return compressionRatio;
  }

  /**
   * Calculate Time Compression: Are pullbacks ending faster?
   * Combined with depth compression, shows force exhaustion
   * 
   * @param currentPullbackDuration - Bars elapsed since pullback started
   * @returns 0-1 scale (0 = no compression, 1 = rapid shortening)
   */
  private calculateTimeCompression(currentPullbackDuration: number): number {
    // Validate input
    if (typeof currentPullbackDuration !== 'number' || currentPullbackDuration < 1) {
      return 0;
    }

    if (this.pullbackSequence.length === 0) return 0;

    // Update current pullback with duration
    const lastSequence = this.pullbackSequence[this.pullbackSequence.length - 1];
    if (lastSequence) {
      lastSequence.duration = Math.max(1, Math.floor(currentPullbackDuration));
    }

    if (this.pullbackSequence.length < 5) return 0;

    // Get durations from recent sequence
    const recentSequence = this.pullbackSequence.slice(-10);
    const durations = recentSequence
      .map(p => p.duration)
      .filter(d => typeof d === 'number' && d > 0);

    if (durations.length < 2) return 0;

    // Are durations decreasing?
    let totalDurationChange = 0;
    for (let i = 1; i < durations.length; i++) {
      totalDurationChange += Math.max(0, durations[i - 1] - durations[i]); // Positive = faster resolution
    }

    const avgDurationChange = totalDurationChange / durations.length;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    if (avgDuration <= 0) return 0;

    // Time compression: how much faster are pullbacks resolving?
    const timeCompressionRatio = Math.min(1, Math.max(0, (avgDurationChange / avgDuration) * 2));

    return timeCompressionRatio;
  }

  /**
   * Detect Volatility Paradox: Price deviation up, but snap-back volatility down
   * This contradiction signals force exhaustion
   * 
   * @param frames - Recent market data
   * @param priceDeviation - Current deviation from mean
   * @returns true if paradox detected
   */
  private detectVolatilityParadox(frames: MarketFrame[], priceDeviation: number): boolean {
    // Validate inputs
    if (!frames || frames.length < 20 || typeof priceDeviation !== 'number' || priceDeviation < 0) {
      return false;
    }

    // Get last 10 and previous 10 frames
    const recent = frames.slice(-10);
    const previous = frames.slice(-20, -10);

    // Calculate realized volatility for each window
    const calcVolatility = (group: MarketFrame[]): number => {
      if (!group || group.length < 2) return 0;
      
      let sumSquaredReturns = 0;
      let validCount = 0;
      
      for (let i = 1; i < group.length; i++) {
        const curr = this.getFramePrice(group[i]);
        const prev = this.getFramePrice(group[i - 1]);
        
        if (typeof curr === 'number' && typeof prev === 'number' && prev !== 0) {
          const ret = (curr - prev) / prev;
          sumSquaredReturns += ret * ret;
          validCount++;
        }
      }
      
      if (validCount === 0) return 0;
      return Math.sqrt(sumSquaredReturns / validCount);
    };

    const recentVol = calcVolatility(recent);
    const previousVol = calcVolatility(previous);

    // Volatility trend: is it decreasing?
    const volDecreasing = recentVol < previousVol && recentVol >= 0;

    // Price deviation trend: is it increasing?
    // Compare current deviation to historical deviations
    const currPrice = this.getFramePrice(frames[frames.length - 1]);
    const historicalDeviations = this.historyBuffer
      .slice(-10)
      .map(h => {
        if (typeof h.price === 'number' && typeof currPrice === 'number') {
          return Math.abs(h.price - currPrice);
        }
        return 0;
      })
      .filter(d => d >= 0);

    const avgHistoricalDev = historicalDeviations.length > 0 
      ? historicalDeviations.reduce((a, b) => a + b, 0) / historicalDeviations.length 
      : priceDeviation;

    const devIncreasing = priceDeviation > avgHistoricalDev * 1.05; // 5% threshold

    // Paradox: deviation ↑ but volatility ↓
    return devIncreasing && volDecreasing;
  }

  /**
   * Evaluate FoR Permission Slip: Should we deploy Convexity based on force decay?
   * Composite logic: All three conditions (decay, compression, paradox) must align
   * 
   * @param decayStrength - 0-1 scale
   * @param depthCompression - 0-1 scale
   * @param timeCompression - 0-1 scale
   * @param volatilityParadox - boolean
   * @returns Object with permission flag and confidence
   */
  private evaluateFoRPermissionSlip(
    decayStrength: number,
    depthCompression: number,
    timeCompression: number,
    volatilityParadox: boolean
  ): { forPermissionSlip: boolean; forConfidence: number } {
    // Validate inputs
    if (typeof decayStrength !== 'number' || decayStrength < 0 || decayStrength > 1) {
      decayStrength = Math.max(0, Math.min(1, decayStrength || 0));
    }
    if (typeof depthCompression !== 'number' || depthCompression < 0 || depthCompression > 1) {
      depthCompression = Math.max(0, Math.min(1, depthCompression || 0));
    }
    if (typeof timeCompression !== 'number' || timeCompression < 0 || timeCompression > 1) {
      timeCompression = Math.max(0, Math.min(1, timeCompression || 0));
    }

    // Thresholds for each condition
    const DECAY_THRESHOLD = 0.55;
    const COMPRESSION_THRESHOLD = 0.45;
    const PARADOX_WEIGHT = 1.3; // Paradox is strongest signal

    // Count how many conditions are met
    const decayMet = decayStrength > DECAY_THRESHOLD;
    const compressionMet = depthCompression > COMPRESSION_THRESHOLD || timeCompression > COMPRESSION_THRESHOLD;
    const paradoxMet = volatilityParadox === true;

    // Composite logic: At least 2 of 3 conditions required
    // AND paradox must be present for high confidence
    const conditionsMet = (decayMet ? 1 : 0) + (compressionMet ? 1 : 0) + (paradoxMet ? 1 : 0);

    const forPermissionSlip = conditionsMet >= 2 && paradoxMet;

    // Confidence = weighted average of signal strengths
    let confidence = 0;
    if (decayMet) confidence += decayStrength * 0.3;
    if (compressionMet) confidence += Math.max(depthCompression, timeCompression) * 0.3;
    if (paradoxMet) confidence += PARADOX_WEIGHT * 0.4; // Paradox = 40% of confidence

    confidence = Math.min(1, Math.max(0, confidence));

    return {
      forPermissionSlip,
      forConfidence: forPermissionSlip ? confidence : 0
    };
  }

  /**
   * Helper to safely access price from frame
   */
  private getFramePrice(frame: any): number {
    return (frame?.price as any)?.close ?? 0;
  }

  /**
   * Helper to safely get multiple price properties
   */
  private getFramePriceData(frame: any): { close: number; open: number } {
    const price = frame?.price as any;
    return {
      close: price?.close ?? 0,
      open: price?.open ?? 0,
    };
  }

  /**
   * Track RTM metric history for temporal pattern detection
   */
  private updateHistory(
    price: number,
    coherence: number,
    turbulence: number,
    reversionQuality: number = 0
  ): void {
    this.historyBuffer.push({
      price,
      gradient: 0, // Placeholder; compute from previous if needed
      curl: 0,
      coherence,
      turbulence,
      reversionQuality,
      timestamp: Date.now()
    });

    if (this.historyBuffer.length > this.bufferSize) {
      this.historyBuffer.shift();
    }
  }

  /**
   * Utility: Get RTM history for analysis
   */
  getHistory() {
    return [...this.historyBuffer];
  }

  /**
   * Utility: Reset for new position/test
   */
  reset(): void {
    this.historyBuffer = [];
  }
}

export const physicsBasedRTMEngine = new PhysicsBasedRTMEngine();
