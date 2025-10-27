
import pandas as pd
import ccxt.async_support as ccxt
import asyncio
import multiprocessing
from typing import Dict, Optional, List
from dataclasses import dataclass, field
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, accuracy_score
from imblearn.over_sampling import SMOTE
import numpy as np
import logging
from datetime import datetime, timezone
from enum import Enum

# Assuming scanner.py defines MomentumScanner and TradingConfig
from scanner import MomentumScanner, TradingConfig

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# === Strategy Execution Engine Types ===

class OrderStatus(Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"

class OrderSide(Enum):
    BUY = "BUY"
    SELL = "SELL"

@dataclass
class Order:
    id: str
    strategy_id: str
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    filled_price: Optional[float] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict = field(default_factory=dict)

@dataclass
class Position:
    id: str
    strategy_id: str
    symbol: str
    side: OrderSide
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict = field(default_factory=dict)

@dataclass
class StrategyExecutionMetrics:
    strategy_id: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: float
    win_rate: float
    sharpe_ratio: float
    max_drawdown: float
    current_balance: float
    active_positions: int
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

# === Strategy Execution Engine ===

class StrategyExecutionEngine:
    """
    Manages order execution, position tracking, and risk management for trading strategies.
    Integrates with the copy trading system.
    """
    
    def __init__(self, initial_balance: float = 10000.0, max_positions: int = 10):
        self.initial_balance = initial_balance
        self.current_balance = initial_balance
        self.max_positions = max_positions
        self.orders: Dict[str, Order] = {}
        self.positions: Dict[str, Position] = {}
        self.order_history: List[Order] = []
        self.commission_rate = 0.001  # 0.1%
        self.slippage_rate = 0.0005  # 0.05%
        
    def create_order(
        self,
        strategy_id: str,
        symbol: str,
        side: OrderSide,
        type: OrderType,
        quantity: float,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        metadata: Optional[Dict] = None
    ) -> Order:
        """Create a new order."""
        order_id = f"{strategy_id}_{symbol}_{datetime.now(timezone.utc).timestamp()}"
        
        order = Order(
            id=order_id,
            strategy_id=strategy_id,
            symbol=symbol,
            side=side,
            type=type,
            quantity=quantity,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            metadata=metadata or {}
        )
        
        self.orders[order_id] = order
        logger.info(f"Order created: {order_id} - {side.value} {quantity} {symbol}")
        return order
    
    def execute_order(self, order_id: str, execution_price: float) -> bool:
        """Execute an order at the specified price."""
        if order_id not in self.orders:
            logger.error(f"Order not found: {order_id}")
            return False
        
        order = self.orders[order_id]
        
        if order.status != OrderStatus.PENDING:
            logger.warning(f"Order {order_id} is not pending, current status: {order.status}")
            return False
        
        # Apply slippage
        if order.type == OrderType.MARKET:
            if order.side == OrderSide.BUY:
                execution_price *= (1 + self.slippage_rate)
            else:
                execution_price *= (1 - self.slippage_rate)
        
        # Calculate commission
        total_cost = order.quantity * execution_price
        commission = total_cost * self.commission_rate
        
        # Check balance for buy orders
        if order.side == OrderSide.BUY:
            if self.current_balance < total_cost + commission:
                logger.error(f"Insufficient balance for order {order_id}")
                order.status = OrderStatus.REJECTED
                return False
        
        # Execute the order
        order.status = OrderStatus.FILLED
        order.filled_quantity = order.quantity
        order.filled_price = execution_price
        
        # Deduct commission and cost
        if order.side == OrderSide.BUY:
            self.current_balance -= (total_cost + commission)
        else:
            self.current_balance += (total_cost - commission)
        
        # Create or update position
        if order.side == OrderSide.BUY:
            self._open_position(order, execution_price)
        else:
            self._close_position(order, execution_price)
        
        self.order_history.append(order)
        logger.info(f"Order executed: {order_id} at {execution_price}")
        return True
    
    def _open_position(self, order: Order, entry_price: float):
        """Open a new position."""
        position_id = f"{order.strategy_id}_{order.symbol}"
        
        position = Position(
            id=position_id,
            strategy_id=order.strategy_id,
            symbol=order.symbol,
            side=OrderSide.BUY,
            quantity=order.quantity,
            entry_price=entry_price,
            current_price=entry_price,
            unrealized_pnl=0.0,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            metadata=order.metadata
        )
        
        self.positions[position_id] = position
        logger.info(f"Position opened: {position_id}")
    
    def _close_position(self, order: Order, exit_price: float):
        """Close an existing position."""
        position_id = f"{order.strategy_id}_{order.symbol}"
        
        if position_id not in self.positions:
            logger.warning(f"Position not found: {position_id}")
            return
        
        position = self.positions[position_id]
        
        # Calculate realized PnL
        if position.side == OrderSide.BUY:
            realized_pnl = (exit_price - position.entry_price) * position.quantity
        else:
            realized_pnl = (position.entry_price - exit_price) * position.quantity
        
        # Deduct commission
        commission = position.quantity * exit_price * self.commission_rate
        realized_pnl -= commission
        
        logger.info(f"Position closed: {position_id} - PnL: {realized_pnl:.2f}")
        
        # Remove position
        del self.positions[position_id]
    
    def update_positions(self, market_prices: Dict[str, float]):
        """Update position prices and PnL based on current market prices."""
        for position_id, position in self.positions.items():
            if position.symbol in market_prices:
                position.current_price = market_prices[position.symbol]
                
                # Calculate unrealized PnL
                if position.side == OrderSide.BUY:
                    position.unrealized_pnl = (position.current_price - position.entry_price) * position.quantity
                else:
                    position.unrealized_pnl = (position.entry_price - position.current_price) * position.quantity
                
                # Check stop loss and take profit
                self._check_stop_loss_take_profit(position)
    
    def _check_stop_loss_take_profit(self, position: Position):
        """Check if stop loss or take profit should be triggered."""
        if position.side == OrderSide.BUY:
            if position.stop_loss and position.current_price <= position.stop_loss:
                # Trigger stop loss
                self._close_position_at_price(position, position.stop_loss, "STOP_LOSS")
            elif position.take_profit and position.current_price >= position.take_profit:
                # Trigger take profit
                self._close_position_at_price(position, position.take_profit, "TAKE_PROFIT")
    
    def _close_position_at_price(self, position: Position, exit_price: float, reason: str):
        """Close position at specified price."""
        # Create a sell order for the position
        order = Order(
            id=f"{position.id}_close_{datetime.now(timezone.utc).timestamp()}",
            strategy_id=position.strategy_id,
            symbol=position.symbol,
            side=OrderSide.SELL,
            type=OrderType.MARKET,
            quantity=position.quantity,
            metadata={"close_reason": reason}
        )
        
        self.execute_order(order.id, exit_price)
    
    def get_strategy_metrics(self, strategy_id: str) -> StrategyExecutionMetrics:
        """Calculate strategy performance metrics."""
        strategy_orders = [o for o in self.order_history if o.strategy_id == strategy_id]
        
        total_trades = len(strategy_orders) // 2  # Open and close pairs
        winning_trades = 0
        losing_trades = 0
        total_pnl = 0.0
        
        for i in range(0, len(strategy_orders) - 1, 2):
            if strategy_orders[i].side == OrderSide.BUY and strategy_orders[i+1].side == OrderSide.SELL:
                pnl = (strategy_orders[i+1].filled_price - strategy_orders[i].filled_price) * strategy_orders[i].quantity
                total_pnl += pnl
                
                if pnl > 0:
                    winning_trades += 1
                else:
                    losing_trades += 1
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Calculate Sharpe ratio (simplified)
        sharpe_ratio = (total_pnl / self.initial_balance) * 10  # Simplified calculation
        
        active_positions = len([p for p in self.positions.values() if p.strategy_id == strategy_id])
        
        return StrategyExecutionMetrics(
            strategy_id=strategy_id,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            total_pnl=total_pnl,
            win_rate=win_rate,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=0.0,  # TODO: Calculate actual max drawdown
            current_balance=self.current_balance,
            active_positions=active_positions
        )
    
    def get_active_positions(self) -> List[Position]:
        """Get all active positions."""
        return list(self.positions.values())
    
    def get_order_history(self) -> List[Order]:
        """Get order history."""
        return self.order_history

# === Copy Trading Integration ===

class CopyTradingEngine:
    """
    Automatically copies trades from source strategies to target accounts.
    Integrates with StrategyExecutionEngine for order management.
    """
    
    def __init__(self, execution_engine: StrategyExecutionEngine, allocation_percent: float = 35):
        self.execution_engine = execution_engine
        self.allocation_percent = allocation_percent
        self.copied_strategies: List[str] = []
        
    def add_strategy(self, strategy_id: str):
        """Add a strategy to copy from."""
        if strategy_id not in self.copied_strategies:
            self.copied_strategies.append(strategy_id)
            logger.info(f"Strategy {strategy_id} added for copy trading")
    
    def remove_strategy(self, strategy_id: str):
        """Remove a strategy from copying."""
        if strategy_id in self.copied_strategies:
            self.copied_strategies.remove(strategy_id)
            logger.info(f"Strategy {strategy_id} removed from copy trading")
    
    def copy_trade(self, source_strategy_id: str, symbol: str, side: OrderSide, quantity: float, price: float):
        """Copy a trade from source strategy."""
        if source_strategy_id not in self.copied_strategies:
            logger.warning(f"Strategy {source_strategy_id} not in copied strategies")
            return None
        
        # Adjust quantity based on allocation
        adjusted_quantity = quantity * (self.allocation_percent / 100)
        
        # Create and execute order
        order_type = OrderType.MARKET
        order = self.execution_engine.create_order(
            strategy_id=f"copy_{source_strategy_id}",
            symbol=symbol,
            side=side,
            type=order_type,
            quantity=adjusted_quantity,
            price=price,
            metadata={"source_strategy": source_strategy_id, "is_copy": True}
        )
        
        # Execute immediately (simulated)
        success = self.execution_engine.execute_order(order.id, price)
        
        if success:
            logger.info(f"Copied trade from {source_strategy_id}: {side.value} {adjusted_quantity} {symbol}")
        else:
            logger.error(f"Failed to copy trade from {source_strategy_id}")
        
        return order
    
    def update_allocation(self, new_allocation: float):
        """Update allocation percentage for copy trading."""
        self.allocation_percent = new_allocation
        logger.info(f"Copy trading allocation updated to {new_allocation}%")

# Define dynamic config
def get_dynamic_config() -> TradingConfig:
    cpu_count = multiprocessing.cpu_count()
    max_concurrent = min(max(20, cpu_count * 5), 100)
    return TradingConfig(
        timeframes={
            "scalping": "1m",
            "short": "5m",
            "medium": "1h",
            "daily": "1d",
            "weekly": "1w"
        },
        backtest_periods={
            "scalping": 100,
            "short": 50,
            "medium": 24,
            "daily": 7,
            "weekly": 4
        },
        momentum_periods={
            "crypto": {
                "scalping": {"short": 10, "long": 60},
                "short": {"short": 5, "long": 20},
                "medium": {"short": 4, "long": 12},
                "daily": {"short": 7, "long": 30},
                "weekly": {"short": 4, "long": 12}
            },
            "forex": {
                "scalping": {"short": 20, "long": 120},
                "short": {"short": 10, "long": 50},
                "medium": {"short": 6, "long": 24},
                "daily": {"short": 5, "long": 20},
                "weekly": {"short": 3, "long": 10}
            }
        },
        signal_thresholds={
            "crypto": {
                "scalping": {"momentum_short": 0.01, "rsi_min": 55, "rsi_max": 70, "macd_min": 0},
                "short": {"momentum_short": 0.03, "rsi_min": 52, "rsi_max": 68, "macd_min": 0},
                "medium": {"momentum_short": 0.05, "rsi_min": 50, "rsi_max": 65, "macd_min": 0},
                "daily": {"momentum_short": 0.06, "rsi_min": 50, "rsi_max": 65, "macd_min": 0},
                "weekly": {"momentum_short": 0.15, "rsi_min": 45, "rsi_max": 70, "macd_min": 0}
            },
            "forex": {
                "scalping": {"momentum_short": 0.002, "rsi_min": 50, "rsi_max": 70, "macd_min": 0},
                "short": {"momentum_short": 0.005, "rsi_min": 48, "rsi_max": 68, "macd_min": 0},
                "medium": {"momentum_short": 0.008, "rsi_min": 47, "rsi_max": 67, "macd_min": 0},
                "daily": {"momentum_short": 0.01, "rsi_min": 45, "rsi_max": 65, "macd_min": 0},
                "weekly": {"momentum_short": 0.03, "rsi_min": 40, "rsi_max": 70, "macd_min": 0}
            }
        },
        trade_durations={
            "scalping": 1800,
            "short": 14400,
            "medium": 86400,
            "daily": 604800,
            "weekly": 2592000
        },
        max_concurrent_requests=max_concurrent
    )

async def fetch_future_price(exchange, symbol: str, timeframe: str, periods: int) -> float:
    """Fetch closing price after specified periods for given timeframe."""
    timeframe_seconds = {
        '1m': 60,
        '5m': 300,
        '1h': 3600,
        '1d': 86400,
        '1w': 604800
    }
    try:
        ohlcv = await exchange.fetch_ohlcv(symbol, timeframe, limit=periods+1)
        return ohlcv[-1][4]  # Closing price
    except Exception as e:
        logger.error(f"Error fetching future price for {symbol} on {timeframe}: {e}")
        return np.nan
    finally:
        await exchange.close()

async def run_scanner(timeframe: str, config: TradingConfig, output_path: str):
    """Run MomentumScanner for a given timeframe and save results."""
    exchange = ccxt.kucoinfutures({'enableRateLimit': True})
    scanner = MomentumScanner(
        exchange=exchange,
        quote_currency='USDT',
        min_volume_usd=500000,
        top_n=50,  # Increased to ensure more signal diversity
        config=config
    )
    try:
        await scanner.scan_market(timeframe)
        scanner.scan_results.to_csv(output_path)
        logger.info(f"Scan results for {timeframe} saved to {output_path}")
    except Exception as e:
        logger.error(f"Error running scanner for {timeframe}: {e}")
    finally:
        await exchange.close()

import os

async def prepare_data(config: TradingConfig):
    """Prepare data for ML by generating multi-timeframe scans and computing targets."""
    import shutil
    timeframes = config.timeframes
    dfs = {}

    # Step 1: Run scans for all timeframes with per-timeframe caching
    for strategy, tf in timeframes.items():
        cached_file = f'scan_results_{tf}_latest.csv'
        if os.path.exists(cached_file):
            logger.info(f"Using cached scan file for {tf}: {cached_file}")
            dfs[tf] = pd.read_csv(cached_file)
        else:
            output_path = f'scan_results_{tf}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            logger.info(f"No cached scan found for {tf}, running fresh scan...")
            await run_scanner(tf, config, output_path)
            dfs[tf] = pd.read_csv(output_path)
            # Save/copy to latest for reuse
            shutil.copy(output_path, cached_file)

    # Step 2: Compute return targets
    exchange = ccxt.kucoinfutures({'enableRateLimit': True})
    for tf, df in dfs.items():
        periods = config.backtest_periods[list(timeframes.keys())[list(timeframes.values()).index(tf)]]
        future_prices = []
        for symbol in df['symbol']:
            price = await fetch_future_price(exchange, symbol, tf, periods)
            future_prices.append(price)
        df[f'{tf}_return'] = (pd.Series(future_prices) - df['price']) / df['price'] * 100
        dfs[tf] = df

    # Step 3: Compute signal consistency
    for tf, df in dfs.items():
        df['consistent'] = 0
        for symbol in df['symbol']:
            signal = df[df['symbol'] == symbol]['signal'].iloc[0]
            matches = sum(1 for other_tf, other_df in dfs.items() if symbol in other_df['symbol'].values and other_df[other_df['symbol'] == symbol]['signal'].iloc[0] == signal)
            df.loc[df['symbol'] == symbol, 'consistent'] = 1 if matches >= 3 else 0
        dfs[tf].to_csv(f'processed_scan_results_{tf}.csv')
    return dfs

def train_models(df: pd.DataFrame, timeframe: str):
    """Train XGBoost models for return prediction and signal consistency with comprehensive flow engine features."""
    
    # === COMPREHENSIVE FEATURE ENGINEERING ===
    # Ensure all available features are extracted
    
    # Base features from scanner
    base_features = [
        'momentum_short', 'momentum_long', 'rsi', 'macd', 'volume_ratio',
        'composite_score', 'volume_composite_score', 'trend_score',
        'confidence_score', 'bb_position', 'trend_strength', 'stoch_k',
        'stoch_d', 'poc_distance', 'ichimoku_bullish', 'vwap_bullish',
        'rsi_bearish_div', 'ema_5_13_bullish', 'ema_9_21_bullish',
        'ema_50_200_bullish'
    ]
    
    # Additional technical features (if available in dataframe)
    additional_features = []
    
    # Order flow features (if available)
    flow_features = [
        'bid_volume', 'ask_volume', 'net_flow', 'large_orders', 'small_orders',
        'bid_ask_ratio', 'flow_imbalance', 'order_size_distribution'
    ]
    
    # Microstructure features (if available)
    microstructure_features = [
        'spread', 'depth', 'market_imbalance', 'toxicity', 'spread_ratio'
    ]
    
    # Feature engineering: create new features from existing ones
    feature_engineering_functions = []
    
    def add_momentum_ratios(df):
        """Add momentum ratios if not present."""
        if 'momentum_short' in df.columns and 'momentum_long' in df.columns:
            df['momentum_ratio'] = df['momentum_short'] / (df['momentum_long'].abs() + 1e-10)
            df['momentum_combined'] = df['momentum_short'] * df['momentum_long']
        return df
    
    def add_rsi_derived_features(df):
        """Add RSI-derived features."""
        if 'rsi' in df.columns:
            df['rsi_oversold'] = (df['rsi'] < 30).astype(int)
            df['rsi_overbought'] = (df['rsi'] > 70).astype(int)
            df['rsi_neutral'] = ((df['rsi'] >= 30) & (df['rsi'] <= 70)).astype(int)
        return df
    
    def add_macd_derived_features(df):
        """Add MACD-derived features."""
        if 'macd' in df.columns:
            df['macd_positive'] = (df['macd'] > 0).astype(int)
            df['macd_signal_cross'] = df['macd'] - df.get('macd_signal', df['macd'])
        return df
    
    def add_volume_features(df):
        """Add volume-derived features."""
        if 'volume_ratio' in df.columns:
            df['volume_high'] = (df['volume_ratio'] > 1.2).astype(int)
            df['volume_low'] = (df['volume_ratio'] < 0.8).astype(int)
            df['volume_surge'] = (df['volume_ratio'] > 2.0).astype(int)
        return df
    
    def add_composite_features(df):
        """Add composite indicator features."""
        if 'composite_score' in df.columns:
            df['composite_strong'] = (df['composite_score'] > 70).astype(int)
            df['composite_weak'] = (df['composite_score'] < 30).astype(int)
            df['composite_very_strong'] = (df['composite_score'] > 85).astype(int)
        return df
    
    def add_bb_position_features(df):
        """Add Bollinger Bands position features."""
        if 'bb_position' in df.columns:
            df['bb_upper_band'] = (df['bb_position'] > 0.8).astype(int)
            df['bb_lower_band'] = (df['bb_position'] < 0.2).astype(int)
            df['bb_middle'] = ((df['bb_position'] >= 0.2) & (df['bb_position'] <= 0.8)).astype(int)
        return df
    
    def add_price_change_features(df):
        """Add price change features."""
        if 'price' in df.columns:
            df['price_change_pct'] = df['price'].pct_change()
            df['price_change_abs'] = df['price'].diff().abs()
            df['price_volatility'] = df['price'].rolling(window=20).std()
        return df
    
    # Apply feature engineering
    df = add_momentum_ratios(df)
    df = add_rsi_derived_features(df)
    df = add_macd_derived_features(df)
    df = add_volume_features(df)
    df = add_composite_features(df)
    df = add_bb_position_features(df)
    df = add_price_change_features(df)
    
    # Collect all features that exist in the dataframe
    all_possible_features = (
        base_features + 
        additional_features + 
        flow_features + 
        microstructure_features +
        ['momentum_ratio', 'momentum_combined', 'rsi_oversold', 'rsi_overbought', 
         'rsi_neutral', 'macd_positive', 'macd_signal_cross', 'volume_high', 
         'volume_low', 'volume_surge', 'composite_strong', 'composite_weak',
         'composite_very_strong', 'bb_upper_band', 'bb_lower_band', 'bb_middle',
         'price_change_pct', 'price_change_abs', 'price_volatility']
    )
    
    # Select only features that exist in the dataframe
    features = [f for f in all_possible_features if f in df.columns]
    
    logger.info(f"Using {len(features)} features for {timeframe} model training")
    logger.info(f"Features: {features[:10]}...")  # Log first 10 features
    
    # Ensure target column exists
    target_column = f'{timeframe}_return'
    if target_column not in df.columns:
        logger.error(f"Target column {target_column} not found in dataframe")
        return None, None
    
    df = df.dropna(subset=features + [target_column])

    # Return prediction (regression)
    X_return = df[features]
    y_return = df[target_column]
    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X_return, y_return, test_size=0.2, random_state=42)
    model_return = xgb.XGBRegressor(random_state=42)
    model_return.fit(X_train_r, y_train_r)
    y_pred_r = model_return.predict(X_test_r)
    mse = mean_squared_error(y_test_r, y_pred_r)
    logger.info(f"{timeframe} Return Prediction MSE: {mse:.2f}")

    # Signal consistency (classification)
    model_consistent = None
    X_consistent = None
    if 'consistent' in df.columns:
        y_consistent = df['consistent']
        if len(np.unique(y_consistent)) > 1:  # Check for multiple classes
            X_consistent = df[features]
            X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_consistent, y_consistent, test_size=0.2, random_state=42)
            # Apply SMOTE to balance classes if needed
            smote = SMOTE(random_state=42)
            smote_result = smote.fit_resample(X_train_c, y_train_c)
            if len(smote_result) == 2:
                X_train_c, y_train_c = smote_result
            else:
                X_train_c, y_train_c, _ = smote_result
            model_consistent = xgb.XGBClassifier(random_state=42)
            model_consistent.fit(X_train_c, y_train_c)
            y_pred_c = model_consistent.predict(X_test_c)
            accuracy = accuracy_score(y_test_c, y_pred_c)
            logger.info(f"{timeframe} Signal Consistency Accuracy: {accuracy:.2f}")
        else:
            logger.warning(f"Skipping signal consistency training for {timeframe}: Only one class found in 'consistent' column")
    else:
        logger.warning(f"Skipping signal consistency training for {timeframe}: 'consistent' column missing")

    # Save models and predictions
    model_return.save_model(f'model_return_{timeframe}.json')
    if model_consistent and X_consistent is not None:
        model_consistent.save_model(f'model_consistent_{timeframe}.json')
        df[f'predicted_consistent'] = model_consistent.predict(X_consistent)
    else:
        df[f'predicted_consistent'] = 0  # Default to 0 if no model trained
    df.to_csv(f'predictions_{timeframe}.csv')
    return model_return, model_consistent
    return model_return, model_consistent

async def main():
    config = get_dynamic_config()
    dfs = await prepare_data(config)
    for tf, df in dfs.items():
        logger.info(f"Training models for timeframe: {tf}")
        model_return, model_consistent = train_models(df, tf)

if __name__ == "__main__":
    asyncio.run(main())
