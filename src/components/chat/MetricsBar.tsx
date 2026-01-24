'use client';

import { AnimatedCounter, formatTime, formatCompact } from './AnimatedCounter';

export interface ConversationStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
}

interface MetricsBarProps {
  leftStats: ConversationStats | null;
  rightStats: ConversationStats | null;
}

interface MetricItemProps {
  label: string;
  leftValue: number;
  rightValue: number;
  formatFn?: (value: number) => string;
  invertPositive?: boolean; // For cases where lower is better (like time)
}

function MetricItem({
  label,
  leftValue,
  rightValue,
  formatFn = formatCompact,
  invertPositive = false,
}: MetricItemProps) {
  const saved = leftValue - rightValue;
  const percentChange = leftValue > 0 ? ((saved / leftValue) * 100) : 0;
  const isPositive = invertPositive ? saved > 0 : saved > 0;
  const isSignificant = Math.abs(percentChange) >= 1;

  return (
    <div className="flex flex-col items-center px-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        {isSignificant ? (
          <>
            <AnimatedCounter
              value={Math.abs(saved)}
              formatFn={formatFn}
              className={`text-lg font-semibold ${isPositive ? 'text-cyan-400' : 'text-red-400'}`}
            />
            <span className={`text-xs ${isPositive ? 'text-teal-500' : 'text-red-500'}`}>
              {isPositive ? '-' : '+'}{Math.abs(percentChange).toFixed(0)}%
            </span>
          </>
        ) : (
          <span className="text-lg font-semibold text-zinc-400">~</span>
        )}
      </div>
    </div>
  );
}

export function MetricsBar({ leftStats, rightStats }: MetricsBarProps) {
  // Only show metrics when both conversations have stats
  if (!leftStats || !rightStats) {
    return (
      <div className="px-6 py-4 relative z-10">
        <div className="flex items-center justify-center text-sm text-zinc-500">
          {!leftStats && !rightStats
            ? 'Select conversations to compare metrics'
            : 'Waiting for both conversations to load stats...'}
        </div>
      </div>
    );
  }

  // Only show if both have at least one message
  if (leftStats.messageCount === 0 || rightStats.messageCount === 0) {
    return (
      <div className="px-6 py-4 relative z-10">
        <div className="flex items-center justify-center text-sm text-zinc-500">
          Both conversations need messages to compare
        </div>
      </div>
    );
  }

  const timeSaved = leftStats.totalExecutionTimeMs - rightStats.totalExecutionTimeMs;
  const timeSavedPercent = leftStats.totalExecutionTimeMs > 0
    ? ((timeSaved / leftStats.totalExecutionTimeMs) * 100)
    : 0;

  return (
    <div className="px-6 py-4 relative z-10">
      <div className="flex items-center justify-center gap-8">
        {/* Time saved - special formatting */}
        <div className="flex flex-col items-center px-4">
          <div className="text-xs text-zinc-500 mb-1">Time Saved</div>
          <div className="flex items-baseline gap-2">
            {Math.abs(timeSavedPercent) >= 1 ? (
              <>
                <AnimatedCounter
                  value={Math.abs(timeSaved)}
                  formatFn={formatTime}
                  className={`text-lg font-semibold ${timeSaved > 0 ? 'text-cyan-400' : 'text-red-400'}`}
                />
                <span className={`text-xs ${timeSaved > 0 ? 'text-teal-500' : 'text-red-500'}`}>
                  {timeSaved > 0 ? '-' : '+'}{Math.abs(timeSavedPercent).toFixed(0)}%
                </span>
              </>
            ) : (
              <span className="text-lg font-semibold text-zinc-400">~</span>
            )}
          </div>
        </div>

        <div className="w-px h-8 bg-white/10" />

        <MetricItem
          label="Input Tokens"
          leftValue={leftStats.totalPromptTokens}
          rightValue={rightStats.totalPromptTokens}
        />

        <MetricItem
          label="Output Tokens"
          leftValue={leftStats.totalCompletionTokens}
          rightValue={rightStats.totalCompletionTokens}
        />

        {(leftStats.totalReasoningTokens > 0 || rightStats.totalReasoningTokens > 0) && (
          <MetricItem
            label="Reasoning Tokens"
            leftValue={leftStats.totalReasoningTokens}
            rightValue={rightStats.totalReasoningTokens}
          />
        )}
      </div>
      <div className="text-center text-xs text-zinc-600 mt-2">
        (excludes skill codification)
      </div>
    </div>
  );
}
