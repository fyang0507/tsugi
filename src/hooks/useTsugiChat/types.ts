/**
 * Frontend-specific types for useTsugiChat hook.
 * Intentionally uses flat interfaces for easier UI consumption.
 */
import type {
  Message as BaseMessage,
  MessageStats,
  ToolStatus,
} from '@/lib/messages/transform';

// Re-export canonical types for hook consumers
export type { MessageStats, ToolStatus };

/**
 * Frontend-friendly MessagePart interface.
 * Uses a flat structure with optional properties for easier access in UI components.
 * Compatible with the discriminated union in transform.ts.
 */
export interface MessagePart {
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

/**
 * Frontend message type with required fields for UI display.
 * Extends the base Message type with fields that are always present in the frontend.
 */
export interface Message extends Omit<BaseMessage, 'parts'> {
  id: string;           // Always present in frontend
  parts: MessagePart[]; // Always present in frontend, using flat interface
  timestamp: Date;      // Always present in frontend
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
