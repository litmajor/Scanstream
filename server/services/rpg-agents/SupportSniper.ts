
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';
import {
  getClusterMetrics
} from '../clustering';

/**
 * Volume-Based Support/Resistance Zone Detection
 * Enhanced from VBSR agent with ATR-based sizing and strength scoring
 */
interface SRZone {
  type: 'support' | 'resistance';
  price: number;
  zone_low: number;
  zone_high: number;
  volume: number;
  strength: number;        // 0-1 (based on volume percentile + touches)
  touches: number;         // How many times tested
  age: number;            // Bars since creation
  timeframe: string;      // 1m, 5m, 1h, 4h, 1d
}

interface ZoneAnalysis {
  zones: SRZone[];
  nearest_support: SRZone | null;
  nearest_resistance: SRZone | null;
  support_distance_pct: number;
  resistance_distance_pct: number;
  zone_confluence: number;  // How many zones nearby
  bounce_probability: number; // Based on zone strength
}

export class SupportSniper extends TradingAgent {
  // Specialist stats
  support_bounce_rate: number = 0;
  zone_detection_accuracy: number = 0;
  volume_confirmation_rate: number = 0;
  
  // Multi-timeframe zone tracking
  private zones_1h: SRZone[] = [];
  private zones_4h: SRZone[] = [];
  private zones_1d: SRZone[] = [];
  private zone_touches: Map<string, number> = new Map(); // Track zone touches
  
  // VBSR settings
  private vbsr_settings = {
    atr_period: 14,
    zone_width_multiplier: 0.5,    // Zone = 0.5 * ATR
    volume_threshold_percentile: 85, // Top 15% volume only
    min_zone_width: 0.0025,         // 0.25%
    merge_distance_pct: 0.005,      // Zones within 0.5% are merged
    min_touches: 2,                 // Validate zone with 2+ touches
    max_zones_per_type: 20,         // Memory management
  };
  
  constructor(name: string) {
    super(name, 'SUPPORT_BOUNCE', 'conservative');
  }
  
