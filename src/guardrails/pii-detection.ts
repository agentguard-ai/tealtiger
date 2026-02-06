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

import { Guardrail, GuardrailConfig, GuardrailResult } from './base';

interface PIIDetection {
  type: string;
  value: string;
  position: number;
  length: number;
}

export interface PIIDetectionConfig extends GuardrailConfig {
  detectTypes?: string[];
  action?: 'block' | 'redact' | 'mask' | 'allow';
  riskScores?: Record<string, number>;
}

export class PIIDetectionGuardrail extends Guardrail {
  private patterns: Record<string, RegExp>;
  private detectTypes: string[];
  private action: 'block' | 'redact' | 'mask' | 'allow';
  private riskScores: Record<string, number>;

  constructor(config: PIIDetectionConfig = {}) {
    super({
      name: 'PIIDetection',
      description: 'Detects personally identifiable information in text',
      version: '1.0.0',
      ...config,
    });

    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    };

    this.detectTypes = config.detectTypes || ['email', 'phone', 'ssn', 'creditCard'];
    this.action = config.action || 'block';
    this.riskScores = config.riskScores || {
      email: 30,
      phone: 40,
      ssn: 90,
      creditCard: 95,
      name: 20,
    };
  }

  async evaluate(input: any, _context?: Record<string, any>): Promise<GuardrailResult> {
    const text = this.extractText(input);
    const detections = this.detectPII(text);

    if (detections.length === 0) {
      return new GuardrailResult({
        passed: true,
        action: 'allow',
        reason: 'No PII detected',
        metadata: { detections: [] },
        riskScore: 0,
      });
    }

    const maxRiskScore = Math.max(...detections.map((d) => this.riskScores[d.type] || 50));
    const action = this.action;
    const passed = action === 'allow' || action === 'redact' || action === 'mask';

    const metadata: Record<string, any> = { detections };
    if (action === 'redact') {
      metadata.redactedText = this.redactPII(text, detections);
    } else if (action === 'mask') {
      metadata.maskedText = this.maskPII(text, detections);
    }

    return new GuardrailResult({
      passed,
      action,
      reason: `Detected ${detections.length} PII instance(s): ${detections.map((d) => d.type).join(', ')}`,
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

  private detectPII(text: string): PIIDetection[] {
    const detections: PIIDetection[] = [];

    for (const type of this.detectTypes) {
      const pattern = this.patterns[type];
      if (!pattern) continue;

      // Reset regex lastIndex
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        detections.push({
          type,
          value: match[0],
          position: match.index,
          length: match[0].length,
        });
      }
    }

    return detections;
  }

  private redactPII(text: string, detections: PIIDetection[]): string {
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

  private maskPII(text: string, detections: PIIDetection[]): string {
    let masked = text;

    // Sort by position in reverse to maintain indices
    const sorted = [...detections].sort((a, b) => b.position - a.position);

    for (const detection of sorted) {
      const before = masked.substring(0, detection.position);
      const after = masked.substring(detection.position + detection.length);
      masked = before + '*'.repeat(detection.length) + after;
    }

    return masked;
  }
}
