
import asyncio
import ccxt.pro as ccxt_async  # Use ccxt.pro for async support; install with 'pip install ccxtpro'
import pandas as pd
import numpy as np
import time
import aiohttp
from datetime import datetime, timezone
import json
import os
import multiprocessing
import logging
from tqdm import tqdm
import async_timeout
from dataclasses import dataclass
from typing import Dict, List, Optional, Union
import warnings
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from collections import Counter
from pathlib import Path

# Suppress pandas future warnings
warnings.filterwarnings('ignore', category=FutureWarning)

# Technical indicators with better error handling
BollingerBands = None
average_true_range = None
StochasticOscillator = None
rsi = None
ema_indicator = None
sma_indicator = None
adx = None
on_balance_volume = None

try:
    from ta.volatility import BollingerBands, average_true_range
    from ta.momentum import StochasticOscillator, rsi
    from ta.trend import ema_indicator, sma_indicator, adx
    from ta.volume import on_balance_volume
    TA_AVAILABLE = True
except ImportError:
    TA_AVAILABLE = False
    logging.warning("'ta' library not found. Install with 'pip install ta' for full indicator support.")

# Set up enhanced logging
def setup_logging():
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    file_handler = logging.FileHandler('momentum_scanner.log')
    file_handler.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger

logger = setup_logging()

@dataclass
class TradingConfig:
    """Configuration class for trading parameters"""
    timeframes: Dict[str, str]
    backtest_periods: Dict[str, int]
    momentum_periods: Dict[str, Dict[str, Dict[str, int]]]
    signal_thresholds: Dict[str, Dict[str, Dict[str, float]]]
    trade_durations: Dict[str, int]
    rsi_period: int = 14
    macd_params: Optional[Dict[str, int]] = None
    volume_trend_thresholds: Optional[Dict[str, float]] = None
    retry_attempts: int = 3
    retry_delay: int = 2
    rate_limit_delay: float = 0.01
    max_concurrent_requests: int = 50
    circuit_breaker_threshold: int = 10
    circuit_breaker_pause: int = 60
    websocket_update_interval: int = 1
    volume_profile_bins: int = 50
    fixed_range_bars: int = 20

    def __post_init__(self):
        if self.macd_params is None:
            self.macd_params = {"fast": 12, "slow": 26, "signal": 9}
        if self.volume_trend_thresholds is None:
            self.volume_trend_thresholds = {"up": 0.05, "down": -0.05}

def get_dynamic_config() -> TradingConfig:
    """Generate dynamic configuration based on system resources"""
    cpu_count = multiprocessing.cpu_count()
    max_concurrent = min(max(20, cpu_count * 5), 100)
    return TradingConfig(
        timeframes={
            "scalping": "1m",
            "short": "5m",
            "medium": "1h",
            "daily": "1d",
            "weekly": "1w"
        },
        backtest_periods={
            "scalping": 100,
            "short": 50,
            "medium": 24,
            "daily": 7,
            "weekly": 4
        },
        momentum_periods={
            "crypto": {
                "scalping": {"short": 10, "long": 60},
                "short": {"short": 5, "long": 20},
                "medium": {"short": 4, "long": 12},
                "daily": {"short": 7, "long": 30},
                "weekly": {"short": 4, "long": 12}
            },
            "forex": {
                "scalping": {"short": 20, "long": 120},
                "short": {"short": 10, "long": 50},
                "medium": {"short": 6, "long": 24},
                "daily": {"short": 5, "long": 20},
                "weekly": {"short": 3, "long": 10}
            }
        },
        signal_thresholds={
            "crypto": {
                "scalping": {"momentum_short": 0.01, "rsi_min": 55, "rsi_max": 70, "macd_min": 0},
                "short": {"momentum_short": 0.03, "rsi_min": 52, "rsi_max": 68, "macd_min": 0},
                "medium": {"momentum_short": 0.05, "rsi_min": 50, "rsi_max": 65, "macd_min": 0},
                "daily": {"momentum_short": 0.06, "rsi_min": 50, "rsi_max": 65, "macd_min": 0},
                "weekly": {"momentum_short": 0.15, "rsi_min": 45, "rsi_max": 70, "macd_min": 0}
            },
            "forex": {
                "scalping": {"momentum_short": 0.002, "rsi_min": 50, "rsi_max": 70, "macd_min": 0},
                "short": {"momentum_short": 0.005, "rsi_min": 48, "rsi_max": 68, "macd_min": 0},
                "medium": {"momentum_short": 0.008, "rsi_min": 47, "rsi_max": 67, "macd_min": 0},
                "daily": {"momentum_short": 0.01, "rsi_min": 45, "rsi_max": 65, "macd_min": 0},
                "weekly": {"momentum_short": 0.03, "rsi_min": 40, "rsi_max": 70, "macd_min": 0}
            }
        },
        trade_durations={
            "scalping": 1800,
            "short": 14400,
            "medium": 86400,
            "daily": 604800,
            "weekly": 2592000
        },
        max_concurrent_requests=max_concurrent
    )
    
    
class PortfolioSimulator:
    """
    Simulates live portfolio equity curve, position breakdown, daily balance, CSV export, and plotting.
    """
    def __init__(self, initial_capital=10000):
        self.equity_curve = []
        self.daily_balance = []
        self.open_positions = {}
        self.trade_log = []
        self.initial_capital = initial_capital
        self.current_balance = initial_capital
        self.max_drawdown = 0.0
        self.max_balance = initial_capital
        self.trade_id = 0

    def open_position(self, symbol, action, size, price, stop, tp, date):
        self.trade_id += 1
        self.open_positions[symbol] = {
            'entry': price,
            'size': size,
            'stop': stop,
            'tp': tp,
            'action': action,
            'trade_id': self.trade_id,
            'date': date,
            'pnl': 0.0
        }
        self.trade_log.append({
            'date': date,
            'equity': self.current_balance,
            'trade_id': self.trade_id,
            'symbol': symbol,
            'action': action,
            'size': size,
            'price': price,
            'pnl': 0.0
        })

    def close_position(self, symbol, exit_price, date, reason):
        if symbol in self.open_positions:
            pos = self.open_positions[symbol]
            pnl = (exit_price - pos['entry']) * pos['size'] if pos['action'] == 'buy' else (pos['entry'] - exit_price) * pos['size']
            self.current_balance += pnl
            self.max_balance = max(self.max_balance, self.current_balance)
            drawdown = (self.max_balance - self.current_balance) / self.max_balance
            self.max_drawdown = max(self.max_drawdown, drawdown)
            self.equity_curve.append(self.current_balance)
            self.daily_balance.append(self.current_balance)
            self.trade_log.append({
                'date': date,
                'equity': self.current_balance,
                'trade_id': pos['trade_id'],
                'symbol': symbol,
                'action': reason,
                'size': pos['size'],
                'price': exit_price,
                'pnl': pnl
            })
            del self.open_positions[symbol]

    def update_daily(self, date):
        self.equity_curve.append(self.current_balance)
        self.daily_balance.append(self.current_balance)
        self.trade_log.append({
            'date': date,
            'equity': self.current_balance,
            'trade_id': None,
            'symbol': None,
            'action': 'daily_update',
            'size': None,
            'price': None,
            'pnl': None
        })

    def export_csv(self, filename='portfolio_equity.csv'):
        import csv
        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['date', 'equity', 'trade_id', 'symbol', 'action', 'size', 'price', 'pnl'])
            writer.writeheader()
            for row in self.trade_log:
                writer.writerow(row)

    def plot_equity(self):
        import matplotlib.pyplot as plt
        eq = self.equity_curve
        plt.figure(figsize=(12,6))
        plt.plot(eq, label='Portfolio Equity', color='blue')
        drawdowns = [self.max_drawdown * e for e in eq]
        plt.scatter(range(len(eq)), drawdowns, color='red', label='Drawdown', s=10)
        plt.title('Portfolio Equity Curve')
        plt.xlabel('Time')
        plt.ylabel('Equity')
        plt.legend()
        plt.tight_layout()
        plt.show()
from abc import ABC, abstractmethod
# OptimizableAgent interface
class OptimizableAgent(ABC):
    @abstractmethod
    def get_hyperparameters(self) -> dict:
        pass

    @abstractmethod
    def set_hyperparameters(self, params: dict) -> None:
        pass

    @abstractmethod
    def validate_params(self, params: dict) -> bool:
        pass

    @abstractmethod
    def evaluate(self) -> float:
        pass

