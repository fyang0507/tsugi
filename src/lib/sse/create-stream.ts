import type { SSEEvent } from '@/lib/types/sse';

/**
 * Controller interface for SSE streams
 */
export interface SSEStreamController {
  stream: ReadableStream<Uint8Array>;
  send: (event: SSEEvent) => void;
  close: () => void;
}

/**
 * Creates a server-side SSE stream with send/close controls.
 * Extracted from route.ts for reusability.
 */
export function createSSEStream(): SSEStreamController {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(event: SSEEvent) {
    if (controller) {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch {
        // Controller already closed (client disconnected, etc.)
        controller = null;
      }
    }
  }

  function close() {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Controller already closed (client disconnected, etc.)
      }
      controller = null;
    }
  }

  return { stream, send, close };
}
