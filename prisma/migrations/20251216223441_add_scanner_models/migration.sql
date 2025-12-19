/*
  Warnings:

  - The primary key for the `Agent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AgentSnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AgentTrade` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EvolutionEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `LearningEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."AgentSnapshot" DROP CONSTRAINT "AgentSnapshot_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AgentTrade" DROP CONSTRAINT "AgentTrade_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EvolutionEvent" DROP CONSTRAINT "EvolutionEvent_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LearningEvent" DROP CONSTRAINT "LearningEvent_agentId_fkey";

-- AlterTable
ALTER TABLE "Agent" DROP CONSTRAINT "Agent_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "type" SET DATA TYPE TEXT,
ALTER COLUMN "mood" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "Agent_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AgentSnapshot" DROP CONSTRAINT "AgentSnapshot_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "agentId" SET DATA TYPE TEXT,
ALTER COLUMN "snapshotTime" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "AgentSnapshot_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AgentTrade" DROP CONSTRAINT "AgentTrade_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "agentId" SET DATA TYPE TEXT,
ALTER COLUMN "symbol" SET DATA TYPE TEXT,
ALTER COLUMN "direction" SET DATA TYPE TEXT,
ALTER COLUMN "reason" SET DATA TYPE TEXT,
ALTER COLUMN "marketRegime" SET DATA TYPE TEXT,
ALTER COLUMN "entryTime" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "exitTime" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "status" SET DATA TYPE TEXT,
ADD CONSTRAINT "AgentTrade_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "EvolutionEvent" DROP CONSTRAINT "EvolutionEvent_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "agentId" SET DATA TYPE TEXT,
ALTER COLUMN "eventType" SET DATA TYPE TEXT,
ALTER COLUMN "eventTime" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "EvolutionEvent_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LearningEvent" DROP CONSTRAINT "LearningEvent_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "agentId" SET DATA TYPE TEXT,
ALTER COLUMN "parameterName" SET DATA TYPE TEXT,
ALTER COLUMN "eventTime" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "MarketFrame" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "price" JSONB NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "indicators" JSONB NOT NULL,
    "orderFlow" JSONB NOT NULL,
    "marketMicrostructure" JSONB NOT NULL,

    CONSTRAINT "MarketFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reasoning" JSONB NOT NULL,
    "riskReward" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION NOT NULL,
    "momentumLabel" TEXT,
    "regimeState" TEXT,
    "legacyLabel" TEXT,
    "signalStrengthScore" DOUBLE PRECISION,
    "userId" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "exitTime" TIMESTAMP(3),
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskParams" JSONB NOT NULL,
    "performance" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestResult" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL,
    "finalCapital" DOUBLE PRECISION NOT NULL,
    "performance" JSONB NOT NULL,
    "equityCurve" JSONB NOT NULL,
    "monthlyReturns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,
    "trades" JSONB NOT NULL,

    CONSTRAINT "BacktestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSentiment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "MarketSentiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSummary" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "PortfolioSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeframe" TEXT,
    "symbolCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holdings" JSONB NOT NULL DEFAULT '[]',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sid" TEXT NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "defaultTimeframe" TEXT NOT NULL DEFAULT '1h',
    "defaultExchange" TEXT NOT NULL DEFAULT 'binance',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "priceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "signalAlerts" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "isTestnet" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "lastValidated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanSession" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "exchanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "symbolCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "ScanSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "compositeScore" DOUBLE PRECISION NOT NULL,
    "armSignal" TEXT,
    "armConfidence" DOUBLE PRECISION,
    "marketState" TEXT,
    "stateAlignment" DOUBLE PRECISION,
    "persistenceTicks" INTEGER,
    "confirmationEdge" BOOLEAN DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "volumeChange" DOUBLE PRECISION,
    "change24h" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "macdSignal" DOUBLE PRECISION,
    "ema20" DOUBLE PRECISION,
    "ema50" DOUBLE PRECISION,
    "ema200" DOUBLE PRECISION,
    "atr" DOUBLE PRECISION,
    "bollingerHigh" DOUBLE PRECISION,
    "bollingerLow" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossExchangeSignal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "exchanges" TEXT[],
    "description" TEXT,
    "avgCompositeScore" DOUBLE PRECISION,
    "priceRange" JSONB,
    "volumeMetrics" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossExchangeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerSignalStats" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalScans" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strongBuyCount" INTEGER NOT NULL DEFAULT 0,
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "strongSellCount" INTEGER NOT NULL DEFAULT 0,
    "topExchange" TEXT,
    "trend" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ScannerSignalStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanRun_scanId_key" ON "ScanRun"("scanId");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_symbol_key" ON "Watchlist"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_expire_idx" ON "Session"("expire");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ScanSession_startTime_idx" ON "ScanSession"("startTime");

-- CreateIndex
CREATE INDEX "ScanSession_status_idx" ON "ScanSession"("status");

-- CreateIndex
CREATE INDEX "ScanResult_sessionId_idx" ON "ScanResult"("sessionId");

-- CreateIndex
CREATE INDEX "ScanResult_symbol_idx" ON "ScanResult"("symbol");

-- CreateIndex
CREATE INDEX "ScanResult_exchange_idx" ON "ScanResult"("exchange");

-- CreateIndex
CREATE INDEX "ScanResult_timestamp_idx" ON "ScanResult"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ScanResult_sessionId_symbol_exchange_key" ON "ScanResult"("sessionId", "symbol", "exchange");

-- CreateIndex
CREATE INDEX "CrossExchangeSignal_sessionId_idx" ON "CrossExchangeSignal"("sessionId");

-- CreateIndex
CREATE INDEX "CrossExchangeSignal_symbol_idx" ON "CrossExchangeSignal"("symbol");

-- CreateIndex
CREATE INDEX "CrossExchangeSignal_signalType_idx" ON "CrossExchangeSignal"("signalType");

-- CreateIndex
CREATE INDEX "CrossExchangeSignal_timestamp_idx" ON "CrossExchangeSignal"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerSignalStats_symbol_key" ON "ScannerSignalStats"("symbol");

-- CreateIndex
CREATE INDEX "ScannerSignalStats_symbol_idx" ON "ScannerSignalStats"("symbol");

-- CreateIndex
CREATE INDEX "ScannerSignalStats_lastUpdated_idx" ON "ScannerSignalStats"("lastUpdated");

-- AddForeignKey
ALTER TABLE "BacktestResult" ADD CONSTRAINT "BacktestResult_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrade" ADD CONSTRAINT "AgentTrade_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSnapshot" ADD CONSTRAINT "AgentSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionEvent" ADD CONSTRAINT "EvolutionEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanResult" ADD CONSTRAINT "ScanResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScanSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossExchangeSignal" ADD CONSTRAINT "CrossExchangeSignal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScanSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AgentSnapshot_agent_snapshot_idx" RENAME TO "AgentSnapshot_agentId_snapshotTime_idx";

-- RenameIndex
ALTER INDEX "EvolutionEvent_agent_idx" RENAME TO "EvolutionEvent_agentId_idx";

-- RenameIndex
ALTER INDEX "LearningEvent_agent_idx" RENAME TO "LearningEvent_agentId_idx";
