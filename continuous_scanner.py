"""
Continuous Multi-Timeframe Scanner
Addresses key limitations:
1. Continuous monitoring vs discrete scans
2. Multi-timeframe convergence analysis
3. Mean reversion + momentum exhaustion detection
4. Candle clustering for trend formation
5. Data persistence for ML/RL training
"""

import asyncio
import ccxt.pro as ccxt_async
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
import json
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import deque, defaultdict
from pathlib import Path
import aiofiles

from scanner import MomentumScanner

logger = logging.getLogger(__name__)


@dataclass
class StreamConfig:
    """Configuration for continuous data streams"""
    price_update_interval: int = 5      # Real-time ticks every 5 seconds
    signal_generation_interval: int = 30  # Analysis signals every 30 seconds
    market_state_interval: int = 60     # Global market conditions every 1 minute
    scan_interval: int = 90             # Full scan every 90 seconds (respects current performance)
    
    # Timeframe definitions aligned with trading styles
    timeframes: Dict[str, str] = None
    
    # Data retention limits
    max_candles_per_timeframe: int = 500
    max_signals_per_market: int = 1000
    max_ticks_buffer: int = 100
    
    # Mean reversion parameters
    momentum_exhaustion_threshold: int = 4  # 4+ consecutive moves same direction
    volume_exhaustion_multiplier: float = 1.5  # Volume spike threshold
    volume_decline_threshold: float = -0.1  # Volume trend decline
    excessive_gain_threshold: float = 0.15  # 15% gain in 5 periods
    
    # Candle clustering parameters
    volume_threshold_multiplier: float = 2.0  # 2x average volume for "high volume"
    cluster_trend_threshold: float = 0.7  # 70% directional clustering
    cluster_followthrough_threshold: float = 0.5  # 50% follow-through required
    
    # Momentum/Reversion balance
    momentum_bias: float = 0.6  # 60% momentum, 40% mean reversion
    
    def __post_init__(self):
        if self.timeframes is None:
            self.timeframes = {
                'scalp': '5m',      # 60-100 min style (~20 candles)
                'day_trade': '4h',  # Day trading with 4h candles
                'swing': '1h',      # Medium-term swing trades
                'position': '1d'    # 7-day position style
            }


@dataclass
class MarketTick:
    """Real-time market tick data"""
    symbol: str
    timestamp: datetime
    price: float
    volume: float
    bid: Optional[float] = None
    ask: Optional[float] = None


@dataclass
class CandleCluster:
    """Candle clustering analysis result"""
    symbol: str
    timeframe: str
    timestamp: datetime
    total_clusters: int
    bullish_clusters: int
    bearish_clusters: int
    directional_ratio: float
    follow_through: float
    trend_formation_signal: bool
    cluster_strength: float


