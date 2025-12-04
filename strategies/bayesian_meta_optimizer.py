"""
Bayesian Belief Updater - System-Wide Meta-Optimizer
Transforms all strategies through continuous learning and adaptive weighting
"""

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from enum import Enum


class MarketRegime(Enum):
    """Market condition classification"""
    TRENDING = "TRENDING"
    RANGING = "RANGING"
    VOLATILE = "VOLATILE"
    NEUTRAL = "NEUTRAL"


@dataclass
class Evidence:
    """Represents evidence from a trade outcome"""
    was_profitable: bool
    roi: float  # Return percentage
    risk_adjusted_return: float  # ROI / confidence
    entry_quality: float  # 0-1, how good was entry
    exit_quality: float  # 0-1, how good was exit
    duration_efficiency: float  # Speed to close
    regime_match: float  # Alignment with market regime
    confidence_calibration: float  # How well confidence predicted outcome
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class StrategyBelief:
    """Tracks belief about a strategy's effectiveness"""
    strategy_id: str
    
    # Prior belief (initial assumption)
    prior_win_rate: float = 0.55  # Assume >50% by default
    prior_sharpe: float = 1.0
    prior_accuracy: float = 0.55
    
    # Posterior belief (after evidence)
    posterior_win_rate: float = 0.55
    posterior_sharpe: float = 1.0
    posterior_accuracy: float = 0.55
    
    # Confidence metrics
    confidence: float = 0.1  # Low initially, increases with evidence
    samples_analyzed: int = 0
    
    # Learning history
    evidence_history: List[Evidence] = field(default_factory=list)
    weight_history: List[Tuple[datetime, float]] = field(default_factory=list)
    
    # Performance tracking
    total_wins: int = 0
    total_trades: int = 0
    avg_roi: float = 0.0
    max_drawdown: float = 0.0
    
    @property
    def accuracy_improvement(self) -> float:
        """How much has belief improved from prior"""
        return (self.posterior_accuracy - self.prior_accuracy) / self.prior_accuracy
    
    @property
    def belief_convergence(self) -> float:
        """How confident are we in current belief (0-1)"""
        # Higher confidence with more samples
        return min(1.0, self.samples_analyzed / 100.0)
    
    def reset_to_prior(self):
        """Reset posterior beliefs to priors"""
        self.posterior_win_rate = self.prior_win_rate
        self.posterior_sharpe = self.prior_sharpe
        self.posterior_accuracy = self.prior_accuracy
        self.confidence = 0.1
        self.samples_analyzed = 0


@dataclass
class CalibrationMetrics:
    """Tracks how well strategy confidence predicts outcomes"""
    high_confidence_win_rate: float = 0.0  # Signals >80% confidence
    medium_confidence_win_rate: float = 0.0  # Signals 50-80% confidence
    low_confidence_win_rate: float = 0.0  # Signals <50% confidence
    
    high_confidence_count: int = 0
    medium_confidence_count: int = 0
    low_confidence_count: int = 0
    
    @property
    def calibration_error(self) -> float:
        """Measure of confidence vs actual performance"""
        expected_high = 0.80
        expected_medium = 0.65
        expected_low = 0.50
        
        error = 0.0
        error += abs(self.high_confidence_win_rate - expected_high) * 0.4
        error += abs(self.medium_confidence_win_rate - expected_medium) * 0.4
        error += abs(self.low_confidence_win_rate - expected_low) * 0.2
        
        return error


