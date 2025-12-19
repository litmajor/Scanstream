
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';
import { 
  getClusterMetrics,
  createReversalDetector,
  type ClusterSnapshot
} from '../clustering';

/**
 * Comprehensive mean reversion analysis
 */
interface MeanReversionAnalysis {
  // RSI-based extremes
  rsi_level: number;
  is_oversold: boolean;
  is_overbought: boolean;
  rsi_strength: number; // How extreme (0-100)
  
  // Divergence detection (multiple types)
  rsi_divergence: 'BULLISH' | 'BEARISH' | 'NONE';
  macd_divergence: 'BULLISH' | 'BEARISH' | 'NONE';
  hidden_divergence: boolean;
  
  // Momentum exhaustion
  momentum_exhaustion: boolean;
  consecutive_moves: number; // Consecutive same-direction candles
  
  // Volume exhaustion
  volume_exhaustion: boolean;
  volume_ratio: number;
  volume_trend: number; // Declining volume = exhaustion
  
  // Excessive moves
  recent_move_pct: number;
  is_excessive: boolean;
  
  // Bollinger Bands
  bb_position: number; // 0-1, position within bands
  at_bb_extreme: boolean; // At upper/lower band
  
  // Confluence scoring
  confluence_score: number; // 0-1, how many factors align
  reversal_probability: number; // 0-1
}

export class ReversalMaster extends TradingAgent {
  // Specialist stats
  reversal_accuracy: number = 0;
  divergence_detection_rate: number = 0;
  oversold_win_rate: number = 0;
  momentum_exhaustion_rate: number = 0;
  
  // Historical tracking (may include cluster snapshot for prior calls)
  private reversal_history: { price: number; rsi: number; timestamp: number; cluster_metrics?: ClusterSnapshot }[] = [];
  
  constructor(name: string) {
    super(name, 'REVERSAL', 'balanced');
  }
  
