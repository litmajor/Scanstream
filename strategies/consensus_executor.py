#!/usr/bin/env python3
"""
Consensus Executor - Runs all strategies and generates consensus trade
"""
import sys
import json
import argparse
import pandas as pd
import numpy as np
from datetime import datetime
import ccxt

# Import strategies
from gradient_trend_filter import GradientTrendFilter
from ut_bot import UTBotStrategy
from mean_reversion import MeanReversionEngine
from volume_profile import VolumeProfileEngine
from market_engine import MarketStructureEngine
from strategy_coop import StrategyCoordinator


def fetch_multi_timeframe_data(symbol: str, timeframes: list, limit: int = 500):
    """Fetch data for multiple timeframes"""
    try:
        exchange = ccxt.binance({'enableRateLimit': True})
        
        data = {}
        for tf in timeframes:
            ohlcv = exchange.fetch_ohlcv(symbol, tf, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            data[tf] = df
        
        return data
    except Exception as e:
        print(json.dumps({'error': f'Failed to fetch data: {str(e)}'}), file=sys.stderr)
        sys.exit(1)


def generate_consensus(symbol: str, timeframes: list, equity: float):
    """Generate consensus trade recommendation"""
    try:
        # Fetch multi-timeframe data
        data = fetch_multi_timeframe_data(symbol, timeframes)
        
        # Initialize strategies
        strategies = {
            'gradient_trend': GradientTrendFilter(),
            'ut_bot': UTBotStrategy(),
            'mean_reversion': MeanReversionEngine(),
            'volume_profile': VolumeProfileEngine(),
            'market_structure': MarketStructureEngine()
        }
        
        # Initialize coordinator
        coordinator = StrategyCoordinator(
            strategies=strategies,
            min_consensus=0.60,
            max_risk_per_trade=0.02,
            min_risk_reward=2.0
        )
        
        # Generate trade recommendation
        trade = coordinator.generate_trade_recommendation(data, equity, timeframes)
        
        if trade is None:
            return {
                'success': True,
                'consensus': None,
                'message': 'No consensus reached - insufficient signal agreement'
            }
        
        # Format response
        return {
            'success': True,
            'consensus': {
                'direction': trade.direction,
                'entryPrice': float(trade.entry_price),
                'stopLoss': float(trade.stop_loss),
                'takeProfit': [float(tp) for tp in trade.take_profit],
                'positionSize': float(trade.position_size),
                'confidence': float(trade.confidence),
                'riskRewardRatio': float(trade.risk_reward_ratio),
                'contributingStrategies': trade.contributing_strategies,
                'timeframeAlignment': trade.timeframe_alignment,
                'edgeScore': float(trade.edge_score),
                'timestamp': trade.timestamp.isoformat()
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    parser = argparse.ArgumentParser(description='Generate consensus trade')
    parser.add_argument('--symbol', required=True, help='Trading symbol (e.g., BTC/USDT)')
    parser.add_argument('--timeframes', required=True, help='Timeframes as JSON array')
    parser.add_argument('--equity', type=float, required=True, help='Account equity')
    
    args = parser.parse_args()
    
    # Parse timeframes
    try:
        timeframes = json.loads(args.timeframes)
    except json.JSONDecodeError:
        print(json.dumps({'error': 'Invalid timeframes JSON'}), file=sys.stderr)
        sys.exit(1)
    
    # Generate consensus
    result = generate_consensus(args.symbol, timeframes, args.equity)
    
    # Output result as JSON
    print(json.dumps(result))


if __name__ == '__main__':
    main()

