"""
Test script for exchange-specific scanning with detailed logging
Run this after starting the scanner_api.py server
"""

import requests
import json
import time
from datetime import datetime

API_URL = "http://localhost:5001"

def test_scan(exchange, timeframe='medium', min_strength=60):
    """
    Test scanning a specific exchange
    
    Args:
        exchange: 'binance', 'kucoinfutures', 'coinbase', or 'kraken'
        timeframe: 'scalping', 'short', 'medium', or 'daily'
        min_strength: Minimum signal strength (0-100)
    """
    print(f"\n{'='*80}")
    print(f"Testing scan for {exchange.upper()} - Timeframe: {timeframe}")
    print(f"{'='*80}\n")
    
    scan_request = {
        "exchange": exchange,
        "timeframe": timeframe,
        "signal": "all",
        "minStrength": min_strength,
        "fullAnalysis": True
    }
    
    print(f"Request payload:")
    print(json.dumps(scan_request, indent=2))
    print(f"\nSending request to {API_URL}/api/scanner/scan...")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{API_URL}/api/scanner/scan",
            json=scan_request,
            timeout=300  # 5 minute timeout
        )
        end_time = time.time()
        
        print(f"\n✅ Response received in {end_time - start_time:.2f} seconds")
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n{'='*80}")
            print(f"SCAN RESULTS SUMMARY")
            print(f"{'='*80}")
            print(f"Exchange: {exchange}")
            print(f"Signals found: {data['metadata']['count']}")
            print(f"Total symbols scanned: {data['metadata'].get('total_scanned', 'N/A')}")
            print(f"Duration: {data['metadata'].get('duration_seconds', 'N/A')} seconds")
            
            if 'performance' in data['metadata']:
                perf = data['metadata']['performance']
                print(f"\nPerformance Breakdown:")
                print(f"  - Initialization: {perf['initialization_seconds']}s")
                print(f"  - Scan Execution: {perf['scan_execution_seconds']}s")
                print(f"  - Filtering: {perf['filtering_seconds']}s")
                print(f"  - Total: {perf['total_seconds']}s")
            
            if data['signals']:
                print(f"\nTop 5 signals:")
                for i, signal in enumerate(data['signals'][:5], 1):
                    print(f"\n{i}. {signal['symbol']} ({signal['exchange']})")
                    print(f"   Signal: {signal['signal']} | Strength: {signal['strength']}%")
                    print(f"   Price: ${signal['price']:.2f} | Change: {signal['change']:.2f}%")
                    print(f"   Volume: ${signal['volume']:,.0f}")
                    print(f"   Opportunity Score: {signal['advanced']['opportunity_score']:.2f}")
            else:
                print(f"\nNo signals matched the criteria.")
            
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.Timeout:
        print(f"\n❌ Request timed out after 5 minutes")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def test_parallel_scan(exchanges, timeframe='medium', min_strength=60):
    """
    Test parallel scanning of multiple exchanges
    
    Args:
        exchanges: List of exchange IDs to scan in parallel
        timeframe: Timeframe for scanning
        min_strength: Minimum signal strength (0-100)
    """
    print(f"\n{'='*80}")
    print(f"Testing PARALLEL scan for {len(exchanges)} exchanges")
    print(f"Exchanges: {', '.join(exchanges)}")
    print(f"Timeframe: {timeframe}")
    print(f"{'='*80}\n")
    
    scan_request = {
        "exchange": exchanges,  # Pass as array for parallel scanning
        "timeframe": timeframe,
        "signal": "all",
        "minStrength": min_strength,
        "fullAnalysis": True
    }
    
    print(f"Request payload:")
    print(json.dumps(scan_request, indent=2))
    print(f"\nSending parallel scan request to {API_URL}/api/scanner/scan...")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{API_URL}/api/scanner/scan",
            json=scan_request,
            timeout=600  # 10 minute timeout for parallel scans
        )
        end_time = time.time()
        
        print(f"\n✅ Response received in {end_time - start_time:.2f} seconds")
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n{'='*80}")
            print(f"PARALLEL SCAN RESULTS SUMMARY")
            print(f"{'='*80}")
            print(f"Mode: {data['metadata'].get('mode', 'unknown')}")
            print(f"Exchanges scanned: {', '.join(data['metadata'].get('exchanges', []))}")
            print(f"Total signals found: {data['metadata']['count']}")
            print(f"Duration: {data['metadata'].get('duration_seconds', 'N/A')} seconds")
            
            if 'performance' in data['metadata']:
                perf = data['metadata']['performance']
                print(f"\n🚀 PARALLEL PERFORMANCE METRICS:")
                print(f"  - Parallel Time: {perf.get('parallel_duration', 'N/A')}s")
                print(f"  - Sequential Time (estimated): {perf.get('sequential_duration_estimated', 'N/A')}s")
                print(f"  - Speedup: {perf.get('speedup', 'N/A')}x faster 🎯")
                print(f"  - Time Saved: {perf.get('time_saved_seconds', 'N/A')}s")
                print(f"  - Successful Scans: {perf.get('successful_scans', 'N/A')}")
                print(f"  - Failed Scans: {perf.get('failed_scans', 'N/A')}")
                print(f"  - Filtering Time: {perf.get('filtering_seconds', 'N/A')}s")
                
                print(f"\n📊 Per-Exchange Performance:")
                for exchange_id, details in data['metadata'].get('exchange_details', {}).items():
                    status = "✅" if details['success'] else "❌"
                    print(f"  {status} {exchange_id}: {details['duration_seconds']}s - {details['signals_found']} signals")
                    if details.get('error'):
                        print(f"       Error: {details['error']}")
            
            if data['signals']:
                print(f"\nTop 10 signals (across all exchanges):")
                for i, signal in enumerate(data['signals'][:10], 1):
                    print(f"\n{i}. {signal['symbol']} ({signal['exchange']})")
                    print(f"   Signal: {signal['signal']} | Strength: {signal['strength']}%")
                    print(f"   Price: ${signal['price']:.2f} | Change: {signal['change']:.2f}%")
                    print(f"   Opportunity Score: {signal['advanced']['opportunity_score']:.2f}")
            else:
                print(f"\nNo signals matched the criteria.")
            
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.Timeout:
        print(f"\n❌ Request timed out after 10 minutes")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def main():
    """Main test function"""
    
    # Check if API is running
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ API health check failed. Is the server running on port 5001?")
            return
        print(f"✅ API is healthy")
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        print(f"Please start the server with: python scanner_api.py")
        return
    
    print(f"\n{'='*80}")
    print(f"EXCHANGE SCAN TESTING SUITE")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")
    
    # Ask user which test mode to run
    print(f"\nSelect test mode:")
    print(f"1. Single exchange scan (sequential, one at a time)")
    print(f"2. Parallel scan (scan multiple exchanges simultaneously) 🚀")
    print(f"3. Run both modes for comparison")
    
    choice = input(f"\nEnter choice (1/2/3) [default: 2]: ").strip() or "2"
    
    if choice == "1":
        # Sequential single-exchange scans
        print(f"\n🔄 Running SEQUENTIAL scans...")
        exchanges_to_test = [
            ("binance", "medium", 60),
            ("kucoinfutures", "medium", 60),
            ("okx", "medium", 60),
        ]
        
        for exchange, timeframe, min_strength in exchanges_to_test:
            test_scan(exchange, timeframe, min_strength)
            print(f"\n⏳ Waiting 2 seconds before next scan...")
            time.sleep(2)
    
    elif choice == "2":
        # Parallel scan
        print(f"\n⚡ Running PARALLEL scan...")
        test_parallel_scan(
            exchanges=["binance", "kucoinfutures", "okx", "bybit"],
            timeframe="medium",
            min_strength=60
        )
    
    elif choice == "3":
        # Run both for comparison
        print(f"\n📊 Running COMPARISON TEST...")
        
        exchanges = ["binance", "kucoinfutures", "okx"]
        
        # First: Sequential
        print(f"\n{'='*80}")
        print(f"PART 1: SEQUENTIAL SCANS")
        print(f"{'='*80}")
        seq_start = time.time()
        for exchange in exchanges:
            test_scan(exchange, "medium", 60)
            time.sleep(1)
        seq_duration = time.time() - seq_start
        
        print(f"\n⏳ Waiting 5 seconds before parallel scan...")
        time.sleep(5)
        
        # Then: Parallel
        print(f"\n{'='*80}")
        print(f"PART 2: PARALLEL SCAN")
        print(f"{'='*80}")
        par_start = time.time()
        test_parallel_scan(exchanges, "medium", 60)
        par_duration = time.time() - par_start
        
        # Comparison
        print(f"\n{'='*80}")
        print(f"⚡ PERFORMANCE COMPARISON")
        print(f"{'='*80}")
        print(f"Sequential (total): {seq_duration:.2f}s")
        print(f"Parallel (total): {par_duration:.2f}s")
        print(f"Speedup: {(seq_duration/par_duration):.2f}x faster with parallel!")
        print(f"Time saved: {(seq_duration - par_duration):.2f}s ({((seq_duration - par_duration)/seq_duration*100):.1f}%)")
    
    print(f"\n{'='*80}")
    print(f"TESTING COMPLETE")
    print(f"{'='*80}\n")
    
    print(f"💡 Tips:")
    print(f"1. Check the server logs to see detailed timing information")
    print(f"2. Parallel scanning reduces total time from ~10 min → ~2-3 min")
    print(f"3. Adjust exchanges list in the script to test different combinations")
    print(f"4. Available exchanges: binance, kucoinfutures, coinbase, kraken, okx, bybit")
    print(f"5. Available timeframes: scalping, short, medium, daily")
    print(f"6. Use parallel mode for production to maximize efficiency! 🚀")


if __name__ == "__main__":
    main()

