# volume_profile_engine_v2.py
import numpy as np
import pandas as pd
from typing import Optional, Dict, Tuple, List
from dataclasses import dataclass
from enum import Enum
from scipy import stats

class Signal(Enum):
    """Trading signals"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    BREAKOUT_LONG = "BREAKOUT_LONG"
    BREAKOUT_SHORT = "BREAKOUT_SHORT"

class VolumeRegime(Enum):
    """Volume regimes"""
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"

class PriceLevel(Enum):
    """Price level types"""
    POC = "POC"  # Point of Control
    VAH = "VAH"  # Value Area High
    VAL = "VAL"  # Value Area Low
    HVN = "HVN"  # High Volume Node
    LVN = "LVN"  # Low Volume Node

@dataclass
class VolumeProfileResult:
    """Container for volume profile results"""
    signals: np.ndarray
    poc: np.ndarray  # Point of Control
    vah: np.ndarray  # Value Area High
    val: np.ndarray  # Value Area Low
    volume_regime: np.ndarray
    delta: np.ndarray  # Buy vs Sell pressure
    cvd: np.ndarray  # Cumulative Volume Delta
    liquidity_zones: List[Dict]  # Support/Resistance levels
    imbalance_score: np.ndarray  # Order flow imbalance
    confidence: np.ndarray
    entry_prices: Optional[np.ndarray] = None
    pnl: Optional[np.ndarray] = None


class VolumeProfileEngine:
    """
    Volume Profile Engine v2.0 - Institutional Order Flow Analysis
    
    Features:
    - Point of Control (POC) - Highest volume price level
    - Value Area (VA) - 70% of volume concentration
    - Volume Delta - Buy vs Sell pressure analysis
    - Cumulative Volume Delta (CVD) - Institutional positioning
    - High/Low Volume Nodes - Support/Resistance identification
    - Liquidity Zones - Areas of unfilled orders
    - Order Flow Imbalance - Supply/Demand dynamics
    
    Perfect for identifying institutional levels and smart money movement!
    """
    
    def __init__(
        self,
        profile_period: int = 50,
        value_area_pct: float = 0.70,
        price_bins: int = 50,
        delta_threshold: float = 0.6,
        volume_ma_period: int = 20,
        breakout_confirm_volume: float = 1.5,
        track_pnl: bool = True
    ):
        """
        Initialize Volume Profile Engine
        
        Args:
            profile_period: Lookback for volume profile calculation (default: 50)
            value_area_pct: Percentage for value area (default: 0.70 = 70%)
            price_bins: Number of price levels to analyze (default: 50)
            delta_threshold: Delta ratio for strong signals (default: 0.6)
            volume_ma_period: Period for volume moving average (default: 20)
            breakout_confirm_volume: Volume multiplier for breakout confirmation (default: 1.5x)
            track_pnl: Calculate profit and loss (default: True)
        """
        self.profile_period = profile_period
        self.value_area_pct = value_area_pct
        self.price_bins = price_bins
        self.delta_threshold = delta_threshold
        self.volume_ma_period = volume_ma_period
        self.breakout_confirm_volume = breakout_confirm_volume
        self.track_pnl = track_pnl
        
        self.last_result = None

    def _calculate_volume_profile(
        self,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray,
        volume: np.ndarray,
        start_idx: int,
        end_idx: int
    ) -> Tuple[float, float, float, Dict]:
        """Calculate volume profile for a period"""
        if end_idx - start_idx < 2:
            return np.nan, np.nan, np.nan, {}
        
        # Get price range
        period_high = np.max(high[start_idx:end_idx])
        period_low = np.min(low[start_idx:end_idx])
        
        if period_high == period_low:
            return close[end_idx-1], close[end_idx-1], close[end_idx-1], {}
        
        # Create price bins
        price_levels = np.linspace(period_low, period_high, self.price_bins)
        volume_at_price = np.zeros(self.price_bins)
        
        # Distribute volume across price levels
        for i in range(start_idx, end_idx):
            if volume[i] > 0:
                # Simple distribution: allocate volume to nearest price level
                price_range = (high[i] - low[i])
                if price_range > 0:
                    # Weight volume across the candle's range
                    idx_low = np.searchsorted(price_levels, low[i])
                    idx_high = np.searchsorted(price_levels, high[i])
                    idx_low = max(0, min(idx_low, self.price_bins - 1))
                    idx_high = max(0, min(idx_high, self.price_bins - 1))
                    
                    if idx_low == idx_high:
                        volume_at_price[idx_low] += volume[i]
                    else:
                        # Distribute proportionally
                        for j in range(idx_low, idx_high + 1):
                            volume_at_price[j] += volume[i] / (idx_high - idx_low + 1)
        
        # Find POC (Point of Control) - highest volume level
        poc_idx = np.argmax(volume_at_price)
        poc = price_levels[poc_idx]
        
        # Calculate Value Area (70% of volume)
        total_volume = np.sum(volume_at_price)
        target_volume = total_volume * self.value_area_pct
        
        # Expand from POC until we capture target volume
        accumulated_volume = volume_at_price[poc_idx]
        upper_idx = poc_idx
        lower_idx = poc_idx
        
        while accumulated_volume < target_volume and (upper_idx < self.price_bins - 1 or lower_idx > 0):
            # Check which direction has more volume
            upper_vol = volume_at_price[upper_idx + 1] if upper_idx < self.price_bins - 1 else 0
            lower_vol = volume_at_price[lower_idx - 1] if lower_idx > 0 else 0
            
            if upper_vol > lower_vol and upper_idx < self.price_bins - 1:
                upper_idx += 1
                accumulated_volume += upper_vol
            elif lower_idx > 0:
                lower_idx -= 1
                accumulated_volume += lower_vol
            else:
                break
        
        vah = price_levels[upper_idx]  # Value Area High
        val = price_levels[lower_idx]  # Value Area Low
        
        # Identify High and Low Volume Nodes
        volume_threshold = np.percentile(volume_at_price[volume_at_price > 0], 75)
        hvn_levels = price_levels[volume_at_price > volume_threshold]
        lvn_levels = price_levels[volume_at_price < np.percentile(volume_at_price[volume_at_price > 0], 25)]
        
        profile_data = {
            'price_levels': price_levels,
            'volume_at_price': volume_at_price,
            'hvn': hvn_levels,
            'lvn': lvn_levels
        }
        
        return poc, vah, val, profile_data

    def _calculate_delta(
        self,
        open_price: np.ndarray,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray,
        volume: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculate Volume Delta (Buy vs Sell pressure)
        Approximation: up candles = buying, down candles = selling
        """
        delta = np.zeros(len(volume))
        cvd = np.zeros(len(volume))
        
        for i in range(len(volume)):
            if close[i] >= open_price[i]:
                # Bullish candle - more buying
                buy_pct = (close[i] - low[i]) / (high[i] - low[i] + 1e-10)
                delta[i] = volume[i] * (buy_pct * 2 - 1)  # -1 to 1 scale
            else:
                # Bearish candle - more selling
                sell_pct = (high[i] - close[i]) / (high[i] - low[i] + 1e-10)
                delta[i] = -volume[i] * (sell_pct * 2 - 1)
            
            # Cumulative Volume Delta
            if i > 0:
                cvd[i] = cvd[i-1] + delta[i]
            else:
                cvd[i] = delta[i]
        
        return delta, cvd

    def _calculate_imbalance(
        self,
        delta: np.ndarray,
        volume: np.ndarray,
        period: int = 10
    ) -> np.ndarray:
        """Calculate order flow imbalance score"""
        imbalance = np.zeros(len(delta))
        
        for i in range(period, len(delta)):
            window_delta = delta[i-period:i]
            window_volume = volume[i-period:i]
            
            if np.sum(window_volume) > 0:
                # Normalized imbalance: ratio of delta to total volume
                imbalance[i] = np.sum(window_delta) / np.sum(window_volume)
        
        return imbalance

    def _detect_volume_regime(
        self,
        volume: np.ndarray
    ) -> np.ndarray:
        """Detect volume regime (high, normal, low)"""
        vol_ma = pd.Series(volume).rolling(self.volume_ma_period).mean().values
        vol_std = pd.Series(volume).rolling(self.volume_ma_period).std().values
        
        regime = np.full(len(volume), VolumeRegime.NORMAL.value, dtype=object)
        
        for i in range(self.volume_ma_period, len(volume)):
            if volume[i] > vol_ma[i] + vol_std[i]:
                regime[i] = VolumeRegime.HIGH.value
            elif volume[i] < vol_ma[i] - vol_std[i]:
                regime[i] = VolumeRegime.LOW.value
        
        return regime

    def _identify_liquidity_zones(
        self,
        poc: np.ndarray,
        vah: np.ndarray,
        val: np.ndarray,
        profile_data: List[Dict]
    ) -> List[Dict]:
        """Identify key liquidity zones (support/resistance)"""
        zones = []
        
        for i in range(len(poc)):
            if not np.isnan(poc[i]):
                zones.append({
                    'index': i,
                    'type': PriceLevel.POC.value,
                    'price': poc[i],
                    'strength': 1.0
                })
                
                zones.append({
                    'index': i,
                    'type': PriceLevel.VAH.value,
                    'price': vah[i],
                    'strength': 0.7
                })
                
                zones.append({
                    'index': i,
                    'type': PriceLevel.VAL.value,
                    'price': val[i],
                    'strength': 0.7
                })
        
        return zones

    def _calculate_confidence(
        self,
        delta: np.ndarray,
        volume_regime: np.ndarray,
        imbalance: np.ndarray,
        close: np.ndarray,
        poc: np.ndarray,
        vah: np.ndarray,
        val: np.ndarray
    ) -> np.ndarray:
        """Calculate signal confidence based on volume analysis"""
        confidence = np.zeros(len(delta))
        
        for i in range(len(delta)):
            score = 0
            
            # Delta strength (0-30 points)
            if abs(delta[i]) > 0:
                normalized_delta = abs(delta[i]) / (np.max(np.abs(delta[:i+1])) + 1e-10)
                score += normalized_delta * 30
            
            # Volume regime (0-25 points)
            if volume_regime[i] == VolumeRegime.HIGH.value:
                score += 25
            elif volume_regime[i] == VolumeRegime.NORMAL.value:
                score += 15
            
            # Imbalance (0-25 points)
            score += abs(imbalance[i]) * 25
            
            # Price near key levels (0-20 points)
            if not np.isnan(poc[i]) and not np.isnan(vah[i]) and not np.isnan(val[i]):
                distance_to_poc = abs(close[i] - poc[i]) / poc[i]
                distance_to_vah = abs(close[i] - vah[i]) / vah[i]
                distance_to_val = abs(close[i] - val[i]) / val[i]
                
                min_distance = min(distance_to_poc, distance_to_vah, distance_to_val)
                if min_distance < 0.01:  # Within 1% of key level
                    score += 20
                elif min_distance < 0.02:  # Within 2%
                    score += 10
            
            confidence[i] = min(score, 100)
        
        return confidence

    def _generate_signals(
        self,
        close: np.ndarray,
        volume: np.ndarray,
        delta: np.ndarray,
        cvd: np.ndarray,
        poc: np.ndarray,
        vah: np.ndarray,
        val: np.ndarray,
        imbalance: np.ndarray,
        volume_regime: np.ndarray,
        confidence: np.ndarray
    ) -> np.ndarray:
        """Generate trading signals based on volume analysis"""
        signals = np.full(len(close), Signal.HOLD.value, dtype=object)
        vol_ma = pd.Series(volume).rolling(self.volume_ma_period).mean().values
        
        position = 0
        
        for i in range(self.profile_period, len(close)):
            if np.isnan(poc[i]) or confidence[i] < 40:
                continue
            
            price = close[i]
            prev_price = close[i-1]
            
            # Strong buying pressure at support
            bullish_delta = delta[i] > 0 and imbalance[i] > self.delta_threshold
            at_support = price <= val[i] or price <= poc[i]
            cvd_rising = i > 0 and cvd[i] > cvd[i-1]
            high_volume = volume[i] > vol_ma[i] * self.breakout_confirm_volume
            
            # Strong selling pressure at resistance
            bearish_delta = delta[i] < 0 and imbalance[i] < -self.delta_threshold
            at_resistance = price >= vah[i] or price >= poc[i]
            cvd_falling = i > 0 and cvd[i] < cvd[i-1]
            
            # BUY signals
            if position == 0 and bullish_delta and at_support and cvd_rising:
                signals[i] = Signal.BUY.value
                position = 1
            
            # Breakout LONG with volume confirmation
            elif position == 0 and prev_price <= vah[i] and price > vah[i] and high_volume and cvd_rising:
                signals[i] = Signal.BREAKOUT_LONG.value
                position = 1
            
            # SELL signals
            elif position == 0 and bearish_delta and at_resistance and cvd_falling:
                signals[i] = Signal.SELL.value
                position = -1
            
            # Breakout SHORT with volume confirmation
            elif position == 0 and prev_price >= val[i] and price < val[i] and high_volume and cvd_falling:
                signals[i] = Signal.BREAKOUT_SHORT.value
                position = -1
            
            # Exit long at resistance with selling pressure
            elif position == 1 and at_resistance and bearish_delta:
                signals[i] = Signal.HOLD.value
                position = 0
            
            # Exit short at support with buying pressure
            elif position == -1 and at_support and bullish_delta:
                signals[i] = Signal.HOLD.value
                position = 0
        
        return signals

    def _calculate_pnl(
        self,
        close: np.ndarray,
        signals: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Calculate P&L and entry prices"""
        pnl = np.zeros(len(close))
        entry_prices = np.zeros(len(close))
        entry_price = 0
        position = 0
        
        for i in range(1, len(close)):
            if signals[i] in [Signal.BUY.value, Signal.BREAKOUT_LONG.value]:
                entry_price = close[i]
                position = 1
                entry_prices[i] = entry_price
            
            elif signals[i] in [Signal.SELL.value, Signal.BREAKOUT_SHORT.value]:
                entry_price = close[i]
                position = -1
                entry_prices[i] = entry_price
            
            elif signals[i] == Signal.HOLD.value and position != 0 and signals[i-1] != Signal.HOLD.value:
                # Implicit exit
                position = 0
                entry_price = 0
            
            # Calculate running P&L
            if position == 1 and entry_price > 0:
                pnl[i] = ((close[i] - entry_price) / entry_price) * 100
                entry_prices[i] = entry_price
            elif position == -1 and entry_price > 0:
                pnl[i] = ((entry_price - close[i]) / entry_price) * 100
                entry_prices[i] = entry_price
        
        return pnl, entry_prices

    def evaluate(self, df: pd.DataFrame) -> VolumeProfileResult:
        """
        Evaluate volume profile signals
        
        Args:
            df: DataFrame with columns ['open', 'high', 'low', 'close', 'volume']
            
        Returns:
            VolumeProfileResult object with signals and analytics
        """
        # Validate input
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"DataFrame must contain columns: {required_cols}")
        
        n = len(df)
        open_price = df['open'].values
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        volume = df['volume'].values
        
        # Initialize arrays
        poc = np.full(n, np.nan)
        vah = np.full(n, np.nan)
        val = np.full(n, np.nan)
        profile_data_list = []
        
        # Calculate rolling volume profiles
        for i in range(self.profile_period, n):
            start_idx = max(0, i - self.profile_period)
            p, v_high, v_low, p_data = self._calculate_volume_profile(
                high, low, close, volume, start_idx, i
            )
            poc[i] = p
            vah[i] = v_high
            val[i] = v_low
            profile_data_list.append(p_data)
        
        # Calculate delta and CVD
        delta, cvd = self._calculate_delta(open_price, high, low, close, volume)
        
        # Calculate order flow imbalance
        imbalance = self._calculate_imbalance(delta, volume)
        
        # Detect volume regime
        volume_regime = self._detect_volume_regime(volume)
        
        # Calculate confidence
        confidence = self._calculate_confidence(
            delta, volume_regime, imbalance, close, poc, vah, val
        )
        
        # Identify liquidity zones
        liquidity_zones = self._identify_liquidity_zones(poc, vah, val, profile_data_list)
        
        # Generate signals
        signals = self._generate_signals(
            close, volume, delta, cvd, poc, vah, val,
            imbalance, volume_regime, confidence
        )
        
        # Calculate P&L if enabled
        pnl = None
        entry_prices = None
        if self.track_pnl:
            pnl, entry_prices = self._calculate_pnl(close, signals)
        
        # Create result
        result = VolumeProfileResult(
            signals=signals,
            poc=poc,
            vah=vah,
            val=val,
            volume_regime=volume_regime,
            delta=delta,
            cvd=cvd,
            liquidity_zones=liquidity_zones,
            imbalance_score=imbalance,
            confidence=confidence,
            entry_prices=entry_prices,
            pnl=pnl
        )
        
        self.last_result = result
        return result

    def get_statistics(self, result: Optional[VolumeProfileResult] = None) -> Dict:
        """Calculate trading statistics"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        signals = result.signals
        buy_signals = np.sum(signals == Signal.BUY.value)
        sell_signals = np.sum(signals == Signal.SELL.value)
        breakout_long = np.sum(signals == Signal.BREAKOUT_LONG.value)
        breakout_short = np.sum(signals == Signal.BREAKOUT_SHORT.value)
        
        stats = {
            'total_signals': buy_signals + sell_signals + breakout_long + breakout_short,
            'buy_signals': buy_signals,
            'sell_signals': sell_signals,
            'breakout_long': breakout_long,
            'breakout_short': breakout_short,
            'avg_confidence': np.mean(result.confidence[result.confidence > 0]),
            'avg_cvd': np.mean(result.cvd),
            'positive_delta_pct': np.sum(result.delta > 0) / len(result.delta) * 100,
            'high_volume_periods': np.sum(result.volume_regime == VolumeRegime.HIGH.value),
            'liquidity_zones_count': len(result.liquidity_zones)
        }
        
        if result.pnl is not None:
            stats['total_pnl'] = result.pnl[-1]
            stats['max_pnl'] = np.max(result.pnl)
            stats['min_pnl'] = np.min(result.pnl)
        
        return stats

    def to_dataframe(self, result: Optional[VolumeProfileResult] = None) -> pd.DataFrame:
        """Convert results to DataFrame"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        df = pd.DataFrame({
            'signal': result.signals,
            'poc': result.poc,
            'vah': result.vah,
            'val': result.val,
            'delta': result.delta,
            'cvd': result.cvd,
            'imbalance': result.imbalance_score,
            'volume_regime': result.volume_regime,
            'confidence': result.confidence
        })
        
        if result.entry_prices is not None:
            df['entry_price'] = result.entry_prices
        
        if result.pnl is not None:
            df['pnl_pct'] = result.pnl
        
        return df


# Example usage
if __name__ == "__main__":
    # Create sample data with realistic volume patterns
    np.random.seed(42)
    n = 200
    
    # Price trend
    trend = np.cumsum(np.random.randn(n) * 0.5) + 100
    volatility = np.random.uniform(0.5, 2, n)
    close = trend + np.random.randn(n) * volatility
    
    # OHLC
    open_price = close + np.random.randn(n) * 0.3
    high = np.maximum(open_price, close) + np.abs(np.random.randn(n) * volatility * 0.5)
    low = np.minimum(open_price, close) - np.abs(np.random.randn(n) * volatility * 0.5)
    
    # Volume with spikes
    base_volume = np.random.uniform(1000, 5000, n)
    volume_spikes = np.random.choice([1, 1, 1, 1, 3], n)  # 20% chance of spike
    volume = base_volume * volume_spikes
    
    df = pd.DataFrame({
        'open': open_price,
        'high': high,
        'low': low,
        'close': close,
        'volume': volume
    })
    
    # Initialize and run Volume Profile Engine
    vp_engine = VolumeProfileEngine(
        profile_period=50,
        value_area_pct=0.70,
        delta_threshold=0.6,
        breakout_confirm_volume=1.5,
        track_pnl=True
    )
    
    result = vp_engine.evaluate(df)
    
    # Display results
    result_df = vp_engine.to_dataframe()
    print("Sample Results (Last 10 rows):")
    print(result_df.tail(10))
    
    print("\n" + "="*60)
    stats = vp_engine.get_statistics()
    print("Volume Profile Statistics:")
    for key, value in stats.items():
        if isinstance(value, float):
            print(f"{key}: {value:.2f}")
        else:
            print(f"{key}: {value}")