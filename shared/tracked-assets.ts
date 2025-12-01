/**
 * SCANSTREAM Tracked Assets (30 Cryptocurrencies)
 * Divided into two categories:
 * - Top 15: Largest, most liquid, highest quality projects
 * - Fundamental 15: Strong fundamentals, growing ecosystems, consistent performers
 */

export interface TrackedAsset {
  id: string;
  symbol: string;
  name: string;
  coingeckoId: string;
  category: 'tier-1' | 'fundamental';
  description: string;
  marketCap?: number;
  volume24h?: number;
}

/**
 * TOP 15: Largest cap, most liquid, most established
 */
export const TOP_15_ASSETS: TrackedAsset[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    category: 'tier-1',
    description: 'The original cryptocurrency and leading digital asset by market cap'
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    category: 'tier-1',
    description: 'Leading smart contract platform enabling DeFi and NFTs'
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'Binance Coin',
    coingeckoId: 'binancecoin',
    category: 'tier-1',
    description: 'Native token of Binance Smart Chain ecosystem'
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    coingeckoId: 'solana',
    category: 'tier-1',
    description: 'High-speed, high-throughput blockchain for decentralized apps'
  },
  {
    id: 'ada',
    symbol: 'ADA',
    name: 'Cardano',
    coingeckoId: 'cardano',
    category: 'tier-1',
    description: 'Research-driven proof-of-stake blockchain with strong fundamentals'
  },
  {
    id: 'xrp',
    symbol: 'XRP',
    name: 'Ripple',
    coingeckoId: 'ripple',
    category: 'tier-1',
    description: 'Digital payment protocol for cross-border settlements'
  },
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    coingeckoId: 'dogecoin',
    category: 'tier-1',
    description: 'Leading meme coin with strong community and merchant adoption'
  },
  {
    id: 'avax',
    symbol: 'AVAX',
    name: 'Avalanche',
    coingeckoId: 'avalanche-2',
    category: 'tier-1',
    description: 'Fast consensus platform for scalable DeFi applications'
  },
  {
    id: 'dot',
    symbol: 'DOT',
    name: 'Polkadot',
    coingeckoId: 'polkadot',
    category: 'tier-1',
    description: 'Multi-chain platform enabling secure cross-chain communication'
  },
  {
    id: 'link',
    symbol: 'LINK',
    name: 'Chainlink',
    coingeckoId: 'chainlink',
    category: 'tier-1',
    description: 'Decentralized oracle network connecting smart contracts to real-world data'
  },
  {
    id: 'ltc',
    symbol: 'LTC',
    name: 'Litecoin',
    coingeckoId: 'litecoin',
    category: 'tier-1',
    description: 'Bitcoin-derived cryptocurrency optimized for faster transactions'
  },
  {
    id: 'bch',
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    coingeckoId: 'bitcoin-cash',
    category: 'tier-1',
    description: 'Bitcoin fork with larger block sizes for faster payments'
  },
  {
    id: 'uni',
    symbol: 'UNI',
    name: 'Uniswap',
    coingeckoId: 'uniswap',
    category: 'tier-1',
    description: 'Leading decentralized exchange (DEX) and DeFi protocol'
  },
  {
    id: 'matic',
    symbol: 'MATIC',
    name: 'Polygon',
    coingeckoId: 'matic-network',
    category: 'tier-1',
    description: 'Layer-2 scaling solution for Ethereum enabling fast, low-cost transactions'
  },
  {
    id: 'aave',
    symbol: 'AAVE',
    name: 'Aave',
    coingeckoId: 'aave',
    category: 'tier-1',
    description: 'Leading decentralized lending protocol in DeFi'
  }
];

/**
 * FUNDAMENTAL 15: Strong fundamentals, consistent performers, undervalued gems
 */
