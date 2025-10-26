# strategy_coordinator_v2.py
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

class SignalStrength(Enum):
    """Signal strength levels"""
    VERY_STRONG = 5
    STRONG = 4
    MODERATE = 3
    WEAK = 2
    VERY_WEAK = 1
    NONE = 0

class TradeDirection(Enum):
    """Trade directions"""
    LONG = "LONG"
    SHORT = "SHORT"
    NEUTRAL = "NEUTRAL"

class TimeframeWeight(Enum):
    """Timeframe importance weights"""
    DAILY = 3.0
    H4 = 2.5
    H1 = 2.0
    M15 = 1.5
    M5 = 1.0

@dataclass
class StrategySignal:
    """Individual strategy signal"""
    strategy_name: str
    direction: str  # LONG, SHORT, NEUTRAL
    strength: float  # 0-100
    confidence: float  # 0-100
    timeframe: str
    price: float
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict] = None

@dataclass
class ConsensusTrade:
    """Consensus trade recommendation"""
    direction: str
    entry_price: float
    stop_loss: float
    take_profit: List[float]  # Multiple TPs
    position_size: float
    confidence: float
    risk_reward_ratio: float
    contributing_strategies: List[str]
    timeframe_alignment: Dict[str, str]
    edge_score: float
    timestamp: datetime

@dataclass
class PortfolioState:
    """Current portfolio state"""
    total_equity: float
    available_capital: float
    positions: List[Dict]
    daily_pnl: float
    total_pnl: float
    win_rate: float
    risk_exposure: float
    max_drawdown: float


