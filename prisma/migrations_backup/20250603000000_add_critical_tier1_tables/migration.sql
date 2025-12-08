
-- Add signalId foreign key to trades table
ALTER TABLE trades ADD COLUMN signal_id UUID;

-- Create audit_logs table for decision trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT,
  details JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO'
);

-- Create model_metrics table for ML drift detection
CREATE TABLE IF NOT EXISTS model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT now(),
  accuracy REAL,
  precision REAL,
  recall REAL,
  drift_score REAL,
  data_points INTEGER,
  is_stale BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_model_metrics_name_ts ON model_metrics(model_name, timestamp DESC);
