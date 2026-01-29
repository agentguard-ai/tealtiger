/**
 * Security Routes - Core Security Sidecar Agent Endpoints
 * 
 * These endpoints handle all agent security evaluation requests
 */

const express = require('express');
const router = express.Router();

const policyEngine = require('../core/policyEngine');
const auditLogger = require('../core/databaseAuditLogger');
const { validateRequest, authenticateAgent } = require('../middleware/validation');

/**
 * POST /api/security/evaluate
 * 
 * Main endpoint for evaluating agent tool/API calls
 * This is where all agent requests come for security evaluation
 */
router.post('/evaluate', authenticateAgent, validateRequest, async (req, res) => {
  try {
    const { agentId, toolName, parameters, context } = req.body;
    
    console.log(`🔍 Evaluating security for agent: ${agentId}, tool: ${toolName}`);
    
    // Step 1: Evaluate request against policies
    const policyDecision = await policyEngine.evaluate({
      agentId,
      toolName,
      parameters,
      context,
      timestamp: new Date().toISOString()
    });
    
    // Step 2: Create security decision
    const securityDecision = {
      requestId: generateRequestId(),
      agentId,
      toolName,
      action: policyDecision.action, // 'allow', 'deny', 'transform'
      reason: policyDecision.reason,
      transformedRequest: policyDecision.transformedRequest || null,
      riskLevel: policyDecision.riskLevel || 'medium',
      timestamp: new Date().toISOString(),
      metadata: {
        policyVersion: policyDecision.policyVersion,
        evaluationTime: policyDecision.evaluationTime
      }
    };
    
    // Step 3: Log decision for audit trail
    await auditLogger.logDecision(securityDecision, req);
    
    // Step 4: Return decision to agent
    res.json({
      success: true,
      decision: securityDecision
    });
    
    console.log(`✅ Security decision: ${securityDecision.action} for ${toolName}`);
    
  } catch (error) {
    console.error('Security evaluation error:', error);
    
    // Fail closed - deny on error
    const failClosedDecision = {
      requestId: generateRequestId(),
      agentId: req.body.agentId,
      toolName: req.body.toolName,
      action: 'deny',
      reason: 'Security evaluation failed - failing closed for safety',
      riskLevel: 'critical',
      timestamp: new Date().toISOString(),
      error: error.message
    };
    
    await auditLogger.logDecision(failClosedDecision, req);
    
    res.status(500).json({
      success: false,
      decision: failClosedDecision
    });
  }
});

/**
 * GET /api/security/policies
 * 
 * Get current security policies (for debugging/admin)
 */
router.get('/policies', authenticateAgent, async (req, res) => {
  try {
    const policies = await policyEngine.getPolicies();
    res.json({
      success: true,
      policies: policies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/policies/validate
 * 
 * Validate policy configuration (for development)
 */
router.post('/policies/validate', authenticateAgent, async (req, res) => {
  try {
    const { policies } = req.body;
    const validation = await policyEngine.validatePolicies(policies);
    
    res.json({
      success: true,
      validation: validation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/security/audit/{agentId}
 * 
 * Get audit trail for specific agent (for debugging)
 */
router.get('/audit/:agentId', authenticateAgent, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const auditTrail = await auditLogger.getAuditTrail(agentId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      auditTrail: auditTrail
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to generate unique request IDs
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = router;