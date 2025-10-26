# market_structure_engine_v2.py
import numpy as np
import pandas as pd
from typing import Optional, Dict, Tuple, List
from dataclasses import dataclass
from enum import Enum
from scipy.signal import argrelextrema

class Signal(Enum):
    """Trading signals"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    REVERSAL_LONG = "REVERSAL_LONG"
    REVERSAL_SHORT = "REVERSAL_SHORT"
    CONTINUATION_LONG = "CONTINUATION_LONG"
    CONTINUATION_SHORT = "CONTINUATION_SHORT"

class Trend(Enum):
    """Trend states"""
    UPTREND = "UPTREND"
    DOWNTREND = "DOWNTREND"
    RANGING = "RANGING"
    REVERSAL = "REVERSAL"

class SwingType(Enum):
    """Swing point types"""
    HIGHER_HIGH = "HH"
    LOWER_HIGH = "LH"
    HIGHER_LOW = "HL"
    LOWER_LOW = "LL"
    EQUAL_HIGH = "EH"
    EQUAL_LOW = "EL"

class ChartPattern(Enum):
    """Chart patterns"""
    DOUBLE_TOP = "DOUBLE_TOP"
    DOUBLE_BOTTOM = "DOUBLE_BOTTOM"
    HEAD_SHOULDERS = "HEAD_SHOULDERS"
    INVERSE_HEAD_SHOULDERS = "INVERSE_HEAD_SHOULDERS"
    ASCENDING_TRIANGLE = "ASCENDING_TRIANGLE"
    DESCENDING_TRIANGLE = "DESCENDING_TRIANGLE"
    FLAG = "FLAG"
    WEDGE = "WEDGE"

@dataclass
class SwingPoint:
    """Swing point data"""
    index: int
    price: float
    type: str  # 'high' or 'low'
    classification: Optional[str] = None  # HH, HL, LH, LL, etc.

@dataclass
class MarketStructureResult:
    """Container for market structure results"""
    signals: np.ndarray
    trend: np.ndarray
    swing_highs: List[SwingPoint]
    swing_lows: List[SwingPoint]
    support_levels: np.ndarray
    resistance_levels: np.ndarray
    breakout_levels: np.ndarray
    patterns: List[Dict]
    liquidity_sweeps: np.ndarray
    structure_breaks: np.ndarray
    order_blocks: List[Dict]
    fair_value_gaps: List[Dict]
    confidence: np.ndarray
    entry_prices: Optional[np.ndarray] = None
    pnl: Optional[np.ndarray] = None


class MarketStructureEngine:
    """
    Market Structure Engine v2.0 - Smart Money Concepts (SMC)
    
    Features:
    - Swing Point Detection (HH, HL, LH, LL)
    - Break of Structure (BOS) / Change of Character (ChoCH)
    - Order Blocks (OB) - Institutional entry zones
    - Fair Value Gaps (FVG) - Imbalance/inefficiency zones
    - Liquidity Sweeps - Stop hunt detection
    - Support/Resistance with strength scoring
    - Chart Pattern Recognition
    - Trend Classification with structure
    
    The ultimate price action analysis combining classical and modern SMC!
    """
    
    def __init__(
        self,
        swing_order: int = 5,
        min_swing_size: float = 0.005,
        fvg_threshold: float = 0.5,
        orderblock_period: int = 10,
        liquidity_sweep_atr_mult: float = 0.3,
        pattern_lookback: int = 30,
        support_resistance_strength: int = 3,
        track_pnl: bool = True
    ):
        """
        Initialize Market Structure Engine
        
        Args:
            swing_order: Order for swing point detection (default: 5)
            min_swing_size: Minimum swing size as % (default: 0.005 = 0.5%)
            fvg_threshold: FVG size threshold (default: 0.5)
            orderblock_period: Lookback for order block detection (default: 10)
            liquidity_sweep_atr_mult: ATR multiplier for liquidity sweeps (default: 0.3)
            pattern_lookback: Period for pattern recognition (default: 30)
            support_resistance_strength: Min touches for valid S/R (default: 3)
            track_pnl: Calculate profit and loss (default: True)
        """
        self.swing_order = swing_order
        self.min_swing_size = min_swing_size
        self.fvg_threshold = fvg_threshold
        self.orderblock_period = orderblock_period
        self.liquidity_sweep_atr_mult = liquidity_sweep_atr_mult
        self.pattern_lookback = pattern_lookback
        self.support_resistance_strength = support_resistance_strength
        self.track_pnl = track_pnl
        
        self.last_result = None

    def _detect_swing_points(
        self,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray
    ) -> Tuple[List[SwingPoint], List[SwingPoint]]:
        """Detect swing highs and lows"""
        # Find local maxima and minima
        high_indices = argrelextrema(high, np.greater, order=self.swing_order)[0]
        low_indices = argrelextrema(low, np.less, order=self.swing_order)[0]
        
        swing_highs = []
        swing_lows = []
        
        # Create swing high objects
        for idx in high_indices:
            if idx > 0:
                # Check if swing is significant enough
                swing_size = abs(high[idx] - close[idx-1]) / close[idx-1]
                if swing_size >= self.min_swing_size:
                    swing_highs.append(SwingPoint(
                        index=idx,
                        price=high[idx],
                        type='high'
                    ))
        
        # Create swing low objects
        for idx in low_indices:
            if idx > 0:
                swing_size = abs(low[idx] - close[idx-1]) / close[idx-1]
                if swing_size >= self.min_swing_size:
                    swing_lows.append(SwingPoint(
                        index=idx,
                        price=low[idx],
                        type='low'
                    ))
        
        return swing_highs, swing_lows

    def _classify_swing_points(
        self,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint]
    ) -> Tuple[List[SwingPoint], List[SwingPoint]]:
        """Classify swing points as HH, HL, LH, LL"""
        # Classify highs
        for i in range(1, len(swing_highs)):
            prev_high = swing_highs[i-1].price
            curr_high = swing_highs[i].price
            
            if curr_high > prev_high * 1.001:
                swing_highs[i].classification = SwingType.HIGHER_HIGH.value
            elif curr_high < prev_high * 0.999:
                swing_highs[i].classification = SwingType.LOWER_HIGH.value
            else:
                swing_highs[i].classification = SwingType.EQUAL_HIGH.value
        
        # Classify lows
        for i in range(1, len(swing_lows)):
            prev_low = swing_lows[i-1].price
            curr_low = swing_lows[i].price
            
            if curr_low > prev_low * 1.001:
                swing_lows[i].classification = SwingType.HIGHER_LOW.value
            elif curr_low < prev_low * 0.999:
                swing_lows[i].classification = SwingType.LOWER_LOW.value
            else:
                swing_lows[i].classification = SwingType.EQUAL_LOW.value
        
        return swing_highs, swing_lows

    def _detect_trend(
        self,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint],
        n: int
    ) -> np.ndarray:
        """Detect trend based on market structure"""
        trend = np.full(n, Trend.RANGING.value, dtype=object)
        
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return trend
        
        # Build timeline of swings
        for i in range(n):
            # Get recent swings before this point
            recent_highs = [s for s in swing_highs if s.index <= i and s.classification]
            recent_lows = [s for s in swing_lows if s.index <= i and s.classification]
            
            if len(recent_highs) < 2 or len(recent_lows) < 2:
                continue
            
            last_high = recent_highs[-1]
            last_low = recent_lows[-1]
            
            # Uptrend: HH and HL
            if (last_high.classification == SwingType.HIGHER_HIGH.value and
                last_low.classification == SwingType.HIGHER_LOW.value):
                trend[i] = Trend.UPTREND.value
            
            # Downtrend: LH and LL
            elif (last_high.classification == SwingType.LOWER_HIGH.value and
                  last_low.classification == SwingType.LOWER_LOW.value):
                trend[i] = Trend.DOWNTREND.value
            
            # Structure break detection
            elif ((last_high.classification == SwingType.LOWER_HIGH.value and
                   last_low.classification == SwingType.HIGHER_LOW.value) or
                  (last_high.classification == SwingType.HIGHER_HIGH.value and
                   last_low.classification == SwingType.LOWER_LOW.value)):
                trend[i] = Trend.REVERSAL.value
        
        return trend

    def _detect_structure_breaks(
        self,
        close: np.ndarray,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint]
    ) -> np.ndarray:
        """Detect Break of Structure (BOS) and Change of Character (ChoCH)"""
        structure_breaks = np.zeros(len(close))
        
        for i in range(1, len(close)):
            # Bullish BOS: price breaks above recent swing high
            recent_highs = [s for s in swing_highs if s.index < i]
            if recent_highs and close[i] > recent_highs[-1].price and close[i-1] <= recent_highs[-1].price:
                structure_breaks[i] = 1  # Bullish break
            
            # Bearish BOS: price breaks below recent swing low
            recent_lows = [s for s in swing_lows if s.index < i]
            if recent_lows and close[i] < recent_lows[-1].price and close[i-1] >= recent_lows[-1].price:
                structure_breaks[i] = -1  # Bearish break
        
        return structure_breaks

    def _detect_fair_value_gaps(
        self,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray
    ) -> List[Dict]:
        """Detect Fair Value Gaps (FVG) - 3-candle imbalance"""
        fvgs = []
        
        for i in range(2, len(close)):
            # Bullish FVG: gap between candle 1 high and candle 3 low
            if low[i] > high[i-2]:
                gap_size = (low[i] - high[i-2]) / close[i-2]
                if gap_size > self.fvg_threshold / 100:
                    fvgs.append({
                        'index': i,
                        'type': 'bullish',
                        'top': low[i],
                        'bottom': high[i-2],
                        'size': gap_size * 100,
                        'filled': False
                    })
            
            # Bearish FVG: gap between candle 1 low and candle 3 high
            elif high[i] < low[i-2]:
                gap_size = (low[i-2] - high[i]) / close[i-2]
                if gap_size > self.fvg_threshold / 100:
                    fvgs.append({
                        'index': i,
                        'type': 'bearish',
                        'top': low[i-2],
                        'bottom': high[i],
                        'size': gap_size * 100,
                        'filled': False
                    })
        
        # Track if FVGs get filled
        for fvg in fvgs:
            for i in range(fvg['index'] + 1, len(close)):
                if fvg['type'] == 'bullish' and low[i] <= fvg['bottom']:
                    fvg['filled'] = True
                    fvg['fill_index'] = i
                    break
                elif fvg['type'] == 'bearish' and high[i] >= fvg['top']:
                    fvg['filled'] = True
                    fvg['fill_index'] = i
                    break
        
        return fvgs

    def _detect_order_blocks(
        self,
        open_price: np.ndarray,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray,
        structure_breaks: np.ndarray
    ) -> List[Dict]:
        """Detect Order Blocks (OB) - Last opposing candle before structure break"""
        order_blocks = []
        
        for i in range(self.orderblock_period, len(close)):
            # Bullish OB: last bearish candle before bullish break
            if structure_breaks[i] == 1:
                # Look back for last bearish candle
                for j in range(i-1, max(0, i-self.orderblock_period), -1):
                    if close[j] < open_price[j]:  # Bearish candle
                        order_blocks.append({
                            'index': j,
                            'type': 'bullish',
                            'top': high[j],
                            'bottom': low[j],
                            'strength': 1.0,
                            'break_index': i
                        })
                        break
            
            # Bearish OB: last bullish candle before bearish break
            elif structure_breaks[i] == -1:
                # Look back for last bullish candle
                for j in range(i-1, max(0, i-self.orderblock_period), -1):
                    if close[j] > open_price[j]:  # Bullish candle
                        order_blocks.append({
                            'index': j,
                            'type': 'bearish',
                            'top': high[j],
                            'bottom': low[j],
                            'strength': 1.0,
                            'break_index': i
                        })
                        break
        
        return order_blocks

    def _detect_liquidity_sweeps(
        self,
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint]
    ) -> np.ndarray:
        """Detect liquidity sweeps (stop hunts)"""
        liquidity_sweeps = np.zeros(len(close))
        
        # Calculate ATR for threshold
        tr = np.maximum(high[1:] - low[1:],
                       np.maximum(abs(high[1:] - close[:-1]),
                                 abs(low[1:] - close[:-1])))
        atr = pd.Series(tr).rolling(14).mean().values
        atr = np.concatenate([[atr[0]], atr])  # Align
        
        for i in range(1, len(close)):
            # Bullish sweep: wick below swing low then reversal
            recent_lows = [s for s in swing_lows if s.index < i and i - s.index < 20]
            if recent_lows:
                swing_low = recent_lows[-1].price
                if (low[i] < swing_low and 
                    close[i] > swing_low and
                    close[i] > close[i-1]):
                    liquidity_sweeps[i] = 1  # Bullish sweep
            
            # Bearish sweep: wick above swing high then reversal
            recent_highs = [s for s in swing_highs if s.index < i and i - s.index < 20]
            if recent_highs:
                swing_high = recent_highs[-1].price
                if (high[i] > swing_high and
                    close[i] < swing_high and
                    close[i] < close[i-1]):
                    liquidity_sweeps[i] = -1  # Bearish sweep
        
        return liquidity_sweeps

    def _calculate_support_resistance(
        self,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint],
        n: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Calculate dynamic support and resistance levels"""
        support = np.full(n, np.nan)
        resistance = np.full(n, np.nan)
        
        for i in range(n):
            # Get swings before this point
            past_highs = [s.price for s in swing_highs if s.index < i]
            past_lows = [s.price for s in swing_lows if s.index < i]
            
            if len(past_lows) >= self.support_resistance_strength:
                # Support = highest recent swing low
                support[i] = past_lows[-1] if past_lows else np.nan
            
            if len(past_highs) >= self.support_resistance_strength:
                # Resistance = lowest recent swing high
                resistance[i] = past_highs[-1] if past_highs else np.nan
        
        return support, resistance

    def _detect_patterns(
        self,
        swing_highs: List[SwingPoint],
        swing_lows: List[SwingPoint]
    ) -> List[Dict]:
        """Detect chart patterns"""
        patterns = []
        
        # Double top detection
        if len(swing_highs) >= 2:
            for i in range(len(swing_highs) - 1):
                sh1 = swing_highs[i]
                sh2 = swing_highs[i + 1]
                
                # Check if prices are similar (within 1%)
                if abs(sh1.price - sh2.price) / sh1.price < 0.01:
                    patterns.append({
                        'type': ChartPattern.DOUBLE_TOP.value,
                        'start_index': sh1.index,
                        'end_index': sh2.index,
                        'level': (sh1.price + sh2.price) / 2,
                        'strength': 0.8
                    })
        
        # Double bottom detection
        if len(swing_lows) >= 2:
            for i in range(len(swing_lows) - 1):
                sl1 = swing_lows[i]
                sl2 = swing_lows[i + 1]
                
                if abs(sl1.price - sl2.price) / sl1.price < 0.01:
                    patterns.append({
                        'type': ChartPattern.DOUBLE_BOTTOM.value,
                        'start_index': sl1.index,
                        'end_index': sl2.index,
                        'level': (sl1.price + sl2.price) / 2,
                        'strength': 0.8
                    })
        
        # Head and Shoulders (simplified)
        if len(swing_highs) >= 3:
            for i in range(len(swing_highs) - 2):
                left = swing_highs[i]
                head = swing_highs[i + 1]
                right = swing_highs[i + 2]
                
                # Head higher than shoulders
                if (head.price > left.price * 1.02 and 
                    head.price > right.price * 1.02 and
                    abs(left.price - right.price) / left.price < 0.02):
                    patterns.append({
                        'type': ChartPattern.HEAD_SHOULDERS.value,
                        'start_index': left.index,
                        'end_index': right.index,
                        'level': head.price,
                        'strength': 0.9
                    })
        
        return patterns

    def _calculate_confidence(
        self,
        trend: np.ndarray,
        structure_breaks: np.ndarray,
        liquidity_sweeps: np.ndarray,
        fvgs: List[Dict],
        order_blocks: List[Dict],
        close: np.ndarray
    ) -> np.ndarray:
        """Calculate signal confidence"""
        confidence = np.zeros(len(close))
        
        for i in range(len(close)):
            score = 0
            
            # Clear trend (0-30 points)
            if trend[i] in [Trend.UPTREND.value, Trend.DOWNTREND.value]:
                score += 30
            elif trend[i] == Trend.REVERSAL.value:
                score += 20
            
            # Structure break (0-25 points)
            if structure_breaks[i] != 0:
                score += 25
            
            # Liquidity sweep (0-20 points)
            if liquidity_sweeps[i] != 0:
                score += 20
            
            # Near FVG (0-15 points)
            for fvg in fvgs:
                if not fvg['filled'] and fvg['index'] < i:
                    if fvg['bottom'] <= close[i] <= fvg['top']:
                        score += 15
                        break
            
            # Near Order Block (0-10 points)
            for ob in order_blocks:
                if ob['index'] < i < ob['break_index'] + 20:
                    if ob['bottom'] <= close[i] <= ob['top']:
                        score += 10
                        break
            
            confidence[i] = min(score, 100)
        
        return confidence

    def _generate_signals(
        self,
        close: np.ndarray,
        trend: np.ndarray,
        structure_breaks: np.ndarray,
        liquidity_sweeps: np.ndarray,
        fvgs: List[Dict],
        order_blocks: List[Dict],
        support: np.ndarray,
        resistance: np.ndarray,
        confidence: np.ndarray
    ) -> np.ndarray:
        """Generate trading signals"""
        signals = np.full(len(close), Signal.HOLD.value, dtype=object)
        position = 0
        
        for i in range(self.swing_order, len(close)):
            if confidence[i] < 50:
                continue
            
            # Bullish signals
            bullish_structure_break = structure_breaks[i] == 1
            bullish_sweep = liquidity_sweeps[i] == 1
            uptrend = trend[i] == Trend.UPTREND.value
            near_support = not np.isnan(support[i]) and close[i] <= support[i] * 1.01
            
            # Check for bullish FVG or OB
            in_bullish_zone = False
            for fvg in fvgs:
                if (fvg['type'] == 'bullish' and not fvg['filled'] and
                    fvg['index'] < i and fvg['bottom'] <= close[i] <= fvg['top']):
                    in_bullish_zone = True
                    break
            
            if not in_bullish_zone:
                for ob in order_blocks:
                    if (ob['type'] == 'bullish' and ob['index'] < i and
                        ob['bottom'] <= close[i] <= ob['top']):
                        in_bullish_zone = True
                        break
            
            # Bearish signals
            bearish_structure_break = structure_breaks[i] == -1
            bearish_sweep = liquidity_sweeps[i] == -1
            downtrend = trend[i] == Trend.DOWNTREND.value
            near_resistance = not np.isnan(resistance[i]) and close[i] >= resistance[i] * 0.99
            
            # Check for bearish FVG or OB
            in_bearish_zone = False
            for fvg in fvgs:
                if (fvg['type'] == 'bearish' and not fvg['filled'] and
                    fvg['index'] < i and fvg['bottom'] <= close[i] <= fvg['top']):
                    in_bearish_zone = True
                    break
            
            if not in_bearish_zone:
                for ob in order_blocks:
                    if (ob['type'] == 'bearish' and ob['index'] < i and
                        ob['bottom'] <= close[i] <= ob['top']):
                        in_bearish_zone = True
                        break
            
            # Generate signals
            if position == 0:
                # Reversal LONG: liquidity sweep + bullish zone
                if bullish_sweep and in_bullish_zone:
                    signals[i] = Signal.REVERSAL_LONG.value
                    position = 1
                
                # Continuation LONG: structure break + uptrend
                elif bullish_structure_break and uptrend and near_support:
                    signals[i] = Signal.CONTINUATION_LONG.value
                    position = 1
                
                # Simple BUY: bullish zone + uptrend
                elif in_bullish_zone and uptrend:
                    signals[i] = Signal.BUY.value
                    position = 1
                
                # Reversal SHORT: liquidity sweep + bearish zone
                elif bearish_sweep and in_bearish_zone:
                    signals[i] = Signal.REVERSAL_SHORT.value
                    position = -1
                
                # Continuation SHORT: structure break + downtrend
                elif bearish_structure_break and downtrend and near_resistance:
                    signals[i] = Signal.CONTINUATION_SHORT.value
                    position = -1
                
                # Simple SELL: bearish zone + downtrend
                elif in_bearish_zone and downtrend:
                    signals[i] = Signal.SELL.value
                    position = -1
            
            # Exit logic
            elif position == 1 and (bearish_structure_break or near_resistance):
                position = 0
            elif position == -1 and (bullish_structure_break or near_support):
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
            if signals[i] in [Signal.BUY.value, Signal.REVERSAL_LONG.value, 
                             Signal.CONTINUATION_LONG.value]:
                entry_price = close[i]
                position = 1
                entry_prices[i] = entry_price
            
            elif signals[i] in [Signal.SELL.value, Signal.REVERSAL_SHORT.value,
                               Signal.CONTINUATION_SHORT.value]:
                entry_price = close[i]
                position = -1
                entry_prices[i] = entry_price
            
            elif signals[i] == Signal.HOLD.value and position != 0 and entry_price > 0:
                # Check if we should exit (implicit)
                if position == 1 and close[i] < entry_price * 0.97:  # 3% stop
                    position = 0
                    entry_price = 0
                elif position == -1 and close[i] > entry_price * 1.03:  # 3% stop
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

    def evaluate(self, df: pd.DataFrame) -> MarketStructureResult:
        """
        Evaluate market structure signals
        
        Args:
            df: DataFrame with columns ['open', 'high', 'low', 'close']
            
        Returns:
            MarketStructureResult object with comprehensive structure analysis
        """
        # Validate input
        required_cols = ['open', 'high', 'low', 'close']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"DataFrame must contain columns: {required_cols}")
        
        n = len(df)
        open_price = df['open'].values
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        
        # Detect swing points
        swing_highs, swing_lows = self._detect_swing_points(high, low, close)
        
        # Classify swing points
        swing_highs, swing_lows = self._classify_swing_points(swing_highs, swing_lows)
        
        # Detect trend
        trend = self._detect_trend(swing_highs, swing_lows, n)
        
        # Detect structure breaks
        structure_breaks = self._detect_structure_breaks(close, swing_highs, swing_lows)
        
        # Detect FVGs
        fvgs = self._detect_fair_value_gaps(high, low, close)
        
        # Detect order blocks
        order_blocks = self._detect_order_blocks(open_price, high, low, close, structure_breaks)
        
        # Detect liquidity sweeps
        liquidity_sweeps = self._detect_liquidity_sweeps(high, low, close, swing_highs, swing_lows)
        
        # Calculate support/resistance
        support, resistance = self._calculate_support_resistance(swing_highs, swing_lows, n)
        
        # Detect patterns
        patterns = self._detect_patterns(swing_highs, swing_lows)
        
        # Calculate breakout levels
        breakout_levels = np.full(n, np.nan)
        for i in range(n):
            if not np.isnan(resistance[i]):
                breakout_levels[i] = resistance[i]
        
        # Calculate confidence
        confidence = self._calculate_confidence(
            trend, structure_breaks, liquidity_sweeps, fvgs, order_blocks, close
        )
        
        # Generate signals
        signals = self._generate_signals(
            close, trend, structure_breaks, liquidity_sweeps,
            fvgs, order_blocks, support, resistance, confidence
        )
        
        # Calculate P&L if enabled
        pnl = None
        entry_prices = None
        if self.track_pnl:
            pnl, entry_prices = self._calculate_pnl(close, signals)
        
        # Create result
        result = MarketStructureResult(
            signals=signals,
            trend=trend,
            swing_highs=swing_highs,
            swing_lows=swing_lows,
            support_levels=support,
            resistance_levels=resistance,
            breakout_levels=breakout_levels,
            patterns=patterns,
            liquidity_sweeps=liquidity_sweeps,
            structure_breaks=structure_breaks,
            order_blocks=order_blocks,
            fair_value_gaps=fvgs,
            confidence=confidence,
            entry_prices=entry_prices,
            pnl=pnl
        )
        
        self.last_result = result
        return result

    def get_statistics(self, result: Optional[MarketStructureResult] = None) -> Dict:
        """Calculate trading statistics"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        signals = result.signals
        
        stats = {
            'total_signals': np.sum(signals != Signal.HOLD.value),
            'buy_signals': np.sum(signals == Signal.BUY.value),
            'sell_signals': np.sum(signals == Signal.SELL.value),
            'reversal_long': np.sum(signals == Signal.REVERSAL_LONG.value),
            'reversal_short': np.sum(signals == Signal.REVERSAL_SHORT.value),
            'continuation_long': np.sum(signals == Signal.CONTINUATION_LONG.value),
            'continuation_short': np.sum(signals == Signal.CONTINUATION_SHORT.value),
            'swing_highs': len(result.swing_highs),
            'swing_lows': len(result.swing_lows),
            'structure_breaks': np.sum(result.structure_breaks != 0),
            'liquidity_sweeps': np.sum(result.liquidity_sweeps != 0),
            'fair_value_gaps': len(result.fair_value_gaps),
            'unfilled_fvgs': len([f for f in result.fair_value_gaps if not f['filled']]),
            'order_blocks': len(result.order_blocks),
            'patterns_detected': len(result.patterns),
            'avg_confidence': np.mean(result.confidence[result.confidence > 0]),
            'uptrend_pct': np.sum(result.trend == Trend.UPTREND.value) / len(result.trend) * 100,
            'downtrend_pct': np.sum(result.trend == Trend.DOWNTREND.value) / len(result.trend) * 100,
            'ranging_pct': np.sum(result.trend == Trend.RANGING.value) / len(result.trend) * 100
        }
        
        if result.pnl is not None:
            stats['total_pnl'] = result.pnl[-1]
            stats['max_pnl'] = np.max(result.pnl)
            stats['min_pnl'] = np.min(result.pnl)
        
        return stats

    def get_current_structure(self, result: Optional[MarketStructureResult] = None) -> Dict:
        """Get current market structure summary"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        current = {
            'trend': result.trend[-1] if len(result.trend) > 0 else 'UNKNOWN',
            'last_swing_high': result.swing_highs[-1] if result.swing_highs else None,
            'last_swing_low': result.swing_lows[-1] if result.swing_lows else None,
            'support': result.support_levels[-1] if len(result.support_levels) > 0 else np.nan,
            'resistance': result.resistance_levels[-1] if len(result.resistance_levels) > 0 else np.nan,
            'unfilled_fvgs': [f for f in result.fair_value_gaps if not f['filled']],
            'active_order_blocks': [ob for ob in result.order_blocks 
                                    if len(result.signals) - ob['break_index'] < 20],
            'recent_patterns': [p for p in result.patterns 
                               if len(result.signals) - p['end_index'] < 30]
        }
        
        return current

    def to_dataframe(self, result: Optional[MarketStructureResult] = None) -> pd.DataFrame:
        """Convert results to DataFrame"""
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No results available. Run evaluate() first.")
        
        df = pd.DataFrame({
            'signal': result.signals,
            'trend': result.trend,
            'support': result.support_levels,
            'resistance': result.resistance_levels,
            'structure_break': result.structure_breaks,
            'liquidity_sweep': result.liquidity_sweeps,
            'confidence': result.confidence
        })
        
        if result.entry_prices is not None:
            df['entry_price'] = result.entry_prices
        
        if result.pnl is not None:
            df['pnl_pct'] = result.pnl
        
        return df


