/**
 * TealTiger v1.1.0 Launch Coordination System - Types
 *
 * Core type definitions for the multi-channel publication orchestrator.
 */

/** Ordered publication stages */
export type PublicationStage =
  | 'package_managers'
  | 'container_registries'
  | 'iac_platforms'
  | 'cicd_marketplaces'
  | 'lambda_registry';

/** All supported distribution channels */
export type DistributionChannel =
  | 'npm'
  | 'pypi'
  | 'ghcr'
  | 'dockerhub'
  | 'terraform'
  | 'pulumi'
  | 'helm'
  | 'ansible'
  | 'github_marketplace'
  | 'gitlab'
  | 'circleci'
  | 'azure_pipelines'
  | 'lambda_layers'
  | 'lambda_registry_website';

/** Options controlling launch behavior */
export interface LaunchOptions {
  dryRun?: boolean;
  skipValidation?: boolean;
  targetChannels?: DistributionChannel[];
  parallelizeWithinStage?: boolean;
}

/** Result of the complete launch across all stages */
export interface LaunchResult {
  version: string;
  startTime: Date;
  endTime: Date;
  stages: StageResult[];
  overallStatus: 'success' | 'partial' | 'failed';
  failedChannels: string[];
}

/** Result of executing a single publication stage */
export interface StageResult {
  stage: PublicationStage;
  status: 'success' | 'failed' | 'skipped';
  channels: ChannelResult[];
  duration: number;
  error?: string;
}

/** Result of publishing to a single distribution channel */
export interface ChannelResult {
  channel: DistributionChannel;
  status: 'success' | 'failed';
  artifactUrl?: string;
  validationResult?: ValidationResult;
  error?: string;
}

/** Result of validating a single published artifact */
export interface ValidationResult {
  channel: DistributionChannel;
  passed: boolean;
  checks: ValidationCheck[];
  duration: number;
  error?: string;
}

/** Individual validation check within a channel validation */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

/** Publisher interface that each stage publisher must implement */
export interface Publisher {
  publish(version: string, dryRun?: boolean): Promise<ChannelResult[]>;
}

/** Formatted launch report */
export interface LaunchReport {
  version: string;
  status: 'success' | 'partial' | 'failed';
  summary: LaunchSummary;
  stages: StageReport[];
  timeline: TimelineEvent[];
  recommendations: string[];
  generatedAt: Date;
}

/** Summary statistics for the launch */
export interface LaunchSummary {
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  totalDuration: number;
  artifactsPublished: number;
}

/** Per-stage report entry */
export interface StageReport {
  stage: PublicationStage;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  channels: ChannelReport[];
}

/** Per-channel report entry */
export interface ChannelReport {
  channel: DistributionChannel;
  status: 'success' | 'failed';
  artifactUrl?: string;
  error?: string;
}

/** Timeline event for launch progress tracking */
export interface TimelineEvent {
  timestamp: Date;
  event: string;
  channel?: DistributionChannel;
  status: 'info' | 'success' | 'warning' | 'error';
  details?: string;
}

/**
 * Mapping from publication stage to the channels it contains.
 */
export const STAGE_CHANNELS: Record<PublicationStage, DistributionChannel[]> = {
  package_managers: ['npm', 'pypi'],
  container_registries: ['ghcr', 'dockerhub'],
  iac_platforms: ['terraform', 'pulumi', 'helm', 'ansible'],
  cicd_marketplaces: ['github_marketplace', 'gitlab', 'circleci', 'azure_pipelines'],
  lambda_registry: ['lambda_layers', 'lambda_registry_website'],
};

/** The required sequential ordering of publication stages */
export const STAGE_ORDER: PublicationStage[] = [
  'package_managers',
  'container_registries',
  'iac_platforms',
  'cicd_marketplaces',
  'lambda_registry',
];

/** Credentials retrieved for a specific distribution channel */
export interface ChannelCredentials {
  channel: DistributionChannel;
  type: 'token' | 'api_key' | 'username_password' | 'aws_credentials';
  credentials: Record<string, string>;
  expiresAt?: Date;
  lastRotated?: Date;
}

/** Status of credential rotation for a channel */
export interface CredentialRotationStatus {
  channel: DistributionChannel;
  lastRotated: Date;
  needsRotation: boolean;
  daysUntilExpiry: number;
}

// ── Error Handling Types ──────────────────────────────────────────

/** Error categories for the launch system */
export type ErrorCategory = 'pre_flight' | 'publication' | 'validation' | 'rollback';

/** Context provided when handling an error */
export interface ErrorContext {
  category: ErrorCategory;
  channel?: DistributionChannel;
  stage?: PublicationStage;
  attemptNumber: number;
  maxRetries: number;
  operation?: string;
}

/** Action the error handler recommends */
export type ErrorAction = 'halt' | 'retry' | 'rollback' | 'report';

/** Response from the error handler */
export interface ErrorResponse {
  action: ErrorAction;
  message: string;
  retryable: boolean;
  delay?: number;
  category: ErrorCategory;
}

/** Configuration for retry behavior */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Interface for error recovery strategies */
export interface ErrorRecoveryStrategy {
  canRecover(error: Error): boolean;
  getRecommendedDelay(error: Error): number;
}
