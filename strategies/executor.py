#!/usr/bin/env python3
"""
Strategy Executor - Executes individual strategies with real market data
"""
import sys
import json
import argparse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import ccxt

# Import strategies
from gradient_trend_filter import GradientTrendFilter
from ut_bot import UTBotStrategy
from mean_reversion import MeanReversionEngine
from volume_profile import VolumeProfileEngine
from market_engine import MarketStructureEngine


def fetch_market_data(symbol: str, timeframe: str, limit: int = 500):
    """Fetch market data from exchange"""
    try:
        # Initialize exchange
        exchange = ccxt.binance({
            'enableRateLimit': True,
        })
        
        # Fetch OHLCV data
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        
        # Convert to DataFrame
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        
        return df
    except Exception as e:
        print(json.dumps({'error': f'Failed to fetch data: {str(e)}'}), file=sys.stderr)
        sys.exit(1)


def execute_strategy(strategy_id: str, symbol: str, timeframe: str, params: dict):
    """Execute strategy and return results"""
    try:
        # Fetch market data
        df = fetch_market_data(symbol, timeframe)
        
        # Initialize strategy
        if strategy_id == 'gradient_trend_filter':
            strategy = GradientTrendFilter(
                fast_period=params.get('fast_period', 10),
                slow_period=params.get('slow_period', 50),
                threshold=params.get('threshold', 0.002)
            )
        elif strategy_id == 'ut_bot':
            strategy = UTBotStrategy(
                sensitivity=params.get('sensitivity', 1.0),
                atr_period=params.get('atr_period', 10),
                atr_method=params.get('atr_method', 'RMA')
            )
        elif strategy_id == 'mean_reversion':
            strategy = MeanReversionEngine(
                bb_period=params.get('bb_period', 20),
                bb_std=params.get('bb_std', 2.0),
                rsi_period=params.get('rsi_period', 14),
                oversold_threshold=params.get('oversold', 30),
                overbought_threshold=params.get('overbought', 70)
            )
        elif strategy_id == 'volume_profile':
            strategy = VolumeProfileEngine(
                profile_bins=params.get('profile_bins', 24),
                cvd_period=params.get('cvd_period', 20),
                imbalance_threshold=params.get('imbalance_threshold', 1.5)
            )
        elif strategy_id == 'market_structure':
            strategy = MarketStructureEngine(
                swing_period=params.get('swing_period', 20),
                break_threshold=params.get('break_threshold', 0.001),
                confirmation_bars=params.get('confirmation_bars', 3)
            )
        else:
            raise ValueError(f'Unknown strategy: {strategy_id}')
        
        # Execute strategy
        result = strategy.evaluate(df)
        
        # Get latest signal
        latest_signal = result.signals[-1] if hasattr(result, 'signals') else 'HOLD'
        latest_price = float(df['close'].iloc[-1])
        
        # Extract metadata
        metadata = {}
        if hasattr(result, 'confidence'):
            metadata['confidence'] = float(result.confidence[-1])
        if hasattr(result, 'strength'):
            metadata['strength'] = float(result.strength[-1])
        if hasattr(result, 'trailing_stop'):
            metadata['trailing_stop'] = float(result.trailing_stop[-1])
        if hasattr(result, 'z_score'):
            metadata['z_score'] = float(result.z_score[-1])
        if hasattr(result, 'poc'):
            metadata['poc'] = float(result.poc[-1])
        
        # Return results
        return {
            'success': True,
            'signal': latest_signal,
            'price': latest_price,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata,
            'data_points': len(df)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    parser = argparse.ArgumentParser(description='Execute trading strategy')
    parser.add_argument('--strategy', required=True, help='Strategy ID')
    parser.add_argument('--symbol', required=True, help='Trading symbol (e.g., BTC/USDT)')
    parser.add_argument('--timeframe', required=True, help='Timeframe (e.g., 1h, 4h, 1d)')
    parser.add_argument('--params', default='{}', help='Strategy parameters as JSON')
    
    args = parser.parse_args()
    
    # Parse parameters
    try:
        params = json.loads(args.params)
    except json.JSONDecodeError:
        print(json.dumps({'error': 'Invalid parameters JSON'}), file=sys.stderr)
        sys.exit(1)
    
    # Execute strategy
    result = execute_strategy(args.strategy, args.symbol, args.timeframe, params)
    
    # Output result as JSON
    print(json.dumps(result))


if __name__ == '__main__':
    main()