  /**
   * Enhanced support bounce detection with VBSR multi-timeframe zones
   */
  processSignal(marketData: any): AgentSignal | null {
    const { price, volume, avg_volume, rsi, bounce_quality, regime, priceHistory = [], volumeHistory = [], atr = 0, symbol } = marketData;
    
    // Build VBSR zones if we have price history
    if (priceHistory.length >= 50) {
      this.updateVBSRZones(priceHistory, volumeHistory, atr);
    }
    
    // Get zone analysis
    const zoneAnalysis = this.analyzeZones(price);
    
    // Check if near a volume-weighted support zone
    const near_support = zoneAnalysis.nearest_support && 
                        zoneAnalysis.support_distance_pct < this.vbsr_settings.min_zone_width;
    
    if (!near_support) return null;
    
    // Volume spike confirmation
    const volume_spike = volume > avg_volume * 1.5;
    if (!volume_spike) return null;
    
    // Avoid catching falling knives
    const not_oversold = rsi > 25;
    if (!not_oversold) return null;
    
    // CLUSTERING ZONE VALIDATION - NEW CRITICAL LAYER
    let cluster_zone_validation = 1.0; // Multiplier
    let cluster_support_strength = 0;
    
    if (symbol) {
      const clusterMetrics = getClusterMetrics(symbol);
      
      if (clusterMetrics && clusterMetrics.cluster_strength > 0) {
        // Cluster strength validates zone strength
        cluster_support_strength = clusterMetrics.cluster_strength; // 0-1
        
        // Check if clusters are in bullish formation (support should bounce up)
        const trend_forming = clusterMetrics.trend_formation_signal;
        const directional_ratio = clusterMetrics.directional_ratio;
        const bullish_ratio = clusterMetrics.bullish_clusters / (clusterMetrics.total_clusters || 1);
        
        // Validation logic: support zones are stronger when clusters support bullish move
        if (trend_forming && bullish_ratio > 0.65) {
          cluster_zone_validation = 1.3; // Strong validation: bounce likely to succeed
        } else if (bullish_ratio > 0.55 && directional_ratio > 0.5) {
          cluster_zone_validation = 1.15; // Moderate validation
        } else if (bullish_ratio > 0.45) {
          cluster_zone_validation = 1.0; // Neutral: cluster not strongly bullish
        } else if (bullish_ratio < 0.35) {
          cluster_zone_validation = 0.6; // Warning: clusters bearish, zone weak
        }
        
        console.log(
          `[SupportSniper] Zone validation for ${symbol}: ` +
          `zone_strength=${zoneAnalysis.nearest_support?.strength.toFixed(2)}, ` +
          `cluster_strength=${clusterMetrics.cluster_strength.toFixed(2)}, ` +
          `bullish_ratio=${bullish_ratio.toFixed(2)}, ` +
          `zone_validation=${cluster_zone_validation.toFixed(2)}x`
        );
      }
    }
    
    // Calculate bounce quality from VBSR analysis
    let quality = 0.5;
    
    // Zone strength contributes 30% of quality
    const support_zone = zoneAnalysis.nearest_support!;
    quality += support_zone.strength * 0.3;
    
    // Volume spike strength (25%)
    const volume_ratio = volume / avg_volume;
    if (volume_ratio > 3) quality += 0.25;
    else if (volume_ratio > 2) quality += 0.20;
    else if (volume_ratio > 1.5) quality += 0.15;
    
    // RSI positioning (20%)
    if (rsi > 25 && rsi < 40) quality += 0.20;
    else if (rsi > 40 && rsi < 50) quality += 0.10;
    
    // Zone confluence bonus (15%)
    if (zoneAnalysis.zone_confluence >= 2) {
      quality += Math.min(zoneAnalysis.zone_confluence * 0.075, 0.15);
    }
    
    // Zone touches/validation (10%)
    if (support_zone.touches >= 3) quality += 0.10;
    else if (support_zone.touches >= 2) quality += 0.05;
    
    // CLUSTERING ZONE VALIDATION BOOST (NEW)
    quality *= cluster_zone_validation;
    
    // Skill enhancement
    quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'RANGING' || regime === 'SIDEWAYS') {
        quality *= 1.4; // Support bounces work great in ranging
      } else if (regime === 'bear_trending') {
        quality *= 0.5; // Risky in downtrends
      } else if (regime === 'bull_trending') {
        quality *= 0.8; // Pullbacks in uptrends are ok
      }
    }
    
    // Zone proximity bonus (closer to center = better)
    const distance_from_center = Math.abs(price - support_zone.price);
    const zone_width = support_zone.zone_high - support_zone.zone_low;
    const center_proximity = 1 - (distance_from_center / (zone_width / 2));
    quality *= (0.8 + center_proximity * 0.2); // 0.8-1.0 multiplier
    
    if (quality < 0.60) return null;
    
    const target = this.calculateTarget(marketData, support_zone);
    const stop = this.calculateStop(support_zone);
    
    return {
      action: 'BUY',
      confidence: Math.min(quality * this.confidence, 0.95),
      entry: price,
      target,
      stop,
      reason: `VBSR bounce at $${support_zone.price.toFixed(2)} (strength: ${(support_zone.strength * 100).toFixed(0)}%, touches: ${support_zone.touches}, cluster_validation: ${cluster_zone_validation.toFixed(2)}x) with ${volume_ratio.toFixed(1)}x volume`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  /**
   * Update VBSR zones using volume-weighted fractal detection
   */
  private updateVBSRZones(priceHistory: number[], volumeHistory: number[], atr: number): void {
    if (priceHistory.length < 20) return;
    
    // Build high/low/close arrays
    const closes = priceHistory;
    const highs = priceHistory.map((p, i) => {
      // Simulate high as close + 0.3% typical
      return p * 1.003;
    });
    const lows = priceHistory.map((p, i) => {
      // Simulate low as close - 0.3% typical
      return p * 0.997;
    });
    const volumes = volumeHistory;
    
    // Calculate ATR if not provided
    const effective_atr = atr > 0 ? atr : this.calculateATR(closes, 14);
    const zone_width = effective_atr * this.vbsr_settings.zone_width_multiplier;
    
    // Detect fractals (local highs/lows with 2-bar lookback)
    const zone_candidates: SRZone[] = [];
    
    for (let i = 2; i < priceHistory.length - 2; i++) {
      const local_high = Math.max(...highs.slice(i - 2, i + 3));
      const local_low = Math.min(...lows.slice(i - 2, i + 3));
      
      // Resistance (local high)
      if (Math.abs(highs[i] - local_high) < effective_atr * 0.001) {
        zone_candidates.push({
          type: 'resistance',
          price: highs[i],
          zone_low: highs[i] - zone_width,
          zone_high: highs[i] + zone_width,
          volume: volumes[i],
          strength: 0, // Calculate below
          touches: this.zone_touches.get(`r_${highs[i].toFixed(2)}`) || 1,
          age: priceHistory.length - i,
          timeframe: '1h'
        });
      }
      
      // Support (local low)
      if (Math.abs(lows[i] - local_low) < effective_atr * 0.001) {
        zone_candidates.push({
          type: 'support',
          price: lows[i],
          zone_low: lows[i] - zone_width,
          zone_high: lows[i] + zone_width,
          volume: volumes[i],
          strength: 0,
          touches: this.zone_touches.get(`s_${lows[i].toFixed(2)}`) || 1,
          age: priceHistory.length - i,
          timeframe: '1h'
        });
      }
    }
    
    // Filter by volume threshold (top 15% volume only)
    const vol_percentile = this.percentile(volumes, this.vbsr_settings.volume_threshold_percentile);
    const filtered = zone_candidates.filter(z => z.volume >= vol_percentile);
    
    // Merge nearby zones
    const merged_zones = this.mergeNearbyZones(filtered);
    
    // Score zones by strength
    for (const zone of merged_zones) {
      zone.strength = this.calculateZoneStrength(zone, volumes);
    }
    
    // Update zones (keep only top by memory management)
    this.zones_1h = merged_zones.slice(-this.vbsr_settings.max_zones_per_type);
  }
  
  /**
   * Analyze zones relative to current price
   */
  private analyzeZones(currentPrice: number): ZoneAnalysis {
    const all_zones = [...this.zones_1h, ...this.zones_4h, ...this.zones_1d];
    
    // Find nearest support below price
    const supports = all_zones
      .filter(z => z.type === 'support' && z.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    
    // Find nearest resistance above price
    const resistances = all_zones
      .filter(z => z.type === 'resistance' && z.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    
    const nearest_support = supports[0] || null;
    const nearest_resistance = resistances[0] || null;
    
    // Calculate distances
    const support_distance_pct = nearest_support 
      ? Math.abs(currentPrice - nearest_support.price) / currentPrice 
      : Infinity;
    
    const resistance_distance_pct = nearest_resistance
      ? Math.abs(currentPrice - nearest_resistance.price) / currentPrice
      : Infinity;
    
    // Count confluence (zones nearby)
    const zone_confluence = all_zones.filter(z => 
      Math.abs(z.price - currentPrice) / currentPrice < 0.02  // Within 2%
    ).length;
    
    // Bounce probability from zone strength
    const bounce_probability = nearest_support 
      ? nearest_support.strength * (1 + nearest_support.touches * 0.1)
      : 0;
    
    return {
      zones: all_zones,
      nearest_support,
      nearest_resistance,
      support_distance_pct,
      resistance_distance_pct,
      zone_confluence,
      bounce_probability: Math.min(bounce_probability, 1.0)
    };
  }
  
  /**
   * Merge zones within merge_distance_pct (volume-weighted average)
   */
  private mergeNearbyZones(zones: SRZone[]): SRZone[] {
    if (zones.length === 0) return [];
    
    const sorted = zones.sort((a, b) => a.price - b.price);
    const merged: SRZone[] = [];
    
    for (const zone of sorted) {
      let merged_flag = false;
      
      for (const mz of merged) {
        const distance_pct = Math.abs(zone.price - mz.price) / mz.price;
        
        if (distance_pct <= this.vbsr_settings.merge_distance_pct && zone.type === mz.type) {
          // Merge with volume-weighted average
          const total_vol = zone.volume + mz.volume;
          mz.price = (mz.price * mz.volume + zone.price * zone.volume) / total_vol;
          mz.volume = total_vol;
          mz.zone_low = Math.min(mz.zone_low, zone.zone_low);
          mz.zone_high = Math.max(mz.zone_high, zone.zone_high);
          mz.touches += zone.touches;
          merged_flag = true;
          break;
        }
      }
      
      if (!merged_flag) {
        merged.push({ ...zone });
      }
    }
    
    return merged;
  }
  
  /**
   * Calculate zone strength (0-1): volume (50%) + touches (30%) + age (20%)
   */
  private calculateZoneStrength(zone: SRZone, volumeHistory: number[]): number {
    const max_vol = Math.max(...volumeHistory);
    const vol_strength = Math.min(zone.volume / max_vol, 1.0) * 0.5;
    
    // Touches: 2+ touches = strong, 1 touch = weak
    const touches_strength = Math.min(zone.touches / 5, 1.0) * 0.3;
    
    // Age: Recent zones (age < 20) are stronger, older zones weaker
    const age_strength = (zone.age < 20 ? 1.0 : Math.max(1.0 - (zone.age - 20) / 100, 0.2)) * 0.2;
    
    return vol_strength + touches_strength + age_strength;
  }
  
  /**
   * Calculate ATR for dynamic zone sizing
   */
  private calculateATR(closes: number[], period: number = 14): number {
    if (closes.length < period) return closes[closes.length - 1] * 0.02; // Default 2%
    
    let tr = 0;
    for (let i = 1; i < closes.length; i++) {
      const high = closes[i] * 1.003;  // Simulate
      const low = closes[i] * 0.997;   // Simulate
      const prev_close = closes[i - 1];
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prev_close);
      const tr3 = Math.abs(low - prev_close);
      
      tr += Math.max(tr1, tr2, tr3);
    }
    
    return tr / closes.length;
  }
  
  /**
   * Percentile calculation
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Enhanced target calculation using zone analysis
   */
  private calculateTarget(data: any, support_zone: SRZone): number {
    const { price, resistance = 0 } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Use resistance if available, otherwise 70% move
      if (resistance > 0) {
        return price + ((resistance - price) * 0.7);
      }
      // ATR-based target
      const atr = data.atr || price * 0.02;
      return price + (atr * 2);
    } else {
      // Conservative: 50% to next resistance or zone boundary
      return price + ((support_zone.zone_high - price) * 0.5);
    }
  }
  
  /**
   * Enhanced stop calculation using support zone
   */
  private calculateStop(support_zone: SRZone): number {
    // Stop slightly below zone low
    const buffer = (support_zone.zone_high - support_zone.zone_low) * 0.5;
    
    const risk_skill = this.skills.risk_management / 10;
    
    // Base stop at zone low
    let stop = support_zone.zone_low - buffer;
    
    // Tighter stops with better risk management
    return stop * (1 + risk_skill * 0.1);
  }
}
