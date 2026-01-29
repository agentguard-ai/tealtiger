# Phase 1A: Core Foundation - Setup Guide

This guide will help you set up and run the Phase 1A core foundation of the AI Agent Security Platform.

## 🎯 What We Built

**Phase 1A delivers:**
- ✅ **Security Sidecar Agent** - HTTP API for security evaluation
- ✅ **Policy Engine** - JSON-based rule evaluation with risk assessment
- ✅ **Audit Logger** - Decision logging and compliance trail
- ✅ **Basic Authentication** - API key validation middleware
- ✅ **Shadow Agent Discovery** - Basic network scanning and agent detection
- ✅ **Example Agent** - Shows how to integrate
- ✅ **Advanced Analysis** - Trace analyzer for prompt injection detection (experimental)

### Key Features

**1. Risk-Based Policy Evaluation**
- Automatic risk assessment (critical/high/medium/low)
- Pattern-based tool name analysis
- Sensitive parameter detection
- Configurable policy rules in JSON

**2. Three Action Types**
- **Allow**: Safe operations proceed normally
- **Deny**: Dangerous operations are blocked
- **Transform**: Risky operations are modified for safety
  - Convert write → read operations
  - Anonymize sensitive parameters
  - Filter dangerous inputs

**3. Comprehensive Audit Trail**
- Every decision is logged with full context
- In-memory storage + file-based persistence
- Audit trail per agent for compliance
- Security statistics and analytics

**4. Developer-Friendly API**
- Simple REST API with JSON
- Clear request/response format
- Detailed error messages
- API key authentication

**5. Shadow Agent Discovery (Basic)**
- Network scanning for agent processes
- AI API call pattern detection
- Agent fingerprinting and classification
- Basic agent registry and inventory

**6. Advanced Capabilities (Experimental)**
- Execution trace analysis
- Program graph construction (CFG, DFG, PDG)
- Prompt injection detection
- Control flow anomaly detection

## 🛠️ Prerequisites

Before you start, install these tools:

### 1. Node.js (Required)
- **Download**: https://nodejs.org/
- **Version**: 18.x or 20.x LTS
- **Verify**: `node --version` should show v18+ or v20+

### 2. Docker Desktop (Optional but recommended)
- **Download**: https://docker.com/products/docker-desktop/
- **Purpose**: For PostgreSQL database (future phases)
- **Verify**: `docker --version` should work

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
# Install main application dependencies
npm install

# Install example dependencies
cd examples
npm install
cd ..
```

### Step 2: Start the Security API
```bash
# Start the Security Sidecar Agent
npm start

# Or for development with auto-reload
npm run dev
```

You should see:
```
🚀 AI Agent Security Platform running on port 3001
📊 Health check: http://localhost:3001/health
🔒 Security API: http://localhost:3001/api/security
✅ Policy Engine initialized
```

### Step 3: Test the API
```bash
# Check health
curl http://localhost:3001/health

# Test security evaluation
curl -X POST http://localhost:3001/api/security/evaluate \
  -H "X-API-Key: test-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-agent",
    "toolName": "web-search",
    "parameters": {"query": "AI security"}
  }'
