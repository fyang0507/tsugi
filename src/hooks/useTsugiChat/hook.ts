'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
import type {
  Message,
  CumulativeStats,
  ChatStatus,
  SandboxStatus,
  UseTsugiChatOptions,
  MessageMetadata,
  SandboxData,
  UsageData,
  ToolProgressData,
} from './types';
import type { MessageStats } from '@/lib/messages/transform';
import { createEmptyStats, calculateCumulativeStats } from './stats-utils';
import { useStatsPolling } from '../useStatsPolling';

/**
 * Data part schemas for AI SDK useChat.
 * These define the shape of custom data events from the server.
 */
const dataPartSchemas = {
  sandbox: z.object({
    status: z.enum(['sandbox_created', 'sandbox_terminated', 'sandbox_timeout']),
    sandboxId: z.string().optional(),
    reason: z.string().optional(),
  }),
  usage: z.object({
    usage: z.object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      cachedContentTokenCount: z.number().optional(),
      reasoningTokens: z.number().optional(),
    }).nullable(),
    executionTimeMs: z.number(),
    agent: z.enum(['task', 'skill']),
    // For eventual consistency
    rootSpanId: z.string().optional(),
    status: z.enum(['resolved', 'pending', 'unavailable']),
  }),
  'tool-progress': z.object({
    toolName: z.string(),
    status: z.enum(['streaming', 'complete']),
    delta: z.string().optional(),
    text: z.string().optional(),
  }),
};

