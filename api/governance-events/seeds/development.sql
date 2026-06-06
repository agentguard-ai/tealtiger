INSERT INTO agents (
  id, external_id, name, owner, environment, status, provider, default_model,
  metadata_json, registered_at, updated_at
) VALUES (
  'agent_checkout_v1',
  'checkout-agent',
  'Checkout Agent',
  'platform-security',
  'development',
  'active',
  'openai',
  'gpt-4o',
  '{"team":"commerce","tier":"demo"}',
  1761912000000,
  1761912000000
);

INSERT INTO policies (
  id, policy_key, version, status, checksum, policy_json, created_at,
  activated_at, created_by
) VALUES (
  'policy_default_v1',
  'default-governance',
  '1.0.0',
  'active',
  'sha256:demo',
  '{"guardrails":{"piiDetection":true,"promptInjection":true},"budget":{"maxCostPerRequest":0.5}}',
  1761912000000,
  1761912000000,
  'seed'
);

INSERT INTO governance_events (
  id, timestamp, agent_id, agent_name, decision, tool, provider, model,
  cost_usd, severity, reason, framework, receipt_json, metadata_json
) VALUES (
  'evt_checkout_allow_001',
  1761912060000,
  'agent_checkout_v1',
  'Checkout Agent',
  'allow',
  'create_order',
  'openai',
  'gpt-4o',
  0.0142,
  'low',
  'Policy checks passed',
  'SOC2',
  '{"receiptId":"evt_checkout_allow_001","policy":"default-governance@1.0.0"}',
  '{"correlationId":"corr-demo-001"}'
);

INSERT INTO cost_records (
  id, event_id, agent_id, timestamp, provider, model, request_tokens,
  response_tokens, total_tokens, input_cost_usd, output_cost_usd,
  total_cost_usd, currency, pricing_version, metadata_json
) VALUES (
  'cost_checkout_001',
  'evt_checkout_allow_001',
  'agent_checkout_v1',
  1761912060000,
  'openai',
  'gpt-4o',
  320,
  180,
  500,
  0.008,
  0.0062,
  0.0142,
  'USD',
  '2026-05',
  '{}'
);

INSERT INTO security_events (
  id, event_id, agent_id, timestamp, event_type, severity, decision, tool_name,
  detector, redacted, finding_count, evidence_json, metadata_json
) VALUES (
  'sec_checkout_001',
  'evt_checkout_allow_001',
  'agent_checkout_v1',
  1761912060000,
  'pii_scan',
  'low',
  'allow',
  'create_order',
  'tealguard.pii',
  0,
  0,
  '{"matches":[]}',
  '{}'
);

INSERT INTO agent_stats_hourly (
  id, agent_id, hour_start, event_count, allow_count, deny_count, warn_count,
  security_event_count, total_cost_usd, total_tokens, updated_at
) VALUES (
  'stats_agent_checkout_20251031_1200',
  'agent_checkout_v1',
  1761912000000,
  1,
  1,
  0,
  0,
  1,
  0.0142,
  500,
  1761912060000
);

INSERT INTO cost_summary_daily (
  id, agent_id, day_start, provider, model, request_count, total_cost_usd,
  total_tokens, budget_usd, budget_utilization, updated_at
) VALUES (
  'cost_day_checkout_20251031_openai_gpt4o',
  'agent_checkout_v1',
  1761868800000,
  'openai',
  'gpt-4o',
  1,
  0.0142,
  500,
  25.0,
  0.000568,
  1761912060000
);

INSERT INTO compliance_status (
  id, framework, control_id, agent_id, status, evidence_event_id,
  last_evaluated_at, next_review_at, owner, notes, metadata_json
) VALUES (
  'soc2_cc6_checkout',
  'SOC2',
  'CC6.1',
  'agent_checkout_v1',
  'passing',
  'evt_checkout_allow_001',
  1761912060000,
  1764504000000,
  'platform-security',
  'Demo seeded evidence for access-control governance checks.',
  '{}'
);

INSERT INTO alert_rules (
  id, name, rule_type, agent_id, severity, threshold_json, enabled,
  notification_target, created_at, updated_at
) VALUES (
  'alert_checkout_daily_budget',
  'Checkout daily budget warning',
  'cost_budget',
  'agent_checkout_v1',
  'medium',
  '{"window":"day","thresholdPct":80}',
  1,
  'security-ops',
  1761912000000,
  1761912000000
);
