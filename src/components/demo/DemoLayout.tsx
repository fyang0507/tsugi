'use client';

import { useState, useCallback } from 'react';
import { ComparisonPane } from './ComparisonPane';
import { SkillsPane } from './SkillsPane';
import { MetricsBar, ConversationStats } from './MetricsBar';
import type { SkillMeta } from '@/hooks/useSkills';

interface DemoLayoutProps {
  leftConversationId: string | null;
  rightConversationId: string | null;
  onDropLeft: (id: string) => void;
  onDropRight: (id: string) => void;
  onClearLeft: () => void;
  onClearRight: () => void;
  skills: SkillMeta[];
  skillsLoading: boolean;
  onSelectSkill: (name: string) => void;
}

export function DemoLayout({
  leftConversationId,
  rightConversationId,
  onDropLeft,
  onDropRight,
  onClearLeft,
  onClearRight,
  skills,
  skillsLoading,
  onSelectSkill,
}: DemoLayoutProps) {
  const [leftStats, setLeftStats] = useState<ConversationStats | null>(null);
  const [rightStats, setRightStats] = useState<ConversationStats | null>(null);

  const handleLeftStats = useCallback((stats: ConversationStats | null) => {
    setLeftStats(stats);
  }, []);

  const handleRightStats = useCallback((stats: ConversationStats | null) => {
    setRightStats(stats);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 3-pane layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left pane - Run 1 (Learning) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ComparisonPane
            conversationId={leftConversationId}
            position="left"
            onDrop={onDropLeft}
            onClear={onClearLeft}
            onStatsLoaded={handleLeftStats}
          />
        </div>

        {/* Middle pane - Skills */}
        <div className="w-64 flex-shrink-0">
          <SkillsPane
            skills={skills}
            loading={skillsLoading}
            onSelectSkill={onSelectSkill}
          />
        </div>

        {/* Right pane - Run 2 (Efficiency) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ComparisonPane
            conversationId={rightConversationId}
            position="right"
            onDrop={onDropRight}
            onClear={onClearRight}
            onStatsLoaded={handleRightStats}
          />
        </div>
      </div>

      {/* Bottom metrics bar */}
      <MetricsBar leftStats={leftStats} rightStats={rightStats} />
    </div>
  );
}
