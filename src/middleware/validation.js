/**
 * Validation Middleware - Request validation and authentication
 */

/**
 * Authenticate agent requests (simple API key for MVP)
 */
function authenticateAgent(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key required in X-API-Key header'
      }
    });
  }
  
  // For MVP, accept any non-empty API key
  // In production, this would validate against a database
  if (apiKey.length < 10) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key format'
      }
    });
  }
  
  // Add agent info to request
  req.agent = {
    apiKey: apiKey,
    id: extractAgentIdFromKey(apiKey)
  };
  
  next();
}

/**
 * Validate security evaluation request
 */
function validateRequest(req, res, next) {
  const { agentId, toolName, parameters } = req.body;
  
  const errors = [];
  
  if (!agentId || typeof agentId !== 'string') {
    errors.push('agentId is required and must be a string');
  }
  
  if (!toolName || typeof toolName !== 'string') {
    errors.push('toolName is required and must be a string');
  }
  
  if (parameters && typeof parameters !== 'object') {
    errors.push('parameters must be an object if provided');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors
      }
    });
  }
  
  next();
}

/**
 * Extract agent ID from API key (simple implementation for MVP)
 */
function extractAgentIdFromKey(apiKey) {
  // For MVP, use a simple hash of the API key
  // In production, this would look up the agent in a database
  return `agent_${apiKey.slice(-8)}`;
}

module.exports = {
  authenticateAgent,
  validateRequest
};