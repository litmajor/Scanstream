"""
VFMD Simplified Field Constructor
Starts with price velocity field only for Phase 1
"""

import numpy as np
from scipy.ndimage import gaussian_filter
import pandas as pd


class SimpleFieldConstructor:
    """
    Builds Market Vector Field from price data
    Phase 1: Price velocity field only (simplified)
    """
    
    def __init__(self, 
                 spatial_bins=50,
                 temporal_window=100,
                 smoothing_sigma=2.0):
        """
        Args:
            spatial_bins: Number of price levels (grid resolution)
            temporal_window: How many bars to include in field
            smoothing_sigma: Gaussian smoothing parameter
        """
        self.spatial_bins = spatial_bins
        self.temporal_window = temporal_window
        self.smoothing_sigma = smoothing_sigma
        
    def construct_field(self, prices):
        """
        Build vector field from price series
        
        Args:
            prices: Array of prices (most recent = last element)
            
        Returns:
            field: Array of shape (spatial_bins, temporal_bins, 2)
                   where [:, :, 0] = x-component (price direction)
                         [:, :, 1] = y-component (temporal momentum)
        """
        if len(prices) < self.temporal_window:
            raise ValueError(f"Need at least {self.temporal_window} prices")
        
        # Use most recent window
        recent_prices = prices[-self.temporal_window:]
        
        # Normalize prices to [0, 1] for spatial binning
        price_min = np.min(recent_prices)
        price_max = np.max(recent_prices)
        price_range = price_max - price_min
        
        if price_range == 0:
            price_range = 1.0  # Avoid division by zero
        
        normalized_prices = (recent_prices - price_min) / price_range
        
        # Calculate price velocity (change per bar)
        price_velocity = np.diff(recent_prices)
        price_velocity = np.append(price_velocity, price_velocity[-1])  # Pad last
        
        # Calculate price acceleration (change in velocity)
        price_accel = np.diff(price_velocity)
        price_accel = np.append(price_accel, price_accel[-1])
        
        # Create 2D grid: (price_level, time)
        field = np.zeros((self.spatial_bins, self.temporal_window, 2))
        
        # For each time point, map price to spatial bin
        for t in range(self.temporal_window):
            # Which spatial bin does this price belong to?
            price_bin = int(normalized_prices[t] * (self.spatial_bins - 1))
            price_bin = np.clip(price_bin, 0, self.spatial_bins - 1)
            
            # Assign velocity as vector
            # X-component: price velocity (direction of price movement)
            # Y-component: temporal momentum (are we accelerating?)
            field[price_bin, t, 0] = price_velocity[t]
            field[price_bin, t, 1] = price_accel[t]
        
        # Smooth the field to create continuous flow
        for component in range(2):
            field[:, :, component] = gaussian_filter(
                field[:, :, component],
                sigma=self.smoothing_sigma
            )
        
        # Store metadata for later use
        self.price_min = price_min
        self.price_max = price_max
        self.recent_prices = recent_prices
        
        return field
    
    def get_current_position(self):
        """Get grid position of most recent price"""
        if not hasattr(self, 'recent_prices'):
            return None
            
        current_price = self.recent_prices[-1]
        normalized = (current_price - self.price_min) / (self.price_max - self.price_min)
        current_bin = int(normalized * (self.spatial_bins - 1))
        
        return current_bin, self.temporal_window - 1


class FieldAnalyzer:
    """Extract physics quantities from the field"""
    
    @staticmethod
    def compute_gradient_magnitude(field):
        """
        Compute |∇F| across the field
        This shows regions of high force concentration
        """
        # Gradient in each direction
        grad_x = np.gradient(field[:, :, 0], axis=0)
        grad_y = np.gradient(field[:, :, 0], axis=1)
        grad_vx = np.gradient(field[:, :, 1], axis=0)
        grad_vy = np.gradient(field[:, :, 1], axis=1)
        
        # Magnitude of gradient
        magnitude = np.sqrt(grad_x**2 + grad_y**2 + grad_vx**2 + grad_vy**2)
        
        return magnitude
    
    @staticmethod
    def compute_divergence(field):
        """
        Compute ∇·F (divergence)
        Positive = source (accumulation)
        Negative = sink (distribution)
        """
        div_x = np.gradient(field[:, :, 0], axis=0)
        div_y = np.gradient(field[:, :, 1], axis=1)
        
        divergence = div_x + div_y
        return divergence
    
    @staticmethod
    def compute_curl(field):
        """
        Compute curl (vorticity in 2D)
        High values = rotational/choppy flow
        """
        # ∂Fy/∂x - ∂Fx/∂y
        dFy_dx = np.gradient(field[:, :, 1], axis=0)
        dFx_dy = np.gradient(field[:, :, 0], axis=1)
        
        curl = dFy_dx - dFx_dy
        return curl
    
    @staticmethod
    def get_local_vector(field, spatial_pos, temporal_pos):
        """Get vector at specific grid position"""
        if spatial_pos < 0 or spatial_pos >= field.shape[0]:
            return np.array([0, 0])
        if temporal_pos < 0 or temporal_pos >= field.shape[1]:
            return np.array([0, 0])
            
        return field[spatial_pos, temporal_pos, :]


# Test and validation functions
def test_field_on_trend():
    """Test that field detects trending movement"""
    # Create synthetic trending price
    trend = np.linspace(100, 150, 100)  # Uptrend
    noise = np.random.normal(0, 0.5, 100)
    prices = trend + noise
    
    # Build field
    constructor = SimpleFieldConstructor(spatial_bins=50, temporal_window=100)
    field = constructor.construct_field(prices)
    
    # Analyze
    analyzer = FieldAnalyzer()
    divergence = analyzer.compute_divergence(field)
    
    # In uptrend, recent divergence should be positive (accumulation)
    recent_div = divergence[:, -10:].mean()
    
    print(f"Trend test - Recent divergence: {recent_div:.4f}")
    print(f"✅ PASS" if recent_div > 0 else "❌ FAIL: Expected positive divergence")
    
    return field, divergence


def test_field_on_chop():
    """Test that field detects choppy movement"""
    # Create synthetic choppy price
    base = 100
    chop = base + 2 * np.sin(np.linspace(0, 4*np.pi, 100))
    noise = np.random.normal(0, 0.3, 100)
    prices = chop + noise
    
    # Build field
    constructor = SimpleFieldConstructor(spatial_bins=50, temporal_window=100)
    field = constructor.construct_field(prices)
    
    # Analyze
    analyzer = FieldAnalyzer()
    curl = analyzer.compute_curl(field)
    
    # In chop, curl should be elevated (rotational flow)
    avg_curl = np.abs(curl).mean()
    
    print(f"Chop test - Average curl: {avg_curl:.4f}")
    print(f"✅ PASS" if avg_curl > 0.01 else "❌ FAIL: Expected higher curl in chop")
    
    return field, curl


if __name__ == "__main__":
    print("Testing Field Constructor...")
    print("=" * 50)
    
    print("\n1. Testing on trending data:")
    trend_field, trend_div = test_field_on_trend()
    
    print("\n2. Testing on choppy data:")
    chop_field, chop_curl = test_field_on_chop()
    
    print("\n" + "=" * 50)
    print("Basic tests complete. Ready for real data.")