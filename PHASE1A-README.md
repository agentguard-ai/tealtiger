# Phase 1A: Core Foundation - Setup Guide

This guide will help you set up and run the Phase 1A core foundation of the AI Agent Security Platform.

## 🎯 What We Built

**Phase 1A delivers:**
- ✅ **Security Sidecar Agent** - HTTP API for security evaluation
- ✅ **Policy Engine** - JSON-based rule evaluation
- ✅ **Audit Logger** - Decision logging and trail
- ✅ **Basic Authentication** - API key validation
- ✅ **Example Agent** - Shows how to integrate

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

The system comes with default policies in `src/config/policies.json`:

1. **deny-critical-operations** - Block critical risk operations
2. **deny-system-commands** - Block system command execution
3. **transform-file-write** - Convert file writes to read-only
4. **anonymize-sensitive-data** - Remove passwords/tokens
5. **allow-read-operations** - Allow safe read operations
6. **allow-search-operations** - Allow web searches
7. **allow-low-risk** - Allow low risk operations

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

## 📁 Project Structure

```
src/
├── app.js                 # Main application entry point
├── routes/
│   └── security.js        # Security API endpoints
├── core/
│   ├── policyEngine.js    # Policy evaluation logic
│   └── auditLogger.js     # Audit trail logging
├── middleware/
│   └── validation.js      # Request validation & auth
├── config/
│   ├── config.js          # Environment configuration
│   └── policies.json      # Default security policies
└── tests/
    └── security.test.js   # API tests

examples/
├── simple-agent.js        # Example secure agent
└── package.json           # Example dependencies
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