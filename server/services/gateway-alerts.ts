
import { EventEmitter } from 'events';
import { signalWebSocketService } from './websocket-signals';

export interface Alert {
  id: string;
  type: 'exchange_down' | 'high_rate_limit' | 'price_deviation' | 'low_cache_hit' | 'high_latency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  exchange?: string;
  metric?: any;
  timestamp: Date;
  acknowledged: boolean;
}

class GatewayAlertSystem extends EventEmitter {
  private alerts: Alert[] = [];
  private maxAlerts = 100;
  
  // Alert thresholds
  private thresholds = {
    rateLimitUsage: 0.8, // 80%
    cacheHitRate: 0.7, // 70%
    latency: 500, // 500ms
    consecutiveFailures: 3,
    priceDeviation: 0.02 // 2%
  };

  constructor() {
    super();
  }

  /**
   * Check for exchange downtime
   */
  checkExchangeHealth(exchange: string, health: any): void {
    if (!health.healthy && health.consecutiveFailures >= this.thresholds.consecutiveFailures) {
      this.createAlert({
        type: 'exchange_down',
        severity: 'critical',
        title: `Exchange Down: ${exchange}`,
        message: `${exchange} has failed ${health.consecutiveFailures} consecutive times`,
        exchange,
        metric: health
      });
    }
  }

  /**
   * Check for high rate limit usage
   */
  checkRateLimitUsage(exchange: string, usage: number): void {
    if (usage >= this.thresholds.rateLimitUsage) {
      this.createAlert({
        type: 'high_rate_limit',
        severity: usage >= 0.95 ? 'critical' : 'high',
        title: `High Rate Limit Usage: ${exchange}`,
        message: `${exchange} rate limit at ${(usage * 100).toFixed(0)}%`,
        exchange,
        metric: { usage }
      });
    }
  }

  /**
   * Check for low cache hit rate
   */
  checkCachePerformance(hitRate: number): void {
    if (hitRate < this.thresholds.cacheHitRate) {
      this.createAlert({
        type: 'low_cache_hit',
        severity: hitRate < 0.5 ? 'high' : 'medium',
        title: 'Low Cache Hit Rate',
        message: `Cache hit rate at ${(hitRate * 100).toFixed(0)}% (target: 70%+)`,
        metric: { hitRate }
      });
    }
  }

  /**
   * Check for high latency
   */
  checkLatency(exchange: string, latency: number): void {
    if (latency > this.thresholds.latency) {
      this.createAlert({
        type: 'high_latency',
        severity: latency > 1000 ? 'high' : 'medium',
        title: `High Latency: ${exchange}`,
        message: `${exchange} latency at ${latency}ms (threshold: ${this.thresholds.latency}ms)`,
        exchange,
        metric: { latency }
      });
    }
  }

  /**
   * Check for price deviation anomaly
   */
  checkPriceDeviation(symbol: string, deviation: number): void {
    if (deviation > this.thresholds.priceDeviation) {
      this.createAlert({
        type: 'price_deviation',
        severity: deviation > 0.05 ? 'critical' : 'high',
        title: `Price Deviation Anomaly: ${symbol}`,
        message: `${symbol} has ${(deviation * 100).toFixed(2)}% price deviation across sources`,
        metric: { symbol, deviation }
      });
    }
  }

  /**
   * Create and store alert
   */
  private createAlert(params: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...params
    };
    
    this.alerts.unshift(alert);
    
    // Keep only latest alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
    
    // Emit event
    this.emit('alert', alert);
    
    // Broadcast via WebSocket
    signalWebSocketService.broadcastAlert({
      title: alert.title,
      message: alert.message,
      priority: alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 'medium'
    });
    
    console.warn(`[Gateway Alert] ${alert.severity.toUpperCase()}: ${alert.title}`);
  }

  /**
   * Get all alerts
   */
  getAlerts(filter?: { acknowledged?: boolean; severity?: string }): Alert[] {
    let filtered = this.alerts;
    
    if (filter?.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === filter.acknowledged);
    }
    
    if (filter?.severity) {
      filtered = filtered.filter(a => a.severity === filter.severity);
    }
    
    return filtered;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledged(): number {
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => !a.acknowledged);
    return before - this.alerts.length;
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

export const gatewayAlertSystem = new GatewayAlertSystem();
