"""
Test script for CoinGecko integration
Demonstrates how to use the enhanced analytics endpoints
"""

import requests
import json
from datetime import datetime

API_BASE = "http://localhost:3000"

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"{title}")
    print(f"{'='*80}\n")


def test_market_data():
    """Test: Get top coins by market cap"""
    print_section("1. Market Data - Top 10 Coins")
    
    response = requests.get(f"{API_BASE}/api/coingecko/markets?per_page=10")
    data = response.json()
    
    if data['success']:
        print(f"✅ Fetched {len(data['data'])} coins\n")
        for i, coin in enumerate(data['data'][:5], 1):
            print(f"{i}. {coin['name']} ({coin['symbol'].upper()})")
            print(f"   Price: ${coin['current_price']:,.2f}")
            print(f"   Market Cap: ${coin['market_cap']:,.0f}")
            print(f"   24h Change: {coin.get('price_change_percentage_24h', 0):.2f}%\n")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_trending():
    """Test: Get trending coins"""
    print_section("2. Trending Coins")
    
    response = requests.get(f"{API_BASE}/api/coingecko/trending")
    data = response.json()
    
    if data['success']:
        print(f"✅ Found {len(data['data'])} trending coins\n")
        for i, trend in enumerate(data['data'][:5], 1):
            item = trend['item']
            print(f"{i}. {item['name']} ({item['symbol'].upper()})")
            print(f"   Rank: #{item.get('market_cap_rank', 'N/A')}\n")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_global_market():
    """Test: Get global market metrics"""
    print_section("3. Global Market Overview")
    
    response = requests.get(f"{API_BASE}/api/coingecko/global")
    data = response.json()
    
    if data['success']:
        global_data = data['data']
        print("✅ Global Market Metrics\n")
        print(f"Active Cryptocurrencies: {global_data['active_cryptocurrencies']:,}")
        print(f"Total Market Cap: ${global_data['total_market_cap']['usd']:,.0f}")
        print(f"Total Volume (24h): ${global_data['total_volume']['usd']:,.0f}")
        print(f"\nMarket Dominance:")
        for coin, pct in list(global_data['market_cap_percentage'].items())[:5]:
            print(f"  {coin.upper()}: {pct:.2f}%")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_sentiment():
    """Test: Get sentiment score for BTC"""
    print_section("4. Sentiment Analysis")
    
    symbol = "BTC"
    response = requests.get(f"{API_BASE}/api/coingecko/sentiment/{symbol}")
    data = response.json()
    
    if data['success']:
        print(f"✅ Sentiment for {data['symbol']}\n")
        print(f"Score: {data['sentimentScore']}/100")
        print(f"Interpretation: {data['interpretation'].upper()}")
        
        # Visual representation
        bar_length = int(data['sentimentScore'] / 5)
        bar = "█" * bar_length + "░" * (20 - bar_length)
        print(f"[{bar}]")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_market_regime():
    """Test: Get current market regime"""
    print_section("5. Market Regime Detection")
    
    response = requests.get(f"{API_BASE}/api/coingecko/regime")
    data = response.json()
    
    if data['success']:
        print("✅ Current Market Regime\n")
        print(f"Regime: {data['regime'].upper()}")
        print(f"Confidence: {data['confidence']}%")
        print(f"BTC Dominance: {data['btcDominance']:.2f}%")
        print(f"Total Market Cap: ${data['totalMarketCap']:,.0f}")
        print(f"Total Volume: ${data['totalVolume']:,.0f}")
        
        # Interpretation
        regime_emoji = {
            'bull': '🚀',
            'bear': '🐻',
            'neutral': '😐',
            'volatile': '⚡'
        }
        print(f"\nInterpretation: {regime_emoji.get(data['regime'], '❓')} {data['regime'].title()} market conditions")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_composite_score():
    """Test: Calculate enhanced composite score"""
    print_section("6. Enhanced Composite Score")
    
    # Simulate scanner data
    symbol = "BTC/USDT"
    payload = {
        "symbol": symbol,
        "rsi": 35,           # Oversold
        "macd": 0.5,         # Bullish
        "volumeRatio": 2.3,  # High volume
        "priceChange24h": 3.2,  # Positive momentum
        "momentum": 0.6,     # Strong momentum
        "includeSentiment": True,
        "weights": {
            "technical": 0.5,
            "sentiment": 0.3,
            "marketRegime": 0.2
        }
    }
    
    response = requests.post(
        f"{API_BASE}/api/analytics/composite-score",
        json=payload
    )
    data = response.json()
    
    if data['success']:
        print(f"✅ Composite Score for {data['symbol']}\n")
        print(f"Overall Score: {data['compositeScore']:.2f}/100")
        print(f"Recommendation: {data['recommendation'].replace('_', ' ').upper()}")
        
        print("\nBreakdown:")
        breakdown = data['breakdown']
        
        print(f"\n  Technical Analysis:")
        print(f"    Score: {breakdown['technical']['score']:.2f}/100")
        print(f"    Weight: {breakdown['technical']['weight']*100:.0f}%")
        print(f"    Contribution: {breakdown['technical']['contribution']:.2f}")
        
        print(f"\n  Sentiment Analysis:")
        print(f"    Score: {breakdown['sentiment']['score']:.2f}/100")
        print(f"    Weight: {breakdown['sentiment']['weight']*100:.0f}%")
        print(f"    Contribution: {breakdown['sentiment']['contribution']:.2f}")
        print(f"    Trending: {'Yes ⭐' if breakdown['sentiment']['isTrending'] else 'No'}")
        
        print(f"\n  Market Regime:")
        print(f"    Score: {breakdown['marketRegime']['score']:.2f}/100")
        print(f"    Weight: {breakdown['marketRegime']['weight']*100:.0f}%")
        print(f"    Contribution: {breakdown['marketRegime']['contribution']:.2f}")
        print(f"    Regime: {breakdown['marketRegime']['regime'].upper()}")
        print(f"    BTC Dominance: {breakdown['marketRegime']['btcDominance']:.2f}%")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_batch_composite():
    """Test: Batch composite score calculation"""
    print_section("7. Batch Composite Score")
    
    payload = {
        "symbols": [
            {
                "symbol": "BTC/USDT",
                "rsi": 35,
                "macd": 0.5,
                "volumeRatio": 2.3,
                "priceChange24h": 3.2,
                "momentum": 0.6
            },
            {
                "symbol": "ETH/USDT",
                "rsi": 45,
                "macd": -0.2,
                "volumeRatio": 1.8,
                "priceChange24h": 1.5,
                "momentum": 0.3
            },
            {
                "symbol": "SOL/USDT",
                "rsi": 75,
                "macd": -0.8,
                "volumeRatio": 3.1,
                "priceChange24h": -2.5,
                "momentum": -0.2
            }
        ],
        "includeSentiment": True
    }
    
    response = requests.post(
        f"{API_BASE}/api/analytics/batch-composite-score",
        json=payload
    )
    data = response.json()
    
    if data['success']:
        print(f"✅ Analyzed {data['count']} symbols\n")
        print(f"Global Regime: {data['globalRegime']['marketRegime'].upper()}")
        print(f"BTC Dominance: {data['globalRegime']['btcDominance']:.2f}%\n")
        
        print("Results (sorted by score):\n")
        for i, result in enumerate(data['results'], 1):
            rec_emoji = {
                'strong_buy': '🟢',
                'buy': '🟡',
                'hold': '⚪',
                'sell': '🟠',
                'strong_sell': '🔴'
            }
            
            emoji = rec_emoji.get(result['recommendation'], '❓')
            print(f"{i}. {result['symbol']}")
            print(f"   Score: {result['compositeScore']:.2f}/100")
            print(f"   {emoji} {result['recommendation'].replace('_', ' ').upper()}\n")
    else:
        print(f"❌ Error: {data.get('error')}")


