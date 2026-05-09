# Strategy Execution Engine & Copy Trading Integration

## Overview

The `train_models.py` file has been enhanced with a comprehensive **Strategy Execution Engine** and **Copy Trading** system that integrates seamlessly with the existing ML training pipeline and the frontend copy trading interface.

## What Was Added

### 1. Order Management System

#### Core Types
- **OrderStatus**: Enum for order states (PENDING, OPEN, FILLED, PARTIALLY_FILLED, CANCELLED, REJECTED)
- **OrderType**: Enum for order types (MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT)
- **OrderSide**: Enum for order sides (BUY, SELL)

#### Order Class
```python
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
    timestamp: datetime
    metadata: Dict
```

#### Position Class
```python
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
    timestamp: datetime
    metadata: Dict
```

### 2. Strategy Execution Engine

The `StrategyExecutionEngine` class manages the complete lifecycle of trading orders and positions:

#### Key Features:
- **Order Creation**: Create new orders with stop loss and take profit levels
- **Order Execution**: Execute orders with slippage and commission calculation
- **Position Tracking**: Monitor active positions with unrealized P&L
- **Risk Management**: Automatic stop loss and take profit execution
- **Balance Management**: Track available balance and prevent over-trading
- **Performance Metrics**: Calculate strategy performance (win rate, Sharpe ratio, etc.)

#### Key Methods:

```python
def create_order(...) -> Order:
    """Create a new trading order"""

def execute_order(order_id: str, execution_price: float) -> bool:
    """Execute an order at specified price"""

def update_positions(market_prices: Dict[str, float]):
    """Update position prices and check stop loss/take profit"""

def get_strategy_metrics(strategy_id: str) -> StrategyExecutionMetrics:
    """Calculate comprehensive strategy performance metrics"""

def get_active_positions() -> List[Position]:
    """Get all active positions"""

def get_order_history() -> List[Order]:
    """Get complete order history"""
```

### 3. Copy Trading Engine

The `CopyTradingEngine` class automates copying trades from source strategies:

#### Key Features:
- **Strategy Management**: Add/remove strategies for copying
- **Allocation Control**: Configure capital allocation per strategy (default 35%)
- **Automatic Execution**: Automatically copy trades from source strategies
- **Quantity Scaling**: Adjust copied trade quantities based on allocation

#### Key Methods:

```python
def add_strategy(strategy_id: str):
    """Add a strategy to copy from"""

def remove_strategy(strategy_id: str):
    """Remove a strategy from copying"""

def copy_trade(source_strategy_id: str, symbol: str, side: OrderSide, quantity: float, price: float):
    """Copy a trade from source strategy"""

def update_allocation(new_allocation: float):
    """Update allocation percentage"""
```

## Integration Points

### With ML Training Pipeline
- The execution engine can use ML model predictions for entry/exit signals
- Strategy performance metrics feed back into model training
- Historical order data used for model validation

### With Frontend Copy Trading UI
- `StrategyCopyTrading` component can trigger copy trade operations
- Real-time position updates displayed in the UI
- Allocation controls connected to `CopyTradingEngine.update_allocation()`
- Active/pause functionality managed via `add_strategy()` / `remove_strategy()`

### With Existing Scanner System
- Scanner signals can trigger order creation
- ML predictions from `train_models()` used for position sizing
- Backtest results integrated with strategy execution

## Usage Example

```python
# Initialize execution engine
engine = StrategyExecutionEngine(initial_balance=10000.0, max_positions=10)

# Initialize copy trading
copy_engine = CopyTradingEngine(engine, allocation_percent=35)

# Add strategies to copy
copy_engine.add_strategy("golden_cross_momentum")
copy_engine.add_strategy("volume_breakout")

# Copy a trade from a source strategy
copy_engine.copy_trade(
    source_strategy_id="golden_cross_momentum",
    symbol="BTC/USDT",
    side=OrderSide.BUY,
    quantity=0.5,
    price=43250.0
)

# Update positions with market prices
engine.update_positions({"BTC/USDT": 43500.0})

# Get strategy metrics
metrics = engine.get_strategy_metrics("copy_golden_cross_momentum")
print(f"Total P&L: ${metrics.total_pnl:.2f}")
print(f"Win Rate: {metrics.win_rate:.1f}%")
```

## Risk Management Features

1. **Stop Loss & Take Profit**: Automatic execution at specified levels
2. **Position Limits**: Maximum positions per symbol
3. **Balance Checks**: Prevent over-trading with insufficient funds
4. **Slippage & Commission**: Realistic cost calculations
5. **Drawdown Protection**: Built-in max drawdown tracking

## Performance Metrics

The system calculates comprehensive metrics:
- Total trades (winning/losing)
- Total P&L
- Win rate percentage
- Sharpe ratio
- Maximum drawdown
- Current balance
- Active positions count

## Benefits

1. **Automated Trading**: Hands-free trade execution
2. **Risk Control**: Built-in stop loss and position limits
3. **Performance Tracking**: Detailed metrics and analytics
4. **Copy Trading**: Automatically mirror successful strategies
5. **ML Integration**: Seamless connection with model predictions
6. **Scalability**: Multiple strategies and positions simultaneously

## Next Steps

1. **API Integration**: Connect with exchange APIs for live trading
2. **Database Persistence**: Store orders/positions in PostgreSQL
3. **WebSocket Updates**: Real-time position updates to frontend
4. **Advanced Risk Controls**: Add more sophisticated risk management
5. **Portfolio Optimization**: Automatic allocation rebalancing

## Files Modified

- `train_models.py`: Added StrategyExecutionEngine and CopyTradingEngine classes
- `client/src/components/StrategyCopyTrading.tsx`: Frontend UI for copy trading
- `client/src/pages/strategies.tsx`: Integration of copy trading button

## Testing

To test the execution engine:

```python
# Run the training script
python train_models.py

# The execution engine will be available in the module
from train_models import StrategyExecutionEngine, CopyTradingEngine
```

## Summary

This enhancement transforms the training pipeline from a pure ML system into a comprehensive trading execution platform that supports both manual strategy management and automated copy trading. It provides a solid foundation for live trading while maintaining integration with the existing ML training and scanning infrastructure.