  /**
   * Advanced mean reversion detection with multi-factor analysis
   * Detects: RSI extremes, divergences, momentum exhaustion, volume exhaustion, excessive moves
   */
  processSignal(marketData: any): AgentSignal | null {
    const { 
      price, support, resistance, rsi, macd, volume, avg_volume, regime,
      price_history, rsi_history, high, low, close, ema20, ema50, atr, symbol
    } = marketData;
    
    // 1. COMPREHENSIVE MEAN REVERSION ANALYSIS
    const analysis = this.analyzeMeanReversion(marketData);
    
    // Minimum confluence: At least 2-3 factors must align for quality signal
    if (analysis.confluence_score < 0.5) return null;
    
    // 2. DETERMINE REVERSAL DIRECTION
    // In oversold territory → bullish reversal
    // In overbought territory → bearish reversal
    const is_bullish = analysis.is_oversold || (analysis.rsi_divergence === 'BULLISH');
    const is_bearish = analysis.is_overbought || (analysis.rsi_divergence === 'BEARISH');
    
    if (!is_bullish && !is_bearish) return null;
    
    // 3. CLUSTER BREAKDOWN FILTERING - NEW CRITICAL LAYER
    let cluster_breakdown_risk = 0;
    let cluster_reversal_confidence = 1.0;
    let previous_metrics: any = null;
    
    if (symbol) {
      const currentMetrics = getClusterMetrics(symbol);
      
      if (currentMetrics && currentMetrics.cluster_strength > 0) {
        // Store metrics for next call
        if (!this.reversal_history) this.reversal_history = [];
        
        // Get previous state if available
        const lastEntry = this.reversal_history[this.reversal_history.length - 1];
        if (lastEntry && lastEntry.cluster_metrics) {
          previous_metrics = lastEntry.cluster_metrics as ClusterSnapshot;
        }

        // Create a ClusterSnapshot from the returned metrics by attaching a timestamp
        const currentSnapshot: ClusterSnapshot = { ...currentMetrics, timestamp: Date.now() };

        // Use reversal detector to check for cluster breakdown patterns only if we have a previous snapshot
        const detector = createReversalDetector();
        let breakdown: any = null;
        if (previous_metrics) {
          breakdown = detector.detectBreakdown(previous_metrics as ClusterSnapshot, currentSnapshot);

          cluster_breakdown_risk = breakdown.strength_decline; // numeric 0-1
          cluster_reversal_confidence = breakdown.reversal_probability; // 0-1

          console.log(
            `[ReversalMaster] Cluster breakdown analysis for ${symbol}: ` +
            `current_strength=${currentMetrics.cluster_strength.toFixed(2)}, ` +
            `strength_decline=${breakdown.strength_decline.toFixed(2)}, ` +
            `reversal_confidence=${breakdown.reversal_probability.toFixed(2)}`
          );
        }

        // Store current state for next call (include snapshot)
        this.reversal_history.push({
          price,
          rsi,
          timestamp: Date.now(),
          cluster_metrics: currentSnapshot
        });
        
        // Keep history limited
        if (this.reversal_history.length > 100) {
          this.reversal_history.shift();
        }
      }
    }
    
    // 3. CALCULATE SIGNAL QUALITY - Multi-factor weighting
    let quality = 0;
    
    // RSI extreme strength (primary reversal signal)
    if (analysis.is_oversold || analysis.is_overbought) {
      quality += (analysis.rsi_strength / 100) * 0.25;
    }
    
    // Divergence detection (powerful reversal signal)
    if (analysis.rsi_divergence !== 'NONE') {
      quality += 0.25; // Strong bonus for any divergence
    }
    if (analysis.hidden_divergence) {
      quality += 0.15; // Additional bonus for hidden divergence
    }
    
    // Momentum exhaustion (4+ same direction candles, slowing)
    if (analysis.momentum_exhaustion) {
      quality += 0.20;
    }
    
    // Volume exhaustion (high volume but declining)
    if (analysis.volume_exhaustion) {
      quality += 0.15;
    }
    
    // Excessive move (15%+ in 5 periods)
    if (analysis.is_excessive) {
      quality += 0.15;
    }
    
    // Bollinger Band extremes
    if (analysis.at_bb_extreme) {
      quality += 0.10;
    }
    
    // Support/Resistance proximity
    const at_support = Math.abs(price - support) / price < 0.015;
    const at_resistance = Math.abs(price - resistance) / price < 0.015;
    if (at_support || at_resistance) {
      quality += 0.10;
    }
    
    // Confluence bonus (when multiple factors agree)
    quality += (analysis.confluence_score * 0.15);
    
    // CLUSTER BREAKDOWN FILTERING (NEW - CRITICAL)
    // Apply cluster reversal confidence as multiplier
    quality *= cluster_reversal_confidence;
    
    // Penalize if cluster breakdown indicates false reversal (high risk)
    if (cluster_breakdown_risk > 0.7) {
      quality *= 0.5; // Heavily reduce if breakdown risk very high
    } else if (cluster_breakdown_risk > 0.5) {
      quality *= 0.75; // Moderate reduction if moderate breakdown risk
    }
    
    // Pattern skill enhancement
    quality *= (1 + this.skills.pattern_recognition / 20);
    
    // Regime-aware adjustment
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'RANGING' || regime === 'SIDEWAYS') {
        quality *= 1.4; // Reversals EXCEL in ranging markets
      } else if (regime === 'TRENDING' || regime === 'BULL_TRENDING') {
        quality *= 0.5; // Avoid counter-trend in strong trends
      } else if (regime === 'VOLATILE') {
        quality *= 0.8; // Okay but be cautious
      }
    }
    
    // Quality threshold: Need reasonable confluence
    if (quality < 0.55) return null;
    
    // 4. CALCULATE TARGETS & STOPS
    const action = is_bullish ? 'BUY' : 'SELL';
    const target = this.calculateTarget(marketData, analysis, action);
    const stop = this.calculateStop(marketData, analysis, action);
    
    // 5. BUILD DETAILED REASON STRING
    const factors: string[] = [];
    if (analysis.is_oversold) factors.push(`Oversold RSI ${rsi.toFixed(0)}`);
    if (analysis.is_overbought) factors.push(`Overbought RSI ${rsi.toFixed(0)}`);
    if (analysis.rsi_divergence !== 'NONE') factors.push(`${analysis.rsi_divergence} RSI divergence`);
    if (analysis.momentum_exhaustion) factors.push(`${analysis.consecutive_moves} candle exhaustion`);
    if (analysis.volume_exhaustion) factors.push(`Volume exhaustion (ratio: ${analysis.volume_ratio.toFixed(2)}x)`);
    if (analysis.is_excessive) factors.push(`Excessive move ${analysis.recent_move_pct.toFixed(2)}%`);
    
    const reason = `Mean reversion confluence (${(analysis.confluence_score * 100).toFixed(0)}%): ${factors.join(' • ')}`;
    
    // Track reversal for history
    this.reversal_history.push({ price, rsi, timestamp: Date.now() });
    
    return {
      action,
      confidence: Math.min(quality, 0.95) * this.confidence, // Cap confidence
      entry: price,
      target,
      stop,
      reason,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  /**
   * Comprehensive mean reversion analysis across multiple indicators
   */
  private analyzeMeanReversion(data: any): MeanReversionAnalysis {
    const { 
      price, price_history, rsi, rsi_history, macd, volume, avg_volume,
      high, low, support, resistance
    } = data;
    
    // Initialize analysis object
    const analysis: MeanReversionAnalysis = {
      rsi_level: rsi,
      is_oversold: rsi < 30,
      is_overbought: rsi > 70,
      rsi_strength: Math.abs(50 - rsi) / 50 * 100, // Distance from neutral (50)
      rsi_divergence: this.detectRSIDivergence(price_history, rsi_history),
      macd_divergence: this.detectMACDDivergence(price_history, macd),
      hidden_divergence: false,
      momentum_exhaustion: false,
      consecutive_moves: 0,
      volume_exhaustion: false,
      volume_ratio: volume / avg_volume,
      volume_trend: 0,
      recent_move_pct: 0,
      is_excessive: false,
      bb_position: 0.5,
      at_bb_extreme: false,
      confluence_score: 0,
      reversal_probability: 0
    };
    
    // 1. DETECT MOMENTUM EXHAUSTION
    const exhaustion = this.detectMomentumExhaustion(price_history);
    analysis.momentum_exhaustion = exhaustion.is_exhausted;
    analysis.consecutive_moves = exhaustion.consecutive_moves;
    
    // 2. DETECT VOLUME EXHAUSTION
    const vol_analysis = this.analyzeVolumeExhaustion(data);
    analysis.volume_exhaustion = vol_analysis.is_exhausted;
    analysis.volume_trend = vol_analysis.trend;
    
    // 3. DETECT EXCESSIVE MOVES
    const recent_move = this.calculateRecentMove(price_history);
    analysis.recent_move_pct = recent_move;
    analysis.is_excessive = Math.abs(recent_move) > 15; // 15%+ in 5 periods
    
    // 4. DETECT HIDDEN DIVERGENCE (advanced)
    analysis.hidden_divergence = this.detectHiddenDivergence(price_history, rsi_history);
    
    // 5. CALCULATE BOLLINGER BAND POSITION
    const bb_analysis = this.analyzeBollingerBands(data);
    analysis.bb_position = bb_analysis.position;
    analysis.at_bb_extreme = bb_analysis.at_extreme;
    
    // 6. CONFLUENCE SCORING
    // Count how many factors are aligned
    const alignment_factors = [
      analysis.is_oversold || analysis.is_overbought ? 1 : 0,
      analysis.rsi_divergence !== 'NONE' ? 1 : 0,
      analysis.hidden_divergence ? 1 : 0,
      analysis.momentum_exhaustion ? 1 : 0,
      analysis.volume_exhaustion ? 1 : 0,
      analysis.is_excessive ? 1 : 0,
      analysis.at_bb_extreme ? 1 : 0
    ];
    
    const aligned_count = alignment_factors.reduce((a, b) => a + b, 0);
    analysis.confluence_score = aligned_count / alignment_factors.length; // 0-1 score
    
    // 7. REVERSAL PROBABILITY
    // Higher confluence + more extreme RSI = higher probability
    analysis.reversal_probability = 
      (analysis.confluence_score * 0.6) + 
      (Math.min(analysis.rsi_strength, 100) / 100 * 0.4);
    
    return analysis;
  }
  
  /**
   * Detect RSI divergence (bullish and bearish)
   */
  private detectRSIDivergence(
    priceHistory: number[] | undefined,
    rsiHistory: number[] | undefined
  ): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (!priceHistory || !rsiHistory || priceHistory.length < 20) return 'NONE';
    
    const prices = priceHistory.slice(-20);
    const rsis = rsiHistory.slice(-20);
    
    // Find recent price low and high
    const price_low1_idx = prices.indexOf(Math.min(...prices.slice(0, 10)));
    const price_low2_idx = prices.indexOf(Math.min(...prices.slice(10, 20)));
    
    const price_high1_idx = prices.indexOf(Math.max(...prices.slice(0, 10)));
    const price_high2_idx = prices.indexOf(Math.max(...prices.slice(10, 20)));
    
    // BULLISH DIVERGENCE: Price makes lower low, but RSI makes higher low
    if (prices[price_low2_idx] < prices[price_low1_idx]) {
      if (rsis[price_low2_idx] > rsis[price_low1_idx]) {
        return 'BULLISH';
      }
    }
    
    // BEARISH DIVERGENCE: Price makes higher high, but RSI makes lower high
    if (prices[price_high2_idx] > prices[price_high1_idx]) {
      if (rsis[price_high2_idx] < rsis[price_high1_idx]) {
        return 'BEARISH';
      }
    }
    
    return 'NONE';
  }
  
  /**
   * Detect MACD divergence
   */
  private detectMACDDivergence(
    priceHistory: number[] | undefined,
    macd: any
  ): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (!priceHistory || !macd || priceHistory.length < 10) return 'NONE';
    
    // Simplified: MACD crossing could indicate divergence
    const macd_bullish = macd.macd > macd.signal;
    const macd_histogram_bullish = macd.histogram > 0;
    
    // Check if price is making lower lows but MACD is bullish
    const recent_prices = priceHistory.slice(-5);
    const is_lower_low = recent_prices[4] < recent_prices[0];
    
    if (is_lower_low && macd_bullish) {
      return 'BULLISH';
    }
    
    return 'NONE';
  }
  
  /**
   * Detect hidden divergence (advanced: pullbacks within trends)
   */
  private detectHiddenDivergence(
    priceHistory: number[] | undefined,
    rsiHistory: number[] | undefined
  ): boolean {
    if (!priceHistory || !rsiHistory || priceHistory.length < 15) return false;
    
    // Hidden divergence: In uptrend, price makes higher low but RSI makes lower low
    // This suggests trend continuation (hidden) rather than reversal
    // For our purposes: Detect when this setup could reverse
    
    const recent_prices = priceHistory.slice(-15);
    const recent_rsi = rsiHistory.slice(-15);
    
    // Check for pattern: higher lows in price but lower lows in RSI
    let pattern_detected = false;
    
    for (let i = 5; i < 10; i++) {
      const is_higher_low = recent_prices[i + 5] > recent_prices[i];
      const is_lower_low_rsi = recent_rsi[i + 5] < recent_rsi[i];
      
      if (is_higher_low && is_lower_low_rsi) {
        pattern_detected = true;
        break;
      }
    }
    
    return pattern_detected;
  }
  
  /**
   * Detect momentum exhaustion (4+ consecutive moves in same direction, slowing)
   */
  private detectMomentumExhaustion(priceHistory: number[] | undefined): 
    { is_exhausted: boolean; consecutive_moves: number } {
    
    if (!priceHistory || priceHistory.length < 5) {
      return { is_exhausted: false, consecutive_moves: 0 };
    }
    
    const recent = priceHistory.slice(-5);
    let consecutive = 1;
    let direction = recent[1] > recent[0] ? 'up' : 'down';
    
    // Count consecutive same-direction candles
    for (let i = 2; i < recent.length; i++) {
      const move = recent[i] > recent[i - 1] ? 'up' : 'down';
      if (move === direction) {
        consecutive++;
      } else {
        direction = move;
        consecutive = 1;
      }
    }
    
    // Exhaustion = 4+ same direction moves
    const is_exhausted = consecutive >= 4;
    
    return { is_exhausted, consecutive_moves: consecutive };
  }
  
  /**
   * Analyze volume exhaustion (high volume but declining)
   */
  private analyzeVolumeExhaustion(data: any): 
    { is_exhausted: boolean; trend: number } {
    
    const { volume, volume_history, avg_volume } = data;
    
    if (!volume_history || volume_history.length < 3) {
      return { is_exhausted: false, trend: 0 };
    }
    
    const recent_vol = volume_history.slice(-3);
    
    // High volume recently (1.5x average)
    const high_volume = recent_vol[2] > avg_volume * 1.5;
    
    // But declining (last volume < middle volume)
    const declining = recent_vol[2] < recent_vol[0];
    
    // Trend: Calculate average change
    const trend = (recent_vol[2] - recent_vol[0]) / recent_vol[0];
    
    const is_exhausted = high_volume && declining;
    
    return { is_exhausted, trend };
  }
  
  /**
   * Calculate recent move percentage (5-period)
   */
  private calculateRecentMove(priceHistory: number[] | undefined): number {
    if (!priceHistory || priceHistory.length < 5) return 0;
    
    const recent = priceHistory.slice(-5);
    const move = ((recent[4] - recent[0]) / recent[0]) * 100;
    
    return move;
  }
  
  /**
   * Analyze Bollinger Band position
   */
  private analyzeBollingerBands(data: any): { position: number; at_extreme: boolean } {
    const { price, high, low } = data;
    
    // Simplified: Estimate bands from recent range
    // Real implementation would use actual BB calculation
    const recent_high = high || price * 1.02;
    const recent_low = low || price * 0.98;
    const bb_middle = (recent_high + recent_low) / 2;
    
    // Position: 0 = at lower band, 0.5 = middle, 1 = upper band
    const position = (price - recent_low) / (recent_high - recent_low);
    
    // At extreme if at upper band (>0.8) or lower band (<0.2)
    const at_extreme = position > 0.8 || position < 0.2;
    
    return { position, at_extreme };
  }
  
  private calculateTarget(data: any, analysis: MeanReversionAnalysis, action: string): number {
    const { price, resistance, support, atr, expected_7d_move } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Smart target: Use expected move or midpoint
      if (action === 'BUY') {
        // Target resistance or halfway to resistance
        return price + ((resistance - price) * 0.6);
      } else {
        // Target support
        return price - ((price - support) * 0.6);
      }
    } else {
      // Conservative targets
      if (action === 'BUY') {
        return price * 1.025; // 2.5% bounce target
      } else {
        return price * 0.975; // 2.5% pullback target
      }
    }
  }
  
  private calculateStop(data: any, analysis: MeanReversionAnalysis, action: string): number {
    const { price, support, resistance, atr } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    if (action === 'BUY') {
      // Stop below support (mean reversion failed)
      const base_stop = support * 0.98;
      
      // Tighter with better risk management
      const adjusted = price - ((price - base_stop) * (1 - risk_skill * 0.3));
      
      return Math.max(adjusted, base_stop);
    } else {
      // Stop above resistance
      const base_stop = resistance * 1.02;
      const adjusted = price + ((base_stop - price) * (1 - risk_skill * 0.3));
      
      return Math.min(adjusted, base_stop);
    }
  }
  
  /**
   * Get reversal analysis for UI/display
   */
  getReversionStatus() {
    return {
      reversal_accuracy: this.reversal_accuracy,
      divergence_detection_rate: this.divergence_detection_rate,
      oversold_win_rate: this.oversold_win_rate,
      momentum_exhaustion_rate: this.momentum_exhaustion_rate,
      recent_reversals: this.reversal_history.slice(-10)
    };
  }
}
