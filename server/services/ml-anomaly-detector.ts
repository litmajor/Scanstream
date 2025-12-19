
/**
 * Market Anomaly Detector
 * 
 * Detects unusual patterns that may indicate:
 * - Flash crashes
 * - Pump & dumps
 * - Manipulation
 * - News events
 * - Black swan events
 */

import type { MarketFrame } from '@shared/schema';

export interface Anomaly {
  type: 'price_spike' | 'volume_surge' | 'spread_widening' | 'liquidity_drain' | 'manipulation' | 'normal';
  severity: number; // 0-10
  confidence: number;
  description: string;
  recommendation: string;
}

export class AnomalyDetector {
  private baselineMetrics: {
    priceVolatility: number;
    volumeAvg: number;
    spreadAvg: number;
    netFlowStd: number;
  } | null = null;

  /**
   * Calculate baseline metrics from historical data
   */
  private calculateBaseline(frames: MarketFrame[]): void {
    // Safely extract values since MarketFrame fields may be unknown at compile-time
    const prices: number[] = frames
      .map(f => (f as any)?.price?.close)
      .filter((v): v is number => typeof v === 'number');

    const volumes: number[] = frames
      .map(f => (f as any)?.volume)
      .filter((v): v is number => typeof v === 'number');

    const spreads: number[] = frames
      .map(f => (f as any)?.marketMicrostructure?.spread)
      .filter((v): v is number => typeof v === 'number');

    const netFlows: number[] = frames
      .map(f => (f as any)?.orderFlow?.netFlow)
      .filter((v): v is number => typeof v === 'number');

    // Guard against insufficient clean data
    const safeAvg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);

    // Price volatility (use returns if available)
    let priceVolatility = 0.0001;
    if (prices.length > 1) {
      const returns = prices.slice(1).map((p, i) => Math.abs((p - prices[i]) / prices[i]));
      priceVolatility = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0.0001;
    }

    const volumeAvg = safeAvg(volumes) || 1;
    const spreadAvg = safeAvg(spreads) || 1;

    // Net flow standard deviation
    let netFlowStd = 0.0001;
    if (netFlows.length > 0) {
      const netFlowMean = netFlows.reduce((a, b) => a + b, 0) / netFlows.length;
      const netFlowVariance = netFlows.reduce((sum, nf) => sum + Math.pow(nf - netFlowMean, 2), 0) / netFlows.length;
      netFlowStd = Math.sqrt(netFlowVariance) || 0.0001;
    }

