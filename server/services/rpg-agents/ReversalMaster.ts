
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';

export class ReversalMaster extends TradingAgent {
  // Specialist stats
  reversal_accuracy: number = 0;
  divergence_detection_rate: number = 0;
  oversold_win_rate: number = 0;
  
  constructor(name: string) {
    super(name, 'REVERSAL', 'balanced');
  }
  
  /**
   * Detect mean reversion setups using RSI divergence and support levels
   */
  processSignal(marketData: any): AgentSignal | null {
    const { price, support, rsi, macd, volume, avg_volume, regime } = marketData;
    
    // Base reversal conditions
    const at_support = Math.abs(price - support) / price < 0.01; // Within 1% of support
    const oversold = rsi < 30;
    const bullish_divergence = this.detectDivergence(marketData);
    
    if (!at_support && !oversold && !bullish_divergence) return null;
    
    // Calculate reversal quality
    let quality = 0;
    
    // RSI oversold bonus
    if (rsi < 30) quality += 0.3;
    if (rsi < 20) quality += 0.2; // Extremely oversold
    
    // Support proximity bonus
    if (at_support) quality += 0.25;
    
    // Divergence bonus
    if (bullish_divergence) quality += 0.3;
    
    // Volume confirmation
    if (volume > avg_volume * 1.5) quality += 0.15;
    
    // Skill enhancement
    quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'RANGING' || regime === 'CHOPPY') {
        quality *= 1.3; // Reversals work great in ranging markets
      } else if (regime === 'TRENDING') {
        quality *= 0.6; // Reversals risky in strong trends
      }
    }
    
    if (quality < 0.6) return null;
    
    const target = this.calculateTarget(marketData);
    const stop = this.calculateStop(marketData);
    
    return {
      action: 'BUY',
      confidence: quality * this.confidence,
      entry: price,
      target,
      stop,
      reason: `Mean reversion: RSI ${rsi.toFixed(0)}, ${at_support ? 'at support' : ''}${bullish_divergence ? ' + divergence' : ''}`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  private detectDivergence(data: any): boolean {
    // Simplified divergence: price making lower lows but RSI making higher lows
    const { price_history, rsi_history } = data;
    
    if (!price_history || price_history.length < 3) return false;
    
    const recent_prices = price_history.slice(-3);
    const recent_rsi = rsi_history?.slice(-3) || [];
    
    const price_lower_low = recent_prices[2] < recent_prices[0];
    const rsi_higher_low = recent_rsi[2] > recent_rsi[0];
    
    return price_lower_low && rsi_higher_low;
  }
  
  private calculateTarget(data: any): number {
    const { price, resistance } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Target midpoint to resistance
      return price + ((resistance - price) * 0.7);
    } else {
      // Conservative 2% bounce target
      return price * 1.02;
    }
  }
  
  private calculateStop(data: any): number {
    const { price, support } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    // Stop below support
    const base_stop = support * 0.99;
    
    // Tighter stops with better risk management
    const adjusted_stop = price - ((price - base_stop) * (1 - risk_skill * 0.2));
    
    return adjusted_stop;
  }
}
