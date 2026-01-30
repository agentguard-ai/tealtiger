/**
 * PII Detection Guardrail
 * 
 * Detects and handles Personally Identifiable Information (PII) in text:
 * - Email addresses
 * - Phone numbers (US and international formats)
 * - Social Security Numbers (SSN)
 * - Credit card numbers
 * - Names (basic pattern matching)
 */

const { Guardrail, GuardrailResult } = require('./Guardrail');

class PIIDetectionGuardrail extends Guardrail {
  constructor(config = {}) {
    super({
      name: 'PIIDetection',
      description: 'Detects personally identifiable information in text',
      version: '1.0.0',
      ...config
    });

    // Configure detection patterns
    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      // Basic name pattern (capitalized words)
      name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g
    };

    // Configure which PII types to detect
    this.detectTypes = config.detectTypes || ['email', 'phone', 'ssn', 'creditCard'];
    
    // Configure action: 'block', 'redact', 'mask', 'allow'
    this.action = config.action || 'block';
    
    // Configure risk scores per PII type
    this.riskScores = config.riskScores || {
      email: 30,
      phone: 40,
      ssn: 90,
      creditCard: 95,
      name: 20
    };
  }

  /**
   * Evaluate input for PII
   * @param {Object} input - Input containing text to scan
   * @param {Object} context - Execution context
   * @returns {Promise<GuardrailResult>}
   */
  async evaluate(input, context = {}) {
    const text = this._extractText(input);
    const detections = this._detectPII(text);

    if (detections.length === 0) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No PII detected',
        metadata: { detections: [] },
        riskScore: 0
      });
    }

    // Calculate maximum risk score from detections
    const maxRiskScore = Math.max(...detections.map(d => this.riskScores[d.type] || 50));

    // Determine action based on configuration
    const action = this.action;
    const passed = action === 'allow' || action === 'redact' || action === 'mask';

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected ${detections.length} PII instance(s): ${detections.map(d => d.type).join(', ')}`,
      metadata: {
        detections,
        redactedText: action === 'redact' ? this._redactPII(text, detections) : undefined,
        maskedText: action === 'mask' ? this._maskPII(text, detections) : undefined
      },
      riskScore: maxRiskScore
    });
  }

  /**
   * Extract text from various input formats
   * @private
   */
  _extractText(input) {
    if (typeof input === 'string') {
      return input;
    }
    
    if (input.prompt) {
      return input.prompt;
    }
    
    if (input.messages && Array.isArray(input.messages)) {
      return input.messages.map(m => m.content || '').join(' ');
    }
    
    if (input.text) {
      return input.text;
    }
    
    return JSON.stringify(input);
  }

  /**
   * Detect PII in text
   * @private
   */
  _detectPII(text) {
    const detections = [];

    for (const type of this.detectTypes) {
      const pattern = this.patterns[type];
      if (!pattern) continue;

      const matches = text.matchAll(pattern);
      for (const match of matches) {
        detections.push({
          type,
          value: match[0],
          position: match.index,
          length: match[0].length
        });
      }
    }

    return detections;
  }

  /**
   * Redact PII from text (replace with [REDACTED])
   * @private
   */
  _redactPII(text, detections) {
    let redacted = text;
    
    // Sort by position in reverse to maintain indices
    const sorted = [...detections].sort((a, b) => b.position - a.position);
    
    for (const detection of sorted) {
      const before = redacted.substring(0, detection.position);
      const after = redacted.substring(detection.position + detection.length);
      redacted = before + `[REDACTED_${detection.type.toUpperCase()}]` + after;
    }
    
    return redacted;
  }

  /**
   * Mask PII from text (replace with asterisks)
   * @private
   */
  _maskPII(text, detections) {
    let masked = text;
    
    // Sort by position in reverse to maintain indices
    const sorted = [...detections].sort((a, b) => b.position - a.position);
    
    for (const detection of sorted) {
      const before = masked.substring(0, detection.position);
      const after = masked.substring(detection.position + detection.length);
      const maskLength = detection.length;
      masked = before + '*'.repeat(maskLength) + after;
    }
    
    return masked;
  }
}

module.exports = PIIDetectionGuardrail;
