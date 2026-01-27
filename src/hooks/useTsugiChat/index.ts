// Re-export main hook
export { useTsugiChat } from './hook';

// Re-export types
export type {
  Message,
  MessagePart,
  CumulativeStats,
  ChatStatus,
  SandboxStatus,
  UseTsugiChatOptions,
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
