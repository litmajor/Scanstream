"""
VFMD Data Fetcher
Downloads historical market data from CCXT or CoinGecko
"""

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import json
import os


class DataFetcher:
    """Fetch market data from exchanges"""
    
    def __init__(self, exchange_id='binance'):
        """
        Args:
            exchange_id: Exchange name (binance, coinbase, kraken, etc.)
        """
        self.exchange = getattr(ccxt, exchange_id)({
            'enableRateLimit': True,
        })
        
    def fetch_ohlcv(self, 
                    symbol='BTC/USDT',
                    timeframe='1m',
                    days_back=180,
                    save_path='data/raw/'):
        """
        Fetch OHLCV data
        
        Args:
            symbol: Trading pair
            timeframe: Candle interval (1m, 5m, 15m, 1h, etc.)
            days_back: How many days of history
            save_path: Where to save
            
        Returns:
            DataFrame with columns: timestamp, open, high, low, close, volume
        """
        print(f"Fetching {symbol} {timeframe} data for last {days_back} days...")
        
        # Calculate time range
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        since = int(start_time.timestamp() * 1000)
        
        all_candles = []
        
        while since < int(end_time.timestamp() * 1000):
            try:
                candles = self.exchange.fetch_ohlcv(
                    symbol,
                    timeframe=timeframe,
                    since=since,
                    limit=1000  # Max per request
                )
                
                if not candles:
                    break
                
                all_candles.extend(candles)
                
                # Update since to last timestamp
                since = candles[-1][0] + 1
                
                print(f"Fetched {len(all_candles)} candles so far...")
                time.sleep(self.exchange.rateLimit / 1000)  # Respect rate limits
                
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(5)
                continue
        
        # Convert to DataFrame
        df = pd.DataFrame(
            all_candles,
            columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
        )
        
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.set_index('timestamp')
        
        # Save to disk
        os.makedirs(save_path, exist_ok=True)
        filename = f"{save_path}{symbol.replace('/', '_')}_{timeframe}_{days_back}d.csv"
        df.to_csv(filename)
        
        print(f"✅ Saved {len(df)} candles to {filename}")
        return df
    
    def load_data(self, filepath):
        """Load previously saved data"""
        df = pd.read_csv(filepath, index_col='timestamp', parse_dates=True)
        return df


class DataPreprocessor:
    """Clean and prepare data for field construction"""
    
    @staticmethod
    def clean_data(df):
        """Remove outliers and handle missing values"""
        
        # Remove rows with zero volume
        df = df[df['volume'] > 0]
        
        # Remove extreme outliers (>5 std dev)
        for col in ['open', 'high', 'low', 'close']:
            mean = df[col].mean()
            std = df[col].std()
            df = df[np.abs(df[col] - mean) < 5 * std]
        
        # Forward fill any remaining NaNs
        df = df.fillna(method='ffill')
        
        return df
    
    @staticmethod
    def add_features(df):
        """Add derived features needed for field construction"""
        
        # Returns
        df['returns'] = df['close'].pct_change()
        
        # Log returns (better for volatility)
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))
        
        # Price velocity (rate of change)
        df['price_velocity'] = df['close'].diff()
        
        # Volume ratio (vs 20-period average)
        df['volume_ma20'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / (df['volume_ma20'] + 1e-8)
        
        # Volatility (20-period rolling std of returns)
        df['volatility'] = df['returns'].rolling(20).std()
        
        # Remove initial NaN rows
        df = df.dropna()
        
        return df
    
    @staticmethod
    def find_breakouts(df, lookback=20, threshold=0.02):
        """
        Find historical breakout points for validation
        
        Args:
            df: Price dataframe
            lookback: Period to define range high
            threshold: Minimum breakout % move
            
        Returns:
            List of (timestamp, price) tuples for breakouts
        """
        breakouts = []
        
        # Calculate rolling high
        df['rolling_high'] = df['high'].rolling(lookback).max()
        
        for i in range(lookback, len(df)):
            current_close = df['close'].iloc[i]
            prev_high = df['rolling_high'].iloc[i-1]
            
            # Check if price breaks above previous range high
            if current_close > prev_high * (1 + threshold):
                breakouts.append({
                    'timestamp': df.index[i],
                    'price': current_close,
                    'index': i
                })
        
        print(f"Found {len(breakouts)} breakouts")
        return breakouts
    
    @staticmethod
    def find_chop_zones(df, window=50, threshold=0.015):
        """
        Find choppy/ranging periods for validation
        
        Args:
            df: Price dataframe
            window: Period to analyze
            threshold: Max price movement to qualify as chop
            
        Returns:
            List of chop zone periods
        """
        chop_zones = []
        
        for i in range(window, len(df), window):
            period = df.iloc[i-window:i]
            
            # Calculate range
            price_range = (period['high'].max() - period['low'].min()) / period['close'].iloc[0]
            
            # If range is small → chop
            if price_range < threshold:
                chop_zones.append({
                    'start': period.index[0],
                    'end': period.index[-1],
                    'index': i
                })
        
        print(f"Found {len(chop_zones)} chop zones")
        return chop_zones


# Quick test script
if __name__ == "__main__":
    # Fetch data
    fetcher = DataFetcher('binance')
    
    # Get 6 months of 1-minute BTC data
    df = fetcher.fetch_ohlcv(
        symbol='BTC/USDT',
        timeframe='1m',
        days_back=180
    )
    
    # Clean and prepare
    preprocessor = DataPreprocessor()
    df = preprocessor.clean_data(df)
    df = preprocessor.add_features(df)
    
    # Find validation points
    breakouts = preprocessor.find_breakouts(df)
    chop_zones = preprocessor.find_chop_zones(df)
    
    # Save processed data
    df.to_csv('data/processed/btc_usdt_1m_processed.csv')
    
    # Save validation points
    import json
    with open('data/processed/breakouts.json', 'w') as f:
        json.dump(breakouts, f, default=str)
    
    with open('data/processed/chop_zones.json', 'w') as f:
        json.dump(chop_zones, f, default=str)
    
    print("\n✅ Data acquisition complete!")
    print(f"Total candles: {len(df)}")
    print(f"Date range: {df.index[0]} to {df.index[-1]}")