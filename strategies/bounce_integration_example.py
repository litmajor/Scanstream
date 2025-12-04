"""
Integration Example: Enhanced Bounce Strategy with Multi-Timeframe Detection
Shows how to combine enhanced_bounce_strategy with volume_sr_agent and advanced_strategies
"""

import pandas as pd
import numpy as np
from strategies.enhanced_bounce_strategy import (
    EnhancedBounceStrategy,
    MultiTimeframeZoneDetector,
    BayesianBeliefUpdaterEnhanced
)
from strategies.volume_sr_agent import VolumeSupportResistance
from strategies.advanced_strategies import (
    BayesianBeliefUpdater,
    LiquidityFlowTracker,
    MarketEntropyAnalyzer,
    AdaptiveEnsembleOptimizer
)


class BouncePatternIntegration:
    """
    Complete integration example for enhanced bounce pattern detection.
    
    Workflow:
    1. Load multi-timeframe data
    2. Detect zones across timeframes
    3. Detect bounce setup
    4. Validate with Bayesian beliefs
    5. Generate weighted signal
    """
    
    def __init__(self):
        # Initialize enhanced bounce strategy
        self.bounce_strategy = EnhancedBounceStrategy(risk_profile='moderate')
        self.zone_detector = MultiTimeframeZoneDetector(
            timeframes=['1m', '5m', '1h', '4h'],
            settings={
                'sensitivity': 1.5,
                'min_zone_width': 0.0025,
                'volume_threshold': 0.85,
                'merge_distance_pct': 0.005,
            }
        )
        
        # Initialize volume SR agent
        self.volume_sr = VolumeSupportResistance()
        
        # Initialize advanced strategies for ensemble
        self.bayesian = BayesianBeliefUpdater()
        self.liquidity_tracker = LiquidityFlowTracker()
        self.entropy_analyzer = MarketEntropyAnalyzer()
        
        self.signal_log = []
    
    def prepare_multi_timeframe_data(self, price_data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
        """
        Prepare and validate multi-timeframe data.
        Ensure all timeframes have necessary OHLCV columns.
        """
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        processed = {}
        
        for tf, df in price_data.items():
            # Validate columns
            if not all(col in df.columns for col in required_cols):
                raise ValueError(f"Missing required columns in {tf} data")
            
            # Calculate derived indicators
            df['volume_ratio'] = df['volume'] / df['volume'].shift(1)
            df['price_change_pct'] = df['close'].pct_change()
            
            # Calculate RSI (14-period)
            df['rsi'] = self._calculate_rsi(df['close'], period=14)
            
            # Calculate MACD
            macd = self._calculate_macd(df['close'])
            df['macd'] = macd['macd']
            df['macd_signal'] = macd['signal']
            
            processed[tf] = df
        
        return processed
    
    def analyze_bounce_signal(self, price_data: Dict[str, pd.DataFrame], 
                             current_price: float) -> Dict[str, any]:
        """
        Main analysis function combining all strategies.
        
        Returns comprehensive signal with:
        - Bounce detection confidence
        - Zone details and confluence
        - Bayesian belief update
        - Ensemble recommendation
        - Risk assessment
        """
        
        # Prepare data
        prepared_data = self.prepare_multi_timeframe_data(price_data)
        
        # Step 1: Enhanced bounce evaluation
        bounce_result = self.bounce_strategy.evaluate(prepared_data, current_price)
        
        # Step 2: Volume SR confirmation (1m baseline)
        df_1m = prepared_data.get('1m')
        if df_1m is not None:
            self.volume_sr.detect_zones(df_1m)
            sr_eval = self.volume_sr.evaluate(current_price)
        else:
            sr_eval = {'status': 'NONE', 'confidence': 0}
        
        # Step 3: Bayesian confirmation
        if df_1m is not None:
            bayesian_signal = self.bayesian.evaluate(df_1m)
        else:
            bayesian_signal = {'bullish': 0.5}
        
        # Step 4: Liquidity flow
        if df_1m is not None:
            liquidity_signal = self.liquidity_tracker.evaluate(df_1m)
        else:
            liquidity_signal = 0
        
        # Step 5: Market entropy (risk assessment)
        if df_1m is not None:
            entropy_signal = self.entropy_analyzer.evaluate(df_1m)
        else:
            entropy_signal = 0
        
        # Synthesize results
        final_signal = self._synthesize_signals(
            bounce_result=bounce_result,
            sr_eval=sr_eval,
            bayesian_signal=bayesian_signal,
            liquidity_signal=liquidity_signal,
            entropy_signal=entropy_signal
        )
        
        # Log signal
        self.signal_log.append({
            'timestamp': pd.Timestamp.now(),
            'bounce_result': bounce_result,
            'sr_eval': sr_eval,
            'final_signal': final_signal
        })
        
        return final_signal
    
    def _synthesize_signals(self, bounce_result: Dict, sr_eval: Dict, 
                           bayesian_signal: Dict, liquidity_signal: float,
                           entropy_signal: float) -> Dict[str, Any]:
        """
        Combine multiple signals into final trading recommendation.
        
        Weighting:
        - Bounce detection: 40%
        - Volume SR confirmation: 25%
        - Bayesian belief: 20%
        - Liquidity flow: 10%
        - Entropy risk: 5%
        """
        
        # Calculate bounce score (0-1)
        bounce_score = bounce_result.get('strength', 0) * bounce_result.get('confidence', 0)
        
        # SR confirmation score
        sr_score = sr_eval.get('confidence', 0)
        
        # Bayesian score
        bayesian_score = bayesian_signal.get('bullish', 0.5)
        
        # Weighted combination
        weights = {
            'bounce': 0.40,
            'sr': 0.25,
            'bayesian': 0.20,
            'liquidity': 0.10,
            'entropy': 0.05
        }
        
        weighted_signal = (
            bounce_score * weights['bounce'] +
            sr_score * weights['sr'] +
            bayesian_score * weights['bayesian'] +
            max(0, liquidity_signal) * weights['liquidity'] +
            max(0, -entropy_signal) * weights['entropy']  # Negative entropy = lower risk
        )
        
        # Risk adjustment
        risk_factor = 1.0 + entropy_signal  # Higher entropy = reduce signal
        adjusted_signal = weighted_signal / max(risk_factor, 0.5)
        adjusted_signal = np.clip(adjusted_signal, 0, 1)
        
        # Determine action
        if adjusted_signal > 0.75 and bounce_result.get('bounce_detected', False):
            action = 'STRONG_BUY'
        elif adjusted_signal > 0.65:
            action = 'BUY'
        elif adjusted_signal > 0.50:
            action = 'HOLD'
        else:
            action = 'PASS'
        
        return {
            'action': action,
            'weighted_signal': adjusted_signal,
            'bounce_score': bounce_score,
            'sr_score': sr_score,
            'bayesian_score': bayesian_score,
            'liquidity_signal': liquidity_signal,
            'entropy_risk': entropy_signal,
            'bounce_zone': bounce_result.get('zone_details'),
            'confluence': bounce_result.get('timeframe_confluence'),
            'quality_reasons': bounce_result.get('quality_reasons', []),
            'risk_level': 'HIGH' if entropy_signal > 0.5 else 'MEDIUM' if entropy_signal > 0.2 else 'LOW'
        }
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def _calculate_macd(self, prices: pd.Series, fast: int = 12, 
                       slow: int = 26, signal: int = 9) -> Dict:
        """Calculate MACD"""
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal).mean()
        
        return {
            'macd': macd_line,
            'signal': signal_line
        }
    
    def backtest_bounce_signals(self, historical_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """
        Backtest enhanced bounce strategy on historical data.
        
        Returns performance metrics:
        - Win rate
        - Avg return per trade
        - Sharpe ratio
        - Max drawdown
        - Number of signals
        """
        signals = []
        trades = []
        
        # Get longest timeframe for iteration
        tf_to_iterate = list(historical_data.keys())[0]
        main_df = historical_data[tf_to_iterate]
        
        for i in range(len(main_df)):
            # Get data up to current bar
            current_data = {
                tf: df.iloc[:i+1] for tf, df in historical_data.items()
            }
            
            current_price = main_df['close'].iloc[i]
            
            # Generate signal
            signal = self.analyze_bounce_signal(current_data, current_price)
            
            if signal['action'] in ['BUY', 'STRONG_BUY']:
                signals.append({
                    'index': i,
                    'timestamp': main_df.index[i],
                    'entry_price': current_price,
                    'signal': signal
                })
        
        # Evaluate trades
        for signal in signals:
            entry_idx = signal['index']
            entry_price = signal['entry_price']
            
            # Look for exit (5 bars ahead or hit target/stop)
            if entry_idx + 5 < len(main_df):
                exit_price = main_df['close'].iloc[entry_idx + 5]
                returns = (exit_price - entry_price) / entry_price
                
                trades.append({
                    'entry': entry_price,
                    'exit': exit_price,
                    'return': returns,
                    'win': returns > 0
                })
        
        # Calculate metrics
        if trades:
            returns = [t['return'] for t in trades]
            wins = sum(1 for t in trades if t['win'])
            
            metrics = {
                'num_signals': len(signals),
                'num_trades': len(trades),
                'win_rate': wins / len(trades) if trades else 0,
                'avg_return': np.mean(returns),
                'sharpe_ratio': np.mean(returns) / (np.std(returns) + 1e-6) * np.sqrt(252),
                'max_loss': min(returns) if returns else 0,
                'max_gain': max(returns) if returns else 0,
            }
        else:
            metrics = {
                'num_signals': 0,
                'num_trades': 0,
                'win_rate': 0,
                'avg_return': 0,
                'sharpe_ratio': 0,
                'max_loss': 0,
                'max_gain': 0,
            }
        
        return metrics


# Example usage
if __name__ == "__main__":
    # Initialize integration
    integration = BouncePatternIntegration()
    
    # Load sample multi-timeframe data (example)
    # price_data = {
    #     '1m': df_1m,
    #     '5m': df_5m,
    #     '1h': df_1h,
    #     '4h': df_4h
    # }
    
    # Analyze bounce signal
    # signal = integration.analyze_bounce_signal(price_data, current_price=100.50)
    # print(f"Signal: {signal['action']}")
    # print(f"Weighted Signal: {signal['weighted_signal']:.2%}")
    # print(f"Bounce Zone: {signal['bounce_zone']}")
    
    print("Enhanced Bounce Strategy Integration Ready")
    print("Features:")
    print("  ✓ Multi-timeframe zone detection")
    print("  ✓ Volume-weighted support/resistance")
    print("  ✓ Bayesian confidence scoring")
    print("  ✓ Liquidity flow confirmation")
    print("  ✓ Market entropy risk assessment")
    print("  ✓ Cross-timeframe confluence detection")
