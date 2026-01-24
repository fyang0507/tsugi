'use client';

import type { SkillMeta } from '@/hooks/useSkills';

interface SkillsPaneProps {
  skills: SkillMeta[];
  loading: boolean;
  onSelectSkill: (name: string) => void;
}

function SkillCard({
  skill,
  index,
  onSelect,
}: {
  skill: SkillMeta;
  index: number;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="p-4 bg-white/[0.02] border border-teal-500/15 rounded-xl cursor-pointer hover:border-teal-500/30 hover:bg-teal-500/5 transition-all animate-slideUp"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Skill icon */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-teal-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-teal-300 truncate">
            {skill.name}
          </div>
          {skill.description && (
            <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
              {skill.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkillsPane({ skills, loading, onSelectSkill }: SkillsPaneProps) {
  return (
    <div className="flex flex-col h-full border border-teal-500/20 bg-white/[0.02] rounded-2xl">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/5 text-teal-400 text-sm font-medium">
        Skills Created
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-400" />
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-teal-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div className="text-sm text-zinc-500">No skills yet</div>
            <div className="text-xs text-zinc-600 mt-1">
              Skills will appear here after Run 1
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill, index) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                index={index}
                onSelect={() => onSelectSkill(skill.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
