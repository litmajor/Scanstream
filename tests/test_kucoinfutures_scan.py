"""
Test script to verify KuCoin Futures scanning works
Run this to ensure basic scan results are coming through
"""

import asyncio
import ccxt.async_support as ccxt_async
from scanner import MomentumScanner, get_dynamic_config
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_kucoinfutures_connection():
    """Test if we can connect to KuCoin Futures"""
    print("\n" + "="*80)
    print("STEP 1: Testing KuCoin Futures Connection")
    print("="*80)
    
    try:
        exchange = ccxt_async.kucoinfutures({
            'enableRateLimit': True,
            'timeout': 30000,
        })
        
        # Load markets
        print("Loading markets...")
        markets = await exchange.load_markets()
        
        # Filter USDT pairs
        usdt_pairs = [symbol for symbol in markets.keys() if 'USDT' in symbol and markets[symbol].get('active', True)]
        print(f"✅ Connected to KuCoin Futures")
        print(f"✅ Found {len(usdt_pairs)} USDT trading pairs")
        print(f"\nSample pairs: {usdt_pairs[:10]}")
        
        # Test fetching ticker
        test_symbol = 'BTC/USDT:USDT'
        if test_symbol in markets:
            ticker = await exchange.fetch_ticker(test_symbol)
            print(f"\n✅ Fetched ticker for {test_symbol}")
            print(f"   Price: ${ticker['last']:,.2f}")
            print(f"   24h Volume: ${ticker['quoteVolume']:,.0f}")
            print(f"   24h Change: {ticker['percentage']:.2f}%")
        
        await exchange.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


async def test_basic_scan():
    """Test a basic market scan with KuCoin Futures"""
    print("\n" + "="*80)
    print("STEP 2: Testing Basic Market Scan")
    print("="*80)
    
    try:
        # Initialize exchange
        print("Initializing KuCoin Futures exchange...")
        exchange = ccxt_async.kucoinfutures({
            'enableRateLimit': True,
            'timeout': 30000,
        })
        await exchange.load_markets()
        
        # Create scanner
        print("Creating momentum scanner...")
        config = get_dynamic_config()
        scanner = MomentumScanner(
            exchange=exchange,
            config=config,
            market_type='crypto',
            quote_currency='USDT',
            top_n=10,  # Only scan top 10 for quick test
            min_volume_usd=100000
        )
        
        # Run scan
        print("\nRunning market scan (1h timeframe)...")
        print("This may take 30-60 seconds...\n")
        
        results = await scanner.scan_market(
            timeframe='1h',
            full_analysis=True,
            save_results=False
        )
        
        # Display results
        if results.empty:
            print("⚠️  Scan completed but no signals found")
            print("This could mean:")
            print("  - No symbols meet the signal criteria")
            print("  - Market conditions are neutral")
            print("  - Volume/price filters are too strict")
        else:
            print(f"✅ Scan completed successfully!")
            print(f"✅ Found {len(results)} signals")
            print("\n" + "-"*80)
            print("Top 5 Signals:")
            print("-"*80)
            
            # Show top 5 signals
            top_signals = results.head(5)
            for idx, row in top_signals.iterrows():
                print(f"\n{row['symbol']}")
                print(f"  Signal: {row['signal']}")
                print(f"  Strength: {row.get('signal_strength', 0)*100:.1f}%")
                print(f"  Price: ${row['price']:,.2f}")
                print(f"  RSI: {row['rsi']:.1f}")
                print(f"  Volume: ${row.get('volume_usd', 0):,.0f}")
        
        # Close exchange
        await exchange.close()
        return len(results) > 0
        
    except Exception as e:
        logger.error(f"❌ Scan failed: {e}", exc_info=True)
        return False


async def test_api_endpoint():
    """Test the scanner API endpoint"""
    print("\n" + "="*80)
    print("STEP 3: Testing Scanner API Endpoint")
    print("="*80)
    
    import requests
    
    try:
        # Check if API is running
        print("Checking if scanner API is running on port 5001...")
        response = requests.get('http://localhost:5001/health', timeout=5)
        
        if response.ok:
            print("✅ Scanner API is running")
            
            # Trigger a scan
            print("\nTriggering scan via API...")
            scan_response = requests.post(
                'http://localhost:5001/api/scanner/scan',
                json={
                    'timeframe': '1h',
                    'exchange': 'kucoinfutures',
                    'signal': 'all',
                    'minStrength': 0,
                    'fullAnalysis': True
                },
                timeout=120
            )
            
            if scan_response.ok:
                data = scan_response.json()
                print(f"✅ API scan completed")
                print(f"✅ Signals returned: {data['metadata']['count']}")
                print(f"✅ Duration: {data['metadata']['duration_seconds']:.2f}s")
                
                if data['signals']:
                    print("\nSample signal:")
                    signal = data['signals'][0]
                    print(f"  Symbol: {signal['symbol']}")
                    print(f"  Exchange: {signal['exchange']}")
                    print(f"  Signal: {signal['signal']}")
                    print(f"  Strength: {signal['strength']}%")
                    print(f"  Price: ${signal['price']:,.2f}")
                return True
            else:
                print(f"❌ API scan failed: {scan_response.status_code}")
                print(f"Response: {scan_response.text}")
                return False
        else:
            print("❌ Scanner API is not responding")
            print("Please start it with: python scanner_api.py")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to scanner API")
        print("Please start the scanner API first:")
        print("  python scanner_api.py")
        return False
    except Exception as e:
        print(f"❌ API test failed: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("KUCOIN FUTURES SCANNER TEST")
    print("="*80)
    
    # Test 1: Connection
    connection_ok = await test_kucoinfutures_connection()
    
    if not connection_ok:
        print("\n❌ Connection test failed. Cannot proceed.")
        return
    
    # Test 2: Basic scan
    scan_ok = await test_basic_scan()
    
    # Test 3: API endpoint (optional)
    api_ok = await test_api_endpoint()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Connection Test: {'✅ PASS' if connection_ok else '❌ FAIL'}")
    print(f"Basic Scan Test: {'✅ PASS' if scan_ok else '⚠️  NO SIGNALS'}")
    print(f"API Test: {'✅ PASS' if api_ok else '⚠️  API NOT RUNNING'}")
    print("="*80)
    
    if connection_ok and scan_ok:
        print("\n✅ Basic scanning is working!")
        print("You can now:")
        print("  1. Start the scanner API: python scanner_api.py")
        print("  2. Start the frontend: npm run dev")
        print("  3. Click 'Scan Now' in the UI")
    elif connection_ok:
        print("\n⚠️  Connection works but no signals found")
        print("Try adjusting filters or waiting for better market conditions")
    else:
        print("\n❌ Basic scanning not working - check error messages above")


if __name__ == "__main__":
    asyncio.run(main())

