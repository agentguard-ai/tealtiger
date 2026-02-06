# Database Setup Guide

## PostgreSQL Integration for AI Agent Security Platform

**IMPORTANT**: This database setup is for **SSA Server operators** (DevOps/Platform teams), **NOT for SDK users** (Agent developers).

## Architecture Overview

```
[Agent Developer]     [Platform Team]        [External Services]
     |                      |                       |
[SDK Client] ---------> [SSA Server] ----------> [APIs/Tools]
(No database)         (Needs PostgreSQL)
```

### Who Needs What?

**🧑‍💻 SDK Users (Agent Developers)**
- ✅ Install AgentGuard SDK (`npm install @ai-security/agent-guard-sdk`)
- ✅ Configure SSA server URL and API key
- ❌ **NO database setup required**
- ❌ **NO PostgreSQL installation needed**

**🏢 Platform Teams (SSA Server Operators)**
- ✅ Deploy SSA server with PostgreSQL
- ✅ Manage security policies and compliance
- ✅ Provide SSA endpoint URL to SDK users
- ✅ Handle centralized audit logging

## Quick Start (For Platform Teams Only)

### Option 1: Docker Compose (Easiest)

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Follow installation instructions for your OS

2. **Start PostgreSQL**
   ```bash
   # Start PostgreSQL container
   docker-compose up -d postgres
   
   # Or start all services
   docker-compose up -d
   ```

3. **Setup Database Schema**
   ```bash
   npm run db:setup
   ```

4. **Start the Application**
   ```bash
   npm start
   ```

### Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL**
   - Windows: Download from https://www.postgresql.org/download/windows/
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql postgresql-contrib`

2. **Create Database and User**
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres
   
   -- Create database and user
   CREATE DATABASE ai_security;
   CREATE USER dev_user WITH PASSWORD 'dev_password';
   GRANT ALL PRIVILEGES ON DATABASE ai_security TO dev_user;
   ```

3. **Setup Schema**
   ```bash
   npm run db:setup
   ```

## Database Schema

The platform uses the following PostgreSQL tables:

### Core Tables

- **`agents`** - Registered AI agents with metadata
- **`security_policies`** - Security policies and versions  
- **`audit_records`** - Comprehensive audit trail
- **`oauth_tokens`** - OAuth token lifecycle
- **`compliance_mappings`** - Regulatory framework mappings

### Key Features

- **UUID Primary Keys** - For distributed system compatibility
- **JSONB Columns** - For flexible metadata storage
- **Enum Types** - For consistent status values
- **Indexes** - Optimized for common queries
- **Triggers** - Automatic timestamp updates

## Environment Configuration

Create a `.env` file (copy from `.env.example`):

```bash
# Database Configuration
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_security
DB_MAX_CONNECTIONS=20
DB_LOG_QUERIES=true

# Other settings...
NODE_ENV=development
PORT=3001
```

## Available Scripts

```bash
# Database management
npm run db:start      # Start PostgreSQL container
npm run db:stop       # Stop PostgreSQL container  
npm run db:setup      # Initialize database schema
npm run db:reset      # Reset database (WARNING: deletes all data)

# Application
npm start             # Start with database
npm run dev           # Development mode with auto-reload
```

## Fallback Mode

If PostgreSQL is unavailable, the application automatically starts in **fallback mode**:

- ✅ All security functionality works
- ✅ In-memory audit logging  
- ⚠️ Audit logs lost on restart
- ⚠️ No persistent agent registry

## Health Check

Check database status:

```bash
curl http://localhost:3001/health
```

Response includes database health:

```json
{
  "status": "healthy",
  "components": {
    "database": {
      "healthy": true,
      "connected": true,
      "poolSize": 1
    },
    "auditLogger": {
      "last24h": 42,
      "fallbackEntries": 0
    }
  }
}
```

## Troubleshooting

### Connection Issues

1. **Check PostgreSQL is running**
   ```bash
   docker-compose ps postgres
   # or
   pg_isready -h localhost -p 5432
   ```

2. **Verify credentials**
   ```bash
   psql -h localhost -U dev_user -d ai_security
   ```

3. **Check logs**
   ```bash
   docker-compose logs postgres
   ```

### Performance Tuning

For production deployments, consider:

- Connection pooling (already configured)
- Read replicas for audit queries
- Partitioning for large audit tables
- Regular maintenance and vacuuming

## Migration from In-Memory

The application automatically migrates from the old in-memory audit logger to PostgreSQL. No data migration is needed as the in-memory storage was temporary.

## Security Considerations

- Database credentials should be stored securely
- Use SSL connections in production (`DB_SSL=true`)
- Regular backups of audit data for compliance
- Consider encryption at rest for sensitive data

## Next Steps

Once PostgreSQL is running:

1. ✅ Persistent audit logging
2. ✅ Agent registry and metadata
3. ✅ Policy versioning and rollback
4. ✅ Compliance reporting
5. 🔄 Redis caching (future enhancement)
6. 🔄 Multi-tenant support (future enhancement)