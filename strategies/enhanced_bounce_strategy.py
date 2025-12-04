"""
Enhanced Bounce Strategy - Multi-Timeframe Support/Resistance with Bayesian Confirmation
Combines:
  - TradingView multi-timeframe fractal zones (4 timeframes)
  - Volume-weighted support/resistance detection
  - Bayesian belief updating for bounce probability
  - Institutional volume confirmation
  - Cross-timeframe confluence detection

Performance Target: 2.0+ Sharpe ratio (vs current SUPPORT_BOUNCE 0.02)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List, Tuple
from scipy.stats import entropy
from collections import deque
import logging

logger = logging.getLogger(__name__)


class MultiTimeframeZoneDetector:
    """
    Detects support/resistance zones across multiple timeframes.
    Inspired by TradingView's Volume-based S/R Zones V2 indicator.
    
    Features:
    - Per-timeframe zone calculation
    - Volume weighting per timeframe
    - Fractal-based pivot detection
    - Zone merging with configurable distance
    - Confluence detection across timeframes
    """
    
    def __init__(self, timeframes: List[str] = None, settings: Dict = None):
        self.timeframes = timeframes or ['1m', '5m', '1h', '4h']
        self.settings = settings or {
            'sensitivity': 1.5,
            'min_zone_width': 0.0025,  # 0.25%
            'volume_threshold': 0.85,   # percentile
            'merge_distance_pct': 0.005, # 0.5%
            'fractal_lookback': 2,      # bars before/after for fractal
        }
        self.zones_by_tf = {tf: [] for tf in self.timeframes}
        self.confluence_zones = []
        self.zone_touches = {}  # Track how many times each zone was touched
    
    def detect_fractal_pivots(self, df: pd.DataFrame, lookback: int = 2) -> Tuple[List[Dict], List[Dict]]:
        """
        Detect fractal pivot points (highs and lows).
        A fractal high: H(n) > H(n-1), H(n) > H(n-2), H(n) > H(n+1), H(n) > H(n+2)
        """
        highs = df['high'].values
        lows = df['low'].values
        volumes = df['volume'].values
        
        fractal_highs = []
        fractal_lows = []
        
        for i in range(lookback, len(df) - lookback):
            # Check fractal high
            is_high_fractal = True
            for j in range(-lookback, lookback + 1):
                if j != 0 and highs[i] <= highs[i + j]:
                    is_high_fractal = False
                    break
            
            if is_high_fractal:
                fractal_highs.append({
                    'price': highs[i],
                    'index': i,
                    'volume': volumes[i],
                    'timestamp': df.index[i]
                })
            
            # Check fractal low
            is_low_fractal = True
            for j in range(-lookback, lookback + 1):
                if j != 0 and lows[i] >= lows[i + j]:
                    is_low_fractal = False
                    break
            
            if is_low_fractal:
                fractal_lows.append({
                    'price': lows[i],
                    'index': i,
                    'volume': volumes[i],
                    'timestamp': df.index[i]
                })
        
        return fractal_highs, fractal_lows
    
    def create_zones_from_fractals(self, highs: List[Dict], lows: List[Dict], 
                                   df: pd.DataFrame) -> Tuple[List[Dict], List[Dict]]:
        """
        Convert fractal pivots into support/resistance zones.
        Use zone width based on ATR for dynamic sizing.
        """
        atr = self._calculate_atr(df)
        zone_width = atr * 0.5  # Zone extends 0.5 ATR above/below pivot
        
        resistance_zones = []
        for fractal in highs:
            vol_percentile = np.percentile(df['volume'].values, self.settings['volume_threshold'] * 100)
            if fractal['volume'] >= vol_percentile:
                resistance_zones.append({
                    'type': 'resistance',
                    'price': fractal['price'],
                    'zone_low': fractal['price'] - zone_width,
                    'zone_high': fractal['price'] + zone_width,
                    'volume': fractal['volume'],
                    'touches': 1,
                    'index': fractal['index'],
                    'timestamp': fractal['timestamp']
                })
        
        support_zones = []
        for fractal in lows:
            vol_percentile = np.percentile(df['volume'].values, self.settings['volume_threshold'] * 100)
            if fractal['volume'] >= vol_percentile:
                support_zones.append({
                    'type': 'support',
                    'price': fractal['price'],
                    'zone_low': fractal['price'] - zone_width,
                    'zone_high': fractal['price'] + zone_width,
                    'volume': fractal['volume'],
                    'touches': 1,
                    'index': fractal['index'],
                    'timestamp': fractal['timestamp']
                })
        
        return resistance_zones, support_zones
    
    def merge_nearby_zones(self, zones: List[Dict]) -> List[Dict]:
        """Merge zones within merge_distance_pct"""
        if not zones:
            return zones
        
        # Sort by price
        sorted_zones = sorted(zones, key=lambda z: z['price'])
        merged = []
        
        for zone in sorted_zones:
            merged_flag = False
            for existing in merged:
                distance_pct = abs(zone['price'] - existing['price']) / existing['price']
                
                if distance_pct <= self.settings['merge_distance_pct']:
                    # Merge zones
                    existing['price'] = (existing['price'] * existing['volume'] + 
                                       zone['price'] * zone['volume']) / (existing['volume'] + zone['volume'])
                    existing['volume'] += zone['volume']
                    existing['touches'] += zone['touches']
                    merged_flag = True
                    break
            
            if not merged_flag:
                merged.append(zone.copy())
        
        return merged
    
    def detect_confluence(self, threshold: int = 2) -> List[Dict]:
        """
        Detect confluence zones where support/resistance appears in multiple timeframes.
        Confluence = multiple timeframes have zones within 0.5% of each other
        """
        all_zones = []
        tf_list = []
        
        for tf, zones in self.zones_by_tf.items():
            for zone in zones:
                all_zones.append({**zone, 'timeframe': tf})
                tf_list.append(tf)
        
        if not all_zones:
            return []
        
        confluence = []
        for i, zone1 in enumerate(all_zones):
            matching_zones = [zone1]
            
            for zone2 in all_zones[i+1:]:
                if zone2['timeframe'] != zone1['timeframe']:  # Different timeframes
                    distance_pct = abs(zone1['price'] - zone2['price']) / zone1['price']
                    if distance_pct <= self.settings['merge_distance_pct']:
                        matching_zones.append(zone2)
            
            if len(matching_zones) >= threshold:
                # Average price of confluence
                avg_price = np.mean([z['price'] for z in matching_zones])
                total_volume = sum(z['volume'] for z in matching_zones])
                timeframes_involved = list(set(z['timeframe'] for z in matching_zones))
                
                confluence.append({
                    'type': zone1['type'],
                    'price': avg_price,
                    'timeframes': timeframes_involved,
                    'num_timeframes': len(timeframes_involved),
                    'confluence_volume': total_volume,
                    'strength': len(timeframes_involved) / len(self.timeframes),  # 0-1
                    'zones_involved': matching_zones
                })
        
        return confluence
    
    def detect_zones(self, df_dict: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """
        Main detection function for each timeframe.
        df_dict: {timeframe: dataframe}
        """
        results = {}
        
        for tf, df in df_dict.items():
            if tf not in self.timeframes:
                continue
            
            # Detect fractals
            fractal_highs, fractal_lows = self.detect_fractal_pivots(
                df, 
                lookback=self.settings['fractal_lookback']
            )
            
            # Create zones from fractals
            res_zones, sup_zones = self.create_zones_from_fractals(fractal_highs, fractal_lows, df)
            
            # Merge nearby zones
            res_zones = self.merge_nearby_zones(res_zones)
            sup_zones = self.merge_nearby_zones(sup_zones)
            
            self.zones_by_tf[tf] = res_zones + sup_zones
            
            results[tf] = {
                'resistance': res_zones,
                'support': sup_zones,
                'all': res_zones + sup_zones
            }
        
        # Detect cross-timeframe confluence
        self.confluence_zones = self.detect_confluence(threshold=2)
        results['confluence'] = self.confluence_zones
        
        return results
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average True Range"""
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        
        tr1 = high - low
        tr2 = np.abs(high - np.roll(close, 1))
        tr3 = np.abs(low - np.roll(close, 1))
        
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        atr = np.mean(tr[-period:])
        
        return atr