class TechnicalIndicators:
    @staticmethod
    def detect_market_regime(df: pd.DataFrame) -> Dict[str, any]:
        """
        Detect current market regime: Bull, Bear, Sideways/Ranging
        
        Returns dict with:
            - regime: 'bull' | 'bear' | 'ranging'
            - confidence: 0-100 (how confident in the classification)
            - trend_strength: 0-100 (strength of trend if trending)
            - volatility: 'low' | 'medium' | 'high'
            - suggested_opportunity_threshold: adjusted threshold based on regime
        """
        # Calculate multiple timeframe EMAs
        ema_20 = df['close'].ewm(span=20, adjust=False).mean()
        ema_50 = df['close'].ewm(span=50, adjust=False).mean()
        ema_200 = df['close'].ewm(span=200, adjust=False).mean() if len(df) >= 200 else ema_50
        
        current_price = df['close'].iloc[-1]
        
        # Trend direction indicators
        above_ema20 = current_price > ema_20.iloc[-1]
        above_ema50 = current_price > ema_50.iloc[-1]
        above_ema200 = current_price > ema_200.iloc[-1]
        ema20_above_50 = ema_20.iloc[-1] > ema_50.iloc[-1]
        ema50_above_200 = ema_50.iloc[-1] > ema_200.iloc[-1]
        
        # ADX for trend strength (if available)
        if 'adx' in df and pd.notna(df['adx'].iloc[-1]):
            adx = df['adx'].iloc[-1]
        else:
            # Fallback: calculate simple ADX-like metric
            high_low = df['high'] - df['low']
            adx = high_low.tail(14).mean() / df['close'].iloc[-1] * 100
        
        # Volatility (ATR-based)
        if 'atr' in df and pd.notna(df['atr'].iloc[-1]):
            atr = df['atr'].iloc[-1]
            atr_pct = (atr / current_price) * 100
        else:
            high_low = df['high'] - df['low']
            atr = high_low.tail(14).mean()
            atr_pct = (atr / current_price) * 100
        
        # Price trend over different periods
        returns_20 = (df['close'].iloc[-1] / df['close'].iloc[-20] - 1) * 100 if len(df) >= 20 else 0
        returns_50 = (df['close'].iloc[-1] / df['close'].iloc[-50] - 1) * 100 if len(df) >= 50 else 0
        
        # Determine regime
        bull_signals = sum([above_ema20, above_ema50, above_ema200, ema20_above_50, ema50_above_200])
        bear_signals = sum([not above_ema20, not above_ema50, not above_ema200, not ema20_above_50, not ema50_above_200])
        
        # Ranging detection: price oscillating around EMAs with low ADX
        price_volatility = df['close'].tail(20).std() / df['close'].tail(20).mean() * 100
        
        # Classification logic
        if adx < 20 and price_volatility < 3:
            # Low trend strength + low volatility = ranging
            regime = 'ranging'
            confidence = min(100, (20 - adx) * 5 + (3 - price_volatility) * 10)
            trend_strength = adx
        elif bull_signals >= 4:
            regime = 'bull'
            confidence = min(100, bull_signals * 20 + (returns_20 if returns_20 > 0 else 0))
            trend_strength = adx
        elif bear_signals >= 4:
            regime = 'bear'
            confidence = min(100, bear_signals * 20 + (abs(returns_20) if returns_20 < 0 else 0))
            trend_strength = adx
        elif bull_signals > bear_signals:
            regime = 'bull'
            confidence = min(80, bull_signals * 15)
            trend_strength = adx
        elif bear_signals > bull_signals:
            regime = 'bear'
            confidence = min(80, bear_signals * 15)
            trend_strength = adx
        else:
            regime = 'ranging'
            confidence = 50
            trend_strength = adx
        
        # Volatility classification
        if atr_pct < 1.5:
            volatility = 'low'
        elif atr_pct < 3.5:
            volatility = 'medium'
        else:
            volatility = 'high'
        
        # Adjust opportunity thresholds based on regime
        # In bull markets: slightly lower threshold (easier to find good longs)
        # In bear markets: higher threshold (harder to find good longs)
        # In ranging: much higher threshold (wait for breakouts)
        if regime == 'bull':
            opportunity_threshold = 60  # Lower bar in bull market
        elif regime == 'bear':
            opportunity_threshold = 75  # Higher bar in bear market
        else:  # ranging
            opportunity_threshold = 80  # Very high bar in ranging market
        
        return {
            'regime': regime,
            'confidence': round(confidence, 1),
            'trend_strength': round(trend_strength, 1),
            'volatility': volatility,
            'atr_pct': round(atr_pct, 2),
            'suggested_opportunity_threshold': opportunity_threshold,
            'ema_alignment': {
                'price_above_20': above_ema20,
                'price_above_50': above_ema50,
                'price_above_200': above_ema200,
                'ema20_above_50': ema20_above_50,
                'ema50_above_200': ema50_above_200
            },
            'returns': {
                '20d': round(returns_20, 2),
                '50d': round(returns_50, 2)
            }
        }

    @staticmethod
    def fib_levels(df: pd.DataFrame,
                   lookback: int = 55,
                   mode: str = "swing") -> dict:
        """
        Returns dict with:
            retracements: 0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0
            extensions:   1.272, 1.618, 2.0
            direction:    'bull' | 'bear'
            swing_high, swing_low
        """
        if len(df) < lookback:
            return {}

        highs = df['high'].iloc[-lookback:]
        lows  = df['low'].iloc[-lookback:]

        # Swing detection
        swing_high_idx = highs.idxmax()
        swing_low_idx  = lows.idxmin()

        swing_high = highs.loc[swing_high_idx]
        swing_low  = lows.loc[swing_low_idx]

        # Determine if last swing is up or down
        if swing_high_idx > swing_low_idx:
            direction = "bull"  # retracement from high
            base, top = swing_low, swing_high
        else:
            direction = "bear"  # retracement from low
            base, top = swing_high, swing_low

        diff = abs(top - base)
        retracements = {
            0.0:   top,
            0.236: top - 0.236 * diff,
            0.382: top - 0.382 * diff,
            0.5:   top - 0.5  * diff,
            0.618: top - 0.618 * diff,
            0.786: top - 0.786 * diff,
            1.0:   base,
        }
        extensions = {
            1.272: top + 0.272 * diff if direction == "bull" else base - 0.272 * diff,
            1.618: top + 0.618 * diff if direction == "bull" else base - 0.618 * diff,
            2.0:   top + 1.0   * diff if direction == "bull" else base - 1.0   * diff,
        }

        # current price vs nearest fib
        current = df['close'].iloc[-1]
        nearest_r = min(retracements.values(), key=lambda x: abs(x - current))
        nearest_e = min(extensions.values(),   key=lambda x: abs(x - current))

        return {
            "direction": direction,
            "swing_high": swing_high,
            "swing_low": swing_low,
            "retracements": retracements,
            "extensions": extensions,
            "nearest_retracement": nearest_r,
            "nearest_extension": nearest_e,
            "distance_to_nearest_r": (current - nearest_r) / current,
            "distance_to_nearest_e": (current - nearest_e) / current,
        }

    @staticmethod
    def fib_confluence_score(fib_dict: dict,
                             poc: float,
                             vwap: float,
                             tolerance: float = 0.005) -> float:
        """
        0–100 score: 100 = price sits on fib + poc + vwap within tolerance
        """
        if not fib_dict:
            return 0.0

        current = fib_dict["retracements"][0.0] - fib_dict["distance_to_nearest_r"] * fib_dict["retracements"][0.0]
        confluence = 0
        for level in list(fib_dict["retracements"].values()) + list(fib_dict["extensions"].values()):
            if abs(current - level) / current < tolerance:
                confluence += 20
        if abs(current - poc)  / current < tolerance:
            confluence += 20
        if abs(current - vwap) / current < tolerance:
            confluence += 20
        return min(100, confluence)
    """Class to handle all technical indicator calculations"""
    
    @staticmethod
    def calculate_rsi(prices: pd.Series, period: int = 14) -> float:
        if TA_AVAILABLE and callable(rsi):
            try:
                rsi_result = rsi(prices, window=period)
                rsi_series = pd.Series(rsi_result)
                return rsi_series.iloc[-1]
            except Exception as e:
                logger.warning(f"Error using ta.momentum.rsi: {e}")
        delta = prices.diff().astype(float)
        gain = np.where(delta > 0, delta, 0)
        loss = np.where(delta < 0, -delta, 0)
        avg_gain = pd.Series(gain).rolling(window=period).mean().iloc[-1]
        avg_loss = pd.Series(loss).rolling(window=period).mean().iloc[-1]
        if avg_loss == 0:
            return 100
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    
    @staticmethod
    def calculate_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> float:
        ema_fast = prices.ewm(span=fast, adjust=False).mean()
        ema_slow = prices.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        return macd_line.iloc[-1] - signal_line.iloc[-1]
    
    @staticmethod
    def calculate_momentum(prices: pd.Series, period: int) -> float:
        return prices.pct_change(periods=period).iloc[-1]
    
    @staticmethod
    def calculate_ichimoku(df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 26:
            return df.assign(tenkan_sen=None, kijun_sen=None, senkou_a=None, senkou_b=None, cloud_green=None)
        high = df['high']
        low = df['low']
        close = df['close']
        tenkan_sen = (high.rolling(9).max() + low.rolling(9).min()) / 2
        kijun_sen = (high.rolling(26).max() + low.rolling(26).min()) / 2
        senkou_a = ((tenkan_sen + kijun_sen) / 2).shift(26)
        senkou_b = (high.rolling(52).max() + low.rolling(52).min()) / 2
        senkou_b = senkou_b.shift(26)
        cloud_green = (senkou_a > senkou_b).astype(int)
        return df.assign(
            tenkan_sen=tenkan_sen,
            kijun_sen=kijun_sen,
            senkou_a=senkou_a,
            senkou_b=senkou_b,
            cloud_green=cloud_green
        )

    @staticmethod
    def calculate_vwap(df: pd.DataFrame) -> pd.Series:
        if len(df) < 2:
            return pd.Series([None] * len(df), index=df.index)
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        vwap = (typical_price * df['volume']).cumsum() / df['volume'].cumsum()
        return vwap

    @staticmethod
    def rsi_bearish_divergence(df: pd.DataFrame, lookback: int = 10) -> bool:
        if len(df) < lookback + 2 or 'rsi' not in df:
            return False
        price = df['close']
        rsi = df['rsi']
        return (price.iloc[-1] > price.iloc[-lookback]) and (rsi.iloc[-1] < rsi.iloc[-lookback])

    @staticmethod
    def calculate_volume_profile(df: pd.DataFrame, bins: int = 50) -> tuple:
        """Calculate volume profile and Point of Control (POC)"""
        if len(df) < 2 or 'volume' not in df or 'close' not in df:
            return None, None
        price = df['close']
        volume = df['volume']
        price_bins = np.linspace(price.min(), price.max(), bins)
        volume_hist, bin_edges = np.histogram(price, bins=price_bins, weights=volume)
        poc_index = np.argmax(volume_hist)
        poc_price = (bin_edges[poc_index] + bin_edges[poc_index + 1]) / 2
        return volume_hist, poc_price

    @staticmethod
    def calculate_anchored_volume_profile(df: pd.DataFrame, anchor_index: int, bins: int = 50) -> tuple:
        """Calculate anchored volume profile from a specific index"""
        if len(df) < anchor_index + 2 or 'volume' not in df or 'close' not in df:
            return None, None
        df_anchored = df.iloc[anchor_index:]
        # Ensure df_anchored is a DataFrame, not a Series
        if isinstance(df_anchored, pd.Series):
            df_anchored = df_anchored.to_frame().T
        return TechnicalIndicators.calculate_volume_profile(df_anchored, bins)

    @staticmethod
    def calculate_fixed_range_volume_profile(df: pd.DataFrame, price_range: float, bins: int = 50) -> tuple:
        """Calculate volume profile within a fixed price range"""
        if len(df) < 2 or 'volume' not in df or 'close' not in df:
            return None, None
        price = df['close']
        price_min = price.iloc[-1] - price_range / 2
        price_max = price.iloc[-1] + price_range / 2
        df_range = df[(price >= price_min) & (price <= price_max)]
        return TechnicalIndicators.calculate_volume_profile(df_range, bins)

    @staticmethod
    def calculate_opportunity_score(
        momentum_short: float,
        momentum_long: float,
        rsi: float,
        macd: float,
        bb_position: Optional[float],
        trend_score: float,
        volume_ratio: float,
        stoch_k: Optional[float] = None,
        rsi_bearish_div: bool = False
    ) -> float:
        """
        Calculate opportunity score that identifies the BEST entry points, not just momentum.
        Penalizes overbought/oversold conditions and rewards pullbacks in trends.
        
        Returns a score from 0-100 where higher means better opportunity.
        """
        # 1. RSI Opportunity Score (favor 30-50 for longs, 50-70 for shorts)
        # Penalize extreme overbought (>70) and oversold (<30)
        if rsi < 30:
            rsi_opp = 0.3  # Oversold - risky catching falling knife
        elif 30 <= rsi < 45:
            rsi_opp = 1.0  # Sweet spot - pullback in uptrend
        elif 45 <= rsi < 55:
            rsi_opp = 0.8  # Neutral - okay
        elif 55 <= rsi < 70:
            rsi_opp = 0.5  # Getting extended
        else:  # rsi >= 70
            rsi_opp = 0.2  # Overbought - poor entry point
        
        # 2. Bollinger Band Position Score (favor lower BB positions for longs)
        if bb_position is not None:
            if bb_position < 0.3:
                bb_opp = 1.0  # Near lower band - good entry for reversal
            elif 0.3 <= bb_position < 0.5:
                bb_opp = 0.9  # Below midline - good
            elif 0.5 <= bb_position < 0.7:
                bb_opp = 0.6  # Above midline - okay
            else:  # bb_position >= 0.7
                bb_opp = 0.2  # Near upper band - overbought
        else:
            bb_opp = 0.5  # No BB data
        
        # 3. Stochastic Opportunity (favor oversold stoch with bullish trend)
        if stoch_k is not None:
            if stoch_k < 20:
                stoch_opp = 1.0 if momentum_long > 0 else 0.3  # Oversold in uptrend = buy
            elif 20 <= stoch_k < 40:
                stoch_opp = 0.9
            elif 40 <= stoch_k < 60:
                stoch_opp = 0.7
            elif 60 <= stoch_k < 80:
                stoch_opp = 0.4
            else:  # stoch_k >= 80
                stoch_opp = 0.1  # Overbought
        else:
            stoch_opp = 0.5
        
        # 4. Momentum Context (positive long-term, moderate short-term = pullback)
        if momentum_long > 0.001:  # Uptrend
            if -0.005 < momentum_short < 0.002:  # Slight pullback or consolidation
                momentum_opp = 1.0  # Perfect - pullback in uptrend
            elif momentum_short > 0.005:  # Strong short-term momentum
                momentum_opp = 0.4  # Already running hot
            else:
                momentum_opp = 0.6
        elif momentum_long < -0.001:  # Downtrend
            if -0.002 < momentum_short < 0.005:  # Slight bounce
                momentum_opp = 1.0  # Good short opportunity
            else:
                momentum_opp = 0.5
        else:  # Flat
            momentum_opp = 0.5
        
        # 5. Divergence Penalty (bearish divergence = bad for longs)
        divergence_penalty = 0.5 if rsi_bearish_div else 1.0
        
        # 6. Volume Context (high volume on pullbacks = accumulation)
        if volume_ratio > 1.5:
            vol_opp = 1.0 if rsi < 55 else 0.3  # High vol + not overbought = good
        elif volume_ratio > 1.2:
            vol_opp = 0.8
        elif volume_ratio > 0.8:
            vol_opp = 0.6
        else:
            vol_opp = 0.4  # Low volume = lack of conviction
        
        # 7. Trend Quality (strong trend = better context for pullbacks)
        trend_opp = min(max(trend_score / 10, 0), 1)
        
        # 8. MACD Opportunity (slight negative MACD in uptrend = pullback)
        if momentum_long > 0 and -0.5 < macd < 0:
            macd_opp = 1.0  # Pullback in uptrend
        elif macd > 0:
            macd_opp = 0.7 if macd < 2 else 0.3  # Moderate positive vs. overextended
        else:
            macd_opp = 0.5
        
        # Weighted combination emphasizing key opportunity factors
        opportunity = (
            rsi_opp * 0.25 +           # RSI is critical for overbought/oversold
            bb_opp * 0.20 +             # BB position shows value
            stoch_opp * 0.15 +          # Stochastic confirms
            momentum_opp * 0.15 +       # Pullback detection
            vol_opp * 0.10 +            # Volume confirmation
            trend_opp * 0.10 +          # Trend quality
            macd_opp * 0.05             # MACD context
        ) * divergence_penalty
        
        return round(opportunity * 100, 2)

    @staticmethod
    def calculate_composite_score(
        momentum_short: float,
        momentum_long: float,
        rsi: float,
        macd: float,
        trend_score: float,
        volume_ratio: float,
        ichimoku_bullish: bool,
        fib_confluence: float = 0.0,
        weights: Optional[Dict[str, float]] = None
    ) -> float:
        """Calculate a composite score combining multiple indicators, including optional fib_confluence."""
        weights = weights or {
            'momentum_short': 0.2,
            'momentum_long': 0.15,
            'rsi': 0.2,
            'macd': 0.15,
            'trend_score': 0.2,
            'volume_ratio': 0.1,
            'ichimoku': 0.1,
            'fib_confluence': 0.15
        }
        mom_short_score = min(max(abs(momentum_short) * 1000, 0), 1)
        mom_long_score = min(max(abs(momentum_long) * 500, 0), 1)
        rsi_score = min(max((rsi - 50) / 30, 0), 1) if rsi >= 50 else min(max((50 - rsi) / 30, 0), 1)
        macd_score = min(max(abs(macd) * 50, 0), 1)
        trend_score_norm = min(max(trend_score / 10, 0), 1)
        vol_score = min(max((volume_ratio - 1) / 1.5, 0), 1)
        ichimoku_score = 1.0 if ichimoku_bullish else 0.0
        fib_score = min(max(fib_confluence / 100, 0), 1)
        score = (
            mom_short_score * weights['momentum_short'] +
            mom_long_score * weights['momentum_long'] +
            rsi_score * weights['rsi'] +
            macd_score * weights['macd'] +
            trend_score_norm * weights['trend_score'] +
            vol_score * weights['volume_ratio'] +
            ichimoku_score * weights['ichimoku'] +
            fib_score * weights.get('fib_confluence', 0.15)
        )
        return round(score * 100, 2)

    @staticmethod
    def calculate_volume_composite_score(
        volume_ratio: float,
        volume_hist: np.ndarray,
        poc_distance: float,
        weights: Optional[Dict[str, float]] = None
    ) -> float:
        """Calculate a volume-weighted composite score"""
        weights = weights or {
            'volume_ratio': 0.5,
            'volume_hist_max': 0.3,
            'poc_distance': 0.2
        }
        vol_ratio_score = min(max((volume_ratio - 1) / 1.5, 0), 1)
        vol_hist_score = min(max(np.max(volume_hist) / np.sum(volume_hist) if volume_hist is not None else 0, 0), 1)
        poc_dist_score = min(max(1 - abs(poc_distance) / 0.05, 0), 1)
        score = (
            vol_ratio_score * weights['volume_ratio'] +
            vol_hist_score * weights['volume_hist_max'] +
            poc_dist_score * weights['poc_distance']
        )
        return round(score * 100, 2)

    @staticmethod
    def calculate_stop_loss_take_profit(
        current_price: float,
        df: pd.DataFrame,
        signal: str,
        atr: Optional[float] = None,
        bb_lower: Optional[float] = None,
        bb_upper: Optional[float] = None,
        support_level: Optional[float] = None,
        resistance_level: Optional[float] = None,
        risk_reward_ratio: float = 2.5
    ) -> Dict[str, float]:
        """
        Calculate optimal stop-loss and take-profit levels based on multiple methods.
        
        Returns a dict with entry, stop_loss, take_profit, risk_amount, reward_amount, and risk_reward_ratio
        """
        # Calculate ATR if not provided
        if atr is None and 'atr' in df:
            atr = df['atr'].iloc[-1]
        elif atr is None:
            # Fallback: calculate simple ATR from last 14 periods
            high_low = df['high'] - df['low']
            atr = high_low.tail(14).mean() if len(df) >= 14 else high_low.mean()
        
        # Calculate recent swing high/low (last 20 periods)
        recent_data = df.tail(20) if len(df) >= 20 else df
        swing_low = recent_data['low'].min()
        swing_high = recent_data['high'].max()
        
        # Determine support and resistance if not provided
        if support_level is None:
            # Use swing low or Bollinger lower band as support
            support_level = bb_lower if bb_lower is not None else swing_low
        
        if resistance_level is None:
            # Use swing high or Bollinger upper band as resistance
            resistance_level = bb_upper if bb_upper is not None else swing_high
        
        # Calculate stop-loss and take-profit based on signal direction
        if signal in ['Strong Buy', 'Buy', 'Weak Buy']:
            # LONG POSITION
            # Stop Loss Methods:
            # 1. ATR-based: 1.5-2x ATR below entry
            # 2. Support-based: Just below recent support
            # 3. Percentage-based: 2-3% below entry
            
            atr_stop = current_price - (atr * 1.5)
            support_stop = support_level * 0.995  # 0.5% below support
            percentage_stop = current_price * 0.97  # 3% stop
            
            # Use the tightest reasonable stop (but not too tight)
            stop_loss_candidates = [atr_stop, support_stop, percentage_stop]
            # Filter out stops that are too close (< 0.5%) or too far (> 8%)
            valid_stops = [
                s for s in stop_loss_candidates 
                if 0.005 < (current_price - s) / current_price < 0.08
            ]
            stop_loss = max(valid_stops) if valid_stops else atr_stop
            
            # Take Profit: Based on risk/reward ratio and resistance
            risk_amount = current_price - stop_loss
            reward_by_rr = current_price + (risk_amount * risk_reward_ratio)
            
            # Consider resistance as a take-profit zone
            resistance_tp = resistance_level * 0.995  # Slightly before resistance
            
            # Use closer of RR-based or resistance-based TP
            if resistance_tp > current_price and resistance_tp < reward_by_rr:
                take_profit = resistance_tp
                actual_rr = (take_profit - current_price) / risk_amount
            else:
                take_profit = reward_by_rr
                actual_rr = risk_reward_ratio
        
        elif signal in ['Strong Sell', 'Sell', 'Weak Sell']:
            # SHORT POSITION
            atr_stop = current_price + (atr * 1.5)
            resistance_stop = resistance_level * 1.005  # 0.5% above resistance
            percentage_stop = current_price * 1.03  # 3% stop
            
            stop_loss_candidates = [atr_stop, resistance_stop, percentage_stop]
            valid_stops = [
                s for s in stop_loss_candidates 
                if 0.005 < (s - current_price) / current_price < 0.08
            ]
            stop_loss = min(valid_stops) if valid_stops else atr_stop
            
            risk_amount = stop_loss - current_price
            reward_by_rr = current_price - (risk_amount * risk_reward_ratio)
            
            support_tp = support_level * 1.005  # Slightly above support
            
            if support_tp < current_price and support_tp > reward_by_rr:
                take_profit = support_tp
                actual_rr = (current_price - take_profit) / risk_amount
            else:
                take_profit = reward_by_rr
                actual_rr = risk_reward_ratio
        
        else:
            # NEUTRAL - provide conservative levels
            stop_loss = current_price * 0.97
            take_profit = current_price * 1.03
            risk_amount = current_price - stop_loss
            actual_rr = (take_profit - current_price) / risk_amount if risk_amount > 0 else 0
        
        return {
            'entry_price': round(current_price, 8),
            'stop_loss': round(stop_loss, 8),
            'take_profit': round(take_profit, 8),
            'risk_amount': round(abs(current_price - stop_loss), 8),
            'reward_amount': round(abs(take_profit - current_price), 8),
            'risk_reward_ratio': round(actual_rr, 2),
            'stop_loss_pct': round(((stop_loss - current_price) / current_price) * 100, 2),
            'take_profit_pct': round(((take_profit - current_price) / current_price) * 100, 2),
            'support_level': round(support_level, 8) if support_level else None,
            'resistance_level': round(resistance_level, 8) if resistance_level else None
        }

    @staticmethod
    def calculate_position_size(
        account_balance: float,
        risk_per_trade_pct: float,
        entry_price: float,
        stop_loss: float,
        leverage: float = 1.0,
        fee_rate: float = 0.001
    ) -> Dict[str, float]:
        """
        Calculate optimal position size based on account size and risk management.
        
        Args:
            account_balance: Total account balance in USD
            risk_per_trade_pct: Percentage of account to risk (e.g., 2 for 2%)
            entry_price: Planned entry price
            stop_loss: Stop-loss price
            leverage: Leverage to use (default 1 = no leverage)
            fee_rate: Trading fee rate (default 0.1%)
        
        Returns:
            Dict with position_size, units, risk_amount, position_value, and more
        """
        # Calculate risk amount in USD
        risk_amount_usd = account_balance * (risk_per_trade_pct / 100)
        
        # Calculate stop distance as percentage
        stop_distance_pct = abs((entry_price - stop_loss) / entry_price)
        
        # Calculate position size without leverage
        # Risk Amount = Position Size × Stop Distance %
        # Position Size = Risk Amount / Stop Distance %
        base_position_size = risk_amount_usd / stop_distance_pct
        
        # Apply leverage
        position_value = base_position_size * leverage
        
        # Calculate number of units/coins
        units = position_value / entry_price
        
        # Calculate fees (entry + exit)
        entry_fee = position_value * fee_rate
        exit_fee = position_value * fee_rate
        total_fees = entry_fee + exit_fee
        
        # Adjust for fees
        adjusted_risk = risk_amount_usd - total_fees
        adjusted_position_value = max(0, position_value - total_fees)
        
        # Calculate margin required (for leveraged positions)
        margin_required = position_value / leverage
        
        # Calculate liquidation price (approximate, for leveraged positions)
        if leverage > 1:
            # Simplified liquidation calc: Entry - (Margin / Position Size)
            liquidation_buffer = margin_required * 0.9  # 90% of margin before liquidation
            liquidation_price = entry_price - (liquidation_buffer / units) if stop_loss < entry_price else entry_price + (liquidation_buffer / units)
        else:
            liquidation_price = 0  # No liquidation without leverage
        
        # Risk/Reward metrics
        stop_distance_usd = abs(entry_price - stop_loss) * units
        
        # Warnings
        warnings = []
        if margin_required > account_balance:
            warnings.append("Insufficient balance for this position")
        if margin_required > account_balance * 0.5:
            warnings.append("Position uses >50% of account (high risk)")
        if leverage > 3:
            warnings.append(f"High leverage ({leverage}x) - increased liquidation risk")
        if risk_per_trade_pct > 3:
            warnings.append(f"Risking {risk_per_trade_pct}% per trade (recommended: 1-2%)")
        if liquidation_price != 0 and ((stop_loss < entry_price and liquidation_price > stop_loss) or (stop_loss > entry_price and liquidation_price < stop_loss)):
            warnings.append("Liquidation price is beyond stop-loss - very risky!")
        
        return {
            'position_value': round(position_value, 2),
            'units': round(units, 8),
            'margin_required': round(margin_required, 2),
            'risk_amount_usd': round(risk_amount_usd, 2),
            'adjusted_risk_usd': round(adjusted_risk, 2),
            'total_fees': round(total_fees, 2),
            'stop_distance_pct': round(stop_distance_pct * 100, 2),
            'stop_distance_usd': round(stop_distance_usd, 2),
            'leverage': leverage,
            'liquidation_price': round(liquidation_price, 8) if liquidation_price > 0 else None,
            'account_balance': account_balance,
            'risk_per_trade_pct': risk_per_trade_pct,
            'margin_usage_pct': round((margin_required / account_balance) * 100, 2),
            'warnings': warnings,
            'safe_to_trade': len([w for w in warnings if 'Insufficient' in w or 'Liquidation' in w]) == 0
        }

    @staticmethod
    def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
        df = TechnicalIndicators.calculate_ichimoku(df)
        df['vwap'] = TechnicalIndicators.calculate_vwap(df)
        volume_hist, poc_price = TechnicalIndicators.calculate_volume_profile(df)
        anchor_index = df['high'].idxmax() if not df['high'].empty else 0
        # Ensure anchor_index is an int
        if not isinstance(anchor_index, int):
            try:
                anchor_index = int(anchor_index[0])
            except Exception:
                anchor_index = 0
        anchored_volume_hist, anchored_poc = TechnicalIndicators.calculate_anchored_volume_profile(df, anchor_index)
        price_range = (df['high'].max() - df['low'].min()) * 0.2 if not df.empty else 0.01
        fixed_volume_hist, fixed_poc = TechnicalIndicators.calculate_fixed_range_volume_profile(df, price_range)
        df['volume_hist'] = [volume_hist] * len(df)
        df['poc_price'] = poc_price
        df['anchored_volume_hist'] = [anchored_volume_hist] * len(df)
        df['anchored_poc'] = anchored_poc
        df['fixed_volume_hist'] = [fixed_volume_hist] * len(df)
        df['fixed_poc'] = fixed_poc
        if not TA_AVAILABLE:
            logger.warning("TA library not available, using basic indicators only")
            df['rsi'] = TechnicalIndicators.calculate_rsi(df['close'])
            df['bb_upper'] = None
            df['bb_middle'] = None
            df['bb_lower'] = None
            df['bb_width'] = None
            df['stoch_k'] = None
            df['stoch_d'] = None
            df['ema_5'] = None
            df['ema_13'] = None
            df['ema_9'] = None
            df['ema_21'] = None
            df['ema_50'] = None
            df['ema_200'] = None
            df['sma_20'] = None
            df['sma_50'] = None
            df['atr'] = None
            df['adx'] = None
            df['obv'] = None
            return df
        try:
            if BollingerBands is not None:
                bb = BollingerBands(df['close'], window=20, window_dev=2)
                df['bb_upper'] = bb.bollinger_hband()
                df['bb_middle'] = bb.bollinger_mavg()
                df['bb_lower'] = bb.bollinger_lband()
                df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
            else:
                df['bb_upper'] = None
                df['bb_middle'] = None
                df['bb_lower'] = None
                df['bb_width'] = None
            if StochasticOscillator is not None:
                stoch = StochasticOscillator(df['high'], df['low'], df['close'], window=14)
                df['stoch_k'] = stoch.stoch()
                df['stoch_d'] = stoch.stoch_signal()
            else:
                df['stoch_k'] = None
                df['stoch_d'] = None
            if ema_indicator is not None:
                df['ema_5'] = ema_indicator(df['close'], window=5)
                df['ema_13'] = ema_indicator(df['close'], window=13)
                df['ema_9'] = ema_indicator(df['close'], window=9)
                df['ema_21'] = ema_indicator(df['close'], window=21)
                df['ema_50'] = ema_indicator(df['close'], window=50)
                df['ema_200'] = ema_indicator(df['close'], window=200)
            else:
                df['ema_5'] = None
                df['ema_13'] = None
                df['ema_9'] = None
                df['ema_21'] = None
                df['ema_50'] = None
                df['ema_200'] = None
            if sma_indicator is not None:
                df['sma_20'] = sma_indicator(df['close'], window=20)
                df['sma_50'] = sma_indicator(df['close'], window=50)
            else:
                df['sma_20'] = None
                df['sma_50'] = None
            if average_true_range is not None:
                df['atr'] = average_true_range(df['high'], df['low'], df['close'], window=14)
            else:
                df['atr'] = None
            if adx is not None:
                df['adx'] = adx(df['high'], df['low'], df['close'], window=14)
            else:
                df['adx'] = None
            if on_balance_volume is not None:
                df['obv'] = on_balance_volume(df['close'], df['volume'])
            else:
                df['obv'] = None
            if rsi is not None:
                df['rsi'] = rsi(df['close'], window=14)
            else:
                df['rsi'] = TechnicalIndicators.calculate_rsi(df['close'])
        except Exception as e:
            logger.warning(f"Error calculating indicators: {e}")
        return df

    @staticmethod
    def calculate_trend_score(df: pd.DataFrame, ema_period: int = 21, adx_weight: float = 0.4, ema_weight: float = 0.4, price_weight: float = 0.2) -> float:
        if len(df) < ema_period + 2:
            return 0.0
        ema = df['close'].ewm(span=ema_period, adjust=False).mean()
        ema_slope = (ema.iloc[-1] - ema.iloc[-ema_period]) / abs(ema.iloc[-ema_period]) if ema.iloc[-ema_period] != 0 else 0
        ema_score = max(min((ema_slope * 100) / 2, 1), -1)
        ema_score = (ema_score + 1) / 2
        adx_val = df['adx'].iloc[-1] if 'adx' in df else 0
        adx_score = min(adx_val / 50, 1)
        price = df['close']
        lookback = ema_period
        if len(price) < lookback + 2:
            price_score = 0.5
        else:
            higher_high = price.iloc[-1] > price.iloc[-lookback:-1].max()
            lower_low = price.iloc[-1] < price.iloc[-lookback:-1].min()
            price_score = 1.0 if higher_high else 0.0 if lower_low else 0.5
        trend_score = (ema_score * ema_weight + adx_score * adx_weight + price_score * price_weight)
        return round(trend_score * 10, 2)

    @staticmethod
    def calculate_confidence_score(momentum_short, momentum_long, rsi, macd, trend_score, volume_ratio):
        mom_score = min(max(abs(momentum_short), 0), 0.1) / 0.1
        long_mom_score = min(max(abs(momentum_long), 0), 0.2) / 0.2
        rsi_score = min((rsi - 50) / 30, 1) if rsi >= 50 else min((50 - rsi) / 30, 1)
        macd_score = min(max(abs(macd), 0), 0.05) / 0.05
        trend_score_norm = min(max(trend_score / 10, 0), 1)
        vol_score = min((volume_ratio - 1) / 1.5, 1) if volume_ratio >= 1 else max(0, 1 + (volume_ratio - 1) / 0.8)
        score = (
            mom_score * 0.18 +
            long_mom_score * 0.12 +
            rsi_score * 0.18 +
            macd_score * 0.18 +
            trend_score_norm * 0.22 +
            vol_score * 0.12
        )
        return round(min(max(score, 0), 1), 3)

class MarketDataFetcher:
    """Handles all market data fetching operations"""
    
    def __init__(self, exchange, config: TradingConfig):
        self.exchange = exchange
        self.config = config
        self.cache = {}
        self.cache_expiry = 300
        self.semaphore = asyncio.Semaphore(config.max_concurrent_requests)
        self.rate_limit_errors = 0
    
    async def fetch_markets(self, market_type: str = 'crypto', quote_currency: str = 'USDT') -> List[str]:
        async with self.semaphore:
            for attempt in range(self.config.retry_attempts):
                try:
                    async with async_timeout.timeout(15):
                        markets = await self.exchange.load_markets()
                    valid_symbols = []
                    for symbol, market in markets.items():
                        try:
                            if self._is_valid_market(market, market_type, quote_currency):
                                valid_symbols.append(symbol)
                        except Exception as e:
                            logger.debug(f"Error evaluating market {symbol}: {e}")
                            continue
                    logger.info(f"Found {len(valid_symbols)} valid {market_type} symbols")
                    return valid_symbols
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed to fetch markets: {e}")
                    if attempt < self.config.retry_attempts - 1:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                    else:
                        logger.error("Failed to fetch markets after all retries")
                        return []
        return []
    
    def _is_valid_market(self, market: dict, market_type: str, quote_currency: str) -> bool:
        if market_type == 'crypto':
            return (
                market.get('quote', '') in ['USDT', 'USD', 'BUSD'] and
                market.get('active', False) and
                market.get('type', '') in ['spot', 'future', 'swap'] and
                not market.get('info', {}).get('isMarginTradingAllowed', False)
            )
        elif market_type == 'forex':
            major_pairs = [
                'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
                'NZD/USD', 'GBP/JPY', 'EUR/JPY', 'USD/CHF', 'EUR/GBP'
            ]
            return (
                market.get('type', '') == 'spot' and
                market.get('active', False) and
                market.get('symbol', '') in major_pairs
            )
        return False
    
    async def fetch_ohlcv(self, symbol: str, timeframe: str = '1d', limit: int = 100) -> Optional[pd.DataFrame]:
        cache_key = f"{symbol}:{timeframe}:{limit}"
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            if (time.time() - cached_data['timestamp']) < self.cache_expiry:
                return cached_data['data']
        async with self.semaphore:
            for attempt in range(self.config.retry_attempts):
                try:
                    async with async_timeout.timeout(15):
                        ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
                    if not ohlcv:
                        return None
                    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                    df.set_index('timestamp', inplace=True)
                    self.cache[cache_key] = {'data': df, 'timestamp': time.time()}
                    self.rate_limit_errors = 0
                    await asyncio.sleep(self.config.rate_limit_delay)
                    return df
                except Exception as e:
                    error_msg = str(e).lower()
                    if any(term in error_msg for term in ['rate limit', 'throttle', '429']):
                        self.rate_limit_errors += 1
                        if self.rate_limit_errors >= self.config.circuit_breaker_threshold:
                            logger.warning(f"Circuit breaker triggered for {symbol}, pausing...")
                            await asyncio.sleep(self.config.circuit_breaker_pause)
                            self.rate_limit_errors = 0
                    logger.warning(f"Attempt {attempt + 1} failed for {symbol}: {e}")
                    if attempt < self.config.retry_attempts - 1:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                    else:
                        logger.error(f"Failed to fetch data for {symbol} after all retries")
                        return None

class SignalClassifier:

    """
    Dual-purpose classifier:
      1. classify_state(...)   -> new granular regime states
      2. classify_legacy(...)  -> legacy labels with exact rules
      3. classify_momentum_signal(...) -> main buy/sell/neutral signal
    """

    @staticmethod
    def classify_momentum_signal(
        momentum_short: float,
        momentum_long: float,
        rsi: float,
        macd: float,
        thresholds: dict,
        additional_indicators: Optional[dict] = None
    ) -> str:
        """
        Classifies the main trading signal as 'Strong Buy', 'Buy', 'Weak Buy', 'Neutral', 'Weak Sell', 'Sell', or 'Strong Sell'
        based on indicator values and thresholds.
        """
        additional_indicators = additional_indicators or {}
        # Unpack thresholds
        mom_th = thresholds.get('momentum_short', 0.01)
        rsi_min = thresholds.get('rsi_min', 50)
        rsi_max = thresholds.get('rsi_max', 70)
        macd_min = thresholds.get('macd_min', 0)

        # Strong Buy
        if (
            momentum_short > mom_th * 2 and
            momentum_long > mom_th and
            rsi > rsi_min and rsi < rsi_max and
            macd > macd_min and
            additional_indicators.get('ichimoku_bullish', False)
        ):
            return "Strong Buy"
        # Buy
        if (
            momentum_short > mom_th and
            rsi > rsi_min and
            macd > 0
        ):
            return "Buy"
        # Weak Buy
        if (
            momentum_short > 0 and
            rsi > 45 and
            macd > 0
        ):
            return "Weak Buy"
        # Strong Sell
        if (
            momentum_short < -mom_th * 2 and
            momentum_long < -mom_th and
            rsi < 100 - rsi_min and rsi > 20 and
            macd < -macd_min and
            not additional_indicators.get('ichimoku_bullish', True)
        ):
            return "Strong Sell"
        # Sell
        if (
            momentum_short < -mom_th and
            rsi < 100 - rsi_min and
            macd < 0
        ):
            return "Sell"
        # Weak Sell
        if (
            momentum_short < 0 and
            rsi < 55 and
            macd < 0
        ):
            return "Weak Sell"
        # Neutral
        return "Neutral"

    # ------------------------------------------------------------------
    # 1. NEW STATE MACHINE  (granular regime states)
    # ------------------------------------------------------------------
    @staticmethod
    def classify_state(mom1d: float,
                       mom7d: float,
                       mom30d: float,
                       rsi: float,
                       macd: float,
                       bb_pos: float,
                       vol_ratio: float) -> str:
        """
        Returns one of:
          BULL_EARLY, BULL_STRONG, BULL_PARABOLIC,
          BEAR_EARLY, BEAR_STRONG, BEAR_CAPITULATION,
          NEUTRAL_ACCUM, NEUTRAL_DIST, NEUTRAL
        """
        vol_mult = max(0.5, min(2.0, vol_ratio))
        th_weak, th_med, th_strong = (
            0.015 * vol_mult,
            0.035 * vol_mult,
            0.075 * vol_mult,
        )

        breakout_up = bb_pos > 0.85 and mom1d > th_weak
        breakout_dn = bb_pos < 0.15 and mom1d < -th_weak
        thrust_up   = mom1d > th_med and mom7d > th_med
        thrust_dn   = mom1d < -th_med and mom7d < -th_med
        parabolic   = abs(mom1d) > th_strong and abs(mom7d) > th_strong

        if parabolic and mom1d > 0:
            return "BULL_PARABOLIC"
        if parabolic and mom1d < 0:
            return "BEAR_CAPITULATION"
        if thrust_up:
            return "BULL_STRONG"
        if thrust_dn:
            return "BEAR_STRONG"
        if breakout_up:
            return "BULL_EARLY"
        if breakout_dn:
            return "BEAR_EARLY"
        if -th_weak < mom7d < th_weak:
            if rsi < 35 and mom1d > 0:
                return "NEUTRAL_ACCUM"
            if rsi > 65 and mom1d < 0:
                return "NEUTRAL_DIST"
        return "NEUTRAL"

    # ------------------------------------------------------------------
    # 2. LEGACY LABELS  (backward-compatible but volatility-scaled)
    # ------------------------------------------------------------------
    @staticmethod
    def classify_legacy(mom7d: float,
                        mom30d: float,
                        rsi: float,
                        macd: float,
                        bb_position: float,
                        volume_ratio: float) -> str:
        """
        Returns the legacy labels:
          Consistent Uptrend, New Spike, Topping Out, Lagging,
          Moderate Uptrend, Potential Reversal, Consolidation,
          Weak Uptrend, Overbought, Oversold, MACD Bullish,
          MACD Bearish, Neutral
        Each label now has exact, volatility-adjusted rules.
        """
        vol_mult  = max(0.5, min(2.0, volume_ratio))
        th_high   = 0.07  * vol_mult
        th_med    = 0.035 * vol_mult
        th_low    = 0.015 * vol_mult

        # 1. Consistent Uptrend
        if mom7d > th_med and mom30d > th_high and mom7d < 0.5 * mom30d:
            return "Consistent Uptrend"

        # 2. New Spike
        if mom7d > th_high and abs(mom30d) < th_med:
            return "New Spike"

        # 3. Topping Out
        if (mom7d < -th_med and
            mom30d > th_high and
            bb_position > 0.80 and
            rsi > 65):
            return "Topping Out"

        # 4. Lagging
        if abs(mom7d) < th_low and abs(mom30d) < th_med:
            return "Lagging"

        # 5. Moderate Uptrend
        if th_low < mom7d < th_high and th_med < mom30d < th_high:
            return "Moderate Uptrend"

        # 6. Potential Reversal
        if mom7d > th_med and mom30d < -th_med and rsi < 45:
            return "Potential Reversal"

        # 7. Consolidation
        if (abs(mom7d) < th_low and
            abs(mom30d) < th_low and
            40 <= rsi <= 60):
            return "Consolidation"

        # 8. Weak Uptrend
        if mom7d > th_low and abs(mom30d) < th_low:
            return "Weak Uptrend"

        # 9. Overbought / Oversold
        if rsi > 75 and mom7d > th_med:
            return "Overbought"
        if rsi < 25 and mom7d < -th_med:
            return "Oversold"

        # 10. MACD-driven
        if macd > 0 and mom7d > th_med:
            return "MACD Bullish"
        if macd < 0 and mom7d < -th_med:
            return "MACD Bearish"

        return "Neutral"
    
    @staticmethod
    def calculate_signal_strength(
        momentum_short: float,
        momentum_long: float,
        rsi: float,
        macd: float,
        volume_ratio: float = 1.0
    ) -> float:
        score = 50
        momentum_score = min(abs(momentum_short) * 1000, 15) + min(abs(momentum_long) * 500, 15)
        if momentum_short > 0 and momentum_long > 0:
            score += momentum_score
        else:
            score -= momentum_score
        if 40 < rsi < 60:
            score += 5
        elif rsi > 70 or rsi < 30:
            score -= 10
        score += min(abs(macd) * 50, 10) if macd > 0 else -min(abs(macd) * 50, 10)
        if volume_ratio > 1.2:
            score += 5
        elif volume_ratio < 0.8:
            score -= 3
        return max(0, min(100, score))

class MomentumScanner(OptimizableAgent):
    # OptimizableAgent interface implementation
    def get_hyperparameters(self) -> dict:
        return {
            'momentum_period': getattr(self, 'momentum_period', None),
            'rsi_window': getattr(self, 'rsi_window', None),
            'volume_threshold': getattr(self, 'volume_threshold', None)
        }

    def set_hyperparameters(self, params: dict) -> None:
        if 'momentum_period' in params:
            self.momentum_period = int(params['momentum_period'])
        if 'rsi_window' in params:
            self.rsi_window = int(params['rsi_window'])
        if 'volume_threshold' in params:
            self.volume_threshold = float(params['volume_threshold'])

    def validate_params(self, params: dict) -> bool:
        try:
            mp = int(params.get('momentum_period', getattr(self, 'momentum_period', 14)))
            rw = int(params.get('rsi_window', getattr(self, 'rsi_window', 14)))
            vt = float(params.get('volume_threshold', getattr(self, 'volume_threshold', 1.0)))
            return 5 <= mp <= 50 and 5 <= rw <= 50 and 0.5 <= vt <= 10.0
        except Exception:
            return False

    def evaluate(self) -> float:
        """
        Use backtest_strategy as the evaluation metric (e.g., return Sharpe ratio or PnL).
        Always await async backtest_strategy, fixing optimizer scoring and coroutine issues.
        """
        import asyncio
        backtest_fn = getattr(self, 'backtest_strategy', None)
        if backtest_fn is None:
            return 0.0
        try:
            # Always run coroutine in a new event loop if needed
            if asyncio.iscoroutinefunction(backtest_fn):
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                if loop.is_running():
                    # If already running (e.g. in Jupyter), use asyncio.run
                    result = asyncio.run(backtest_fn())
                else:
                    result = loop.run_until_complete(backtest_fn())
            else:
                result = backtest_fn()
            # If result is a dict, look for sharpe_ratio or pnl
            if isinstance(result, dict):
                val = result.get('sharpe_ratio')
                if val is not None:
                    return float(val)
                val = result.get('pnl')
                if val is not None:
                    return float(val)
                return 0.0

            # If result is a DataFrame, look for 'sharpe_ratio' column
            import pandas as pd
            if isinstance(result, pd.DataFrame) and 'sharpe_ratio' in result.columns:
                col = result['sharpe_ratio'].dropna()
                if not col.empty:
                    return float(col.mean())
                return 0.0

            # If result is a float or convertible
            if isinstance(result, pd.DataFrame):
                return 0.0
            try:
                return float(result)
            except Exception:
                return 0.0
        except Exception:
            return 0.0
    def _simulate_portfolio(self, backtest_df: pd.DataFrame, initial_capital: float) -> float:
        """
        Simulate portfolio value based on top signals and average 7d returns.
        Args:
            backtest_df: DataFrame of backtest results (must include 'composite_score', 'avg_return_7d')
            initial_capital: Starting capital for simulation
        Returns:
            Final portfolio value after simulated allocation
        """
        if backtest_df.empty:
            return initial_capital
        top_signals = backtest_df[backtest_df['composite_score'] >= 70].head(10)
        if top_signals.empty:
            return initial_capital
        weight_per_asset = 1.0 / len(top_signals)
        portfolio_return = (top_signals['avg_return_7d'] * weight_per_asset).sum()
        return initial_capital * (1 + portfolio_return / 100)
    """Main scanner class with improved architecture"""
    
    def __init__(
        self,
        exchange: ccxt_async.Exchange,
        config: Optional[TradingConfig] = None,
        market_type: str = 'crypto',
        quote_currency: str = 'USDT',
        min_volume_usd: float = 250_000,
        top_n: int = 50
    ):
        """
        Initialize the MomentumScanner with exchange and configuration settings.
        
        Args:
            exchange: CCXT async exchange instance
            config: Trading configuration (optional, defaults to dynamic config)
            market_type: Market type ('crypto' or 'forex')
            quote_currency: Quote currency for filtering (e.g., 'USDT')
            min_volume_usd: Minimum average volume in USD for filtering
            top_n: Number of top signals to keep
        """
        if not isinstance(exchange, ccxt_async.Exchange):
            raise ValueError("Exchange must be a valid CCXT async exchange instance")
        if market_type not in ['crypto', 'forex']:
            raise ValueError("Market type must be 'crypto' or 'forex'")
        
        self.exchange = exchange
        self.config = config or get_dynamic_config()
        self.market_type = market_type
        self.quote_currency = quote_currency.upper()
        self.min_volume_usd = max(min_volume_usd, 0)
        self.top_n = max(top_n, 1)
        
        self.scan_results = pd.DataFrame()
        self.market_data = {}
        self.live_prices = {}
        self.fear_greed_history = []
        self.btc_dominance_history = []
        self.timestamp_history = []
        
        self.data_fetcher = MarketDataFetcher(exchange, self.config)
        self.data_fetcher.cache_expiry = 300  # Enable caching for 5 minutes
        self.indicators = TechnicalIndicators()
        self.classifier = SignalClassifier()
        
        logger.info(
            f"Initialized MomentumScanner for {market_type} market with "
            f"quote_currency={quote_currency}, min_volume_usd={min_volume_usd}, top_n={top_n}"
        )
        
        # Don't initialize exchange in __init__ - it will be done when markets are loaded
        # The exchange should already have markets loaded by the caller

    async def _initialize_exchange(self):
        """Initialize the exchange connection and verify connectivity"""
        try:
            await self.exchange.load_markets()
            logger.info("Exchange markets loaded successfully")
        except Exception as e:
            logger.error(f"Error initializing exchange: {e}")
            raise
    

    
    async def overlay_4h_trend(self):
        if self.scan_results.empty:
            logger.warning("No daily scan results to overlay 4H trend")
            return
        tf = self.config.timeframes.get('medium', '4h')
        overlay = {}
        for symbol in self.scan_results['symbol']:
            df_4h = await self.data_fetcher.fetch_ohlcv(symbol, tf, limit=100)
            if df_4h is not None and len(df_4h) > 21:
                ema_21 = df_4h['close'].ewm(span=21, adjust=False).mean()
                overlay[symbol] = df_4h['close'].iloc[-1] > ema_21.iloc[-1]
            else:
                overlay[symbol] = False
        self.scan_results['trend_4h_bull'] = self.scan_results['symbol'].map(overlay)

    @staticmethod
    def ema_crossover(df: pd.DataFrame, fast: int = 9, slow: int = 21) -> bool:
        if len(df) < slow + 2:
            return False
        ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
        ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
        return (ema_fast.iloc[-2] < ema_slow.iloc[-2]) and (ema_fast.iloc[-1] > ema_slow.iloc[-1])

    @staticmethod
    def rsi_divergence(df: pd.DataFrame, lookback: int = 10) -> bool:
        if len(df) < lookback + 2 or 'rsi' not in df:
            return False
        price = df['close']
        rsi = df['rsi']
        return (price.iloc[-1] < price.iloc[-lookback]) and (rsi.iloc[-1] > rsi.iloc[-lookback])

    @staticmethod
    def macd_bullish_cross(df: pd.DataFrame) -> bool:
        if 'macd' not in df or len(df) < 3:
            return False
        macd = df['macd']
        signal = macd.ewm(span=9, adjust=False).mean()
        return (macd.iloc[-2] < signal.iloc[-2]) and (macd.iloc[-1] > signal.iloc[-1])

    @staticmethod
    def volume_acceleration(df: pd.DataFrame, window: int = 10) -> float:
        if len(df) < window + 2:
            return 1.0
        recent = df['volume'].iloc[-window:]
        prev = df['volume'].iloc[-window*2:-window]
        if prev.mean() == 0:
            return 1.0
        return recent.mean() / prev.mean()
    
    async def scan_multi_timeframe(
        self,
        timeframes: Optional[list] = None,
        full_analysis: bool = True,
        save_results: bool = True
    ) -> pd.DataFrame:
        if timeframes is None:
            timeframes = ['1h', '4h', '1d']
        logger.info(f"Starting multi-timeframe scan: {timeframes}")
        tf_results = {}
        for tf in timeframes:
            tf_results[tf] = await self.scan_market(tf, full_analysis, save_results=False)
        valid_dfs = [df for df in tf_results.values() if not df.empty]
        if not valid_dfs:
            logger.warning("No valid results in any timeframe")
            return pd.DataFrame()
        common_symbols = set.intersection(*(set(df['symbol']) for df in valid_dfs))
        multi_tf_df = pd.DataFrame()
        for symbol in common_symbols:
            rows = [df[df['symbol'] == symbol].iloc[0] for df in tf_results.values() if symbol in df['symbol'].values]
            signals = [row['signal'] for row in rows]
            bullish = all(s in ['Strong Buy', 'Buy', 'Weak Buy'] for s in signals)
            bearish = all(s in ['Strong Sell', 'Sell', 'Weak Sell'] for s in signals)
            neutral = all(s == 'Neutral' for s in signals)
            confirmed = bullish or bearish
            sig_counter = Counter(signals)
            most_common_signal, confluence_count = sig_counter.most_common(1)[0]
            base_row = rows[0].copy()
            base_row['multi_tf_confirmed'] = confirmed
            base_row['multi_tf_signals'] = signals
            base_row['multi_tf_timeframes'] = timeframes
            base_row['confluence_zone'] = confluence_count
            base_row['confluence_signal'] = most_common_signal
            base_row['strong_confluence'] = confluence_count == len(signals)
            multi_tf_df = pd.concat([multi_tf_df, pd.DataFrame([base_row])], ignore_index=True)
        self.scan_results = multi_tf_df
        if save_results:
            filename = f"scan_results_multitf_{'_'.join(timeframes)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            self.scan_results.to_csv(filename, index=False)
            logger.info(f"Multi-timeframe results saved to {filename}")
        return self.scan_results

    def plot_comparative_performance(self, top_n: int = 5, bottom_n: int = 5, overlay_sentiment: bool = True):
        if self.scan_results.empty:
            logger.warning("No scan results for comparative plotting")
            return
        df = self.scan_results.copy()
        if 'composite_score' in df:
            df = df.sort_values('composite_score', ascending=False)
        else:
            df = df.sort_values('signal_strength', ascending=False)
        top_syms = df.head(top_n)['symbol'].tolist()
        bottom_syms = df.tail(bottom_n)['symbol'].tolist()
        selected_syms = top_syms + bottom_syms
        fig = go.Figure()
        for symbol in selected_syms:
            if symbol not in self.market_data:
                continue
            data = self.market_data[symbol]
            fig.add_trace(
                go.Scatter(
                    x=data.index,
                    y=data['close'],
                    name=f"{symbol}",
                    mode='lines'
                )
            )
        fig.update_layout(
            title="Comparative Performance: Top vs Worst Performers",
            xaxis_title="Date",
            yaxis_title="Price",
            showlegend=True,
            template='plotly_dark'
        )
        if top_syms and top_syms[0] in self.market_data:
            data = self.market_data[top_syms[0]]
            if 'rsi' in data:
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['rsi'],
                        name='RSI',
                        yaxis='y2',
                        line=dict(color='orange', width=1.5)
                    )
                )
            if 'macd' in data:
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['macd'],
                        name='MACD',
                        yaxis='y2',
                        line=dict(color='purple', width=1.5)
                    )
                )
            fig.update_layout(
                yaxis2=dict(
                    title='RSI / MACD',
                    overlaying='y',
                    side='right'
                )
            )
            if 'poc_price' in data and pd.notna(data['poc_price'].iloc[-1]):
                fig.add_hline(
                    y=data['poc_price'].iloc[-1],
                    line_dash="dot",
                    line_color="green",
                    annotation_text="POC"
                )
        if overlay_sentiment and self.fear_greed_history and self.timestamp_history:
            fig.add_trace(
                go.Scatter(
                    x=self.timestamp_history,
                    y=[max([self.market_data[s]['close'].max() for s in selected_syms if s in self.market_data])] * len(self.timestamp_history),
                    mode='text',
                    text=[f'F&G: {v}' for v in self.fear_greed_history],
                    name='Sentiment (F&G)',
                    textposition='top center'
                )
            )
        filename = f'comparative_performance_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'
        fig.write_html(filename)
        logger.info(f"Comparative performance plot saved to {filename}")

    def detect_trend_reversal(self, symbol: str) -> bool:
        if symbol not in self.market_data:
            return False
        df = self.market_data[symbol]
        if 'macd' in df and 'rsi' in df:
            macd = df['macd']
            rsi_vals = df['rsi']
            price = df['close']
            macd_cross = (macd.diff().iloc[-1] * macd.iloc[-1] < 0)
            rsi_div = (rsi_vals.iloc[-1] < rsi_vals.iloc[-5]) and (price.iloc[-1] > price.iloc[-5])
            new_high = price.iloc[-1] > price.iloc[-10:-1].max()
            new_low = price.iloc[-1] < price.iloc[-10:-1].min()
            if (macd_cross and rsi_div) or new_high or new_low:
                return True
        return False
    
    async def scan_market(
        self,
        timeframe: str = 'daily',
        full_analysis: bool = True,
        save_results: bool = True
    ) -> pd.DataFrame:
        """
        Optimized for parallel execution using asyncio and ThreadPoolExecutor for real-time trading.
        """
        logger.info(f"Starting market scan for {timeframe} timeframe [PARALLEL]")
        symbols = await self.data_fetcher.fetch_markets(self.market_type, self.quote_currency)
        if not symbols:
            logger.error("No symbols available for scanning")
            return pd.DataFrame()
        symbols = symbols[:min(len(symbols), 460)]
        tf = self.config.timeframes.get(timeframe, '1d')
        momentum_periods = self.config.momentum_periods[self.market_type].get(
            timeframe, self.config.momentum_periods[self.market_type]['daily']
        )
        thresholds = self._adjust_thresholds(self.config.signal_thresholds[self.market_type].get(
            timeframe, self.config.signal_thresholds[self.market_type]['daily']
        ))
        base_limit = max(momentum_periods.values()) + 50
        fetch_limit = base_limit if not full_analysis else min(500, base_limit * 3)

        # --- Parallelized symbol processing ---
        import concurrent.futures

        async def process_symbol(symbol: str) -> Optional[dict]:
            try:
                df = await self.data_fetcher.fetch_ohlcv(symbol, tf, fetch_limit)
                if df is None or len(df) < base_limit:
                    return None
                # Indicator calculation and scoring can be CPU-bound, so use ThreadPoolExecutor
                def sync_analysis():
                    df_ind = self.indicators.add_all_indicators(df)
                    avg_volume_usd = self._calculate_volume_usd(df_ind)
                    if avg_volume_usd < self.min_volume_usd:
                        return None
                    momentum_short = self.indicators.calculate_momentum(df_ind['close'], momentum_periods['short'])
                    momentum_long = self.indicators.calculate_momentum(df_ind['close'], momentum_periods['long'])
                    rsi = self.indicators.calculate_rsi(df_ind['close'])
                    macd = self.indicators.calculate_macd(df_ind['close'])
                    volume_ratio = df_ind['volume'].iloc[-1] / df_ind['volume'].iloc[-21:-1].mean() if len(df_ind) > 21 else 1.0
                    trend_score = self.indicators.calculate_trend_score(df_ind)
                    confidence_score = self.indicators.calculate_confidence_score(
                        momentum_short, momentum_long, rsi, macd, trend_score, volume_ratio
                    )
                    ichimoku_bullish = (
                        'tenkan_sen' in df_ind and
                        df_ind['close'].iloc[-1] > df_ind['senkou_a'].iloc[-1] and
                        df_ind['close'].iloc[-1] > df_ind['senkou_b'].iloc[-1] and
                        df_ind['tenkan_sen'].iloc[-1] > df_ind['kijun_sen'].iloc[-1] and
                        df_ind['cloud_green'].iloc[-1] == 1
                    )
                    vwap_bullish = 'vwap' in df_ind and df_ind['close'].iloc[-1] > df_ind['vwap'].iloc[-1]
                    rsi_bearish_div = self.indicators.rsi_bearish_divergence(df_ind)
                    ema_5_13_bullish = 'ema_5' in df_ind and 'ema_13' in df_ind and df_ind['ema_5'].iloc[-1] > df_ind['ema_13'].iloc[-1]
                    ema_9_21_bullish = 'ema_9' in df_ind and 'ema_21' in df_ind and df_ind['ema_9'].iloc[-1] > df_ind['ema_21'].iloc[-1]
                    ema_50_200_bullish = 'ema_50' in df_ind and 'ema_200' in df_ind and df_ind['ema_50'].iloc[-1] > df_ind['ema_200'].iloc[-1]
                    volume_hist = df_ind['volume_hist'].iloc[-1]
                    poc_price = df_ind['poc_price'].iloc[-1]
                    poc_distance = (df_ind['close'].iloc[-1] - poc_price) / poc_price if poc_price else 0
                    composite_score = self.indicators.calculate_composite_score(
                        momentum_short, momentum_long, rsi, macd, trend_score, volume_ratio, ichimoku_bullish
                    )
                    volume_composite_score = self.indicators.calculate_volume_composite_score(
                        volume_ratio, volume_hist, poc_distance
                    )
                    # Calculate opportunity score - identifies best entry points vs just momentum
                    bb_position = self._get_bollinger_position(df_ind) if 'bb_upper' in df_ind else None
                    stoch_k = df_ind['stoch_k'].iloc[-1] if 'stoch_k' in df_ind else None
                    opportunity_score = self.indicators.calculate_opportunity_score(
                        momentum_short, momentum_long, rsi, macd,
                        bb_position, trend_score, volume_ratio,
                        stoch_k, rsi_bearish_div
                    )
                    signal = self.classifier.classify_momentum_signal(
                        momentum_short, momentum_long, rsi, macd, thresholds,
                        additional_indicators={
                            'ichimoku_bullish': ichimoku_bullish,
                            'vwap_bullish': vwap_bullish,
                            'rsi_bearish_div': rsi_bearish_div,
                            'ema_5_13_bullish': ema_5_13_bullish,
                            'ema_9_21_bullish': ema_9_21_bullish,
                            'ema_50_200_bullish': ema_50_200_bullish
                        }
                    )
                    signal_strength = self.classifier.calculate_signal_strength(
                        momentum_short, momentum_long, rsi, macd, volume_ratio
                    )
                    mom7d = self.indicators.calculate_momentum(df_ind['close'], 7) if len(df_ind) >= 8 else 0
                    mom30d = self.indicators.calculate_momentum(df_ind['close'], 30) if len(df_ind) >= 31 else 0
                    row = {
                        'symbol': symbol,
                        'price': df_ind['close'].iloc[-1],
                        'momentum_short': momentum_short,
                        'momentum_long': momentum_long,
                        'rsi': rsi,
                        'macd': macd,
                        'volume_usd': avg_volume_usd,
                        'volume_ratio': volume_ratio,
                        'signal': signal,
                        'signal_strength': signal_strength,
                        'signal_state': SignalClassifier.classify_legacy(
                            mom7d, mom30d, rsi, macd,
                            (self._get_bollinger_position(df_ind) if ('bb_upper' in df_ind and self._get_bollinger_position(df_ind) is not None) else 0.5) or 0.5,
                            volume_ratio
                        ),
                        'trend_score': trend_score,
                        'confidence_score': confidence_score,
                        'composite_score': composite_score,
                        'volume_composite_score': volume_composite_score,
                        'opportunity_score': opportunity_score,
                        'timeframe': timeframe,
                        'timestamp': datetime.now(timezone.utc),
                        'bb_position': self._get_bollinger_position(df_ind) if 'bb_upper' in df_ind else None,
                        'trend_strength': df_ind['adx'].iloc[-1] if 'adx' in df_ind else None,
                        'stoch_k': df_ind['stoch_k'].iloc[-1] if 'stoch_k' in df_ind else None,
                        'stoch_d': df_ind['stoch_d'].iloc[-1] if 'stoch_d' in df_ind else None,
                        'ichimoku_bullish': ichimoku_bullish,
                        'vwap_bullish': vwap_bullish,
                        'rsi_bearish_div': rsi_bearish_div,
                        'ema_5_13_bullish': ema_5_13_bullish,
                        'ema_9_21_bullish': ema_9_21_bullish,
                        'ema_50_200_bullish': ema_50_200_bullish,
                        'poc_price': poc_price,
                        'poc_distance': poc_distance,
                        'anchored_poc': df_ind['anchored_poc'].iloc[-1] if 'anchored_poc' in df_ind else None,
                        'fixed_poc': df_ind['fixed_poc'].iloc[-1] if 'fixed_poc' in df_ind else None
                    }
                    # --- Add Fibonacci fields ---
                    fib = TechnicalIndicators.fib_levels(df_ind, lookback=55)
                    row.update({
                        "fib_direction":     fib.get("direction"),
                        "fib_nearest_r":     fib.get("nearest_retracement"),
                        "fib_nearest_e":     fib.get("nearest_extension"),
                        "fib_confluence":    TechnicalIndicators.fib_confluence_score(
                                                 fib,
                                                 poc=row["poc_price"],
                                                 vwap=df_ind["vwap"].iloc[-1] if "vwap" in df_ind else 0.0
                                             ),
                    })
                    
                    # --- Calculate Stop-Loss and Take-Profit ---
                    sl_tp = TechnicalIndicators.calculate_stop_loss_take_profit(
                        current_price=row['price'],
                        df=df_ind,
                        signal=signal,
                        atr=df_ind['atr'].iloc[-1] if 'atr' in df_ind else None,
                        bb_lower=df_ind['bb_lower'].iloc[-1] if 'bb_lower' in df_ind else None,
                        bb_upper=df_ind['bb_upper'].iloc[-1] if 'bb_upper' in df_ind else None,
                        risk_reward_ratio=2.5
                    )
                    row.update(sl_tp)
                    
                    # --- Detect Market Regime ---
                    market_regime = TechnicalIndicators.detect_market_regime(df_ind)
                    row['market_regime'] = market_regime['regime']
                    row['regime_confidence'] = market_regime['confidence']
                    row['regime_trend_strength'] = market_regime['trend_strength']
                    row['regime_volatility'] = market_regime['volatility']
                    row['regime_suggested_threshold'] = market_regime['suggested_opportunity_threshold']
                    
                    return row, df_ind
                # Run indicator analysis in thread pool for speed
                loop = asyncio.get_running_loop()
                sync_result = await loop.run_in_executor(None, sync_analysis)
                if sync_result is None:
                    return None
                result, df_ind = sync_result
                if result:
                    self.market_data[symbol] = df_ind
                return result
            except Exception as e:
                logger.debug(f"Error processing {symbol}: {e}")
                return None

        # Limit concurrency to avoid rate limits
        semaphore = asyncio.Semaphore(self.config.max_concurrent_requests)
        async def sem_task(symbol):
            async with semaphore:
                return await process_symbol(symbol)

        # Use tqdm for progress bar
        tasks = [sem_task(symbol) for symbol in symbols]
        completed_results = []
        for future in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="Scanning markets [PARALLEL]"):
            result = await future
            if result:
                completed_results.append(result)
        if not completed_results:
            logger.warning("No valid results from market scan")
            return pd.DataFrame()
        df_results = pd.DataFrame(completed_results)
        # Updated scoring: heavily weight opportunity_score to find best entries, not just momentum
        df_results['combined_score'] = (
            df_results['opportunity_score'] * 0.50 +      # 50% - Best entry points (NEW!)
            df_results['composite_score'] * 0.25 +        # 25% - Technical strength (reduced)
            df_results['volume_composite_score'] * 0.15 + # 15% - Volume context
            df_results['signal_strength'] * 0.10          # 10% - Signal conviction
        )
        df_results = df_results.sort_values('combined_score', ascending=False)
        self.scan_results = df_results.head(self.top_n)
        if self.market_type == 'crypto':
            await self._update_market_sentiment()
        if save_results:
            filename = f"scan_results_{timeframe}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            self.scan_results.to_csv(filename, index=False)
            logger.info(f"Results saved to {filename}")
        logger.info(f"Market scan completed: {len(self.scan_results)} symbols analyzed [PARALLEL]")
        return self.scan_results
    
    def _calculate_volume_usd(self, df: pd.DataFrame) -> float:
        if self.market_type == 'crypto':
            return float((df['volume'] * df['close']).mean())
        return df['volume'].mean()
    
    def _get_bollinger_position(self, df: pd.DataFrame) -> Optional[float]:
        if not all(col in df for col in ['bb_upper', 'bb_lower', 'close']):
            return None
        current_price = df['close'].iloc[-1]
        bb_upper = df['bb_upper'].iloc[-1]
        bb_lower = df['bb_lower'].iloc[-1]
        if bb_upper == bb_lower:
            return 0.5
        return (current_price - bb_lower) / (bb_upper - bb_lower)
    
    def _adjust_thresholds(self, thresholds: dict) -> dict:
        if not self.fear_greed_history:
            return thresholds
        fg_index = self.fear_greed_history[-1]
        adjusted = thresholds.copy()
        if fg_index > 75:
            adjusted['momentum_short'] *= 1.2
            adjusted['rsi_min'] = min(adjusted['rsi_min'] + 5, 60)
        elif fg_index < 25:
            adjusted['momentum_short'] *= 0.8
            adjusted['rsi_min'] = max(adjusted['rsi_min'] - 5, 30)
        return adjusted
    
    async def _update_market_sentiment(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get("https://api.alternative.me/fng/") as response:
                    data = await response.json()
                    fear_greed = int(data['data'][0]['value'])
                    self.fear_greed_history.append(fear_greed)
            cmc_api_key = os.getenv("CMC_API_KEY")
            if cmc_api_key:
                headers = {'X-CMC_PRO_API_KEY': cmc_api_key}
                async with aiohttp.ClientSession(headers=headers) as session:
                    url = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest"
                    async with session.get(url) as response:
                        data = await response.json()
                        btc_dominance = data['data']['btc_dominance']
                        self.btc_dominance_history.append(btc_dominance)
            self.timestamp_history.append(datetime.now(timezone.utc))
        except Exception as e:
            logger.warning(f"Failed to update market sentiment: {e}")
    
    def get_top_signals(self, signal_types: Optional[List[str]] = None, min_strength: float = 70) -> pd.DataFrame:
        if self.scan_results.empty:
            return pd.DataFrame()
        df = self.scan_results.copy()
        df = df[df['composite_score'] >= min_strength]
        if signal_types:
            df = df[df['signal'].isin(signal_types)]
        return df.sort_values('composite_score', ascending=False)
    
    def generate_report(self) -> str:
        if self.scan_results.empty:
            return "No scan results available."
        df = self.scan_results
        report = f"""
=== MOMENTUM SCANNER REPORT ===
Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
Market Type: {self.market_type.upper()}
Total Symbols Analyzed: {len(df)}

=== SIGNAL DISTRIBUTION ===
{df['signal'].value_counts().to_string()}

=== TOP 10 OPPORTUNITIES ===
"""
        top_10 = df.head(10)
        for _, row in top_10.iterrows():
            momentum_pct = row['momentum_short'] * 100
            multi_tf_note = ""
            if 'multi_tf_confirmed' in row and bool(row['multi_tf_confirmed'].iloc[0] if hasattr(row['multi_tf_confirmed'], 'iloc') else row['multi_tf_confirmed']):
                multi_tf_note = " [MULTI-TF CONFIRMED]"
            elif 'multi_tf_signals' in row:
                multi_tf_note = f" [Signals: {row['multi_tf_signals']}]"
            report += f"""
Symbol: {row['symbol']}{multi_tf_note}
Signal: {row['signal']} (Composite Score: {row['composite_score']:.1f}/100, Volume Score: {row['volume_composite_score']:.1f}/100)
State: {row.get('signal_state', 'N/A')}
Trend Score: {row.get('trend_score', 'N/A')}/10
Confidence: {row.get('confidence_score', 'N/A')}
Price: ${row['price']:.4f}
POC Price: ${row['poc_price']:.4f} (Distance: {row['poc_distance']*100:.2f}%)
Short-term Momentum: {momentum_pct:+.2f}%
RSI: {row['rsi']:.1f}
Volume Ratio: {row['volume_ratio']:.2f}x
EMA Crossovers: 5/13: {row['ema_5_13_bullish']}, 9/21: {row['ema_9_21_bullish']}, 50/200: {row['ema_50_200_bullish']}
"""
        if self.market_type == 'crypto' and self.fear_greed_history:
            current_fg = self.fear_greed_history[-1]
            report += f"""
=== MARKET SENTIMENT ===
Fear & Greed Index: {current_fg}/100 ({self._interpret_fear_greed(current_fg)})
"""
            if self.btc_dominance_history:
                current_dom = self.btc_dominance_history[-1]
                report += f"Bitcoin Dominance: {current_dom:.1f}%\n"
        high_risk_signals = len(df[df['signal'].isin(['Strong Buy', 'Strong Sell'])])
        moderate_risk_signals = len(df[df['signal'].isin(['Buy', 'Sell'])])
        report += f"""
=== RISK ASSESSMENT ===
High Risk Signals: {high_risk_signals}
Moderate Risk Signals: {moderate_risk_signals}
Low Risk Signals: {len(df) - high_risk_signals - moderate_risk_signals}

Average Composite Score: {df['composite_score'].mean():.1f}/100
Average Volume Score: {df['volume_composite_score'].mean():.1f}/100
Market Volatility: {df['momentum_short'].std() * 100:.2f}%
"""
        report += f"""
=== TECHNICAL ANALYSIS SUMMARY ===
Average RSI: {df['rsi'].mean():.1f}
RSI Overbought (>70): {len(df[df['rsi'] > 70])} symbols
RSI Oversold (<30): {len(df[df['rsi'] < 30])} symbols
Positive MACD: {len(df[df['macd'] > 0])} symbols
High Volume Activity (>1.5x avg): {len(df[df['volume_ratio'] > 1.5])} symbols
Near POC (<5% distance): {len(df[abs(df['poc_distance']) < 0.05])} symbols
"""
        if self.market_type == 'crypto':
            btc_pairs = len(df[df['symbol'].str.contains('BTC', case=False)])
            eth_pairs = len(df[df['symbol'].str.contains('ETH', case=False)])
            defi_tokens = len(df[df['symbol'].str.contains('UNI|AAVE|COMP|SUSHI|CRV', case=False)])
            report += f"""
=== SECTOR ANALYSIS ===
BTC-related pairs: {btc_pairs}
ETH-related pairs: {eth_pairs}
DeFi tokens: {defi_tokens}
Other altcoins: {len(df) - btc_pairs - eth_pairs - defi_tokens}
"""
        avg_momentum = df['momentum_short'].mean()
        avg_rsi = df['rsi'].mean()
        if avg_momentum > 0.05 and avg_rsi > 60:
            market_condition = "BULLISH - Strong upward momentum with high RSI"
        elif avg_momentum > 0.02 and 40 < avg_rsi < 60:
            market_condition = "MODERATELY BULLISH - Steady upward trend"
        elif -0.02 < avg_momentum < 0.02 and 40 < avg_rsi < 60:
            market_condition = "NEUTRAL - Sideways movement"
        elif avg_momentum < -0.02 and avg_rsi < 40:
            market_condition = "BEARISH - Downward pressure with low RSI"
        elif avg_momentum < -0.05 and avg_rsi < 30:
            market_condition = "VERY BEARISH - Strong selling pressure"
        else:
            market_condition = "MIXED - Conflicting signals"
        report += f"""
=== MARKET CONDITION ===
Overall Assessment: {market_condition}
Recommended Action: {self._get_market_recommendation(avg_momentum, avg_rsi)}

=== TRADING RECOMMENDATIONS ===
"""
        strong_buys = df[df['signal'] == 'Strong Buy'].head(3)
        if not strong_buys.empty:
            report += "\nTOP STRONG BUY SIGNALS:\n"
            for _, row in strong_buys.iterrows():
                report += f"• {row['symbol']}: Composite Score {row['composite_score']:.0f}/100, "
                report += f"Volume Score {row['volume_composite_score']:.0f}/100, Momentum {row['momentum_short']*100:+.2f}%, RSI {row['rsi']:.0f}\n"
        overbought_signals = df[df['rsi'] > 75]
        if not overbought_signals.empty:
            report += f"\n⚠️  WARNING: {len(overbought_signals)} symbols are severely overbought (RSI > 75)\n"
        extreme_momentum = df[abs(df['momentum_short']) > 0.10]
        if not extreme_momentum.empty:
            report += f"⚠️  WARNING: {len(extreme_momentum)} symbols showing extreme momentum (>10%)\n"
        report += f"""
=== PORTFOLIO SUGGESTIONS ===
Diversification Score: {self._calculate_diversification_score(df):.1f}/10
Suggested Position Size: {self._suggest_position_size(df):.1f}% per trade
Risk-Adjusted Top Picks: {len(df[(df['composite_score'] > 75) & (df['rsi'] < 70)])} symbols

=== DISCLAIMER ===
This analysis is for educational purposes only and not financial advice.
Always conduct your own research and consider your risk tolerance.
Past performance does not guarantee future results.
"""
        return report
    
    def _interpret_fear_greed(self, value: int) -> str:
        if value <= 25:
            return "Extreme Fear"
        elif value <= 45:
            return "Fear"
        elif value <= 55:
            return "Neutral"
        elif value <= 75:
            return "Greed"
        else:
            return "Extreme Greed"
    
    def _get_market_recommendation(self, avg_momentum: float, avg_rsi: float) -> str:
        if avg_momentum > 0.05 and avg_rsi > 70:
            return "CAUTION - Market may be overheated, consider taking profits"
        elif avg_momentum > 0.03 and 50 < avg_rsi < 70:
            return "BUY - Good momentum with healthy RSI levels"
        elif avg_momentum > 0.01 and 40 < avg_rsi < 60:
            return "ACCUMULATE - Steady uptrend, good for DCA strategy"
        elif -0.01 < avg_momentum < 0.01:
            return "HOLD - Wait for clearer directional signals"
        elif avg_momentum < -0.03 and avg_rsi < 40:
            return "SELL/HEDGE - Bearish momentum, consider risk management"
        elif avg_momentum < -0.05 and avg_rsi < 30:
            return "OPPORTUNITY - Potential oversold bounce, but high risk"
        else:
            return "MIXED - Analyze individual signals carefully"
    
    def _calculate_diversification_score(self, df: pd.DataFrame) -> float:
        if df.empty:
            return 0
        signal_diversity = len(df['signal'].unique()) / 7
        momentum_std = df['momentum_short'].std()
        momentum_diversity = min(momentum_std * 10, 1.0)
        rsi_range = (df['rsi'].max() - df['rsi'].min()) / 100
        diversity_score = (signal_diversity * 0.4 + momentum_diversity * 0.3 + rsi_range * 0.3) * 10
        return min(diversity_score, 10.0)
    
    def _suggest_position_size(self, df: pd.DataFrame) -> float:
        if df.empty:
            return 2.0
        volatility = df['momentum_short'].std()
        base_size = 3.0
        if volatility > 0.08:
            return max(base_size * 0.5, 1.0)
        elif volatility > 0.05:
            return base_size * 0.75
        elif volatility > 0.02:
            return base_size
        else:
            return min(base_size * 1.5, 5.0)
    
    async def backtest_strategy(
        self,
        timeframe: str = 'daily',
        lookback_periods: int = 30,
        initial_capital: float = 10000
    ) -> pd.DataFrame:
        """
        Realistic backtest: next candle open, fees/slippage, allocation, stop-loss/take-profit, equity curve.
        """
        if self.scan_results.empty:
            logger.warning("No scan results available for backtesting")
            return pd.DataFrame()
        logger.info(f"Starting realistic backtest for {timeframe} strategy")
        tf = self.config.timeframes.get(timeframe, '1d')
        fee_rate = 0.0006  # 0.06% per side
        slippage_rate = 0.0005  # 0.05% slippage
        allocation_pct = 0.015  # 1.5% per trade
        stop_loss_pct = -0.05  # -5%
        take_profit_pct = 0.10  # +10%
        results = []
        equity_curve = []
        long_syms = self.scan_results[self.scan_results['signal'].isin(['Strong Buy', 'Buy', 'Weak Buy'])]['symbol'].tolist()
        short_syms = self.scan_results[self.scan_results['signal'].isin(['Strong Sell', 'Sell', 'Weak Sell'])]['symbol'].tolist()
        all_syms = list(set(long_syms + short_syms))[:20]

        async def backtest_symbol(symbol: str) -> Optional[dict]:
            try:
                df_hist = await self.data_fetcher.fetch_ohlcv(symbol, tf, limit=lookback_periods + 50)
                if df_hist is None or len(df_hist) < lookback_periods + 10:
                    return None
                symbol_data = self.scan_results[self.scan_results['symbol'] == symbol]
                if symbol_data.empty:
                    return None
                signal_type = symbol_data['signal'].iloc[0]
                composite_score = symbol_data['composite_score'].iloc[0]
                # --- Realistic trade simulation ---
                portfolio = initial_capital
                trade_size = allocation_pct * portfolio
                position = 0.0
                entry_idx = None
                entry_price = None
                exit_idx = None
                exit_price = None
                trade_log = []
                for i in range(lookback_periods):
                    # Signal triggers at candle i, enter at next open (i+1)
                    if i+1 >= len(df_hist):
                        break
                    open_price = df_hist['open'].iloc[i+1]
                    close_price = df_hist['close'].iloc[i+1]
                    high_price = df_hist['high'].iloc[i+1]
                    low_price = df_hist['low'].iloc[i+1]
                    # Entry
                    if position == 0:
                        position = trade_size / open_price
                        entry_idx = i+1
                        entry_price = open_price * (1 + fee_rate + slippage_rate)
                        trade_log.append({'action': 'entry', 'price': entry_price, 'idx': entry_idx, 'size': position})
                    # Check stop-loss/take-profit
                    if position != 0:
                        # For long
                        if signal_type in ['Strong Buy', 'Buy', 'Weak Buy']:
                            if entry_price is None:
                                continue  # Skip if entry_price is not set
                            stop_loss = entry_price * (1 + stop_loss_pct)
                            take_profit = entry_price * (1 + take_profit_pct)
                            if low_price <= stop_loss:
                                exit_idx = i+1
                                exit_price = stop_loss * (1 - fee_rate - slippage_rate)
                                trade_log.append({'action': 'stop_loss', 'price': exit_price, 'idx': exit_idx, 'size': position})
                                position = 0
                            elif high_price >= take_profit:
                                exit_idx = i+1
                                exit_price = take_profit * (1 - fee_rate - slippage_rate)
                                trade_log.append({'action': 'take_profit', 'price': exit_price, 'idx': exit_idx, 'size': position})
                                position = 0
                        # For short
                        else:
                            if entry_price is None:
                                continue  # Skip if entry_price is not set
                            stop_loss = entry_price * (1 - stop_loss_pct)
                            take_profit = entry_price * (1 - take_profit_pct)
                            if high_price >= stop_loss:
                                exit_idx = i+1
                                exit_price = stop_loss * (1 + fee_rate + slippage_rate)
                                trade_log.append({'action': 'stop_loss', 'price': exit_price, 'idx': exit_idx, 'size': position})
                                position = 0
                            elif low_price <= take_profit:
                                exit_idx = i+1
                                exit_price = take_profit * (1 + fee_rate + slippage_rate)
                                trade_log.append({'action': 'take_profit', 'price': exit_price, 'idx': exit_idx, 'size': position})
                                position = 0
                    # Exit at end of period if still open
                    if i == lookback_periods-1 and position != 0:
                        exit_idx = i+1
                        exit_price = close_price * (1 - fee_rate - slippage_rate) if signal_type in ['Strong Buy', 'Buy', 'Weak Buy'] else close_price * (1 + fee_rate + slippage_rate)
                        trade_log.append({'action': 'final_exit', 'price': exit_price, 'idx': exit_idx, 'size': position})
                        position = 0
                # Calculate PnL
                pnl = 0.0
                for j in range(len(trade_log)-1):
                    entry = trade_log[j]
                    exit = trade_log[j+1]
                    if entry['action'] == 'entry' and exit['action'] in ['stop_loss', 'take_profit', 'final_exit']:
                        if signal_type in ['Strong Buy', 'Buy', 'Weak Buy']:
                            pnl += (exit['price'] - entry['price']) * entry['size']
                        else:
                            pnl += (entry['price'] - exit['price']) * entry['size']
                # Compounding
                portfolio += pnl
                # Stats
                total_return = (portfolio - initial_capital) / initial_capital * 100
                win_rate = sum(1 for t in trade_log if t['action'] == 'take_profit') / max(1, len(trade_log)//2)
                max_drawdown = self._calculate_max_drawdown(pd.Series([t['price'] for t in trade_log if t['action'] in ['entry', 'stop_loss', 'take_profit', 'final_exit']]))
                volatility = np.std([t['price'] for t in trade_log if t['action'] in ['entry', 'stop_loss', 'take_profit', 'final_exit']])
                sharpe_ratio = (total_return / volatility) if volatility != 0 else 0
                equity_curve.append(portfolio)
                return {
                    'symbol': symbol,
                    'signal': signal_type,
                    'composite_score': composite_score,
                    'total_return': total_return,
                    'win_rate': win_rate * 100,
                    'max_drawdown': max_drawdown * 100,
                    'volatility': volatility,
                    'sharpe_ratio': sharpe_ratio,
                    'side': 'long' if signal_type in ['Strong Buy', 'Buy', 'Weak Buy'] else 'short',
                    'equity_curve': equity_curve,
                    'trade_log': trade_log
                }
            except Exception as e:
                logger.debug(f"Backtest error for {symbol}: {e}")
                return None

        tasks = [backtest_symbol(symbol) for symbol in all_syms]
        for future in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="Backtesting [realistic]"):
            result = await future
            if result:
                results.append(result)
        if not results:
            logger.warning("No backtest results generated")
            return pd.DataFrame()
        backtest_df = pd.DataFrame(results)
        backtest_df = backtest_df.sort_values('sharpe_ratio', ascending=False)
        # Output realistic equity curve
        equity_curve_all = np.array([r['equity_curve'][-1] if r['equity_curve'] else initial_capital for r in results])
        logger.info(f"Backtest completed. Realistic portfolio value: ${equity_curve_all.mean():,.2f}")
        longs = backtest_df[backtest_df['side'] == 'long']
        shorts = backtest_df[backtest_df['side'] == 'short']
        def perf_stats(df, label):
            if df.empty:
                logger.info(f"{label}: No trades")
                return
            logger.info(f"{label}: count={len(df)}, win_rate={df['win_rate'].mean():.1f}%, volatility={df['volatility'].mean():.2f}%, max_drawdown={df['max_drawdown'].mean():.2f}%, sharpe={df['sharpe_ratio'].mean():.2f}")
        perf_stats(longs, "Longs")
        perf_stats(shorts, "Shorts")
        logger.info(f"Long/Short ratio: {len(longs)}/{len(shorts)}")
        if not backtest_df.empty:
            logger.info(f"ALL: win_rate={backtest_df['win_rate'].mean():.1f}%, volatility={backtest_df['volatility'].mean():.2f}%, max_drawdown={backtest_df['max_drawdown'].mean():.2f}%, sharpe={backtest_df['sharpe_ratio'].mean():.2f}")
        return backtest_df
    
    def _calculate_sharpe_ratio(self, returns: pd.Series, risk_free_rate: float = 0.02) -> float:
        if returns.std() == 0:
            return 0
        excess_returns = returns.mean() - (risk_free_rate / 252)
        return excess_returns / returns.std() * np.sqrt(252)
    
    def _calculate_max_drawdown(self, prices: pd.Series) -> float:
        cumulative = (1 + prices.pct_change()).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        return drawdown.min()
    

    def plot_analysis(self, save_path: Optional[str] = None):
        if self.scan_results.empty or not self.market_data:
            logger.warning("No data available for plotting")
            return
        df = self.scan_results.sort_values('composite_score', ascending=False)
        top_symbols = df.head(5)['symbol'].tolist()
        full_path = None  # Initialize to avoid unbound error
        for symbol in top_symbols:
            if symbol not in self.market_data:
                continue
            data = self.market_data[symbol]
            if data.empty:
                continue
            # Create subplot layout: main price chart (rowspan=2, col=1), RSI (row=3, col=1), volume (row=4, col=1), volume profile (row=1, col=2)
            fig = make_subplots(
                rows=4, cols=2,
                specs=[
                    [{"rowspan": 2}, {}],
                    [None, None],
                    [{}, None],
                    [{}, None]
                ],
                subplot_titles=(
                    f"{symbol} Price and Indicators",
                    "Volume Profile",
                    "RSI",
                    "Volume"
                ),
                vertical_spacing=0.05,
                horizontal_spacing=0.05
            )
            # Candlestick chart
            fig.add_trace(
                go.Candlestick(
                    x=data.index,
                    open=data['open'],
                    high=data['high'],
                    low=data['low'],
                    close=data['close'],
                    name='OHLC'
                ),
                row=1, col=1
            )
            # EMA lines
            for ema, color in [
                ('ema_5', 'purple'),
                ('ema_13', 'blue'),
                ('ema_9', 'green'),
                ('ema_21', 'orange'),
                ('ema_50', 'red'),
                ('ema_200', 'black')
            ]:
                if ema in data and data[ema].notna().any():
                    fig.add_trace(
                        go.Scatter(
                            x=data.index,
                            y=data[ema],
                            name=ema.upper(),
                            line=dict(color=color, width=1.5)
                        ),
                        row=1, col=1
                    )
            # VWAP
            if 'vwap' in data and data['vwap'].notna().any():
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['vwap'],
                        name='VWAP',
                        line=dict(color='cyan', dash='dash', width=1.5)
                    ),
                    row=1, col=1
                )
            # POC as Fair Value Zone
            if 'poc_price' in data and pd.notna(data['poc_price'].iloc[-1]):
                poc_price = data['poc_price'].iloc[-1]
                fig.add_hrect(
                    y0=poc_price * 0.995,
                    y1=poc_price * 1.005,
                    line_width=0,
                    fillcolor="green",
                    opacity=0.2,
                    annotation_text="POC (Fair Value)",
                    annotation_position="top left"
                )
                fig.add_hline(
                    y=poc_price,
                    line_dash="dot",
                    line_color="green",
                    line_width=1
                )
            # Ichimoku Cloud
            if all(col in data for col in ['senkou_a', 'senkou_b']):
                # Plot Senkou Span A and B
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['senkou_a'],
                        name='Senkou A',
                        line=dict(color='green', width=1),
                        opacity=0.5
                    ),
                    row=1, col=1
                )
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['senkou_b'],
                        name='Senkou B',
                        line=dict(color='red', width=1),
                        opacity=0.5,
                        fill='tonexty',
                        fillcolor='rgba(255, 0, 0, 0.1)' if data['senkou_b'].iloc[-1] > data['senkou_a'].iloc[-1] else 'rgba(0, 255, 0, 0.1)'
                    ),
                    row=1, col=1
                )
            # RSI
            if 'rsi' in data and data['rsi'].notna().any():
                fig.add_trace(
                    go.Scatter(
                        x=data.index,
                        y=data['rsi'],
                        name='RSI',
                        line=dict(color='orange', width=1.5)
                    ),
                    row=3, col=1
                )
                fig.add_hline(
                    y=70,
                    line_dash="dash",
                    line_color="red",
                    line_width=1,
                    annotation_text="Overbought"
                )
                fig.add_hline(
                    y=30,
                    line_dash="dash",
                    line_color="green",
                    line_width=1,
                    annotation_text="Oversold"
                )
            # Volume
            fig.add_trace(
                go.Bar(
                    x=data.index,
                    y=data['volume'],
                    name='Volume',
                    marker_color='blue',
                    opacity=0.4
                ),
                row=4, col=1
            )
            # Volume Profile (always in row=1, col=2)
            if 'volume_hist' in data and data['volume_hist'].iloc[-1] is not None:
                volume_hist = data['volume_hist'].iloc[-1]
                price_bins = np.linspace(data['close'].min(), data['close'].max(), self.config.volume_profile_bins + 1)
                price_centers = (price_bins[:-1] + price_bins[1:]) / 2
                fig.add_trace(
                    go.Bar(
                        y=price_centers,
                        x=volume_hist,
                        orientation='h',
                        name='Volume Profile',
                        marker_color='purple',
                        opacity=0.3
                    ),
                    row=1, col=2
                )
            # Sentiment Overlay (Fear & Greed Index) with timezone alignment
            if self.fear_greed_history and self.timestamp_history:
                # Convert data.index to timezone-aware UTC datetimes
                if not hasattr(data.index, 'tzinfo') or data.index.tzinfo is None:
                    # If index is pandas DatetimeIndex, localize to UTC
                    try:
                        data_index_utc = data.index.tz_localize('UTC')
                    except Exception:
                        # If index is not DatetimeIndex, convert manually
                        data_index_utc = [
                            dt.replace(tzinfo=timezone.utc) if isinstance(dt, datetime) and dt.tzinfo is None else dt
                            for dt in data.index
                        ]
                        # Use first element for comparison
                        data_index_utc = pd.to_datetime(data_index_utc)
                else:
                    data_index_utc = data.index
                # Use first timestamp for filtering
                first_utc = data_index_utc
                sentiment_times = [t for t in self.timestamp_history if t >= first_utc]
                sentiment_values = self.fear_greed_history[-len(sentiment_times):]
                if sentiment_times and len(sentiment_times) == len(sentiment_values):
                    fig.add_trace(
                        go.Scatter(
                            x=sentiment_times,
                            y=[data['close'].max() * 1.1] * len(sentiment_times),  # Plot above price chart
                            mode='text',
                            text=[f'F&G: {v}' for v in sentiment_values],
                            name='Fear & Greed',
                            textposition='top center',
                            showlegend=True
                        ),
                        row=1, col=1
                    )
            # Update layout
            fig.update_layout(
                title=f"{symbol} Technical Analysis - Composite Score: {df[df['symbol'] == symbol]['composite_score'].iloc[0]:.1f}",
                height=1200,
                width=1400,
                showlegend=True,
                xaxis_rangeslider_visible=False,
                template='plotly_dark'
            )
            fig.update_xaxes(title_text="Date", row=4, col=1)
            fig.update_yaxes(title_text="Price", row=1, col=1)
            fig.update_yaxes(title_text="RSI", range=[0, 100], row=3, col=1)
            fig.update_yaxes(title_text="Volume", row=4, col=1)
            fig.update_yaxes(title_text="Price", row=1, col=2)
            # --- FIXED DIRECTORY CREATION AND SAFE FILENAMES ---
            # Sanitize symbol for folder and filename
            safe_symbol = symbol.replace("/", "_").replace(":", "_")
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            save_dir = Path(save_path or f"plots/{safe_symbol}")
            save_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{safe_symbol}_analysis_{timestamp}.html"
            full_path = save_dir / filename

            try:
                fig.write_html(str(full_path))
                logger.info(f"Analysis plot for {symbol} saved to {full_path}")
            except Exception as e:
                logger.error(f"Failed to save plot for {symbol}: {str(e)}")
        return str(full_path) if full_path is not None else None



