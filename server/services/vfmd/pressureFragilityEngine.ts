/**
 * Pressure Fragility Engine
 * 
 * Computes signal quality using composite scoring:
 * - PEG z-score (anomalous pressure relative to asset baseline)
 * - PEG acceleration (ΔPEG normalized)
 * - Vacuum score (compression + range tightness + volume contraction)
 * - Coherence alignment (field directional strength)
 * - Snap bonus (Δ²PEG acceleration of the acceleration)
 * 
 * Output: tier (explosive/high/medium/hold) + position multiplier
 * 
 * Key feature: Asset-agnostic via z-score instead of hardcoded thresholds
 */

export interface PressureFragilityResult {
  score: number;                    // [0, 1] composite signal quality
  tier: 'explosive' | 'high' | 'medium' | 'hold';
  positionMultiplier: number;       // 1.4x / 1.1x / 0.7x / skip
  components: {
    pegZScore: number;              // Anomalous pressure (σ units from mean)
    pegStrength: number;            // [0, 1] PEG z-score normalized
    pegAccel: number;               // [0, 1] ΔPEG velocity normalized
    vacuumScore: number;            // [0, 1] liquidity vacuum intensity
    coherenceNorm: number;          // [0, 1] field directional alignment
    snapBonus: number;              // 0 or 0.05 (Δ²PEG > 0)
  };
  reasoning: string;
}

export class PressureFragilityEngine {
  private pegHistory: number[] = [];
  private pegMeanHistory: number[] = [];
  private pegStdHistory: number[] = [];
  private readonly rollingWindow = 168; // 1 week of 1h candles
  
  /**
   * Update rolling statistics for z-score computation
   */
  updatePEGStatistics(peg: number): void {
    this.pegHistory.push(peg);
    
    // Keep only rolling window
    if (this.pegHistory.length > this.rollingWindow) {
      this.pegHistory.shift();
    }
    
    // Compute mean and std every candle
    const mean = this.pegHistory.reduce((a, b) => a + b, 0) / this.pegHistory.length;
    const variance = this.pegHistory.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / this.pegHistory.length;
    const std = Math.sqrt(variance);
    
    this.pegMeanHistory.push(mean);
    this.pegStdHistory.push(std);
    
    if (this.pegMeanHistory.length > this.rollingWindow) {
      this.pegMeanHistory.shift();
      this.pegStdHistory.shift();
    }
  }
  
  /**
   * Compute z-score: how many standard deviations is current PEG from mean?
   * This is asset-agnostic — measures anomaly relative to that asset's baseline
   */
  private computePEGZScore(currentPEG: number): number {
    if (this.pegHistory.length < 10) return 0; // Not enough data
    
    const mean = this.pegMeanHistory[this.pegMeanHistory.length - 1];
    const std = this.pegStdHistory[this.pegStdHistory.length - 1];
    
    if (std === 0) return 0;
    return (currentPEG - mean) / std;
  }
  
  /**
   * Normalize PEG z-score to [0, 1] strength
   * z > 1.5σ = anomalous pressure
   * z > 3.0σ = extremely strong
   */
  private normalizePEGStrength(zScore: number): number {
    if (zScore < 1.5) return 0;           // Below threshold
    if (zScore > 3.0) return 1.0;         // Extremely strong
    return (zScore - 1.5) / 1.5;          // Linear interpolation
  }
  
  /**
   * Compute PEG acceleration (ΔPEG)
   * Normalized to [0, 1], where 1.0 = strong upward pressure
   */
  private computePEGAcceleration(pegHistory: number[]): number {
    if (pegHistory.length < 2) return 0;
    
    const current = pegHistory[pegHistory.length - 1];
    const previous = pegHistory[pegHistory.length - 2];
    const deltaPeg = current - previous;
    
    // Normalize: max expected ΔPEG is ~0.1 per candle
    // Clip at [0, 1] — don't penalize negative, just treat as 0
    return Math.max(0, Math.min(1, deltaPeg / 0.1));
  }
  
  /**
   * Vacuum score: measure of liquidity thinning
   * Components:
   * - Range compression (ATR ratio)
   * - Volume contraction
   * - Bid-ask spread tightness (if available)
   */
  private computeVacuumScore(
    closes: number[],
    volumes: number[],
    rangeCompression: number
  ): number {
    // Range-based vacuum (tight range = tight vacuum)
    const compressionVacuum = Math.max(0, 1 - rangeCompression); // 0.6 → 0.4 vacuum
    
    // Volume-based vacuum (volume contraction)
    if (volumes.length < 10) return compressionVacuum;
    
    const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const historicalVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    const volumeContraction = historicalVol > 0 
      ? Math.max(0, 1 - (recentVol / historicalVol))
      : 0;
    
    // Combined: both compression AND volume contraction needed for strong vacuum
    const combinedVacuum = (compressionVacuum + volumeContraction) / 2;
    
    return Math.min(1, combinedVacuum);
  }
  
