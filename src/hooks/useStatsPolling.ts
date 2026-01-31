'use client';

import { useRef, useCallback, useEffect } from 'react';
import type { MessageStats } from '@/lib/messages/transform';

interface PollConfig {
  rootSpanId: string;
  messageId: string;
  conversationId: string;
}

interface UseStatsPollingOptions {
  onStatsResolved: (messageId: string, stats: MessageStats) => void;
  maxAttempts?: number;
  baseInterval?: number;
  consecutiveMatchesRequired?: number;
}

interface PollState {
  attempt: number;
  consecutiveMatches: number;
  lastStats: MessageStats | null;
  timeoutId: NodeJS.Timeout | null;
  aborted: boolean;
}

/**
 * Hook for polling token stats with eventual consistency.
 *
 * Parameters (from issue spec):
 * - consecutiveMatchesRequired: 3 (ensures stats are stable)
 * - baseInterval: 2000ms (2 seconds between queries)
 * - maxAttempts: 8 (16s worst case)
 */
export function useStatsPolling(options: UseStatsPollingOptions) {
  const {
    onStatsResolved,
    maxAttempts = 8,
    baseInterval = 2000,
    consecutiveMatchesRequired = 3,
  } = options;

  const activePollsRef = useRef<Map<string, PollState>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const poll of activePollsRef.current.values()) {
        poll.aborted = true;
        if (poll.timeoutId) clearTimeout(poll.timeoutId);
      }
      activePollsRef.current.clear();
    };
  }, []);

  const startPolling = useCallback((config: PollConfig) => {
    const { rootSpanId, messageId, conversationId } = config;

    // Don't start duplicate polling for same message
    if (activePollsRef.current.has(messageId)) return;

    const pollState: PollState = {
      attempt: 0,
      consecutiveMatches: 0,
      lastStats: null,
      timeoutId: null,
      aborted: false,
    };
    activePollsRef.current.set(messageId, pollState);

    const poll = async () => {
      if (pollState.aborted) return;
      pollState.attempt++;

      try {
        const response = await fetch(
          `/api/stats/${rootSpanId}?conversationId=${conversationId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Message not found - stop polling with failed status
            onStatsResolved(messageId, { statsStatus: 'failed' });
            activePollsRef.current.delete(messageId);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'resolved' && data.stats) {
          // Semantic comparison for consecutive match detection
          const statsMatch = pollState.lastStats &&
            pollState.lastStats.promptTokens === data.stats.promptTokens &&
            pollState.lastStats.completionTokens === data.stats.completionTokens &&
            pollState.lastStats.cachedTokens === data.stats.cachedTokens &&
            pollState.lastStats.reasoningTokens === data.stats.reasoningTokens;

          if (statsMatch) {
            pollState.consecutiveMatches++;
          } else {
            pollState.consecutiveMatches = 1;
            pollState.lastStats = data.stats;
          }

          // Check if we have enough consecutive matches
          if (pollState.consecutiveMatches >= consecutiveMatchesRequired) {
            const resolvedStats: MessageStats = {
              ...data.stats,
              statsStatus: 'resolved',
            };
            onStatsResolved(messageId, resolvedStats);
            activePollsRef.current.delete(messageId);
            return;
          }
        }
      } catch (error) {
        console.warn(`[StatsPolling] Attempt ${pollState.attempt} failed:`, error);
      }

      // Check if max attempts reached
      if (pollState.attempt >= maxAttempts) {
        // Return best-effort result with failed status
        onStatsResolved(messageId, {
          ...pollState.lastStats,
          statsStatus: 'failed',
        });
        activePollsRef.current.delete(messageId);
        return;
      }

      // Schedule next poll
      if (!pollState.aborted) {
        pollState.timeoutId = setTimeout(poll, baseInterval);
      }
    };

    // Start polling
    poll();
  }, [onStatsResolved, maxAttempts, baseInterval, consecutiveMatchesRequired]);

  const stopPolling = useCallback((messageId: string) => {
    const poll = activePollsRef.current.get(messageId);
    if (poll) {
      poll.aborted = true;
      if (poll.timeoutId) clearTimeout(poll.timeoutId);
      activePollsRef.current.delete(messageId);
    }
  }, []);

  return { startPolling, stopPolling };
}