```

### Step 4: Run Example Agent
```bash
# Run the simple agent example
cd examples
node simple-agent.js
```

## 📋 API Endpoints

### Core Security API

**POST /api/security/evaluate**
- **Purpose**: Evaluate agent tool calls for security
- **Auth**: X-API-Key header required
- **Body**: `{ agentId, toolName, parameters, context? }`
- **Response**: `{ success, decision: { action, reason, riskLevel } }`

**GET /api/security/policies**
- **Purpose**: Get current security policies
- **Auth**: X-API-Key header required
- **Response**: `{ success, policies }`

**GET /api/security/audit/:agentId**
- **Purpose**: Get audit trail for agent
- **Auth**: X-API-Key header required
- **Response**: `{ success, auditTrail }`

### Utility Endpoints

**GET /health**
- **Purpose**: Health check
- **Auth**: None required
- **Response**: `{ status: "healthy", service, version }`

## 🔒 Security Policies

The system comes with 8 default policies in `src/config/policies.json`:

### Policy Evaluation Flow

```
Request → Risk Assessment → Policy Matching → Action Decision
```

### Default Policies (Priority Order)

| Priority | Policy Name | Conditions | Action | Description |
|----------|-------------|------------|--------|-------------|
| 1 | **deny-critical-operations** | risk_level >= critical | deny | Block all critical risk operations |
| 2 | **deny-system-commands** | tool_name contains "system" | deny | Block system command execution |
| 3 | **transform-file-write** | tool_name contains "write" + risk <= high | transform | Convert write → read operations |
| 4 | **anonymize-sensitive-data** | parameter exists: "password" | transform | Remove passwords/tokens/secrets |
| 5 | **allow-read-operations** | tool_name contains "read" + risk <= medium | allow | Allow safe read operations |
| 6 | **allow-search-operations** | tool_name contains "search" | allow | Allow web searches |
| 7 | **allow-low-risk** | risk_level == low | allow | Allow all low risk operations |
| 8 | **require-approval-high-risk** | risk_level == high | deny | High risk needs approval (future) |

### Risk Assessment Logic

The Policy Engine automatically assesses risk based on:

**Critical Risk Tools:**
- system-admin, user-impersonation, credential-write
- security-bypass, privilege-escalation

**High Risk Tools:**
- file-write, file-delete, system-command
- database-write, external-api-call, credential-access

**Sensitive Parameters:**
- password, token, key, secret, credential

**Default:** Medium risk for unknown tools

### Policy Condition Types

```javascript
// Tool name pattern matching
{ type: "tool_name", pattern: "*search*" }

// Risk level comparison
{ type: "risk_level", operator: ">=", value: "high" }

// Agent ID matching
{ type: "agent_id", pattern: "agent-*" }

// Parameter existence check
{ type: "parameter_exists", parameter: "password" }

// Parameter value check
{ type: "parameter_value", parameter: "mode", value: "admin" }
```

### Transformation Types

```javascript
// Convert write operations to read-only
{
  type: "read_only"
}

// Remove sensitive parameters
{
  type: "parameter_filter",
  remove_parameters: ["password", "token"]
}

// Anonymize sensitive data
{
  type: "parameter_anonymize",
  anonymize_parameters: ["password", "secret"]
}
```

### Example Policy Evaluation

**Request:**
```json
{
  "agentId": "agent-123",
  "toolName": "web-search",
  "parameters": { "query": "AI security" }
}
```

**Evaluation:**
1. Risk Assessment: `low` (search operation, no sensitive params)
2. Policy Matching: Matches "allow-search-operations" (priority 6)
3. Decision: `allow` with reason "Search operation approved - minimal security risk"

**Request:**
```json
{
  "agentId": "agent-123",
  "toolName": "system-command",
  "parameters": { "cmd": "rm -rf /" }
}
```

**Evaluation:**
1. Risk Assessment: `critical` (system command)
2. Policy Matching: Matches "deny-system-commands" (priority 2)
3. Decision: `deny` with reason "System commands are not allowed for security reasons"

## 🧪 Testing

### Run Unit Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Manual Testing
```bash
# Test different scenarios
curl -X POST http://localhost:3001/api/security/evaluate \
  -H "X-API-Key: test-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "test", "toolName": "system-command", "parameters": {"cmd": "ls"}}'
# Should return: action: "deny"

curl -X POST http://localhost:3001/api/security/evaluate \
  -H "X-API-Key: test-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "test", "toolName": "web-search", "parameters": {"query": "test"}}'