class EnhancedBounceStrategy:
    """
    Enhanced Support Bounce Strategy combining:
    - Multi-timeframe zone detection
    - Volume-weighted SR validation
    - Bayesian belief updating
    - Institutional volume confirmation
    - Cross-timeframe confluence
    
    Target Sharpe: 2.0+
    """
    
    def __init__(self, risk_profile: str = 'moderate'):
        self.zone_detector = MultiTimeframeZoneDetector()
        self.bayesian = BayesianBeliefUpdaterEnhanced()
        self.risk_profile = risk_profile
        
        # Bounce quality thresholds
        self.min_zone_strength = 0.5
        self.min_volume_ratio = 1.5
        self.min_price_recovery = 0.02  # 2% from support
        
        # Signal tracking
        self.signal_history = deque(maxlen=100)
        self.bounce_zones_hit = []
    
    def detect_bounce_setup(self, df: pd.DataFrame, current_price: float, 
                           support_zones: List[Dict]) -> Dict[str, Any]:
        """
        Detect if price is bouncing from support with quality confirmation.
        
        Quality checks:
        1. Price within zone (< 0.25% distance)
        2. Volume spike on bounce candle
        3. Price recovery > 2% from support
        4. Bayesian confidence > 0.70
        """
        
        setup = {
            'is_bounce': False,
            'zone': None,
            'quality_score': 0.0,
            'confidence': 0.0,
            'reasons': []
        }
        
        # Check proximity to support zones
        near_support = None
        min_distance = float('inf')
        
        for zone in support_zones:
            distance = abs(current_price - zone['price']) / zone['price']
            if distance < self.settings['min_zone_width'] and distance < min_distance:
                near_support = zone
                min_distance = distance
        
        if not near_support:
            return setup
        
        setup['zone'] = near_support
        
        # Check 1: Price touched support
        if min_distance < 0.0025:  # < 0.25%
            setup['reasons'].append('Price near support')
            setup['quality_score'] += 0.3
        
        # Check 2: Volume confirmation
        volume_ratio = df['volume'].iloc[-1] / df['volume'].iloc[-2] if len(df) > 1 else 1
        if volume_ratio > self.min_volume_ratio:
            setup['reasons'].append(f'Volume spike: {volume_ratio:.2f}x')
            setup['quality_score'] += 0.3
        
        # Check 3: Price recovery
        if len(df) > 5:
            low_price = df['low'].tail(5).min()
            recovery_pct = (current_price - low_price) / low_price
            if recovery_pct > self.min_price_recovery:
                setup['reasons'].append(f'Price recovery: {recovery_pct:.2%}')
                setup['quality_score'] += 0.2
        
        # Check 4: Zone strength (confluence)
        zone_strength = near_support.get('strength', 0.5)
        setup['quality_score'] += zone_strength * 0.2
        
        # Bayesian update
        signal = 'BUY' if volume_ratio > 1.2 else 'HOLD'
        bayesian_signal = self.bayesian.evaluate(df, signal, setup['quality_score'])
        setup['confidence'] = bayesian_signal['confidence']
        
        # Final decision: is this a quality bounce?
        setup['is_bounce'] = (
            setup['quality_score'] > 0.6 and 
            setup['confidence'] > 0.70 and
            volume_ratio > 1.3
        )
        
        return setup
    
    def evaluate(self, df_dict: Dict[str, pd.DataFrame], current_price: float) -> Dict[str, Any]:
        """
        Full evaluation: detect zones across timeframes, identify bounces, calculate signal.
        
        Returns: {
            'signal': 'BUY' | 'SELL' | 'HOLD',
            'strength': 0-1,
            'confidence': 0-1,
            'bounce_detected': bool,
            'zone_details': Dict,
            'timeframe_confluence': Dict,
            'weighted_position': float (-1 to 1)
        }
        """
        
        # Step 1: Detect zones across timeframes
        zone_results = self.zone_detector.detect_zones(df_dict)
        
        # Step 2: Get latest candle data
        df = df_dict.get('1m') or df_dict.get('5m')  # Fallback
        if df is None:
            return {'signal': 'HOLD', 'strength': 0, 'confidence': 0, 'bounce_detected': False}
        
        # Step 3: Detect bounce setup
        support_zones = zone_results.get('support', [])
        bounce_setup = self.detect_bounce_setup(df, current_price, support_zones)
        
        # Step 4: Check timeframe confluence
        confluence = self.zone_detector.confluence_zones
        confluence_strength = 0
        if confluence and bounce_setup['zone']:
            for conf_zone in confluence:
                if abs(conf_zone['price'] - bounce_setup['zone']['price']) / bounce_setup['zone']['price'] < 0.01:
                    confluence_strength = conf_zone['strength']
                    break
        
        # Step 5: Generate final signal
        if bounce_setup['is_bounce']:
            signal = 'BUY'
            strength = min(bounce_setup['quality_score'] + confluence_strength, 1.0)
        else:
            signal = 'HOLD'
            strength = bounce_setup['quality_score'] * 0.5
        
        return {
            'signal': signal,
            'strength': strength,
            'confidence': bounce_setup['confidence'],
            'bounce_detected': bounce_setup['is_bounce'],
            'zone_details': bounce_setup['zone'],
            'timeframe_confluence': confluence,
            'confluence_strength': confluence_strength,
            'weighted_position': strength if signal == 'BUY' else 0,
            'quality_reasons': bounce_setup['reasons']
        }


