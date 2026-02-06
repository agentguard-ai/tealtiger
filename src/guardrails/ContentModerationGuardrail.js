/**
 * Content Moderation Guardrail
 * 
 * Detects harmful content using OpenAI Moderation API:
 * - Hate speech
 * - Violence
 * - Sexual content
 * - Harassment
 * - Self-harm
 */

const { Guardrail, GuardrailResult } = require('./Guardrail');

class ContentModerationGuardrail extends Guardrail {
  constructor(config = {}) {
    super({
      name: 'ContentModeration',
      description: 'Detects harmful content using AI moderation',
      version: '1.0.0',
      ...config
    });

    // OpenAI API key for moderation (optional - can use local patterns)
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.useOpenAI = config.useOpenAI !== undefined ? config.useOpenAI : !!this.apiKey;
    
    // Configure action: 'block', 'transform', 'allow'
    this.action = config.action || 'block';
    
    // Configure thresholds for each category (0-1)
    this.thresholds = config.thresholds || {
      hate: 0.5,
      'hate/threatening': 0.5,
      'self-harm': 0.5,
      sexual: 0.5,
      'sexual/minors': 0.3,
      violence: 0.5,
      'violence/graphic': 0.5,
      harassment: 0.5,
      'harassment/threatening': 0.5
    };

    // Risk scores per category
    this.riskScores = config.riskScores || {
      hate: 70,
      'hate/threatening': 90,
      'self-harm': 85,
      sexual: 60,
      'sexual/minors': 100,
      violence: 70,
      'violence/graphic': 85,
      harassment: 60,
      'harassment/threatening': 80
    };

    // Local pattern-based detection (fallback)
    this.patterns = {
      hate: /\b(hate|racist|bigot|nazi|supremacist)\b/i,
      violence: /\b(kill|murder|assault|attack|weapon|bomb)\b/i,
      sexual: /\b(porn|xxx|explicit|nude)\b/i,
      harassment: /\b(harass(ing|ment)?|bully|threaten|intimidate)\b/i,
      'self-harm': /\b(suicide|self-harm|cut myself)\b/i
    };
  }

  /**
   * Evaluate input for harmful content
   * @param {Object} input - Input containing text to moderate
   * @param {Object} context - Execution context
   * @returns {Promise<GuardrailResult>}
   */
  async evaluate(input, context = {}) {
    const text = this._extractText(input);

    let violations;
    
    if (this.useOpenAI && this.apiKey) {
      violations = await this._moderateWithOpenAI(text);
    } else {
      violations = this._moderateWithPatterns(text);
    }

    if (violations.length === 0) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No harmful content detected',
        metadata: { violations: [] },
        riskScore: 0
      });
    }

    // Calculate maximum risk score
    const maxRiskScore = Math.max(...violations.map(v => this.riskScores[v.category] || 50));

    // Determine action
    const action = this.action;
    const passed = action === 'allow' || action === 'transform';

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected harmful content: ${violations.map(v => v.category).join(', ')}`,
      metadata: {
        violations,
        transformedText: action === 'transform' ? this._transformContent(text) : undefined
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
   * Moderate content using OpenAI Moderation API
   * @private
   */
  async _moderateWithOpenAI(text) {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ input: text })
      });

      if (!response.ok) {
        console.error('[ContentModeration] OpenAI API error, falling back to patterns');
        return this._moderateWithPatterns(text);
      }

      const data = await response.json();
      const result = data.results[0];

      const violations = [];
      for (const [category, flagged] of Object.entries(result.categories)) {
        if (flagged) {
          const score = result.category_scores[category];
          const threshold = this.thresholds[category] || 0.5;
          
          if (score >= threshold) {
            violations.push({
              category,
              score,
              threshold,
              flagged: true
            });
          }
        }
      }

      return violations;
    } catch (error) {
      console.error('[ContentModeration] Error calling OpenAI API:', error.message);
      return this._moderateWithPatterns(text);
    }
  }

  /**
   * Moderate content using local pattern matching (fallback)
   * @private
   */
  _moderateWithPatterns(text) {
    const violations = [];

    for (const [category, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(text)) {
        violations.push({
          category,
          score: 0.8, // Assume high confidence for pattern matches
          threshold: this.thresholds[category] || 0.5,
          flagged: true,
          method: 'pattern'
        });
      }
    }

    return violations;
  }

  /**
   * Transform harmful content to safer alternative
   * @private
   */
  _transformContent(text) {
    // Simple transformation: replace harmful words with [FILTERED]
    let transformed = text;
    
    for (const pattern of Object.values(this.patterns)) {
      transformed = transformed.replace(pattern, '[FILTERED]');
    }
    
    return transformed;
  }
}

module.exports = ContentModerationGuardrail;
