import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STRATEGIES = [
  {
    name: 'Gradient Trend Filter',
    description: 'Advanced trend-following strategy using gradient analysis for precise trend identification',
    riskParams: {
      maxPositionSize: 0.1,
      maxDrawdown: 0.15,
      stopLossPercent: 0.05,
      takeProfitPercent: 0.1
    },
    performance: {
      winRate: 0.68,
      profitFactor: 2.1,
      totalTrades: 234,
      sharpeRatio: 1.8,
      maxDrawdown: 0.12
    },
    isActive: true
  },
  {
    name: 'UT Bot Strategy',
    description: 'ATR-based trailing stop system for capturing trends with dynamic risk management',
    riskParams: {
      maxPositionSize: 0.08,
      maxDrawdown: 0.12,
      stopLossPercent: 0.04,
      takeProfitPercent: 0.08
    },
    performance: {
      winRate: 0.62,
      profitFactor: 1.8,
      totalTrades: 189,
      sharpeRatio: 1.5,
      maxDrawdown: 0.10
    },
    isActive: true
  },
  {
    name: 'Mean Reversion Engine',
    description: 'Multi-indicator reversal system combining Bollinger Bands, Z-Score, and RSI',
    riskParams: {
      maxPositionSize: 0.12,
      maxDrawdown: 0.18,
      stopLossPercent: 0.06,
      takeProfitPercent: 0.12
    },
    performance: {
      winRate: 0.71,
      profitFactor: 2.3,
      totalTrades: 156,
      sharpeRatio: 2.0,
      maxDrawdown: 0.08
    },
    isActive: true
  },
  {
    name: 'Volume Profile Engine',
    description: 'Advanced volume analysis identifying liquidity clusters and key price levels',
    riskParams: {
      maxPositionSize: 0.1,
      maxDrawdown: 0.14,
      stopLossPercent: 0.05,
      takeProfitPercent: 0.09
    },
    performance: {
      winRate: 0.65,
      profitFactor: 1.9,
      totalTrades: 201,
      sharpeRatio: 1.6,
      maxDrawdown: 0.11
    },
    isActive: true
  },
  {
    name: 'Market Structure Analyzer',
    description: 'Price action strategy identifying support/resistance and trend continuation',
    riskParams: {
      maxPositionSize: 0.09,
      maxDrawdown: 0.16,
      stopLossPercent: 0.05,
      takeProfitPercent: 0.11
    },
    performance: {
      winRate: 0.59,
      profitFactor: 1.6,
      totalTrades: 112,
      sharpeRatio: 1.3,
      maxDrawdown: 0.14
    },
    isActive: true
  }
];

async function seed() {
  console.log('Starting database seed...');

  try {
    console.log('Seeding strategies...');
    for (const strategy of STRATEGIES) {
      await prisma.strategy.create({
        data: strategy
      });
      console.log(`Created strategy: ${strategy.name}`);
    }

    console.log('Seeding market sentiment...');
    await prisma.marketSentiment.create({
      data: {
        data: {
          fearGreedIndex: 67,
          btcDominance: 51.2,
          totalMarketCap: 1680000000000,
          volume24h: 89200000000
        }
      }
    });

    console.log('Seeding portfolio summary...');
    await prisma.portfolioSummary.create({
      data: {
        data: {
          totalValue: 127543.89,
          availableCash: 23456.78,
          invested: 104087.11,
          dayChange: 5892.31,
          dayChangePercent: 4.84
        }
      }
    });

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
