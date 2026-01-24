'use client';

import { useEffect, useState } from 'react';
import { DropZone } from './DropZone';
import type { ConversationStats } from './MetricsBar';
import type { Message } from '@/hooks/useForgeChat';
import ChatMessage from '../ChatMessage';

interface ComparisonPaneProps {
  conversationId: string | null;
  position: 'left' | 'right';
  onDrop: (conversationId: string) => void;
  onClear: () => void;
  onStatsLoaded?: (stats: ConversationStats | null) => void;
  onTitleLoaded?: (title: string | null) => void;
}

interface ConversationData {
  messages: Message[];
  title: string;
}

export function ComparisonPane({
  conversationId,
  position,
  onDrop,
  onClear,
  onStatsLoaded,
  onTitleLoaded,
}: ComparisonPaneProps) {
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentColor = position === 'left' ? 'amber' : 'emerald';

  // Load conversation messages when ID changes
  useEffect(() => {
    if (!conversationId) {
      setConversationData(null);
      onStatsLoaded?.(null);
      onTitleLoaded?.(null);
      return;
    }

    const loadConversation = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!res.ok) {
          throw new Error('Failed to load conversation');
        }

        const data = await res.json();
        const title = data.conversation?.title || 'Conversation';
        setConversationData({
          messages: data.messages || [],
          title,
        });

        // Notify parent of loaded title
        onTitleLoaded?.(title);

        // Calculate stats from messages (only task mode, exclude codify-skill)
        const stats = calculateStats(data.messages || []);
        onStatsLoaded?.(stats);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError('Failed to load conversation');
        onStatsLoaded?.(null);
        onTitleLoaded?.(null);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId, onStatsLoaded, onTitleLoaded]);

  const isEmpty = !conversationId;

  return (
    <div className="flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden">
      <DropZone
        onDrop={onDrop}
        position={position}
        accentColor={accentColor}
        isEmpty={isEmpty}
      >
        {!isEmpty && (
          <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
            {/* Header with title and clear button */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-sm text-zinc-300 truncate">
                {conversationData?.title || 'Loading...'}
              </span>
              <button
                onClick={onClear}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Remove from comparison"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4" style={{ contain: 'inline-size' }}>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-400" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-400 text-sm">{error}</div>
              ) : conversationData?.messages.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  No messages in this conversation
                </div>
              ) : (
                conversationData?.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
            </div>

            {/* Stats footer */}
            {conversationData && conversationData.messages.length > 0 && (
              <PaneStats messages={conversationData.messages} accentColor={accentColor} />
            )}
          </div>
        )}
      </DropZone>
    </div>
  );
}

// Calculate cumulative stats from messages (excludes skill-agent tokens)
function calculateStats(messages: Message[]): ConversationStats {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCachedTokens = 0;
  let totalReasoningTokens = 0;
  let totalExecutionTimeMs = 0;
  let messageCount = 0;

  for (const message of messages) {
    // Skip user messages
    if (message.role !== 'assistant') continue;

    // Skip skill-agent responses
    if (message.agent === 'skill') continue;

    const stats = message.stats;
    if (stats) {
      totalPromptTokens += stats.promptTokens || 0;
      totalCompletionTokens += stats.completionTokens || 0;
      totalCachedTokens += stats.cachedTokens || 0;
      totalReasoningTokens += stats.reasoningTokens || 0;
      totalExecutionTimeMs += stats.executionTimeMs || 0;
      messageCount++;
    }
  }

  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalCachedTokens,
    totalReasoningTokens,
    totalExecutionTimeMs,
    messageCount,
  };
}

// Compact stats display at bottom of pane
function PaneStats({
  messages,
  accentColor,
}: {
  messages: Message[];
  accentColor: 'amber' | 'emerald';
}) {
  const stats = calculateStats(messages);

  if (stats.messageCount === 0) return null;

  const colorClass = accentColor === 'amber' ? 'text-cyan-400' : 'text-teal-400';

  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-white/5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>
          <span className={colorClass}>{(stats.totalExecutionTimeMs / 1000).toFixed(1)}s</span> time
        </span>
        <span>
          <span className={colorClass}>{stats.totalPromptTokens.toLocaleString()}</span> in
        </span>
        <span>
          <span className={colorClass}>{stats.totalCompletionTokens.toLocaleString()}</span> out
        </span>
        {stats.totalReasoningTokens > 0 && (
          <span>
            <span className={colorClass}>{stats.totalReasoningTokens.toLocaleString()}</span> reasoning
          </span>
        )}
        <span className="text-zinc-600">(excludes skill codification)</span>
      </div>
    </div>
  );
}
