'use client';

import { useState, useCallback, useRef } from 'react';

export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool' | 'agent-tool' | 'sources';
  content: string;
  command?: string; // For shell tool parts
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
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
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
}

export type ChatStatus = 'ready' | 'streaming' | 'error';

interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' | 'agent-tool-call' | 'agent-tool-result' | 'source' | 'iteration-end' | 'done' | 'error' | 'usage' | 'raw-content' | 'tool-output';
  content?: string;
  command?: string;
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
  // For usage stats
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedContentTokenCount?: number;
    reasoningTokens?: number;
  };
  executionTimeMs?: number;
  // For KV cache support
  rawContent?: string;
  toolOutput?: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Detect URLs in text
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return text.match(urlRegex) || [];
}

export function useForgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCachedTokens: 0,
    totalReasoningTokens: 0,
    totalExecutionTimeMs: 0,
    messageCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const iterationsRef = useRef<AgentIteration[]>([]);

  const sendMessage = useCallback(async (content: string) => {
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
    const apiMessages: Array<{ role: string; content: string }> = [];
    for (const m of [...messages, userMessage]) {
      if (m.role === 'user') {
        // User messages are simple
        apiMessages.push({ role: 'user', content: m.rawContent });
      } else if (m.iterations && m.iterations.length > 0) {
        // Assistant messages: expand iterations to match server's conversation structure
        for (const iter of m.iterations) {
          apiMessages.push({ role: 'assistant', content: iter.rawContent });
          if (iter.toolOutput) {
            apiMessages.push({ role: 'user', content: `[Shell Output]\n${iter.toolOutput}` });
          }
        }
      } else {
        // Fallback for messages without iterations (legacy or empty)
        apiMessages.push({ role: m.role, content: m.rawContent });
      }
    }

    setMessages((prev) => [...prev, userMessage]);

    // Mutable state for tracking current streaming position
    const assistantId = generateId();
    const parts: MessagePart[] = [];
    let currentTextContent = '';
    const collectedSources: Array<{ id: string; url: string; title: string }> = [];

    // Stats tracking for this message
    const messageStartTime = Date.now();
    let messageStats: MessageStats = {};

    // Detect URLs in user message - if present, show URL Context tool
    const userUrls = extractUrls(content);
    if (userUrls.length > 0) {
      parts.push({
        type: 'agent-tool',
        content: '', // Will be marked complete when response finishes
        toolName: 'url_context',
        toolArgs: { url: userUrls[0] }, // Show first URL
        toolCallId: 'url-context-' + generateId(),
      });
    }

    // Helper to strip <shell> tags from text and collapse excessive whitespace
    const stripShellTags = (text: string) => {
      return text
        .replace(/<shell>[\s\S]*?<\/shell>/g, '') // Remove shell tags
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
                // Add tool part (command only, content empty for now)
                parts.push({ type: 'tool', command: event.command || '', content: '' });
                updateAssistantMessage();
                break;
              }

              case 'tool-result': {
                // Update the most recent tool part with the result
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type === 'tool' && lastPart.command === event.command) {
                  lastPart.content = event.result || '';
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

              case 'source': {
                // Collect source citations from Gemini grounding
                if (event.sourceId && event.sourceTitle) {
                  // On first source, create a synthetic Google Search tool part at the BEGINNING
                  if (collectedSources.length === 0) {
                    // Insert Google Search tool part at the start (index 0)
                    // This way it appears before any text content
                    parts.unshift({
                      type: 'agent-tool',
                      content: '', // Will be populated with sources summary
                      toolName: 'google_search',
                      toolArgs: {},
                      toolCallId: 'grounding-search',
                    });
                    updateAssistantMessage();
                  }
                  collectedSources.push({
                    id: event.sourceId,
                    url: event.sourceUrl || '',
                    title: event.sourceTitle,
                  });
                }
                break;
              }

              case 'usage': {
                // Accumulate stats across iterations
                messageStats = {
                  promptTokens: (messageStats.promptTokens || 0) + (event.usage?.promptTokens || 0),
                  completionTokens: (messageStats.completionTokens || 0) + (event.usage?.completionTokens || 0),
                  cachedTokens: (messageStats.cachedTokens || 0) + (event.usage?.cachedContentTokenCount || 0),
                  reasoningTokens: (messageStats.reasoningTokens || 0) + (event.usage?.reasoningTokens || 0),
                  executionTimeMs: (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0),
                };
                break;
              }

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

                // Mark URL Context tool as complete (if present)
                const urlContextPart = parts.find(
                  (p) => p.type === 'agent-tool' && p.toolCallId?.startsWith('url-context-')
                );
                if (urlContextPart && !urlContextPart.content) {
                  urlContextPart.content = 'Analyzed'; // Mark as complete
                }

                // Update Google Search tool part with sources if any were collected
                if (collectedSources.length > 0) {
                  const searchPart = parts.find(
                    (p) => p.type === 'agent-tool' && p.toolCallId === 'grounding-search'
                  );
                  if (searchPart) {
                    // Populate the search part with sources
                    searchPart.sources = [...collectedSources];
                    searchPart.content = collectedSources.map((s) => s.title).join(', ');
                  }
                  // Also add sources section at the end for clickable links
                  parts.push({
                    type: 'sources',
                    content: '',
                    sources: [...collectedSources],
                  });
                }

                // Finalize message stats (use client-measured total time as fallback)
                const finalStats: MessageStats = {
                  ...messageStats,
                  executionTimeMs: messageStats.executionTimeMs || (Date.now() - messageStartTime),
                };

                // Update cumulative stats
                setCumulativeStats((prev) => ({
                  totalPromptTokens: prev.totalPromptTokens + (finalStats.promptTokens || 0),
                  totalCompletionTokens: prev.totalCompletionTokens + (finalStats.completionTokens || 0),
                  totalCachedTokens: prev.totalCachedTokens + (finalStats.cachedTokens || 0),
                  totalReasoningTokens: prev.totalReasoningTokens + (finalStats.reasoningTokens || 0),
                  totalExecutionTimeMs: prev.totalExecutionTimeMs + (finalStats.executionTimeMs || 0),
                  messageCount: prev.messageCount + 1,
                }));

                // Update message with final parts, stats, and iterations
                const finalParts = [...parts];
                const finalIterations = iterationsRef.current.length > 0
                  ? [...iterationsRef.current]
                  : undefined;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          parts: finalParts,
                          stats: finalStats,
                          iterations: finalIterations,
                        }
                      : m
                  )
                );
                setStatus('ready');
                break;
              }

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
    setCumulativeStats({
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
      totalExecutionTimeMs: 0,
      messageCount: 0,
    });
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
    cumulativeStats,
    sendMessage,
    clearMessages,
    stop,
  };
}
