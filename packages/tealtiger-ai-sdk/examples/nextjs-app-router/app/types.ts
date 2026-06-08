import type { UIMessage } from 'ai';

export interface GovernanceMetadata {
  model: string;
  governanceApplied: boolean;
  contentModified: boolean;
  correlationId?: string;
  finishReason?: string;
  totalTokens?: number;
}

export type GovernedChatMessage = UIMessage<{
  governance?: GovernanceMetadata;
}>;
