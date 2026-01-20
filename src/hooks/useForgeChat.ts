'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { uiToApiMessages, type UIMessage } from '@/lib/messages/transform';

export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool' | 'agent-tool' | 'sources';
  content: string;
  command?: string; // For shell tool parts
  commandId?: string; // Unique identifier for command tracking
  toolStatus?: 'queued' | 'running' | 'completed'; // For shell tool parts
  toolName?: string; // For agent tool parts (google_search, url_context)
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  sources?: Array<{ id: string; url: string; title: string }>; // For source citations
}

export interface MessageStats {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  executionTimeMs?: number;
  tokensUnavailable?: boolean; // True when Braintrust stats couldn't be fetched
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
  tokensUnavailableCount: number; // Messages where token stats couldn't be fetched
}

// Represents one iteration of the agentic loop (model output + optional tool execution)
export interface AgentIteration {
  rawContent: string;          // Model output for this iteration
  toolOutput?: string;         // Tool output that follows (if any)
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  rawContent: string;          // For user messages: the input. For assistant: legacy/unused
  timestamp: Date;
  stats?: MessageStats;
  iterations?: AgentIteration[];  // For assistant messages: each agentic loop iteration
  agent?: 'task' | 'skill';      // Which agent generated this message
  rawPayload?: unknown[];        // Raw stream parts from agent.stream() for debugging
}

export type ChatStatus = 'ready' | 'streaming' | 'error';

interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-start' | 'tool-result' | 'agent-tool-call' | 'agent-tool-result' | 'source' | 'iteration-end' | 'done' | 'error' | 'usage' | 'raw-content' | 'tool-output' | 'sandbox_timeout' | 'sandbox_created' | 'raw_payload';
  content?: string;
  command?: string;
  commandId?: string;  // Unique identifier for command tracking
  result?: string;
  hasMoreCommands?: boolean;
  // For agent tool calls
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  // For source citations
  sourceId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  // For usage stats (null when Braintrust unavailable)
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedContentTokenCount?: number;
    reasoningTokens?: number;
  } | null;
  executionTimeMs?: number;
  // For KV cache support
  rawContent?: string;
  toolOutput?: string;
  // For sandbox sharing across requests
  sandboxId?: string;
  // Which agent generated this response
  agent?: 'task' | 'skill';
  // Raw stream parts from agent.stream() for debugging
  rawPayload?: unknown[];
}

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

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      parts: [{ type: 'text', content }],
      rawContent: content,  // User content is already raw
      timestamp: new Date(),
    };

    // Build messages array for API - expand assistant iterations to match server structure
    const apiMessages = uiToApiMessages([...messages, userMessage] as UIMessage[]);

    setMessages((prev) => [...prev, userMessage]);

    // Mutable state for tracking current streaming position
    const assistantId = generateId();
    const parts: MessagePart[] = [];
    let currentTextContent = '';

    // Stats tracking for this message
    const messageStartTime = Date.now();
    let messageStats: MessageStats = {};
    let messageAgent: 'task' | 'skill' = 'task';
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

                const finalAssistantMessage: Message = {
                  id: assistantId,
                  role: 'assistant',
                  parts: finalParts,
                  rawContent: '',
                  timestamp: new Date(),
                  stats: finalStats,
                  iterations: finalIterations,
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

                setStatus('ready');
                break;
              }

              case 'sandbox_timeout':
                setSandboxTimeoutMessage(event.content || 'Sandbox timed out due to inactivity.');
                setCurrentSandboxId(null); // Clear sandbox ID on timeout
                break;

              case 'sandbox_created':
                if (event.sandboxId) {
                  setCurrentSandboxId(event.sandboxId);
                }
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
  }, [messages, status, options, currentSandboxId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus('ready');
    setCurrentSandboxId(null); // Clear sandbox ID when conversation is cleared
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
  };
}
