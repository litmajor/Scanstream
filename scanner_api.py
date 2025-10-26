"""
Flask API wrapper for the Momentum Scanner
Provides REST endpoints to trigger scans and retrieve results
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import logging
from datetime import datetime
from scanner import MomentumScanner, get_dynamic_config, TechnicalIndicators
from continuous_scanner import ContinuousMultiTimeframeScanner, StreamConfig
import pandas as pd
from typing import Optional, List, Dict
import json
import threading
import ccxt.async_support as ccxt_async

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global scanner instances
scanner: Optional[MomentumScanner] = None
continuous_scanner: Optional[ContinuousMultiTimeframeScanner] = None
continuous_scanner_task: Optional[asyncio.Task] = None
continuous_scanner_loop: Optional[asyncio.AbstractEventLoop] = None
last_scan_results: Optional[pd.DataFrame] = None
last_scan_timestamp: Optional[datetime] = None


async def initialize_exchange(exchange_id: str = 'kucoinfutures'):
    """Initialize and return a ccxt exchange instance"""
    try:
        exchange_class = getattr(ccxt_async, exchange_id)
        exchange = exchange_class({
            'enableRateLimit': True,
            'timeout': 30000,
            'options': {
                'defaultType': 'future',  # or 'spot'
                'recvWindow': 10000
            }
        })
        await exchange.load_markets()
        logger.info(f"Exchange {exchange_id} initialized successfully")
        return exchange
    except Exception as e:
        logger.error(f"Failed to initialize exchange {exchange_id}: {e}")
        raise


def get_scanner(loop, exchange_id='kucoinfutures'):
    """Create a fresh scanner instance for the given event loop"""
    try:
        # Initialize exchange synchronously with the provided loop
        exchange = loop.run_until_complete(initialize_exchange(exchange_id))
        config = get_dynamic_config()
        
        scanner_instance = MomentumScanner(
            exchange=exchange,
            config=config,
            market_type='crypto',
            quote_currency='USDT',
            top_n=50,
            min_volume_usd=100000
        )
        logger.info(f"Scanner instance created successfully for exchange: {exchange_id}")
        return scanner_instance
    except Exception as e:
        logger.error(f"Failed to create scanner for {exchange_id}: {e}")
        raise


async def scan_single_exchange_async(exchange_id: str, timeframe: str, full_analysis: bool = True) -> tuple:
    """
    Scan a single exchange asynchronously
    Returns: (exchange_id, results_df, duration, error)
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"⚡ Starting async scan for {exchange_id}")
        
        # Initialize exchange
        init_start = datetime.now()
        exchange = await initialize_exchange(exchange_id)
        init_duration = (datetime.now() - init_start).total_seconds()
        
        # Create scanner
        config = get_dynamic_config()
        scanner_instance = MomentumScanner(
            exchange=exchange,
            config=config,
            market_type='crypto',
            quote_currency='USDT',
            top_n=50,
            min_volume_usd=100000
        )
        
        # Run scan
        scan_start = datetime.now()
        results = await scanner_instance.scan_market(
            timeframe=timeframe,
            full_analysis=full_analysis,
            save_results=False
        )
        scan_duration = (datetime.now() - scan_start).total_seconds()
        
        # Clean up
        await exchange.close()
        
        total_duration = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"✅ {exchange_id} scan completed in {total_duration:.2f}s (init: {init_duration:.2f}s, scan: {scan_duration:.2f}s)")
        
        return (exchange_id, results, total_duration, None)
        
    except Exception as e:
        total_duration = (datetime.now() - start_time).total_seconds()
        logger.error(f"❌ {exchange_id} scan failed after {total_duration:.2f}s: {str(e)}")
        return (exchange_id, pd.DataFrame(), total_duration, str(e))


