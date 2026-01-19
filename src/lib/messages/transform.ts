/**
 * Centralized message transformation utilities.
 *
 * Message formats in the system:
 * 1. UIMessage - Frontend format with parts, iterations, stats (useForgeChat)
 * 2. APIMessage - Backend internal format with role: user/assistant/tool
 * 3. ModelMessage - AI SDK format for LLM calls
 * 4. DBMessage - Database storage format with iterations
 */

import type { ModelMessage } from 'ai';

// ============================================================================
// Type Definitions
// ============================================================================

/** Frontend message format used in useForgeChat */
export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  rawContent: string;
  iterations?: AgentIteration[];
  // parts, timestamp, stats omitted - not needed for transformation
}

/** Single iteration of the agentic loop */
export interface AgentIteration {
  rawContent: string;
  toolOutput?: string;
}

/** Message part types stored in the database */
export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'agent-tool'; toolName: string; toolArgs: Record<string, unknown>; content: string };

/** Backend API route internal format */
export interface APIMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

/** Database storage format (matches UIMessage structure) */
export interface DBMessage {
  role: 'user' | 'assistant';
  rawContent: string;
  iterations?: AgentIteration[];
  parts?: MessagePart[];
}

// ============================================================================
// Flattening: Expand iterations into sequential messages
// ============================================================================

/**
 * Expand a message with iterations into a flat sequence of messages.
 * This is the core transformation used by multiple consumers.
 *
 * For user messages: returns single message
 * For assistant messages with iterations: returns [assistant, tool?, assistant, tool?, ...]
 */
export function expandIterations(
  message: DBMessage | UIMessage,
  toolMessageRole: 'user' | 'tool' = 'user',
  toolPrefix: string = '[Shell Output]\n'
): APIMessage[] {
  const result: APIMessage[] = [];

  if (message.role === 'user') {
    result.push({ role: 'user', content: message.rawContent });
  } else if (message.iterations && message.iterations.length > 0) {
    for (const iter of message.iterations) {
      result.push({ role: 'assistant', content: iter.rawContent });
      if (iter.toolOutput) {
        result.push({
          role: toolMessageRole,
          content: toolPrefix + iter.toolOutput,
        });
      }
    }
  }
  // Skip assistant messages without iterations (legacy/incomplete)

  return result;
}

/**
 * Expand an array of messages with iterations into flat API messages.
 */
export function expandAllIterations(
  messages: Array<DBMessage | UIMessage>,
  toolMessageRole: 'user' | 'tool' = 'user',
  toolPrefix: string = '[Shell Output]\n'
): APIMessage[] {
  return messages.flatMap((m) => expandIterations(m, toolMessageRole, toolPrefix));
}

// ============================================================================
// Format Conversions
// ============================================================================

/**
 * Convert API messages to AI SDK ModelMessage format.
 * Used by the agent route to prepare messages for LLM calls.
 */
export function toModelMessages(messages: APIMessage[]): ModelMessage[] {
  return messages.map((m): ModelMessage => {
    if (m.role === 'user') {
      return { role: 'user', content: m.content };
    }
    if (m.role === 'assistant') {
      return { role: 'assistant', content: m.content };
    }
    // Tool results - convert to user role with prefix for models that don't support tool role
    return { role: 'user', content: m.content };
  });
}

/**
 * Convert UI messages to API request format.
 * Used by useForgeChat to send messages to the backend.
 */
export function uiToApiMessages(messages: UIMessage[]): Array<{ role: string; content: string }> {
  return expandAllIterations(messages, 'user', '[Shell Output]\n');
}

/**
 * Convert DB messages to a human-readable transcript string.
 * Used by the skill agent for transcript processing.
 *
 * Processes the `parts` array which contains the full execution history:
 * - reasoning: AI reasoning/thinking
 * - agent-tool: Tool calls with name, args, and output
 * - text: Plain text responses
 */
export function toTranscriptString(messages: DBMessage[]): string {
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
    } else if (m.iterations && m.iterations.length > 0) {
      // Fallback to iterations for legacy messages without parts
      for (const iter of m.iterations) {
        output.push(`[assistant] ${iter.rawContent}`);
        if (iter.toolOutput) {
          output.push(`[tool] ${iter.toolOutput}`);
        }
      }
    }
  }

  return output.join('\n\n');
}
