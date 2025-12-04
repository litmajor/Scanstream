"""
Integration bridge for BBU meta-optimizer into StrategyCoordinator
Enables continuous learning and adaptive weighting across all strategies
"""

from typing import Dict, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json

# Import the meta-optimizer
from .bayesian_meta_optimizer import (
    BayesianBeliefUpdaterMeta,
    Evidence,
    MarketRegime,
    LearningHistory
)


@dataclass
class TradeOutcome:
    """Represents a closed trade for learning"""
    strategy_id: str
    entry_price: float
    exit_price: float
    direction: str  # 'LONG' or 'SHORT'
    entry_time: datetime
    exit_time: datetime
    signal_confidence: float
    entry_quality: float = 0.0
    exit_reason: str = 'exit_signal'  # 'tp', 'sl', 'exit_signal'
    pnl: float = field(init=False)
    pnl_percent: float = field(init=False)
    
    def __post_init__(self):
        if self.direction == 'LONG':
            self.pnl = self.exit_price - self.entry_price
            self.pnl_percent = (self.exit_price - self.entry_price) / self.entry_price * 100
        else:  # SHORT
            self.pnl = self.entry_price - self.exit_price
            self.pnl_percent = (self.entry_price - self.exit_price) / self.entry_price * 100


class BBUCoordinatorBridge:
    """
    Bridge integrating Bayesian Belief Updater into StrategyCoordinator
    Handles learning from trades and adaptive weighting
    """
    
    def __init__(self, strategies: Dict[str, any]):
        """
        Initialize BBU bridge
        
        Args:
            strategies: Dict of strategy_id -> strategy instance
        """
        self.belief_updater = BayesianBeliefUpdaterMeta()
        self.learning_history = LearningHistory()
        self.strategies = strategies
        self.trade_queue: List[TradeOutcome] = []
        self.processed_trades: List[TradeOutcome] = []
        
        # Initialize beliefs for all strategies
        for strategy_id in strategies.keys():
            self.belief_updater.initialize_strategy(strategy_id)
        
        # Market regime detection
        self.current_regime = MarketRegime.NEUTRAL
        self.regime_confidence = 0.0
        
        # Learning configuration
        self.learning_enabled = True
        self.min_samples_per_regime_update = 5
        self.regime_lookback_periods = 100
    
    def add_trade_for_learning(self, outcome: TradeOutcome):
        """Queue a trade for learning"""
        self.trade_queue.append(outcome)
    
    def process_pending_trades(self):
        """Process all queued trades through learning system"""
        if not self.learning_enabled or not self.trade_queue:
            return
        
        for trade in self.trade_queue:
            self._process_single_trade(trade)
        
        self.trade_queue.clear()
    
    def _process_single_trade(self, trade: TradeOutcome):
        """Process one trade and update beliefs"""
        
        # Extract evidence from trade
        evidence = self._extract_evidence(trade)
        
        # Update strategy belief
        belief = self.belief_updater.accumulate_evidence(
            trade.strategy_id,
            evidence
        )
        
        # Update confidence calibration
        self.belief_updater.update_calibration(
            trade.strategy_id,
            trade.signal_confidence,
            trade.pnl_percent > 0
        )
        
        # Get updated weights
        new_weights = self.belief_updater.get_adaptive_weights()
        
        # Record in learning history
        self.learning_history.add_event(
            strategy_id=trade.strategy_id,
            trade_outcome=self._trade_to_dict(trade),
            belief_update=belief,
            weights=new_weights
        )
        
        self.processed_trades.append(trade)
    
    def _extract_evidence(self, trade: TradeOutcome) -> Evidence:
        """Convert trade outcome to Bayesian evidence"""
        
        # Determine if profitable
        was_profitable = trade.pnl_percent > 0
        
        # Risk-adjusted return
        risk_adjusted = trade.pnl_percent / max(0.1, trade.signal_confidence)
        
        # Duration efficiency (faster closes are better)
        duration = (trade.exit_time - trade.entry_time).total_seconds() / 3600
        duration_efficiency = 1.0 / (1.0 + duration / 24.0)  # Decay over hours
        
        # Exit quality based on reason
        exit_quality = {
            'tp': 1.0,  # Took profit - ideal
            'sl': 0.3,  # Stop loss - acceptable loss management
            'exit_signal': 0.7  # Exit signal - decent
        }.get(trade.exit_reason, 0.5)
        
        # Confidence calibration
        if was_profitable:
            # If profitable, confidence was justified
            confidence_calibration = trade.signal_confidence
        else:
            # If lost, inverse of confidence (missed the risk)
            confidence_calibration = 1.0 - trade.signal_confidence
        
        return Evidence(
            was_profitable=was_profitable,
            roi=trade.pnl_percent,
            risk_adjusted_return=risk_adjusted,
            entry_quality=trade.entry_quality,
            exit_quality=exit_quality,
            duration_efficiency=duration_efficiency,
            regime_match=self._score_regime_match(trade),
            confidence_calibration=confidence_calibration,
            timestamp=trade.exit_time
        )
    
    def _score_regime_match(self, trade: TradeOutcome) -> float:
        """Score how well trade matched current regime"""
        
        # This would integrate with market regime detection
        # For now, return neutral score
        base_score = 0.5
        
        # If trade was profitable, assume some regime alignment
        if trade.pnl_percent > 0:
            base_score = min(1.0, base_score + 0.3)
        
        return base_score
    
    def _trade_to_dict(self, trade: TradeOutcome) -> Dict:
        """Convert trade to dict for serialization"""
        return {
            'strategy_id': trade.strategy_id,
            'direction': trade.direction,
            'entry_price': trade.entry_price,
            'exit_price': trade.exit_price,
            'entry_time': trade.entry_time.isoformat(),
            'exit_time': trade.exit_time.isoformat(),
            'pnl': trade.pnl,
            'pnl_percent': trade.pnl_percent,
            'signal_confidence': trade.signal_confidence,
            'exit_reason': trade.exit_reason
        }
    
    def get_adaptive_weights(self) -> Dict[str, float]:
        """Get current adaptive strategy weights"""
        if self.current_regime != MarketRegime.NEUTRAL:
            return self.belief_updater.get_regime_adjusted_weights(
                self.current_regime
            )
        else:
            return self.belief_updater.get_adaptive_weights()
    
    def update_market_regime(self, regime: MarketRegime, confidence: float = 1.0):
        """
        Update current market regime
        
        Args:
            regime: Current market regime
            confidence: Confidence in regime detection (0-1)
        """
        self.current_regime = regime
        self.regime_confidence = confidence
        self.belief_updater.set_market_regime(regime)
    
    def detect_market_regime(self, market_data: any, symbol: str, timeframe: str) -> MarketRegime:
        """
        Detect current market regime from OHLCV data
        
        Args:
            market_data: DataFrame or dict with OHLCV data
            symbol: Trading symbol
            timeframe: Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w)
        
        Returns:
            Detected regime
        """
        
        try:
            import pandas as pd
            
            if isinstance(market_data, dict):
                market_data = pd.DataFrame(market_data)
            
            if len(market_data) < 20:
                return MarketRegime.NEUTRAL
            
            # Calculate metrics
            close = market_data['close'].values
            high = market_data['high'].values
            low = market_data['low'].values
            volume = market_data.get('volume', [1] * len(close)).values
            
            # Volatility (ATR-based)
            tr = np.maximum(
                high - low,
                np.maximum(
                    abs(high - np.concatenate(([close[0]], close[:-1]))),
                    abs(low - np.concatenate(([close[0]], close[:-1])))
                )
            )
            atr = np.mean(tr[-20:])
            volatility = atr / close[-1]
            
            # Trend strength (ADX-like)
            up_moves = np.sum(np.diff(close) > 0)
            down_moves = np.sum(np.diff(close) < 0)
            trend_strength = abs(up_moves - down_moves) / len(close)
            
            # Mean reversion signal (RSI-like)
            delta = np.diff(close)
            gain = np.mean(np.maximum(delta, 0))
            loss = np.mean(np.maximum(-delta, 0))
            rs = gain / max(0.0001, loss)
            rsi = 100 - (100 / (1 + rs))
            mr_signal = 1.0 if 30 < rsi < 70 else 0.0
            
            # Classify regime
            if trend_strength > 0.7:
                regime = MarketRegime.TRENDING
            elif volatility > 0.03:
                regime = MarketRegime.VOLATILE
            elif mr_signal > 0.5:
                regime = MarketRegime.RANGING
            else:
                regime = MarketRegime.NEUTRAL
            
            # Update belief updater
            self.belief_updater.set_market_regime(regime)
            
            return regime
            
        except Exception as e:
            print(f"Error detecting regime: {e}")
            return MarketRegime.NEUTRAL
    
    def get_learning_metrics(self) -> Dict:
        """Get comprehensive learning metrics"""
        return self.belief_updater.get_metrics()
    
    def get_strategy_learning_summary(self, strategy_id: str) -> Dict:
        """Get detailed learning summary for specific strategy"""
        return self.belief_updater.get_learning_summary(strategy_id)
    
    def get_learning_history(self, hours: int = 24, strategy_id: Optional[str] = None) -> List[Dict]:
        """Get recent learning events"""
        events = self.learning_history.get_recent(
            minutes=hours * 60,
            strategy_id=strategy_id
        )
        
        return [
            {
                'timestamp': e['timestamp'].isoformat(),
                'strategy_id': e['strategy_id'],
                'pnl_percent': e['trade_outcome']['pnl_percent'],
                'signal_confidence': e['trade_outcome']['signal_confidence'],
                'belief_state': e['belief_state'],
                'new_weight': e['new_weight'],
                'all_weights': e['all_weights']
            }
            for e in events
        ]
    
    def reset_learning(self):
        """Reset all beliefs to priors (for testing/recalibration)"""
        self.belief_updater.reset_to_priors()
        self.learning_history = LearningHistory()
        self.processed_trades.clear()
    
    def export_learning_state(self) -> Dict:
        """Export current learning state for persistence"""
        return {
            'timestamp': datetime.now().isoformat(),
            'metrics': self.get_learning_metrics(),
            'regime': self.current_regime.value,
            'regime_confidence': self.regime_confidence,
            'trade_count': len(self.processed_trades),
            'learning_history_size': len(self.learning_history.events)
        }
    
    def get_weight_evolution(self, strategy_id: str) -> Tuple[List[datetime], List[float]]:
        """Get weight evolution curve for visualization"""
        return self.learning_history.get_strategy_curve(strategy_id)


