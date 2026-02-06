/**
 * Configuration - Environment-based configuration
 */

const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  host: process.env.HOST || 'localhost',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/ai_security',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    ssl: process.env.DB_SSL === 'true',
    logQueries: process.env.DB_LOG_QUERIES === 'true' || process.env.NODE_ENV === 'development'
  },
  
  // Redis configuration (for future use)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: process.env.REDIS_TTL || 3600 // 1 hour
  },
  
  // Security configuration
  security: {
    apiKeyMinLength: 10,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 1000, // requests per window
    requestTimeout: 30000 // 30 seconds
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    auditRetention: process.env.AUDIT_RETENTION || '30d'
  },
  
  // Policy configuration
  policies: {
    defaultRiskLevel: 'medium',
    maxEvaluationTime: 5000, // 5 seconds
    cacheEnabled: process.env.POLICY_CACHE_ENABLED === 'true'
  }
};

module.exports = config;