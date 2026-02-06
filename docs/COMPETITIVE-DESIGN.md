# Competitive Features Design Document

## Overview

This document outlines the technical design for implementing competitive features identified through market analysis. These features are critical for maintaining market position against established players like @openai/guardrails, Agent Action Firewall, and others.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AgentGuard SDK v2.0                         │
├─────────────────────────────────────────────────────────────────┤
│  Drop-in Client Wrappers                                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ GuardedOpenAI   │ │GuardedAnthropic │ │GuardedAzureOAI  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Built-in Guardrails Library                                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ PII Detection   │ │Content Moderation│ │Prompt Injection │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Cost Monitoring & Budget Enforcement                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Cost Tracker    │ │Budget Enforcer  │ │Cost Analytics   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Core AgentGuard SDK (Existing)                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ SSA Client      │ │ Policy Engine   │ │ Audit Logger    │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Designs

### 1. Drop-in Client Wrappers

#### 1.1 GuardedOpenAI Design

```typescript
// packages/agent-guard-sdk/src/clients/GuardedOpenAI.ts
import OpenAI from 'openai';
import { AgentGuard } from '../core/AgentGuard';

export class GuardedOpenAI extends OpenAI {
  private agentGuard: AgentGuard;
  private costTracker: CostTracker;

  constructor(config: GuardedOpenAIConfig) {
    super({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      ...config.openaiConfig
    });
    
    this.agentGuard = new AgentGuard(config.agentGuard);
    this.costTracker = new CostTracker(config.costConfig);
  }

  async chat.completions.create(params: ChatCompletionCreateParams) {
    // Pre-execution security evaluation
    const securityResult = await this.agentGuard.evaluateTool(
      'openai-chat-completion',
      params
    );

    if (securityResult.action === 'deny') {
      throw new SecurityDeniedError(securityResult.reason);
    }

    // Apply transformations if needed
    const finalParams = securityResult.action === 'transform' 
      ? securityResult.transformedRequest.parameters 
      : params;

    // Execute with cost tracking
    const startTime = Date.now();
    const response = await super.chat.completions.create(finalParams);
    const endTime = Date.now();

    // Track costs
    await this.costTracker.recordUsage({
      provider: 'openai',
      model: params.model,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      duration: endTime - startTime
    });

    // Add security metadata to response
    return {
      ...response,
      agentguard_metadata: {
        security_decision: securityResult,
        cost_info: this.costTracker.getLastCost(),
        evaluation_time: endTime - startTime
      }
    };
  }
}
```

#### 1.2 Configuration Schema

```typescript
interface GuardedOpenAIConfig {
  apiKey: string;
  baseURL?: string;
  openaiConfig?: Partial<OpenAI.ClientOptions>;
  agentGuard: {
    apiKey: string;
    ssaUrl: string;
    guardrails?: GuardrailConfig[];
    budget?: BudgetConfig;
  };
  costConfig?: CostTrackingConfig;
}

interface GuardrailConfig {
  name: string;
  type: 'pii-detection' | 'content-moderation' | 'prompt-injection';
  config: Record<string, any>;
  enabled: boolean;
}

interface BudgetConfig {
  daily?: number;
  weekly?: number;
  monthly?: number;
  autoKill?: boolean;
  alerts?: AlertConfig[];
}
```

### 2. Built-in Guardrails Library

#### 2.1 Guardrail Architecture

```typescript
// packages/agent-guard-sdk/src/guardrails/base/Guardrail.ts
export abstract class Guardrail {
  abstract name: string;
  abstract version: string;
  
  abstract evaluate(
    input: GuardrailInput
  ): Promise<GuardrailResult>;
  
  abstract configure(config: Record<string, any>): void;
}

export interface GuardrailInput {
  text: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface GuardrailResult {
  passed: boolean;
  confidence: number;
  reason?: string;
  details?: Record<string, any>;
  suggestions?: string[];
}
```

#### 2.2 PII Detection Implementation

