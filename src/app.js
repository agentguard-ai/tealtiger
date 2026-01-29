/**
 * AI Agent Security Platform - MVP
 * Security Sidecar Agent (SSA) - Main Application
 * 
 * This is the core security service that mediates all agent tool/API calls
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const securityRoutes = require('./routes/security');
const policyEngine = require('./core/policyEngine');
const auditLogger = require('./core/databaseAuditLogger'); // Use database-backed logger
const db = require('./database/connection'); // Database connection
const config = require('./config/config');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint with database status
app.get('/health', async (req, res) => {
  try {
    const auditHealth = await auditLogger.healthCheck();
    
    res.json({
      status: 'healthy',
      service: 'AI Agent Security Platform',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      components: {
        database: auditHealth.database,
        auditLogger: auditHealth.auditRecords,
        policyEngine: { status: 'active' }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'AI Agent Security Platform',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api/security', securityRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Log error for audit
  auditLogger.logError(err, req);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    }
  });
});

const PORT = config.port || 3001;

// Initialize application
async function startServer() {
  try {
    // Initialize database connection
    console.log('🔌 Initializing database connection...');
    await db.initialize();
    
    // Initialize policy engine
    console.log('⚙️ Initializing policy engine...');
    policyEngine.initialize();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 AI Agent Security Platform running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔒 Security API: http://localhost:${PORT}/api/security`);
      console.log('✅ All systems initialized successfully');
    });
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    
    // Try to start without database (fallback mode)
    console.log('⚠️ Starting in fallback mode (no database)...');
    
    policyEngine.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 AI Agent Security Platform running on port ${PORT} (FALLBACK MODE)`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔒 Security API: http://localhost:${PORT}/api/security`);
      console.log('⚠️ Database unavailable - using in-memory audit logging');
    });
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;