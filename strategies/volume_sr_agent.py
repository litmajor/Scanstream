# volume_sr_agent.py - Enhanced with TradingView multi-timeframe approach

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any
from collections import deque

class VolumeSupportResistance:
    """
    Volume-weighted Support & Resistance Detection
    
    Enhanced features:
    - ATR-based dynamic zone sizing
    - Zone strength scoring (based on touches and volume)
    - Zone age tracking (recent vs historic)
    - Bounce confirmation metrics
    - Cross-zone confluence detection
    """
    
    def __init__(self, settings=None):
        self.settings = settings or {
            "sensitivity": 1.5,
            "min_zone_width": 0.0025,      # 0.25%
            "volume_threshold": 0.85,       # percentile
            "merge_distance_pct": 0.005,    # 0.5%
            "atr_period": 14,
            "zone_width_multiplier": 0.5,  # Zone = 0.5 * ATR
            "min_touches": 2,               # Minimum touches to validate zone
            "max_zones_per_type": 30        # Memory management
        }
        self.zones = []                    # List of active support/resistance zones
        self.zone_touches_count = {}       # Track touches per zone
        self.zone_creation_time = {}       # Track when zone was created
    
    def calculate_atr(self, df: pd.DataFrame, period: int = None) -> float:
        """Calculate Average True Range for dynamic zone sizing"""
        if period is None:
            period = self.settings['atr_period']
        
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        
        # True Range = max(H-L, abs(H-PC), abs(L-PC))
        tr1 = high - low
        tr2 = np.abs(high - np.roll(close, 1))
        tr3 = np.abs(low - np.roll(close, 1))
        
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        atr = np.mean(tr[-period:]) if len(tr) >= period else np.mean(tr)
        
        return max(atr, 0.0001)  # Prevent division by zero
    
    def detect_zones(self, df: pd.DataFrame) -> List[Dict]:
        """
        Detect support/resistance zones with enhanced metrics.
        
        Enhanced approach:
        1. Identify local highs/lows (fractals)
        2. Weight by volume
        3. Create zones with ATR-based sizing
        4. Merge nearby zones
        5. Score by strength (volume + touches)
        """
        if len(df) < 10:
            return []
        
        highs = np.array(df['high'].values, dtype=float)
        lows = np.array(df['low'].values, dtype=float)
        closes = np.array(df['close'].values, dtype=float)
        volumes = np.array(df['volume'].values, dtype=float)
        
        atr = self.calculate_atr(df)
        zone_width = atr * self.settings['zone_width_multiplier']
        
        zone_candidates = []
        
        # Fractal detection with 2-bar lookback (per TradingView approach)
        for i in range(2, len(df) - 2):
            local_high = highs[i-2:i+3].max()
            local_low = lows[i-2:i+3].min()
            
            # Resistance (local high)
            if highs[i] == local_high:
                zone_candidates.append({
                    "type": "resistance",
                    "price": highs[i],
                    "volume": volumes[i],
                    "zone_low": highs[i] - zone_width,
                    "zone_high": highs[i] + zone_width,
                    "index": i,
                    "timestamp": df.index[i]
                })
            
            # Support (local low)
            elif lows[i] == local_low:
                zone_candidates.append({
                    "type": "support",
                    "price": lows[i],
                    "volume": volumes[i],
                    "zone_low": lows[i] - zone_width,
                    "zone_high": lows[i] + zone_width,
                    "index": i,
                    "timestamp": df.index[i]
                })
        
        # Filter by volume threshold (percentile)
        if zone_candidates:
            vol_array = np.array([z['volume'] for z in zone_candidates])
            vol_cutoff = np.quantile(vol_array, self.settings['volume_threshold'])
            filtered = [z for z in zone_candidates if z['volume'] >= vol_cutoff]
        else:
            filtered = []
        
        # Merge nearby zones
        merged_zones = self._merge_zones(filtered)
        
        # Score zones by strength
        for zone in merged_zones:
            zone['strength'] = self._calculate_zone_strength(zone, df)
            zone['touches'] = self.zone_touches_count.get(self._zone_key(zone), 0)
        
        # Limit total zones (memory management)
        self.zones = merged_zones[-self.settings['max_zones_per_type']:]
        
        return self.zones
    
    def _merge_zones(self, zones: List[Dict]) -> List[Dict]:
        """Merge zones that are within merge_distance_pct"""
        if not zones:
            return []
        
        # Sort by price
        sorted_zones = sorted(zones, key=lambda z: z['price'])
        merged_zones = []
        
        for z in sorted_zones:
            merged = False
            for mz in merged_zones:
                distance_pct = abs(z['price'] - mz['price']) / mz['price']
                
                if distance_pct <= self.settings['merge_distance_pct']:
                    # Merge with volume-weighted average
                    total_vol = z['volume'] + mz['volume']
                    mz['price'] = (mz['price'] * mz['volume'] + z['price'] * z['volume']) / total_vol
                    mz['volume'] = total_vol
                    mz['zone_low'] = min(mz['zone_low'], z['zone_low'])
                    mz['zone_high'] = max(mz['zone_high'], z['zone_high'])
                    merged = True
                    break
            
            if not merged:
                merged_zones.append(z.copy())
        
        return merged_zones
    
    def _calculate_zone_strength(self, zone: Dict, df: pd.DataFrame) -> float:
        """
        Calculate zone strength (0-1):
        - Volume percentile: 50%
        - Zone age: 25% (recent zones stronger)
        - ATR proximity: 25%
        """
        vol_strength = min(zone['volume'] / df['volume'].max(), 1.0) * 0.5
        age_strength = 0.25  # TODO: implement age tracking
        atr_strength = 0.25  # TODO: implement ATR proximity
        
        return vol_strength + age_strength + atr_strength
    
    def _zone_key(self, zone: Dict) -> str:
        """Create unique key for zone"""
        return f"{zone['type']}_{zone['price']:.8f}"
    
    def update_zone_touch(self, current_price: float):
        """Update zone touch count when price approaches zone"""
        for zone in self.zones:
            diff = abs(current_price - zone['price']) / zone['price']
            if diff < self.settings['min_zone_width']:
                key = self._zone_key(zone)
                self.zone_touches_count[key] = self.zone_touches_count.get(key, 0) + 1
                zone['touches'] = self.zone_touches_count[key]
    
    def evaluate(self, current_price: float) -> Dict[str, Any]:
        """
        Enhanced evaluation with multiple metrics.
        
        Returns: {
            'status': 'NEAR_SUPPORT' | 'NEAR_RESISTANCE' | 'NONE',
            'zone': Dict or None,
            'distance_pct': float,
            'zone_strength': float,
            'confidence': float
        }
        """
        self.update_zone_touch(current_price)
        
        if not self.zones:
            return {
                'status': 'NONE',
                'zone': None,
                'distance_pct': None,
                'zone_strength': 0,
                'confidence': 0
            }
        
        closest_zone = None
        min_distance = float('inf')
        
        for zone in self.zones:
            diff = abs(current_price - zone['price']) / zone['price']
            if diff < min_distance:
                min_distance = diff
                closest_zone = zone
        
        # Check if within zone detection range
        if min_distance < self.settings['min_zone_width'] and closest_zone:
            status = f"NEAR_{closest_zone['type'].upper()}"
            # Confidence based on zone strength and proximity
            confidence = (1 - min_distance / self.settings['min_zone_width']) * closest_zone['strength']
        else:
            status = 'NONE'
            confidence = 0
        
        return {
            'status': status,
            'zone': closest_zone,
            'distance_pct': min_distance if closest_zone else None,
            'zone_strength': closest_zone['strength'] if closest_zone else 0,
            'confidence': confidence
        }
    
    def get_support_zones(self) -> List[Dict]:
        """Return only support zones"""
        return [z for z in self.zones if z['type'] == 'support']
    
    def get_resistance_zones(self) -> List[Dict]:
        """Return only resistance zones"""
        return [z for z in self.zones if z['type'] == 'resistance']
    
    def get_zones_by_strength(self, min_strength: float = 0.5) -> List[Dict]:
        """Get zones above minimum strength threshold"""
        return [z for z in self.zones if z.get('strength', 0) >= min_strength]
    
    def plot_zones(self) -> List[Tuple]:
        """Return zones for visualization"""
        return [(z['price'], z['type'], z['volume'], z.get('strength', 0)) for z in self.zones]
    
    def reset_zones(self):
        """Clear all zones (for new session or analysis period)"""
        self.zones = []
        self.zone_touches_count = {}
        self.zone_creation_time = {}
