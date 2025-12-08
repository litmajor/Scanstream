
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';

export class BreakoutHunter extends TradingAgent {
  // Specialist stats
  breakout_success_rate: number = 0;
  false_breakout_ratio: number = 0;
  volume_accuracy: number = 0;
  
  constructor(name: string) {
    super(name, 'BREAKOUT', 'aggressive');
  }
  
  /**
   * Process momentum data and generate breakout signals
   */
  processSignal(marketData: any): AgentSignal | null {
    const { price, resistance, volume, avg_volume, regime, atr, velocity } = marketData;
    
    // Base breakout logic
    const is_breakout = price > resistance;
    const volume_spike = volume > avg_volume * 2;
    
    if (!is_breakout || !volume_spike) return null;
    
    // Skill-based pattern quality enhancement
    let pattern_quality = this.detectBreakoutQuality(marketData);
    pattern_quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness (if unlocked)
    if (this.abilities.includes('regime_adaptation')) {
      if (regime !== 'TRENDING' && regime !== 'BULL_TRENDING') {
        pattern_quality *= 0.7;  // Reduce confidence in non-trending regimes
      }
    }
    
    // Multi-timeframe confirmation (if unlocked)
    if (this.abilities.includes('multi_timeframe_confirmation')) {
      const mtf_score = this.checkMultipleTimeframes(marketData);
      pattern_quality *= mtf_score;
    }
    
    if (pattern_quality < 0.6) return null;
    
    // Calculate targets based on abilities
    const target = this.calculateTarget(marketData);
    const stop = this.calculateStop(marketData);
    
    return {
      action: 'BUY',
      confidence: pattern_quality * this.confidence,
      entry: price,
      target,
      stop,
      reason: `Breakout with ${(volume / avg_volume).toFixed(1)}x volume confirmation`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  private detectBreakoutQuality(data: any): number {
    let quality = 0.7;  // Base quality
    
    // Volume strength
    const volume_ratio = data.volume / data.avg_volume;
    if (volume_ratio > 3) quality += 0.15;
    else if (volume_ratio > 2.5) quality += 0.1;
    
    // Price action strength
    const breakout_strength = (data.price - data.resistance) / data.resistance;
    if (breakout_strength > 0.02) quality += 0.1;  // >2% breakout
    
    // Timing skill bonus
    quality += (this.skills.timing_precision / 10) * 0.1;
    
    return Math.min(quality, 1.0);
  }
  
  private calculateTarget(data: any): number {
    if (this.abilities.includes('velocity_based_targets')) {
      // Use asset velocity profiling for realistic targets
      return data.price + (data.expected_7d_move * 0.8);
    } else {
      // Basic 2% target
      return data.price * 1.02;
    }
  }
  
  private calculateStop(data: any): number {
    const risk_skill = this.skills.risk_management / 10;
    const base_stop = 0.02;  // 2%
    
    // Tighter stops as risk management improves
    const adjusted_stop = base_stop * (1 - (risk_skill * 0.3));
    
    return data.price * (1 - adjusted_stop);
  }
  
  private checkMultipleTimeframes(data: any): number {
    // Simplified MTF check
    const mtf_aligned = data.mtf_bullish_count || 0;
    const total_timeframes = data.mtf_total || 3;
    
    return mtf_aligned / total_timeframes;
  }
}
