import type { Message, MessagePart } from './types';

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  agent: 'task' | 'skill',
  id?: string
): Message {
  return {
    id: id || generateMessageId(),
    role: 'user',
    parts: [{ type: 'text', content }],
    rawContent: content,
    timestamp: new Date(),
    agent,
  };
}

/**
 * Create an initial empty assistant message placeholder
 */
export function createInitialAssistantMessage(
  id: string,
  agent: 'task' | 'skill'
): Message {
  return {
    id,
    role: 'assistant',
    parts: [],
    rawContent: '',
    timestamp: new Date(),
    agent,
  };
}

/**
 * Strip <shell> tags from text and collapse excessive whitespace.
 * Also strips incomplete shell tags that are still streaming.
 */
export function stripShellTags(text: string): string {
  return text
    .replace(/<shell>[\s\S]*?<\/shell>/g, '') // Remove complete shell tags
    .replace(/<shell>[\s\S]*$/g, '') // Remove incomplete shell tag at end
    .replace(/\n{3,}/g, '\n\n'); // Collapse 3+ newlines to 2
}

/**
 * Finalize text content and add to parts array if non-empty
 */
export function finalizeTextPart(
  parts: MessagePart[],
  textContent: string
): MessagePart[] {
  const strippedText = stripShellTags(textContent).trim();
  if (strippedText) {
    return [...parts, { type: 'text', content: strippedText }];
  }
  return parts;
}