class DataPersistenceManager:
    """Manages data persistence for ML/RL training"""
    
    def __init__(self, base_path: str = "training_data"):
        self.base_path = Path(base_path)
        self.signals_path = self.base_path / "signals"
        self.ohlcv_path = self.base_path / "ohlcv"
        self.clustering_path = self.base_path / "clustering"
        
        # Create directories
        for path in [self.signals_path, self.ohlcv_path, self.clustering_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    async def persist_signals(self, symbol: str, signal_data: Dict, timestamp: datetime):
        """Store signals as daily JSON files"""
        date_str = timestamp.strftime("%Y-%m-%d")
        file_path = self.signals_path / f"{symbol.replace('/', '_')}_{date_str}.json"
        
        # Read existing data or create new
        try:
            async with aiofiles.open(file_path, 'r') as f:
                data = json.loads(await f.read())
        except FileNotFoundError:
            data = []
        
        # Append new signal
        signal_data['timestamp'] = timestamp.isoformat()
        data.append(signal_data)
        
        # Write back
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(json.dumps(data, indent=2))
    
    async def persist_ohlcv(self, symbol: str, timeframe: str, ohlcv_df: pd.DataFrame):
        """Store OHLCV data as parquet files"""
        file_path = self.ohlcv_path / f"{symbol.replace('/', '_')}_{timeframe}.parquet"
        
        # Use sync write (pandas doesn't have async parquet write)
        ohlcv_df.to_parquet(file_path, compression='gzip')
    
    async def persist_clustering(self, cluster_data: CandleCluster):
        """Store clustering analysis data"""
        date_str = cluster_data.timestamp.strftime("%Y-%m-%d")
        file_path = self.clustering_path / f"{cluster_data.symbol.replace('/', '_')}_{date_str}.json"
        
        try:
            async with aiofiles.open(file_path, 'r') as f:
                data = json.loads(await f.read())
        except FileNotFoundError:
            data = []
        
        data.append(asdict(cluster_data))
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(json.dumps(data, indent=2))
    
    async def get_training_dataset(self, symbol: str, days: int = 30) -> Dict:
        """Retrieve complete training dataset for Oracle Engine & RL pipeline"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        dataset = {
            'signals': [],
            'ohlcv': {},
            'clustering': []
        }
        
        # Load signals
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            file_path = self.signals_path / f"{symbol.replace('/', '_')}_{date_str}.json"
            try:
                async with aiofiles.open(file_path, 'r') as f:
                    data = json.loads(await f.read())
                    dataset['signals'].extend(data)
            except FileNotFoundError:
                pass
            current_date += timedelta(days=1)
        
        # Load OHLCV for all timeframes
        for timeframe in ['5m', '4h', '1h', '1d']:
            file_path = self.ohlcv_path / f"{symbol.replace('/', '_')}_{timeframe}.parquet"
            try:
                df = pd.read_parquet(file_path)
                dataset['ohlcv'][timeframe] = df.to_dict('records')
            except FileNotFoundError:
                pass
        
        # Load clustering data
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            file_path = self.clustering_path / f"{symbol.replace('/', '_')}_{date_str}.json"
            try:
                async with aiofiles.open(file_path, 'r') as f:
                    data = json.loads(await f.read())
                    dataset['clustering'].extend(data)
            except FileNotFoundError:
                pass
            current_date += timedelta(days=1)
        
        return dataset


class ContinuousMultiTimeframeScanner:
    """
    Continuous scanner with multi-timeframe analysis, mean reversion,
    and candle clustering detection
    """
    
    def __init__(self, config: Optional[StreamConfig] = None):
        self.config = config or StreamConfig()
        self.scanner = MomentumScanner()
        self.persistence = DataPersistenceManager()
        
        # Data buffers
        self.tick_buffers: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=self.config.max_ticks_buffer)
        )
        self.candle_buffers: Dict[Tuple[str, str], deque] = defaultdict(
            lambda: deque(maxlen=self.config.max_candles_per_timeframe)
        )
        self.signal_history: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=self.config.max_signals_per_market)
        )
        
        # State tracking
        self.running = False
        self.market_state = {}
        self.last_full_scan = None
        
        # Exchange connections
        self.exchanges = {}
        
        logger.info(f"Initialized ContinuousMultiTimeframeScanner with config: {self.config}")
    
    async def start(self, symbols: List[str], exchanges: List[str] = ['binance', 'kucoinfutures']):
        """Start continuous monitoring"""
        logger.info(f"Starting continuous scanner for {len(symbols)} symbols across {len(exchanges)} exchanges")
        self.running = True
        
        # Initialize exchanges
        for exchange_name in exchanges:
            try:
                exchange_class = getattr(ccxt_async, exchange_name)
                self.exchanges[exchange_name] = exchange_class({'enableRateLimit': True})
                logger.info(f"Connected to {exchange_name}")
            except Exception as e:
                logger.error(f"Failed to connect to {exchange_name}: {e}")
        
        # Start parallel streams
        tasks = [
            self._continuous_price_updates(symbols),
            self._periodic_signal_generation(symbols),
            self._market_state_analysis(symbols),
            self._periodic_full_scan(symbols)
        ]
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error in continuous scanner: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop continuous monitoring and cleanup"""
        logger.info("Stopping continuous scanner...")
        self.running = False
        
        # Close exchange connections
        for exchange in self.exchanges.values():
            await exchange.close()
        
        logger.info("Continuous scanner stopped")
    
    async def _continuous_price_updates(self, symbols: List[str]):
        """Stream 1: Real-time price ticks every 5 seconds"""
        logger.info("Starting continuous price update stream (5-second updates)")
        
        while self.running:
            try:
                update_tasks = []
                for symbol in symbols:
                    for exchange_name, exchange in self.exchanges.items():
                        update_tasks.append(
                            self._fetch_and_store_tick(exchange, symbol, exchange_name)
                        )
                
                await asyncio.gather(*update_tasks, return_exceptions=True)
                await asyncio.sleep(self.config.price_update_interval)
                
            except Exception as e:
                logger.error(f"Error in price update stream: {e}")
                await asyncio.sleep(5)
    
    async def _fetch_and_store_tick(self, exchange, symbol: str, exchange_name: str):
        """Fetch and store a single tick"""
        try:
            ticker = await exchange.fetch_ticker(symbol)
            tick = MarketTick(
                symbol=f"{exchange_name}:{symbol}",
                timestamp=datetime.now(timezone.utc),
                price=ticker['last'],
                volume=ticker['quoteVolume'] or 0,
                bid=ticker.get('bid'),
                ask=ticker.get('ask')
            )
            self.tick_buffers[tick.symbol].append(tick)
            
        except Exception as e:
            logger.debug(f"Failed to fetch tick for {symbol} on {exchange_name}: {e}")
    
    async def _periodic_signal_generation(self, symbols: List[str]):
        """Stream 2: Generate analysis signals every 30 seconds"""
        logger.info("Starting periodic signal generation stream (30-second updates)")
        
        while self.running:
            try:
                signal_tasks = []
                for symbol in symbols:
                    for timeframe_style, timeframe in self.config.timeframes.items():
                        signal_tasks.append(
                            self._generate_signals_for_symbol_timeframe(
                                symbol, timeframe_style, timeframe
                            )
                        )
                
                await asyncio.gather(*signal_tasks, return_exceptions=True)
                await asyncio.sleep(self.config.signal_generation_interval)
                
            except Exception as e:
                logger.error(f"Error in signal generation stream: {e}")
                await asyncio.sleep(10)
    
    async def _generate_signals_for_symbol_timeframe(
        self, 
        symbol: str, 
        style: str, 
        timeframe: str
    ):
        """Generate signals for a specific symbol and timeframe"""
        try:
            # Fetch recent candles for this timeframe
            for exchange_name, exchange in self.exchanges.items():
                try:
                    ohlcv = await exchange.fetch_ohlcv(symbol, timeframe, limit=100)
                    if not ohlcv:
                        continue
                    
                    df = pd.DataFrame(
                        ohlcv, 
                        columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
                    )
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                    
                    # Store in candle buffer
                    key = (f"{exchange_name}:{symbol}", timeframe)
                    self.candle_buffers[key].append(df)
                    
                    # Generate enhanced signals
                    signals = await self._analyze_with_clustering_and_reversion(
                        df, symbol, exchange_name, style, timeframe
                    )
                    
                    # Store signals
                    signal_key = f"{exchange_name}:{symbol}:{timeframe}"
                    self.signal_history[signal_key].append(signals)
                    
                    # Persist for training
                    await self.persistence.persist_signals(
                        f"{exchange_name}:{symbol}",
                        signals,
                        datetime.now(timezone.utc)
                    )
                    
                    # Persist OHLCV
                    await self.persistence.persist_ohlcv(
                        f"{exchange_name}:{symbol}",
                        timeframe,
                        df.tail(500)  # Keep last 500 candles
                    )
                    
                    break  # Success, move to next symbol
                    
                except Exception as e:
                    logger.debug(f"Failed to generate signals for {symbol} on {exchange_name}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error generating signals for {symbol} {timeframe}: {e}")
    
    async def _analyze_with_clustering_and_reversion(
        self,
        df: pd.DataFrame,
        symbol: str,
        exchange: str,
        style: str,
        timeframe: str
    ) -> Dict:
        """Enhanced analysis with clustering and mean reversion"""
        
        # Candle clustering analysis
        cluster_signals = self._detect_candle_clustering(df)
        
        # Mean reversion detection
        reversion_signals = self._detect_smart_mean_reversion(df, style)
        
        # Enhanced momentum (cluster-validated)
        momentum_signals = self._detect_enhanced_momentum(df, cluster_signals)
        
        # Combine signals with momentum/reversion balance
        combined_score = (
            momentum_signals['momentum_score'] * self.config.momentum_bias +
            reversion_signals['reversion_score'] * (1 - self.config.momentum_bias)
        )
        
        return {
            'symbol': symbol,
            'exchange': exchange,
            'style': style,
            'timeframe': timeframe,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'price': float(df.iloc[-1]['close']),
            'momentum': momentum_signals,
            'reversion': reversion_signals,
            'clustering': cluster_signals,
            'combined_score': float(combined_score),
            'signal_type': self._determine_signal_type(
                momentum_signals, reversion_signals, combined_score
            )
        }
    
    def _detect_candle_clustering(self, df: pd.DataFrame) -> Dict:
        """
        Candle Clustering Logic:
        - Identifies high-volume candles (2x average volume)
        - Groups consecutive high-volume candles by direction
        - Analyzes follow-through and trend formation
        """
        if len(df) < 20:
            return {'error': 'insufficient_data'}
        
        recent = df.tail(20).copy()
        volume_sma = recent['volume'].mean()
        
        # Identify high-volume candles
        high_volume_threshold = volume_sma * self.config.volume_threshold_multiplier
        recent['high_volume'] = recent['volume'] > high_volume_threshold
        recent['bullish'] = recent['close'] > recent['open']
        
        # Detect clusters
        clusters = []
        current_cluster = {'direction': None, 'size': 0, 'volume': 0}
        
        for idx, row in recent.iterrows():
            if not row['high_volume']:
                if current_cluster['size'] > 0:
                    clusters.append(current_cluster.copy())
                current_cluster = {'direction': None, 'size': 0, 'volume': 0}
                continue
            
            direction = 'bullish' if row['bullish'] else 'bearish'
            
            if current_cluster['direction'] == direction or current_cluster['direction'] is None:
                current_cluster['direction'] = direction
                current_cluster['size'] += 1
                current_cluster['volume'] += row['volume']
            else:
                if current_cluster['size'] > 0:
                    clusters.append(current_cluster.copy())
                current_cluster = {'direction': direction, 'size': 1, 'volume': row['volume']}
        
        if current_cluster['size'] > 0:
            clusters.append(current_cluster)
        
        # Analyze clustering patterns
        if not clusters:
            return {
                'trend_formation_signal': False,
                'cluster_strength': 0,
                'total_clusters': 0
            }
        
        total_clusters = len(clusters)
        bullish_clusters = sum(1 for c in clusters if c['direction'] == 'bullish')
        bearish_clusters = sum(1 for c in clusters if c['direction'] == 'bearish')
        
        directional_ratio = max(bullish_clusters, bearish_clusters) / total_clusters if total_clusters > 0 else 0
        
        # Check follow-through (do subsequent candles continue the cluster direction?)
        if clusters:
            last_cluster = clusters[-1]
            last_3_candles = recent.tail(3)
            if last_cluster['direction'] == 'bullish':
                follow_through = (last_3_candles['close'] > last_3_candles['open']).sum() / 3
            else:
                follow_through = (last_3_candles['close'] < last_3_candles['open']).sum() / 3
        else:
            follow_through = 0
        
        trend_formation = (
            directional_ratio > self.config.cluster_trend_threshold and 
            follow_through > self.config.cluster_followthrough_threshold
        )
        
        cluster_strength = directional_ratio * follow_through
        
        # Persist clustering data
        cluster_data = CandleCluster(
            symbol=f"{df.attrs.get('exchange', 'unknown')}:{df.attrs.get('symbol', 'unknown')}",
            timeframe=df.attrs.get('timeframe', 'unknown'),
            timestamp=datetime.now(timezone.utc),
            total_clusters=total_clusters,
            bullish_clusters=bullish_clusters,
            bearish_clusters=bearish_clusters,
            directional_ratio=float(directional_ratio),
            follow_through=float(follow_through),
            trend_formation_signal=trend_formation,
            cluster_strength=float(cluster_strength)
        )
        
        return {
            'trend_formation_signal': trend_formation,
            'cluster_strength': float(cluster_strength),
            'total_clusters': total_clusters,
            'bullish_clusters': bullish_clusters,
            'bearish_clusters': bearish_clusters,
            'directional_ratio': float(directional_ratio),
            'follow_through': float(follow_through)
        }
    
    def _detect_smart_mean_reversion(self, df: pd.DataFrame, style: str) -> Dict:
        """
        Enhanced Mean Reversion Detection:
        - Momentum exhaustion (4+ consecutive moves same direction)
        - Volume exhaustion (high volume declining)
        - Excessive gains detection
        """
        if len(df) < 10:
            return {'reversion_score': 0, 'error': 'insufficient_data'}
        
        recent = df.tail(10).copy()
        recent['price_change'] = recent['close'].pct_change()
        recent['volume_change'] = recent['volume'].pct_change()
        
        # 1. Momentum Exhaustion: Count consecutive moves in same direction
        consecutive_moves = self._count_consecutive_moves(recent['price_change'].values)
        momentum_exhaustion = consecutive_moves >= self.config.momentum_exhaustion_threshold
        
        # 2. Volume Exhaustion: High volume but declining
        recent_volume = recent['volume'].iloc[-3:].mean()
        volume_sma = recent['volume'].mean()
        volume_trend = recent['volume'].iloc[-3:].pct_change().mean()
        
        volume_exhaustion = (
            recent_volume > volume_sma * self.config.volume_exhaustion_multiplier and
            volume_trend < self.config.volume_decline_threshold
        )
        
        # 3. Excessive Gains: >15% gain in 5 periods
        if len(df) >= 5:
            recent_gain = (recent['close'].iloc[-1] - df.iloc[-5]['close']) / df.iloc[-5]['close']
            excessive_gain = abs(recent_gain) > self.config.excessive_gain_threshold
        else:
            recent_gain = 0
            excessive_gain = False
        
        # 4. RSI Extreme Check (overbought/oversold)
        if len(df) >= 14:
            rsi_val = self._calculate_simple_rsi(df['close'], period=14)
            is_overbought = rsi_val > 70
            is_oversold = rsi_val < 30
        else:
            is_overbought = False
            is_oversold = False
        
        # Calculate reversion probability
        reversion_factors = [
            momentum_exhaustion,
            volume_exhaustion,
            excessive_gain,
            is_overbought or is_oversold
        ]
        
        reversion_score = sum(reversion_factors) / len(reversion_factors) * 100
        
        # Determine reversion direction
        if recent_gain > 0:
            reversion_direction = 'bearish'  # Expect pullback
        else:
            reversion_direction = 'bullish'  # Expect bounce
        
        return {
            'reversion_score': float(reversion_score),
            'momentum_exhaustion': momentum_exhaustion,
            'consecutive_moves': consecutive_moves,
            'volume_exhaustion': volume_exhaustion,
            'excessive_gain': excessive_gain,
            'recent_gain_pct': float(recent_gain * 100),
            'is_overbought': is_overbought,
            'is_oversold': is_oversold,
            'reversion_direction': reversion_direction,
            'reversion_candidate': reversion_score > 50
        }
    
    def _count_consecutive_moves(self, price_changes: np.ndarray) -> int:
        """Count consecutive moves in the same direction"""
        if len(price_changes) == 0:
            return 0
        
        # Remove NaN and filter out near-zero changes
        valid_changes = price_changes[~np.isnan(price_changes)]
        valid_changes = valid_changes[np.abs(valid_changes) > 0.001]
        
        if len(valid_changes) == 0:
            return 0
        
        # Count consecutive moves from the end
        last_direction = np.sign(valid_changes[-1])
        count = 1
        
        for change in reversed(valid_changes[:-1]):
            if np.sign(change) == last_direction:
                count += 1
            else:
                break
        
        return count
    
    def _calculate_simple_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Simple RSI calculation"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
    
    def _detect_enhanced_momentum(self, df: pd.DataFrame, cluster_signals: Dict) -> Dict:
        """
        Enhanced Momentum Detection with Cluster Validation:
        - Traditional momentum metrics
        - Boosted by clustering strength when aligned
        """
        if len(df) < 20:
            return {'momentum_score': 0, 'error': 'insufficient_data'}
        
        recent = df.tail(20).copy()
        
        # Price momentum
        price_change = (recent['close'].iloc[-1] - recent['close'].iloc[-10]) / recent['close'].iloc[-10]
        
        # Volume ratio
        recent_volume = recent['volume'].iloc[-5:].mean()
        avg_volume = recent['volume'].mean()
        volume_ratio = recent_volume / avg_volume if avg_volume > 0 else 1
        
        # Base momentum score
        momentum_score = abs(price_change) * volume_ratio * 100
        
        # Cluster validation boost
        cluster_validation = (
            cluster_signals.get('trend_formation_signal', False) and
            cluster_signals.get('cluster_strength', 0) > 0.5
        )
        
        if cluster_validation:
            cluster_boost = 1 + cluster_signals.get('cluster_strength', 0)
            momentum_score *= cluster_boost
        
        # Classify strength
        if momentum_score > 80:
            strength_classification = 'strong'
        elif momentum_score > 50:
            strength_classification = 'moderate'
        else:
            strength_classification = 'weak'
        
        return {
            'momentum_score': float(min(momentum_score, 100)),  # Cap at 100
            'price_change_pct': float(price_change * 100),
            'volume_ratio': float(volume_ratio),
            'cluster_validated': cluster_validation,
            'strength_classification': strength_classification
        }
    
    def _determine_signal_type(
        self, 
        momentum: Dict, 
        reversion: Dict, 
        combined_score: float
    ) -> str:
        """Determine overall signal type based on momentum and reversion"""
        
        # Strong momentum signal
        if momentum.get('momentum_score', 0) > 70 and not reversion.get('reversion_candidate', False):
            direction = 'BUY' if momentum.get('price_change_pct', 0) > 0 else 'SELL'
            return f'MOMENTUM_{direction}'
        
        # Mean reversion signal
        if reversion.get('reversion_candidate', False):
            return f"REVERSION_{reversion.get('reversion_direction', 'NEUTRAL').upper()}"
        
        # Combined signal
        if combined_score > 60:
            return 'STRONG_BUY' if momentum.get('price_change_pct', 0) > 0 else 'STRONG_SELL'
        elif combined_score > 40:
            return 'WEAK_BUY' if momentum.get('price_change_pct', 0) > 0 else 'WEAK_SELL'
        
        return 'NEUTRAL'
    
    async def _market_state_analysis(self, symbols: List[str]):
        """Stream 3: Global market conditions every 1 minute"""
        logger.info("Starting market state analysis stream (1-minute updates)")
        
        while self.running:
            try:
                # Analyze overall market conditions
                market_breadth = await self._calculate_market_breadth(symbols)
                volatility_regime = self._determine_volatility_regime()
                
                self.market_state = {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'breadth': market_breadth,
                    'volatility_regime': volatility_regime,
                    'active_signals': len([
                        s for signals in self.signal_history.values()
                        for s in signals
                        if s.get('combined_score', 0) > 60
                    ])
                }
                
                logger.info(f"Market State: {self.market_state}")
                await asyncio.sleep(self.config.market_state_interval)
                
            except Exception as e:
                logger.error(f"Error in market state analysis: {e}")
                await asyncio.sleep(30)
    
    async def _calculate_market_breadth(self, symbols: List[str]) -> Dict:
        """Calculate market breadth metrics"""
        advancing = 0
        declining = 0
        
        for symbol_key, ticks in self.tick_buffers.items():
            if len(ticks) < 2:
                continue
            
            price_change = ticks[-1].price - ticks[0].price
            if price_change > 0:
                advancing += 1
            elif price_change < 0:
                declining += 1
        
        total = advancing + declining
        breadth_ratio = advancing / total if total > 0 else 0.5
        
        return {
            'advancing': advancing,
            'declining': declining,
            'breadth_ratio': float(breadth_ratio),
            'market_bias': 'bullish' if breadth_ratio > 0.6 else 'bearish' if breadth_ratio < 0.4 else 'neutral'
        }
    
    def _determine_volatility_regime(self) -> str:
        """Determine current volatility regime"""
        all_price_changes = []
        
        for ticks in self.tick_buffers.values():
            if len(ticks) < 2:
                continue
            for i in range(1, len(ticks)):
                change = abs((ticks[i].price - ticks[i-1].price) / ticks[i-1].price)
                all_price_changes.append(change)
        
        if not all_price_changes:
            return 'unknown'
        
        avg_volatility = np.mean(all_price_changes)
        
        if avg_volatility > 0.01:  # 1%+ average change
            return 'high'
        elif avg_volatility > 0.005:  # 0.5-1%
            return 'medium'
        else:
            return 'low'
    
    async def _periodic_full_scan(self, symbols: List[str]):
        """Stream 4: Full comprehensive scan every 90 seconds"""
        logger.info("Starting periodic full scan stream (90-second interval)")
        
        while self.running:
            try:
                logger.info("Executing full market scan...")
                
                # Use existing scanner for comprehensive analysis
                results = await self.scanner.scan_market(
                    timeframe='medium',
                    full_analysis=True,
                    save_results=False
                )
                
                self.last_full_scan = {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'total_signals': len(results) if not results.empty else 0,
                    'top_opportunities': results.head(10).to_dict('records') if not results.empty else []
                }
                
                logger.info(f"Full scan complete: {self.last_full_scan['total_signals']} signals generated")
                
                await asyncio.sleep(self.config.scan_interval)
                
            except Exception as e:
                logger.error(f"Error in full scan: {e}")
                await asyncio.sleep(30)
    
    def get_latest_signals(
        self, 
        symbol: Optional[str] = None,
        timeframe: Optional[str] = None,
        min_score: float = 0,
        limit: int = 50
    ) -> List[Dict]:
        """Retrieve latest signals with optional filtering"""
        all_signals = []
        
        for key, signals in self.signal_history.items():
            for signal in signals:
                if symbol and symbol not in signal.get('symbol', ''):
                    continue
                if timeframe and timeframe != signal.get('timeframe'):
                    continue
                if signal.get('combined_score', 0) < min_score:
                    continue
                
                all_signals.append(signal)
        
        # Sort by score and timestamp
        all_signals.sort(
            key=lambda x: (x.get('combined_score', 0), x.get('timestamp', '')),
            reverse=True
        )
        
        return all_signals[:limit]
    
    def get_market_state(self) -> Dict:
        """Get current market state"""
        return self.market_state
    
    def get_full_scan_results(self) -> Optional[Dict]:
        """Get results from last full scan"""
        return self.last_full_scan
    
    async def get_multi_timeframe_confluence(
        self, 
        symbol: str,
        min_score: float = 60
    ) -> Dict:
        """
        Check for multi-timeframe signal convergence
        Returns confluence analysis across all timeframes
        """
        timeframe_signals = {}
        
        for timeframe_style in self.config.timeframes.keys():
            key = f"*{symbol}*{timeframe_style}"
            matching_signals = [
                s for k, signals in self.signal_history.items()
                if symbol in k and timeframe_style in k
                for s in signals
            ]
            
            if matching_signals:
                latest = matching_signals[-1]
                timeframe_signals[timeframe_style] = latest
        
        # Analyze confluence
        if not timeframe_signals:
            return {'confluence': False, 'message': 'No signals found'}
        
        scores = [s.get('combined_score', 0) for s in timeframe_signals.values()]
        signal_types = [s.get('signal_type', 'NEUTRAL') for s in timeframe_signals.values()]
        
        # Check for alignment
        buy_signals = sum(1 for st in signal_types if 'BUY' in st)
        sell_signals = sum(1 for st in signal_types if 'SELL' in st)
        
        has_confluence = (
            (buy_signals >= 2 or sell_signals >= 2) and
            min(scores) >= min_score
        )
        
        return {
            'symbol': symbol,
            'confluence': has_confluence,
            'timeframes_analyzed': len(timeframe_signals),
            'average_score': float(np.mean(scores)),
            'bullish_timeframes': buy_signals,
            'bearish_timeframes': sell_signals,
            'dominant_bias': 'bullish' if buy_signals > sell_signals else 'bearish' if sell_signals > buy_signals else 'neutral',
            'timeframe_details': timeframe_signals,
            'recommendation': 'STRONG' if has_confluence and np.mean(scores) > 75 else 'MODERATE' if has_confluence else 'WEAK'
        }


# Convenience function
async def run_continuous_scanner(
    symbols: List[str] = None,
    exchanges: List[str] = ['binance', 'kucoinfutures'],
    config: Optional[StreamConfig] = None
):
    """Run continuous scanner with default crypto pairs"""
    if symbols is None:
        symbols = [
            'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
            'ADA/USDT', 'DOGE/USDT', 'MATIC/USDT', 'DOT/USDT', 'LINK/USDT'
        ]
    
    scanner = ContinuousMultiTimeframeScanner(config)
    
    try:
        await scanner.start(symbols, exchanges)
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        await scanner.stop()


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_continuous_scanner())

