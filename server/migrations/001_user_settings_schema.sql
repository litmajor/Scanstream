/**
 * Database Schema Migrations for User Settings
 * Run these migrations to set up the necessary tables
 */

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_updated ON user_preferences(updated_at);

-- Trading Settings Table
CREATE TABLE IF NOT EXISTS trading_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trading_settings_updated ON trading_settings(updated_at);

-- Dashboard Settings Table
CREATE TABLE IF NOT EXISTS dashboard_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboard_settings_updated ON dashboard_settings(updated_at);

-- Advanced Settings Table
CREATE TABLE IF NOT EXISTS advanced_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_advanced_settings_updated ON advanced_settings(updated_at);

-- Security Settings Table
CREATE TABLE IF NOT EXISTS security_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_security_settings_updated ON security_settings(updated_at);

-- Login Sessions Table
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_login_sessions_user ON login_sessions(user_id);
CREATE INDEX idx_login_sessions_created ON login_sessions(created_at);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- API Keys Table (Enhanced)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL, -- Should be encrypted in production
  is_testnet BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_exchange ON api_keys(exchange);
CREATE UNIQUE INDEX idx_api_keys_user_exchange_name ON api_keys(user_id, exchange, name);

-- User Audit Trail Table
CREATE TABLE IF NOT EXISTS user_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_trail_user ON user_audit_trail(user_id);
CREATE INDEX idx_audit_trail_timestamp ON user_audit_trail(changed_at);
