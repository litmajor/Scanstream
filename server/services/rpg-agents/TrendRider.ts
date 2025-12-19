
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';
import { 
  getClusterMetrics, 
  createClusterValidator, 
  createPositionSizer,
  createTradeDurationPredictor
} from '../clustering';

/**
 * Multi-timeframe gradient analysis for comprehensive trend visualization
 */
interface GradientAnalysis {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;           // 0-100 (gradient steepness)
  trend_change_detected: boolean;
  gradient_slope: number;     // Rate of change
  support_level: number;
  resistance_level: number;
  bands: {
    upper3: number;
    upper2: number;
    upper1: number;
    lower1: number;
    lower2: number;
    lower3: number;
  };
}

export class TrendRider extends TradingAgent {
  // Specialist stats
  trend_capture_rate: number = 0;
  ema_alignment_accuracy: number = 0;
  adx_confirmation_rate: number = 0;
  gradient_accuracy: number = 0;
  
  // Gradient trend state
  private gradient_history: { value: number; timestamp: number }[] = [];
  private multi_timeframe_gradients: Map<string, GradientAnalysis> = new Map();
  
  constructor(name: string) {
    super(name, 'MA_CROSSOVER', 'balanced');
  }
  
  /**
   * Advanced trend riding using gradient trend analysis
   * Combines EMA alignment, ADX, and multi-timeframe gradient visualization
   */
  processSignal(marketData: any): AgentSignal | null {
    const { 
      price, ema20, ema50, ema200, adx, macd, volume, avg_volume, regime,
      high, low, close, price_history, symbol
    } = marketData;
    
    // 1. GRADIENT TREND ANALYSIS - Multi-timeframe
    const gradient_1h = this.calculateGradientTrend(price_history, 25);  // 25-period gradient
    const gradient_4h = this.calculateGradientTrend(price_history, 100); // Longer-term
    const gradient_1d = this.calculateGradientTrend(price_history, 240); // Daily equivalent
    
    // Store for visualization
    this.multi_timeframe_gradients.set('1h', gradient_1h);
    this.multi_timeframe_gradients.set('4h', gradient_4h);
    this.multi_timeframe_gradients.set('1d', gradient_1d);
    
    // 2. MULTI-TIMEFRAME CONFLUENCE - Are all timeframes aligned?
    const confluence_score = this.calculateTimeframeConfluence(gradient_1h, gradient_4h, gradient_1d);
    
    // 3. TRADITIONAL EMA + ADX (baseline confirmation)
    const bullish_alignment = ema20 > ema50 && ema50 > ema200;
    const strong_trend = adx > 25;
    const macd_bullish = macd.macd > macd.signal;
    
    // Reject if no meaningful trend signal
    if (!bullish_alignment && !strong_trend && gradient_1h.direction !== 'BULLISH') {
      return null;
    }
    
    // 4. CLUSTERING VALIDATION - NEW CRITICAL LAYER
    const clusterMetrics = symbol ? getClusterMetrics(symbol) : null;
    let cluster_validation_quality = 0;
    let cluster_size_multiplier = 1.0;
    let estimated_duration_hrs = 4; // default
    
    if (clusterMetrics && clusterMetrics.cluster_strength > 0) {
      // Use cluster validator for entry quality
      const validator = createClusterValidator();
      const base_confidence = 0.7; // Base trend confidence
      const entry_validation = validator.validateEntry(base_confidence, clusterMetrics);

      cluster_validation_quality = entry_validation.final_entry_quality * 0.20; // 20% of total quality

      // Use position sizer for dynamic sizing - map ClusterMetrics -> PositionSizingInput
      const sizer = createPositionSizer();
      const sizing = sizer.calculateSize({
        baseSize: this.positionSize || 1,
        cluster_strength: clusterMetrics.cluster_strength,
        trend_formation: !!(clusterMetrics as any).trend_formation || !!(clusterMetrics as any).trend_formation_signal,
        signal_quality: entry_validation.final_entry_quality
      });
      cluster_size_multiplier = sizing.size_multiplier; // 0.5x to 2.0x

      // Use duration predictor for trade holding period
      const predictor = createTradeDurationPredictor();
      const duration = predictor.predictDuration(
        clusterMetrics.cluster_strength,
        !!(clusterMetrics as any).trend_formation || !!(clusterMetrics as any).trend_formation_signal
      );
      // Map predicted bars to hours (1 bar ~= 1 hour assumption)
      estimated_duration_hrs = duration.predicted_duration_bars;

      console.log(
        `[TrendRider] Clustering validation for ${symbol || 'UNKNOWN'}: ` +
        `strength=${clusterMetrics.cluster_strength.toFixed(2)}, ` +
        `formation=${(clusterMetrics as any).trend_formation_signal || (clusterMetrics as any).trend_formation}, ` +
        `entry_quality=${entry_validation.final_entry_quality.toFixed(2)}, ` +
        `size_mult=${sizing.size_multiplier.toFixed(2)}x, ` +
        `duration=${estimated_duration_hrs.toFixed(0)}h`
      );
    }
    
    // 5. CALCULATE SIGNAL QUALITY - Multi-factor
    let quality = 0;
    
    // Gradient trend strength (primary signal in TrendRider 2.0)
    if (gradient_1h.direction === 'BULLISH') {
      quality += 0.4 * (gradient_1h.strength / 100); // Gradient is primary
    }
    
    // Multi-timeframe confluence bonus
    quality += confluence_score * 0.25;
    
    // EMA alignment bonus (confirmation)
    if (bullish_alignment) quality += 0.15;
    
    // Trend strength bonus (ADX)
    if (adx > 40) quality += 0.15;
    else if (adx > 25) quality += 0.08;
    
    // MACD confirmation
    if (macd_bullish) quality += 0.08;
    
    // Volume confirmation
    if (volume > avg_volume * 1.3) quality += 0.08;
    
    // Gradient trend change detection (powerful entry signal)
    if (gradient_1h.trend_change_detected && gradient_1h.direction === 'BULLISH') {
      quality += 0.15; // Bonus for catching trend reversal
    }
    
    // CLUSTERING QUALITY CONTRIBUTION (NEW)
    quality += cluster_validation_quality;
    
    // Skill enhancement
    quality *= (1 + this.skills.pattern_recognition / 20); // Softer skill scaling
    
    // Regime awareness - gradient excels in trending
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'TRENDING' || regime === 'BULL_TRENDING') {
        quality *= 1.3;
      } else if (regime === 'RANGING') {
        quality *= 0.6;
      } else if (regime === 'VOLATILE') {
        quality *= 0.8;
      }
    }
    
    // Require higher quality threshold
    if (quality < 0.60) return null;
    
    const target = this.calculateTarget(marketData, gradient_1h);
    const stop = this.calculateStop(marketData, gradient_1h);
    
    const gradient_signal = `Gradient ${gradient_1h.direction} (strength: ${gradient_1h.strength.toFixed(0)}%, confluences: ${confluence_score.toFixed(1)})`;
    const ema_signal = bullish_alignment ? 'EMA aligned' : 'EMA partial';
    const trend_signal = adx > 25 ? `strong trend (ADX ${adx.toFixed(0)})` : 'weak trend';
    const cluster_signal = clusterMetrics ? `cluster strength=${clusterMetrics.cluster_strength.toFixed(2)}` : 'no clusters';
    
    return {
      action: 'BUY',
      confidence: Math.min(quality, 0.95) * this.confidence, // Cap confidence
      entry: price,
      target,
      stop,
      reason: `${gradient_signal} • ${ema_signal} • ${trend_signal} • ${cluster_signal}`,
      agent_name: this.name,
      agent_level: this.level,
      size_multiplier: cluster_size_multiplier,
      estimated_duration_hours: estimated_duration_hrs
    };
  }
  
  /**
   * Calculate gradient trend using triple EMA smoothing
   * Visualizes trend direction and strength
   */
  private calculateGradientTrend(
    priceHistory: number[],
    period: number
  ): GradientAnalysis {
    if (!priceHistory || priceHistory.length < period + 5) {
      return {
        direction: 'NEUTRAL',
        strength: 0,
        trend_change_detected: false,
        gradient_slope: 0,
        support_level: 0,
        resistance_level: 0,
        bands: { upper3: 0, upper2: 0, upper1: 0, lower1: 0, lower2: 0, lower3: 0 }
      };
    }
    
    const prices = priceHistory.slice(-Math.min(period * 3, priceHistory.length));
    
    // Step 1: Calculate triple EMA (smoothed baseline)
    const ema1 = this.calculateEMA(prices, period);
    const ema2 = this.calculateEMA(ema1, Math.ceil(period / 2));
    const ema3 = this.calculateEMA(ema2, Math.ceil(period / 3));
    
    // Step 2: Calculate gradient (diff between current and previous baseline)
    const lookback = 2;
    const current_base = ema3[ema3.length - 1];
    const previous_base = ema3[Math.max(0, ema3.length - lookback - 1)];
    const gradient_slope = current_base - previous_base;
    
    // Step 3: Determine trend direction and strength
    const threshold = Math_std(ema3) * 0.5; // Dynamic threshold
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;
    
    if (gradient_slope > threshold) {
      direction = 'BULLISH';
      strength = Math.min(100, Math.abs(gradient_slope) / threshold * 50);
    } else if (gradient_slope < -threshold) {
      direction = 'BEARISH';
      strength = Math.min(100, Math.abs(gradient_slope) / threshold * 50);
    }
    
    // Step 4: Detect trend changes (gradient crosses zero)
    const trend_change_detected = this.detectGradientCrossover(current_base, previous_base);
    
    // Step 5: Calculate support/resistance from price extremes
    const recent_prices = prices.slice(-period);
    const support_level = Math.min(...recent_prices);
    const resistance_level = Math.max(...recent_prices);
    
    // Step 6: Calculate Fibonacci bands
    const volatility = Math_std(recent_prices.map(p => Math.log(p / (prices[prices.length - 2] || p))));
    const base = current_base;
    const vol_adjust = volatility * recent_prices[recent_prices.length - 1];
    
    const bands = {
      upper3: base + vol_adjust * 2.5,
      upper2: base + vol_adjust * 1.618,
      upper1: base + vol_adjust * 0.618,
      lower1: base - vol_adjust * 0.618,
      lower2: base - vol_adjust * 1.618,
      lower3: base - vol_adjust * 2.5
    };
    
    return {
      direction,
      strength: Math.max(0, strength),
      trend_change_detected,
      gradient_slope,
      support_level,
      resistance_level,
      bands
    };
  }
  
  /**
   * Calculate confluence score across timeframes
   * All timeframes bullish = 1.0, partial = 0.5, none = 0
   */
  private calculateTimeframeConfluence(
    gradient_1h: GradientAnalysis,
    gradient_4h: GradientAnalysis,
    gradient_1d: GradientAnalysis
  ): number {
    let bullish_count = 0;
    let total = 3;
    
    if (gradient_1h.direction === 'BULLISH') bullish_count++;
    if (gradient_4h.direction === 'BULLISH') bullish_count++;
    if (gradient_1d.direction === 'BULLISH') bullish_count++;
    
    // Weight higher timeframes more
    const confluence = (
      (gradient_1h.direction === 'BULLISH' ? 0.4 : 0) +
      (gradient_4h.direction === 'BULLISH' ? 0.5 : 0) +
      (gradient_1d.direction === 'BULLISH' ? 0.6 : 0)
    ) / 1.5;
    
    return Math.min(1, confluence);
  }
  
  /**
   * Detect when gradient crosses from negative to positive (bullish) or vice versa
   */
  private detectGradientCrossover(current: number, previous: number): boolean {
    // Simple crossover detection
    const threshold = 0.0001;
    return (previous < threshold && current > threshold) || 
           (previous > -threshold && current < -threshold);
  }
  
  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(data: number[], period: number): number[] {
    if (data.length < period) return data;
    
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    
    return ema;
  }
  
  private calculateTarget(data: any, gradient: GradientAnalysis): number {
    const { price, expected_7d_move, atr } = data;
    
    // Use gradient's resistance band as primary target
    if (this.abilities.includes('velocity_based_targets')) {
      // Smart target: Use either velocity profile or gradient resistance
      const velocity_target = price + (expected_7d_move * 0.8);
      const gradient_target = gradient.bands.upper2;
      
      // Pick the more conservative one
      return Math.min(velocity_target, gradient_target);
    } else {
      // Use gradient resistance level as target
      return gradient.bands.upper1 || price * 1.03;
    }
  }
  
  private calculateStop(data: any, gradient: GradientAnalysis): number {
    const { price, ema20, atr } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    // Primary stop: Below gradient support level
    const gradient_stop = gradient.support_level * 0.98;
    
    // Fallback: Below EMA20
    const ema_stop = ema20 * 0.98;
    
    // Final: ATR-based stop (tightest)
    const atr_stop = price - (atr * (1.2 - risk_skill * 0.2));
    
    // Use the highest (least risk) stop
    return Math.max(gradient_stop, ema_stop, atr_stop);
  }
  
  /**
   * Get visualization data for UI dashboard
   */
  getGradientVisualization() {
    return {
      current_gradients: Array.from(this.multi_timeframe_gradients.entries()).map(([tf, grad]) => ({
        timeframe: tf,
        direction: grad.direction,
        strength: grad.strength,
        support: grad.support_level,
        resistance: grad.resistance_level,
        bands: grad.bands
      })),
      gradient_history: this.gradient_history.slice(-50), // Last 50 values for charting
      timestamp: Date.now()
    };
  }
}

/**
 * Standard deviation helper
 */
function Math_std(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

// Monkey-patch Math.std if needed
// Keep local helper `Math_std` and avoid monkey-patching global `Math`.
