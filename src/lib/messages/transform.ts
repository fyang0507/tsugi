/**
 * Centralized message transformation utilities.
 *
 * Message formats in the system:
 * 1. UIMessage - AI SDK format for frontend (useTsugiChat)
 * 2. ModelMessage - AI SDK format for LLM calls
 * 3. DBMessage - Database storage format
 *
 * For converting UIMessage to ModelMessage, use AI SDK's `convertToModelMessages()`.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/** Stats status for eventual consistency */
export type StatsStatus = 'pending' | 'polling' | 'resolved' | 'failed' | 'unavailable';

/** Token and timing statistics for a message */
export interface MessageStats {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  executionTimeMs?: number;
  tokensUnavailable?: boolean;
  // For eventual consistency polling
  rootSpanId?: string;
  statsStatus?: StatsStatus;
}

/**
 * AI SDK UIMessage part types.
 * The actual type is imported from 'ai' package, but these are the shapes we use.
 */
export type AISDKMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; reasoning: string }
  | {
      type: 'tool-invocation';
      toolInvocationId: string;
      toolName: string;
      args: Record<string, unknown>;
      state: 'partial-call' | 'call' | 'result';
      result?: unknown;
    }
  | { type: string; data: unknown };  // Custom data parts (data-sandbox, data-usage)

/**
 * Database message type - compatible with AI SDK UIMessage but with DB-specific fields.
 * Used for storing and retrieving messages from the database.
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  parts?: AISDKMessagePart[];
  content?: string;
  createdAt?: Date;
  rawPayload?: unknown[];
  metadata?: {
    agent?: 'task' | 'skill';
    stats?: MessageStats;
  };
}

// ============================================================================
// Format Conversions
// ============================================================================

/**
 * Convert AI SDK UIMessages to a human-readable transcript string.
 * Used by the skill agent for transcript processing.
 *
 * Processes the `parts` array which contains the full execution history:
 * - text: Plain text responses (uses .text property)
 * - reasoning: AI reasoning/thinking (uses .reasoning property)
 * - tool-invocation: Tool calls with name, args, and result
 */
export function toTranscriptString(messages: Array<{
  role: 'user' | 'assistant';
  parts?: AISDKMessagePart[];
  content?: string;
}>): string {
  const output: string[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      // User messages: extract text from first text part
      const textPart = m.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
      const userText = textPart?.text || m.content || '';
      if (userText) {
        output.push(`[user] ${userText}`);
      }
    } else if (m.parts && m.parts.length > 0) {
      // Assistant messages: process parts array for full execution history
      for (const part of m.parts) {
        if (part.type === 'text') {
          const textPart = part as { type: 'text'; text: string };
          if (textPart.text) {
            output.push(`[assistant] ${textPart.text}`);
          }
        } else if (part.type === 'reasoning') {
          const reasoningPart = part as { type: 'reasoning'; reasoning: string };
          if (reasoningPart.reasoning) {
            output.push(`[reasoning] ${reasoningPart.reasoning}`);
          }
        } else if (part.type === 'tool-invocation') {
          const toolPart = part as {
            type: 'tool-invocation';
            toolName: string;
            args: Record<string, unknown>;
            state: string;
            result?: unknown;
          };
          // Format tool call with name and args
          const argsStr = JSON.stringify(toolPart.args);
          output.push(`[tool-call] ${toolPart.toolName}: ${argsStr}`);
          // Include result if available
          if (toolPart.state === 'result' && toolPart.result !== undefined) {
            const resultStr = typeof toolPart.result === 'string'
              ? toolPart.result
              : JSON.stringify(toolPart.result);
            output.push(`[tool-output] ${resultStr}`);
          }
        }
        // Skip data parts (sandbox, usage) - not relevant for transcripts
      }
    }
  }

  return output.join('\n\n');
}