class StrategyCoordinator:
    """
    Strategy Coordinator v2.0 - Multi-Strategy Consensus Engine
    
    Coordinates all 5 strategies:
    1. Gradient Trend Filter (GTF)
    2. UT Bot Strategy
    3. Mean Reversion Engine
    4. Volume Profile Engine
    5. Market Structure Engine
    
    Features:
    - Multi-timeframe analysis
    - Strategy consensus voting
    - Conflict resolution
    - Signal filtering
    - Risk management integration
    - Position sizing
    - Trade orchestration
    """
    
    def __init__(
        self,
        strategies: Dict[str, Any],
        timeframe_weights: Optional[Dict[str, float]] = None,
        min_consensus: float = 0.60,
        max_risk_per_trade: float = 0.02,
        max_portfolio_risk: float = 0.06,
        min_risk_reward: float = 2.0,
        enable_hedging: bool = False
    ):
        """
        Initialize Strategy Coordinator
        
        Args:
            strategies: Dict of strategy instances {name: strategy_object}
            timeframe_weights: Weights for different timeframes
            min_consensus: Minimum agreement threshold (0-1)
            max_risk_per_trade: Max risk per trade as % of equity
            max_portfolio_risk: Max total portfolio risk
            min_risk_reward: Minimum risk/reward ratio
            enable_hedging: Allow opposite direction positions
        """
        self.strategies = strategies
        self.timeframe_weights = timeframe_weights or {
            'D1': 3.0,
            'H4': 2.5,
            'H1': 2.0,
            'M15': 1.5,
            'M5': 1.0
        }
        self.min_consensus = min_consensus
        self.max_risk_per_trade = max_risk_per_trade
        self.max_portfolio_risk = max_portfolio_risk
        self.min_risk_reward = min_risk_reward
        self.enable_hedging = enable_hedging
        
        # State tracking
        self.signal_history: List[StrategySignal] = []
        self.trade_history: List[ConsensusTrade] = []
        self.portfolio_state: Optional[PortfolioState] = None
        
    def collect_signals(
        self,
        data: Dict[str, pd.DataFrame],
        timeframes: Optional[List[str]] = None
    ) -> Dict[str, List[StrategySignal]]:
        """
        Collect signals from all strategies across timeframes
        
        Args:
            data: Dict of {timeframe: DataFrame} with OHLCV data
            timeframes: List of timeframes to analyze
            
        Returns:
            Dict of {timeframe: [signals]}
        """
        if timeframes is None:
            timeframes = list(data.keys())
        
        all_signals = {}
        
        for tf in timeframes:
            if tf not in data:
                continue
                
            df = data[tf]
            tf_signals = []
            
            # Gradient Trend Filter
            if 'gradient_trend' in self.strategies:
                gtf = self.strategies['gradient_trend']
                result = gtf.evaluate(df)
                signal = self._parse_gtf_signal(result, tf, df['close'].iloc[-1])
                if signal:
                    tf_signals.append(signal)
            
            # UT Bot
            if 'ut_bot' in self.strategies:
                ut = self.strategies['ut_bot']
                result = ut.evaluate(df)
                signal = self._parse_ut_signal(result, tf, df['close'].iloc[-1])
                if signal:
                    tf_signals.append(signal)
            
            # Mean Reversion
            if 'mean_reversion' in self.strategies:
                mr = self.strategies['mean_reversion']
                result = mr.evaluate(df)
                signal = self._parse_mr_signal(result, tf, df['close'].iloc[-1])
                if signal:
                    tf_signals.append(signal)
            
            # Volume Profile
            if 'volume_profile' in self.strategies:
                vp = self.strategies['volume_profile']
                result = vp.evaluate(df)
                signal = self._parse_vp_signal(result, tf, df['close'].iloc[-1])
                if signal:
                    tf_signals.append(signal)
            
            # Market Structure
            if 'market_structure' in self.strategies:
                ms = self.strategies['market_structure']
                result = ms.evaluate(df)
                signal = self._parse_ms_signal(result, tf, df['close'].iloc[-1])
                if signal:
                    tf_signals.append(signal)
            
            all_signals[tf] = tf_signals
        
        return all_signals
    
    def _parse_gtf_signal(self, result, timeframe: str, price: float) -> Optional[StrategySignal]:
        """Parse Gradient Trend Filter signal"""
        last_signal = result.signals[-1]
        
        if last_signal == 'NONE':
            return None
        
        direction = TradeDirection.LONG.value if last_signal == 'UP' else TradeDirection.SHORT.value
        strength = result.strength[-1] if hasattr(result, 'strength') else 50
        
        return StrategySignal(
            strategy_name='Gradient Trend Filter',
            direction=direction,
            strength=strength,
            confidence=min(strength * 1.2, 100),
            timeframe=timeframe,
            price=price,
            timestamp=datetime.now(),
            metadata={'diff': result.diff[-1]}
        )
    
    def _parse_ut_signal(self, result, timeframe: str, price: float) -> Optional[StrategySignal]:
        """Parse UT Bot signal"""
        last_signal = result.signals[-1]
        
        if last_signal == 'HOLD':
            return None
        
        direction = TradeDirection.LONG.value if last_signal == 'BUY' else TradeDirection.SHORT.value
        confidence = result.confidence[-1] if hasattr(result, 'confidence') else 60
        
        return StrategySignal(
            strategy_name='UT Bot',
            direction=direction,
            strength=confidence,
            confidence=confidence,
            timeframe=timeframe,
            price=price,
            timestamp=datetime.now(),
            metadata={'trailing_stop': result.trailing_stop[-1]}
        )
    
    def _parse_mr_signal(self, result, timeframe: str, price: float) -> Optional[StrategySignal]:
        """Parse Mean Reversion signal"""
        last_signal = result.signals[-1]
        
        if last_signal == 'HOLD':
            return None
        
        direction = TradeDirection.LONG.value if 'BUY' in last_signal else TradeDirection.SHORT.value
        confidence = result.confidence[-1]
        
        return StrategySignal(
            strategy_name='Mean Reversion',
            direction=direction,
            strength=confidence,
            confidence=confidence,
            timeframe=timeframe,
            price=price,
            timestamp=datetime.now(),
            metadata={
                'z_score': result.z_score[-1],
                'rsi': result.rsi[-1],
                'regime': result.regime[-1]
            }
        )
    
    def _parse_vp_signal(self, result, timeframe: str, price: float) -> Optional[StrategySignal]:
        """Parse Volume Profile signal"""
        last_signal = result.signals[-1]
        
        if last_signal == 'HOLD':
            return None
        
        is_long = 'LONG' in last_signal or last_signal == 'BUY'
        direction = TradeDirection.LONG.value if is_long else TradeDirection.SHORT.value
        confidence = result.confidence[-1]
        
        return StrategySignal(
            strategy_name='Volume Profile',
            direction=direction,
            strength=confidence,
            confidence=confidence,
            timeframe=timeframe,
            price=price,
            timestamp=datetime.now(),
            metadata={
                'poc': result.poc[-1],
                'cvd': result.cvd[-1],
                'delta': result.delta[-1]
            }
        )
    
    def _parse_ms_signal(self, result, timeframe: str, price: float) -> Optional[StrategySignal]:
        """Parse Market Structure signal"""
        last_signal = result.signals[-1]
        
        if last_signal == 'HOLD':
            return None
        
        is_long = 'LONG' in last_signal or last_signal == 'BUY'
        direction = TradeDirection.LONG.value if is_long else TradeDirection.SHORT.value
        confidence = result.confidence[-1]
        
        # Boost confidence for reversal/continuation signals
        signal_boost = 1.2 if 'REVERSAL' in last_signal or 'CONTINUATION' in last_signal else 1.0
        
        return StrategySignal(
            strategy_name='Market Structure',
            direction=direction,
            strength=min(confidence * signal_boost, 100),
            confidence=confidence,
            timeframe=timeframe,
            price=price,
            timestamp=datetime.now(),
            metadata={
                'trend': result.trend[-1],
                'structure_break': result.structure_breaks[-1]
            }
        )
    
    def calculate_consensus(
        self,
        signals: Dict[str, List[StrategySignal]]
    ) -> Tuple[str, float, Dict]:
        """
        Calculate consensus from multiple signals
        
        Returns:
            (direction, confidence, details)
        """
        long_score = 0.0
        short_score = 0.0
        total_weight = 0.0
        
        strategy_votes = {'long': [], 'short': [], 'neutral': []}
        timeframe_alignment = {}
        
        for timeframe, tf_signals in signals.items():
            tf_weight = self.timeframe_weights.get(timeframe, 1.0)
            
            tf_long = 0
            tf_short = 0
            
            for signal in tf_signals:
                weight = (signal.confidence / 100) * tf_weight
                
                if signal.direction == TradeDirection.LONG.value:
                    long_score += weight
                    tf_long += 1
                    strategy_votes['long'].append(signal.strategy_name)
                elif signal.direction == TradeDirection.SHORT.value:
                    short_score += weight
                    tf_short += 1
                    strategy_votes['short'].append(signal.strategy_name)
                
                total_weight += tf_weight
            
            # Record timeframe alignment
            if tf_long > tf_short:
                timeframe_alignment[timeframe] = 'LONG'
            elif tf_short > tf_long:
                timeframe_alignment[timeframe] = 'SHORT'
            else:
                timeframe_alignment[timeframe] = 'NEUTRAL'
        
        # Calculate consensus
        if total_weight == 0:
            return TradeDirection.NEUTRAL.value, 0.0, {}
        
        long_consensus = long_score / total_weight
        short_consensus = short_score / total_weight
        
        details = {
            'long_score': long_consensus,
            'short_score': short_consensus,
            'strategy_votes': strategy_votes,
            'timeframe_alignment': timeframe_alignment,
            'total_signals': sum(len(s) for s in signals.values())
        }
        
        # Determine direction and confidence
        if long_consensus > short_consensus and long_consensus >= self.min_consensus:
            return TradeDirection.LONG.value, long_consensus, details
        elif short_consensus > long_consensus and short_consensus >= self.min_consensus:
            return TradeDirection.SHORT.value, short_consensus, details
        else:
            return TradeDirection.NEUTRAL.value, max(long_consensus, short_consensus), details
    
    def calculate_entry_levels(
        self,
        signals: Dict[str, List[StrategySignal]],
        direction: str,
        current_price: float
    ) -> Tuple[float, float, List[float]]:
        """
        Calculate entry, stop loss, and take profit levels
        
        Returns:
            (entry, stop_loss, take_profits)
        """
        # Collect relevant levels from signals
        entry_prices = []
        stop_levels = []
        support_resistance = []
        
        for tf_signals in signals.values():
            for signal in tf_signals:
                if signal.direction == direction:
                    entry_prices.append(signal.price)
                    
                    # Extract stop levels from metadata
                    if signal.metadata:
                        if 'trailing_stop' in signal.metadata:
                            stop_levels.append(signal.metadata['trailing_stop'])
                        if 'poc' in signal.metadata:
                            support_resistance.append(signal.metadata['poc'])
        
        # Entry: weighted average of signal prices
        entry = np.mean(entry_prices) if entry_prices else current_price
        
        # Stop loss: use ATR-based approach
        atr_estimate = abs(current_price - entry) * 2  # Simple estimate
        
        if direction == TradeDirection.LONG.value:
            # Long stop: below entry
            if stop_levels:
                stop_loss = min(stop_levels)
            else:
                stop_loss = entry - (atr_estimate * 1.5)
        else:
            # Short stop: above entry
            if stop_levels:
                stop_loss = max(stop_levels)
            else:
                stop_loss = entry + (atr_estimate * 1.5)
        
        # Take profits: multiple levels
        risk = abs(entry - stop_loss)
        take_profits = [
            entry + (risk * 1.5) if direction == TradeDirection.LONG.value else entry - (risk * 1.5),
            entry + (risk * 2.5) if direction == TradeDirection.LONG.value else entry - (risk * 2.5),
            entry + (risk * 4.0) if direction == TradeDirection.LONG.value else entry - (risk * 4.0)
        ]
        
        return entry, stop_loss, take_profits
    
    def calculate_position_size(
        self,
        equity: float,
        entry: float,
        stop_loss: float,
        confidence: float
    ) -> float:
        """Calculate position size based on risk management"""
        # Risk per trade adjusted by confidence
        risk_pct = self.max_risk_per_trade * (confidence / 100)
        risk_amount = equity * risk_pct
        
        # Position size based on stop distance
        stop_distance = abs(entry - stop_loss)
        position_size = risk_amount / stop_distance
        
        # Adjust for price
        position_size_pct = (position_size * entry) / equity
        
        return min(position_size_pct, 0.20)  # Max 20% of equity per trade
    
    def calculate_edge_score(
        self,
        signals: Dict[str, List[StrategySignal]],
        consensus_details: Dict,
        risk_reward: float
    ) -> float:
        """
        Calculate overall edge score (0-100)
        
        Factors:
        - Strategy agreement
        - Timeframe alignment
        - Risk/reward ratio
        - Signal quality
        """
        score = 0.0
        
        # Strategy agreement (0-40 points)
        total_strategies = len(self.strategies)
        agreeing = len(set(consensus_details['strategy_votes'].get('long', []) + 
                          consensus_details['strategy_votes'].get('short', [])))
        score += (agreeing / total_strategies) * 40
        
        # Timeframe alignment (0-25 points)
        tf_alignment = consensus_details['timeframe_alignment']
        aligned_tfs = sum(1 for direction in tf_alignment.values() 
                         if direction != 'NEUTRAL')
        score += (aligned_tfs / len(tf_alignment)) * 25
        
        # Risk/reward (0-20 points)
        if risk_reward >= 3.0:
            score += 20
        elif risk_reward >= 2.0:
            score += 15
        elif risk_reward >= 1.5:
            score += 10
        
        # Signal quality (0-15 points)
        avg_confidence = np.mean([
            s.confidence 
            for tf_signals in signals.values() 
            for s in tf_signals
        ])
        score += (avg_confidence / 100) * 15
        
        return min(score, 100)
    
    def generate_trade_recommendation(
        self,
        data: Dict[str, pd.DataFrame],
        equity: float,
        timeframes: Optional[List[str]] = None
    ) -> Optional[ConsensusTrade]:
        """
        Generate consensus trade recommendation
        
        Args:
            data: Multi-timeframe OHLCV data
            equity: Current account equity
            timeframes: Timeframes to analyze
            
        Returns:
            ConsensusTrade or None if no consensus
        """
        # Collect signals
        signals = self.collect_signals(data, timeframes)
        
        if not signals:
            return None
        
        # Calculate consensus
        direction, confidence, details = self.calculate_consensus(signals)
        
        if direction == TradeDirection.NEUTRAL.value:
            return None
        
        # Get current price (from shortest timeframe)
        shortest_tf = min(signals.keys(), key=lambda x: self.timeframe_weights.get(x, 1))
        current_price = data[shortest_tf]['close'].iloc[-1]
        
        # Calculate entry levels
        entry, stop_loss, take_profits = self.calculate_entry_levels(
            signals, direction, current_price
        )
        
        # Calculate risk/reward
        risk = abs(entry - stop_loss)
        reward = abs(take_profits[0] - entry)
        risk_reward = reward / risk if risk > 0 else 0
        
        if risk_reward < self.min_risk_reward:
            return None
        
        # Calculate position size
        position_size = self.calculate_position_size(
            equity, entry, stop_loss, confidence
        )
        
        # Calculate edge score
        edge_score = self.calculate_edge_score(signals, details, risk_reward)
        
        # Create trade recommendation
        trade = ConsensusTrade(
            direction=direction,
            entry_price=entry,
            stop_loss=stop_loss,
            take_profit=take_profits,
            position_size=position_size,
            confidence=confidence * 100,
            risk_reward_ratio=risk_reward,
            contributing_strategies=[
                s.strategy_name 
                for tf_signals in signals.values() 
                for s in tf_signals 
                if s.direction == direction
            ],
            timeframe_alignment=details['timeframe_alignment'],
            edge_score=edge_score,
            timestamp=datetime.now()
        )
        
        self.trade_history.append(trade)
        return trade
    
    def get_trade_summary(self, trade: ConsensusTrade) -> str:
        """Generate human-readable trade summary"""
        summary = f"""
{'='*70}
CONSENSUS TRADE RECOMMENDATION
{'='*70}

Direction: {trade.direction}
Entry Price: ${trade.entry_price:.2f}
Stop Loss: ${trade.stop_loss:.2f}
Take Profit 1: ${trade.take_profit[0]:.2f} (1.5R)
Take Profit 2: ${trade.take_profit[1]:.2f} (2.5R)
Take Profit 3: ${trade.take_profit[2]:.2f} (4.0R)

Position Size: {trade.position_size*100:.2f}% of equity
Risk/Reward: {trade.risk_reward_ratio:.2f}:1
Confidence: {trade.confidence:.1f}%
Edge Score: {trade.edge_score:.1f}/100

Contributing Strategies:
{chr(10).join(f"  • {s}" for s in set(trade.contributing_strategies))}

Timeframe Alignment:
{chr(10).join(f"  {tf}: {direction}" for tf, direction in trade.timeframe_alignment.items())}

Timestamp: {trade.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
{'='*70}
        """
        return summary


# Example usage
if __name__ == "__main__":
    print("Strategy Coordinator Example\n")
    print("="*70)
    print("\nTo use the coordinator, you need:")
    print("\n1. Initialize all 5 strategies:")
    print("   strategies = {")
    print("       'gradient_trend': GradientTrendFilter(),")
    print("       'ut_bot': UTBotStrategy(),")
    print("       'mean_reversion': MeanReversionEngine(),")
    print("       'volume_profile': VolumeProfileEngine(),")
    print("       'market_structure': MarketStructureEngine()")
    print("   }")
    print("\n2. Prepare multi-timeframe data:")
    print("   data = {")
    print("       'D1': df_daily,")
    print("       'H4': df_4hour,")
    print("       'H1': df_1hour,")
    print("       'M15': df_15min")
    print("   }")
    print("\n3. Create coordinator and generate trade:")
    print("   coordinator = StrategyCoordinator(strategies)")
    print("   trade = coordinator.generate_trade_recommendation(data, equity=10000)")
    print("   print(coordinator.get_trade_summary(trade))")
    print("\n" + "="*70)