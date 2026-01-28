/**
 * Frontend-specific types for useTsugiChat hook.
 * Aligned with AI SDK's UIMessage types for seamless integration.
 */
import type { UIMessage as BaseUIMessage, UIMessagePart } from 'ai';
import type { MessageStats } from '@/lib/messages/transform';

// Re-export canonical types for hook consumers
export type { MessageStats };

/**
 * Sandbox lifecycle status events.
 *
 * Lifecycle:
 * - sandbox_created: New sandbox was created for this conversation
 * - sandbox_active: Reconnected to existing sandbox (legacy, treated same as created)
 * - sandbox_terminated: Sandbox was stopped (user abort or explicit cleanup)
 * - sandbox_timeout: Sandbox timed out due to inactivity (10 min idle)
 */
export type SandboxStatusType =
  | 'sandbox_created'
  | 'sandbox_active'
  | 'sandbox_terminated'
  | 'sandbox_timeout';

export interface SandboxData {
  status: SandboxStatusType;
  sandboxId?: string;
  reason?: string;
}

export interface UsageData {
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    cachedContentTokenCount?: number;
    reasoningTokens?: number;
  } | null;
  executionTimeMs: number;
  agent: 'task' | 'skill';
}

/**
 * Custom data types for AI SDK useChat.
 */
export type TsugiDataTypes = {
  sandbox: SandboxData;
  usage: UsageData;
};

/**
 * Message metadata stored alongside messages.
 */
export interface MessageMetadata {
  agent?: 'task' | 'skill';
  stats?: MessageStats;
  rawPayload?: unknown[];
}

/**
 * Frontend message type - extends UIMessage with metadata and custom data types.
 * The message ID and parts come from AI SDK, metadata is added by our hook.
 */
export type Message = BaseUIMessage<MessageMetadata, TsugiDataTypes>;

/**
 * Message part type for our custom message type.
 */
export type MessagePart = UIMessagePart<TsugiDataTypes, Record<string, never>>;

/**
 * Tool status for backward compatibility with existing components.
 * Maps to AI SDK tool states.
 */
export type ToolStatus = 'queued' | 'running' | 'completed';

/**
 * Legacy MessagePart interface for backward compatibility.
 * Components should migrate to using AI SDK part types directly.
 * @deprecated Use AI SDK UIMessagePart types instead
 */
export interface LegacyMessagePart {
  type: 'text' | 'reasoning' | 'tool' | 'agent-tool' | 'sources';
  content: string;
  command?: string;
  commandId?: string;
  toolStatus?: ToolStatus;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  sources?: Array<{ id: string; url: string; title: string }>;
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
  tokensUnavailableCount: number;
}

export type ChatStatus = 'ready' | 'streaming' | 'error';
export type SandboxStatus = 'disconnected' | 'connected';

export interface UseTsugiChatOptions {
  initialMessages?: Message[];
  onMessageComplete?: (message: Message, index: number) => void;
}
