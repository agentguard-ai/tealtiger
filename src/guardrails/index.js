/**
 * Guardrail System - Main Export
 * 
 * Provides the complete guardrail architecture including base interfaces,
 * execution engine, registry, caching, and built-in guardrails.
 */

const { Guardrail, GuardrailResult } = require('./Guardrail');
const { GuardrailEngine, GuardrailEngineResult } = require('./GuardrailEngine');
const { GuardrailRegistry, registry } = require('./GuardrailRegistry');
const { GuardrailCache } = require('./GuardrailCache');

// Built-in guardrails
const PIIDetectionGuardrail = require('./PIIDetectionGuardrail');
const ContentModerationGuardrail = require('./ContentModerationGuardrail');
const PromptInjectionGuardrail = require('./PromptInjectionGuardrail');

module.exports = {
  // Base classes
  Guardrail,
  GuardrailResult,
  
  // Engine
  GuardrailEngine,
  GuardrailEngineResult,
  
  // Registry
  GuardrailRegistry,
  registry, // Singleton instance
  
  // Cache
  GuardrailCache,
  
  // Built-in guardrails
  PIIDetectionGuardrail,
  ContentModerationGuardrail,
  PromptInjectionGuardrail
};