async def main():
    """Main execution function with improved error handling"""
    logger.info("Starting Enhanced Momentum Scanner")
    
    # Configuration
    config = get_dynamic_config()
    
    # Try different exchanges in order of preference
    exchanges_to_try = [
        ('kucoinfutures', ccxt_async.kucoinfutures),
        ('kucoin', ccxt_async.kucoin),
        ('binance', ccxt_async.binance),
    ]
    
    exchange = None
    for exchange_name, exchange_class in exchanges_to_try:
        try:
            exchange = exchange_class({
                'enableRateLimit': True,
                'rateLimit': 100,
                'timeout': 30000,
            })
            
            # Test connection
            await exchange.load_markets()
            logger.info(f"Successfully connected to {exchange_name}")
            break
            
        except Exception as e:
            logger.warning(f"Failed to connect to {exchange_name}: {e}")
            if exchange:
                await exchange.close()
            exchange = None
            continue
    
    if not exchange:
        logger.error("Could not connect to any exchange. Exiting.")
        return
    
    try:
        # Initialize scanner
        scanner = MomentumScanner(
            exchange=exchange,
            config=config,
            market_type='crypto',
            quote_currency='USDT',
            min_volume_usd=500_000,  # Higher minimum for quality
            top_n=30
        )
        
        # Perform market scan
        logger.info("Starting comprehensive market scan...")
        results = await scanner.scan_market(
            timeframe='daily',
            full_analysis=True,
            save_results=True
        )
        
        if not results.empty:
            # Generate and print report
            report = scanner.generate_report()
            print(report)
            
            # Generate analysis plots
            scanner.plot_analysis()
            
            # Perform backtest
            logger.info("Starting strategy backtest...")
            backtest_results = await scanner.backtest_strategy(
                timeframe='daily',
                lookback_periods=30
            )
            
            if not backtest_results.empty:
                print("\n=== BACKTEST RESULTS ===")
                print(backtest_results[['symbol', 'signal', 'sharpe_ratio', 'win_rate', 'total_return']].head(10))
            
            # Initialize and run trading bot (dry run)
            trading_bot = TradingBot(
                scanner=scanner,
                dry_run=True,  # Always start with dry run
                max_positions=10,
                position_size_pct=0.03
            )
            
            await trading_bot.execute_strategy('daily')
            
        else:
            logger.warning("No results from market scan")
        
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}", exc_info=True)
    finally:
        if exchange:
            await exchange.close()
            logger.info("Exchange connection closed")


