#!/usr/bin/env python3
"""
Backtest Executor - Backtests strategies with historical data
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


def fetch_historical_data(symbol: str, timeframe: str, start_date: str, end_date: str):
    """Fetch historical market data"""
    try:
        exchange = ccxt.binance({'enableRateLimit': True})
        
        # Convert dates to timestamps
        start_ts = int(pd.Timestamp(start_date).timestamp() * 1000)
        end_ts = int(pd.Timestamp(end_date).timestamp() * 1000)
        
        # Fetch all data
        all_ohlcv = []
        current_ts = start_ts
        
        while current_ts < end_ts:
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=current_ts, limit=1000)
            if not ohlcv:
                break
            all_ohlcv.extend(ohlcv)
            current_ts = ohlcv[-1][0] + 1
            
            if len(ohlcv) < 1000:
                break
        
        # Convert to DataFrame
        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df[(df['timestamp'] >= start_date) & (df['timestamp'] <= end_date)]
        df.set_index('timestamp', inplace=True)
        
        return df
    except Exception as e:
        print(json.dumps({'error': f'Failed to fetch historical data: {str(e)}'}), file=sys.stderr)
        sys.exit(1)


def backtest_strategy(strategy_id: str, symbol: str, timeframe: str, start_date: str, end_date: str, params: dict):
    """Backtest strategy and return performance metrics"""
    try:
        # Fetch historical data
        df = fetch_historical_data(symbol, timeframe, start_date, end_date)
        
        if len(df) < 50:
            return {
                'success': False,
                'error': 'Insufficient historical data'
            }
        
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
                atr_method=params.get('atr_method', 'RMA'),
                track_pnl=True
            )
        elif strategy_id == 'mean_reversion':
            strategy = MeanReversionEngine(
                bb_period=params.get('bb_period', 20),
                bb_std=params.get('bb_std', 2.0),
                rsi_period=params.get('rsi_period', 14),
                oversold_threshold=params.get('oversold', 30),
                overbought_threshold=params.get('overbought', 70),
                track_pnl=True
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
        
        # Calculate performance metrics
        trades = []
        if hasattr(result, 'signals') and hasattr(result, 'entry_prices'):
            position = None
            entry_price = None
            
            for i in range(len(result.signals)):
                signal = result.signals[i]
                price = df['close'].iloc[i]
                
                # Entry
                if signal in ['BUY', 'LONG'] and position is None:
                    position = 'LONG'
                    entry_price = price
                    entry_time = df.index[i]
                elif signal in ['SELL', 'SHORT'] and position is None:
                    position = 'SHORT'
                    entry_price = price
                    entry_time = df.index[i]
                
                # Exit
                elif signal in ['EXIT_LONG', 'SELL', 'SHORT'] and position == 'LONG':
                    exit_price = price
                    pnl = ((exit_price - entry_price) / entry_price) * 100
                    trades.append({
                        'entry_time': entry_time.isoformat(),
                        'exit_time': df.index[i].isoformat(),
                        'entry_price': float(entry_price),
                        'exit_price': float(exit_price),
                        'pnl': float(pnl),
                        'position': position
                    })
                    position = None
                elif signal in ['EXIT_SHORT', 'BUY', 'LONG'] and position == 'SHORT':
                    exit_price = price
                    pnl = ((entry_price - exit_price) / entry_price) * 100
                    trades.append({
                        'entry_time': entry_time.isoformat(),
                        'exit_time': df.index[i].isoformat(),
                        'entry_price': float(entry_price),
                        'exit_price': float(exit_price),
                        'pnl': float(pnl),
                        'position': position
                    })
                    position = None
        
        # Calculate metrics
        if trades:
            total_trades = len(trades)
            winning_trades = len([t for t in trades if t['pnl'] > 0])
            losing_trades = len([t for t in trades if t['pnl'] < 0])
            win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
            
            total_pnl = sum(t['pnl'] for t in trades)
            avg_win = np.mean([t['pnl'] for t in trades if t['pnl'] > 0]) if winning_trades > 0 else 0
            avg_loss = np.mean([t['pnl'] for t in trades if t['pnl'] < 0]) if losing_trades > 0 else 0
            
            # Calculate Sharpe ratio
            returns = [t['pnl'] for t in trades]
            sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(252) if np.std(returns) > 0 else 0
            
            # Calculate max drawdown
            cumulative = np.cumsum(returns)
            running_max = np.maximum.accumulate(cumulative)
            drawdown = running_max - cumulative
            max_drawdown = np.max(drawdown) if len(drawdown) > 0 else 0
        else:
            total_trades = 0
            winning_trades = 0
            losing_trades = 0
            win_rate = 0
            total_pnl = 0
            avg_win = 0
            avg_loss = 0
            sharpe = 0
            max_drawdown = 0
        
        # Return results
        return {
            'success': True,
            'metrics': {
                'totalTrades': total_trades,
                'winningTrades': winning_trades,
                'losingTrades': losing_trades,
                'winRate': float(win_rate),
                'totalReturn': float(total_pnl),
                'avgWin': float(avg_win),
                'avgLoss': float(avg_loss),
                'sharpeRatio': float(sharpe),
                'maxDrawdown': float(max_drawdown)
            },
            'trades': trades[:10],  # Return first 10 trades
            'totalTradesCount': len(trades),
            'dataPoints': len(df),
            'startDate': start_date,
            'endDate': end_date
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    parser = argparse.ArgumentParser(description='Backtest trading strategy')
    parser.add_argument('--strategy', required=True, help='Strategy ID')
    parser.add_argument('--symbol', required=True, help='Trading symbol (e.g., BTC/USDT)')
    parser.add_argument('--timeframe', required=True, help='Timeframe (e.g., 1h, 4h, 1d)')
    parser.add_argument('--start', required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', required=True, help='End date (YYYY-MM-DD)')
    parser.add_argument('--params', default='{}', help='Strategy parameters as JSON')
    
    args = parser.parse_args()
    
    # Parse parameters
    try:
        params = json.loads(args.params)
    except json.JSONDecodeError:
        print(json.dumps({'error': 'Invalid parameters JSON'}), file=sys.stderr)
        sys.exit(1)
    
    # Run backtest
    result = backtest_strategy(args.strategy, args.symbol, args.timeframe, args.start, args.end, params)
    
    # Output result as JSON
    print(json.dumps(result))


if __name__ == '__main__':
    main()