# Should return: action: "allow"
```

## 🏗️ Architecture Overview

Phase 1A implements a **Security Sidecar Agent (SSA)** pattern that mediates all agent tool/API calls through a centralized security evaluation service.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI AGENT (Client)                            │
│                    examples/simple-agent.js                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP POST /api/security/evaluate
                             │ Headers: X-API-Key
                             │ Body: { agentId, toolName, parameters }
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY SIDECAR AGENT (SSA)                      │
│                         src/app.js                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Express Server (Port 3001)                                    │  │
│  │  • Helmet (Security Headers)                                   │  │
│  │  • CORS (Cross-Origin)                                         │  │
│  │  • Rate Limiting (1000 req/15min)                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                                  │
│                src/middleware/validation.js                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐    │
│  │  authenticateAgent   │  │    validateRequest               │    │
│  │  • Check X-API-Key   │  │    • Validate agentId            │    │
│  │  • Min length: 10    │  │    • Validate toolName           │    │
│  │  • Extract agent ID  │  │    • Validate parameters         │    │
│  └──────────────────────┘  └──────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ROUTING LAYER                                   │
│                   src/routes/security.js                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  POST /api/security/evaluate    → Main security evaluation    │  │
│  │  GET  /api/security/policies    → Get current policies        │  │
│  │  POST /api/security/policies/validate → Validate policies     │  │
│  │  GET  /api/security/audit/:id   → Get audit trail             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CORE SECURITY ENGINE                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              POLICY ENGINE                                    │  │
│  │           src/core/policyEngine.js                            │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  1. Risk Assessment                                     │  │  │
│  │  │     • Analyze toolName (critical/high/medium/low)       │  │  │
│  │  │     • Check for sensitive parameters                    │  │  │
│  │  │     • Calculate risk level                              │  │  │
│  │  │                                                          │  │  │
│  │  │  2. Policy Evaluation                                   │  │  │
│  │  │     • Load policies from src/config/policies.json       │  │  │
│  │  │     • Match conditions (tool_name, risk_level, etc.)    │  │  │
│  │  │     • Apply policy actions (allow/deny/transform)       │  │  │
│  │  │                                                          │  │  │
│  │  │  3. Transformation (if needed)                          │  │  │
│  │  │     • read_only: Convert write → read                   │  │  │
│  │  │     • parameter_filter: Remove sensitive params         │  │  │
│  │  │     • parameter_anonymize: Mask sensitive data          │  │  │
│  │  │                                                          │  │  │
│  │  │  4. Decision Generation                                 │  │  │
│  │  │     • action: allow/deny/transform                      │  │  │
│  │  │     • reason: Human-readable explanation                │  │  │
│  │  │     • riskLevel: critical/high/medium/low               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AUDIT LOGGER                                     │  │
│  │           src/core/auditLogger.js                             │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  • Log all security decisions                          │  │  │
│  │  │  • Store in-memory (MVP) + file (src/logs/audit.log)   │  │  │
│  │  │  • Track: timestamp, agentId, action, reason, risk     │  │  │
│  │  │  • Generate audit trail for compliance                 │  │  │
│  │  │  • Provide security statistics                         │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         ENHANCED CAPABILITIES (Advanced)                      │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  enhancedAuditLogger.js                                │  │  │
│  │  │  • Integrates trace analysis with audit logging        │  │  │
│  │  │  • Stores execution traces for learning                │  │  │
│  │  │  • Provides advanced analytics                         │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  traceAnalyzer.js                                      │  │  │
│  │  │  • Program analysis for execution traces               │  │  │
│  │  │  • Builds CFG, DFG, PDG graphs                         │  │  │
│  │  │  • Detects prompt injection patterns                   │  │  │
│  │  │  • Analyzes control flow anomalies                     │  │  │
│  │  │  • Tracks sensitive data flow                          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION & STORAGE                           │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐    │
│  │  src/config/         │  │  src/logs/                       │    │
│  │  • config.js         │  │  • audit.log (file-based)        │    │
│  │  • policies.json     │  │  • In-memory storage (MVP)       │    │
│  └──────────────────────┘  └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
1. Agent Request
   └─> AI Agent calls SSA API with tool request
       POST /api/security/evaluate
       { agentId: "agent-123", toolName: "web-search", parameters: {...} }

2. Authentication & Validation
   └─> Middleware validates API key and request format
       • authenticateAgent: Check X-API-Key header
       • validateRequest: Validate required fields

3. Security Evaluation
   └─> Policy Engine evaluates request
       a) Risk Assessment
          • Analyze tool name for risk patterns
          • Check parameters for sensitive data
          • Assign risk level: critical/high/medium/low
       
       b) Policy Matching
          • Load policies from policies.json
          • Evaluate conditions against request
          • Find first matching policy
       
       c) Action Decision
          • allow: Request is safe, proceed
          • deny: Request is blocked
          • transform: Request is modified for safety

4. Audit Logging
   └─> Audit Logger records decision
       • Store decision in memory + file
       • Include: timestamp, agent, action, reason, risk
       • Generate audit trail for compliance

5. Response
   └─> Return decision to agent
       {
         success: true,
         decision: {
           action: "allow",
           reason: "Low risk operation approved",
           riskLevel: "low",
           transformedRequest: null
         }
       }

6. Agent Action
   └─> Agent acts based on decision
       • allow: Execute the tool call
       • deny: Block the operation, log error
       • transform: Execute modified request
```