class BayesianBeliefUpdaterMeta:
    """
    System-wide meta-optimizer using Bayesian inference
    Updates beliefs about all strategies based on trade outcomes
    """
    
    def __init__(self):
        self.strategy_beliefs: Dict[str, StrategyBelief] = {}
        self.learning_history: List[Dict] = []
        self.regime_beliefs: Dict[str, Dict[MarketRegime, float]] = {}
        self.calibration_metrics: Dict[str, CalibrationMetrics] = {}
        self.current_regime: MarketRegime = MarketRegime.NEUTRAL
        
        # Hyperparameters
        self.learning_rate = 0.1  # Speed of belief updates
        self.confidence_growth = 0.02  # How quickly confidence increases
        self.regime_adaptation_weight = 0.3  # Regime influence on weighting
        
    def initialize_strategy(self, strategy_id: str, prior_win_rate: float = 0.55):
        """Initialize belief state for a new strategy"""
        belief = StrategyBelief(
            strategy_id=strategy_id,
            prior_win_rate=prior_win_rate,
            posterior_win_rate=prior_win_rate
        )
        self.strategy_beliefs[strategy_id] = belief
        self.calibration_metrics[strategy_id] = CalibrationMetrics()
        
        # Initialize regime beliefs
        self.regime_beliefs[strategy_id] = {
            regime: prior_win_rate
            for regime in MarketRegime
        }
    
    def accumulate_evidence(self, strategy_id: str, evidence: Evidence) -> StrategyBelief:
        """
        Update belief using Bayes theorem
        P(H|E) = P(E|H) * P(H) / P(E)
        """
        if strategy_id not in self.strategy_beliefs:
            self.initialize_strategy(strategy_id)
        
        belief = self.strategy_beliefs[strategy_id]
        
        # Extract belief components
        prior = belief.posterior_accuracy
        
        # Calculate likelihood P(E|H) - probability of evidence given hypothesis
        if evidence.was_profitable:
            likelihood = evidence.risk_adjusted_return  # Higher ROI = stronger evidence
        else:
            likelihood = 1.0 - abs(evidence.roi)  # Loss severity matters
        
        likelihood = np.clip(likelihood, 0.01, 0.99)
        
        # Calculate evidence strength P(E) - marginal likelihood
        # Weight all factors
        evidence_strength = (
            0.3 * (1.0 if evidence.was_profitable else 0.0) +
            0.2 * evidence.entry_quality +
            0.2 * evidence.exit_quality +
            0.15 * evidence.regime_match +
            0.15 * evidence.confidence_calibration
        )
        evidence_strength = np.clip(evidence_strength, 0.01, 0.99)
        
        # Apply Bayes theorem
        posterior = (likelihood * prior) / evidence_strength
        posterior = np.clip(posterior, 0.0, 1.0)
        
        # Update with learning rate (don't swing wildly)
        updated_posterior = (
            prior * (1 - self.learning_rate) +
            posterior * self.learning_rate
        )
        
        # Update belief state
        belief.posterior_accuracy = updated_posterior
        belief.samples_analyzed += 1
        belief.confidence = min(
            0.95,
            belief.confidence + self.confidence_growth
        )
        belief.evidence_history.append(evidence)
        
        # Update win rate tracking
        if evidence.was_profitable:
            belief.total_wins += 1
        belief.total_trades += 1
        belief.avg_roi = (
            belief.avg_roi * (belief.total_trades - 1) +
            evidence.roi
        ) / belief.total_trades
        
        # Track weight history
        new_weight = self.get_weight(strategy_id)
        belief.weight_history.append((datetime.now(), new_weight))
        
        return belief
    
    def update_regime_belief(self, strategy_id: str, regime: MarketRegime, 
                            performance: float):
        """Update how well strategy performs in specific regime"""
        if strategy_id not in self.regime_beliefs:
            self.regime_beliefs[strategy_id] = {r: 0.55 for r in MarketRegime}
        
        current = self.regime_beliefs[strategy_id][regime]
        
        # Adaptive update based on performance
        updated = (
            current * (1 - self.learning_rate) +
            performance * self.learning_rate
        )
        
        self.regime_beliefs[strategy_id][regime] = np.clip(updated, 0.0, 1.0)
    
    def update_calibration(self, strategy_id: str, confidence: float,
                          actual_outcome: bool):
        """Track how well confidence predicts results"""
        calibration = self.calibration_metrics[strategy_id]
        
        if confidence > 0.8:
            calibration.high_confidence_count += 1
            if actual_outcome:
                calibration.high_confidence_win_rate = (
                    calibration.high_confidence_win_rate * 
                    (calibration.high_confidence_count - 1) +
                    1.0
                ) / calibration.high_confidence_count
        
        elif confidence > 0.5:
            calibration.medium_confidence_count += 1
            if actual_outcome:
                calibration.medium_confidence_win_rate = (
                    calibration.medium_confidence_win_rate * 
                    (calibration.medium_confidence_count - 1) +
                    1.0
                ) / calibration.medium_confidence_count
        
        else:
            calibration.low_confidence_count += 1
            if actual_outcome:
                calibration.low_confidence_win_rate = (
                    calibration.low_confidence_win_rate * 
                    (calibration.low_confidence_count - 1) +
                    1.0
                ) / calibration.low_confidence_count
    
    def get_weight(self, strategy_id: str) -> float:
        """Get adaptive weight for strategy based on belief"""
        if strategy_id not in self.strategy_beliefs:
            return 1.0 / len(self.strategy_beliefs) if self.strategy_beliefs else 1.0
        
        belief = self.strategy_beliefs[strategy_id]
        
        # Weight = posterior accuracy * confidence
        # Higher accuracy and confidence = higher weight
        base_weight = belief.posterior_accuracy * belief.confidence
        
        return np.clip(base_weight, 0.0, 2.0)
    
    def get_adaptive_weights(self, normalize: bool = True) -> Dict[str, float]:
        """Get all strategy weights normalized"""
        weights = {
            strategy_id: self.get_weight(strategy_id)
            for strategy_id in self.strategy_beliefs.keys()
        }
        
        if normalize and weights:
            total = sum(weights.values())
            if total > 0:
                weights = {k: v / total for k, v in weights.items()}
        
        return weights
    
    def get_regime_adjusted_weights(self, regime: MarketRegime, 
                                   normalize: bool = True) -> Dict[str, float]:
        """Get weights optimized for current market regime"""
        weights = {}
        
        for strategy_id in self.strategy_beliefs:
            base_weight = self.get_weight(strategy_id)
            regime_factor = self.regime_beliefs.get(
                strategy_id, {}
            ).get(regime, 0.55)
            
            # Blend base weight with regime-specific performance
            adjusted_weight = (
                base_weight * (1 - self.regime_adaptation_weight) +
                regime_factor * self.regime_adaptation_weight
            )
            
            weights[strategy_id] = adjusted_weight
        
        if normalize and weights:
            total = sum(weights.values())
            if total > 0:
                weights = {k: v / total for k, v in weights.items()}
        
        return weights
    
    def set_market_regime(self, regime: MarketRegime):
        """Update current market regime"""
        self.current_regime = regime
    
    def reset_to_priors(self):
        """Reset all posterior beliefs to priors (for testing)"""
        for belief in self.strategy_beliefs.values():
            belief.reset_to_prior()
        
        self.learning_history.clear()
    
    def get_metrics(self) -> Dict:
        """Get comprehensive learning metrics"""
        return {
            'timestamp': datetime.now().isoformat(),
            'strategy_beliefs': {
                sid: {
                    'prior_accuracy': b.prior_accuracy,
                    'posterior_accuracy': b.posterior_accuracy,
                    'confidence': b.confidence,
                    'samples': b.samples_analyzed,
                    'accuracy_improvement': b.accuracy_improvement,
                    'win_rate': b.total_wins / max(1, b.total_trades),
                    'avg_roi': b.avg_roi,
                    'current_weight': self.get_weight(sid)
                }
                for sid, b in self.strategy_beliefs.items()
            },
            'adaptive_weights': self.get_adaptive_weights(),
            'regime_adjusted_weights': self.get_regime_adjusted_weights(
                self.current_regime
            ),
            'current_regime': self.current_regime.value,
            'regime_beliefs': {
                sid: {r.value: w for r, w in beliefs.items()}
                for sid, beliefs in self.regime_beliefs.items()
            },
            'calibration': {
                sid: {
                    'error': cal.calibration_error,
                    'high_conf_wr': cal.high_confidence_win_rate,
                    'med_conf_wr': cal.medium_confidence_win_rate,
                    'low_conf_wr': cal.low_confidence_win_rate,
                    'high_conf_count': cal.high_confidence_count,
                    'med_conf_count': cal.medium_confidence_count,
                    'low_conf_count': cal.low_confidence_count
                }
                for sid, cal in self.calibration_metrics.items()
            }
        }
    
    def get_learning_summary(self, strategy_id: str) -> Dict:
        """Get detailed learning summary for a strategy"""
        if strategy_id not in self.strategy_beliefs:
            return {}
        
        belief = self.strategy_beliefs[strategy_id]
        
        return {
            'strategy_id': strategy_id,
            'learning_started': belief.evidence_history[0].timestamp if belief.evidence_history else None,
            'samples_analyzed': belief.samples_analyzed,
            'win_rate': belief.total_wins / max(1, belief.total_trades),
            'avg_roi': belief.avg_roi,
            'max_drawdown': belief.max_drawdown,
            'confidence': belief.confidence,
            'prior_accuracy': belief.prior_accuracy,
            'posterior_accuracy': belief.posterior_accuracy,
            'accuracy_improvement': belief.accuracy_improvement,
            'current_weight': self.get_weight(strategy_id),
            'regime_performance': self.regime_beliefs.get(strategy_id, {}),
            'recent_trades': [
                {
                    'timestamp': e.timestamp.isoformat(),
                    'profitable': e.was_profitable,
                    'roi': e.roi,
                    'regime_match': e.regime_match
                }
                for e in belief.evidence_history[-10:]
            ]
        }


