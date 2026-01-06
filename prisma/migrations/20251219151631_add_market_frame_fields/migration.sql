/*
  Warnings:

  - Added the required column `timeframe` to the `MarketFrame` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entryPrice` to the `Signal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MarketFrame" ADD COLUMN     "close" DOUBLE PRECISION,
ADD COLUMN     "high" DOUBLE PRECISION,
ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "low" DOUBLE PRECISION,
ADD COLUMN     "open" DOUBLE PRECISION,
ADD COLUMN     "timeframe" INTEGER NOT NULL,
ALTER COLUMN "price" SET DEFAULT '{}',
ALTER COLUMN "indicators" SET DEFAULT '{}',
ALTER COLUMN "orderFlow" SET DEFAULT '{}',
ALTER COLUMN "marketMicrostructure" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "entryPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "entryTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "exitPrice" DOUBLE PRECISION,
ADD COLUMN     "exitTimestamp" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primaryPattern" TEXT,
ADD COLUMN     "qualityRating" TEXT,
ADD COLUMN     "qualityScore" DOUBLE PRECISION,
ADD COLUMN     "realizedPnL" DOUBLE PRECISION,
ADD COLUMN     "realizedPnLPercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SignalTrade" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "tradeId" TEXT,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "pnl" DOUBLE PRECISION,
    "pnlPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalPerformanceStats" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "winSignals" INTEGER NOT NULL DEFAULT 0,
    "lossSignals" INTEGER NOT NULL DEFAULT 0,
    "breakevenSignals" INTEGER NOT NULL DEFAULT 0,
    "openSignals" INTEGER NOT NULL DEFAULT 0,
    "notExecutedSignals" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPnLPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patternAccuracy" JSONB NOT NULL DEFAULT '{}',
    "timeframeAccuracy" JSONB NOT NULL DEFAULT '{}',
    "qualityVsWinRate" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalPerformanceStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalTrade_signalId_idx" ON "SignalTrade"("signalId");

-- CreateIndex
CREATE INDEX "SignalTrade_tradeId_idx" ON "SignalTrade"("tradeId");

-- CreateIndex
CREATE INDEX "SignalTrade_outcome_idx" ON "SignalTrade"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "SignalPerformanceStats_symbol_key" ON "SignalPerformanceStats"("symbol");

-- CreateIndex
CREATE INDEX "SignalPerformanceStats_symbol_idx" ON "SignalPerformanceStats"("symbol");

-- CreateIndex
CREATE INDEX "SignalPerformanceStats_lastUpdated_idx" ON "SignalPerformanceStats"("lastUpdated");

-- CreateIndex
CREATE INDEX "MarketFrame_symbol_idx" ON "MarketFrame"("symbol");

-- CreateIndex
CREATE INDEX "MarketFrame_timeframe_idx" ON "MarketFrame"("timeframe");

-- CreateIndex
CREATE INDEX "MarketFrame_timestamp_idx" ON "MarketFrame"("timestamp");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "Signal"("symbol");

-- CreateIndex
CREATE INDEX "Signal_timestamp_idx" ON "Signal"("timestamp");

-- CreateIndex
CREATE INDEX "Signal_outcome_idx" ON "Signal"("outcome");

-- CreateIndex
CREATE INDEX "Signal_entryTimestamp_idx" ON "Signal"("entryTimestamp");

-- CreateIndex
CREATE INDEX "Signal_exitTimestamp_idx" ON "Signal"("exitTimestamp");

-- AddForeignKey
ALTER TABLE "SignalTrade" ADD CONSTRAINT "SignalTrade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