# Helper imports for convenience
import numpy as np


if __name__ == "__main__":
    """
    Example usage of BBU bridge with StrategyCoordinator
    """
    
    # Initialize bridge with dummy strategies
    strategies = {
        'volume_sr': None,
        'ma_crossover': None,
        'rsi_bounce': None,
        'enhanced_bounce': None
    }
    
    bridge = BBUCoordinatorBridge(strategies)
    
    # Simulate some trades
    import random
    from datetime import datetime, timedelta
    
    base_time = datetime.now()
    
    for i in range(50):
        strategy_id = random.choice(list(strategies.keys()))
        
        # Create simulated trade
        entry_time = base_time - timedelta(hours=random.randint(1, 48))
        exit_time = entry_time + timedelta(hours=random.uniform(0.5, 8))
        entry_price = 100.0
        exit_price = entry_price * (1 + random.uniform(-0.05, 0.08))
        confidence = random.uniform(0.4, 0.95)
        
        trade = TradeOutcome(
            strategy_id=strategy_id,
            entry_price=entry_price,
            exit_price=exit_price,
            direction='LONG',
            entry_time=entry_time,
            exit_time=exit_time,
            signal_confidence=confidence,
            entry_quality=random.uniform(0.5, 1.0),
            exit_reason=random.choice(['tp', 'sl', 'exit_signal'])
        )
        
        bridge.add_trade_for_learning(trade)
    
    # Process trades
    bridge.process_pending_trades()
    
    # Display results
    print("\n=== BBU Bridge Learning Summary ===")
    print(f"Processed Trades: {len(bridge.processed_trades)}")
    print(f"Current Regime: {bridge.current_regime.value}")
    
    metrics = bridge.get_learning_metrics()
    
    print("\nAdaptive Weights:")
    for sid, weight in metrics['adaptive_weights'].items():
        print(f"  {sid}: {weight:.4f}")
    
    print("\nStrategy Learning Summaries:")
    for strategy_id in strategies.keys():
        summary = bridge.get_strategy_learning_summary(strategy_id)
        if summary:
            print(f"  {strategy_id}:")
            print(f"    Win Rate: {summary['win_rate']:.1%}")
            print(f"    Confidence: {summary['confidence']:.3f}")
            print(f"    Current Weight: {summary['current_weight']:.4f}")