```typescript
// packages/agent-guard-sdk/src/guardrails/PIIDetectionGuardrail.ts
export class PIIDetectionGuardrail extends Guardrail {
  name = 'pii-detection';
  version = '1.0.0';
  
  private patterns: Map<string, RegExp>;
  private mlModel?: PIIMLModel;

  constructor(config: PIIConfig) {
    super();
    this.configure(config);
  }

  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const detectedPII: PIIMatch[] = [];
    
    // Pattern-based detection
    for (const [type, pattern] of this.patterns) {
      const matches = input.text.match(pattern);
      if (matches) {
        detectedPII.push({
          type,
          value: matches[0],
          confidence: 0.9,
          position: input.text.indexOf(matches[0])
        });
      }
    }
    
    // ML-based detection (if available)
    if (this.mlModel) {
      const mlResults = await this.mlModel.detect(input.text);
      detectedPII.push(...mlResults);
    }
    
    return {
      passed: detectedPII.length === 0,
      confidence: this.calculateConfidence(detectedPII),
      reason: detectedPII.length > 0 
        ? `Detected PII: ${detectedPII.map(p => p.type).join(', ')}`
        : undefined,
      details: {
        detected_pii: detectedPII,
        redacted_text: this.redactPII(input.text, detectedPII)
      }
    };
  }

  configure(config: PIIConfig): void {
    this.patterns = new Map();
    
    if (config.detectEmail) {
      this.patterns.set('EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    }
    
    if (config.detectPhone) {
      this.patterns.set('PHONE', /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g);
    }
    
    if (config.detectSSN) {
      this.patterns.set('SSN', /\b\d{3}-\d{2}-\d{4}\b/g);
    }
    
    // Initialize ML model if configured
    if (config.useMLModel) {
      this.mlModel = new PIIMLModel(config.mlConfig);
    }
  }
}
```

#### 2.3 Guardrail Registry

```typescript
// packages/agent-guard-sdk/src/guardrails/GuardrailRegistry.ts
export class GuardrailRegistry {
  private static instance: GuardrailRegistry;
  private guardrails: Map<string, typeof Guardrail> = new Map();
  
  static getInstance(): GuardrailRegistry {
    if (!GuardrailRegistry.instance) {
      GuardrailRegistry.instance = new GuardrailRegistry();
    }
    return GuardrailRegistry.instance;
  }
  
  register(name: string, guardrailClass: typeof Guardrail): void {
    this.guardrails.set(name, guardrailClass);
  }
  
  create(name: string, config: Record<string, any>): Guardrail {
    const GuardrailClass = this.guardrails.get(name);
    if (!GuardrailClass) {
      throw new Error(`Guardrail '${name}' not found`);
    }
    return new GuardrailClass(config);
  }
  
  list(): string[] {
    return Array.from(this.guardrails.keys());
  }
}

// Built-in guardrails registration
const registry = GuardrailRegistry.getInstance();
registry.register('pii-detection', PIIDetectionGuardrail);
registry.register('content-moderation', ContentModerationGuardrail);
registry.register('prompt-injection', PromptInjectionGuardrail);
```

### 3. Cost Monitoring System

#### 3.1 Cost Tracker Design

```typescript
// packages/agent-guard-sdk/src/monitoring/CostTracker.ts
export class CostTracker {
  private storage: CostStorage;
  private pricingEngine: PricingEngine;
  private budgetEnforcer: BudgetEnforcer;

  constructor(config: CostTrackingConfig) {
    this.storage = new CostStorage(config.storage);
    this.pricingEngine = new PricingEngine(config.pricing);
    this.budgetEnforcer = new BudgetEnforcer(config.budget);
  }

  async recordUsage(usage: APIUsage): Promise<CostRecord> {
    // Calculate cost
    const cost = await this.pricingEngine.calculateCost(usage);
    
    // Create cost record
    const record: CostRecord = {
      id: generateId(),
      timestamp: new Date(),
      agentId: usage.agentId,
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.inputTokens + usage.outputTokens,
      cost: cost,
      currency: 'USD'
    };
    
    // Store record
    await this.storage.store(record);
    
    // Check budget constraints
    await this.budgetEnforcer.checkAndEnforce(record);
    
    return record;
  }

  async getCostSummary(
    agentId: string, 
    period: TimePeriod
  ): Promise<CostSummary> {
    const records = await this.storage.query({
      agentId,
      startDate: period.start,
      endDate: period.end
    });

    return {
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
      totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
      requestCount: records.length,
      averageCostPerRequest: records.length > 0 
        ? records.reduce((sum, r) => sum + r.cost, 0) / records.length 
        : 0,
      breakdown: this.generateBreakdown(records)
    };
  }
}
```

