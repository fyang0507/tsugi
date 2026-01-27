'use client';

import { CumulativeStats, SandboxStatus } from '@/hooks/useTsugiChat';
import { SandboxStatusIndicator } from './SandboxStatusIndicator';

interface CumulativeStatsBarProps {
  stats: CumulativeStats;
  sandboxStatus?: SandboxStatus;
}

export function CumulativeStatsBar({ stats, sandboxStatus }: CumulativeStatsBarProps) {
  // Show sandbox status even when no messages yet
  const showSandboxOnly = stats.messageCount === 0 && sandboxStatus;

  if (stats.messageCount === 0 && !sandboxStatus) return null;

  const cacheRatio = stats.totalPromptTokens > 0
    ? ((stats.totalCachedTokens / stats.totalPromptTokens) * 100).toFixed(0)
    : 0;

  // Check if all messages have unavailable tokens
  const allUnavailable = stats.tokensUnavailableCount === stats.messageCount;
  const someUnavailable = stats.tokensUnavailableCount > 0 && !allUnavailable;

  return (
    <div className="px-6 py-2 relative z-10">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-6 text-xs text-zinc-500">
        {sandboxStatus && (
          <>
            <SandboxStatusIndicator status={sandboxStatus} />
            {!showSandboxOnly && <span className="text-zinc-600">|</span>}
          </>
        )}
        {!showSandboxOnly && (
          <>
            {allUnavailable ? (
              <span title="Token stats unavailable (observability service unreachable)">Tokens: —</span>
            ) : (
              <>
                <span>Total In: {stats.totalPromptTokens.toLocaleString()}{someUnavailable ? '*' : ''}</span>
                <span>Cached: {stats.totalCachedTokens.toLocaleString()} ({cacheRatio}%)</span>
                <span>Total Out: {stats.totalCompletionTokens.toLocaleString()}{someUnavailable ? '*' : ''}</span>
                {stats.totalReasoningTokens > 0 && (
                  <span>Reasoning: {stats.totalReasoningTokens.toLocaleString()}</span>
                )}
              </>
            )}
            <span>Time: {(stats.totalExecutionTimeMs / 1000).toFixed(1)}s</span>
            <span className="text-zinc-600">|</span>
            <span>{stats.messageCount} response{stats.messageCount !== 1 ? 's' : ''}</span>
            {someUnavailable && (
              <span className="text-zinc-600" title={`${stats.tokensUnavailableCount} response(s) missing token stats`}>
                *partial
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