## 📁 Project Structure

```
src/
├── app.js                          # Main Express application entry point
│                                   # • Server setup with security middleware
│                                   # • Health check endpoint
│                                   # • Error handling
│
├── routes/
│   ├── security.js                 # Core security API endpoints
│   │                               # • POST /evaluate - Main security evaluation
│   │                               # • GET /policies - Get current policies
│   │                               # • POST /policies/validate - Validate policies
│   │                               # • GET /audit/:agentId - Get audit trail
│   │
│   └── enhancedSecurity.js         # Advanced security endpoints (future)
│
├── core/
│   ├── policyEngine.js             # Policy evaluation engine
│   │                               # • Risk assessment logic
│   │                               # • Policy matching and evaluation
│   │                               # • Transformation logic
│   │                               # • Default policies
│   │
│   ├── auditLogger.js              # Basic audit logging
│   │                               # • Decision logging
│   │                               # • Audit trail management
│   │                               # • Security statistics
│   │
│   ├── enhancedAuditLogger.js      # Advanced audit with trace analysis
│   │                               # • Integrates trace analysis
│   │                               # • Stores execution traces
│   │                               # • Advanced analytics
│   │
│   └── traceAnalyzer.js            # Program analysis for traces
│                                   # • Builds CFG, DFG, PDG graphs
│                                   # • Detects prompt injection
│                                   # • Analyzes control flow anomalies
│                                   # • Tracks sensitive data flow
│
├── middleware/
│   └── validation.js               # Request validation & authentication
│                                   # • authenticateAgent: API key validation
│                                   # • validateRequest: Request format validation
│
├── config/
│   ├── config.js                   # Environment configuration
│   │                               # • Server settings
│   │                               # • Database config (future)
│   │                               # • Security settings
│   │
│   └── policies.json               # Security policies configuration
│                                   # • 8 default policies
│                                   # • Conditions and actions
│                                   # • Transformation rules
│
└── tests/
    └── security.test.js            # API integration tests

examples/
├── simple-agent.js                 # Example secure agent implementation
└── package.json                    # Example dependencies
```

## 🔧 Configuration

### Environment Variables
```bash
# Server configuration
PORT=3001
HOST=localhost
NODE_ENV=development

# Database (for future phases)
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_security

# Security
LOG_LEVEL=info
AUDIT_RETENTION=30d
```

### Custom Policies
Edit `src/config/policies.json` to customize security rules:

```json
{
  "policies": [
    {
      "name": "my-custom-policy",
      "conditions": [
        {"type": "tool_name", "pattern": "my-tool*"}
      ],
      "action": "allow",
      "reason": "My custom tool is safe"
    }
  ]
}
```

## 🐛 Troubleshooting

### Common Issues

**"node: command not found"**
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

**"Port 3001 already in use"**
- Change port: `PORT=3002 npm start`
- Or kill existing process: `lsof -ti:3001 | xargs kill`

