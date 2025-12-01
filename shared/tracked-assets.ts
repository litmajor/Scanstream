/**
 * SCANSTREAM Tracked Assets (50 Cryptocurrencies)
 * Divided into five categories:
 * - Tier-1 (15): Largest cap, most liquid, most established
 * - Fundamental (15): Strong fundamentals, growing ecosystems
 * - Meme (6): Community-driven, high volatility, meme culture
 * - AI/ML (6): Artificial intelligence and machine learning
 * - RWA (8): Real-world asset tokenization
 */

export interface TrackedAsset {
  id: string;
  symbol: string;
  name: string;
  coingeckoId: string;
  category: 'tier-1' | 'fundamental' | 'meme' | 'ai' | 'rwa';
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
    description: 'Bitcoin-derived cryptocurrency with strong community'
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
 * FUNDAMENTAL 15: Strong fundamentals, consistent performers, growing ecosystems
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
 * MEME 6: Community-driven, high volatility, meme culture assets
 */
export const MEME_6_ASSETS: TrackedAsset[] = [
  {
    id: 'shib',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    coingeckoId: 'shiba-inu',
    category: 'meme',
    description: 'Most successful meme token with active ecosystem and DEX'
  },
  {
    id: 'pepe',
    symbol: 'PEPE',
    name: 'Pepe',
    coingeckoId: 'pepe',
    category: 'meme',
    description: 'Ethereum-based meme token with strong trading activity'
  },
  {
    id: 'bonk',
    symbol: 'BONK',
    name: 'Bonk',
    coingeckoId: 'bonk',
    category: 'meme',
    description: 'Native Solana meme coin with compressed token support'
  },
  {
    id: 'floki',
    symbol: 'FLOKI',
    name: 'Floki Inu',
    coingeckoId: 'floki',
    category: 'meme',
    description: 'Meme token with gaming and NFT ecosystem development'
  },
  {
    id: 'wif',
    symbol: 'WIF',
    name: 'Dogwifhat',
    coingeckoId: 'dogwifhat',
    category: 'meme',
    description: 'Popular Solana meme coin with viral social appeal'
  },
  {
    id: 'mog',
    symbol: 'MOG',
    name: 'Mog Coin',
    coingeckoId: 'mog-coin',
    category: 'meme',
    description: 'Ethereum-based meme token in gaming ecosystem'
  }
];

/**
 * AI/ML 6: Artificial intelligence and machine learning tokens
 */
export const AI_6_ASSETS: TrackedAsset[] = [
  {
    id: 'agix',
    symbol: 'AGIX',
    name: 'SingularityNET',
    coingeckoId: 'singularitynet',
    category: 'ai',
    description: 'Decentralized AI services marketplace and infrastructure'
  },
  {
    id: 'fet',
    symbol: 'FET',
    name: 'Fetch.ai',
    coingeckoId: 'fetch-ai',
    category: 'ai',
    description: 'AI and machine learning platform for autonomous agents'
  },
  {
    id: 'render',
    symbol: 'RENDER',
    name: 'Render Network',
    coingeckoId: 'render-token',
    category: 'ai',
    description: 'GPU compute network for AI, rendering, and ML workloads'
  },
  {
    id: 'tao',
    symbol: 'TAO',
    name: 'Bittensor',
    coingeckoId: 'bittensor',
    category: 'ai',
    description: 'Decentralized machine learning network with incentive mechanisms'
  },
  {
    id: 'arkm',
    symbol: 'ARKM',
    name: 'Arkham Intelligence',
    coingeckoId: 'arkham-intelligence',
    category: 'ai',
    description: 'AI-powered on-chain analytics and intelligence platform'
  },
  {
    id: 'aia',
    symbol: 'AIA',
    name: 'AI Avatar',
    coingeckoId: 'ai-avatar',
    category: 'ai',
    description: 'AI-driven avatar and metaverse interaction protocol'
  }
];

/**
 * RWA 8: Real-world asset tokenization and bridges
 */
export const RWA_8_ASSETS: TrackedAsset[] = [
  {
    id: 'ondo',
    symbol: 'ONDO',
    name: 'Ondo Finance',
    coingeckoId: 'ondo-finance',
    category: 'rwa',
    description: 'Real estate and real-world asset tokenization protocol'
  },
  {
    id: 'frax',
    symbol: 'FRAX',
    name: 'Frax Share',
    coingeckoId: 'frax-share',
    category: 'rwa',
    description: 'Fractional reserve stablecoin and real-asset backing'
  },
  {
    id: 'usde',
    symbol: 'USDe',
    name: 'Ethena USD',
    coingeckoId: 'ethena',
    category: 'rwa',
    description: 'Synthetic USD stablecoin backed by real-world collateral'
  },
  {
    id: 'mx',
    symbol: 'MX',
    name: 'Mixin',
    coingeckoId: 'mixin',
    category: 'rwa',
    description: 'Asset bridge and cross-chain messaging for RWA trading'
  },
  {
    id: 'ggm',
    symbol: 'GGM',
    name: 'Goldfinch',
    coingeckoId: 'goldfinch',
    category: 'rwa',
    description: 'Decentralized credit protocol for real-world lending'
  },
  {
    id: 'ape',
    symbol: 'APE',
    name: 'ApeCoin',
    coingeckoId: 'apecoin',
    category: 'rwa',
    description: 'Community governance token for digital communities and IP'
  },
  {
    id: 'sand',
    symbol: 'SAND',
    name: 'The Sandbox',
    coingeckoId: 'the-sandbox',
    category: 'rwa',
    description: 'Virtual world token with real-estate ownership and commerce'
  },
  {
    id: 'blur',
    symbol: 'BLUR',
    name: 'Blur',
    coingeckoId: 'blur',
    category: 'rwa',
    description: 'NFT marketplace and collection protocol with governance'
  }
];

/**
 * All 50 tracked assets combined
 */
export const ALL_TRACKED_ASSETS: TrackedAsset[] = [
  ...TOP_15_ASSETS,
  ...FUNDAMENTAL_15_ASSETS,
  ...MEME_6_ASSETS,
  ...AI_6_ASSETS,
  ...RWA_8_ASSETS
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
  meme: MEME_6_ASSETS.length,
  ai: AI_6_ASSETS.length,
  rwa: RWA_8_ASSETS.length,
  total: ALL_TRACKED_ASSETS.length
};

/**
 * Get assets by category
 */
export function getAssetsByCategory(category: 'tier-1' | 'fundamental' | 'meme' | 'ai' | 'rwa'): TrackedAsset[] {
  return ALL_TRACKED_ASSETS.filter(a => a.category === category);
}

/**
 * All category names
 */
export const CATEGORY_NAMES = {
  'tier-1': 'Tier-1 (Top 15)',
  'fundamental': 'Fundamental (15)',
  'meme': 'Meme Coins (6)',
  'ai': 'AI & ML (6)',
  'rwa': 'RWA & Social (8)'
};