#### 3.2 Budget Enforcement

```typescript
// packages/agent-guard-sdk/src/monitoring/BudgetEnforcer.ts
export class BudgetEnforcer {
  private budgets: Map<string, BudgetConfig>;
  private alertManager: AlertManager;

  async checkAndEnforce(record: CostRecord): Promise<void> {
    const budget = this.budgets.get(record.agentId);
    if (!budget) return;

    const currentSpend = await this.getCurrentSpend(record.agentId);
    
    // Check daily budget
    if (budget.daily && currentSpend.daily >= budget.daily) {
      await this.handleBudgetExceeded('daily', record.agentId, currentSpend.daily, budget.daily);
    }
    
    // Check weekly budget
    if (budget.weekly && currentSpend.weekly >= budget.weekly) {
      await this.handleBudgetExceeded('weekly', record.agentId, currentSpend.weekly, budget.weekly);
    }
    
    // Check monthly budget
    if (budget.monthly && currentSpend.monthly >= budget.monthly) {
      await this.handleBudgetExceeded('monthly', record.agentId, currentSpend.monthly, budget.monthly);
    }
    
    // Check threshold alerts
    await this.checkThresholdAlerts(record.agentId, currentSpend, budget);
  }

  private async handleBudgetExceeded(
    period: string, 
    agentId: string, 
    current: number, 
    limit: number
  ): Promise<void> {
    // Send alert
    await this.alertManager.sendAlert({
      type: 'budget_exceeded',
      agentId,
      period,
      currentSpend: current,
      budgetLimit: limit,
      timestamp: new Date()
    });

    // Auto-kill if configured
    const budget = this.budgets.get(agentId);
    if (budget?.autoKill) {
      await this.killAgent(agentId);
    }
  }

  private async killAgent(agentId: string): Promise<void> {
    // Implementation depends on deployment environment
    // Could be process termination, container shutdown, etc.
    throw new BudgetExceededError(`Agent ${agentId} terminated due to budget exceeded`);
  }
}
```

### 4. Human Approval Workflows

#### 4.1 Approval Engine Design

```typescript
// packages/agent-guard-sdk/src/approval/ApprovalEngine.ts
export class ApprovalEngine {
  private workflows: Map<string, ApprovalWorkflow>;
  private notificationManager: NotificationManager;
  private approvalStorage: ApprovalStorage;

  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    // Determine workflow based on risk assessment
    const workflow = await this.selectWorkflow(request);
    
    // Create approval record
    const approval: ApprovalRecord = {
      id: generateId(),
      requestId: request.id,
      agentId: request.agentId,
      action: request.action,
      riskLevel: request.riskLevel,
      workflow: workflow.name,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + workflow.timeout)
    };
    
    await this.approvalStorage.store(approval);
    
    // Send notifications to approvers
    await this.notificationManager.notifyApprovers(approval, workflow.approvers);
    
    // Wait for approval or timeout
    return this.waitForApproval(approval.id, workflow.timeout);
  }

  private async waitForApproval(
    approvalId: string, 
    timeout: number
  ): Promise<ApprovalResult> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new ApprovalTimeoutError(`Approval ${approvalId} timed out`));
      }, timeout);

      // Poll for approval status
      const pollInterval = setInterval(async () => {
        const approval = await this.approvalStorage.get(approvalId);
        
        if (approval.status === 'approved') {
          clearTimeout(timeoutHandle);
          clearInterval(pollInterval);
          resolve({ approved: true, approver: approval.approver });
        } else if (approval.status === 'denied') {
          clearTimeout(timeoutHandle);
          clearInterval(pollInterval);
          resolve({ approved: false, reason: approval.reason });
        }
      }, 1000);
    });
  }
}
```

### 5. Enhanced Audit System

#### 5.1 Cryptographic Audit Trail