class LearningHistory:
    """Track learning events for visualization"""
    
    def __init__(self, max_history: int = 10000):
        self.events: List[Dict] = []
        self.max_history = max_history
    
    def add_event(self, strategy_id: str, trade_outcome: Dict, 
                 belief_update: StrategyBelief, weights: Dict[str, float]):
        """Record learning event"""
        event = {
            'timestamp': datetime.now(),
            'strategy_id': strategy_id,
            'trade_outcome': trade_outcome,
            'belief_state': {
                'posterior_accuracy': belief_update.posterior_accuracy,
                'confidence': belief_update.confidence,
                'samples': belief_update.samples_analyzed
            },
            'new_weight': weights.get(strategy_id, 1.0),
            'all_weights': weights
        }
        
        self.events.append(event)
        
        # Trim history if too large
        if len(self.events) > self.max_history:
            self.events = self.events[-self.max_history:]
    
    def get_recent(self, minutes: int = 60, strategy_id: Optional[str] = None) -> List[Dict]:
        """Get recent events"""
        cutoff = datetime.now() - timedelta(minutes=minutes)
        
        events = [e for e in self.events if e['timestamp'] > cutoff]
        
        if strategy_id:
            events = [e for e in events if e['strategy_id'] == strategy_id]
        
        return events
    
    def get_range(self, days: int = 7, strategy_id: Optional[str] = None) -> List[Dict]:
        """Get events from date range"""
        cutoff = datetime.now() - timedelta(days=days)
        
        events = [e for e in self.events if e['timestamp'] > cutoff]
        
        if strategy_id:
            events = [e for e in events if e['strategy_id'] == strategy_id]
        
        return events
    
    def get_strategy_curve(self, strategy_id: str) -> Tuple[List[datetime], List[float]]:
        """Get weight evolution curve for strategy"""
        strategy_events = [e for e in self.events if e['strategy_id'] == strategy_id]
        
        timestamps = [e['timestamp'] for e in strategy_events]
        weights = [e['new_weight'] for e in strategy_events]
        
        return timestamps, weights


