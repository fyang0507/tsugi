'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  partsToIteration,
  type Message as BaseMessage,
  type MessagePart as BaseMessagePart,
  type MessageStats,
  type AgentIteration,
  type ToolStatus,
} from '@/lib/messages/transform';
import type { SSEEvent } from '@/lib/types/sse';

// Re-export types for consumers that import from useForgeChat
export type { MessageStats, AgentIteration, ToolStatus };

/**
 * Frontend-friendly MessagePart interface.
 * Uses a flat structure with optional properties for easier access in UI components.
 * Compatible with the discriminated union in transform.ts.
 */
export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool' | 'agent-tool' | 'sources';
  content: string;
  command?: string;
  commandId?: string;
  toolStatus?: ToolStatus;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  sources?: Array<{ id: string; url: string; title: string }>;
}

/**
 * Frontend message type with required fields for UI display.
 * Extends the base Message type with fields that are always present in the frontend.
 */
export interface Message extends Omit<BaseMessage, 'parts'> {
  id: string;           // Always present in frontend
  parts: MessagePart[]; // Always present in frontend, using flat interface
  timestamp: Date;      // Always present in frontend
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
  tokensUnavailableCount: number;
}

export type ChatStatus = 'ready' | 'streaming' | 'error';
export type SandboxStatus = 'disconnected' | 'connected';


function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export interface UseForgeChatOptions {
  initialMessages?: Message[];  // Load from DB on conversation switch
  onMessageComplete?: (message: Message, index: number) => void;  // Called after each message is finalized
}

