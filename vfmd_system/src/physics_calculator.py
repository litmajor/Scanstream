"""
VFMD Physics Calculators
Computes PEG, TI, and Coherence from vector fields
"""

import numpy as np
from typing import Tuple


class PhysicsCalculator:
    """Compute physical quantities from market vector fields"""
    
    @staticmethod
    def compute_peg(field, region_size=10):
        """
        Potential Energy Gradient (PEG)
        
        Measures stored energy before directional release
        PEG = ∫|∇F| dA over recent region
        
        Args:
            field: Vector field (spatial, temporal, 2)
            region_size: How many recent bars to integrate over
            
        Returns:
            peg_value: Scalar energy level
        """
        # Calculate field gradient magnitude
        grad_Fx_spatial = np.gradient(field[:, :, 0], axis=0)
        grad_Fx_temporal = np.gradient(field[:, :, 0], axis=1)
        grad_Fy_spatial = np.gradient(field[:, :, 1], axis=0)
        grad_Fy_temporal = np.gradient(field[:, :, 1], axis=1)
        
        # Total gradient magnitude at each point
        gradient_magnitude = np.sqrt(
            grad_Fx_spatial**2 + grad_Fx_temporal**2 +
            grad_Fy_spatial**2 + grad_Fy_temporal**2
        )
        
        # Integrate over recent region (right edge = most recent)
        recent_region = gradient_magnitude[:, -region_size:]
        peg = np.sum(np.abs(recent_region))
        
        # Normalize by region size for consistency
        peg = peg / region_size
        
        return peg
    
    @staticmethod
    def compute_ti(field, local_window=10):
        """
        Turbulence Index (TI)
        
        Measures chaotic instability in flow
        TI = Var(local vector angles) / Mean(directional coherence)
        
        Args:
            field: Vector field
            local_window: Recent bars to analyze
            
        Returns:
            ti_value: Turbulence level
        """
        # Extract recent region
        recent_field = field[:, -local_window:, :]
        
        # Calculate vector angles
        angles = np.arctan2(recent_field[:, :, 1], recent_field[:, :, 0])
        
        # Variance of angles (how inconsistent are directions?)
        angle_variance = np.var(angles)
        
        # Vector magnitudes
        magnitudes = np.linalg.norm(recent_field, axis=2)
        mean_magnitude = np.mean(magnitudes)
        
        # Directional coherence: how aligned are vectors?
        mean_vector = np.mean(recent_field, axis=(0, 1))
        coherence = np.linalg.norm(mean_vector) / (mean_magnitude + 1e-8)
        
        # TI = chaos / alignment
        ti = angle_variance / (coherence + 1e-8)
        
        return ti
    
    @staticmethod
    def compute_coherence(field, window=10):
        """
        Directional Coherence
        
        How strongly field points in consistent direction
        
        Args:
            field: Vector field
            window: Recent bars
            
        Returns:
            (coherence_magnitude, dominant_angle)
        """
        recent_field = field[:, -window:, :]
        
        # Average vector
        mean_vector = np.mean(recent_field, axis=(0, 1))
        
        # Coherence = magnitude of average vector
        coherence = np.linalg.norm(mean_vector)
        
        # Dominant direction
        angle = np.arctan2(mean_vector[1], mean_vector[0])
        
        # Normalize coherence to [0, 1]
        max_possible = np.max(np.linalg.norm(recent_field, axis=2))
        coherence_normalized = coherence / (max_possible + 1e-8)
        
        return coherence_normalized, angle
    
    @staticmethod
    def compute_all_metrics(field):
        """
        Convenience function: compute all physics metrics at once
        
        Returns:
            dict with keys: peg, ti, coherence, angle, divergence, curl
        """
        from field_constructor import FieldAnalyzer
        analyzer = FieldAnalyzer()
        
        peg = PhysicsCalculator.compute_peg(field)
        ti = PhysicsCalculator.compute_ti(field)
        coherence, angle = PhysicsCalculator.compute_coherence(field)
        divergence = analyzer.compute_divergence(field)
        curl = analyzer.compute_curl(field)
        
        return {
            'peg': peg,
            'ti': ti,
            'coherence': coherence,
            'angle': angle,
            'divergence_map': divergence,
            'curl_map': curl,
            'recent_divergence': divergence[:, -10:].mean(),
            'recent_curl': np.abs(curl[:, -10:]).mean()
        }


