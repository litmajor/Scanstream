# volume_sr_agent.py

import numpy as np
import pandas as pd

class VolumeSupportResistance:
    def __init__(self, settings=None):
        self.settings = settings or {
            "sensitivity": 1.5,
            "min_zone_width": 0.0025,  # 0.25%
            "volume_threshold": 0.85,  # percentile
            "merge_distance_pct": 0.005  # 0.5%
        }
        self.zones = []  # List of active support/resistance zones

    def detect_zones(self, df: pd.DataFrame):
        highs = np.array(df['high'].values, dtype=float)
        lows = np.array(df['low'].values, dtype=float)
        closes = np.array(df['close'].values, dtype=float)
        volumes = np.array(df['volume'].values, dtype=float)

        avg_range = np.mean(highs - lows)
        zone_candidates = []

        for i in range(2, len(df) - 2):
            local_high = highs[i-2:i+3].max()
            local_low = lows[i-2:i+3].min()
            
            if highs[i] == local_high:
                zone_candidates.append({"type": "resistance", "price": highs[i], "volume": volumes[i]})
            elif lows[i] == local_low:
                zone_candidates.append({"type": "support", "price": lows[i], "volume": volumes[i]})

        # Filter by volume threshold
        vol_array = np.array([z['volume'] for z in zone_candidates])
        vol_cutoff = np.quantile(vol_array, self.settings['volume_threshold'])
        filtered = [z for z in zone_candidates if z['volume'] >= vol_cutoff]

        # Merge nearby zones
        merged_zones = []
        for z in filtered:
            merged = False
            for mz in merged_zones:
                if abs(z['price'] - mz['price']) <= mz['price'] * self.settings['merge_distance_pct']:
                    mz['price'] = (mz['price'] + z['price']) / 2
                    mz['volume'] += z['volume']
                    merged = True
                    break
            if not merged:
                merged_zones.append(z.copy())

        self.zones = merged_zones
        return self.zones

    def evaluate(self, current_price: float):
        if not self.zones:
            return "NONE"

        for zone in self.zones:
            diff = abs(current_price - zone['price']) / zone['price']
            if diff < self.settings['min_zone_width']:
                return f"NEAR_{zone['type'].upper()}"

        return "NONE"

    def plot_zones(self):
        return [(z['price'], z['type'], z['volume']) for z in self.zones]