    this.baselineMetrics = {
      priceVolatility,
      volumeAvg,
      spreadAvg,
      netFlowStd
    };
  }

  /**
   * Detect anomalies in current market frame
   */
  detectAnomaly(frames: MarketFrame[]): Anomaly {
    if (frames.length < 100) {
      return {
        type: 'normal',
        severity: 0,
        confidence: 0.5,
        description: 'Insufficient data for anomaly detection',
        recommendation: 'Continue monitoring'
      };
    }
    
    // Calculate baseline if not already done
    if (!this.baselineMetrics) {
      this.calculateBaseline(frames.slice(0, -10));
    }
    
    const current = frames[frames.length - 1];
    const previous = frames[frames.length - 2];
    const baseline = this.baselineMetrics!;

    // Safe accessors with sensible fallbacks
    const getPriceClose = (f: MarketFrame) => Number((f as any)?.price?.close ?? 0);
    const getVolume = (f: MarketFrame) => Number((f as any)?.volume ?? 0);
    const getSpread = (f: MarketFrame) => Number((f as any)?.marketMicrostructure?.spread ?? 0);
    const getToxicity = (f: MarketFrame) => Number((f as any)?.marketMicrostructure?.toxicity ?? 0);
    const getDepth = (f: MarketFrame) => Number((f as any)?.marketMicrostructure?.depth ?? 0);
    const getNetFlow = (f: MarketFrame) => Number((f as any)?.orderFlow?.netFlow ?? 0);
    const getLargeOrders = (f: MarketFrame) => Number((f as any)?.orderFlow?.largeOrders ?? 0);

    // Check for price spikes
    const prevPrice = getPriceClose(previous) || 1;
    const currPrice = getPriceClose(current) || prevPrice;
    const priceChange = Math.abs((currPrice - prevPrice) / prevPrice);
    const priceAnomalyScore = baseline.priceVolatility > 0 ? priceChange / baseline.priceVolatility : priceChange / 0.0001;

    // Check for volume surges
    const volumeAnomalyScore = (getVolume(current) || 0) / (baseline.volumeAvg || 1);

    // Check for spread widening
    const spreadAnomalyScore = (getSpread(current) || 0) / (baseline.spreadAvg || 1);

    // Check for unusual order flow
    const netFlowAnomalyScore = Math.abs((getNetFlow(current) || 0) / (baseline.netFlowStd || 0.0001));

    // Toxicity spike
    const toxicityScore = getToxicity(current);
    
    // Determine anomaly type
    let type: Anomaly['type'] = 'normal';
    let severity = 0;
    let confidence = 0;
    let description = 'Normal market conditions';
    let recommendation = 'Continue trading as normal';
    
    if (priceAnomalyScore > 5 && volumeAnomalyScore > 3) {
      type = 'price_spike';
      severity = Math.min(10, Math.floor(priceAnomalyScore));
      confidence = 0.85;
      description = `Extreme price movement (${(priceChange * 100).toFixed(2)}%) with high volume`;
      recommendation = 'PAUSE TRADING - Wait for stabilization. Potential flash event.';
    } else if (volumeAnomalyScore > 5 && netFlowAnomalyScore > 3) {
      type = 'volume_surge';
      severity = Math.min(10, Math.floor(volumeAnomalyScore));
      confidence = 0.8;
      description = `Unusual volume spike (${volumeAnomalyScore.toFixed(1)}x normal) with directional flow`;
      recommendation = 'Major event detected. Reduce position sizes, widen stops.';
    } else if (spreadAnomalyScore > 3 && toxicityScore > 0.7) {
      type = 'spread_widening';
      severity = Math.min(10, Math.floor(spreadAnomalyScore));
      confidence = 0.75;
      description = `Spread widening ${spreadAnomalyScore.toFixed(1)}x with high toxicity`;
      recommendation = 'Liquidity issue detected. Avoid new positions, exit with limit orders.';
    } else if (getDepth(current) < baseline.volumeAvg * 0.3) {
      type = 'liquidity_drain';
      severity = 7;
      confidence = 0.7;
      description = 'Market depth significantly below normal';
      recommendation = 'Low liquidity environment. Use smaller positions, expect slippage.';
    } else if (
      getLargeOrders(current) > getVolume(current) * 0.6 &&
      Math.abs(getNetFlow(current)) > getVolume(current) * 0.8
    ) {
      type = 'manipulation';
      severity = 8;
      confidence = 0.65;
      description = 'Large concentrated orders with extreme directional bias';
      recommendation = 'Possible manipulation. Avoid trading until pattern clears.';
    } else if (priceAnomalyScore > 2 || volumeAnomalyScore > 2 || spreadAnomalyScore > 2) {
      // Moderate anomaly
      severity = Math.max(
        Math.floor(priceAnomalyScore),
        Math.floor(volumeAnomalyScore),
        Math.floor(spreadAnomalyScore)
      );
      confidence = 0.6;
      description = 'Elevated market activity detected';
      recommendation = 'Increased caution. Monitor closely.';
    }
    
    return {
      type,
      severity,
      confidence,
      description,
      recommendation
    };
  }

  /**
   * Get anomaly history
   */
  getAnomalyReport(frames: MarketFrame[], lookback: number = 20): {
    anomalies: Anomaly[];
    avgSeverity: number;
    highRiskPeriods: number;
  } {
    const anomalies: Anomaly[] = [];
    
    for (let i = frames.length - lookback; i < frames.length; i++) {
      if (i < 100) continue;
      const anomaly = this.detectAnomaly(frames.slice(0, i + 1));
      anomalies.push(anomaly);
    }
    
    const avgSeverity = anomalies.reduce((sum, a) => sum + a.severity, 0) / anomalies.length;
    const highRiskPeriods = anomalies.filter(a => a.severity >= 7).length;
    
    return {
      anomalies,
      avgSeverity,
      highRiskPeriods
    };
  }
}

export default new AnomalyDetector();