```typescript
// packages/agent-guard-sdk/src/audit/CryptographicAuditLogger.ts
export class CryptographicAuditLogger extends AuditLogger {
  private hashChain: HashChain;
  private signer: DigitalSigner;

  constructor(config: CryptoAuditConfig) {
    super(config);
    this.hashChain = new HashChain(config.hashAlgorithm);
    this.signer = new DigitalSigner(config.signingKey);
  }

  async logEntry(entry: AuditEntry): Promise<void> {
    // Add cryptographic metadata
    const cryptoEntry: CryptographicAuditEntry = {
      ...entry,
      previousHash: this.hashChain.getLastHash(),
      timestamp: new Date().toISOString(),
      nonce: generateNonce()
    };

    // Calculate hash
    const entryHash = this.hashChain.calculateHash(cryptoEntry);
    cryptoEntry.hash = entryHash;

    // Add digital signature
    cryptoEntry.signature = await this.signer.sign(entryHash);

    // Update hash chain
    this.hashChain.addHash(entryHash);

    // Store entry
    await this.storage.store(cryptoEntry);
  }

  async verifyIntegrity(startDate?: Date, endDate?: Date): Promise<IntegrityReport> {
    const entries = await this.storage.query({ startDate, endDate });
    const report: IntegrityReport = {
      totalEntries: entries.length,
      verifiedEntries: 0,
      tamperedEntries: 0,
      missingEntries: 0,
      details: []
    };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isValid = await this.verifyEntry(entry, entries[i - 1]);
      
      if (isValid) {
        report.verifiedEntries++;
      } else {
        report.tamperedEntries++;
        report.details.push({
          entryId: entry.id,
          issue: 'Hash chain broken or signature invalid'
        });
      }
    }

    return report;
  }
}
```

## Integration Points

### 1. Backward Compatibility

All new features MUST maintain backward compatibility with existing AgentGuard SDK usage:

```typescript
// Existing usage continues to work
const agentGuard = new AgentGuard({
  apiKey: 'key',
  ssaUrl: 'url'
});

// New features are opt-in
const guardedOpenAI = new GuardedOpenAI({
  apiKey: 'openai-key',
  agentGuard: {
    apiKey: 'guard-key',
    ssaUrl: 'url',
    guardrails: [
      { name: 'pii-detection', config: { detectEmail: true } }
    ]
  }
});
```

### 2. Configuration Migration

Provide migration utilities for existing configurations:

```typescript
// packages/agent-guard-sdk/src/migration/ConfigMigrator.ts
export class ConfigMigrator {
  static migrateV1ToV2(v1Config: AgentGuardConfig): GuardedClientConfig {
    return {
      agentGuard: v1Config,
      guardrails: [],
      costConfig: {
        enabled: false
      }
    };
  }
}
```

## Performance Considerations

### 1. Lazy Loading
- Guardrails should be loaded only when needed
- ML models should be initialized on first use
- Cost tracking should be asynchronous

### 2. Caching
- Guardrail results should be cached for identical inputs
- Cost calculations should be cached per model/provider
- Approval workflows should cache user preferences

### 3. Parallel Processing
- Multiple guardrails should run in parallel
- Cost tracking should not block main execution
- Audit logging should be asynchronous

## Testing Strategy

### 1. Unit Tests
- Each guardrail must have comprehensive unit tests
- Cost calculations must be tested against known values
- Approval workflows must be tested with mock notifications

### 2. Integration Tests
- Client wrappers must be tested with real provider APIs
- End-to-end security evaluation must be tested
- Budget enforcement must be tested with real cost scenarios

### 3. Performance Tests
- Latency must be measured under various loads
- Memory usage must be monitored for long-running processes
- Concurrent request handling must be validated

## Deployment Strategy

### 1. Phased Rollout
- Phase 1B: Drop-in clients and basic guardrails
- Phase 1C: Cost monitoring and approval workflows
- Phase 2: Advanced features and enterprise platform

### 2. Feature Flags
- All new features should be behind feature flags
- Gradual rollout to percentage of users
- Quick rollback capability for issues

### 3. Monitoring
- Real-time monitoring of feature adoption
- Performance metrics for new components
- Error tracking and alerting

---

This design provides a comprehensive foundation for implementing competitive features while maintaining the existing SDK's strengths and ensuring smooth migration for current users.