# Example usage and testing
if __name__ == "__main__":
    # Initialize meta-optimizer
    bbu = BayesianBeliefUpdaterMeta()
    
    # Initialize strategies
    for strategy_id in ['volume_sr', 'ma_crossover', 'rsi_bounce', 'enhanced_bounce']:
        bbu.initialize_strategy(strategy_id)
    
    # Simulate trades
    import random
    random.seed(42)
    
    for i in range(100):
        strategy_id = random.choice(list(bbu.strategy_beliefs.keys()))
        
        # Simulate evidence
        was_profitable = random.random() > 0.45  # 55% win rate
        roi = random.uniform(-2.0, 3.0) if was_profitable else random.uniform(-5.0, -0.5)
        confidence = random.uniform(0.4, 0.95)
        
        evidence = Evidence(
            was_profitable=was_profitable,
            roi=roi,
            risk_adjusted_return=roi / confidence,
            entry_quality=random.uniform(0.5, 1.0),
            exit_quality=random.uniform(0.5, 1.0),
            duration_efficiency=random.uniform(0.5, 1.0),
            regime_match=random.uniform(0.5, 1.0),
            confidence_calibration=confidence if was_profitable else 1.0 - confidence
        )
        
        # Update belief
        bbu.accumulate_evidence(strategy_id, evidence)
        bbu.update_calibration(strategy_id, confidence, was_profitable)
    
    # Display metrics
    metrics = bbu.get_metrics()
    print("\n=== Learning Metrics ===")
    print(f"Timestamp: {metrics['timestamp']}")
    print(f"Current Regime: {metrics['current_regime']}")
    print("\nStrategy Beliefs:")
    for sid, belief in metrics['strategy_beliefs'].items():
        print(f"  {sid}:")
        print(f"    Posterior Accuracy: {belief['posterior_accuracy']:.3f}")
        print(f"    Confidence: {belief['confidence']:.3f}")
        print(f"    Win Rate: {belief['win_rate']:.1%}")
        print(f"    Current Weight: {belief['current_weight']:.3f}")
    
    print("\nAdaptive Weights:")
    for sid, weight in metrics['adaptive_weights'].items():
        print(f"  {sid}: {weight:.3f}")