export function useForgeChat(options?: UseForgeChatOptions) {
  const [messages, setMessages] = useState<Message[]>(options?.initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const [sandboxTimeoutMessage, setSandboxTimeoutMessage] = useState<string | null>(null);
  const [currentSandboxId, setCurrentSandboxId] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('disconnected');
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCachedTokens: 0,
    totalReasoningTokens: 0,
    totalExecutionTimeMs: 0,
    messageCount: 0,
    tokensUnavailableCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const iterationsRef = useRef<AgentIteration[]>([]);

  // Reset messages when initialMessages changes (conversation switch)
  useEffect(() => {
    if (options?.initialMessages) {
      setMessages(options.initialMessages);
      setCurrentSandboxId(null); // Clear sandbox on conversation switch
      setSandboxStatus('disconnected');
      // Recalculate cumulative stats from loaded messages
      const stats = options.initialMessages.reduce(
        (acc, m) => {
          if (m.stats) {
            if (m.stats.tokensUnavailable) {
              acc.tokensUnavailableCount += 1;
            } else {
              acc.totalPromptTokens += m.stats.promptTokens || 0;
              acc.totalCompletionTokens += m.stats.completionTokens || 0;
              acc.totalCachedTokens += m.stats.cachedTokens || 0;
              acc.totalReasoningTokens += m.stats.reasoningTokens || 0;
            }
            acc.totalExecutionTimeMs += m.stats.executionTimeMs || 0;
          }
          if (m.role === 'assistant') {
            acc.messageCount += 1;
          }
          return acc;
        },
        {
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalCachedTokens: 0,
          totalReasoningTokens: 0,
          totalExecutionTimeMs: 0,
          messageCount: 0,
          tokensUnavailableCount: 0,
        }
      );
      setCumulativeStats(stats);
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

    // Reset refs for new message
    iterationsRef.current = [];

    // Add user message - tag with agent mode so we can filter later
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      parts: [{ type: 'text', content }],
      rawContent: content,  // User content is already raw
      timestamp: new Date(),
      agent: mode === 'codify-skill' ? 'skill' : 'task',
    };

    // Filter messages by agent to keep task and skill conversations separate
    // For task mode: include messages where agent is 'task' or undefined (legacy)
    // For codify-skill mode: include only messages where agent is 'skill'
    const targetAgent = mode === 'codify-skill' ? 'skill' : 'task';
    const filteredMessages = [...messages, userMessage].filter((m) => {
      // For task mode, include legacy messages (no agent field) and task messages
      if (targetAgent === 'task') {
        return m.agent === 'task' || m.agent === undefined;
      }
      // For skill mode, only include skill messages
      return m.agent === 'skill';
    });

    // Build messages array for API - send full message format with parts
    const apiMessages = filteredMessages.map(m => ({
      role: m.role,
      rawContent: m.rawContent,
      parts: m.parts,
      iterations: m.iterations,
    }));

    setMessages((prev) => [...prev, userMessage]);

    // Mutable state for tracking current streaming position
    const assistantId = generateId();
    const parts: MessagePart[] = [];
    let currentTextContent = '';

    // Stats tracking for this message
    const messageStartTime = Date.now();
    let messageStats: MessageStats = {};
    let messageAgent: 'task' | 'skill' = mode === 'codify-skill' ? 'skill' : 'task';
    let messageRawPayload: unknown[] | undefined;

    // Helper to strip <shell> tags from text and collapse excessive whitespace
    // Also strips incomplete shell tags that are still streaming
    const stripShellTags = (text: string) => {
      return text
        .replace(/<shell>[\s\S]*?<\/shell>/g, '') // Remove complete shell tags
        .replace(/<shell>[\s\S]*$/g, '') // Remove incomplete shell tag at end (still streaming)
        .replace(/\n{3,}/g, '\n\n'); // Collapse 3+ newlines to 2
    };

    // Helper to update the assistant message
    const updateAssistantMessage = () => {
      const finalParts = [...parts];
      // Add current text content if not empty
      const strippedText = stripShellTags(currentTextContent).trim();
      if (strippedText) {
        // Check if last part is already a text part we can update
        const lastPart = finalParts[finalParts.length - 1];
        if (lastPart?.type === 'text') {
          finalParts[finalParts.length - 1] = { type: 'text', content: strippedText };
        } else {
          finalParts.push({ type: 'text', content: strippedText });
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, parts: finalParts } : m
        )
      );
    };

    // Create initial assistant message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        parts: [],
        rawContent: '',  // Will be set on 'done' event
        timestamp: new Date(),
        agent: messageAgent,
      },
    ]);

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
          const data = line.slice(6);

          try {
            const event: SSEEvent = JSON.parse(data);

            switch (event.type) {
              case 'text':
                currentTextContent += event.content || '';
                updateAssistantMessage();
                break;

              case 'reasoning': {
                // Finalize any current text before reasoning
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                  currentTextContent = '';
                }
                // Find or create reasoning part
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
                // Finalize current text part (stripped of shell tags)
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                }
                currentTextContent = '';
                // Add tool part (queued status - not yet executing)
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
                // Mark the tool as actually running (not just queued)
                // Match by commandId for proper tracking of multiple/duplicate commands
                const startingPart = parts.find(
                  (p) => p.type === 'tool' && p.commandId === event.commandId
                );
                if (startingPart) {
                  startingPart.toolStatus = 'running';
                }
                updateAssistantMessage();
                break;
              }

              case 'tool-result': {
                // Find the matching tool part by commandId for proper tracking
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
                // Finalize current text part before showing agent tool
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                }
                currentTextContent = '';
                // Add agent tool part (google_search, url_context, etc.)
                parts.push({
                  type: 'agent-tool',
                  content: '', // Will be filled by agent-tool-result
                  toolName: event.toolName,
                  toolArgs: event.toolArgs,
                  toolCallId: event.toolCallId,
                });
                updateAssistantMessage();
                break;
              }

              case 'agent-tool-result': {
                // Find the matching agent-tool part by toolCallId (may not be the last one)
                const matchingPart = parts.find(
                  (p) => p.type === 'agent-tool' && p.toolCallId === event.toolCallId
                );
                if (matchingPart) {
                  matchingPart.content = event.result || '';
                }
                updateAssistantMessage();
                break;
              }

              case 'usage': {
                if (event.usage) {
                  // Normal case: accumulate stats from Braintrust
                  messageStats = {
                    promptTokens: (messageStats.promptTokens || 0) + (event.usage.promptTokens || 0),
                    completionTokens: (messageStats.completionTokens || 0) + (event.usage.completionTokens || 0),
                    cachedTokens: (messageStats.cachedTokens || 0) + (event.usage.cachedContentTokenCount || 0),
                    reasoningTokens: (messageStats.reasoningTokens || 0) + (event.usage.reasoningTokens || 0),
                    executionTimeMs: (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0),
                  };
                } else {
                  // Braintrust unavailable: mark tokens as unavailable but still track time
                  messageStats = {
                    ...messageStats,
                    tokensUnavailable: true,
                    executionTimeMs: (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0),
                  };
                }
                // Capture agent from usage event
                if (event.agent) {
                  messageAgent = event.agent;
                }
                break;
              }

              case 'raw_payload':
                // Capture raw stream parts for debugging
                messageRawPayload = event.rawPayload;
                break;

              case 'raw-content':
                // Start a new iteration with this raw content
                iterationsRef.current.push({ rawContent: event.rawContent || '' });
                break;

              case 'tool-output':
                // Attach tool output to the most recent iteration
                if (event.toolOutput && iterationsRef.current.length > 0) {
                  const lastIter = iterationsRef.current[iterationsRef.current.length - 1];
                  lastIter.toolOutput = event.toolOutput;
                }
                break;

              case 'iteration-end':
                // No need to create new messages - we keep building the same one
                break;

              case 'done': {
                // Finalize any remaining text
                const strippedText = stripShellTags(currentTextContent).trim();
                if (strippedText) {
                  parts.push({ type: 'text', content: strippedText });
                  currentTextContent = '';
                }

                // Finalize message stats (use client-measured total time as fallback)
                const finalStats: MessageStats = {
                  ...messageStats,
                  executionTimeMs: messageStats.executionTimeMs || (Date.now() - messageStartTime),
                };

                // Update cumulative stats (don't accumulate zeros when tokens unavailable)
                setCumulativeStats((prev) => ({
                  totalPromptTokens: prev.totalPromptTokens + (finalStats.tokensUnavailable ? 0 : (finalStats.promptTokens || 0)),
                  totalCompletionTokens: prev.totalCompletionTokens + (finalStats.tokensUnavailable ? 0 : (finalStats.completionTokens || 0)),
                  totalCachedTokens: prev.totalCachedTokens + (finalStats.tokensUnavailable ? 0 : (finalStats.cachedTokens || 0)),
                  totalReasoningTokens: prev.totalReasoningTokens + (finalStats.tokensUnavailable ? 0 : (finalStats.reasoningTokens || 0)),
                  totalExecutionTimeMs: prev.totalExecutionTimeMs + (finalStats.executionTimeMs || 0),
                  messageCount: prev.messageCount + 1,
                  tokensUnavailableCount: prev.tokensUnavailableCount + (finalStats.tokensUnavailable ? 1 : 0),
                }));

                // Update message with final parts, stats, and iterations
                const finalParts = [...parts];
                const finalIterations = iterationsRef.current.length > 0
                  ? [...iterationsRef.current]
                  : undefined;

                // Build iterations from parts if not already set via raw-content events
                // This ensures assistant messages are included in expandIterations()
                // Uses shared helper from transform.ts
                const extractedIteration = partsToIteration(finalParts);
                const iterationsFromParts = finalIterations ?? (extractedIteration ? [extractedIteration] : undefined);

                // Extract rawContent for the message
                const rawContentFromParts = extractedIteration?.rawContent ?? '';

                const finalAssistantMessage: Message = {
                  id: assistantId,
                  role: 'assistant',
                  parts: finalParts,
                  rawContent: rawContentFromParts,
                  timestamp: new Date(),
                  stats: finalStats,
                  iterations: iterationsFromParts,
                  agent: messageAgent,
                  rawPayload: messageRawPayload,
                };

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? finalAssistantMessage : m
                  )
                );

                // Call persistence callbacks
                // Calculate the index based on current messages length
                // User message was already added, so userIndex = prev.length - 2 (before assistant)
                // Assistant index = prev.length - 1
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

      // If stream ended without 'done' event, treat as error
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
    setCumulativeStats({
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
      totalExecutionTimeMs: 0,
      messageCount: 0,
      tokensUnavailableCount: 0,
    });
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
