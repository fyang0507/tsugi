'use client';

import { useState, useCallback, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
}

export type ChatStatus = 'ready' | 'streaming' | 'error';

interface SSEEvent {
  type: 'text' | 'tool-call' | 'tool-result' | 'iteration-end' | 'done' | 'error';
  content?: string;
  command?: string;
  result?: string;
  hasMoreCommands?: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function useForgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (status === 'streaming') return;

    setStatus('streaming');
    setError(null);

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Build messages array for API (only role + content)
    const apiMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);

    // Mutable state for tracking current streaming position
    let currentAssistantId = generateId();
    let currentAssistantContent = '';
    let pendingToolResults: Array<{ command: string; result: string }> = [];

    // Create initial assistant message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: currentAssistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    ]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          try {
            const event: SSEEvent = JSON.parse(data);

            switch (event.type) {
              case 'text':
                currentAssistantContent += event.content || '';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentAssistantId
                      ? { ...m, content: currentAssistantContent }
                      : m
                  )
                );
                break;

              case 'tool-call':
                // Just track that we're expecting a tool result
                break;

              case 'tool-result':
                // Accumulate tool results
                pendingToolResults.push({
                  command: event.command || '',
                  result: event.result || '',
                });
                break;

              case 'iteration-end':
                // If we have tool results, add them as a tool message
                if (pendingToolResults.length > 0) {
                  const toolContent = pendingToolResults
                    .map(({ command, result }) => `$ ${command}\n${result}`)
                    .join('\n\n');

                  const toolMessageId = generateId();
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: toolMessageId,
                      role: 'tool',
                      content: toolContent,
                      timestamp: new Date(),
                    },
                  ]);
                  pendingToolResults = [];
                }

                // If there are more commands coming, prepare for next assistant message
                if (event.hasMoreCommands) {
                  currentAssistantId = generateId();
                  currentAssistantContent = '';
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: currentAssistantId,
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                    },
                  ]);
                }
                break;

              case 'done':
                setStatus('ready');
                break;

              case 'error':
                setError(event.content || 'Unknown error');
                setStatus('error');
                break;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      setStatus('ready');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('ready');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, status]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus('ready');
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus('ready');
    }
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    clearMessages,
    stop,
  };
}
