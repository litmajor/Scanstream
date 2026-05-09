# Trading Terminal Application

## Overview

This is a modern full-stack trading terminal application built for cryptocurrency market analysis and automated trading. The system provides real-time market data visualization, technical indicators, signal generation, and trading automation capabilities. It features a React-based frontend with a sophisticated trading interface and an Express.js backend with WebSocket support for live data streaming.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite for fast development and building
- **Styling**: TailwindCSS with shadcn/ui component library for consistent design system
- **State Management**: TanStack Query (React Query) for server state management with automatic caching and refetching
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Recharts library for market data visualization and technical analysis charts
- **UI Components**: Radix UI primitives wrapped in custom components for accessibility and consistency

### Backend Architecture
- **Runtime**: Node.js with TypeScript and ES modules
- **Framework**: Express.js for REST API endpoints
- **Real-time Communication**: WebSocket Server for live market data streaming
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Data Storage**: In-memory storage implementation with interface for easy database integration
- **API Design**: RESTful endpoints for market data, signals, trades, strategies, and backtesting

### Data Storage Solutions
- **Database**: PostgreSQL configured via Drizzle with Neon Database serverless driver
- **Schema Design**: Normalized tables for market frames, signals, trades, strategies, and backtest results
- **Data Types**: JSONB fields for complex nested data structures (indicators, order flow, market microstructure)
- **Migration Strategy**: Drizzle Kit for schema migrations and database management

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store using connect-pg-simple
- **Security**: Cookie-based authentication with secure session handling

### Real-time Data Architecture
- **WebSocket Integration**: Bidirectional communication for live market updates and trading signals
- **Data Streaming**: Real-time price feeds, order book updates, and signal notifications
- **Market Data Structure**: Comprehensive market frames including OHLCV data, technical indicators, order flow metrics, and market microstructure data

### Trading Engine Integration
- **Signal Processing**: Automated signal generation with confidence scoring and risk assessment
- **Strategy Management**: Configurable trading strategies with backtesting capabilities
- **Risk Management**: Built-in stop-loss, take-profit, and position sizing controls
- **Performance Tracking**: Comprehensive trade analytics and portfolio performance metrics

## External Dependencies

### Database Services
- **PostgreSQL**: Primary database for persistent data storage
- **Neon Database**: Serverless PostgreSQL provider for cloud deployment
- **Drizzle ORM**: Type-safe database toolkit with schema management

### Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking across the entire stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment plugins and runtime error handling

### UI and Styling
- **Radix UI**: Accessible component primitives for complex UI interactions
- **TailwindCSS**: Utility-first CSS framework with custom design tokens
- **Lucide Icons**: Comprehensive icon library for trading and financial interfaces
- **shadcn/ui**: Pre-built component library built on Radix UI and TailwindCSS

### Data Visualization
- **Recharts**: React charting library for market data visualization
- **Chart Components**: Line charts, area charts, and candlestick charts for technical analysis

### State Management and API
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **Zod**: Runtime type validation for API requests and database schemas
- **React Hook Form**: Form state management with validation

### Real-time Communication
- **WebSocket (ws)**: Native WebSocket implementation for real-time market data
- **Event-driven Architecture**: Pub/sub pattern for market updates and trading signals

### Trading and Market Data
- **Technical Analysis**: Integration points for indicators like RSI, MACD, Bollinger Bands, EMA/SMA
- **Market Microstructure**: Order flow analysis, bid/ask spread monitoring, and liquidity metrics
- **Risk Management**: Position sizing, stop-loss automation, and portfolio risk controls