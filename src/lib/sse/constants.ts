/**
 * SSE Headers - Shared constants for SSE responses
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

export type SSEHeaders = typeof SSE_HEADERS;
