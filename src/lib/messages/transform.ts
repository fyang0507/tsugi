/**
 * Centralized message transformation utilities.
 *
 * Message formats in the system:
 * 1. UIMessage - Frontend format with parts, stats (useTsugiChat)
 * 2. ModelMessage - AI SDK format for LLM calls (with proper tool-call/tool-result structure)
 * 3. DBMessage - Database storage format with parts
 */

import type {
  ModelMessage,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from 'ai';

// ============================================================================
// Type Definitions
// ============================================================================

/** Tool execution status for streaming updates */
export type ToolStatus = 'queued' | 'running' | 'completed';

/** Token and timing statistics for a message */
export interface MessageStats {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  executionTimeMs?: number;
  tokensUnavailable?: boolean;
}

/** Message part types stored in the database */
export type MessagePart =
  | { type: 'text'; content: string; toolStatus?: ToolStatus }
  | { type: 'reasoning'; content: string }
  | {
      type: 'tool';  // Legacy shell tool (deprecated)
      command: string;
      commandId?: string;
      content: string;  // Result
      toolStatus?: ToolStatus;
    }
  | {
      type: 'agent-tool';  // AI SDK tools (search, url_context, shell)
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolCallId: string;
      content: string;  // Result
      toolStatus?: ToolStatus;
    }
  | {
      type: 'sources';  // Grounding citations from Gemini
      sources: Array<{ id: string; url: string; title: string }>;
    };

/**
 * Unified message type - single source of truth for all message formats.
 *
 * Used for:
 * - Frontend display (useTsugiChat)
 * - Database storage
 * - API wire format
 *
 * Field optionality:
 * - id: Required in frontend, absent in wire format
 * - parts: Always provided by frontend, may be absent in legacy data
 * - timestamp/stats/agent/rawPayload: Runtime fields populated in frontend
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  rawContent: string;
  parts?: MessagePart[];
  // Runtime fields (populated in frontend, not in wire format)
  timestamp?: Date;
  stats?: MessageStats;
  agent?: 'task' | 'skill';
  rawPayload?: unknown[];
}

// Legacy aliases for backwards compatibility
/** @deprecated Use Message instead */
export type UIMessage = Message & { id: string };
/** @deprecated Use Message instead */
export type DBMessage = Message;

// ============================================================================
// Format Conversions
// ============================================================================

/**
 * Convert messages to AI SDK ModelMessage format with proper tool structure.
 * Preserves interleaved text/tool-call/tool-result order for correct context.
 *
 * Handles interleaving: [text1, tool-call, text2] becomes:
 *   assistant: [text1, tool-call]
 *   tool: [tool-result]
 *   assistant: [text2]  ← text after tool execution starts new message
 */
export function toModelMessages(messages: Message[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      result.push({ role: 'user', content: message.rawContent });
      continue;
    }

    // Skip messages with no parts (legacy data without parts is unsupported)
    if (!message.parts?.length) {
      continue;
    }

    // Track state for interleaving
    let currentAssistantContent: Array<TextPart | ToolCallPart> = [];
    let pendingToolResults: ToolResultPart[] = [];
    let hasToolCallsInCurrent = false;

    const flushCurrentTurn = () => {
      if (currentAssistantContent.length > 0) {
        result.push({ role: 'assistant', content: currentAssistantContent });
      }
      if (pendingToolResults.length > 0) {
        result.push({ role: 'tool', content: pendingToolResults });
      }
      currentAssistantContent = [];
      pendingToolResults = [];
      hasToolCallsInCurrent = false;
    };

    for (const part of message.parts) {
      if (part.type === 'text') {
        // If we have tool calls and results pending, flush them first
        // This ensures text after tool execution starts a new assistant message
        if (hasToolCallsInCurrent && pendingToolResults.length > 0) {
          flushCurrentTurn();
        }
        currentAssistantContent.push({ type: 'text', text: part.content });
      } else if (part.type === 'agent-tool' && part.toolCallId) {
        // Tool call goes in assistant message
        currentAssistantContent.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.toolArgs,  // AI SDK uses 'input' not 'args'
        });
        hasToolCallsInCurrent = true;
        // Tool result goes in separate tool message
        if (part.content) {
          pendingToolResults.push({
            type: 'tool-result',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: { type: 'text', value: part.content },  // AI SDK ToolResultOutput format
          });
        }
      }
      // Skip 'reasoning', 'sources', and legacy 'tool' parts - not needed for model context
    }

    // Flush any remaining content
    flushCurrentTurn();
  }

  return result;
}

/**
 * Convert messages to a human-readable transcript string.
 * Used by the skill agent for transcript processing.
 *
 * Processes the `parts` array which contains the full execution history:
 * - reasoning: AI reasoning/thinking
 * - agent-tool: Tool calls with name, args, and output
 * - text: Plain text responses
 */
export function toTranscriptString(messages: Message[]): string {
  const output: string[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      output.push(`[user] ${m.rawContent}`);
    } else if (m.parts && m.parts.length > 0) {
      // Process parts array for full execution history
      for (const part of m.parts) {
        if (part.type === 'reasoning') {
          output.push(`[reasoning] ${part.content}`);
        } else if (part.type === 'agent-tool') {
          // Format tool call with name and args
          const argsStr = JSON.stringify(part.toolArgs);
          output.push(`[tool-call] ${part.toolName}: ${argsStr}`);
          if (part.content) {
            output.push(`[tool-output] ${part.content}`);
          }
        } else if (part.type === 'text') {
          output.push(`[assistant] ${part.content}`);
        }
      }
    }
  }

  return output.join('\n\n');
}