async def scan_multiple_exchanges_parallel(exchanges: List[str], timeframe: str, full_analysis: bool = True) -> Dict:
    """
    Scan multiple exchanges in parallel using asyncio.gather
    
    Args:
        exchanges: List of exchange IDs to scan
        timeframe: Timeframe for scanning
        full_analysis: Whether to run full analysis
        
    Returns:
        Dictionary with aggregated results and metadata
    """
    parallel_start = datetime.now()
    
    logger.info("="*80)
    logger.info(f"🚀 PARALLEL SCAN STARTED")
    logger.info(f"   Exchanges: {', '.join(exchanges)}")
    logger.info(f"   Timeframe: {timeframe}")
    logger.info(f"   Full Analysis: {full_analysis}")
    logger.info(f"   Start Time: {parallel_start.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
    logger.info("="*80)
    
    # Run all exchanges in parallel
    tasks = [scan_single_exchange_async(ex, timeframe, full_analysis) for ex in exchanges]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    
    parallel_end = datetime.now()
    total_duration = (parallel_end - parallel_start).total_seconds()
    
    # Aggregate results
    all_results = []
    exchange_metadata = {}
    successful_scans = 0
    failed_scans = 0
    
    for exchange_id, df, duration, error in results:
        exchange_metadata[exchange_id] = {
            'duration_seconds': round(duration, 2),
            'success': error is None,
            'error': error,
            'signals_found': len(df) if not df.empty else 0
        }
        
        if error is None:
            successful_scans += 1
            all_results.append((exchange_id, df))
        else:
            failed_scans += 1
    
    # Calculate efficiency gain
    sequential_time = sum(meta['duration_seconds'] for meta in exchange_metadata.values())
    speedup = sequential_time / total_duration if total_duration > 0 else 1
    time_saved = sequential_time - total_duration
    
    logger.info("="*80)
    logger.info(f"✅ PARALLEL SCAN COMPLETED")
    logger.info(f"   Successful: {successful_scans}/{len(exchanges)} exchanges")
    logger.info(f"   Failed: {failed_scans}/{len(exchanges)} exchanges")
    logger.info(f"   Parallel Time: {total_duration:.2f} seconds")
    logger.info(f"   Sequential Time (estimated): {sequential_time:.2f} seconds")
    logger.info(f"   Speedup: {speedup:.2f}x faster")
    logger.info(f"   Time Saved: {time_saved:.2f} seconds ({(time_saved/sequential_time*100):.1f}%)")
    logger.info(f"   End Time: {parallel_end.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
    logger.info("="*80)
    
    return {
        'results': all_results,
        'exchange_metadata': exchange_metadata,
        'parallel_duration': round(total_duration, 2),
        'sequential_duration_estimated': round(sequential_time, 2),
        'speedup': round(speedup, 2),
        'time_saved': round(time_saved, 2),
        'successful_scans': successful_scans,
        'failed_scans': failed_scans
    }


def format_signal_for_api(row: pd.Series, exchange: str = 'kucoinfutures') -> dict:
    """Format a scanner result row for API response"""
    try:
        # Map signal types to BUY/SELL/HOLD
        signal_mapping = {
            'Strong Buy': 'BUY',
            'Buy': 'BUY',
            'Weak Buy': 'BUY',
            'Strong Sell': 'SELL',
            'Sell': 'SELL',
            'Weak Sell': 'SELL',
            'Neutral': 'HOLD'
        }
        
        signal_type = signal_mapping.get(row.get('signal', 'Neutral'), 'HOLD')
        
        # Calculate price change percentage
        momentum_short = row.get('momentum_short', 0)
        change = momentum_short * 100 if momentum_short else 0
        
        return {
            'id': f"{row.get('symbol', 'UNKNOWN')}_{int(datetime.now().timestamp())}",
            'symbol': row.get('symbol', 'UNKNOWN'),
            'exchange': exchange,
            'timeframe': row.get('timeframe', '1h'),
            'signal': signal_type,
            'strength': min(100, max(0, int(row.get('signal_strength', 50) * 100))),
            'price': float(row.get('price', 0)),
            'change': float(change),
            'volume': float(row.get('volume_usd', 0)),
            'timestamp': row.get('timestamp', datetime.now()).isoformat() if hasattr(row.get('timestamp'), 'isoformat') else datetime.now().isoformat(),
            'indicators': {
                'rsi': float(row.get('rsi', 50)),
                'macd': 'bullish' if row.get('macd', 0) > 0 else 'bearish',
                'ema': 'above' if row.get('ema_5_13_bullish', False) else 'below',
                'volume': 'very_high' if row.get('volume_ratio', 1) > 2 else 'high' if row.get('volume_ratio', 1) > 1.5 else 'medium'
            },
            'advanced': {
                'opportunity_score': float(row.get('opportunity_score', 0)),  # NEW: Best entry point score
                'composite_score': float(row.get('composite_score', 0)),
                'trend_score': float(row.get('trend_score', 0)),
                'confidence_score': float(row.get('confidence_score', 0)),
                'combined_score': float(row.get('combined_score', 0)),  # Overall ranking score
                'ichimoku_bullish': bool(row.get('ichimoku_bullish', False)),
                'vwap_bullish': bool(row.get('vwap_bullish', False)),
                'bb_position': float(row.get('bb_position', 0.5)) if pd.notna(row.get('bb_position')) else 0.5
            },
            'risk_reward': {
                'entry_price': float(row.get('entry_price', row.get('price', 0))),
                'stop_loss': float(row.get('stop_loss', 0)),
                'take_profit': float(row.get('take_profit', 0)),
                'risk_amount': float(row.get('risk_amount', 0)),
                'reward_amount': float(row.get('reward_amount', 0)),
                'risk_reward_ratio': float(row.get('risk_reward_ratio', 0)),
                'stop_loss_pct': float(row.get('stop_loss_pct', 0)),
                'take_profit_pct': float(row.get('take_profit_pct', 0)),
                'support_level': float(row.get('support_level', 0)) if pd.notna(row.get('support_level')) else None,
                'resistance_level': float(row.get('resistance_level', 0)) if pd.notna(row.get('resistance_level')) else None
            },
            'market_regime': {
                'regime': row.get('market_regime', 'unknown'),
                'confidence': float(row.get('regime_confidence', 0)),
                'trend_strength': float(row.get('regime_trend_strength', 0)),
                'volatility': row.get('regime_volatility', 'medium'),
                'suggested_threshold': int(row.get('regime_suggested_threshold', 65))
            }
        }
    except Exception as e:
        logger.error(f"Error formatting signal: {e}")
        return None


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'scanner-api',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/scanner/scan', methods=['POST'])
def trigger_scan():
    """
    Trigger a market scan (single or parallel)
    Request body:
    {
        "timeframe": "1h" | "4h" | "1d" | "scalping" | "short" | "medium" | "daily",
        "exchange": "binance" | "kucoinfutures" | "coinbase" | "kraken" | ["binance", "okx"],
        "parallel": true | false (default: false, auto-enabled if exchange is array),
        "signal": "all" | "BUY" | "SELL" | "HOLD",
        "minStrength": 0-100,
        "fullAnalysis": true | false
    }
    """
    global last_scan_results, last_scan_timestamp
    
    # Track scan timing
    scan_start_time = datetime.now()
    
    try:
        data = request.get_json() or {}
        
        # Extract parameters
        timeframe = data.get('timeframe', 'medium')
        exchange_param = data.get('exchange', 'kucoinfutures')
        signal_filter = data.get('signal', 'all')
        min_strength = data.get('minStrength', 50) / 100  # Convert to 0-1 range
        full_analysis = data.get('fullAnalysis', True)
        parallel_mode = data.get('parallel', False)
        
        # Determine if parallel scanning (exchange is list or parallel=true)
        if isinstance(exchange_param, list):
            exchanges = exchange_param
            parallel_mode = True
        else:
            exchanges = [exchange_param]
            
        # Auto-enable parallel if multiple exchanges
        if len(exchanges) > 1:
            parallel_mode = True
        
        # === PARALLEL SCANNING MODE ===
        if parallel_mode and len(exchanges) > 1:
            logger.info("="*80)
            logger.info(f"🚀 PARALLEL SCAN REQUESTED")
            logger.info(f"   Exchanges: {', '.join(exchanges)}")
            logger.info(f"   Timeframe: {timeframe}")
            logger.info(f"   Signal Filter: {signal_filter}")
            logger.info(f"   Min Strength: {min_strength * 100}%")
            logger.info(f"   Full Analysis: {full_analysis}")
            logger.info(f"   Start Time: {scan_start_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
            logger.info("="*80)
            
            # Create event loop for parallel scanning
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Run parallel scan
                parallel_result = loop.run_until_complete(
                    scan_multiple_exchanges_parallel(exchanges, timeframe, full_analysis)
                )
            finally:
                loop.close()
            
            # Process and aggregate results from all exchanges
            all_results = []
            filter_start = datetime.now()
            
            for exchange_id, df in parallel_result['results']:
                if not df.empty:
                    # Filter by signal strength
                    filtered = df[df['signal_strength'] >= min_strength]
                    
                    # Filter by signal type
                    if signal_filter != 'all':
                        signal_mapping = {
                            'BUY': ['Strong Buy', 'Buy', 'Weak Buy'],
                            'SELL': ['Strong Sell', 'Sell', 'Weak Sell'],
                            'HOLD': ['Neutral']
                        }
                        if signal_filter in signal_mapping:
                            filtered = filtered[filtered['signal'].isin(signal_mapping[signal_filter])]
                    
                    # Format signals
                    for _, row in filtered.iterrows():
                        formatted = format_signal_for_api(row, exchange_id)
                        if formatted:
                            all_results.append(formatted)
            
            filter_duration = (datetime.now() - filter_start).total_seconds()
            scan_end_time = datetime.now()
            total_duration = (scan_end_time - scan_start_time).total_seconds()
            
            # Store aggregated results
            last_scan_timestamp = scan_end_time
            
            logger.info(f"⏱️  Filtering and formatting took: {filter_duration:.2f} seconds")
            
            return jsonify({
                'signals': all_results,
                'metadata': {
                    'count': len(all_results),
                    'mode': 'parallel',
                    'exchanges': exchanges,
                    'exchange_details': parallel_result['exchange_metadata'],
                    'timeframe': timeframe,
                    'timestamp': scan_end_time.isoformat(),
                    'duration_seconds': round(total_duration, 2),
                    'performance': {
                        'parallel_duration': parallel_result['parallel_duration'],
                        'sequential_duration_estimated': parallel_result['sequential_duration_estimated'],
                        'speedup': parallel_result['speedup'],
                        'time_saved_seconds': parallel_result['time_saved'],
                        'filtering_seconds': round(filter_duration, 2),
                        'successful_scans': parallel_result['successful_scans'],
                        'failed_scans': parallel_result['failed_scans']
                    },
                    'filters_applied': {
                        'signal': signal_filter,
                        'minStrength': min_strength * 100
                    }
                }
            })
        
        # === SINGLE EXCHANGE SCANNING MODE ===
        exchange = exchanges[0]
        
        # LOG: Scan start
        logger.info("="*80)
        logger.info(f"🚀 SCAN STARTED")
        logger.info(f"   Exchange: {exchange}")
        logger.info(f"   Timeframe: {timeframe}")
        logger.info(f"   Signal Filter: {signal_filter}")
        logger.info(f"   Min Strength: {min_strength * 100}%")
        logger.info(f"   Full Analysis: {full_analysis}")
        logger.info(f"   Start Time: {scan_start_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
        logger.info("="*80)
        
        # Create a new event loop for this scan
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Track initialization time
        init_start = datetime.now()
        
        try:
            # Create fresh scanner instance with this loop and selected exchange
            scanner_instance = get_scanner(loop, exchange_id=exchange)
            init_duration = (datetime.now() - init_start).total_seconds()
            logger.info(f"⏱️  Exchange initialization took: {init_duration:.2f} seconds")
            
            # Track scan execution time
            scan_exec_start = datetime.now()
            
            # Run async scan
            results = loop.run_until_complete(
                scanner_instance.scan_market(
                    timeframe=timeframe,
                    full_analysis=full_analysis,
                    save_results=False
                )
            )
            
            scan_exec_duration = (datetime.now() - scan_exec_start).total_seconds()
            logger.info(f"⏱️  Market scan execution took: {scan_exec_duration:.2f} seconds")
            
            # Clean up exchange connection
            if hasattr(scanner_instance, 'exchange') and scanner_instance.exchange:
                try:
                    loop.run_until_complete(scanner_instance.exchange.close())
                except Exception as e:
                    logger.warning(f"Error closing exchange: {e}")
        finally:
            loop.close()
        
        if results.empty:
            scan_end_time = datetime.now()
            total_duration = (scan_end_time - scan_start_time).total_seconds()
            
            logger.warning("="*80)
            logger.warning(f"⚠️  SCAN COMPLETED - NO RESULTS")
            logger.warning(f"   End Time: {scan_end_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
            logger.warning(f"   Total Duration: {total_duration:.2f} seconds")
            logger.warning("="*80)
            
            return jsonify({
                'signals': [],
                'metadata': {
                    'count': 0,
                    'timeframe': timeframe,
                    'exchange': exchange,
                    'timestamp': scan_end_time.isoformat(),
                    'duration_seconds': round(total_duration, 2)
                }
            })
        
        # Store results
        last_scan_results = results
        last_scan_timestamp = datetime.now()
        
        # Track filtering time
        filter_start = datetime.now()
        
        # Filter by signal strength
        filtered_results = results[results['signal_strength'] >= min_strength]
        
        # Filter by signal type
        if signal_filter != 'all':
            signal_mapping = {
                'BUY': ['Strong Buy', 'Buy', 'Weak Buy'],
                'SELL': ['Strong Sell', 'Sell', 'Weak Sell'],
                'HOLD': ['Neutral']
            }
            if signal_filter in signal_mapping:
                filtered_results = filtered_results[
                    filtered_results['signal'].isin(signal_mapping[signal_filter])
                ]
        
        # Format results for API
        signals = []
        for _, row in filtered_results.iterrows():
            formatted = format_signal_for_api(row, exchange)
            if formatted:
                signals.append(formatted)
        
        filter_duration = (datetime.now() - filter_start).total_seconds()
        logger.info(f"⏱️  Filtering and formatting took: {filter_duration:.2f} seconds")
        
        # Calculate total duration
        scan_end_time = datetime.now()
        total_duration = (scan_end_time - scan_start_time).total_seconds()
        
        # LOG: Scan completion summary
        logger.info("="*80)
        logger.info(f"✅ SCAN COMPLETED SUCCESSFULLY")
        logger.info(f"   Exchange: {exchange}")
        logger.info(f"   Timeframe: {timeframe}")
        logger.info(f"   Total Symbols Scanned: {len(results)}")
        logger.info(f"   Signals After Filtering: {len(signals)}")
        logger.info(f"   End Time: {scan_end_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
        logger.info(f"   Total Duration: {total_duration:.2f} seconds")
        logger.info(f"   Performance Breakdown:")
        logger.info(f"     - Initialization: {init_duration:.2f}s ({(init_duration/total_duration*100):.1f}%)")
        logger.info(f"     - Scan Execution: {scan_exec_duration:.2f}s ({(scan_exec_duration/total_duration*100):.1f}%)")
        logger.info(f"     - Filtering: {filter_duration:.2f}s ({(filter_duration/total_duration*100):.1f}%)")
        logger.info("="*80)
        
        return jsonify({
            'signals': signals,
            'metadata': {
                'count': len(signals),
                'total_scanned': len(results),
                'timeframe': timeframe,
                'exchange': exchange,
                'timestamp': scan_end_time.isoformat(),
                'duration_seconds': round(total_duration, 2),
                'performance': {
                    'initialization_seconds': round(init_duration, 2),
                    'scan_execution_seconds': round(scan_exec_duration, 2),
                    'filtering_seconds': round(filter_duration, 2),
                    'total_seconds': round(total_duration, 2)
                },
                'filters_applied': {
                    'signal': signal_filter,
                    'minStrength': min_strength * 100,
                    'exchange': exchange
                }
            }
        })
        
    except Exception as e:
        scan_end_time = datetime.now()
        total_duration = (scan_end_time - scan_start_time).total_seconds()
        
        logger.error("="*80)
        logger.error(f"❌ SCAN FAILED")
        logger.error(f"   Exchange: {data.get('exchange', 'kucoinfutures') if 'data' in locals() else 'unknown'}")
        logger.error(f"   Timeframe: {data.get('timeframe', 'medium') if 'data' in locals() else 'unknown'}")
        logger.error(f"   Error: {str(e)}")
        logger.error(f"   End Time: {scan_end_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
        logger.error(f"   Duration Before Failure: {total_duration:.2f} seconds")
        logger.error("="*80)
        logger.error(f"Stack trace:", exc_info=True)
        
        return jsonify({
            'error': str(e),
            'message': 'Failed to complete market scan',
            'duration_seconds': round(total_duration, 2)
        }), 500


@app.route('/api/scanner/signals', methods=['GET'])
def get_signals():
    """
    Get latest scan results with optional filtering
    Query parameters:
    - exchange: filter by exchange
    - timeframe: filter by timeframe
    - signal: filter by signal type (BUY/SELL/HOLD)
    - minStrength: minimum signal strength (0-100)
    """
    global last_scan_results
    
    try:
        if last_scan_results is None or last_scan_results.empty:
            # Return empty results
            return jsonify({
                'signals': [],
                'filters': {
                    'exchanges': ['binance', 'kucoinfutures', 'coinbase', 'kraken'],
                    'timeframes': ['1m', '5m', '15m', '1h', '4h', '1d'],
                    'signals': ['BUY', 'SELL', 'HOLD'],
                    'minStrength': 0,
                    'maxStrength': 100
                },
                'metadata': {
                    'count': 0,
                    'message': 'No scan results available. Please trigger a scan first.'
                }
            })
        
        # Get query parameters
        exchange_filter = request.args.get('exchange', 'all')
        timeframe_filter = request.args.get('timeframe', 'all')
        signal_filter = request.args.get('signal', 'all')
        min_strength = float(request.args.get('minStrength', 0)) / 100
        
        results = last_scan_results.copy()
        
        # Apply filters
        if min_strength > 0:
            results = results[results['signal_strength'] >= min_strength]
        
        if signal_filter != 'all':
            signal_mapping = {
                'BUY': ['Strong Buy', 'Buy', 'Weak Buy'],
                'SELL': ['Strong Sell', 'Sell', 'Weak Sell'],
                'HOLD': ['Neutral']
            }
            if signal_filter in signal_mapping:
                results = results[results['signal'].isin(signal_mapping[signal_filter])]
        
        if timeframe_filter != 'all':
            results = results[results['timeframe'] == timeframe_filter]
        
        # Format results
        signals = []
        for _, row in results.iterrows():
            formatted = format_signal_for_api(row, exchange_filter if exchange_filter != 'all' else 'kucoinfutures')
            if formatted:
                signals.append(formatted)
        
        return jsonify({
            'signals': signals,
            'filters': {
                'exchanges': ['binance', 'kucoinfutures', 'coinbase', 'kraken'],
                'timeframes': ['1m', '5m', '15m', '1h', '4h', '1d'],
                'signals': ['BUY', 'SELL', 'HOLD'],
                'minStrength': 0,
                'maxStrength': 100
            },
            'metadata': {
                'count': len(signals),
                'last_scan': last_scan_timestamp.isoformat() if last_scan_timestamp else None
            }
        })
        
    except Exception as e:
        logger.error(f"Error retrieving signals: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to retrieve signals'
        }), 500


@app.route('/api/scanner/status', methods=['GET'])
def get_status():
    """Get scanner status and statistics"""
    return jsonify({
        'status': 'active',
        'scanner_initialized': scanner is not None,
        'last_scan': last_scan_timestamp.isoformat() if last_scan_timestamp else None,
        'results_count': len(last_scan_results) if last_scan_results is not None else 0,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/scanner/multi-timeframe', methods=['POST'])
def multi_timeframe_confluence():
    """
    Scan multiple timeframes and find confluence opportunities
    Request body:
    {
        "symbol": "BTC/USDT",
        "timeframes": ["1h", "4h", "1d"],
        "minOpportunity": 65
    }
    """
    try:
        data = request.get_json() or {}
        symbol = data.get('symbol', 'BTC/USDT')
        timeframes = data.get('timeframes', ['short', 'medium', 'daily'])
        min_opportunity = data.get('minOpportunity', 65)
        
        logger.info(f"Multi-timeframe analysis for {symbol}: {timeframes}")
        
        scanner_instance = get_scanner()
        
        # Run scans for each timeframe
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            all_results = []
            for tf in timeframes:
                results = loop.run_until_complete(
                    scanner_instance.scan_market(
                        timeframe=tf,
                        full_analysis=True,
                        save_results=False
                    )
                )
                if not results.empty:
                    symbol_result = results[results['symbol'] == symbol]
                    if not symbol_result.empty:
                        all_results.append({
                            'timeframe': tf,
                            'data': symbol_result.iloc[0].to_dict()
                        })
        finally:
            loop.close()
        
        if not all_results:
            return jsonify({
                'symbol': symbol,
                'confluence': False,
                'message': f'No data found for {symbol} across timeframes',
                'timeframes_analyzed': timeframes
            })
        
        # Analyze confluence
        opportunity_scores = [r['data'].get('opportunity_score', 0) for r in all_results]
        signals = [r['data'].get('signal', 'Neutral') for r in all_results]
        regimes = [r['data'].get('market_regime', 'unknown') for r in all_results]
        
        # Check for bullish confluence
        bullish_count = sum(1 for s in signals if s in ['Strong Buy', 'Buy', 'Weak Buy'])
        bearish_count = sum(1 for s in signals if s in ['Strong Sell', 'Sell', 'Weak Sell'])
        
        has_confluence = (bullish_count >= 2 or bearish_count >= 2) and min(opportunity_scores) >= min_opportunity
        avg_opportunity = sum(opportunity_scores) / len(opportunity_scores) if opportunity_scores else 0
        
        return jsonify({
            'symbol': symbol,
            'confluence': has_confluence,
            'timeframes_analyzed': len(all_results),
            'average_opportunity': round(avg_opportunity, 2),
            'bullish_timeframes': bullish_count,
            'bearish_timeframes': bearish_count,
            'dominant_regime': max(set(regimes), key=regimes.count) if regimes else 'unknown',
            'timeframe_results': [
                {
                    'timeframe': r['timeframe'],
                    'signal': r['data'].get('signal', 'Neutral'),
                    'opportunity_score': r['data'].get('opportunity_score', 0),
                    'market_regime': r['data'].get('market_regime', 'unknown'),
                    'price': r['data'].get('price', 0),
                    'rsi': r['data'].get('rsi', 50)
                }
                for r in all_results
            ],
            'recommendation': 'STRONG' if has_confluence and avg_opportunity > 75 else 'MODERATE' if has_confluence else 'WEAK'
        })
        
    except Exception as e:
        logger.error(f"Error in multi-timeframe analysis: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to complete multi-timeframe analysis'
        }), 500



@app.route('/api/position/calculate', methods=['POST'])
def calculate_position():
    """
    Calculate position size based on account and risk parameters
    Request body:
    {
        "accountBalance": 10000,
        "riskPerTrade": 2,
        "entryPrice": 45000,
        "stopLoss": 43000,
        "leverage": 1,
        "feeRate": 0.001
    }
    """
    try:
        data = request.get_json() or {}
        
        account_balance = float(data.get('accountBalance', 10000))
        risk_per_trade = float(data.get('riskPerTrade', 2))
        entry_price = float(data.get('entryPrice', 0))
        stop_loss = float(data.get('stopLoss', 0))
        leverage = float(data.get('leverage', 1))
        fee_rate = float(data.get('feeRate', 0.001))
        
        if entry_price <= 0 or stop_loss <= 0:
            return jsonify({'error': 'Invalid entry price or stop loss'}), 400
        
        position_calc = TechnicalIndicators.calculate_position_size(
            account_balance=account_balance,
            risk_per_trade_pct=risk_per_trade,
            entry_price=entry_price,
            stop_loss=stop_loss,
            leverage=leverage,
            fee_rate=fee_rate
        )
        
        return jsonify(position_calc)
        
    except Exception as e:
        logger.error(f"Error calculating position: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to calculate position size'
        }), 500


@app.route('/api/scanner/continuous/start', methods=['POST'])
def start_continuous_scanner():
    """
    Start continuous multi-timeframe scanner
    Request body:
    {
        "symbols": ["BTC/USDT", "ETH/USDT", ...],
        "exchanges": ["binance", "kucoinfutures"],
        "config": {optional config overrides}
    }
    """
    global continuous_scanner, continuous_scanner_task, continuous_scanner_loop
    
    try:
        if continuous_scanner and continuous_scanner.running:
            return jsonify({
                'status': 'already_running',
                'message': 'Continuous scanner is already running'
            })
        
        data = request.get_json() or {}
        symbols = data.get('symbols', [
            'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
            'ADA/USDT', 'DOGE/USDT', 'MATIC/USDT', 'DOT/USDT', 'LINK/USDT'
        ])
        exchanges = data.get('exchanges', ['binance', 'kucoinfutures'])
        config_dict = data.get('config', {})
        
        # Create config
        config = StreamConfig(**config_dict) if config_dict else StreamConfig()
        
        # Create continuous scanner
        continuous_scanner = ContinuousMultiTimeframeScanner(config)
        
        # Start in background thread with its own event loop
        def run_scanner_loop():
            global continuous_scanner_loop
            continuous_scanner_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(continuous_scanner_loop)
            
            try:
                continuous_scanner_loop.run_until_complete(
                    continuous_scanner.start(symbols, exchanges)
                )
            except Exception as e:
                logger.error(f"Continuous scanner error: {e}", exc_info=True)
            finally:
                continuous_scanner_loop.close()
        
        scanner_thread = threading.Thread(target=run_scanner_loop, daemon=True)
        scanner_thread.start()
        
        logger.info(f"Started continuous scanner for {len(symbols)} symbols")
        
        return jsonify({
            'status': 'started',
            'symbols': symbols,
            'exchanges': exchanges,
            'timeframes': config.timeframes,
            'message': 'Continuous scanner started successfully'
        })
        
    except Exception as e:
        logger.error(f"Error starting continuous scanner: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to start continuous scanner'
        }), 500


@app.route('/api/scanner/continuous/stop', methods=['POST'])
def stop_continuous_scanner():
    """Stop continuous scanner"""
    global continuous_scanner, continuous_scanner_task, continuous_scanner_loop
    
    try:
        if not continuous_scanner or not continuous_scanner.running:
            return jsonify({
                'status': 'not_running',
                'message': 'Continuous scanner is not running'
            })
        
        # Stop the scanner
        if continuous_scanner_loop:
            continuous_scanner_loop.call_soon_threadsafe(
                lambda: asyncio.create_task(continuous_scanner.stop())
            )
        
        logger.info("Stopped continuous scanner")
        
        return jsonify({
            'status': 'stopped',
            'message': 'Continuous scanner stopped successfully'
        })
        
    except Exception as e:
        logger.error(f"Error stopping continuous scanner: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to stop continuous scanner'
        }), 500


@app.route('/api/scanner/continuous/status', methods=['GET'])
def continuous_scanner_status():
    """Get continuous scanner status"""
    global continuous_scanner
    
    try:
        if not continuous_scanner:
            return jsonify({
                'running': False,
                'message': 'Scanner not initialized'
            })
        
        market_state = continuous_scanner.get_market_state()
        
        return jsonify({
            'running': continuous_scanner.running,
            'market_state': market_state,
            'buffer_stats': {
                'ticks': len(continuous_scanner.tick_buffers),
                'candles': len(continuous_scanner.candle_buffers),
                'signals': sum(len(s) for s in continuous_scanner.signal_history.values())
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting continuous scanner status: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to get scanner status'
        }), 500


@app.route('/api/scanner/continuous/signals', methods=['GET'])
def get_continuous_signals():
    """
    Get latest signals from continuous scanner
    Query params:
    - symbol: Filter by symbol (optional)
    - timeframe: Filter by timeframe (optional)
    - min_score: Minimum combined score (default 0)
    - limit: Max results (default 50)
    """
    global continuous_scanner
    
    try:
        if not continuous_scanner:
            return jsonify({
                'error': 'Scanner not running',
                'signals': []
            }), 503
        
        symbol = request.args.get('symbol')
        timeframe = request.args.get('timeframe')
        min_score = float(request.args.get('min_score', 0))
        limit = int(request.args.get('limit', 50))
        
        signals = continuous_scanner.get_latest_signals(
            symbol=symbol,
            timeframe=timeframe,
            min_score=min_score,
            limit=limit
        )
        
        return jsonify({
            'signals': signals,
            'count': len(signals),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting continuous signals: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to get continuous signals'
        }), 500


@app.route('/api/scanner/continuous/confluence/<symbol>', methods=['GET'])
def get_continuous_confluence(symbol: str):
    """
    Get multi-timeframe confluence for a symbol
    Path param: symbol (e.g., BTC/USDT)
    Query params:
    - min_score: Minimum score threshold (default 60)
    """
    global continuous_scanner
    
    try:
        if not continuous_scanner:
            return jsonify({
                'error': 'Scanner not running'
            }), 503
        
        min_score = float(request.args.get('min_score', 60))
        
        # Run async function in scanner's event loop
        if continuous_scanner_loop:
            future = asyncio.run_coroutine_threadsafe(
                continuous_scanner.get_multi_timeframe_confluence(symbol, min_score),
                continuous_scanner_loop
            )
            result = future.result(timeout=10)
        else:
            result = {'error': 'Scanner loop not available'}
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting confluence for {symbol}: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to get multi-timeframe confluence'
        }), 500


@app.route('/api/scanner/continuous/market-state', methods=['GET'])
def get_market_state():
    """Get current global market state"""
    global continuous_scanner
    
    try:
        if not continuous_scanner:
            return jsonify({
                'error': 'Scanner not running'
            }), 503
        
        market_state = continuous_scanner.get_market_state()
        
        return jsonify({
            'market_state': market_state,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting market state: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to get market state'
        }), 500


@app.route('/api/scanner/training-data/<symbol>', methods=['GET'])
def get_training_data(symbol: str):
    """
    Get training dataset for Oracle Engine & RL pipeline
    Path param: symbol (e.g., BTC/USDT)
    Query params:
    - days: Number of days of historical data (default 30)
    """
    global continuous_scanner
    
    try:
        if not continuous_scanner:
            return jsonify({
                'error': 'Scanner not running'
            }), 503
        
        days = int(request.args.get('days', 30))
        
        # Run async function
        if continuous_scanner_loop:
            future = asyncio.run_coroutine_threadsafe(
                continuous_scanner.persistence.get_training_dataset(symbol, days),
                continuous_scanner_loop
            )
            dataset = future.result(timeout=30)
        else:
            dataset = {'error': 'Scanner loop not available'}
        
        return jsonify({
            'symbol': symbol,
            'days': days,
            'dataset': dataset,
            'summary': {
                'total_signals': len(dataset.get('signals', [])),
                'timeframes': list(dataset.get('ohlcv', {}).keys()),
                'total_clusters': len(dataset.get('clustering', []))
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting training data for {symbol}: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to get training data'
        }), 500


if __name__ == '__main__':
    logger.info("Starting Scanner API on port 5001")
    logger.info("Continuous scanner endpoints available:")
    logger.info("  POST /api/scanner/continuous/start")
    logger.info("  POST /api/scanner/continuous/stop")
    logger.info("  GET  /api/scanner/continuous/status")
    logger.info("  GET  /api/scanner/continuous/signals")
    logger.info("  GET  /api/scanner/continuous/confluence/<symbol>")
    logger.info("  GET  /api/scanner/continuous/market-state")
    logger.info("  GET  /api/scanner/training-data/<symbol>")
    app.run(host='0.0.0.0', port=5001, debug=False)

