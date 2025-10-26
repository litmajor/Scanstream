# mean_reversion_engine_v2.py
import numpy as np
import pandas as pd
from typing import Optional, Dict, Tuple, List
from dataclasses import dataclass
from enum import Enum

class Signal(Enum):
    """Trading signals"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"

class Zone(Enum):
    """Price zones relative to bands"""
    OVERSOLD = "OVERSOLD"
    LOWER = "LOWER"
    NEUTRAL = "NEUTRAL"
    UPPER = "UPPER"
    OVERBOUGHT = "OVERBOUGHT"

@dataclass
class MeanReversionResult:
    """Container for mean reversion results"""
    signals: np.ndarray
    bb_middle: np.ndarray
    bb_upper: np.ndarray
    bb_lower: np.ndarray
    z_score: np.ndarray
    rsi: np.ndarray
    zones: np.ndarray
    regime: np.ndarray  # Trending vs ranging market
    confidence: np.ndarray  # Signal confidence 0-100
    entry_prices: Optional[np.ndarray] = None
    pnl: Optional[np.ndarray] = None


class MeanReversionEngine:
    """
    Mean Reversion Engine v2.0 - Multi-Indicator Reversal System
    
    Combines:
    - Bollinger Bands for volatility-adjusted levels
    - Z-Score for statistical extremes
    - RSI for momentum confirmation
    - Market regime detection (trending vs ranging)
    - Confidence scoring for signal quality
    
    Perfect complement to trend-following strategies!
    """
    
    def __init__(
        self,
        bb_period: int = 20,
        bb_std: float = 2.0,
        rsi_period: int = 14,
        z_score_period: int = 20,
        oversold_threshold: float = 30,
        overbought_threshold: float = 70,
        regime_period: int = 50,
        require_confluence: bool = True,
        track_pnl: bool = True
    ):
        """
        Initialize Mean Reversion Engine
        
        Args:
            bb_period: Bollinger Bands period (default: 20)
            bb_std: Bollinger Bands standard deviation (default: 2.0)
            rsi_period: RSI calculation period (default: 14)
            z_score_period: Z-Score lookback period (default: 20)
            oversold_threshold: RSI oversold level (default: 30)
            overbought_threshold: RSI overbought level (default: 70)
            regime_period: Period for regime detection (default: 50)
            require_confluence: Require multiple indicators to agree (default: True)
            track_pnl: Calculate profit and loss (default: True)
        """
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.rsi_period = rsi_period
        self.z_score_period = z_score_period
        self.oversold_threshold = oversold_threshold
        self.overbought_threshold = overbought_threshold
        self.regime_period = regime_period
        self.require_confluence = require_confluence
        self.track_pnl = track_pnl
        
        self.last_result = None

    def _calculate_bollinger_bands(
        self,
        close: pd.Series
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Calculate Bollinger Bands"""
        middle = close.rolling(self.bb_period).mean()
        std = close.rolling(self.bb_period).std()
        upper = middle + (std * self.bb_std)
        lower = middle - (std * self.bb_std)
        
        return middle.values, upper.values, lower.values

    def _calculate_z_score(self, close: pd.Series) -> np.ndarray:
        """Calculate rolling Z-Score"""
        mean = close.rolling(self.z_score_period).mean()
        std = close.rolling(self.z_score_period).std()
        z_score = (close - mean) / (std + 1e-10)
        return z_score.values

    def _calculate_rsi(self, close: pd.Series) -> np.ndarray:
        """Calculate RSI"""
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(self.rsi_period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(self.rsi_period).mean()
        rs = gain / (loss + 1e-10)
        rsi = 100 - (100 / (1 + rs))
        return rsi.values

    def _detect_regime(self, close: pd.Series) -> np.ndarray:
        """
        Detect market regime: 1 = ranging (mean reversion works), 
                             0 = trending (avoid mean reversion)
        """
        # Use ADX-like logic: high volatility + directional movement = trending
        returns = close.pct_change()
        
        # Volatility (use rolling std of returns)
        volatility = returns.rolling(self.regime_period).std()
        
        # Directional strength (correlation with time)
        time_index = np.arange(len(close))
        
        def rolling_correlation(series, period):
            result = np.zeros(len(series))
            for i in range(period, len(series)):
                window = series[i-period:i]
                time_window = time_index[i-period:i]
                if len(window) > 1 and np.std(window) > 0:
                    result[i] = np.abs(np.corrcoef(time_window, window)[0, 1])
            return result
        
        trend_strength = rolling_correlation(close.values, self.regime_period)
        
        # Ranging market: low trend strength
        # Threshold: trend_strength < 0.3 indicates ranging
        regime = (trend_strength < 0.3).astype(int)
        
        return regime

    def _calculate_zones(
        self,
        close: np.ndarray,
        bb_upper: np.ndarray,
        bb_lower: np.ndarray,
        bb_middle: np.ndarray
    ) -> np.ndarray:
        """Determine price zones"""
        zones = np.full(len(close), Zone.NEUTRAL.value, dtype=object)
        
        # Calculate band ranges
        upper_range = bb_upper - bb_middle
        lower_range = bb_middle - bb_lower
        
        for i in range(len(close)):
            if np.isnan(bb_upper[i]) or np.isnan(bb_lower[i]):
                continue
                
            price = close[i]
            
            # Extreme zones
            if price > bb_upper[i]:
                zones[i] = Zone.OVERBOUGHT.value
            elif price < bb_lower[i]:
                zones[i] = Zone.OVERSOLD.value
            # Upper zone (above middle, below upper band)
            elif price > bb_middle[i] + upper_range[i] * 0.5:
                zones[i] = Zone.UPPER.value
            # Lower zone (below middle, above lower band)
            elif price < bb_middle[i] - lower_range[i] * 0.5:
                zones[i] = Zone.LOWER.value
            else:
                zones[i] = Zone.NEUTRAL.value
        
        return zones

    def _calculate_confidence(
        self,
        z_score: np.ndarray,
        rsi: np.ndarray,
        zones: np.ndarray,
        regime: np.ndarray
    ) -> np.ndarray:
        """Calculate signal confidence score (0-100)"""
        confidence = np.zeros(len(z_score))
        
        for i in range(len(z_score)):
            score = 0
            
            # Z-Score contribution (0-40 points)
            if not np.isnan(z_score[i]):
                z_abs = abs(z_score[i])
                score += min(z_abs * 20, 40)  # Max 40 points
            
            # RSI contribution (0-30 points)
            if not np.isnan(rsi[i]):
                if rsi[i] < self.oversold_threshold:
                    score += (self.oversold_threshold - rsi[i]) / self.oversold_threshold * 30
                elif rsi[i] > self.overbought_threshold:
                    score += (rsi[i] - self.overbought_threshold) / (100 - self.overbought_threshold) * 30
            
            # Zone contribution (0-20 points)
            if zones[i] in [Zone.OVERSOLD.value, Zone.OVERBOUGHT.value]:
                score += 20
            elif zones[i] in [Zone.LOWER.value, Zone.UPPER.value]:
                score += 10
            
            # Regime bonus (0-10 points)
            if regime[i] == 1:  # Ranging market
                score += 10
            
            confidence[i] = min(score, 100)
        
        return confidence

    def _generate_signals(
        self,
        close: np.ndarray,
        z_score: np.ndarray,
        rsi: np.ndarray,
        zones: np.ndarray,
        regime: np.ndarray,
        confidence: np.ndarray
    ) -> np.ndarray:
        """Generate trading signals with confluence logic"""
        signals = np.full(len(close), Signal.HOLD.value, dtype=object)
        position = 0  # Track current position
        
        for i in range(1, len(close)):
            # Skip if indicators not ready
            if np.isnan(z_score[i]) or np.isnan(rsi[i]):
                continue
            
            # Oversold conditions (BUY signal)
            z_oversold = z_score[i] < -1.5
            rsi_oversold = rsi[i] < self.oversold_threshold
            zone_oversold = zones[i] in [Zone.OVERSOLD.value, Zone.LOWER.value]
            
            # Overbought conditions (SELL signal)
            z_overbought = z_score[i] > 1.5
            rsi_overbought = rsi[i] > self.overbought_threshold
            zone_overbought = zones[i] in [Zone.OVERBOUGHT.value, Zone.UPPER.value]
            
            # Exit conditions (mean reversion)
            near_mean = abs(z_score[i]) < 0.3
            rsi_neutral = self.oversold_threshold < rsi[i] < self.overbought_threshold
            
            if self.require_confluence:
                # Require at least 2 of 3 indicators to agree
                buy_votes = sum([z_oversold, rsi_oversold, zone_oversold])
                sell_votes = sum([z_overbought, rsi_overbought, zone_overbought])
                
                # BUY signal
                if buy_votes >= 2 and position == 0 and confidence[i] > 40:
                    signals[i] = Signal.BUY.value
                    position = 1
                
                # SELL signal
                elif sell_votes >= 2 and position == 0 and confidence[i] > 40:
                    signals[i] = Signal.SELL.value
                    position = -1
                
                # EXIT signals
                elif position == 1 and (near_mean or rsi_neutral):
                    signals[i] = Signal.EXIT_LONG.value
                    position = 0
                
                elif position == -1 and (near_mean or rsi_neutral):
                    signals[i] = Signal.EXIT_SHORT.value
                    position = 0
            
            else:
                # Any single indicator can trigger
                if (z_oversold or rsi_oversold or zone_oversold) and position == 0:
                    signals[i] = Signal.BUY.value
                    position = 1
                
                elif (z_overbought or rsi_overbought or zone_overbought) and position == 0:
                    signals[i] = Signal.SELL.value
                    position = -1
                
                elif position == 1 and near_mean:
                    signals[i] = Signal.EXIT_LONG.value
                    position = 0
                
                elif position == -1 and near_mean:
                    signals[i] = Signal.EXIT_SHORT.value
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
            if signals[i] == Signal.BUY.value:
                entry_price = close[i]
                position = 1
                entry_prices[i] = entry_price
            
            elif signals[i] == Signal.SELL.value:
                entry_price = close[i]
                position = -1
                entry_prices[i] = entry_price
            
            elif signals[i] in [Signal.EXIT_LONG.value, Signal.EXIT_SHORT.value]:
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

    def evaluate(self, df: pd.DataFrame) -> MeanReversionResult:
        """
        Evaluate mean reversion signals
        
        Args:
            df: DataFrame with columns ['high', 'low', 'close']
            
        Returns:
            MeanReversionResult object with signals and analytics
        """
        # Validate input
        required_cols = ['close']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"DataFrame must contain column: close")
        
        close = df['close']
        
        # Calculate indicators
        bb_middle, bb_upper, bb_lower = self._calculate_bollinger_bands(close)
        z_score = self._calculate_z_score(close)
        rsi = self._calculate_rsi(close)
        regime = self._detect_regime(close)
        zones = self._calculate_zones(close.values, bb_upper, bb_lower, bb_middle)
        confidence = self._calculate_confidence(z_score, rsi, zones, regime)
        
        # Generate signals
        signals = self._generate_signals(
            close.values, z_score, rsi, zones, regime, confidence
        )
        
        # Calculate P&L if enabled
        pnl = None
        entry_prices = None
        if self.track_pnl:
            pnl, entry_prices = self._calculate_pnl(close.values, signals)
        
        # Create result
        result = MeanReversionResult(
            signals=signals,
            bb_middle=bb_middle,
            bb_upper=bb_upper,
            bb_lower=bb_lower,
            z_score=z_score,
            rsi=rsi,
            zones=zones,
            regime=regime,
            confidence=confidence,
            entry_prices=entry_prices,
            pnl=pnl
        )
        
        self.last_result = result
        return result

    def get_statistics(self, result: Optional[MeanReversionResult] = None) -> Dict:
        """Calculate trading statistics"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        signals = result.signals
        buy_signals = np.sum(signals == Signal.BUY.value)
        sell_signals = np.sum(signals == Signal.SELL.value)
        exit_long = np.sum(signals == Signal.EXIT_LONG.value)
        exit_short = np.sum(signals == Signal.EXIT_SHORT.value)
        
        # Regime analysis
        ranging_pct = np.mean(result.regime) * 100
        
        stats = {
            'total_entries': buy_signals + sell_signals,
            'buy_signals': buy_signals,
            'sell_signals': sell_signals,
            'exit_long_signals': exit_long,
            'exit_short_signals': exit_short,
            'avg_confidence': np.mean(result.confidence[result.confidence > 0]),
            'ranging_market_pct': ranging_pct,
            'avg_z_score': np.nanmean(np.abs(result.z_score)),
            'avg_rsi': np.nanmean(result.rsi)
        }
        
        if result.pnl is not None:
            completed_trades = exit_long + exit_short
            if completed_trades > 0:
                stats['completed_trades'] = completed_trades
                stats['total_pnl'] = result.pnl[-1]
                stats['max_pnl'] = np.max(result.pnl)
                stats['min_pnl'] = np.min(result.pnl)
        
        return stats

    def to_dataframe(self, result: Optional[MeanReversionResult] = None) -> pd.DataFrame:
        """Convert results to DataFrame"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        df = pd.DataFrame({
            'signal': result.signals,
            'bb_middle': result.bb_middle,
            'bb_upper': result.bb_upper,
            'bb_lower': result.bb_lower,
            'z_score': result.z_score,
            'rsi': result.rsi,
            'zone': result.zones,
            'regime': result.regime,
            'confidence': result.confidence
        })
        
        if result.entry_prices is not None:
            df['entry_price'] = result.entry_prices
        
        if result.pnl is not None:
            df['pnl_pct'] = result.pnl
        
        return df


