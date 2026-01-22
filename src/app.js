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
const auditLogger = require('./core/auditLogger');
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Agent Security Platform',
    version: '0.1.0',
    timestamp: new Date().toISOString()
  });
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

app.listen(PORT, () => {
  console.log(`🚀 AI Agent Security Platform running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Security API: http://localhost:${PORT}/api/security`);
  
  // Initialize policy engine
  policyEngine.initialize();
  console.log('✅ Policy Engine initialized');
});

module.exports = app;