
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';

export class TrendRider extends TradingAgent {
  // Specialist stats
  trend_capture_rate: number = 0;
  ema_alignment_accuracy: number = 0;
  adx_confirmation_rate: number = 0;
  
  constructor(name: string) {
    super(name, 'MA_CROSSOVER', 'balanced');
  }
  
  /**
   * Ride strong trends using EMA alignment and ADX
   */
  processSignal(marketData: any): AgentSignal | null {
    const { price, ema20, ema50, ema200, adx, macd, volume, avg_volume, regime } = marketData;
    
    // Base trend conditions
    const bullish_alignment = ema20 > ema50 && ema50 > ema200;
    const strong_trend = adx > 25;
    const macd_bullish = macd.macd > macd.signal;
    
    if (!bullish_alignment && !strong_trend) return null;
    
    // Calculate trend quality
    let quality = 0;
    
    // EMA alignment bonus
    if (bullish_alignment) quality += 0.3;
    
    // Trend strength bonus (ADX)
    if (adx > 40) quality += 0.3;
    else if (adx > 25) quality += 0.2;
    
    // MACD confirmation
    if (macd_bullish) quality += 0.2;
    
    // Volume confirmation
    if (volume > avg_volume * 1.3) quality += 0.15;
    
    // Skill enhancement
    quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'TRENDING' || regime === 'BULL_TRENDING') {
        quality *= 1.4; // Trend riding excels in trending markets
      } else if (regime === 'CHOPPY') {
        quality *= 0.5; // Avoid choppy markets
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
      reason: `Trend following: ADX ${adx.toFixed(0)}, EMA aligned, MACD bullish`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  private calculateTarget(data: any): number {
    const { price, expected_7d_move } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Use expected move for trends
      return price + (expected_7d_move * 0.9);
    } else {
      // Conservative 3% trend target
      return price * 1.03;
    }
  }
  
  private calculateStop(data: any): number {
    const { price, ema20, atr } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    // Stop below EMA20 or 1.5 ATR
    const ema_stop = ema20 * 0.99;
    const atr_stop = price - (atr * (1.5 - risk_skill * 0.3));
    
    return Math.max(ema_stop, atr_stop);
  }
}
