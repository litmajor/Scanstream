# ut_bot_v2.py
import numpy as np
import pandas as pd
from typing import Optional, Dict, Tuple
from dataclasses import dataclass
from enum import Enum

class Position(Enum):
    """Position states"""
    LONG = 1
    SHORT = -1
    FLAT = 0

class Signal(Enum):
    """Trading signals"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"

@dataclass
class UTBotResult:
    """Container for UT Bot results"""
    signals: np.ndarray
    trailing_stop: np.ndarray
    position: np.ndarray
    atr: np.ndarray
    stop_distance: np.ndarray
    entry_prices: Optional[np.ndarray] = None
    pnl: Optional[np.ndarray] = None


class UTBotStrategy:
    """
    UT Bot Strategy v2.0 - Advanced Trailing Stop System
    
    Features:
    - Multiple ATR calculation methods
    - Position tracking with entry/exit prices
    - P&L calculation
    - Risk management tools
    - Enhanced signal generation
    - Configurable stop loss behavior
    """
    
    def __init__(
        self,
        sensitivity: float = 1.0,
        atr_period: int = 10,
        atr_method: str = "RMA",  # RMA, SMA, EMA, WMA
        enable_exits: bool = True,
        track_pnl: bool = True
    ):
        """
        Initialize UT Bot Strategy
        
        Args:
            sensitivity: ATR multiplier for stop distance (default: 1.0)
            atr_period: Period for ATR calculation (default: 10)
            atr_method: ATR smoothing method - RMA, SMA, EMA, or WMA
            enable_exits: Generate explicit exit signals
            track_pnl: Calculate profit and loss
        """
        self.sensitivity = sensitivity
        self.atr_period = atr_period
        self.atr_method = atr_method.upper()
        self.enable_exits = enable_exits
        self.track_pnl = track_pnl
        
        # State variables
        self.trailing_stop = None
        self.position = None
        self.last_result = None
        
        # Validate ATR method
        valid_methods = ["RMA", "SMA", "EMA", "WMA"]
        if self.atr_method not in valid_methods:
            raise ValueError(f"atr_method must be one of {valid_methods}")

    def _compute_true_range(self, df: pd.DataFrame) -> pd.Series:
        """Calculate True Range"""
        high = df['high']
        low = df['low']
        close_prev = df['close'].shift(1)
        
        tr = pd.concat([
            high - low,
            abs(high - close_prev),
            abs(low - close_prev)
        ], axis=1).max(axis=1)
        
        return tr

    def _compute_atr(self, df: pd.DataFrame) -> pd.Series:
        """Calculate ATR using specified method"""
        tr = self._compute_true_range(df)
        
        if self.atr_method == "RMA":
            # Wilder's smoothing (RMA)
            atr = tr.ewm(alpha=1/self.atr_period, adjust=False).mean()
        elif self.atr_method == "SMA":
            atr = tr.rolling(self.atr_period).mean()
        elif self.atr_method == "EMA":
            atr = tr.ewm(span=self.atr_period, adjust=False).mean()
        elif self.atr_method == "WMA":
            weights = np.arange(1, self.atr_period + 1)
            atr = tr.rolling(self.atr_period).apply(
                lambda x: np.sum(weights * x) / weights.sum(), raw=True
            )
        
        return atr

    def _update_trailing_stop(
        self,
        i: int,
        src: pd.Series,
        prev_stop: float,
        n_loss: float
    ) -> float:
        """Update trailing stop logic"""
        curr_price = src.iloc[i]
        prev_price = src.iloc[i-1]
        
        # Price above stop (uptrend)
        if curr_price > prev_stop and prev_price > prev_stop:
            return max(prev_stop, curr_price - n_loss)
        
        # Price below stop (downtrend)
        elif curr_price < prev_stop and prev_price < prev_stop:
            return min(prev_stop, curr_price + n_loss)
        
        # Crossover to uptrend
        elif curr_price > prev_stop:
            return curr_price - n_loss
        
        # Crossover to downtrend
        else:
            return curr_price + n_loss

    def _calculate_pnl(
        self,
        df: pd.DataFrame,
        signals: np.ndarray,
        entry_prices: np.ndarray
    ) -> np.ndarray:
        """Calculate cumulative P&L"""
        pnl = np.zeros(len(df))
        close = df['close'].values
        
        for i in range(1, len(df)):
            if entry_prices[i] > 0:  # In position
                if signals[i-1] in [Signal.BUY.value, Signal.HOLD.value]:
                    # Long position P&L
                    pnl[i] = ((close[i] - entry_prices[i]) / entry_prices[i]) * 100
                elif signals[i-1] in [Signal.SELL.value]:
                    # Short position P&L
                    pnl[i] = ((entry_prices[i] - close[i]) / entry_prices[i]) * 100
        
        return pnl

    def evaluate(self, df: pd.DataFrame) -> UTBotResult:
        """
        Evaluate UT Bot signals
        
        Args:
            df: DataFrame with columns ['high', 'low', 'close']
            
        Returns:
            UTBotResult object with signals and analytics
        """
        # Validate input
        required_cols = ['high', 'low', 'close']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"DataFrame must contain columns: {required_cols}")
        
        n = len(df)
        src = df['close']
        atr = self._compute_atr(df)
        
        # Initialize arrays
        signals = np.full(n, Signal.HOLD.value, dtype=object)
        trailing_stop = np.zeros(n)
        position = np.zeros(n)
        stop_distance = np.zeros(n)
        entry_prices = np.zeros(n) if self.track_pnl else None
        
        # First valid index
        first_valid = self.atr_period
        trailing_stop[0] = src.iloc[0]
        
        # Main loop
        for i in range(1, n):
            if i < first_valid or pd.isna(atr.iloc[i]):
                trailing_stop[i] = trailing_stop[i-1]
                position[i] = 0
                signals[i] = Signal.HOLD.value
                continue
            
            prev_stop = trailing_stop[i-1]
            n_loss = self.sensitivity * atr.iloc[i]
            stop_distance[i] = n_loss
            
            # Update trailing stop
            trailing_stop[i] = self._update_trailing_stop(
                i, src, prev_stop, n_loss
            )
            
            # Generate signals
            prev_price = src.iloc[i-1]
            curr_price = src.iloc[i]
            
            # Bullish crossover
            if prev_price < prev_stop and curr_price > trailing_stop[i]:
                position[i] = Position.LONG.value
                signals[i] = Signal.BUY.value
                if self.track_pnl:
                    entry_prices[i] = curr_price
            
            # Bearish crossover
            elif prev_price > prev_stop and curr_price < trailing_stop[i]:
                # Exit long if enabled
                if self.enable_exits and position[i-1] == Position.LONG.value:
                    signals[i] = Signal.EXIT_LONG.value
                else:
                    signals[i] = Signal.SELL.value
                
                position[i] = Position.SHORT.value
                if self.track_pnl:
                    entry_prices[i] = curr_price
            
            # Hold position
            else:
                position[i] = position[i-1]
                signals[i] = Signal.HOLD.value
                if self.track_pnl and position[i] != 0:
                    entry_prices[i] = entry_prices[i-1]
        
        # Calculate P&L if enabled
        pnl = None
        if self.track_pnl and entry_prices is not None:
            pnl = self._calculate_pnl(df, signals, entry_prices)
        
        # Store state
        self.trailing_stop = trailing_stop
        self.position = position
        
        # Create result
        result = UTBotResult(
            signals=signals,
            trailing_stop=trailing_stop,
            position=position,
            atr=atr.values,
            stop_distance=stop_distance,
            entry_prices=entry_prices,
            pnl=pnl
        )
        
        self.last_result = result
        return result

    def get_current_position(self) -> str:
        """Get current position state"""
        if self.position is None or len(self.position) == 0:
            return "FLAT"
        
        pos = self.position[-1]
        if pos == Position.LONG.value:
            return "LONG"
        elif pos == Position.SHORT.value:
            return "SHORT"
        return "FLAT"

    def get_statistics(self, result: Optional[UTBotResult] = None) -> Dict:
        """Calculate trading statistics"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        signals = result.signals
        buy_signals = np.sum(signals == Signal.BUY.value)
        sell_signals = np.sum(signals == Signal.SELL.value)
        
        stats = {
            'total_signals': buy_signals + sell_signals,
            'buy_signals': buy_signals,
            'sell_signals': sell_signals,
            'avg_stop_distance': np.mean(result.stop_distance[result.stop_distance > 0]),
            'current_position': self.get_current_position()
        }
        
        if result.pnl is not None:
            stats['total_pnl'] = result.pnl[-1]
            stats['max_pnl'] = np.max(result.pnl)
            stats['min_pnl'] = np.min(result.pnl)
        
        return stats

    def to_dataframe(self, result: Optional[UTBotResult] = None) -> pd.DataFrame:
        """Convert results to DataFrame"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        df = pd.DataFrame({
            'signal': result.signals,
            'trailing_stop': result.trailing_stop,
            'position': result.position,
            'atr': result.atr,
            'stop_distance': result.stop_distance
        })
        
        if result.entry_prices is not None:
            df['entry_price'] = result.entry_prices
        
        if result.pnl is not None:
            df['pnl_pct'] = result.pnl
        
        return df


# Example usage
if __name__ == "__main__":
    # Create sample data
    np.random.seed(42)
    n = 200
    
    # Simulated price data
    trend = np.cumsum(np.random.randn(n)) + 100
    volatility = np.random.uniform(1, 3, n)
    close = trend + np.random.randn(n) * volatility
    high = close + np.abs(np.random.randn(n) * volatility * 0.5)
    low = close - np.abs(np.random.randn(n) * volatility * 0.5)
    
    df = pd.DataFrame({
        'high': high,
        'low': low,
        'close': close
    })
    
    # Initialize and run UT Bot
    ut_bot = UTBotStrategy(
        sensitivity=1.5,
        atr_period=10,
        atr_method="RMA",
        enable_exits=True,
        track_pnl=True
    )
    
    result = ut_bot.evaluate(df)
    
    # Display results
    result_df = ut_bot.to_dataframe()
    print("Sample Results:")
    print(result_df.tail(10))
    
    print("\n" + "="*50)
    stats = ut_bot.get_statistics()
    print("Trading Statistics:")
    for key, value in stats.items():
        print(f"{key}: {value}")