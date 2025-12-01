# SCANSTREAM Tracked Assets (30 Cryptocurrencies)

## Overview
Scanstream monitors **30 cryptocurrencies** across two tiers:
- **Tier-1 (15)**: Largest cap, most liquid, most established
- **Fundamental (15)**: Strong fundamentals, consistent performers, growing ecosystems

## Tier-1 Assets (15) - Largest & Most Established

| Symbol | Name | Category | Market Position |
|--------|------|----------|-----------------|
| BTC | Bitcoin | Digital Gold | #1 by market cap |
| ETH | Ethereum | Smart Contracts | #2, Leading DeFi platform |
| BNB | Binance Coin | Exchange Token | #3, BSC ecosystem |
| SOL | Solana | High-Speed L1 | #4, 65k TPS blockchain |
| ADA | Cardano | Research L1 | #5, Peer-reviewed |
| XRP | Ripple | Payments | Cross-border settlements |
| DOGE | Dogecoin | Meme/Community | Strong merchant adoption |
| AVAX | Avalanche | L1 Platform | Subnet architecture |
| DOT | Polkadot | Interoperability | Multi-chain coordination |
| LINK | Chainlink | Oracles | Real-world data feeds |
| LTC | Litecoin | Payment | Bitcoin-based, established |
| BCH | Bitcoin Cash | Payments | High throughput |
| UNI | Uniswap | DEX | Leading decentralized exchange |
| MATIC | Polygon | Scaling | Ethereum layer-2 solution |
| AAVE | Aave | Lending | DeFi protocol giant |

**Total Market Cap (Tier-1):** ~$1.8 trillion  
**Average Daily Volume:** Extremely high (liquid)  
**Risk Level:** Lower (established projects)

## Fundamental Assets (15) - Strong Growth & Consistency

| Symbol | Name | Category | Special Traits |
|--------|------|----------|---------------|
| ARB | Arbitrum | L2 Ethereum | Strongest developer adoption |
| OP | Optimism | L2 Ethereum | Major ecosystem backing |
| SUI | Sui | L1 Smart Contracts | Highest throughput |
| APT | Aptos | L1 Smart Contracts | Move language, safety-first |
| ATOM | Cosmos | Interoperability | Hub for blockchain ecosystem |
| STX | Stacks | Bitcoin Layer | Smart contracts on Bitcoin |
| NEAR | NEAR Protocol | L1 Smart Contracts | Developer-friendly |
| FIL | Filecoin | Storage | Real-world adoption, revenue |
| LENS | Lens Protocol | Social | User-owned social graph |
| MKR | Maker | DeFi | Stablecoin protocol governance |
| SNX | Synthetix | Derivatives | Decentralized trading |
| LDO | Lido | Liquid Staking | ETH staking simplified |
| AR | Arweave | Storage | Permanent data platform |
| GRT | The Graph | Data Indexing | Blockchain data layer |
| SEI | Sei | L1 Trading | Optimized for traders |

**Total Market Cap (Fundamental):** ~$45 billion  
**Average Daily Volume:** High (well-traded)  
**Risk Level:** Moderate (growth projects with proven traction)

## Asset Categories by Function

### Layer-1 Blockchains (9)
Bitcoin, Ethereum, Solana, Cardano, Avalanche, Polkadot, Cosmos, Aptos, Sui

### Layer-2 Scaling (5)
Polygon, Optimism, Arbitrum, Stacks, Sei

### DeFi Protocols (6)
Uniswap, Aave, Maker, Synthetix, Lido, Chainlink

### Payment/Settlement (4)
Ripple, Litecoin, Bitcoin Cash, Dogecoin

### Storage/Data (3)
Filecoin, Arweave, The Graph

### Social/Communities (2)
Lens Protocol, Cosmos

### Specialized (1)
Binance Coin (Exchange Token)

## Why This Mix?

### Tier-1 Advantage
✓ Proven track record (established since 2009-2015)  
✓ Highest liquidity and volume  
✓ Less volatility relative to smaller projects  
✓ Institutional adoption  
✓ Lower slippage for trades  

### Fundamental Advantage
✓ Strong project fundamentals and roadmaps  
✓ Active developer communities  
✓ Real ecosystem metrics (TVL, usage, revenue)  
✓ Growth potential  
✓ Diversified risk exposure  
✓ Represents next generation of projects  

## Signal Generation Strategy

### Tier-1 Assets (15)
- **Focus:** Trend identification, macro signals
- **Patterns:** Major breakouts, accumulation patterns
- **Use:** Portfolio anchor signals, risk management
- **Timeframes:** Daily, 4H (slower patterns)

### Fundamental Assets (15)
- **Focus:** Early-stage patterns, growth opportunities
- **Patterns:** Breakouts, consolidation breaks, accumulation
- **Use:** Growth opportunity signals, diversification
- **Timeframes:** 1H, 15m (faster patterns)

## CoinGecko Integration

All 30 assets are integrated with CoinGecko for:
- Real-time price data
- Market cap tracking
- Volume analysis
- 24h change percentages
- Historical price data for analysis

## Usage in Scanstream

```typescript
import { ALL_TRACKED_ASSETS, getTrackedCoinGeckoIds } from '@shared/tracked-assets';

// Get all assets
console.log(ALL_TRACKED_ASSETS.length); // 30

// Get CoinGecko IDs for API calls
const ids = getTrackedCoinGeckoIds();

// Filter by tier
const tier1 = ALL_TRACKED_ASSETS.filter(a => a.category === 'tier-1');
const fundamental = ALL_TRACKED_ASSETS.filter(a => a.category === 'fundamental');

// Get specific asset
const btc = getAssetBySymbol('BTC');
```

## Tracking Updates

Last Updated: December 1, 2024  
Review Schedule: Monthly (evaluate top performers, adjust as needed)  
Minimum Criteria: $1B market cap for tier-1, $500M for fundamental

## Performance Notes

### Best for Range Trading
Polygon (MATIC), Chainlink (LINK), Optimism (OP)

### Best for Trend Following
Bitcoin (BTC), Ethereum (ETH), Solana (SOL)

### Best for Volatility
Sei (SEI), Aptos (APT), Arweave (AR)

### Best for Consistent Movement
Aave (AAVE), Uniswap (UNI), Lido (LDO)

All assets are monitored for:
- Multi-timeframe signals (1m through 1d)
- Pattern convergence (Scanner + ML + RL)
- Quality scoring and risk assessment
- Historical accuracy tracking per pattern
