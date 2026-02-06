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

import { Guardrail, GuardrailConfig, GuardrailResult } from './base';

interface ContentViolation {
  category: string;
  score: number;
  threshold: number;
  flagged: boolean;
  method?: string;
}

export interface ContentModerationConfig extends GuardrailConfig {
  apiKey?: string;
  useOpenAI?: boolean;
  action?: 'block' | 'transform' | 'allow';
  thresholds?: Record<string, number>;
  riskScores?: Record<string, number>;
}

export class ContentModerationGuardrail extends Guardrail {
  private apiKey: string | undefined;
  private useOpenAI: boolean;
  private action: 'block' | 'transform' | 'allow';
  private thresholds: Record<string, number>;
  private riskScores: Record<string, number>;
  private patterns: Record<string, RegExp>;

  constructor(config: ContentModerationConfig = {}) {
    super({
      name: 'ContentModeration',
      description: 'Detects harmful content using AI moderation',
      version: '1.0.0',
      ...config,
    });

    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    this.useOpenAI = config.useOpenAI !== undefined ? config.useOpenAI : !!this.apiKey;
    this.action = config.action || 'block';

    this.thresholds = config.thresholds || {
      hate: 0.5,
      'hate/threatening': 0.5,
      'self-harm': 0.5,
      sexual: 0.5,
      'sexual/minors': 0.3,
      violence: 0.5,
      'violence/graphic': 0.5,
      harassment: 0.5,
      'harassment/threatening': 0.5,
    };

    this.riskScores = config.riskScores || {
      hate: 70,
      'hate/threatening': 90,
      'self-harm': 85,
      sexual: 60,
      'sexual/minors': 100,
      violence: 70,
      'violence/graphic': 85,
      harassment: 60,
      'harassment/threatening': 80,
    };

    this.patterns = {
      hate: /\b(hate|racist|bigot|nazi|supremacist)\b/i,
      violence: /\b(kill|murder|assault|attack|weapon|bomb)\b/i,
      sexual: /\b(porn|xxx|explicit|nude)\b/i,
      harassment: /\b(harass(ing|ment)?|bully|threaten|intimidate)\b/i,
      'self-harm': /\b(suicide|self-harm|cut myself)\b/i,
    };
  }

  async evaluate(input: any, _context?: Record<string, any>): Promise<GuardrailResult> {
    const text = this.extractText(input);

    let violations: ContentViolation[];

    if (this.useOpenAI && this.apiKey) {
      violations = await this.moderateWithOpenAI(text);
    } else {
      violations = this.moderateWithPatterns(text);
    }

    if (violations.length === 0) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No harmful content detected',
        metadata: { violations: [] },
        riskScore: 0,
      });
    }

    const maxRiskScore = Math.max(...violations.map((v) => this.riskScores[v.category] || 50));
    const action = this.action;
    const passed = action === 'allow' || action === 'transform';

    const metadata: Record<string, any> = { violations };
    if (action === 'transform') {
      metadata.transformedText = this.transformContent(text);
    }

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected harmful content: ${violations.map((v) => v.category).join(', ')}`,
      metadata,
      riskScore: maxRiskScore,
    });
  }

  private extractText(input: any): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input.prompt) {
      return input.prompt;
    }

    if (input.messages && Array.isArray(input.messages)) {
      return input.messages.map((m: any) => m.content || '').join(' ');
    }

    if (input.text) {
      return input.text;
    }

    return JSON.stringify(input);
  }

  private async moderateWithOpenAI(text: string): Promise<ContentViolation[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ input: text }),
      });

      if (!response.ok) {
        console.error('[ContentModeration] OpenAI API error, falling back to patterns');
        return this.moderateWithPatterns(text);
      }

      const data = await response.json();
      const result = (data as any).results[0];

      const violations: ContentViolation[] = [];
      for (const [category, flagged] of Object.entries(result.categories)) {
        if (flagged) {
          const score = result.category_scores[category];
          const threshold = this.thresholds[category] || 0.5;

          if (score >= threshold) {
            violations.push({
              category,
              score,
              threshold,
              flagged: true,
            });
          }
        }
      }

      return violations;
    } catch (error) {
      console.error('[ContentModeration] Error calling OpenAI API:', error);
      return this.moderateWithPatterns(text);
    }
  }

  private moderateWithPatterns(text: string): ContentViolation[] {
    const violations: ContentViolation[] = [];

    for (const [category, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(text)) {
        violations.push({
          category,
          score: 0.8,
          threshold: this.thresholds[category] || 0.5,
          flagged: true,
          method: 'pattern',
        });
      }
    }

    return violations;
  }

  private transformContent(text: string): string {
    let transformed = text;

    for (const pattern of Object.values(this.patterns)) {
      transformed = transformed.replace(pattern, '[FILTERED]');
    }

    return transformed;
  }
}
