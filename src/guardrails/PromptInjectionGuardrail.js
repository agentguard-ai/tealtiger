/**
 * Prompt Injection Detection Guardrail
 * 
 * Detects prompt injection and jailbreak attempts:
 * - Direct instruction injection
 * - Role-playing attacks
 * - System prompt leakage attempts
 * - Jailbreak patterns (DAN, etc.)
 * - Encoding-based attacks
 */

const { Guardrail, GuardrailResult } = require('./Guardrail');

class PromptInjectionGuardrail extends Guardrail {
  constructor(config = {}) {
    super({
      name: 'PromptInjection',
      description: 'Detects prompt injection and jailbreak attempts',
      version: '1.0.0',
      ...config
    });

    // Configure action: 'block', 'transform', 'allow'
    this.action = config.action || 'block';
    
    // Configure sensitivity: 'low', 'medium', 'high'
    this.sensitivity = config.sensitivity || 'medium';

    // Detection patterns organized by attack type
    this.patterns = {
      // Direct instruction injection
      instructionInjection: [
        /ignore (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /disregard (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /forget (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /new (instructions|task|prompt):/i,
        /system (prompt|message|instruction):/i
      ],
      
      // Role-playing attacks
      rolePlaying: [
        /you are now (a|an) /i,
        /pretend (you are|to be) /i,
        /act as (a|an) /i,
        /roleplay as /i,
        /simulate (a|an) /i,
        /from now on,? you (are|will be)/i
      ],
      
      // System prompt leakage
      systemLeakage: [
        /show (me )?(your|the) (system|original) (prompt|instructions)/i,
        /what (are|were) your (original|initial) (instructions|prompt)/i,
        /repeat (your|the) (system|original) (prompt|instructions)/i,
        /print (your|the) (system|original) (prompt|instructions)/i
      ],
      
      // Known jailbreak patterns
      jailbreak: [
        /DAN (mode|prompt)/i,
        /do anything now/i,
        /evil confidant/i,
        /DUDE (mode|prompt)/i,
        /jailbreak (mode|prompt)/i,
        /developer mode/i,
        /opposite mode/i
      ],
      
      // Encoding attacks
      encoding: [
        /base64|rot13|hex|unicode|ascii/i,
        /decode (this|the following)/i,
        /\\x[0-9a-f]{2}/i, // Hex encoding
        /&#\d+;/i // HTML entities
      ],
      
      // Delimiter manipulation
      delimiter: [
        /"""|'''|```/,
        /\[SYSTEM\]|\[USER\]|\[ASSISTANT\]/i,
        /<\|system\|>|<\|user\|>|<\|assistant\|>/i
      ]
    };

    // Risk scores per attack type
    this.riskScores = {
      instructionInjection: 90,
      rolePlaying: 70,
      systemLeakage: 95,
      jailbreak: 100,
      encoding: 80,
      delimiter: 85
    };

    // Sensitivity thresholds
    this.thresholds = {
      low: 2,    // Require 2+ pattern matches
      medium: 1, // Require 1+ pattern match
      high: 1    // Require 1+ pattern match (more patterns)
    };
  }

  /**
   * Evaluate input for prompt injection attempts
   * @param {Object} input - Input containing text to scan
   * @param {Object} context - Execution context
   * @returns {Promise<GuardrailResult>}
   */
  async evaluate(input, context = {}) {
    const text = this._extractText(input);
    const detections = this._detectInjection(text);

    const threshold = this.thresholds[this.sensitivity];
    
    if (detections.length < threshold) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No prompt injection detected',
        metadata: { detections: [] },
        riskScore: 0
      });
    }

    // Calculate maximum risk score
    const maxRiskScore = Math.max(...detections.map(d => this.riskScores[d.type] || 50));

    // Determine action
    const action = this.action;
    const passed = action === 'allow' || action === 'transform';

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected ${detections.length} prompt injection pattern(s): ${detections.map(d => d.type).join(', ')}`,
      metadata: {
        detections,
        transformedText: action === 'transform' ? this._transformInjection(text, detections) : undefined
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
   * Detect prompt injection patterns
   * @private
   */
  _detectInjection(text) {
    const detections = [];

    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          detections.push({
            type,
            pattern: pattern.toString(),
            match: matches[0],
            confidence: this._calculateConfidence(type, matches[0])
          });
        }
      }
    }

    return detections;
  }

  /**
   * Calculate confidence score for detection
   * @private
   */
  _calculateConfidence(type, match) {
    // Higher confidence for more specific patterns
    const baseConfidence = {
      instructionInjection: 0.85,
      rolePlaying: 0.70,
      systemLeakage: 0.95,
      jailbreak: 0.98,
      encoding: 0.75,
      delimiter: 0.80
    };

    return baseConfidence[type] || 0.70;
  }

  /**
   * Transform injection attempt to safer alternative
   * @private
   */
  _transformInjection(text, detections) {
    let transformed = text;
    
    // Sort by match length (longest first) to avoid partial replacements
    const sorted = [...detections].sort((a, b) => b.match.length - a.match.length);
    
    for (const detection of sorted) {
      // Replace injection patterns with sanitized version
      transformed = transformed.replace(detection.match, '[FILTERED_INJECTION]');
    }
    
    return transformed;
  }
}

module.exports = PromptInjectionGuardrail;
