// Re-export main hook from parent
export { useForgeChat } from '../useForgeChat';

// Re-export types
export type {
  Message,
  MessagePart,
  CumulativeStats,
  ChatStatus,
  SandboxStatus,
  UseForgeChatOptions,
  MessageStats,
  ToolStatus,
} from './types';

// Re-export utilities
export {
  generateMessageId,
  createUserMessage,
  createInitialAssistantMessage,
  stripShellTags,
  finalizeTextPart,
} from './message-builders';

export {
  createEmptyStats,
  calculateCumulativeStats,
  updateCumulativeStats,
} from './stats-utils';
