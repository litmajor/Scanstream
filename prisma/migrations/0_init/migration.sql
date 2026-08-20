-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "MarketFrame" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "timeframe" INTEGER NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "price" JSONB NOT NULL DEFAULT '{}',
    "indicators" JSONB NOT NULL DEFAULT '{}',
    "orderFlow" JSONB NOT NULL DEFAULT '{}',
    "marketMicrostructure" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MarketFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "correlationId" TEXT,
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
    "entryTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitTimestamp" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "outcome" TEXT,
    "realizedPnL" DOUBLE PRECISION,
    "realizedPnLPercent" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "primaryPattern" TEXT,
    "patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualityScore" DOUBLE PRECISION,
    "qualityRating" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "TradeProvenance" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT,
    "engine" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "correlationId" TEXT,
    "signalId" TEXT,
    "signal" JSONB,
    "consensus" JSONB,
    "agentDecision" JSONB,
    "execution" JSONB,
    "extra" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeProvenance_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "DecisionEvent" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "phase" TEXT NOT NULL,
    "domain" TEXT,
    "actionPayload" JSONB,
    "metrics" JSONB,
    "agentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleVersion" TEXT,
    "marketFrameId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extra" JSONB DEFAULT '{}',

    CONSTRAINT "DecisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionSnapshot" (
    "id" TEXT NOT NULL,
    "traceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agents" JSONB NOT NULL DEFAULT '[]',
    "contributions" JSONB NOT NULL DEFAULT '{}',
    "policyOutputs" JSONB DEFAULT '{}',
    "positionSizing" JSONB DEFAULT '{}',
    "marketFrameId" TEXT,
    "worldTime" TIMESTAMP(3),
    "moduleVersion" TEXT,
    "extra" JSONB DEFAULT '{}',

    CONSTRAINT "DecisionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAudit" (
    "id" TEXT NOT NULL,
    "traceId" TEXT,
    "orderId" TEXT,
    "exchange" TEXT,
    "venue" TEXT,
    "params" JSONB DEFAULT '{}',
    "preBalances" JSONB DEFAULT '{}',
    "reservationAmounts" JSONB DEFAULT '{}',
    "fills" JSONB DEFAULT '[]',
    "simulatedSlippage" DOUBLE PRECISION,
    "realSlippage" DOUBLE PRECISION,
    "realizedPnl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAudit_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "capital" DECIMAL(15,2),
    "totalProfit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "profitFactor" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "sharpeRatio" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "mood" TEXT NOT NULL DEFAULT 'focused',
    "status" TEXT NOT NULL DEFAULT 'active',
    "skills" JSONB,
    "abilities" JSONB,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTrade" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryPrice" DECIMAL(15,8) NOT NULL,
    "exitPrice" DECIMAL(15,8),
    "positionSize" DECIMAL(15,2) NOT NULL,
    "stopLoss" DECIMAL(15,8),
    "takeProfit" DECIMAL(15,8),
    "profit" DECIMAL(15,2),
    "profitPct" DECIMAL(8,4),
    "confidence" DECIMAL(3,2),
    "reason" TEXT,
    "marketRegime" TEXT,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "exitTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "AgentTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSnapshot" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "capital" DECIMAL(15,2) NOT NULL,
    "totalProfit" DECIMAL(15,2) NOT NULL,
    "winRate" DECIMAL(5,4) NOT NULL,
    "profitFactor" DECIMAL(8,4) NOT NULL,
    "sharpeRatio" DECIMAL(8,4) NOT NULL,
    "snapshotTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "tradesAnalyzed" INTEGER DEFAULT 0,
    "confidence" DECIMAL(3,2),
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvolutionEvent_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "ModelArtifact" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "version" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageUri" TEXT,
    "blob" BYTEA,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ModelArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCheckpoint" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT,
    "modelName" TEXT,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ModelCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RlQTable" (
    "id" TEXT NOT NULL,
    "domain" TEXT,
    "regime" TEXT,
    "stateKey" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "qValue" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RlQTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RlExperience" (
    "id" TEXT NOT NULL,
    "domain" TEXT,
    "regime" TEXT,
    "state" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "reward" DOUBLE PRECISION,
    "nextState" JSONB,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "RlExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusteringResult" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "parameters" JSONB DEFAULT '{}',
    "clusters" JSONB DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ClusteringResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelMetric" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accuracy" DOUBLE PRECISION,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "driftScore" DOUBLE PRECISION,
    "dataPoints" INTEGER DEFAULT 0,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ModelMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketFrame_symbol_idx" ON "MarketFrame"("symbol");

-- CreateIndex
CREATE INDEX "MarketFrame_timeframe_idx" ON "MarketFrame"("timeframe");

-- CreateIndex
CREATE INDEX "MarketFrame_timestamp_idx" ON "MarketFrame"("timestamp");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "Signal"("symbol");

-- CreateIndex
CREATE INDEX "Signal_correlationId_idx" ON "Signal"("correlationId");

-- CreateIndex
CREATE INDEX "Signal_timestamp_idx" ON "Signal"("timestamp");

-- CreateIndex
CREATE INDEX "Signal_outcome_idx" ON "Signal"("outcome");

-- CreateIndex
CREATE INDEX "Signal_entryTimestamp_idx" ON "Signal"("entryTimestamp");

-- CreateIndex
CREATE INDEX "Signal_exitTimestamp_idx" ON "Signal"("exitTimestamp");

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
CREATE INDEX "TradeProvenance_tradeId_idx" ON "TradeProvenance"("tradeId");

-- CreateIndex
CREATE INDEX "TradeProvenance_signalId_idx" ON "TradeProvenance"("signalId");

-- CreateIndex
CREATE INDEX "TradeProvenance_symbol_idx" ON "TradeProvenance"("symbol");

-- CreateIndex
CREATE INDEX "DecisionEvent_correlationId_idx" ON "DecisionEvent"("correlationId");

-- CreateIndex
CREATE INDEX "DecisionEvent_timestamp_idx" ON "DecisionEvent"("timestamp");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_traceId_idx" ON "DecisionSnapshot"("traceId");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_marketFrameId_idx" ON "DecisionSnapshot"("marketFrameId");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_timestamp_idx" ON "DecisionSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "OrderAudit_traceId_idx" ON "OrderAudit"("traceId");

-- CreateIndex
CREATE INDEX "OrderAudit_orderId_idx" ON "OrderAudit"("orderId");

-- CreateIndex
CREATE INDEX "OrderAudit_exchange_idx" ON "OrderAudit"("exchange");

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
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

-- CreateIndex
CREATE INDEX "AgentTrade_agentId_idx" ON "AgentTrade"("agentId");

-- CreateIndex
CREATE INDEX "AgentTrade_symbol_idx" ON "AgentTrade"("symbol");

-- CreateIndex
CREATE INDEX "AgentTrade_entryTime_idx" ON "AgentTrade"("entryTime");

-- CreateIndex
CREATE INDEX "AgentSnapshot_agentId_snapshotTime_idx" ON "AgentSnapshot"("agentId", "snapshotTime");

-- CreateIndex
CREATE INDEX "LearningEvent_agentId_idx" ON "LearningEvent"("agentId");

-- CreateIndex
CREATE INDEX "EvolutionEvent_agentId_idx" ON "EvolutionEvent"("agentId");

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

-- CreateIndex
CREATE INDEX "ModelArtifact_modelName_idx" ON "ModelArtifact"("modelName");

-- CreateIndex
CREATE INDEX "ModelCheckpoint_modelName_idx" ON "ModelCheckpoint"("modelName");

-- CreateIndex
CREATE INDEX "RlQTable_stateKey_idx" ON "RlQTable"("stateKey");

-- CreateIndex
CREATE UNIQUE INDEX "RlQTable_domain_regime_stateKey_actionKey_key" ON "RlQTable"("domain", "regime", "stateKey", "actionKey");

-- CreateIndex
CREATE INDEX "RlExperience_domain_idx" ON "RlExperience"("domain");

-- CreateIndex
CREATE INDEX "ClusteringResult_algorithm_idx" ON "ClusteringResult"("algorithm");

-- CreateIndex
CREATE INDEX "ModelMetric_modelName_timestamp_idx" ON "ModelMetric"("modelName", "timestamp");

-- AddForeignKey
ALTER TABLE "SignalTrade" ADD CONSTRAINT "SignalTrade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "ModelArtifact" ADD CONSTRAINT "ModelArtifact_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelCheckpoint" ADD CONSTRAINT "ModelCheckpoint_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ModelArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusteringResult" ADD CONSTRAINT "ClusteringResult_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