export function useTsugiChat(options: UseTsugiChatOptions) {
  // Extract conversationId from options - it's stable for the component's lifetime
  const conversationId = options.conversationId;
  // Sandbox state (transient - not persisted in messages)
  const [currentSandboxId, setCurrentSandboxId] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('disconnected');
  const [sandboxTimeoutMessage, setSandboxTimeoutMessage] = useState<string | null>(null);

  // Cumulative stats across all messages
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>(createEmptyStats());

  // Tool progress state for streaming tool output (transient - not persisted)
  const [toolProgress, setToolProgress] = useState<Map<string, string>>(new Map());

  // Ref for chat.setMessages to use in polling callback (avoids closure issues)
  const setMessagesRef = useRef<React.Dispatch<React.SetStateAction<Message[]>> | null>(null);

  // Atomic message stats update function
  const updateMessageStats = useCallback((messageId: string, stats: MessageStats) => {
    if (setMessagesRef.current) {
      setMessagesRef.current((prev) => {
        return prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            metadata: {
              ...m.metadata,
              stats: { ...m.metadata?.stats, ...stats },
            },
          };
        });
      });
    }
    // Also update cumulative stats if resolved
    if (stats.statsStatus === 'resolved') {
      setCumulativeStats((prev) => ({
        ...prev,
        totalPromptTokens: prev.totalPromptTokens + (stats.promptTokens || 0),
        totalCompletionTokens: prev.totalCompletionTokens + (stats.completionTokens || 0),
        totalCachedTokens: prev.totalCachedTokens + (stats.cachedTokens || 0),
        totalReasoningTokens: prev.totalReasoningTokens + (stats.reasoningTokens || 0),
      }));
    }
  }, []);

  // Initialize polling hook
  const { startPolling, stopPolling } = useStatsPolling({
    onStatsResolved: (messageId, stats) => {
      updateMessageStats(messageId, stats);
      if (stats.statsStatus === 'resolved' && options.onStatsResolved) {
        options.onStatsResolved(messageId, stats);
      }
    },
  });

  // Track previous message count for onMessageComplete callbacks
  const prevMessageCountRef = useRef(0);

  // Body params for API requests - these get passed to transport.body
  const bodyParamsRef = useRef<{
    mode: 'task' | 'codify-skill';
    conversationId?: string;
    env?: Record<string, string>;
    sandboxId: string | null;
  }>({
    mode: 'task',
    conversationId: undefined,
    env: undefined,
    sandboxId: null,
  });

  // Memoize initial messages to prevent unnecessary re-renders
  const initialMessages = useMemo(() => options.initialMessages ?? [], [options.initialMessages]);

  // Refs to allow custom fetch to access state setters without recreating transport
  const setCurrentSandboxIdRef = useRef(setCurrentSandboxId);
  const setSandboxStatusRef = useRef(setSandboxStatus);
  setCurrentSandboxIdRef.current = setCurrentSandboxId;
  setSandboxStatusRef.current = setSandboxStatus;

  // Create transport with dynamic body - using a function for body to get latest params
  // Note: bodyParamsRef is captured by reference (not .current) to avoid accessing ref during render
  const transport = useMemo(() => {
    const paramsRef = bodyParamsRef;
    const sandboxIdRef = setCurrentSandboxIdRef;
    const sandboxStatusRef = setSandboxStatusRef;

    return new DefaultChatTransport<Message>({
      api: '/api/agent',
      body: () => paramsRef.current,
      // Custom fetch to intercept response headers for sandbox ID
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        // Read sandbox ID from response headers (set by server for new conversations)
        const sandboxId = response.headers.get('X-Sandbox-Id');
        if (sandboxId) {
          sandboxStatusRef.current('connected');
          sandboxIdRef.current(sandboxId);
        }
        return response;
      },
    });
  }, []);

  // AI SDK useChat hook with typed data parts
  const chat = useChat<Message>({
    transport,
    dataPartSchemas,
    messages: initialMessages,
    onData: (part) => {
      // Handle transient sandbox events (legacy support for sandbox_terminated/timeout)
      if (part.type === 'data-sandbox') {
        const data = part.data as SandboxData;
        if (data.status === 'sandbox_created') {
          // Sandbox was created - store its ID
          setSandboxStatus('connected');
          if (data.sandboxId) {
            setCurrentSandboxId(data.sandboxId);
          }
        } else if (data.status === 'sandbox_terminated') {
          // Sandbox was terminated (user abort or explicit cleanup)
          setSandboxStatus('disconnected');
          setCurrentSandboxId(null);
        } else if (data.status === 'sandbox_timeout') {
          // Sandbox timed out due to inactivity
          setSandboxTimeoutMessage(data.reason || 'Sandbox timed out due to inactivity.');
          setSandboxStatus('disconnected');
          setCurrentSandboxId(null);
        }
      }
      // Handle tool progress events for streaming tool output
      if (part.type === 'data-tool-progress') {
        const data = part.data as ToolProgressData;
        if (data.status === 'streaming' && data.delta) {
          // Accumulate deltas by tool name
          setToolProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(data.toolName) || '';
            newMap.set(data.toolName, existing + data.delta);
            return newMap;
          });
        } else if (data.status === 'complete') {
          // Clear progress for this tool when complete
          setToolProgress((prev) => {
            const newMap = new Map(prev);
            newMap.delete(data.toolName);
            return newMap;
          });
        }
      }
    },
    onFinish: ({ message, isAbort }) => {
      // Clear tool progress on any finish
      setToolProgress(new Map());

      // Handle abort case - mark message as interrupted and complete interrupted tool calls
      if (isAbort) {
        // Determine agent type from current mode
        const messageAgent = bodyParamsRef.current.mode === 'codify-skill' ? 'skill' : 'task';

        // Helper to complete interrupted tool parts
        const completeInterruptedParts = (parts: typeof message.parts) => {
          return parts?.map((part) => {
            if (part.type.startsWith('tool-') &&
                'state' in part &&
                (part.state === 'input-streaming' || part.state === 'input-available')) {
              return {
                ...part,
                state: 'output-error' as const,
                errorText: 'Interrupted by user',
              };
            }
            return part;
          });
        };

        // Update message in chat.messages array
        chat.setMessages((prevMessages) => {
          return prevMessages.map((m) => {
            if (m.id === message.id) {
              return {
                ...m,
                parts: completeInterruptedParts(m.parts),
                metadata: {
                  ...m.metadata,
                  agent: messageAgent,
                  interrupted: true,
                },
              };
            }
            return m;
          });
        });

        // Create updated message for persistence callback
        const updatedMessage = {
          ...message,
          parts: completeInterruptedParts(message.parts),
          metadata: {
            ...message.metadata,
            agent: messageAgent,
            interrupted: true,
          },
        } as Message;

        // Persist partial trajectory
        if (options.onMessageComplete) {
          const messages = chat.messages;
          const messageIndex = messages.findIndex((m) => m.id === message.id);
          if (messageIndex >= 0) {
            options.onMessageComplete(updatedMessage, messageIndex);
          }
        }
        return;
      }

      // Normal completion - extract usage from persistent data parts and update cumulative stats
      const usagePart = message.parts?.find(
        (p): p is { type: 'data-usage'; id?: string; data: UsageData } =>
          p.type === 'data-usage'
      );

      // Always set agent based on current mode (not relying on server to send it)
      // This ensures assistant messages have correct agent metadata for filtering
      const messageAgent = bodyParamsRef.current.mode === 'codify-skill' ? 'skill' : 'task';

      // Build updated metadata
      const updatedMetadata: MessageMetadata = {
        ...message.metadata,
        agent: messageAgent,
      };

      if (usagePart) {
        const { usage, executionTimeMs, rootSpanId, status: usageStatus } = usagePart.data;

        // Build stats with status for eventual consistency
        const newStats: MessageStats = {
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          cachedTokens: usage?.cachedContentTokenCount,
          reasoningTokens: usage?.reasoningTokens,
          executionTimeMs,
          rootSpanId,
          statsStatus: usageStatus === 'resolved' ? 'resolved'
                     : usageStatus === 'unavailable' ? 'unavailable'
                     : 'pending',
        };

        updatedMetadata.stats = newStats;

        // Update cumulative stats based on status
        if (usageStatus === 'resolved' && usage) {
          // Stats are ready - count them now
          setCumulativeStats((prev) => ({
            totalPromptTokens: prev.totalPromptTokens + (usage.promptTokens || 0),
            totalCompletionTokens: prev.totalCompletionTokens + (usage.completionTokens || 0),
            totalCachedTokens: prev.totalCachedTokens + (usage.cachedContentTokenCount || 0),
            totalReasoningTokens: prev.totalReasoningTokens + (usage.reasoningTokens || 0),
            totalExecutionTimeMs: prev.totalExecutionTimeMs + executionTimeMs,
            messageCount: prev.messageCount + 1,
            tokensUnavailableCount: prev.tokensUnavailableCount,
          }));
        } else if (usageStatus === 'pending' && rootSpanId) {
          // Stats not ready - start polling, only count execution time
          startPolling({ rootSpanId, messageId: message.id, conversationId });
          setCumulativeStats((prev) => ({
            ...prev,
            totalExecutionTimeMs: prev.totalExecutionTimeMs + executionTimeMs,
            messageCount: prev.messageCount + 1,
          }));
        } else if (usageStatus === 'unavailable') {
          // Braintrust not configured
          setCumulativeStats((prev) => ({
            ...prev,
            totalExecutionTimeMs: prev.totalExecutionTimeMs + executionTimeMs,
            messageCount: prev.messageCount + 1,
            tokensUnavailableCount: prev.tokensUnavailableCount + 1,
          }));
        }
      }

      // Update message in chat.messages array to ensure metadata is preserved for next request
      // This is necessary because the message object in onFinish may not be the same reference
      chat.setMessages((prevMessages) => {
        return prevMessages.map((m) => {
          if (m.id === message.id) {
            return {
              ...m,
              metadata: updatedMetadata,
            };
          }
          return m;
        });
      });

      // Call onMessageComplete with updated message for persistence
      if (options.onMessageComplete) {
        const updatedMessage = {
          ...message,
          metadata: updatedMetadata,
        } as Message;
        const messages = chat.messages;
        const messageIndex = messages.findIndex((m) => m.id === message.id);
        if (messageIndex >= 0) {
          options.onMessageComplete(updatedMessage, messageIndex);
        }
      }
    },
    onError: (error) => {
      console.error('[useTsugiChat] Error:', error);
    },
  });

  // Keep setMessagesRef current for polling callback
  setMessagesRef.current = chat.setMessages as React.Dispatch<React.SetStateAction<Message[]>>;

  // Reset state when initialMessages changes (conversation switch)
  useEffect(() => {
    if (options.initialMessages) {
      chat.setMessages(options.initialMessages);
      setCurrentSandboxId(null);
      setSandboxStatus('disconnected');
      setCumulativeStats(calculateCumulativeStats(options.initialMessages));
      setToolProgress(new Map());
      prevMessageCountRef.current = options.initialMessages.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chat.setMessages is stable
  }, [options.initialMessages]);

  // Re-fetch stats for messages with pending status on load
  useEffect(() => {
    if (!options.initialMessages) return;

    for (const message of options.initialMessages) {
      const stats = message.metadata?.stats;
      if (stats?.statsStatus === 'pending' && stats?.rootSpanId) {
        startPolling({
          rootSpanId: stats.rootSpanId,
          messageId: message.id,
          conversationId: conversationId,
        });
      }
    }
  }, [options.initialMessages, startPolling, conversationId]);

  // Track message changes and call onMessageComplete for user messages
  const onMessageComplete = options.onMessageComplete;
  useEffect(() => {
    const currentCount = chat.messages.length;
    const prevCount = prevMessageCountRef.current;

    // Check for new messages
    if (currentCount > prevCount && onMessageComplete) {
      // Find new user messages (assistant messages are handled in onFinish)
      for (let i = prevCount; i < currentCount; i++) {
        const message = chat.messages[i];
        if (message.role === 'user') {
          onMessageComplete(message as Message, i);
        }
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [chat.messages, onMessageComplete]);

  // Derive status from chat.status
  const status: ChatStatus = chat.status === 'streaming' || chat.status === 'submitted'
    ? 'streaming'
    : chat.error
      ? 'error'
      : 'ready';

  // Wrap sendMessage to support our API signature
  // conversationId comes from options (stable), mode and env can be passed per-message
  const sendMessage = useCallback(async (
    content: string,
    messageMode: 'task' | 'codify-skill' = 'task',
    _messageConversationId?: string, // Deprecated: now uses conversationId from options
    messageEnv?: Record<string, string>
  ) => {
    if (status === 'streaming') return;

    // Update body params ref for this request (will be used by transport.body())
    bodyParamsRef.current = {
      mode: messageMode,
      conversationId: conversationId,
      env: messageEnv,
      sandboxId: currentSandboxId,
    };

    // Determine agent type for metadata
    const messageAgent = messageMode === 'codify-skill' ? 'skill' : 'task';

    // Create metadata for the new message
    const metadata: MessageMetadata = {
      agent: messageAgent,
    };

    // Use sendMessage from useChat
    await chat.sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: content }],
      metadata,
    });
  }, [status, chat, currentSandboxId, conversationId]);

  // Clear all messages and reset state
  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    chat.clearError();
    setCurrentSandboxId(null);
    setSandboxStatus('disconnected');
    setCumulativeStats(createEmptyStats());
    setToolProgress(new Map());
    prevMessageCountRef.current = 0;
  }, [chat]);

  // Clear sandbox timeout message
  const clearSandboxTimeout = useCallback(() => {
    setSandboxTimeoutMessage(null);
  }, []);

  return {
    // Messages from AI SDK
    messages: chat.messages as Message[],
    setMessages: chat.setMessages as React.Dispatch<React.SetStateAction<Message[]>>,

    // Status
    status,
    error: chat.error?.message || null,

    // Stats
    cumulativeStats,

    // Actions
    sendMessage,
    clearMessages,
    stop: chat.stop,

    // Sandbox state
    sandboxTimeoutMessage,
    clearSandboxTimeout,
    currentSandboxId,
    setCurrentSandboxId,
    sandboxStatus,

    // Tool progress for streaming tool output
    toolProgress,
  };
}