**"API key required"**
- Add header: `X-API-Key: your-api-key-here`
- API key must be at least 10 characters

**Tests failing**
- Make sure no other instance is running on port 3001
- Run `npm install` to ensure dependencies are installed

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start
```

## 🎯 Success Criteria

Phase 1A is working correctly when:

- ✅ API starts without errors
- ✅ Health check returns "healthy"
- ✅ Security evaluation accepts valid requests
- ✅ Policies are loaded and applied correctly
- ✅ Audit trail records decisions
- ✅ Example agent runs successfully
- ✅ Tests pass

## 🔄 Component Interactions

### Detailed Component Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Agent Makes Request                                          │
└─────────────────────────────────────────────────────────────────────┘
    Agent (simple-agent.js)
      │
      │ HTTP POST /api/security/evaluate
      │ Headers: { "X-API-Key": "test-api-key-12345" }
      │ Body: {
      │   "agentId": "agent-123",
      │   "toolName": "web-search",
      │   "parameters": { "query": "AI security" }
      │ }
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Express Server Receives Request                              │
└─────────────────────────────────────────────────────────────────────┘
    app.js (Express Server)
      │
      ├─> Helmet: Add security headers
      ├─> CORS: Handle cross-origin
      ├─> Rate Limiter: Check request rate (1000/15min)
      ├─> Body Parser: Parse JSON body
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Middleware Validation                                        │
└─────────────────────────────────────────────────────────────────────┘
    validation.js
      │
      ├─> authenticateAgent()
      │     • Check X-API-Key header exists
      │     • Validate key length >= 10 chars
      │     • Extract agent ID from key
      │     • Attach agent info to request
      │
      ├─> validateRequest()
      │     • Validate agentId is string
      │     • Validate toolName is string
      │     • Validate parameters is object
      │     • Return 400 if validation fails
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Route Handler                                                │
└─────────────────────────────────────────────────────────────────────┘
    routes/security.js
      │
      ├─> Extract request data: { agentId, toolName, parameters, context }
      ├─> Generate unique requestId
      ├─> Log: "Evaluating security for agent: X, tool: Y"
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Policy Engine Evaluation                                     │
└─────────────────────────────────────────────────────────────────────┘
    policyEngine.js
      │
      ├─> 5a. Risk Assessment (assessRisk)
      │     • Check if toolName matches critical risk patterns
      │     • Check if toolName matches high risk patterns
      │     • Check parameters for sensitive data
      │     • Return risk level: critical/high/medium/low
      │
      ├─> 5b. Load Policies
      │     • Read policies from config/policies.json
      │     • Use default policies if file not found
      │     • Sort by priority
      │
      ├─> 5c. Policy Matching (evaluate)
      │     For each policy (in priority order):
      │       • evaluateConditions()
      │         - Check tool_name pattern match
      │         - Check risk_level comparison
      │         - Check parameter conditions
      │       • If all conditions match:
      │         - Apply policy action
      │         - Apply transformation if needed
      │         - Return decision
      │
      ├─> 5d. Apply Transformation (if action = "transform")
      │     • read_only: Change "write" → "read" in toolName
      │     • parameter_filter: Remove specified parameters
      │     • parameter_anonymize: Replace values with "[ANONYMIZED]"
      │
      ├─> 5e. Generate Decision
      │     Return: {
      │       action: "allow" | "deny" | "transform",
      │       reason: "Human-readable explanation",
      │       riskLevel: "critical" | "high" | "medium" | "low",
      │       transformedRequest: {...} or null,
      │       policyVersion: "1.0.0",
      │       evaluationTime: 15 (ms),
      │       matchedPolicy: "policy-name"
      │     }
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Audit Logging                                                │
└─────────────────────────────────────────────────────────────────────┘
    auditLogger.js
      │
      ├─> 6a. Create Audit Entry
      │     {
      │       id: "audit_1234567890_abc123",
      │       timestamp: "2024-01-27T10:30:00.000Z",
      │       type: "security_decision",
      │       agentId: "agent-123",
      │       requestId: "req_1234567890_xyz789",
      │       toolName: "web-search",
      │       action: "allow",
      │       reason: "Search operation approved",
      │       riskLevel: "low",
      │       clientIp: "192.168.1.100",
      │       userAgent: "Node.js/18.0.0",
      │       metadata: { policyVersion, evaluationTime, ... }
      │     }
      │
      ├─> 6b. Store in Memory
      │     • Push to decisions array
      │     • Limit to 10,000 entries (prevent overflow)
      │
      ├─> 6c. Write to File
      │     • Append to src/logs/audit.log
      │     • JSON format, one entry per line
      │
      ├─> 6d. Log to Console
      │     • "📝 Audit logged: allow for web-search"
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Return Response to Agent                                     │
└─────────────────────────────────────────────────────────────────────┘
    routes/security.js
      │
      ├─> Build Response
      │     {
      │       success: true,
      │       decision: {
      │         requestId: "req_1234567890_xyz789",
      │         agentId: "agent-123",
      │         toolName: "web-search",
      │         action: "allow",
      │         reason: "Search operation approved - minimal security risk",
      │         transformedRequest: null,
      │         riskLevel: "low",
      │         timestamp: "2024-01-27T10:30:00.000Z",
      │         metadata: {
      │           policyVersion: "1.0.0",
      │           evaluationTime: 15
      │         }
      │       }
      │     }
      │
      ├─> Send HTTP 200 Response
      │
      ├─> Log: "✅ Security decision: allow for web-search"
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: Agent Processes Decision                                     │
└─────────────────────────────────────────────────────────────────────┘
    Agent (simple-agent.js)
      │
      ├─> Receive response
      │
      ├─> Check decision.action
      │     • "allow": Execute the tool call
      │     • "deny": Block operation, log error
      │     • "transform": Execute transformedRequest instead
      │
      ├─> Log decision for debugging
      │
      └─> Continue agent execution
```

### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Error Scenarios                                                       │
└─────────────────────────────────────────────────────────────────────┘

1. Missing API Key
   └─> authenticateAgent() → 401 Unauthorized
       { error: { code: "MISSING_API_KEY", message: "..." } }

2. Invalid Request Format
   └─> validateRequest() → 400 Bad Request
       { error: { code: "VALIDATION_ERROR", details: [...] } }

3. Policy Evaluation Error
   └─> policyEngine.evaluate() catches error
       → Fail Closed: Return "deny" decision
       → Log error to audit trail
       → Return 500 with deny decision

4. Audit Logging Error
   └─> auditLogger.logDecision() catches error
       → Log to console but don't fail request
       → Continue with response (audit failure shouldn't block)

5. Unknown Endpoint
   └─> 404 handler → 404 Not Found
       { error: { code: "NOT_FOUND", message: "..." } }
```

### File References

**Core Files:**
- `src/app.js` - Express server setup
- `src/routes/security.js` - API endpoints
- `src/middleware/validation.js` - Auth & validation
- `src/core/policyEngine.js` - Policy evaluation
- `src/core/auditLogger.js` - Audit logging
- `src/config/config.js` - Configuration
- `src/config/policies.json` - Security policies

**Advanced Files (Experimental):**
- `src/core/enhancedAuditLogger.js` - Trace-aware audit logging
- `src/core/traceAnalyzer.js` - Program analysis for traces
- `src/routes/enhancedSecurity.js` - Advanced security endpoints

## 🚀 Next Steps

Once Phase 1A is working:

1. **Phase 1B**: Build JavaScript SDK
2. **Phase 1C**: Create more examples and documentation
3. **Phase 2**: Add framework integrations
4. **Phase 3**: Scale to microservices

## 🤝 Need Help?

- **GitHub Issues**: https://github.com/nagasatish007/ai-agent-security-platform/issues
- **Documentation**: Check the `/docs` folder
- **Examples**: Look at `/examples` for more use cases

---

**🎉 Congratulations! You've successfully set up the core foundation of the AI Agent Security Platform.**