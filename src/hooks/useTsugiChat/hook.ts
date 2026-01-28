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
} from './types';
import { createEmptyStats, calculateCumulativeStats } from './stats-utils';

/**
 * Data part schemas for AI SDK useChat.
 * These define the shape of custom data events from the server.
 */
const dataPartSchemas = {
  sandbox: z.object({
    status: z.string(),
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
  }),
};

export function useTsugiChat(options?: UseTsugiChatOptions) {
  // Sandbox state (transient - not persisted in messages)
  const [currentSandboxId, setCurrentSandboxId] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('disconnected');
  const [sandboxTimeoutMessage, setSandboxTimeoutMessage] = useState<string | null>(null);

  // Cumulative stats across all messages
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>(createEmptyStats());

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
  const initialMessages = useMemo(() => options?.initialMessages ?? [], [options?.initialMessages]);

  // Create transport with dynamic body - using a function for body to get latest params
  // Note: bodyParamsRef is captured by reference (not .current) to avoid accessing ref during render
  const transport = useMemo(() => {
    const paramsRef = bodyParamsRef;
    return new DefaultChatTransport<Message>({
      api: '/api/agent',
      body: () => paramsRef.current,
    });
  }, []);

  // AI SDK useChat hook with typed data parts
  const chat = useChat<Message>({
    transport,
    dataPartSchemas,
    messages: initialMessages,
    onData: (part) => {
      // Handle transient sandbox events
      if (part.type === 'data-sandbox') {
        const data = part.data as SandboxData;
        if (data.status === 'sandbox_active') {
          setSandboxStatus('connected');
          if (data.sandboxId) {
            setCurrentSandboxId(data.sandboxId);
          }
        } else if (data.status === 'sandbox_terminated') {
          setSandboxStatus('disconnected');
          setCurrentSandboxId(null);
        } else if (data.status === 'sandbox_timeout') {
          setSandboxTimeoutMessage(data.reason || 'Sandbox timed out due to inactivity.');
          setSandboxStatus('disconnected');
          setCurrentSandboxId(null);
        }
      }
    },
    onFinish: ({ message }) => {
      // Extract usage from persistent data parts and update cumulative stats
      const usagePart = message.parts?.find(
        (p): p is { type: 'data-usage'; id?: string; data: UsageData } =>
          p.type === 'data-usage'
      );

      if (usagePart) {
        const { usage, executionTimeMs } = usagePart.data;

        setCumulativeStats((prev) => ({
          totalPromptTokens: prev.totalPromptTokens + (usage?.promptTokens || 0),
          totalCompletionTokens: prev.totalCompletionTokens + (usage?.completionTokens || 0),
          totalCachedTokens: prev.totalCachedTokens + (usage?.cachedContentTokenCount || 0),
          totalReasoningTokens: prev.totalReasoningTokens + (usage?.reasoningTokens || 0),
          totalExecutionTimeMs: prev.totalExecutionTimeMs + executionTimeMs,
          messageCount: prev.messageCount + 1,
          tokensUnavailableCount: prev.tokensUnavailableCount + (usage === null ? 1 : 0),
        }));

        // Add stats to message metadata for persistence
        // Initialize metadata if it doesn't exist (AI SDK may not create it)
        if (!message.metadata) {
          (message as Message).metadata = {};
        }
        message.metadata!.stats = {
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          cachedTokens: usage?.cachedContentTokenCount,
          reasoningTokens: usage?.reasoningTokens,
          executionTimeMs,
          tokensUnavailable: usage === null,
        };
        message.metadata!.agent = usagePart.data.agent;
      }

      // Call onMessageComplete for the new message
      if (options?.onMessageComplete) {
        const messages = chat.messages;
        const messageIndex = messages.findIndex((m) => m.id === message.id);
        if (messageIndex >= 0) {
          options.onMessageComplete(message as Message, messageIndex);
        }
      }
    },
    onError: (error) => {
      console.error('[useTsugiChat] Error:', error);
    },
  });

  // Reset state when initialMessages changes (conversation switch)
  useEffect(() => {
    if (options?.initialMessages) {
      chat.setMessages(options.initialMessages);
      setCurrentSandboxId(null);
      setSandboxStatus('disconnected');
      setCumulativeStats(calculateCumulativeStats(options.initialMessages));
      prevMessageCountRef.current = options.initialMessages.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chat.setMessages is stable
  }, [options?.initialMessages]);

  // Track message changes and call onMessageComplete for user messages
  const onMessageComplete = options?.onMessageComplete;
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
  const sendMessage = useCallback(async (
    content: string,
    messageMode: 'task' | 'codify-skill' = 'task',
    messageConversationId?: string,
    messageEnv?: Record<string, string>
  ) => {
    if (status === 'streaming') return;

    // Update body params ref for this request (will be used by transport.body())
    bodyParamsRef.current = {
      mode: messageMode,
      conversationId: messageConversationId,
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
  }, [status, chat, currentSandboxId]);

  // Clear all messages and reset state
  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    chat.clearError();
    setCurrentSandboxId(null);
    setSandboxStatus('disconnected');
    setCumulativeStats(createEmptyStats());
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
  };
}
