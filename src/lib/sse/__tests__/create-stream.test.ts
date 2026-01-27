import { describe, it, expect } from 'vitest';
import { createSSEStream } from '../create-stream';
import type { SSEEvent } from '@/lib/types/sse';

describe('createSSEStream', () => {
  it('should create a readable stream', () => {
    const { stream } = createSSEStream();
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('should send events in SSE format', async () => {
    const { stream, send, close } = createSSEStream();
    const reader = stream.getReader();

    const event: SSEEvent = { type: 'text', content: 'Hello' };
    send(event);
    close();

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toBe('data: {"type":"text","content":"Hello"}\n\n');
  });

  it('should handle multiple events', async () => {
    const { stream, send, close } = createSSEStream();
    const reader = stream.getReader();
    const chunks: string[] = [];

    send({ type: 'text', content: 'First' });
    send({ type: 'text', content: 'Second' });
    close();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    expect(chunks.join('')).toContain('First');
    expect(chunks.join('')).toContain('Second');
  });

  it('should gracefully handle send after close', async () => {
    const { stream, send, close } = createSSEStream();
    const reader = stream.getReader();

    send({ type: 'text', content: 'Before' });
    close();

    // Should not throw
    send({ type: 'text', content: 'After' });

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('Before');
    expect(text).not.toContain('After');
  });

  it('should handle multiple close calls', () => {
    const { close } = createSSEStream();

    // Should not throw
    close();
    close();
  });
});