  /**
   * Compute snap (second derivative of PEG)
   * Δ²PEG > 0 means acceleration is itself accelerating
   * = pressure onset is becoming more intense
   */
  private computeSnap(pegHistory: number[]): { snap: number; isPositive: boolean } {
    if (pegHistory.length < 3) return { snap: 0, isPositive: false };
    
    const delta1 = pegHistory[pegHistory.length - 1] - pegHistory[pegHistory.length - 2];
    const delta2 = pegHistory[pegHistory.length - 2] - pegHistory[pegHistory.length - 3];
    const snap = delta1 - delta2;
    
    return {
      snap: snap > 0 ? Math.min(1, snap / 0.05) : 0,
      isPositive: snap > 0
    };
  }
  
  /**
   * Main computation: pressure fragility analysis
   */
  compute(
    currentPEG: number,
    pegHistory: number[],
    closes: number[],
    volumes: number[],
    coherence: number,
    rangeCompression: number
  ): PressureFragilityResult {
    // Warmup period: if we don't have enough history, use relaxed gating
    if (this.pegHistory.length < 50) {
      // During warmup, use simple tier assignment (no z-score yet)
      const score = Math.min(1, currentPEG * coherence * 2);
      const tier = score >= 0.55 ? 'high' : score >= 0.45 ? 'medium' : 'hold';
      const multiplier = tier === 'high' ? 1.1 : tier === 'medium' ? 0.7 : 0;
      
      return {
        score,
        tier: tier as 'explosive' | 'high' | 'medium' | 'hold',
        positionMultiplier: multiplier,
        components: {
          pegZScore: 0,
          pegStrength: Math.min(1, currentPEG * 2),
          pegAccel: 0,
          vacuumScore: 0,
          coherenceNorm: Math.min(1, coherence / 0.02),
          snapBonus: 0
        },
        reasoning: `WARMUP MODE: Using temporary gating (${this.pegHistory.length}/50 history)`
      };
    }
    
    // Update rolling statistics
    this.updatePEGStatistics(currentPEG);
    
    // Component 1: PEG z-score (asset-agnostic anomaly detection)
    const pegZScore = this.computePEGZScore(currentPEG);
    const pegStrength = this.normalizePEGStrength(pegZScore);
    
    // Component 2: PEG acceleration
    const pegAccel = this.computePEGAcceleration(pegHistory);
    
    // Component 3: Vacuum score
    const vacuumScore = this.computeVacuumScore(closes, volumes, rangeCompression);
    
    // Component 4: Coherence normalization [0, 1]
    const coherenceNorm = Math.min(1, coherence / 0.02); // Normalize to typical max
    
    // Component 5: Snap bonus
    const { isPositive: hasPositiveSnap } = this.computeSnap(pegHistory);
    const snapBonus = hasPositiveSnap ? 0.05 : 0;
    
    // Composite score formula
    const score =
      0.30 * pegStrength +
      0.25 * pegAccel +
      0.25 * vacuumScore +
      0.20 * coherenceNorm +
      snapBonus;
    
    // Tier assignment with snap gate
    let tier: 'explosive' | 'high' | 'medium' | 'hold';
    let positionMultiplier: number;
    let reasoning: string;
    
    if (score >= 0.72 && pegAccel > 0.1 && hasPositiveSnap) {
      tier = 'explosive';
      positionMultiplier = 1.4;
      reasoning = `EXPLOSIVE: score=${score.toFixed(3)}, PEG z=${pegZScore.toFixed(2)}σ, accel=${pegAccel.toFixed(2)}, snap=ON`;
    } else if (score >= 0.65) {
      tier = 'high';
      positionMultiplier = 1.1;
      reasoning = `HIGH: score=${score.toFixed(3)}, PEG z=${pegZScore.toFixed(2)}σ, vac=${vacuumScore.toFixed(2)}`;
    } else if (score >= 0.55) {
      tier = 'medium';
      positionMultiplier = 0.7;
      reasoning = `MEDIUM: score=${score.toFixed(3)}, reduced size`;
    } else {
      tier = 'hold';
      positionMultiplier = 0;
      reasoning = `HOLD: score=${score.toFixed(3)}, below threshold`;
    }
    
    return {
      score,
      tier,
      positionMultiplier,
      components: {
        pegZScore,
        pegStrength,
        pegAccel,
        vacuumScore,
        coherenceNorm,
        snapBonus
      },
      reasoning
    };
  }
}
