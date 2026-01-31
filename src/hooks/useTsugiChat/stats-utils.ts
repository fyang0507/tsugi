import type { CumulativeStats, Message } from './types';
import type { MessageStats } from '@/lib/messages/transform';

/**
 * Create empty cumulative stats
 */
export function createEmptyStats(): CumulativeStats {
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCachedTokens: 0,
    totalReasoningTokens: 0,
    totalExecutionTimeMs: 0,
    messageCount: 0,
    tokensUnavailableCount: 0,
  };
}

/**
 * Calculate cumulative stats from a list of messages.
 * Stats are stored in message.metadata.stats for AI SDK messages.
 * Only counts tokens for messages with resolved stats status.
 */
export function calculateCumulativeStats(messages: Message[]): CumulativeStats {
  return messages.reduce((acc, m) => {
    // Get stats from metadata (AI SDK style)
    const stats = m.metadata?.stats;
    if (stats) {
      // Only count tokens if status is resolved (or no status = legacy behavior)
      const isResolved = !stats.statsStatus || stats.statsStatus === 'resolved';
      const isUnavailable = stats.tokensUnavailable || stats.statsStatus === 'unavailable' || stats.statsStatus === 'failed';

      if (isUnavailable) {
        acc.tokensUnavailableCount += 1;
      } else if (isResolved) {
        acc.totalPromptTokens += stats.promptTokens || 0;
        acc.totalCompletionTokens += stats.completionTokens || 0;
        acc.totalCachedTokens += stats.cachedTokens || 0;
        acc.totalReasoningTokens += stats.reasoningTokens || 0;
      }
      // Pending status: don't count tokens yet, they'll be added when resolved
      acc.totalExecutionTimeMs += stats.executionTimeMs || 0;
    }
    if (m.role === 'assistant') {
      acc.messageCount += 1;
    }
    return acc;
  }, createEmptyStats());
}

/**
 * Update cumulative stats with new message stats
 */
export function updateCumulativeStats(
  current: CumulativeStats,
  stats: MessageStats
): CumulativeStats {
  return {
    totalPromptTokens: current.totalPromptTokens + (stats.tokensUnavailable ? 0 : (stats.promptTokens || 0)),
    totalCompletionTokens: current.totalCompletionTokens + (stats.tokensUnavailable ? 0 : (stats.completionTokens || 0)),
    totalCachedTokens: current.totalCachedTokens + (stats.tokensUnavailable ? 0 : (stats.cachedTokens || 0)),
    totalReasoningTokens: current.totalReasoningTokens + (stats.tokensUnavailable ? 0 : (stats.reasoningTokens || 0)),
    totalExecutionTimeMs: current.totalExecutionTimeMs + (stats.executionTimeMs || 0),
    messageCount: current.messageCount + 1,
    tokensUnavailableCount: current.tokensUnavailableCount + (stats.tokensUnavailable ? 1 : 0),
  };
}