class ValidationEngine:
    """Validates physics metrics against known market behavior"""
    
    @staticmethod
    def validate_peg_on_breakouts(prices, breakout_indices, lookback=20):
        """
        Test: Does PEG spike before breakouts?
        
        Args:
            prices: Price array
            breakout_indices: List of breakout bar indices
            lookback: Bars before breakout to check
            
        Returns:
            dict with validation results
        """
        from field_constructor import SimpleFieldConstructor
        
        constructor = SimpleFieldConstructor(
            spatial_bins=50,
            temporal_window=100
        )
        
        results = []
        
        for breakout_idx in breakout_indices:
            # Need enough data before breakout
            if breakout_idx < 120:
                continue
            
            # Calculate PEG timeline leading to breakout
            peg_timeline = []
            
            for offset in range(lookback, 0, -1):
                idx = breakout_idx - offset
                price_window = prices[idx-100:idx]
                
                try:
                    field = constructor.construct_field(price_window)
                    peg = PhysicsCalculator.compute_peg(field)
                    peg_timeline.append(peg)
                except:
                    continue
            
            if len(peg_timeline) < lookback // 2:
                continue
            
            # Check if PEG was rising in the 5-15 bars before breakout
            early_peg = np.mean(peg_timeline[:5])  # Bars 20-15 before
            mid_peg = np.mean(peg_timeline[5:10])   # Bars 15-10 before
            late_peg = np.mean(peg_timeline[10:15]) # Bars 10-5 before
            
            peg_rising = (mid_peg > early_peg) and (late_peg > mid_peg)
            peg_max = np.max(peg_timeline[-15:])  # Max in last 15 bars
            peg_max_timing = lookback - np.argmax(peg_timeline[-15:])
            
            results.append({
                'breakout_idx': breakout_idx,
                'peg_rising': peg_rising,
                'peg_max': peg_max,
                'peg_max_lead_bars': peg_max_timing,
                'peg_timeline': peg_timeline
            })
        
        # Summary statistics
        n_total = len(results)
        n_rising = sum(r['peg_rising'] for r in results)
        avg_lead = np.mean([r['peg_max_lead_bars'] for r in results])
        
        print(f"\n{'='*60}")
        print("PEG VALIDATION ON BREAKOUTS")
        print(f"{'='*60}")
        print(f"Breakouts analyzed: {n_total}")
        print(f"PEG rising before breakout: {n_rising}/{n_total} ({n_rising/n_total*100:.1f}%)")
        print(f"Average PEG spike lead time: {avg_lead:.1f} bars")
        print(f"{'='*60}\n")
        
        # Success criteria: >70% of breakouts had rising PEG
        success = (n_rising / n_total) > 0.7 if n_total > 0 else False
        
        return {
            'success': success,
            'peg_prediction_rate': n_rising / n_total if n_total > 0 else 0,
            'avg_lead_bars': avg_lead,
            'details': results
        }
    
    @staticmethod
    def validate_ti_on_chop(prices, chop_zone_indices, window=50):
        """
        Test: Is TI elevated during choppy periods?
        
        Args:
            prices: Price array
            chop_zone_indices: List of chop zone center indices
            window: Bars to analyze
            
        Returns:
            dict with validation results
        """
        from field_constructor import SimpleFieldConstructor
        
        constructor = SimpleFieldConstructor(
            spatial_bins=50,
            temporal_window=100
        )
        
        chop_ti_values = []
        trend_ti_values = []
        
        for chop_idx in chop_zone_indices:
            if chop_idx < 150 or chop_idx > len(prices) - 150:
                continue
            
            # Calculate TI during chop
            chop_prices = prices[chop_idx-100:chop_idx]
            try:
                field = constructor.construct_field(chop_prices)
                ti = PhysicsCalculator.compute_ti(field)
                chop_ti_values.append(ti)
            except:
                continue
            
            # Calculate TI during trend (before chop)
            trend_prices = prices[chop_idx-250:chop_idx-150]
            try:
                field = constructor.construct_field(trend_prices)
                ti = PhysicsCalculator.compute_ti(field)
                trend_ti_values.append(ti)
            except:
                continue
        
        avg_chop_ti = np.mean(chop_ti_values) if chop_ti_values else 0
        avg_trend_ti = np.mean(trend_ti_values) if trend_ti_values else 0
        
        print(f"\n{'='*60}")
        print("TI VALIDATION ON CHOP ZONES")
        print(f"{'='*60}")
        print(f"Chop zones analyzed: {len(chop_ti_values)}")
        print(f"Average TI during chop: {avg_chop_ti:.2f}")
        print(f"Average TI during trend: {avg_trend_ti:.2f}")
        print(f"TI elevation ratio: {avg_chop_ti/avg_trend_ti:.2f}x")
        print(f"{'='*60}\n")
        
        # Success criteria: Chop TI should be >1.5x trend TI
        success = (avg_chop_ti / avg_trend_ti) > 1.5 if avg_trend_ti > 0 else False
        
        return {
            'success': success,
            'avg_chop_ti': avg_chop_ti,
            'avg_trend_ti': avg_trend_ti,
            'ti_ratio': avg_chop_ti / avg_trend_ti if avg_trend_ti > 0 else 0
        }
    
    @staticmethod
    def validate_coherence(prices, sample_size=20):
        """
        Test: Is coherence high during trends, low during ranges?
        
        Args:
            prices: Price array
            sample_size: Number of periods to test
        """
        from field_constructor import SimpleFieldConstructor
        
        constructor = SimpleFieldConstructor(
            spatial_bins=50,
            temporal_window=100
        )
        
        # Find trending periods (large net movement)
        trend_coherence = []
        range_coherence = []
        
        for i in range(200, len(prices)-100, len(prices)//sample_size):
            window = prices[i-100:i]
            
            # Calculate net movement
            net_movement = abs(window[-1] - window[0]) / window[0]
            
            try:
                field = constructor.construct_field(window)
                coherence, _ = PhysicsCalculator.compute_coherence(field)
                
                if net_movement > 0.03:  # >3% move = trend
                    trend_coherence.append(coherence)
                elif net_movement < 0.01:  # <1% move = range
                    range_coherence.append(coherence)
            except:
                continue
        
        avg_trend_coh = np.mean(trend_coherence) if trend_coherence else 0
        avg_range_coh = np.mean(range_coherence) if range_coherence else 0
        
        print(f"\n{'='*60}")
        print("COHERENCE VALIDATION")
        print(f"{'='*60}")
        print(f"Trending periods: {len(trend_coherence)}")
        print(f"Ranging periods: {len(range_coherence)}")
        print(f"Avg coherence in trends: {avg_trend_coh:.3f}")
        print(f"Avg coherence in ranges: {avg_range_coh:.3f}")
        print(f"Ratio (should be >1.5): {avg_trend_coh/avg_range_coh:.2f}x")
        print(f"{'='*60}\n")
        
        success = (avg_trend_coh / avg_range_coh) > 1.3 if avg_range_coh > 0 else False
        
        return {
            'success': success,
            'trend_coherence': avg_trend_coh,
            'range_coherence': avg_range_coh
        }


if __name__ == "__main__":
    print("Physics Calculator Module")
    print("Use ValidationEngine to test on real data")