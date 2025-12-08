
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';

export class SupportSniper extends TradingAgent {
  // Specialist stats
  support_bounce_rate: number = 0;
  zone_detection_accuracy: number = 0;
  volume_confirmation_rate: number = 0;
  
  constructor(name: string) {
    super(name, 'SUPPORT_BOUNCE', 'aggressive');
  }
  
  /**
   * Snipe support bounces with volume confirmation
   */
  processSignal(marketData: any): AgentSignal | null {
    const { price, support, volume, avg_volume, rsi, bounce_quality, regime } = marketData;
    
    // Base support bounce conditions
    const at_support = Math.abs(price - support) / price < 0.015; // Within 1.5% of support
    const volume_spike = volume > avg_volume * 1.5;
    const not_oversold = rsi > 25; // Avoid catching falling knives
    
    if (!at_support || !volume_spike) return null;
    
    // Calculate bounce quality
    let quality = bounce_quality || 0.5;
    
    // Volume spike strength
    const volume_ratio = volume / avg_volume;
    if (volume_ratio > 3) quality += 0.2;
    else if (volume_ratio > 2) quality += 0.15;
    else if (volume_ratio > 1.5) quality += 0.1;
    
    // RSI positioning
    if (rsi > 25 && rsi < 40) quality += 0.15; // Sweet spot
    
    // Skill enhancement
    quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'RANGING' || regime === 'SIDEWAYS') {
        quality *= 1.3; // Support bounces work great in ranging
      } else if (regime === 'TRENDING_DOWN') {
        quality *= 0.6; // Risky in downtrends
      }
    }
    
    if (quality < 0.65) return null;
    
    const target = this.calculateTarget(marketData);
    const stop = this.calculateStop(marketData);
    
    return {
      action: 'BUY',
      confidence: quality * this.confidence,
      entry: price,
      target,
      stop,
      reason: `Support bounce: ${(volume_ratio).toFixed(1)}x volume at $${support.toFixed(2)} support`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  private calculateTarget(data: any): number {
    const { price, resistance } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Target 70% to resistance
      return price + ((resistance - price) * 0.7);
    } else {
      // Conservative 2.5% bounce target
      return price * 1.025;
    }
  }
  
  private calculateStop(data: any): number {
    const { price, support } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    // Stop below support
    const base_stop = support * 0.985;
    
    // Tighter stops with better risk management
    const adjusted_stop = price - ((price - base_stop) * (1 - risk_skill * 0.25));
    
    return adjusted_stop;
  }
}
