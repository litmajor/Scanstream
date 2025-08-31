// analytics-utils.ts
// Advanced volume profile and composite scoring utilities for Scanstream

export interface VolumeProfileBin {
  price: number;
  volume: number;
}

/**
 * Calculate a standard volume profile (histogram of volume at price levels)
 */
export function calculate_volume_profile(prices: number[], volumes: number[], bins: number = 50): VolumeProfileBin[] {
  if (prices.length !== volumes.length || prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binSize = (max - min) / bins;
  const profile: VolumeProfileBin[] = Array.from({ length: bins }, (_, i) => ({
    price: min + i * binSize + binSize / 2,
    volume: 0
  }));
  for (let i = 0; i < prices.length; i++) {
    const idx = Math.min(Math.floor((prices[i] - min) / binSize), bins - 1);
    profile[idx].volume += volumes[i];
  }
  return profile;
}

/**
 * Calculate an anchored volume profile (volume histogram starting from anchor index)
 */
export function calculate_anchored_volume_profile(prices: number[], volumes: number[], anchorIndex: number, bins: number = 50): VolumeProfileBin[] {
  return calculate_volume_profile(prices.slice(anchorIndex), volumes.slice(anchorIndex), bins);
}

/**
 * Calculate a fixed range volume profile (volume histogram for a price range)
 */
export function calculate_fixed_range_volume_profile(prices: number[], volumes: number[], minPrice: number, maxPrice: number, bins: number = 50): VolumeProfileBin[] {
  const filtered: { price: number; volume: number }[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (prices[i] >= minPrice && prices[i] <= maxPrice) {
      filtered.push({ price: prices[i], volume: volumes[i] });
    }
  }
  if (filtered.length === 0) return [];
  return calculate_volume_profile(filtered.map(f => f.price), filtered.map(f => f.volume), bins);
}

/**
 * Calculate a composite score from multiple normalized scores and weights
 */
export function calculate_composite_score(scores: number[], weights?: number[]): number {
  if (!scores.length) return 0;
  if (!weights || weights.length !== scores.length) {
    weights = Array(scores.length).fill(1 / scores.length);
  }
  const sum = scores.reduce((acc, s, i) => acc + s * (weights![i] ?? 1), 0);
  return sum / weights.reduce((a, b) => a + b, 0);
}

/**
 * Calculate a volume-based composite score (e.g., for order flow, volume profile, etc)
 */
export function calculate_volume_composite_score(volumeScores: number[], weights?: number[]): number {
  return calculate_composite_score(volumeScores, weights);
}

/**
 * Calculate a confidence score (e.g., based on volume confirmation, volatility, microstructure health)
 */
export function calculate_confidence_score(volumeConfirmation: number, volatility: number, microHealth: number, weights = [0.5, 0.2, 0.3]): number {
  return calculate_composite_score([volumeConfirmation, 1 - volatility, microHealth], weights);
}

/**
 * Calculate the Value Area (VAH/VAL) from a volume profile (70% of volume)
 */
export function calculate_value_area(profile: VolumeProfileBin[], valueAreaPercent: number = 0.7): { VAH: number; VAL: number } {
  if (!profile.length) return { VAH: 0, VAL: 0 };
  const sorted = [...profile].sort((a, b) => b.volume - a.volume);
  const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
  let cumVolume = 0;
  let binsInArea: VolumeProfileBin[] = [];
  for (const bin of sorted) {
    if (cumVolume / totalVolume >= valueAreaPercent) break;
    binsInArea.push(bin);
    cumVolume += bin.volume;
  }
  const prices = binsInArea.map(b => b.price);
  return { VAH: Math.max(...prices), VAL: Math.min(...prices) };
}

/**
 * Calculate Point of Control (POC) from a volume profile
 */
export function calculate_poc(profile: VolumeProfileBin[]): number {
  if (!profile.length) return 0;
  return profile.reduce((maxBin, bin) => bin.volume > maxBin.volume ? bin : maxBin, profile[0]).price;
}
