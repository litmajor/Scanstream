-- ============================================================================
-- PHASE 5: FRONTEND VISUALIZATION & TRANSPARENCY SCHEMA
-- ============================================================================
-- Tables for storing signal history, agent performance, and market regime data
-- for real-time dashboard visualization

-- Signal History Table
-- Stores all generated trading signals with entry/exit prices, P&L, and quality scores
CREATE TABLE IF NOT EXISTS signal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  entry_price DECIMAL(10, 4),
  exit_price DECIMAL(10, 4),
  profit_loss DECIMAL(12, 4),
  profit_loss_percent DECIMAL(6, 2),
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  confidence_level INTEGER CHECK (confidence_level >= 0 AND confidence_level <= 100),
  signal_source VARCHAR(20) CHECK (signal_source IN ('SCANNER', 'ML', 'RL', 'RPG')),
  status VARCHAR(20) CHECK (status IN ('open', 'closed', 'cancelled')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_outcome VARCHAR(20) CHECK (actual_outcome IN ('WIN', 'LOSS', 'BREAK_EVEN')),
  prediction_accuracy BOOLEAN,
  duration_minutes INTEGER,
  reasoning TEXT,
  method_breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_signal_history_timestamp ON signal_history(timestamp DESC);
CREATE INDEX idx_signal_history_source ON signal_history(signal_source);
CREATE INDEX idx_signal_history_status ON signal_history(status);
CREATE INDEX idx_signal_history_symbol ON signal_history(symbol);
CREATE INDEX idx_signal_history_quality ON signal_history(quality_score DESC);

-- Agent Performance Table
-- Tracks real-time metrics for all 5 RPG trading agents
CREATE TABLE IF NOT EXISTS agent_performance (
  agent_id VARCHAR(50) PRIMARY KEY,
  agent_name VARCHAR(100) NOT NULL,
  strategy VARCHAR(50) NOT NULL CHECK (strategy IN (
    'TREND_FOLLOWING', 'MEAN_REVERSION', 'MOMENTUM', 'BREAKOUT', 'VOLATILITY'
  )),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  sharpe_ratio DECIMAL(5, 2),
  max_drawdown DECIMAL(5, 2),
  profit_factor DECIMAL(5, 2),
  active_signals INTEGER DEFAULT 0,
  last_active_time TIMESTAMPTZ,
  achievements TEXT[],
  performance_trend VARCHAR(20) CHECK (performance_trend IN ('up', 'down', 'stable')),
  status VARCHAR(20) CHECK (status IN ('active', 'learning', 'paused', 'inactive')),
  rank INTEGER,
  win_rate_percent DECIMAL(5, 2),
  avg_profit_loss DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_agent_performance_rank ON agent_performance(rank);
CREATE INDEX idx_agent_performance_status ON agent_performance(status);
CREATE INDEX idx_agent_performance_updated ON agent_performance(updated_at DESC);

-- Market Regime Table
-- Tracks current market regime detection and adaptive signal weights
CREATE TABLE IF NOT EXISTS market_regime (
  id SERIAL PRIMARY KEY,
  current_regime VARCHAR(50) NOT NULL CHECK (current_regime IN (
    'TRENDING_UP', 'TRENDING_DOWN', 'RANGE_BOUND', 'VOLATILE', 'CHOPPY'
  )),
  regime_confidence DECIMAL(5, 2) CHECK (regime_confidence >= 0 AND regime_confidence <= 100),
  scanner_weight DECIMAL(3, 2),
  ml_weight DECIMAL(3, 2),
  rl_weight DECIMAL(3, 2),
  rpg_weight DECIMAL(3, 2),
  volatility_level DECIMAL(5, 2),
  trend_strength DECIMAL(5, 2),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast regime lookups
CREATE INDEX idx_market_regime_timestamp ON market_regime(timestamp DESC);
CREATE INDEX idx_market_regime_regime ON market_regime(current_regime);

-- Regime Transitions Table
-- Tracks when market regime changes occur for historical analysis
CREATE TABLE IF NOT EXISTS regime_transitions (
  id SERIAL PRIMARY KEY,
  from_regime VARCHAR(50) NOT NULL,
  to_regime VARCHAR(50) NOT NULL,
  confidence DECIMAL(5, 2),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for transition history
CREATE INDEX idx_regime_transitions_timestamp ON regime_transitions(timestamp DESC);

-- Signal Source Metrics Table
-- Tracks per-source metrics (win rate, avg P&L, trade count, confidence) for weighting decisions
CREATE TABLE IF NOT EXISTS signal_source_metrics (
  signal_source VARCHAR(20) PRIMARY KEY CHECK (signal_source IN ('SCANNER', 'ML', 'RL', 'RPG')),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  avg_win DECIMAL(10, 4),
  avg_loss DECIMAL(10, 4),
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('high', 'medium', 'low')),
  weight_multiplier DECIMAL(3, 2),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Budget Tracking Table
-- Tracks daily P&L for position sizing daily risk budget enforcement
CREATE TABLE IF NOT EXISTS daily_risk_budget (
  id SERIAL PRIMARY KEY,
  trading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cumulative_pnl DECIMAL(12, 4),
  budget_cap DECIMAL(12, 4),
  budget_used_percent DECIMAL(5, 2),
  budget_status VARCHAR(20) CHECK (budget_status IN ('safe', 'caution', 'exceeded')),
  trades_today INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Index for daily lookups
CREATE INDEX idx_daily_budget_date ON daily_risk_budget(trading_date DESC);

-- Grant permissions for API access
GRANT SELECT, INSERT, UPDATE ON signal_history TO public;
GRANT SELECT, INSERT, UPDATE ON agent_performance TO public;
GRANT SELECT, INSERT ON market_regime TO public;
GRANT SELECT, INSERT ON regime_transitions TO public;
GRANT SELECT ON signal_source_metrics TO public;
GRANT SELECT, INSERT, UPDATE ON daily_risk_budget TO public;

-- ============================================================================
-- VIEWS FOR DASHBOARD QUERIES
-- ============================================================================

-- Recent Signal Activity View
CREATE OR REPLACE VIEW recent_signals AS
SELECT 
  id,
  symbol,
  entry_price,
  exit_price,
  profit_loss,
  quality_score,
  confidence_level,
  signal_source,
  status,
  timestamp,
  actual_outcome
FROM signal_history
WHERE timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

-- Agent Performance Summary View
CREATE OR REPLACE VIEW agent_summary AS
SELECT 
  agent_id,
  agent_name,
  strategy,
  rank,
  ROUND((winning_trades::NUMERIC / NULLIF(total_trades, 0)) * 100, 1) as win_rate,
  sharpe_ratio,
  max_drawdown,
  profit_factor,
  status,
  performance_trend,
  last_active_time
FROM agent_performance
ORDER BY rank ASC;

-- Signal Quality Correlation View
CREATE OR REPLACE VIEW quality_accuracy_correlation AS
SELECT 
  FLOOR(quality_score / 10) * 10 as quality_bucket,
  COUNT(*) as total_signals,
  SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
  ROUND((SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as win_rate,
  ROUND(AVG(profit_loss), 2) as avg_pnl
FROM signal_history
WHERE status = 'closed' AND actual_outcome IS NOT NULL
GROUP BY FLOOR(quality_score / 10)
ORDER BY quality_bucket ASC;

-- Signal Accuracy Statistics View
CREATE OR REPLACE VIEW signal_accuracy_stats AS
SELECT 
  COUNT(*) as total_signals,
  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_signals,
  SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END) as winning_signals,
  ROUND((SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END)::NUMERIC / 
          NULLIF(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0)) * 100, 1) as win_rate,
  ROUND(AVG(profit_loss), 2) as avg_pnl,
  ROUND(AVG(quality_score), 1) as avg_quality,
  ROUND(AVG(confidence_level), 1) as avg_confidence
FROM signal_history
WHERE timestamp >= NOW() - INTERVAL '30 days';