# Example usage
if __name__ == "__main__":
    # Create sample data with clear market structure
    np.random.seed(42)
    n = 300
    
    # Create trending price action with swings
    price = 100
    prices = [price]
    trend_direction = 1
    
    for i in range(n-1):
        # Create swing structure
        if i % 30 == 0:
            trend_direction *= -1  # Change trend
        
        # Add trend + noise
        trend_move = trend_direction * np.random.uniform(0.1, 0.5)
        noise = np.random.randn() * 0.3
        price += trend_move + noise
        prices.append(price)
    
    prices = np.array(prices)
    
    # Create OHLC
    volatility = np.random.uniform(0.5, 1.5, n)
    close = prices
    open_price = close + np.random.randn(n) * 0.2
    high = np.maximum(open_price, close) + np.abs(np.random.randn(n) * volatility * 0.3)
    low = np.minimum(open_price, close) - np.abs(np.random.randn(n) * volatility * 0.3)
    
    df = pd.DataFrame({
        'open': open_price,
        'high': high,
        'low': low,
        'close': close
    })
    
    # Initialize and run Market Structure Engine
    ms_engine = MarketStructureEngine(
        swing_order=5,
        min_swing_size=0.005,
        fvg_threshold=0.5,
        orderblock_period=10,
        track_pnl=True
    )
    
    result = ms_engine.evaluate(df)
    
    # Display results
    result_df = ms_engine.to_dataframe()
    print("Sample Results (Last 15 rows):")
    print(result_df.tail(15))
    
    print("\n" + "="*70)
    stats = ms_engine.get_statistics()
    print("Market Structure Statistics:")
    for key, value in stats.items():
        if isinstance(value, float):
            print(f"{key}: {value:.2f}")
        else:
            print(f"{key}: {value}")
    
    print("\n" + "="*70)
    current = ms_engine.get_current_structure()
    print("Current Market Structure:")
    print(f"Trend: {current['trend']}")
    print(f"Support: {current['support']:.2f}" if not np.isnan(current['support']) else "Support: N/A")
    print(f"Resistance: {current['resistance']:.2f}" if not np.isnan(current['resistance']) else "Resistance: N/A")
    print(f"Unfilled FVGs: {len(current['unfilled_fvgs'])}")
    print(f"Active Order Blocks: {len(current['active_order_blocks'])}")
    print(f"Recent Patterns: {len(current['recent_patterns'])}")