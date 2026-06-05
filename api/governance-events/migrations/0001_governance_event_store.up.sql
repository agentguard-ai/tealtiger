-- TealTiger governance event store schema.
-- Phase 1 target: SQLite/libSQL.
-- Phase 2 migration target: PostgreSQL with equivalent text, integer, numeric,
-- and JSON/JSONB column mappings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner TEXT,
  environment TEXT NOT NULL DEFAULT 'development',
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT,
  default_model TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  registered_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status IN ('active', 'inactive', 'archived')),
  CHECK (environment IN ('development', 'staging', 'production'))
);

CREATE TABLE IF NOT EXISTS governance_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  decision TEXT NOT NULL,
  tool TEXT,
  tool_name TEXT,
  provider TEXT,
  model TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  severity TEXT,
  reason TEXT NOT NULL,
  framework TEXT,
  receipt_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (decision IN ('allow', 'deny', 'warn', 'monitor', 'error', 'ALLOW', 'DENY', 'REVISE', 'REQUIRE_APPROVAL', 'WARN', 'MONITOR', 'ERROR')),
  CHECK (cost_usd >= 0),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  input_cost_usd REAL NOT NULL DEFAULT 0,
  output_cost_usd REAL NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  pricing_version TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (request_tokens >= 0),
  CHECK (response_tokens >= 0),
  CHECK (total_tokens >= 0),
  CHECK (total_cost_usd >= 0),
  FOREIGN KEY (event_id) REFERENCES governance_events(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  decision TEXT NOT NULL,
  tool_name TEXT,
  detector TEXT,
  redacted INTEGER NOT NULL DEFAULT 0,
  finding_count INTEGER NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (redacted IN (0, 1)),
  CHECK (finding_count >= 0),
  FOREIGN KEY (event_id) REFERENCES governance_events(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS agent_stats_hourly (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  hour_start INTEGER NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  allow_count INTEGER NOT NULL DEFAULT 0,
  deny_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  security_event_count INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE (agent_id, hour_start),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS cost_summary_daily (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  day_start INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'all',
  model TEXT NOT NULL DEFAULT 'all',
  request_count INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  budget_usd REAL,
  budget_utilization REAL,
  updated_at INTEGER NOT NULL,
  UNIQUE (agent_id, day_start, provider, model),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS compliance_status (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  agent_id TEXT NOT NULL DEFAULT 'all-agents',
  status TEXT NOT NULL,
  evidence_event_id TEXT,
  last_evaluated_at INTEGER NOT NULL,
  next_review_at INTEGER,
  owner TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (framework, control_id, agent_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (evidence_event_id) REFERENCES governance_events(id)
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  policy_key TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  checksum TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  retired_at INTEGER,
  created_by TEXT,
  UNIQUE (policy_key, version),
  CHECK (status IN ('draft', 'active', 'retired'))
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  agent_id TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  threshold_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  notification_target TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (enabled IN (0, 1)),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_agents_status_environment ON agents(status, environment);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON governance_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_agent_timestamp ON governance_events(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_decision_timestamp ON governance_events(decision, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_tool_timestamp ON governance_events(tool, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_tool_name_timestamp ON governance_events(tool_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_severity_timestamp ON governance_events(severity, timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_records_agent_timestamp ON cost_records(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_records_provider_model ON cost_records(provider, model);
CREATE INDEX IF NOT EXISTS idx_cost_records_timestamp ON cost_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_agent_timestamp ON security_events(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type_timestamp ON security_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_decision_timestamp ON security_events(decision, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_tool_timestamp ON security_events(tool_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_stats_hourly_hour ON agent_stats_hourly(hour_start);
CREATE INDEX IF NOT EXISTS idx_cost_summary_daily_day ON cost_summary_daily(day_start);
CREATE INDEX IF NOT EXISTS idx_compliance_status_framework ON compliance_status(framework, status);
CREATE INDEX IF NOT EXISTS idx_compliance_status_next_review ON compliance_status(next_review_at);
CREATE INDEX IF NOT EXISTS idx_policies_key_status ON policies(policy_key, status);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled_type ON alert_rules(enabled, rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_agent ON alert_rules(agent_id);

CREATE TRIGGER IF NOT EXISTS governance_events_no_update
BEFORE UPDATE ON governance_events
BEGIN
  SELECT RAISE(ABORT, 'governance_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS governance_events_no_delete
BEFORE DELETE ON governance_events
BEGIN
  SELECT RAISE(ABORT, 'governance_events is append-only');
END;