# Example usage
if __name__ == "__main__":
    # Create sample mean-reverting data
    np.random.seed(42)
    n = 300
    
    # Mean-reverting process with occasional trends
    price = 100
    prices = [price]
    
    for i in range(n-1):
        # Mean reversion force
        reversion = (100 - price) * 0.1
        # Random shock
        shock = np.random.randn() * 2
        # Occasional trend
        trend = np.sin(i / 50) * 0.5
        
        price += reversion + shock + trend
        prices.append(price)
    
    prices = np.array(prices)
    
    df = pd.DataFrame({
        'high': prices + np.abs(np.random.randn(n)),
        'low': prices - np.abs(np.random.randn(n)),
        'close': prices
    })
    
    # Initialize and run Mean Reversion Engine
    mr_engine = MeanReversionEngine(
        bb_period=20,
        bb_std=2.0,
        rsi_period=14,
        oversold_threshold=30,
        overbought_threshold=70,
        require_confluence=True,
        track_pnl=True
    )
    
    result = mr_engine.evaluate(df)
    
    # Display results
    result_df = mr_engine.to_dataframe()
    print("Sample Results (Last 10 rows):")
    print(result_df.tail(10))
    
    print("\n" + "="*60)
    stats = mr_engine.get_statistics()
    print("Mean Reversion Statistics:")
    for key, value in stats.items():
        if isinstance(value, float):
            print(f"{key}: {value:.2f}")
        else:
            print(f"{key}: {value}")