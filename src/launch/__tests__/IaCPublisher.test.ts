/**
 * Unit tests for IaCPublisher
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 15.5
 */
import {
  IaCPublisher,
  REQUIRED_DEPLOYMENT_TARGETS,
  PULUMI_LANGUAGES,
} from '../IaCPublisher';
import type { IaCPublisherOptions } from '../IaCPublisher';
import type { ICredentialManager } from '../CredentialManager';
import type { IErrorHandler } from '../ErrorHandler';
import type { ChannelCredentials, ErrorContext, ErrorResponse } from '../types';

// ── Test helpers ───────────────────────────────────────────────────

function mockCredentialManager(overrides: Partial<ICredentialManager> = {}): ICredentialManager {
  return {
    getCredentials: jest.fn().mockImplementation((channel: string) => {
      const credMap: Record<string, ChannelCredentials> = {
        terraform: { channel: 'terraform', type: 'token', credentials: { TERRAFORM_CLOUD_TOKEN: 'tf-test-token' } },
        pulumi: { channel: 'pulumi', type: 'token', credentials: { PULUMI_ACCESS_TOKEN: 'pul-test-token' } },
        helm: { channel: 'helm', type: 'username_password', credentials: { HELM_REPO_USERNAME: 'tealtiger', HELM_REPO_PASSWORD: 'helm-pass' } },
        ansible: { channel: 'ansible', type: 'token', credentials: { ANSIBLE_GALAXY_TOKEN: 'ag-test-token' } },
      };
      return Promise.resolve(credMap[channel] ?? { channel, type: 'token', credentials: {} });
    }),
    validateAllCredentials: jest.fn().mockResolvedValue(undefined),
    checkRotationNeeded: jest.fn().mockResolvedValue([]),
    rotateCredentials: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockErrorHandler(overrides: Partial<IErrorHandler> = {}): IErrorHandler {
  return {
    handleError: jest.fn().mockImplementation((error: Error, ctx: ErrorContext): ErrorResponse => ({
      action: 'rollback',
      message: `Publication error: ${error.message}`,
      retryable: false,
      category: ctx.category,
    })),
    isRetryable: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

function makeOptions(overrides: Partial<IaCPublisherOptions> = {}): IaCPublisherOptions {
  return {
    credentialManager: mockCredentialManager(),
    errorHandler: mockErrorHandler(),
    dryRun: false,
    execCommand: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    getIncludedDeploymentTargets: jest.fn().mockResolvedValue([...REQUIRED_DEPLOYMENT_TARGETS]),
    readModuleVersion: jest.fn().mockResolvedValue('1.1.0'),
    ...overrides,
  };
}
