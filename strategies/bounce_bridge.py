"""
Bounce Strategy Bridge - Clean integration point
Connects EnhancedBounceStrategy to the StrategyCoordinator for seamless consensus building.

This bridge allows the enhanced bounce strategy to participate in multi-strategy
consensus voting and signal aggregation.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime

from enhanced_bounce_strategy import EnhancedBounceStrategy
from volume_sr_agent import VolumeSupportResistance


@dataclass
class BounceStrategySignal:
    """Signal from enhanced bounce strategy formatted for coordinator"""
    strategy_name: str = 'EnhancedBounce'
    direction: str = 'HOLD'  # 'BUY', 'SELL', 'HOLD'
    strength: float = 0.0  # 0-100
    confidence: float = 0.0  # 0-100
    timeframe: str = '1h'
    price: float = 0.0
    bounce_detected: bool = False
    zone_confluence_score: float = 0.0
    zone_price: float = 0.0
    quality_reasons: List[str] = None
    metadata: Optional[Dict] = None


class BounceStrategyBridge:
    """
    Bridge between EnhancedBounceStrategy and StrategyCoordinator.
    
    Converts enhanced bounce strategy results into coordinator-compatible signals.
    Enables the bounce strategy to vote in consensus decision-making.
    """
    
    def __init__(self, risk_profile: str = 'moderate'):
        """Initialize bounce strategy with bridge capabilities"""
        self.bounce_strategy = EnhancedBounceStrategy(risk_profile=risk_profile)
        self.volume_sr = VolumeSupportResistance()
        self.strategy_name = 'EnhancedBounce'
        self.last_signal = None
        self.signal_history = []
    
    def generate_signal(
        self,
        df_dict: Dict[str, pd.DataFrame],
        current_price: float,
        timeframe: str = '1h'
    ) -> BounceStrategySignal:
        """
        Generate coordinator-compatible signal from bounce analysis.
        
        Args:
            df_dict: Multi-timeframe data {timeframe: DataFrame}
            current_price: Current price level
            timeframe: Primary timeframe for analysis
        
        Returns:
            BounceStrategySignal formatted for coordinator
        """
        
        # Evaluate bounce strategy
        bounce_result = self.bounce_strategy.evaluate(df_dict, current_price)
        
        # Map bounce strategy result to coordinator signal format
        signal = BounceStrategySignal()
        signal.timeframe = timeframe
        signal.price = current_price
        signal.bounce_detected = bounce_result.get('bounce_detected', False)
        signal.zone_confluence_score = bounce_result.get('confluence_strength', 0.0)
        
        # Get zone details
        zone = bounce_result.get('zone_details', {})
        if zone:
            signal.zone_price = float(zone.get('price', 0))
        
        # Map signal direction
        bounce_signal = bounce_result.get('signal', 'HOLD')
        signal.direction = bounce_signal
        
        # Convert strength/confidence to 0-100 scale
        signal.strength = bounce_result.get('strength', 0.0) * 100
        signal.confidence = bounce_result.get('confidence', 0.0) * 100
        
        # Store quality reasons
        signal.quality_reasons = bounce_result.get('quality_reasons', [])
        
        # Create metadata for coordinator
        signal.metadata = {
            'zone_price': signal.zone_price,
            'zone_confluence': signal.zone_confluence_score,
            'timeframe_alignment': bounce_result.get('timeframe_alignment', {}),
            'bounce_strength': bounce_result.get('bounce_strength', 0.0),
            'full_result': bounce_result
        }
        
        # Store for history
        self.last_signal = signal
        self.signal_history.append({
            'timestamp': datetime.now(),
            'signal': signal
        })
        
        return signal
    
    def get_consensus_contribution(
        self,
        signal: BounceStrategySignal
    ) -> Dict[str, Any]:
        """
        Convert signal to consensus contribution format.
        
        Returns dict with weighted vote for coordinator consensus mechanism.
        """
        
        # Base vote weight from signal strength and confidence
        vote_weight = (signal.strength / 100) * (signal.confidence / 100)
        
        # Directional voting
        if signal.direction == 'BUY':
            vote = 1.0 * vote_weight
        elif signal.direction == 'SELL':
            vote = -1.0 * vote_weight
        else:
            vote = 0.0
        
        # Zone confluence bonus (higher confluence = more confident)
        confluence_bonus = signal.zone_confluence_score * 0.2
        adjusted_vote = vote + (confidence_bonus if vote > 0 else -confidence_bonus)
        
        return {
            'strategy': self.strategy_name,
            'vote': np.clip(adjusted_vote, -1.0, 1.0),
            'weight': vote_weight,
            'direction': signal.direction,
            'confidence': signal.confidence / 100.0,
            'timeframe': signal.timeframe,
            'bounce_detected': signal.bounce_detected,
            'zone_confluence': signal.zone_confluence_score,
            'metadata': signal.metadata
        }
    
    def backtest(
        self,
        df_dict: Dict[str, pd.DataFrame],
        timeframe: str = '1h'
    ) -> Dict[str, Any]:
        """
        Backtest enhanced bounce strategy over historical period.
        
        Returns performance metrics suitable for coordinator evaluation.
        """
        
        # Get primary dataframe for iteration
        primary_tf = timeframe
        if primary_tf not in df_dict:
            primary_tf = list(df_dict.keys())[0]
        
        primary_df = df_dict[primary_tf]
        signals_generated = []
        trades = []
        
        # Iterate through historical data
        for i in range(100, len(primary_df)):  # Start from bar 100 for indicator warmup
            # Get data up to current bar
            current_data = {
                tf: df.iloc[:i+1].copy() for tf, df in df_dict.items()
            }
            
            current_price = primary_df['close'].iloc[i]
            
            # Generate signal
            signal = self.generate_signal(current_data, current_price, primary_tf)
            
            if signal.bounce_detected:
                signals_generated.append({
                    'bar': i,
                    'price': current_price,
                    'signal': signal
                })
        
        # Evaluate trades (simple: buy at signal, exit 5 bars later)
        for sig in signals_generated:
            entry_bar = sig['bar']
            entry_price = sig['price']
            
            if entry_bar + 5 < len(primary_df):
                exit_bar = entry_bar + 5
                exit_price = primary_df['close'].iloc[exit_bar]
                
                pnl = exit_price - entry_price
                pnl_pct = (pnl / entry_price) * 100
                
                trades.append({
                    'entry_bar': entry_bar,
                    'exit_bar': exit_bar,
                    'entry_price': entry_price,
                    'exit_price': exit_price,
                    'pnl': pnl,
                    'pnl_pct': pnl_pct,
                    'win': pnl > 0
                })
        
        # Calculate metrics
        if trades:
            pnls = [t['pnl_pct'] for t in trades]
            wins = sum(1 for t in trades if t['win'])
            
            metrics = {
                'total_signals': len(signals_generated),
                'total_trades': len(trades),
                'win_rate': (wins / len(trades)) * 100 if trades else 0,
                'avg_pnl': np.mean(pnls),
                'total_pnl': np.sum(pnls),
                'sharpe_ratio': np.mean(pnls) / (np.std(pnls) + 1e-6) if np.std(pnls) > 0 else 0,
                'max_gain': np.max(pnls) if pnls else 0,
                'max_loss': np.min(pnls) if pnls else 0,
                'trades': trades
            }
        else:
            metrics = {
                'total_signals': 0,
                'total_trades': 0,
                'win_rate': 0,
                'avg_pnl': 0,
                'total_pnl': 0,
                'sharpe_ratio': 0,
                'max_gain': 0,
                'max_loss': 0,
                'trades': []
            }
        
        return metrics
    
    def get_strategy_info(self) -> Dict[str, Any]:
        """Return strategy metadata for coordinator"""
        return {
            'name': self.strategy_name,
            'type': 'pattern_recognition',
            'pattern': 'support_bounce',
            'description': 'Multi-timeframe volume-weighted bounce detection with Bayesian confirmation',
            'primary_timeframes': ['1m', '5m', '1h', '4h'],
            'features': [
                'Fractal pivot detection',
                'Volume-weighted zones',
                'Multi-timeframe confluence',
                'Bayesian confidence scoring',
                'Institutional volume confirmation'
            ],
            'performance_target_sharpe': 1.5,
            'min_zone_strength': 0.5,
            'min_volume_ratio': 1.5,
            'min_price_recovery': 0.02
        }


# Example usage
"""
# Initialize bridge
bridge = BounceStrategyBridge(risk_profile='moderate')

# Generate signal for coordinator
signal = bridge.generate_signal(df_dict, current_price, '1h')

# Get consensus contribution
consensus_vote = bridge.get_consensus_contribution(signal)

# Use in coordinator
coordinator.add_strategy_signal(consensus_vote)

# Backtest strategy
metrics = bridge.backtest(df_dict, '1h')
print(f"Sharpe Ratio: {metrics['sharpe_ratio']:.2f}")
print(f"Win Rate: {metrics['win_rate']:.1f}%")
"""
