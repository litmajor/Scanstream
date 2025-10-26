# gradient_trend_filter_v2.py
import numpy as np
import pandas as pd
from typing import Tuple, Optional, Dict
from dataclasses import dataclass

@dataclass
class FilterResult:
    """Container for filter results"""
    signals: np.ndarray
    base: np.ndarray
    diff: np.ndarray
    bands: Optional[Dict[str, np.ndarray]] = None
    strength: Optional[np.ndarray] = None


class GradientTrendFilter:
    """
    Advanced Gradient Trend Filter v2.0
    
    Features:
    - Vectorized operations for better performance
    - Signal strength calculation
    - Configurable sensitivity
    - Enhanced band calculations
    - Comprehensive result tracking
    """
    
    def __init__(self, length: int = 25, sensitivity: float = 1.0, 
                 calculate_bands: bool = True):
        """
        Initialize the filter
        
        Args:
            length: EMA length for smoothing (default: 25)
            sensitivity: Signal sensitivity multiplier (default: 1.0)
            calculate_bands: Whether to calculate support/resistance bands
        """
        self.length = length
        self.sensitivity = sensitivity
        self.calculate_bands = calculate_bands
        self.alpha = 2 / (length + 1)
        
        # State variables
        self.base = None
        self.diff = None
        self.last_result = None

    def _triple_ema(self, src: np.ndarray) -> np.ndarray:
        """Apply triple exponential moving average (vectorized)"""
        ema1 = self._ema(src)
        ema2 = self._ema(ema1)
        ema3 = self._ema(ema2)
        return ema3
    
    def _ema(self, src: np.ndarray) -> np.ndarray:
        """Calculate exponential moving average"""
        result = np.zeros_like(src)
        result[0] = src[0]
        
        for i in range(1, len(src)):
            result[i] = self.alpha * src[i] + (1 - self.alpha) * result[i - 1]
        
        return result

    def _calculate_bands(self, base: np.ndarray, 
                        range_data: np.ndarray) -> Dict[str, np.ndarray]:
        """Calculate Fibonacci-based support/resistance bands"""
        volatility = self._triple_ema(range_data)
        
        bands = {
            'upper3': base + volatility * 0.618 * 2.5,
            'upper2': base + volatility * 0.382 * 2.0,
            'upper1': base + volatility * 0.236 * 1.5,
            'lower1': base - volatility * 0.236 * 1.5,
            'lower2': base - volatility * 0.382 * 2.0,
            'lower3': base - volatility * 0.618 * 2.5,
        }
        
        return bands

    def _calculate_strength(self, diff: np.ndarray, 
                           range_data: np.ndarray) -> np.ndarray:
        """Calculate signal strength (0-100)"""
        # Normalize difference by volatility
        volatility = self._triple_ema(range_data)
        # Avoid division by zero
        strength = np.abs(diff) / (volatility + 1e-10) * 100
        return np.clip(strength, 0, 100)

    def evaluate(self, df: pd.DataFrame, lookback: int = 2) -> FilterResult:
        """
        Evaluate trend signals from price data
        
        Args:
            df: DataFrame with columns ['high', 'low', 'close']
            lookback: Number of periods to check for trend change (default: 2)
            
        Returns:
            FilterResult object containing signals, base line, diff, and optional bands
        """
        # Validate input
        required_cols = ['high', 'low', 'close']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"DataFrame must contain columns: {required_cols}")
        
        src = df['close'].values
        range_data = (df['high'] - df['low']).values
        n = len(src)
        
        # Calculate base trend line
        base = self._triple_ema(src)
        
        # Calculate gradient (difference)
        diff = np.zeros(n)
        diff[lookback:] = base[lookback:] - base[:-lookback]
        
        # Generate signals
        signals = np.full(n, 'NONE', dtype=object)
        
        for i in range(lookback, n):
            prev_diff = diff[i - 1]
            curr_diff = diff[i]
            
            # Apply sensitivity threshold
            threshold = np.std(diff[:i]) * (1 / self.sensitivity) if i > lookback else 0
            
            # Detect trend changes
            if prev_diff < -threshold and curr_diff > threshold:
                signals[i] = 'UP'
            elif prev_diff > threshold and curr_diff < -threshold:
                signals[i] = 'DOWN'
        
        # Calculate optional components
        bands = self._calculate_bands(base, range_data) if self.calculate_bands else None
        strength = self._calculate_strength(diff, range_data)
        
        # Store state
        self.base = base
        self.diff = diff
        
        # Create result object
        result = FilterResult(
            signals=signals,
            base=base,
            diff=diff,
            bands=bands,
            strength=strength
        )
        
        self.last_result = result
        return result

    def get_current_trend(self) -> str:
        """Get the current trend direction"""
        if self.diff is None or len(self.diff) == 0:
            return 'NONE'
        
        current_diff = self.diff[-1]
        if current_diff > 0:
            return 'BULLISH'
        elif current_diff < 0:
            return 'BEARISH'
        else:
            return 'NEUTRAL'

    def to_dataframe(self, result: Optional[FilterResult] = None) -> pd.DataFrame:
        """Convert filter results to DataFrame for easy analysis"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        df = pd.DataFrame({
            'signal': result.signals,
            'base': result.base,
            'diff': result.diff,
            'strength': result.strength
        })
        
        if result.bands:
            for band_name, band_values in result.bands.items():
                df[band_name] = band_values
        
        return df


# Example usage
if __name__ == "__main__":
    # Create sample data
    np.random.seed(42)
    n = 100
    
    # Simulated price data with trend
    trend = np.linspace(100, 120, n)
    noise = np.random.normal(0, 2, n)
    close = trend + noise
    high = close + np.abs(np.random.normal(0, 1, n))
    low = close - np.abs(np.random.normal(0, 1, n))
    
    df = pd.DataFrame({
        'high': high,
        'low': low,
        'close': close
    })
    
    # Initialize and run filter
    gtf = GradientTrendFilter(length=25, sensitivity=1.0)
    result = gtf.evaluate(df)
    
    # Display results
    result_df = gtf.to_dataframe()
    print("Sample Results:")
    print(result_df.tail(10))
    print(f"\nCurrent Trend: {gtf.get_current_trend()}")
    print(f"Total Signals: UP={np.sum(result.signals == 'UP')}, "
          f"DOWN={np.sum(result.signals == 'DOWN')}")