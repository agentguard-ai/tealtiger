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

import { Guardrail, GuardrailConfig, GuardrailResult } from './base';

interface InjectionDetection {
  type: string;
  pattern: string;
  match: string;
  confidence: number;
}

export interface PromptInjectionConfig extends GuardrailConfig {
  action?: 'block' | 'transform' | 'allow';
  sensitivity?: 'low' | 'medium' | 'high';
}

export class PromptInjectionGuardrail extends Guardrail {
  private action: 'block' | 'transform' | 'allow';
  private sensitivity: 'low' | 'medium' | 'high';
  private patterns: Record<string, RegExp[]>;
  private riskScores: Record<string, number>;
  private thresholds: Record<string, number>;

  constructor(config: PromptInjectionConfig = {}) {
    super({
      name: 'PromptInjection',
      description: 'Detects prompt injection and jailbreak attempts',
      version: '1.0.0',
      ...config,
    });

    this.action = config.action || 'block';
    this.sensitivity = config.sensitivity || 'medium';

    this.patterns = {
      instructionInjection: [
        /ignore (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /disregard (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /forget (all )?(previous|above|prior) (instructions|prompts|rules)/i,
        /new (instructions|task|prompt):/i,
        /system (prompt|message|instruction):/i,
      ],
      rolePlaying: [
        /you are now (a|an) /i,
        /pretend (you are|to be) /i,
        /act as (a|an) /i,
        /roleplay as /i,
        /simulate (a|an) /i,
        /from now on,? you (are|will be)/i,
      ],
      systemLeakage: [
        /show (me )?(your|the) (system|original) (prompt|instructions)/i,
        /what (are|were) your (original|initial) (instructions|prompt)/i,
        /repeat (your|the) (system|original) (prompt|instructions)/i,
        /print (your|the) (system|original) (prompt|instructions)/i,
      ],
      jailbreak: [
        /DAN (mode|prompt)/i,
        /do anything now/i,
        /evil confidant/i,
        /DUDE (mode|prompt)/i,
        /jailbreak (mode|prompt)/i,
        /developer mode/i,
        /opposite mode/i,
      ],
      encoding: [
        /base64|rot13|hex|unicode|ascii/i,
        /decode (this|the following)/i,
        /\\x[0-9a-f]{2}/i,
        /&#\d+;/i,
      ],
      delimiter: [
        /"""|'''|```/,
        /\[SYSTEM\]|\[USER\]|\[ASSISTANT\]/i,
        /<\|system\|>|<\|user\|>|<\|assistant\|>/i,
      ],
    };

    this.riskScores = {
      instructionInjection: 90,
      rolePlaying: 70,
      systemLeakage: 95,
      jailbreak: 100,
      encoding: 80,
      delimiter: 85,
    };

    this.thresholds = {
      low: 2,
      medium: 1,
      high: 1,
    };
  }

  async evaluate(input: any, _context?: Record<string, any>): Promise<GuardrailResult> {
    const text = this.extractText(input);
    const detections = this.detectInjection(text);

    const threshold = this.thresholds[this.sensitivity];

    if (detections.length < threshold) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No prompt injection detected',
        metadata: { detections: [] },
        riskScore: 0,
      });
    }

    const maxRiskScore = Math.max(...detections.map((d) => this.riskScores[d.type] || 50));
    const action = this.action;
    const passed = action === 'allow' || action === 'transform';

    const metadata: Record<string, any> = { detections };
    if (action === 'transform') {
      metadata.transformedText = this.transformInjection(text, detections);
    }

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected ${detections.length} prompt injection pattern(s): ${detections.map((d) => d.type).join(', ')}`,
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

  private detectInjection(text: string): InjectionDetection[] {
    const detections: InjectionDetection[] = [];

    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          detections.push({
            type,
            pattern: pattern.toString(),
            match: match[0],
            confidence: this.calculateConfidence(type, match[0]),
          });
        }
      }
    }

    return detections;
  }

  private calculateConfidence(type: string, _match: string): number {
    const baseConfidence: Record<string, number> = {
      instructionInjection: 0.85,
      rolePlaying: 0.7,
      systemLeakage: 0.95,
      jailbreak: 0.98,
      encoding: 0.75,
      delimiter: 0.8,
    };

    return baseConfidence[type] || 0.7;
  }

  private transformInjection(text: string, detections: InjectionDetection[]): string {
    let transformed = text;

    // Sort by match length (longest first) to avoid partial replacements
    const sorted = [...detections].sort((a, b) => b.match.length - a.match.length);

    for (const detection of sorted) {
      transformed = transformed.replace(detection.match, '[FILTERED_INJECTION]');
    }

    return transformed;
  }
}
