-- Migration: add_rpg_agents (non-destructive)
-- This script creates the RPG Agent system tables if they do not exist.
-- It is intentionally conservative (uses IF NOT EXISTS) and will not drop
-- or alter existing tables.

-- Ensure pgcrypto for gen_random_uuid is available (no-op if already present)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents table
CREATE TABLE IF NOT EXISTS "Agent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL UNIQUE,
  "type" varchar(255) NOT NULL,
  "level" integer NOT NULL DEFAULT 1,
  "xp" integer NOT NULL DEFAULT 0,
  "capital" numeric(15,2),
  "totalProfit" numeric(15,2) NOT NULL DEFAULT 0,
  "winRate" numeric(5,4) NOT NULL DEFAULT 0,
  "profitFactor" numeric(8,4) NOT NULL DEFAULT 0,
  "sharpeRatio" numeric(8,4) NOT NULL DEFAULT 0,
  "confidence" numeric(3,2) NOT NULL DEFAULT 0.5,
  "mood" varchar(64) NOT NULL DEFAULT 'focused',
  "status" varchar(64) NOT NULL DEFAULT 'active',
  "skills" jsonb,
  "abilities" jsonb,
  "parameters" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- AgentTrade table
CREATE TABLE IF NOT EXISTS "AgentTrade" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" uuid NOT NULL,
  "symbol" varchar(255) NOT NULL,
  "direction" varchar(32) NOT NULL,
  "entryPrice" numeric(15,8) NOT NULL,
  "exitPrice" numeric(15,8),
  "positionSize" numeric(15,2) NOT NULL,
  "stopLoss" numeric(15,8),
  "takeProfit" numeric(15,8),
  "profit" numeric(15,2),
  "profitPct" numeric(8,4),
  "confidence" numeric(3,2),
  "reason" varchar(255),
  "marketRegime" varchar(255),
  "entryTime" timestamptz NOT NULL,
  "exitTime" timestamptz,
  "status" varchar(32) NOT NULL DEFAULT 'open',
  CONSTRAINT "AgentTrade_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgentTrade_agentId_idx" ON "AgentTrade" ("agentId");
CREATE INDEX IF NOT EXISTS "AgentTrade_symbol_idx" ON "AgentTrade" ("symbol");
CREATE INDEX IF NOT EXISTS "AgentTrade_entryTime_idx" ON "AgentTrade" ("entryTime");

-- AgentSnapshot table
CREATE TABLE IF NOT EXISTS "AgentSnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" uuid NOT NULL,
  "capital" numeric(15,2) NOT NULL,
  "totalProfit" numeric(15,2) NOT NULL,
  "winRate" numeric(5,4) NOT NULL,
  "profitFactor" numeric(8,4) NOT NULL,
  "sharpeRatio" numeric(8,4) NOT NULL,
  "snapshotTime" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AgentSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgentSnapshot_agent_snapshot_idx" ON "AgentSnapshot" ("agentId", "snapshotTime");

-- LearningEvent table
CREATE TABLE IF NOT EXISTS "LearningEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" uuid NOT NULL,
  "parameterName" varchar(255) NOT NULL,
  "oldValue" text,
  "newValue" text,
  "reason" text,
  "tradesAnalyzed" integer DEFAULT 0,
  "confidence" numeric(3,2),
  "eventTime" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LearningEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningEvent_agent_idx" ON "LearningEvent" ("agentId");

-- EvolutionEvent table
CREATE TABLE IF NOT EXISTS "EvolutionEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" uuid NOT NULL,
  "eventType" varchar(255) NOT NULL,
  "description" text,
  "eventTime" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "EvolutionEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "EvolutionEvent_agent_idx" ON "EvolutionEvent" ("agentId");

-- Create or replace function to update `updatedAt` timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS trigger AS $func$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Ensure trigger exists: drop if present then create (idempotent)
DROP TRIGGER IF EXISTS agent_set_updatedat ON "Agent";
CREATE TRIGGER agent_set_updatedat
  BEFORE UPDATE ON "Agent"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- End of migration
