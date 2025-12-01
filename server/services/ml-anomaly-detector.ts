
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
    const prices = frames.map(f => f.price.close);
    const volumes = frames.map(f => f.volume);
    const spreads = frames.map(f => f.marketMicrostructure.spread);
    const netFlows = frames.map(f => f.orderFlow.netFlow);
    
    // Price volatility
    const returns = prices.slice(1).map((p, i) => Math.abs((p - prices[i]) / prices[i]));
    const priceVolatility = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Volume average
    const volumeAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    // Spread average
    const spreadAvg = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    
    // Net flow standard deviation
    const netFlowMean = netFlows.reduce((a, b) => a + b, 0) / netFlows.length;
    const netFlowVariance = netFlows.reduce((sum, nf) => sum + Math.pow(nf - netFlowMean, 2), 0) / netFlows.length;
    const netFlowStd = Math.sqrt(netFlowVariance);
    
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
    
    // Check for price spikes
    const priceChange = Math.abs((current.price.close - previous.price.close) / previous.price.close);
    const priceAnomalyScore = priceChange / baseline.priceVolatility;
    
    // Check for volume surges
    const volumeAnomalyScore = current.volume / baseline.volumeAvg;
    
    // Check for spread widening
    const spreadAnomalyScore = current.marketMicrostructure.spread / baseline.spreadAvg;
    
    // Check for unusual order flow
    const netFlowAnomalyScore = Math.abs(current.orderFlow.netFlow / baseline.netFlowStd);
    
    // Toxicity spike
    const toxicityScore = current.marketMicrostructure.toxicity;
    
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
    } else if (current.marketMicrostructure.depth < baseline.volumeAvg * 0.3) {
      type = 'liquidity_drain';
      severity = 7;
      confidence = 0.7;
      description = 'Market depth significantly below normal';
      recommendation = 'Low liquidity environment. Use smaller positions, expect slippage.';
    } else if (
      current.orderFlow.largeOrders > current.volume * 0.6 &&
      Math.abs(current.orderFlow.netFlow) > current.volume * 0.8
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
