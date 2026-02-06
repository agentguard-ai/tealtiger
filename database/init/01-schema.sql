-- AI Agent Security Platform Database Schema
-- PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE security_action AS ENUM ('allow', 'deny', 'transform');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE audit_entry_type AS ENUM ('security_decision', 'error', 'info');
CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'suspended', 'unknown');

-- Agents table - Agent registration and metadata
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    owner VARCHAR(255),
    description TEXT,
    capabilities TEXT[], -- Array of capability strings
    risk_profile JSONB,
    status agent_status DEFAULT 'active',
    attestation_status JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE
);

-- Security policies table
CREATE TABLE security_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    language VARCHAR(20) DEFAULT 'json', -- 'json', 'rego', 'cedar'
    content JSONB NOT NULL,
    signature TEXT,
    industry_pack VARCHAR(100),
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiration_date TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
);

-- Audit records table - Security decisions and actions
CREATE TABLE audit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id VARCHAR(255) UNIQUE NOT NULL, -- Original audit ID from application
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    type audit_entry_type NOT NULL,
    agent_id VARCHAR(255),
    request_id VARCHAR(255),
    tool_name VARCHAR(255),
    action security_action,
    reason TEXT,
    risk_level risk_level,
    client_ip INET,
    user_agent TEXT,
    metadata JSONB,
    pqc_seal TEXT, -- Post-Quantum Cryptography seal (future)
    compliance_flags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to agents table
    CONSTRAINT fk_audit_agent FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE SET NULL
);

-- OAuth tokens table - Token metadata and status
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL,
    resource_indicators TEXT[],
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to agents table
    CONSTRAINT fk_token_agent FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

-- Compliance mappings table - Framework-specific requirements
CREATE TABLE compliance_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework VARCHAR(100) NOT NULL, -- 'GDPR', 'HIPAA', 'SOC2', 'EU_AI_ACT', etc.
    requirement_id VARCHAR(255) NOT NULL,
    requirement_text TEXT,
    policy_mapping JSONB, -- Maps to security policies
    audit_requirements JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(framework, requirement_id)
);

-- Create indexes for performance
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_active ON agents(last_active);

CREATE INDEX idx_policies_name_version ON security_policies(name, version);
CREATE INDEX idx_policies_active ON security_policies(is_active);
CREATE INDEX idx_policies_effective_date ON security_policies(effective_date);

CREATE INDEX idx_audit_timestamp ON audit_records(timestamp);
CREATE INDEX idx_audit_agent_id ON audit_records(agent_id);
CREATE INDEX idx_audit_type ON audit_records(type);
CREATE INDEX idx_audit_action ON audit_records(action);
CREATE INDEX idx_audit_risk_level ON audit_records(risk_level);
CREATE INDEX idx_audit_request_id ON audit_records(request_id);

CREATE INDEX idx_tokens_agent_id ON oauth_tokens(agent_id);
CREATE INDEX idx_tokens_active ON oauth_tokens(is_active);
CREATE INDEX idx_tokens_expires_at ON oauth_tokens(expires_at);

CREATE INDEX idx_compliance_framework ON compliance_mappings(framework);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON security_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_updated_at BEFORE UPDATE ON compliance_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default agent for testing
INSERT INTO agents (agent_id, name, version, owner, description, capabilities, status)
VALUES (
    'test-agent-001',
    'Test Agent',
    '1.0.0',
    'development',
    'Default test agent for development and testing',
    ARRAY['file-read', 'web-search', 'api-call'],
    'active'
);

-- Insert default security policies
INSERT INTO security_policies (name, version, description, content, is_active) VALUES
('default-allow-policy', '1.0.0', 'Default policy that allows low-risk operations', 
 '{"rules": [{"condition": {"risk_level": "low"}, "action": "allow", "reason": "Low risk operation approved"}]}', true),

('high-risk-deny-policy', '1.0.0', 'Policy that denies high and critical risk operations',
 '{"rules": [{"condition": {"risk_level": ["high", "critical"]}, "action": "deny", "reason": "High risk operation blocked"}]}', true),

('file-write-transform-policy', '1.0.0', 'Policy that transforms file write operations to read-only',
 '{"rules": [{"condition": {"tool_name": "file-write"}, "action": "transform", "reason": "File write transformed to read-only", "transformation": {"type": "read_only"}}]}', true);

COMMENT ON TABLE agents IS 'Registered AI agents with metadata and status';
COMMENT ON TABLE security_policies IS 'Security policies for agent action evaluation';
COMMENT ON TABLE audit_records IS 'Comprehensive audit trail of all security decisions';
COMMENT ON TABLE oauth_tokens IS 'OAuth 2.0 token lifecycle and metadata';
COMMENT ON TABLE compliance_mappings IS 'Regulatory framework compliance mappings';