# Scanstream - Crypto Trading Terminal

## Overview
Scanstream is a sophisticated cryptocurrency trading terminal application that provides real-time market analysis, technical indicators, signal generation, and trading automation capabilities. Built for professional traders who need advanced tools for identifying opportunities and managing risk.

## Recent Changes (October 26, 2025)
- **Imported from GitHub**: Successfully migrated the project to Replit environment
- **Fixed Express 5.x compatibility**: Updated wildcard routes to use Express 5's new path-to-regexp syntax
- **Fixed Vite integration**: Configured Vite dev server to run by default in non-production environments
- **Database setup**: PostgreSQL database provisioned and Prisma migrations applied successfully
- **Server configuration**: Unified server running on port 5000 serving both API and frontend via Vite middleware

## User Preferences
- Preferred communication style: Simple, everyday language
- No emojis unless explicitly requested

## Project Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Node.js + Express 5.x + WebSocket for real-time data
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Recharts for market data visualization

### Key Features
1. **Real-time Market Data**: WebSocket integration for live price feeds and order book updates
2. **Technical Analysis**: Comprehensive indicators (RSI, MACD, EMA, Volume Profile, etc.)
3. **Signal Generation**: Automated trading signal detection with confidence scoring
4. **Portfolio Management**: Track positions, P&L, and performance metrics
5. **Strategy Backtesting**: Test trading strategies against historical data
6. **ML Predictions**: Machine learning-powered price and volatility predictions
7. **Flow Field Analysis**: Advanced market microstructure analysis
8. **Multi-Timeframe Analysis**: Analyze markets across different timeframes
9. **CoinGecko Integration**: Market sentiment and global crypto metrics

### Server Architecture
- **Integrated Server**: Single Express server (port 5000) serves both API and frontend
- **Development Mode**: Vite dev server with HMR for fast development
- **Production Mode**: Serves built static files from `client/dist`
- **WebSocket Support**: Real-time data streaming for live market updates

### Database Schema
- **MarketFrame**: OHLCV data with technical indicators and market microstructure
- **Signal**: Trading signals with confidence scores and reasoning
- **Trade**: Trade execution records with P&L tracking
- **Strategy**: Trading strategy configurations
- **BacktestResult**: Backtest performance metrics and equity curves

### External Services Integration
- **Exchange APIs**: Binance, Coinbase, Kraken, KuCoin Futures, OKX, Bybit
- **CoinGecko API**: Global market data and sentiment analysis
- **Yahoo Finance**: Forex data integration

## Development Setup

### Environment
- Node.js with pnpm package manager
- PostgreSQL database (provisioned via Replit)
- Prisma for database migrations and ORM

### Running the Project
- **Development**: `npm start` runs the integrated server (backend + Vite frontend)
- **Build**: `npm run build` compiles TypeScript and builds the frontend
- **Database**: `npm run db:migrate` runs Prisma migrations

### Port Configuration
- **Port 5000**: Main server (API + Frontend via Vite)
- **Port 5001**: Python scanner service (optional, uses fallback if unavailable)

## Known Issues & Notes
- Python scanner service (port 5001) is optional - server uses fallback data when unavailable
- Rate limiter shows validation warnings due to `trust proxy` setting - this is expected in Replit environment
- Some TypeScript warnings in `client/src/pages/trading-terminal.tsx` related to possibly undefined volume values

## Next Steps
- Create landing, login, register, settings, profile, and pricing pages
- Implement consistent dark/light theme across all pages
- Add authentication integration
