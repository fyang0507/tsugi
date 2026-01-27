/**
 * SSE Event Types - Shared between API route and client hook
 */

export type SSEEventType =
  | 'text'
  | 'reasoning'
  | 'tool-call'
  | 'tool-start'
  | 'tool-result'
  | 'agent-tool-call'
  | 'agent-tool-result'
  | 'source'
  | 'iteration-end'
  | 'done'
  | 'error'
  | 'usage'
  | 'raw-content'
  | 'tool-output'
  | 'sandbox_timeout'
  | 'sandbox_active'
  | 'sandbox_terminated'
  | 'raw_payload';

export interface SSEEvent {
  type: SSEEventType;
  sandboxId?: string;
  content?: string;
  command?: string;
  commandId?: string;
  result?: string;
  hasMoreCommands?: boolean;
  // For agent tool calls (google_search, url_context)
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  // For source citations (Gemini grounding)
  sourceId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  // For usage stats (null when Braintrust unavailable)
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedContentTokenCount?: number;
    reasoningTokens?: number;
  } | null;
  executionTimeMs?: number;
  // For KV cache support
  rawContent?: string;
  toolOutput?: string;
  // Which agent generated this response
  agent?: 'task' | 'skill';
  // Raw stream parts from agent.stream() for debugging
  rawPayload?: unknown[];
}
