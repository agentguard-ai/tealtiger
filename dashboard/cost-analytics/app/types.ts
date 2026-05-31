export type AgentId = 'finance-agent' | 'support-agent' | 'admin-agent' | 'code-agent' | 'research-agent';

export type Provider = 'OpenAI' | 'Anthropic' | 'AWS Bedrock' | 'Google Vertex' | 'Mistral';

export type Granularity = 'hourly' | 'daily' | 'weekly';

export type ExportView = 'raw' | 'timeline' | 'budgets' | 'providers' | 'tools' | 'calls';

export interface CostEvent {
  id: string;
  timestamp: string;
  agent: AgentId;
  tool: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface TimelineRow {
  bucketKey: string;
  label: string;
  total: number;
  [agent: string]: string | number;
}

export interface BudgetUtilization {
  agent: AgentId;
  budgetUsd: number;
  costUsd: number;
  utilization: number;
}

export interface ProviderCost {
  provider: Provider;
  costUsd: number;
}

export interface ToolCost {
  tool: string;
  costUsd: number;
  calls: number;
}

export interface ExpensiveCall {
  id: string;
  timestamp: string;
  agent: AgentId;
  tool: string;
  provider: Provider;
  costUsd: number;
}

export interface AnomalyPoint {
  bucketKey: string;
  label: string;
  agent: AgentId;
  costUsd: number;
  threshold: number;
}
