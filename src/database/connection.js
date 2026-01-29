/**
 * Database Connection Manager
 * 
 * Handles PostgreSQL connection pooling and management
 */

const { Pool } = require('pg');
const config = require('../config/config');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: config.database.url,
        max: config.database.maxConnections || 20,
        idleTimeoutMillis: config.database.idleTimeout || 30000,
        connectionTimeoutMillis: config.database.connectionTimeout || 10000,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ Database connected successfully');
      
      // Setup connection event handlers
      this.pool.on('error', (err) => {
        console.error('💥 Database pool error:', err);
        this.isConnected = false;
      });

      this.pool.on('connect', () => {
        console.log('🔗 New database connection established');
      });

      return this.pool;
      
    } catch (error) {
      console.error('💥 Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Get database pool
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (config.database.logQueries) {
        console.log('📊 Query executed:', { 
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration: `${duration}ms`,
          rows: result.rowCount 
        });
      }
      
      return result;
    } catch (error) {
      console.error('💥 Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health');
      return {
        healthy: true,
        connected: this.isConnected,
        poolSize: this.pool?.totalCount || 0,
        idleConnections: this.pool?.idleCount || 0,
        waitingClients: this.pool?.waitingCount || 0
      };
    } catch (error) {
      return {
        healthy: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔌 Database connection closed');
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    if (!this.pool) {
      return { error: 'Pool not initialized' };
    }

    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      isConnected: this.isConnected
    };
  }
}

// Export singleton instance
module.exports = new DatabaseConnection();