class BayesianBeliefUpdaterEnhanced:
    """
    Enhanced Bayesian updater specifically for bounce pattern confirmation.
    
    Hypothesis:
    - H1: Bounce will succeed (bullish reversal)
    - H2: Bounce will fail (bearish continuation)
    
    Evidence sources:
    - Volume confirmation
    - Price action recovery
    - Zone strength (confluence)
    - Momentum indicators
    """
    
    def __init__(self, prior_bounce_success: float = 0.6):
        self.prior = prior_bounce_success
        self.belief = prior_bounce_success
        self.evidence_history = deque(maxlen=50)
    
    def calculate_likelihood(self, signal: str, quality_score: float) -> Dict[str, float]:
        """
        Calculate P(Evidence | Hypothesis)
        
        If signal='BUY' and quality_score high → likely bounce succeeds
        If signal='HOLD' or low quality → bounce uncertain
        """
        
        if signal == 'BUY' and quality_score > 0.7:
            # Strong evidence for successful bounce
            return {'success': 0.85, 'failure': 0.15}
        elif signal == 'BUY' and quality_score > 0.5:
            # Moderate evidence
            return {'success': 0.70, 'failure': 0.30}
        else:
            # Neutral or weak signal
            return {'success': 0.50, 'failure': 0.50}
    
    def update_belief(self, evidence_signal: str, quality_score: float) -> float:
        """Apply Bayes theorem: P(H|E) = P(E|H) * P(H) / P(E)"""
        
        likelihood = self.calculate_likelihood(evidence_signal, quality_score)
        
        # P(E) = P(E|success)*P(success) + P(E|failure)*P(failure)
        p_evidence = (
            likelihood['success'] * self.belief +
            likelihood['failure'] * (1 - self.belief)
        )
        
        if p_evidence > 0:
            self.belief = (likelihood['success'] * self.belief) / p_evidence
        
        self.evidence_history.append({
            'signal': evidence_signal,
            'quality': quality_score,
            'posterior': self.belief
        })
        
        return self.belief
    
    def evaluate(self, df: pd.DataFrame, signal: str, quality_score: float) -> Dict[str, Any]:
        """
        Evaluate bounce probability with Bayesian confidence.
        
        Returns: {
            'belief': 0-1 (probability of successful bounce),
            'confidence': 0-1 (certainty level),
            'recommendation': 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID'
        }
        """
        
        posterior = self.update_belief(signal, quality_score)
        
        # Confidence = how far from 50/50
        confidence = abs(posterior - 0.5) * 2
        
        if posterior > 0.80 and confidence > 0.70:
            recommendation = 'STRONG_BUY'
        elif posterior > 0.65:
            recommendation = 'BUY'
        elif posterior > 0.50:
            recommendation = 'HOLD'
        else:
            recommendation = 'AVOID'
        
        return {
            'belief': posterior,
            'confidence': confidence,
            'recommendation': recommendation,
            'prior': self.prior,
            'evidence_count': len(self.evidence_history)
        }
