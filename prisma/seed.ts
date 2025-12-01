import prisma from './server/db';

const REAL_STRATEGIES = [
  {
    id: 'gradient_trend_filter',
    name: 'Gradient Trend Filter',
    description: 'Advanced trend-following strategy using gradient analysis for precise trend identification',
    type: 'Trend Following',
    features: [
      'Multi-timeframe gradient analysis',
      'Adaptive trend strength calculation',
      'Dynamic support/resistance levels',
      'Volatility-adjusted entries'
    ],
    parameters: {
      fast_period: { type: 'number', default: 10, description: 'Fast EMA period', min: 5, max: 50 },
      slow_period: { type: 'number', default: 50, description: 'Slow EMA period', min: 20, max: 200 },
      threshold: { type: 'number', default: 0.002, description: 'Trend threshold', min: 0.001, max: 0.01 }
    }
  },
  {
    id: 'ut_bot',
    name: 'UT Bot Strategy',
    description: 'ATR-based trailing stop system for capturing trends with dynamic risk management',
    type: 'Trend Following',
    features: [
      'Multiple ATR calculation methods',
      'Position tracking with P&L',
      'Dynamic trailing stops',
      'Configurable stop loss behavior'
    ],
    parameters: {
      sensitivity: { type: 'number', default: 1.0, description: 'ATR multiplier', min: 0.5, max: 3.0 },
      atr_period: { type: 'number', default: 10, description: 'ATR period', min: 5, max: 30 },
      atr_method: { type: 'string', default: 'RMA', description: 'ATR method (RMA/SMA/EMA/WMA)' }
    }
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion Engine',
    description: 'Multi-indicator reversal system combining Bollinger Bands, Z-Score, and RSI',
    type: 'Mean Reversion',
    features: [
      'Bollinger Bands for volatility levels',
      'Z-Score for statistical extremes',
      'RSI momentum confirmation',
      'Market regime detection'
    ],
    parameters: {
      bb_period: { type: 'number', default: 20, description: 'Bollinger Bands period', min: 10, max: 50 },
      bb_std: { type: 'number', default: 2.0, description: 'Standard deviation multiplier', min: 1.5, max: 3.0 },
      rsi_period: { type: 'number', default: 14, description: 'RSI period', min: 7, max: 28 }
    }
  },
  {
    id: 'volume_profile',
    name: 'Volume Profile Engine',
    description: 'Advanced volume analysis identifying liquidity clusters and key price levels',
    type: 'Volume Analysis',
    features: [
      'High Volume Node (HVN) detection',
      'Low Volume Node (LVN) identification',
      'Volume-weighted price identification',
      'Breakout confirmation signals'
    ],
    parameters: {
      node_count: { type: 'number', default: 50, description: 'Number of volume nodes', min: 20, max: 100 },
      threshold: { type: 'number', default: 0.5, description: 'Volume threshold %', min: 0.1, max: 1.0 },
      lookback: { type: 'number', default: 200, description: 'Lookback periods', min: 50, max: 500 }
    }
  },
  {
    id: 'market_structure',
    name: 'Market Structure Analyzer',
    description: 'Price action strategy identifying support/resistance and trend continuation',
    type: 'Price Action',
    features: [
      'Pivot point calculation (multiple methods)',
      'Higher High/Lower Low tracking',
      'Swing point identification',
      'Liquidity level mapping'
    ],
    parameters: {
      pivot_type: { type: 'string', default: 'standard', description: 'Pivot calculation method' },
      swing_lookback: { type: 'number', default: 5, description: 'Swing identification lookback', min: 3, max: 20 },
      confirmation_bars: { type: 'number', default: 2, description: 'Confirmation candles', min: 1, max: 5 }
    }
  },
  {
    id: 'flow_field_engine',
    name: 'Flow Field Engine',
    description: 'Order flow and microstructure analysis with heatmap visualization',
    type: 'Order Flow',
    features: [
      'Cumulative Delta tracking',
      'Bid/Ask imbalance detection',
      'Large order identification',
      'Volume cluster analysis'
    ],
    parameters: {
      delta_threshold: { type: 'number', default: 0.6, description: 'Delta imbalance threshold', min: 0.5, max: 0.9 },
      cluster_size: { type: 'number', default: 50, description: 'Minimum cluster size', min: 10, max: 200 },
      lookback_ticks: { type: 'number', default: 500, description: 'Lookback in ticks', min: 100, max: 1000 }
    }
  }
];

async function seedStrategies() {
  try {
    console.log('🌱 Seeding real strategies...');

    for (const strategyData of REAL_STRATEGIES) {
      const existing = await prisma.strategy.findUnique({
        where: { id: strategyData.id }
      });

      if (existing) {
        // Update with new data
        await prisma.strategy.update({
          where: { id: strategyData.id },
          data: {
            name: strategyData.name,
            description: strategyData.description,
            riskParams: {},
            performance: {
              winRate: 0,
              avgReturn: 0,
              sharpeRatio: 0,
              maxDrawdown: 0,
              totalTrades: 0
            },
            isActive: true
          }
        });
        console.log(`✅ Updated strategy: ${strategyData.name}`);
      } else {
        // Create new
        await prisma.strategy.create({
          data: {
            id: strategyData.id,
            name: strategyData.name,
            description: strategyData.description,
            riskParams: strategyData.parameters || {},
            performance: {
              winRate: 0,
              avgReturn: 0,
              sharpeRatio: 0,
              maxDrawdown: 0,
              totalTrades: 0,
              profitableTrades: 0,
              losingTrades: 0
            },
            isActive: true
          }
        });
        console.log(`✅ Created strategy: ${strategyData.name}`);
      }
    }

    console.log('✨ Strategy seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedStrategies();
