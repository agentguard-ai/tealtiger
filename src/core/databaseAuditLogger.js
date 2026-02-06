/**
 * Database Audit Logger - PostgreSQL-backed Security Decision and Action Logging
 * 
 * This module handles all audit trail logging with PostgreSQL persistence
 */

const db = require('../database/connection');

class DatabaseAuditLogger {
  constructor() {
    this.fallbackDecisions = []; // Fallback in-memory storage if DB fails
    this.maxFallbackLogs = 1000;
  }

  /**
   * Log a security decision to PostgreSQL
   */
  async logDecision(decision, request) {
    try {
      const auditEntry = {
        audit_id: this.generateAuditId(),
        timestamp: new Date(),
        type: 'security_decision',
        agent_id: decision.agentId,
        request_id: decision.requestId,
        tool_name: decision.toolName,
        action: decision.action,
        reason: decision.reason,
        risk_level: decision.riskLevel,
        client_ip: request.ip || request.connection?.remoteAddress,
        user_agent: request.get('User-Agent'),
        metadata: {
          policyVersion: decision.metadata?.policyVersion,
          evaluationTime: decision.metadata?.evaluationTime,
          transformedRequest: decision.transformedRequest ? true : false,
          ...decision.metadata
        }
      };

      // Insert into PostgreSQL
      const query = `
        INSERT INTO audit_records (
          audit_id, timestamp, type, agent_id, request_id, tool_name, 
          action, reason, risk_level, client_ip, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;

      const values = [
        auditEntry.audit_id,
        auditEntry.timestamp,
        auditEntry.type,
        auditEntry.agent_id,
        auditEntry.request_id,
        auditEntry.tool_name,
        auditEntry.action,
        auditEntry.reason,
        auditEntry.risk_level,
        auditEntry.client_ip,
        auditEntry.user_agent,
        JSON.stringify(auditEntry.metadata)
      ];

      const result = await db.query(query, values);
      
      console.log(`📝 Audit logged to DB: ${decision.action} for ${decision.toolName} (ID: ${result.rows[0].id})`);
      
      return result.rows[0].id;
      
    } catch (error) {
      console.error('💥 Database audit logging failed:', error);
      
      // Fallback to in-memory storage
      await this.fallbackLogDecision(decision, request);
      
      // Don't throw - audit logging failure shouldn't break security decisions
    }
  }

  /**
   * Log an error for audit purposes
   */
  async logError(error, request) {
    try {
      const auditEntry = {
        audit_id: this.generateAuditId(),
        timestamp: new Date(),
        type: 'error',
        agent_id: request.body?.agentId || 'unknown',
        request_id: request.headers['x-request-id'] || null,
        tool_name: request.body?.toolName || null,
        action: null,
        reason: error.message,
        risk_level: null,
        client_ip: request.ip || request.connection?.remoteAddress,
        user_agent: request.get('User-Agent'),
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code
          },
          request: {
            method: request.method,
            url: request.url,
            body: request.body
          }
        }
      };

      const query = `
        INSERT INTO audit_records (
          audit_id, timestamp, type, agent_id, request_id, tool_name,
          reason, client_ip, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const values = [
        auditEntry.audit_id,
        auditEntry.timestamp,
        auditEntry.type,
        auditEntry.agent_id,
        auditEntry.request_id,
        auditEntry.tool_name,
        auditEntry.reason,
        auditEntry.client_ip,
        auditEntry.user_agent,
        JSON.stringify(auditEntry.metadata)
      ];

      await db.query(query, values);
      
    } catch (dbError) {
      console.error('💥 Database error logging failed:', dbError);
      // Store in fallback
      this.fallbackDecisions.push({
        ...auditEntry,
        fallback: true,
        originalError: error.message
      });
    }
  }

  /**
   * Get audit trail for a specific agent
   */
  async getAuditTrail(agentId, options = {}) {
    try {
      const { limit = 100, offset = 0, type = null } = options;
      
      let query = `
        SELECT audit_id, timestamp, type, agent_id, request_id, tool_name,
               action, reason, risk_level, client_ip, user_agent, metadata
        FROM audit_records 
        WHERE agent_id = $1
      `;
      
      const params = [agentId];
      
      if (type) {
        query += ` AND type = $${params.length + 1}`;
        params.push(type);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM audit_records WHERE agent_id = $1';
      const countParams = [agentId];
      
      if (type) {
        countQuery += ' AND type = $2';
        countParams.push(type);
      }
      
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        entries: result.rows.map(row => ({
          id: row.audit_id,
          timestamp: row.timestamp.toISOString(),
          type: row.type,
          agentId: row.agent_id,
          requestId: row.request_id,
          toolName: row.tool_name,
          action: row.action,
          reason: row.reason,
          riskLevel: row.risk_level,
          clientIp: row.client_ip,
          userAgent: row.user_agent,
          metadata: row.metadata
        })),
        total,
        limit,
        offset
      };
      
    } catch (error) {
      console.error('💥 Database audit trail query failed:', error);
      
      // Fallback to in-memory data if available
      return this.getFallbackAuditTrail(agentId, options);
    }
  }

  /**
   * Get recent security decisions (for monitoring)
   */
  async getRecentDecisions(limit = 50) {
    try {
      const query = `
        SELECT audit_id, timestamp, agent_id, tool_name, action, reason, risk_level, metadata
        FROM audit_records 
        WHERE type = 'security_decision'
        ORDER BY timestamp DESC 
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.audit_id,
        timestamp: row.timestamp.toISOString(),
        agentId: row.agent_id,
        toolName: row.tool_name,
        action: row.action,
        reason: row.reason,
        riskLevel: row.risk_level,
        metadata: row.metadata
      }));
      
    } catch (error) {
      console.error('💥 Database recent decisions query failed:', error);
      return this.fallbackDecisions.slice(0, limit);
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(timeRange = '24h') {
    try {
      const cutoffTime = this.getCutoffTime(timeRange);
      
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN action = 'allow' THEN 1 END) as allowed,
          COUNT(CASE WHEN action = 'deny' THEN 1 END) as denied,
          COUNT(CASE WHEN action = 'transform' THEN 1 END) as transformed,
          COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk,
          COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk,
          COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk,
          COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk
        FROM audit_records 
        WHERE type = 'security_decision' 
        AND timestamp > $1
      `;

      const result = await db.query(query, [cutoffTime]);
      const stats = result.rows[0];

      // Get top agents
      const topAgentsQuery = `
        SELECT agent_id, COUNT(*) as count
        FROM audit_records 
        WHERE type = 'security_decision' AND timestamp > $1
        GROUP BY agent_id 
        ORDER BY count DESC 
        LIMIT 5
      `;
      
      const topAgentsResult = await db.query(topAgentsQuery, [cutoffTime]);

      // Get top tools
      const topToolsQuery = `
        SELECT tool_name, COUNT(*) as count
        FROM audit_records 
        WHERE type = 'security_decision' AND timestamp > $1 AND tool_name IS NOT NULL
        GROUP BY tool_name 
        ORDER BY count DESC 
        LIMIT 5
      `;
      
      const topToolsResult = await db.query(topToolsQuery, [cutoffTime]);

      return {
        total: parseInt(stats.total),
        allowed: parseInt(stats.allowed),
        denied: parseInt(stats.denied),
        transformed: parseInt(stats.transformed),
        riskLevels: {
          low: parseInt(stats.low_risk),
          medium: parseInt(stats.medium_risk),
          high: parseInt(stats.high_risk),
          critical: parseInt(stats.critical_risk)
        },
        topAgents: topAgentsResult.rows.map(row => ({
          agentId: row.agent_id,
          count: parseInt(row.count)
        })),
        topTools: topToolsResult.rows.map(row => ({
          toolName: row.tool_name,
          count: parseInt(row.count)
        }))
      };
      
    } catch (error) {
      console.error('💥 Database stats query failed:', error);
      return this.getFallbackStats(timeRange);
    }
  }

  /**
   * Clear old audit logs (for maintenance)
   */
  async clearOldLogs(olderThan = '30d') {
    try {
      const cutoffTime = this.getCutoffTime(olderThan);
      
      const query = 'DELETE FROM audit_records WHERE timestamp < $1';
      const result = await db.query(query, [cutoffTime]);
      
      console.log(`🧹 Cleared ${result.rowCount} old audit logs from database`);
      
      return { cleared: result.rowCount };
      
    } catch (error) {
      console.error('💥 Database cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Register or update an agent
   */
  async registerAgent(agentData) {
    try {
      const query = `
        INSERT INTO agents (agent_id, name, version, owner, description, capabilities, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (agent_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          version = EXCLUDED.version,
          owner = EXCLUDED.owner,
          description = EXCLUDED.description,
          capabilities = EXCLUDED.capabilities,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP,
          last_active = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const values = [
        agentData.agentId,
        agentData.name || 'Unknown Agent',
        agentData.version || '1.0.0',
        agentData.owner || 'unknown',
        agentData.description || '',
        agentData.capabilities || [],
        agentData.status || 'active',
        JSON.stringify(agentData.metadata || {})
      ];

      const result = await db.query(query, values);
      return result.rows[0].id;
      
    } catch (error) {
      console.error('💥 Agent registration failed:', error);
      throw error;
    }
  }

  /**
   * Fallback methods for when database is unavailable
   */
  async fallbackLogDecision(decision, request) {
    const auditEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      type: 'security_decision',
      agentId: decision.agentId,
      requestId: decision.requestId,
      toolName: decision.toolName,
      action: decision.action,
      reason: decision.reason,
      riskLevel: decision.riskLevel,
      fallback: true
    };

    this.fallbackDecisions.push(auditEntry);
    
    // Prevent memory overflow
    if (this.fallbackDecisions.length > this.maxFallbackLogs) {
      this.fallbackDecisions = this.fallbackDecisions.slice(-this.maxFallbackLogs);
    }

    console.log(`📝 Audit logged to fallback: ${decision.action} for ${decision.toolName}`);
  }

  getFallbackAuditTrail(agentId, options = {}) {
    const { limit = 100, offset = 0, type = null } = options;
    
    let filtered = this.fallbackDecisions.filter(entry => 
      entry.agentId === agentId && 
      (type ? entry.type === type : true)
    );
    
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      entries: paginated,
      total: filtered.length,
      limit,
      offset,
      fallback: true
    };
  }

  getFallbackStats(timeRange) {
    const cutoffTime = this.getCutoffTime(timeRange);
    const recentDecisions = this.fallbackDecisions.filter(entry => 
      entry.type === 'security_decision' && 
      new Date(entry.timestamp) > cutoffTime
    );
    
    return {
      total: recentDecisions.length,
      allowed: recentDecisions.filter(d => d.action === 'allow').length,
      denied: recentDecisions.filter(d => d.action === 'deny').length,
      transformed: recentDecisions.filter(d => d.action === 'transform').length,
      riskLevels: {
        low: recentDecisions.filter(d => d.riskLevel === 'low').length,
        medium: recentDecisions.filter(d => d.riskLevel === 'medium').length,
        high: recentDecisions.filter(d => d.riskLevel === 'high').length,
        critical: recentDecisions.filter(d => d.riskLevel === 'critical').length
      },
      topAgents: [],
      topTools: [],
      fallback: true
    };
  }

  /**
   * Helper methods
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCutoffTime(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1h': return new Date(now - 60 * 60 * 1000);
      case '24h': return new Date(now - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now - 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Database health check
   */
  async healthCheck() {
    try {
      const dbHealth = await db.healthCheck();
      const recentCount = await db.query(
        'SELECT COUNT(*) FROM audit_records WHERE timestamp > $1',
        [new Date(Date.now() - 24 * 60 * 60 * 1000)]
      );

      return {
        database: dbHealth,
        auditRecords: {
          last24h: parseInt(recentCount.rows[0].count),
          fallbackEntries: this.fallbackDecisions.length
        }
      };
    } catch (error) {
      return {
        database: { healthy: false, error: error.message },
        auditRecords: {
          fallbackEntries: this.fallbackDecisions.length
        }
      };
    }
  }
}

// Export singleton instance
module.exports = new DatabaseAuditLogger();