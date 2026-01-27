import { describe, it, expect, vi } from 'vitest';
import { parseSSEStream } from '../parse-stream';
import type { SSEEvent } from '@/lib/types/sse';

function createMockResponse(chunks: string[]): Response {
  let index = 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream);
}

describe('parseSSEStream', () => {
  it('should parse a single event', async () => {
    const response = createMockResponse(['data: {"type":"text","content":"Hello"}\n\n']);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'text', content: 'Hello' });
  });

  it('should parse multiple events', async () => {
    const response = createMockResponse([
      'data: {"type":"text","content":"First"}\n\n',
      'data: {"type":"text","content":"Second"}\n\n',
    ]);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(2);
    expect(events[0].content).toBe('First');
    expect(events[1].content).toBe('Second');
  });

  it('should handle chunked data across event boundaries', async () => {
    // Split the event across two chunks
    const response = createMockResponse([
      'data: {"type":"te',
      'xt","content":"Hello"}\n\ndata: {"type":"done"}\n\n',
    ]);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'text', content: 'Hello' });
    expect(events[1]).toEqual({ type: 'done' });
  });

  it('should skip malformed JSON', async () => {
    const response = createMockResponse([
      'data: invalid json\n\n',
      'data: {"type":"text","content":"Valid"}\n\n',
    ]);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('Valid');
  });

  it('should skip lines without data: prefix', async () => {
    const response = createMockResponse([
      'comment: ignored\n\n',
      'data: {"type":"text","content":"Valid"}\n\n',
      'event: ignored\n\n',
    ]);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('Valid');
  });

  it('should throw if no response body', async () => {
    const response = new Response(null);

    await expect(parseSSEStream(response, () => {})).rejects.toThrow('No response body');
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    const response = createMockResponse([
      'data: {"type":"text","content":"First"}\n\n',
    ]);
    const events: SSEEvent[] = [];

    // Abort before parsing
    controller.abort();

    await parseSSEStream(response, (event) => events.push(event), controller.signal);

    expect(events).toHaveLength(0);
  });

  it('should handle complex SSE events', async () => {
    const response = createMockResponse([
      'data: {"type":"agent-tool-call","toolName":"shell","toolArgs":{"command":"ls"},"toolCallId":"123"}\n\n',
      'data: {"type":"agent-tool-result","toolCallId":"123","result":"file1.txt\\nfile2.txt"}\n\n',
    ]);
    const events: SSEEvent[] = [];

    await parseSSEStream(response, (event) => events.push(event));

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('agent-tool-call');
    expect(events[0].toolName).toBe('shell');
    expect(events[1].type).toBe('agent-tool-result');
    expect(events[1].result).toBe('file1.txt\nfile2.txt');
  });
});
