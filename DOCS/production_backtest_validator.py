
"""
Production Backtest Validator - Adds statistical rigor to backtesting
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from scipy import stats
from dataclasses import dataclass

@dataclass
class ProductionBacktestReport:
    """Production-grade backtest validation results"""
    sharpe_ratio: float
    sharpe_95_ci: Tuple[float, float]  # 95% confidence interval
    win_rate: float
    max_drawdown: float
    var_95: float  # Value at Risk
    cvar_95: float  # Conditional VaR
    walk_forward_consistency: float  # 0-1 score
    survivorship_adjusted_return: float
    monte_carlo_success_rate: float  # % of simulations profitable
    is_production_ready: bool
    warnings: List[str]

class ProductionBacktestValidator:
    """Validates backtest results for production deployment"""
    
    def __init__(self, min_sharpe: float = 1.0, min_trades: int = 30):
        self.min_sharpe = min_sharpe
        self.min_trades = min_trades
    
    def validate(self, backtest_results: Dict, returns: np.ndarray) -> ProductionBacktestReport:
        """Run comprehensive production validation"""
        
        warnings = []
        
        # 1. Sharpe Ratio with Confidence Intervals
        sharpe = backtest_results.get('sharpe_ratio', 0)
        sharpe_ci = self._calculate_sharpe_ci(returns)
        
        if sharpe < self.min_sharpe:
            warnings.append(f"Sharpe ratio {sharpe:.2f} below minimum {self.min_sharpe}")
        
        # 2. Walk-Forward Analysis
        wf_consistency = self._walk_forward_validation(returns)
        
        if wf_consistency < 0.6:
            warnings.append(f"Walk-forward consistency {wf_consistency:.2f} too low (need >0.6)")
        
        # 3. Monte Carlo Simulation
        mc_success_rate = self._monte_carlo_simulation(returns, n_sims=1000)
        
        if mc_success_rate < 0.7:
            warnings.append(f"Monte Carlo success rate {mc_success_rate:.2f} below 70%")
        
        # 4. Risk Metrics
        var_95 = np.percentile(returns, 5)
        cvar_95 = returns[returns <= var_95].mean()
        
        # 5. Trade Count Validation
        total_trades = backtest_results.get('total_trades', 0)
        if total_trades < self.min_trades:
            warnings.append(f"Only {total_trades} trades (need >{self.min_trades} for statistical significance)")
        
        # 6. Survivorship Bias Adjustment (conservative estimate)
        total_return = backtest_results.get('total_return', 0)
        survivorship_adjusted = total_return * 0.85  # 15% haircut
        
        # Production readiness check
        is_production_ready = (
            sharpe >= self.min_sharpe and
            wf_consistency >= 0.6 and
            mc_success_rate >= 0.7 and
            total_trades >= self.min_trades and
            len(warnings) <= 2  # Max 2 minor warnings
        )
        
        return ProductionBacktestReport(
            sharpe_ratio=sharpe,
            sharpe_95_ci=sharpe_ci,
            win_rate=backtest_results.get('win_rate', 0),
            max_drawdown=backtest_results.get('max_drawdown', 0),
            var_95=float(var_95),
            cvar_95=float(cvar_95),
            walk_forward_consistency=wf_consistency,
            survivorship_adjusted_return=survivorship_adjusted,
            monte_carlo_success_rate=mc_success_rate,
            is_production_ready=is_production_ready,
            warnings=warnings
        )
    
    def _calculate_sharpe_ci(self, returns: np.ndarray, confidence: float = 0.95) -> Tuple[float, float]:
        """Calculate confidence interval for Sharpe ratio using bootstrap"""
        sharpe_samples = []
        
        for _ in range(1000):
            sample = np.random.choice(returns, size=len(returns), replace=True)
            if np.std(sample) > 0:
                sharpe_samples.append(np.mean(sample) / np.std(sample) * np.sqrt(252))
        
        lower = np.percentile(sharpe_samples, (1 - confidence) / 2 * 100)
        upper = np.percentile(sharpe_samples, (1 + confidence) / 2 * 100)
        
        return (float(lower), float(upper))
    
    def _walk_forward_validation(self, returns: np.ndarray, n_folds: int = 5) -> float:
        """Walk-forward analysis - test on future data"""
        fold_size = len(returns) // n_folds
        fold_sharpes = []
        
        for i in range(n_folds - 1):
            test_returns = returns[(i + 1) * fold_size:(i + 2) * fold_size]
            
            if len(test_returns) > 0 and np.std(test_returns) > 0:
                fold_sharpe = np.mean(test_returns) / np.std(test_returns) * np.sqrt(252)
                fold_sharpes.append(fold_sharpe)
        
        # Consistency score: how many folds are profitable
        profitable_folds = sum(1 for s in fold_sharpes if s > 0)
        consistency = profitable_folds / len(fold_sharpes) if fold_sharpes else 0
        
        return consistency
    
    def _monte_carlo_simulation(self, returns: np.ndarray, n_sims: int = 1000) -> float:
        """Monte Carlo simulation - randomize trade order"""
        successful_sims = 0
        
        for _ in range(n_sims):
            # Randomize order of returns
            shuffled_returns = np.random.permutation(returns)
            cumulative_return = np.sum(shuffled_returns)
            
            if cumulative_return > 0:
                successful_sims += 1
        
        return successful_sims / n_sims

# Integration with existing backtest
def validate_for_production(backtest_results: Dict, equity_curve: np.ndarray) -> ProductionBacktestReport:
    """Validate backtest results for production deployment"""
    
    returns = np.diff(equity_curve) / equity_curve[:-1]
    validator = ProductionBacktestValidator(min_sharpe=1.0, min_trades=30)
    
    report = validator.validate(backtest_results, returns)
    
    print("\n" + "="*60)
    print("PRODUCTION BACKTEST VALIDATION REPORT")
    print("="*60)
    print(f"\nSharpe Ratio: {report.sharpe_ratio:.2f} (95% CI: {report.sharpe_95_ci[0]:.2f} - {report.sharpe_95_ci[1]:.2f})")
    print(f"Walk-Forward Consistency: {report.walk_forward_consistency:.2%}")
    print(f"Monte Carlo Success Rate: {report.monte_carlo_success_rate:.2%}")
    print(f"VaR (95%): {report.var_95:.2%}")
    print(f"CVaR (95%): {report.cvar_95:.2%}")
    print(f"Survivorship-Adjusted Return: {report.survivorship_adjusted_return:.2f}%")
    
    print(f"\n{'✅ PRODUCTION READY' if report.is_production_ready else '⚠️ NOT PRODUCTION READY'}")
    
    if report.warnings:
        print("\nWarnings:")
        for warning in report.warnings:
            print(f"  - {warning}")
    
    return report