# --- TradingBot Template ---
class TradingBot:
    def __init__(self, scanner: MomentumScanner, dry_run: bool = True, max_positions: int = 5, position_size_pct: float = 0.05):
        """
        TradingBot template for executing trades based on scanner signals.
        Args:
            scanner: MomentumScanner instance
            dry_run: If True, simulate trades only
            max_positions: Maximum number of open positions
            position_size_pct: Position size as a percent of capital
        """
        self.scanner = scanner
        self.dry_run = dry_run
        self.max_positions = max_positions
        self.position_size_pct = position_size_pct
        self.open_positions = []
        self.trade_log = []

    async def execute_strategy(self, timeframe: str = 'daily'):
        """
        Execute trading strategy based on scanner results.
        """
        if self.scanner.scan_results.empty:
            logger.warning("No scan results for trading bot execution.")
            return
        df = self.scanner.scan_results.copy()
        # Select top signals for trading
        tradable = df.sort_values('composite_score', ascending=False).head(self.max_positions)
        for _, row in tradable.iterrows():
            symbol = row['symbol']
            signal = row['signal']
            price = row['price']
            position_size = self.position_size_pct * price
            trade = {
                'symbol': symbol,
                'signal': signal,
                'price': price,
                'size': position_size,
                'timeframe': timeframe,
                'dry_run': self.dry_run
            }
            self.open_positions.append(trade)
            self.trade_log.append(trade)
            logger.info(f"{'Simulated' if self.dry_run else 'Executed'} trade: {trade}")
        logger.info(f"TradingBot completed {'dry run' if self.dry_run else 'live'} execution. {len(self.open_positions)} positions opened.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
    except Exception as e:
        logger.error(f"Application failed: {e}", exc_info=True)
    finally:
        logger.info("Application shutdown complete")