export const FUNDAMENTAL_15_ASSETS: TrackedAsset[] = [
  {
    id: 'arb',
    symbol: 'ARB',
    name: 'Arbitrum',
    coingeckoId: 'arbitrum',
    category: 'fundamental',
    description: 'Layer-2 Ethereum scaling with strong developer adoption'
  },
  {
    id: 'op',
    symbol: 'OP',
    name: 'Optimism',
    coingeckoId: 'optimism',
    category: 'fundamental',
    description: 'Layer-2 Ethereum scaling protocol with major ecosystem backing'
  },
  {
    id: 'sui',
    symbol: 'SUI',
    name: 'Sui',
    coingeckoId: 'sui',
    category: 'fundamental',
    description: 'Next-generation smart contract platform with high throughput'
  },
  {
    id: 'aptos',
    symbol: 'APT',
    name: 'Aptos',
    coingeckoId: 'aptos',
    category: 'fundamental',
    description: 'Move-based blockchain with focus on scalability and safety'
  },
  {
    id: 'atom',
    symbol: 'ATOM',
    name: 'Cosmos',
    coingeckoId: 'cosmos',
    category: 'fundamental',
    description: 'Interoperability hub connecting multiple blockchain ecosystems'
  },
  {
    id: 'stx',
    symbol: 'STX',
    name: 'Stacks',
    coingeckoId: 'stacks',
    category: 'fundamental',
    description: 'Bitcoin smart contracts layer enabling DeFi on Bitcoin'
  },
  {
    id: 'near',
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    coingeckoId: 'near',
    category: 'fundamental',
    description: 'Sharded blockchain optimized for developer experience'
  },
  {
    id: 'fil',
    symbol: 'FIL',
    name: 'Filecoin',
    coingeckoId: 'filecoin',
    category: 'fundamental',
    description: 'Decentralized storage network with real-world adoption'
  },
  {
    id: 'lens',
    symbol: 'LENS',
    name: 'Lens Protocol',
    coingeckoId: 'lens-protocol-polygon',
    category: 'fundamental',
    description: 'Decentralized social media protocol owned by users'
  },
  {
    id: 'mkr',
    symbol: 'MKR',
    name: 'Maker',
    coingeckoId: 'maker',
    category: 'fundamental',
    description: 'DeFi protocol enabling stablecoin creation and management'
  },
  {
    id: 'snx',
    symbol: 'SNX',
    name: 'Synthetix',
    coingeckoId: 'synthetix-network-token',
    category: 'fundamental',
    description: 'Decentralized synthetic assets protocol for derivative trading'
  },
  {
    id: 'ldo',
    symbol: 'LDO',
    name: 'Lido',
    coingeckoId: 'lido-dao',
    category: 'fundamental',
    description: 'Liquid staking protocol allowing Ethereum staking without minimums'
  },
  {
    id: 'arweave',
    symbol: 'AR',
    name: 'Arweave',
    coingeckoId: 'arweave',
    category: 'fundamental',
    description: 'Permanent data storage protocol with growing adoption'
  },
  {
    id: 'grt',
    symbol: 'GRT',
    name: 'The Graph',
    coingeckoId: 'the-graph',
    category: 'fundamental',
    description: 'Decentralized indexing protocol for blockchain data'
  },
  {
    id: 'sei',
    symbol: 'SEI',
    name: 'Sei',
    coingeckoId: 'sei',
    category: 'fundamental',
    description: 'High-performance L1 blockchain optimized for trading'
  }
];

/**
 * All 30 tracked assets combined
 */
export const ALL_TRACKED_ASSETS: TrackedAsset[] = [
  ...TOP_15_ASSETS,
  ...FUNDAMENTAL_15_ASSETS
];

/**
 * Get asset by symbol
 */
export function getAssetBySymbol(symbol: string): TrackedAsset | undefined {
  return ALL_TRACKED_ASSETS.find(a => a.symbol.toUpperCase() === symbol.toUpperCase());
}

/**
 * Get CoinGecko ID by symbol
 */
export function getCoinGeckoId(symbol: string): string | undefined {
  return getAssetBySymbol(symbol)?.coingeckoId;
}

/**
 * Get all symbols as comma-separated string for CoinGecko API
 */
export function getTrackedSymbolsList(): string {
  return ALL_TRACKED_ASSETS.map(a => a.symbol).join(',');
}

/**
 * Get all CoinGecko IDs as comma-separated string
 */
export function getTrackedCoinGeckoIds(): string {
  return ALL_TRACKED_ASSETS.map(a => a.coingeckoId).join(',');
}

/**
 * Category breakdown
 */
export const ASSET_CATEGORIES = {
  tier1: TOP_15_ASSETS.length,
  fundamental: FUNDAMENTAL_15_ASSETS.length,
  total: ALL_TRACKED_ASSETS.length
};
