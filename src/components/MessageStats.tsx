'use client';

import { MessageStats as MessageStatsType } from '@/hooks/useTsugiChat';

interface MessageStatsProps {
  stats: MessageStatsType | undefined;
}

export function MessageStats({ stats }: MessageStatsProps) {
  if (!stats) return null;

  const { statsStatus } = stats;

  // Loading state - pending or polling
  if (statsStatus === 'pending' || statsStatus === 'polling') {
    return (
      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
            Fetching token stats...
          </span>
          <span>Time: {stats.executionTimeMs ? `${(stats.executionTimeMs / 1000).toFixed(1)}s` : '-'}</span>
        </div>
      </div>
    );
  }

  // Failed state - polling timed out
  if (statsStatus === 'failed') {
    return (
      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span title="Token stats unavailable (polling timeout)">Tokens: —</span>
          <span>Time: {stats.executionTimeMs ? `${(stats.executionTimeMs / 1000).toFixed(1)}s` : '-'}</span>
        </div>
      </div>
    );
  }

  // Unavailable state - Braintrust not configured or legacy tokensUnavailable
  if (statsStatus === 'unavailable' || stats.tokensUnavailable) {
    return (
      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span title="Token stats unavailable (observability service unreachable)">Tokens: —</span>
          <span>Time: {stats.executionTimeMs ? `${(stats.executionTimeMs / 1000).toFixed(1)}s` : '-'}</span>
        </div>
      </div>
    );
  }

  // Resolved state (or no status = legacy behavior) - display all stats
  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>In: {stats.promptTokens?.toLocaleString() ?? '-'}</span>
        <span>Out: {stats.completionTokens?.toLocaleString() ?? '-'}</span>
        <span>Time: {stats.executionTimeMs ? `${(stats.executionTimeMs / 1000).toFixed(1)}s` : '-'}</span>
      </div>
      {(stats.cachedTokens || stats.reasoningTokens) ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 mt-1">
          {stats.cachedTokens ? <span>Cached: {stats.cachedTokens.toLocaleString()}</span> : null}
          {stats.reasoningTokens ? <span>Reasoning: {stats.reasoningTokens.toLocaleString()}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
