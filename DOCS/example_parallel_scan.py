"""
Simple example demonstrating parallel exchange scanning
Run this after starting scanner_api.py
"""

import requests
import time
from datetime import datetime

API_URL = "http://localhost:5001"

def parallel_scan_example():
    """Simple parallel scan example"""
    
    print("="*80)
    print("PARALLEL SCANNING EXAMPLE")
    print("="*80)
    
    # Configure which exchanges to scan
    exchanges = ["binance", "okx", "bybit"]
    
    print(f"\nScanning {len(exchanges)} exchanges in parallel:")
    for ex in exchanges:
        print(f"  - {ex}")
    
    # Make the request
    print(f"\nSending parallel scan request...")
    start = time.time()
    
    response = requests.post(
        f"{API_URL}/api/scanner/scan",
        json={
            "exchange": exchanges,  # Array triggers parallel mode
            "timeframe": "medium",
            "minStrength": 60,
            "fullAnalysis": True
        },
        timeout=300
    )
    
    duration = time.time() - start
    
    if response.status_code == 200:
        data = response.json()
        perf = data['metadata']['performance']
        
        print(f"\n✅ Scan completed in {duration:.2f} seconds")
        print(f"\n" + "="*80)
        print("RESULTS")
        print("="*80)
        print(f"Total signals found: {data['metadata']['count']}")
        print(f"\nPerformance Metrics:")
        print(f"  ⚡ Parallel time: {perf['parallel_duration']}s")
        print(f"  🐌 Sequential time (estimated): {perf['sequential_duration_estimated']}s")
        print(f"  🚀 Speedup: {perf['speedup']}x faster")
        print(f"  ⏱️  Time saved: {perf['time_saved_seconds']}s ({(perf['time_saved_seconds']/perf['sequential_duration_estimated']*100):.1f}%)")
        
        print(f"\nPer-Exchange Results:")
        for exchange, details in data['metadata']['exchange_details'].items():
            status = "✅" if details['success'] else "❌"
            print(f"  {status} {exchange.upper():<15} {details['duration_seconds']:>6.2f}s  →  {details['signals_found']} signals")
        
        if data['signals']:
            print(f"\n🎯 Top 5 Signals:")
            for i, signal in enumerate(data['signals'][:5], 1):
                print(f"\n  {i}. {signal['symbol']} ({signal['exchange']})")
                print(f"     Signal: {signal['signal']} | Strength: {signal['strength']}%")
                print(f"     Price: ${signal['price']:.2f} | Change: {signal['change']:.2f}%")
                print(f"     Opportunity Score: {signal['advanced']['opportunity_score']:.2f}")
        
        print(f"\n" + "="*80)
        print("SUCCESS! Parallel scanning is working! 🎉")
        print("="*80)
        
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)


def comparison_example():
    """Compare sequential vs parallel scanning"""
    
    print("="*80)
    print("SEQUENTIAL vs PARALLEL COMPARISON")
    print("="*80)
    
    exchanges = ["binance", "okx"]
    
    # Test 1: Sequential (simulate by doing one at a time)
    print(f"\n📊 Test 1: Sequential Scanning")
    print(f"Scanning {len(exchanges)} exchanges one at a time...\n")
    
    seq_start = time.time()
    seq_results = []
    
    for exchange in exchanges:
        print(f"  Scanning {exchange}...")
        response = requests.post(
            f"{API_URL}/api/scanner/scan",
            json={"exchange": exchange, "timeframe": "medium"},
            timeout=300
        )
        if response.status_code == 200:
            data = response.json()
            seq_results.append(data['metadata']['duration_seconds'])
            print(f"    ✅ Done in {data['metadata']['duration_seconds']:.2f}s")
    
    seq_duration = time.time() - seq_start
    
    print(f"\n  Total sequential time: {seq_duration:.2f}s")
    
    # Test 2: Parallel
    print(f"\n📊 Test 2: Parallel Scanning")
    print(f"Scanning {len(exchanges)} exchanges in parallel...\n")
    
    par_start = time.time()
    
    response = requests.post(
        f"{API_URL}/api/scanner/scan",
        json={"exchange": exchanges, "timeframe": "medium"},
        timeout=300
    )
    
    par_duration = time.time() - par_start
    
    if response.status_code == 200:
        data = response.json()
        print(f"  ✅ Done in {par_duration:.2f}s")
        
        # Comparison
        print(f"\n" + "="*80)
        print("⚡ COMPARISON RESULTS")
        print("="*80)
        print(f"Sequential: {seq_duration:.2f}s")
        print(f"Parallel:   {par_duration:.2f}s")
        print(f"\nSpeedup:    {(seq_duration/par_duration):.2f}x faster with parallel!")
        print(f"Time saved: {(seq_duration - par_duration):.2f}s ({((seq_duration - par_duration)/seq_duration*100):.1f}%)")
        print("="*80)


if __name__ == "__main__":
    # Check if API is running
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ API is not running. Start it with: python scanner_api.py")
            exit(1)
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        print("Please start the server with: python scanner_api.py")
        exit(1)
    
    print("\nChoose example:")
    print("1. Simple parallel scan example")
    print("2. Sequential vs parallel comparison")
    
    choice = input("\nEnter choice (1/2) [default: 1]: ").strip() or "1"
    
    print()
    
    if choice == "1":
        parallel_scan_example()
    elif choice == "2":
        comparison_example()
    else:
        print("Invalid choice")

