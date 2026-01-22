/**
 * Audit Logger - Security Decision and Action Logging
 * 
 * This module handles all audit trail logging for compliance and debugging
 */

const fs = require('fs').promises;
const path = require('path');

class AuditLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/audit.log');
    this.decisions = []; // In-memory storage for MVP (will use database later)
    this.maxMemoryLogs = 10000; // Prevent memory overflow
  }

  /**
   * Log a security decision
   */
  async logDecision(decision, request) {
    try {
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
        clientIp: request.ip || request.connection?.remoteAddress,
        userAgent: request.get('User-Agent'),
        metadata: {
          policyVersion: decision.metadata?.policyVersion,
          evaluationTime: decision.metadata?.evaluationTime,
          transformedRequest: decision.transformedRequest ? true : false
        }
      };

      // Store in memory (MVP approach)
      this.decisions.push(auditEntry);
      
      // Prevent memory overflow
      if (this.decisions.length > this.maxMemoryLogs) {
        this.decisions = this.decisions.slice(-this.maxMemoryLogs);
      }

      // Also log to file for persistence
      await this.writeToFile(auditEntry);
      
      console.log(`📝 Audit logged: ${decision.action} for ${decision.toolName}`);
      
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't throw - audit logging failure shouldn't break security decisions
    }
  }

  /**
   * Log an error for audit purposes
   */
  async logError(error, request) {
    try {
      const auditEntry = {
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        type: 'error',
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        request: {
          method: request.method,
          url: request.url,
          body: request.body,
          clientIp: request.ip || request.connection?.remoteAddress
        }
      };

      this.decisions.push(auditEntry);
      await this.writeToFile(auditEntry);
      
    } catch (logError) {
      console.error('Error audit logging failed:', logError);
    }
  }

  /**
   * Get audit trail for a specific agent
   */
  async getAuditTrail(agentId, options = {}) {
    const { limit = 100, offset = 0, type = null } = options;
    
    let filtered = this.decisions.filter(entry => 
      entry.agentId === agentId && 
      (type ? entry.type === type : true)
    );
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      entries: paginated,
      total: filtered.length,
      limit,
      offset
    };
  }

  /**
   * Get recent security decisions (for monitoring)
   */
  async getRecentDecisions(limit = 50) {
    const securityDecisions = this.decisions
      .filter(entry => entry.type === 'security_decision')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return securityDecisions;
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(timeRange = '24h') {
    const cutoffTime = this.getCutoffTime(timeRange);
    
    const recentDecisions = this.decisions.filter(entry => 
      entry.type === 'security_decision' && 
      new Date(entry.timestamp) > cutoffTime
    );
    
    const stats = {
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
      topAgents: this.getTopAgents(recentDecisions),
      topTools: this.getTopTools(recentDecisions)
    };
    
    return stats;
  }

  /**
   * Write audit entry to file
   */
  async writeToFile(auditEntry) {
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(this.logFile);
      await fs.mkdir(logsDir, { recursive: true });
      
      // Append to log file
      const logLine = JSON.stringify(auditEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);
      
    } catch (error) {
      console.error('File logging error:', error);
    }
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
      default: return new Date(now - 24 * 60 * 60 * 1000);
    }
  }

  getTopAgents(decisions, limit = 5) {
    const agentCounts = {};
    decisions.forEach(d => {
      agentCounts[d.agentId] = (agentCounts[d.agentId] || 0) + 1;
    });
    
    return Object.entries(agentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([agentId, count]) => ({ agentId, count }));
  }

  getTopTools(decisions, limit = 5) {
    const toolCounts = {};
    decisions.forEach(d => {
      toolCounts[d.toolName] = (toolCounts[d.toolName] || 0) + 1;
    });
    
    return Object.entries(toolCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([toolName, count]) => ({ toolName, count }));
  }

  /**
   * Clear old audit logs (for maintenance)
   */
  async clearOldLogs(olderThan = '30d') {
    const cutoffTime = this.getCutoffTime(olderThan);
    
    const before = this.decisions.length;
    this.decisions = this.decisions.filter(entry => 
      new Date(entry.timestamp) > cutoffTime
    );
    const after = this.decisions.length;
    
    console.log(`🧹 Cleared ${before - after} old audit logs`);
    
    return { cleared: before - after, remaining: after };
  }
}

// Export singleton instance
module.exports = new AuditLogger();