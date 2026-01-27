'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MessageStats } from '@/lib/messages/transform';
import type { SSEEvent } from '@/lib/types/sse';
import type {
  Message,
  MessagePart,
  CumulativeStats,
  ChatStatus,
  SandboxStatus,
  UseTsugiChatOptions,
} from './types';
import {
  generateMessageId,
  createUserMessage,
  createInitialAssistantMessage,
  stripShellTags,
} from './message-builders';
import {
  createEmptyStats,
  calculateCumulativeStats,
  updateCumulativeStats,
} from './stats-utils';

export function useTsugiChat(options?: UseTsugiChatOptions) {
  const [messages, setMessages] = useState<Message[]>(options?.initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const [sandboxTimeoutMessage, setSandboxTimeoutMessage] = useState<string | null>(null);
  const [currentSandboxId, setCurrentSandboxId] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('disconnected');
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>(createEmptyStats());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset messages when initialMessages changes (conversation switch)
  useEffect(() => {
    if (options?.initialMessages) {
      setMessages(options.initialMessages);
      setCurrentSandboxId(null);
      setSandboxStatus('disconnected');
      setCumulativeStats(calculateCumulativeStats(options.initialMessages));
    }
  }, [options?.initialMessages]);

  const sendMessage = useCallback(async (
    content: string,
    mode: 'task' | 'codify-skill' = 'task',
    conversationId?: string,
    env?: Record<string, string>
  ) => {
    if (status === 'streaming') return;

    setStatus('streaming');
    setError(null);

    const messageAgent = mode === 'codify-skill' ? 'skill' : 'task';
    const userMessage = createUserMessage(content, messageAgent);

    // Filter messages by agent to keep task and skill conversations separate
    const filteredMessages = [...messages, userMessage].filter((m) => {
      if (messageAgent === 'task') {
        return m.agent === 'task' || m.agent === undefined;
      }
      return m.agent === 'skill';
    });

    const apiMessages = filteredMessages.map(m => ({
      role: m.role,
      rawContent: m.rawContent,
      parts: m.parts,
    }));

    setMessages((prev) => [...prev, userMessage]);

    // Mutable state for tracking current streaming position
    const assistantId = generateMessageId();
    const parts: MessagePart[] = [];
    let currentTextContent = '';
    const messageStartTime = Date.now();
    let messageStats: MessageStats = {};
    let finalMessageAgent: 'task' | 'skill' = messageAgent;
    let messageRawPayload: unknown[] | undefined;

    const updateAssistantMessage = () => {
      const finalParts = [...parts];
      const strippedText = stripShellTags(currentTextContent).trim();
      if (strippedText) {
        const lastPart = finalParts[finalParts.length - 1];
        if (lastPart?.type === 'text') {
          finalParts[finalParts.length - 1] = { type: 'text', content: strippedText };
        } else {
          finalParts.push({ type: 'text', content: strippedText });
        }
      }
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, parts: finalParts } : m)
      );
    };

    setMessages((prev) => [...prev, createInitialAssistantMessage(assistantId, messageAgent)]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode, conversationId, env, sandboxId: currentSandboxId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const event: SSEEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'text':
                currentTextContent += event.content || '';
                updateAssistantMessage();
                break;

              case 'reasoning': {
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                  currentTextContent = '';
                }
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type === 'reasoning') {
                  lastPart.content += event.content || '';
                } else {
                  parts.push({ type: 'reasoning', content: event.content || '' });
                }
                updateAssistantMessage();
                break;
              }

              case 'tool-call': {
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                }
                currentTextContent = '';
                parts.push({
                  type: 'tool',
                  command: event.command || '',
                  commandId: event.commandId,
                  content: '',
                  toolStatus: 'queued',
                });
                updateAssistantMessage();
                break;
              }

              case 'tool-start': {
                const startingPart = parts.find(
                  (p) => p.type === 'tool' && p.commandId === event.commandId
                );
                if (startingPart) startingPart.toolStatus = 'running';
                updateAssistantMessage();
                break;
              }

              case 'tool-result': {
                const matchingPart = parts.find(
                  (p) => p.type === 'tool' && p.commandId === event.commandId
                );
                if (matchingPart) {
                  matchingPart.content = event.result || '';
                  matchingPart.toolStatus = 'completed';
                }
                updateAssistantMessage();
                break;
              }

              case 'agent-tool-call': {
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                }
                currentTextContent = '';
                parts.push({
                  type: 'agent-tool',
                  content: '',
                  toolName: event.toolName,
                  toolArgs: event.toolArgs,
                  toolCallId: event.toolCallId,
                });
                updateAssistantMessage();
                break;
              }

              case 'agent-tool-result': {
                const matchingPart = parts.find(
                  (p) => p.type === 'agent-tool' && p.toolCallId === event.toolCallId
                );
                if (matchingPart) matchingPart.content = event.result || '';
                updateAssistantMessage();
                break;
              }

              case 'usage': {
                if (event.usage) {
                  messageStats = {
                    promptTokens: (messageStats.promptTokens || 0) + (event.usage.promptTokens || 0),
                    completionTokens: (messageStats.completionTokens || 0) + (event.usage.completionTokens || 0),
                    cachedTokens: (messageStats.cachedTokens || 0) + (event.usage.cachedContentTokenCount || 0),
                    reasoningTokens: (messageStats.reasoningTokens || 0) + (event.usage.reasoningTokens || 0),
                    executionTimeMs: (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0),
                  };
                } else {
                  messageStats = {
                    ...messageStats,
                    tokensUnavailable: true,
                    executionTimeMs: (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0),
                  };
                }
                if (event.agent) finalMessageAgent = event.agent;
                break;
              }

              case 'raw_payload':
                messageRawPayload = event.rawPayload;
                break;

              case 'done': {
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                  currentTextContent = '';
                }

                const finalStats: MessageStats = {
                  ...messageStats,
                  executionTimeMs: messageStats.executionTimeMs || (Date.now() - messageStartTime),
                };

                setCumulativeStats((prev) => updateCumulativeStats(prev, finalStats));

                const finalParts = [...parts];

                // Extract rawContent from text parts for display
                const rawContentFromParts = finalParts
                  .filter((p) => p.type === 'text')
                  .map((p) => p.content)
                  .join('\n')
                  .trim();

                const finalAssistantMessage: Message = {
                  id: assistantId,
                  role: 'assistant',
                  parts: finalParts,
                  rawContent: rawContentFromParts,
                  timestamp: new Date(),
                  stats: finalStats,
                  agent: finalMessageAgent,
                  rawPayload: messageRawPayload,
                };

                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? finalAssistantMessage : m)
                );

                setMessages((prev) => {
                  const userIdx = prev.length - 2;
                  const assistantIdx = prev.length - 1;
                  if (options?.onMessageComplete) {
                    options.onMessageComplete(userMessage, userIdx);
                    options.onMessageComplete(finalAssistantMessage, assistantIdx);
                  }
                  return prev;
                });

                receivedDone = true;
                setStatus('ready');
                break;
              }

              case 'sandbox_timeout':
                setSandboxTimeoutMessage(event.content || 'Sandbox timed out due to inactivity.');
                setCurrentSandboxId(null);
                setSandboxStatus('disconnected');
                break;

              case 'sandbox_active':
                if (event.sandboxId) {
                  setCurrentSandboxId(event.sandboxId);
                  setSandboxStatus('connected');
                }
                break;

              case 'sandbox_terminated':
                setCurrentSandboxId(null);
                setSandboxStatus('disconnected');
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

      if (!receivedDone) {
        setError('Connection closed unexpectedly. The API may have returned an error.');
        setStatus('error');
      }
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
  }, [messages, status, options, currentSandboxId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus('ready');
    setCurrentSandboxId(null);
    setSandboxStatus('disconnected');
    setCumulativeStats(createEmptyStats());
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus('ready');
    }
  }, []);

  const clearSandboxTimeout = useCallback(() => {
    setSandboxTimeoutMessage(null);
  }, []);

  return {
    messages,
    setMessages,
    status,
    error,
    cumulativeStats,
    sendMessage,
    clearMessages,
    stop,
    sandboxTimeoutMessage,
    clearSandboxTimeout,
    currentSandboxId,
    setCurrentSandboxId,
    sandboxStatus,
  };
}