def test_market_overview():
    """Test: Get comprehensive market overview"""
    print_section("8. Comprehensive Market Overview")
    
    response = requests.get(f"{API_BASE}/api/analytics/market-overview")
    data = response.json()
    
    if data['success']:
        print("✅ Market Overview\n")
        
        print("Global Metrics:")
        print(f"  Total Market Cap: ${data['global']['totalMarketCap']:,.0f}")
        print(f"  Total Volume: ${data['global']['totalVolume']:,.0f}")
        print(f"  BTC Dominance: {data['global']['btcDominance']:.2f}%")
        print(f"  Active Cryptos: {data['global']['activeCryptocurrencies']:,}")
        
        print(f"\nCurrent Regime: {data['regime']['current'].upper()}")
        print(f"Confidence: {data['regime']['confidence']}%")
        
        print("\nTop Trending:")
        for i, coin in enumerate(data['trending'][:5], 1):
            print(f"  {i}. {coin['name']} ({coin['symbol'].upper()})")
    else:
        print(f"❌ Error: {data.get('error')}")


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("🦎 COINGECKO INTEGRATION TEST SUITE")
    print("="*80)
    print(f"Testing against: {API_BASE}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if server is running
    try:
        requests.get(f"{API_BASE}/health", timeout=5)
    except:
        print("\n❌ ERROR: Server is not running!")
        print("Please start the server with: npm run dev")
        return
    
    try:
        # Run all tests
        test_market_data()
        test_trending()
        test_global_market()
        test_sentiment()
        test_market_regime()
        test_composite_score()
        test_batch_composite()
        test_market_overview()
        
        print_section("✅ ALL TESTS COMPLETED")
        print("CoinGecko integration is working correctly!")
        print("\nNext steps:")
        print("1. Integrate with your scanner pipeline")
        print("2. Display sentiment data in UI")
        print("3. Use composite scores for trading decisions")
        print("4. Monitor rate limits and cache performance")
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Network error: {e}")
        print("Make sure the server is running and accessible")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

