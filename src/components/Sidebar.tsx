'use client';

import { useState, useEffect, useRef } from 'react';
import type { GroupedConversations, Conversation } from '@/hooks/useConversations';
import type { SkillMeta } from '@/hooks/useSkills';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: GroupedConversations;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  skills: SkillMeta[];
  skillsLoading: boolean;
  onDeleteSkill: (name: string) => void;
  onSelectSkill: (name: string) => void;
  onShowSystemPrompt: () => void;
  // Comparison mode props
  isComparisonMode?: boolean;
  selectedForComparison?: string | null;
  onSelectForComparison?: (id: string | null) => void;
  onAddToLeft?: (id: string) => void;
  onAddToRight?: (id: string) => void;
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  count,
  storageKey,
  children,
}: {
  title: string;
  count: number;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(`sidebar-collapsed-${storageKey}`);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(`sidebar-collapsed-${storageKey}`, String(isCollapsed));
  }, [isCollapsed, storageKey]);

  return (
    <div className="flex flex-col min-h-0">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="uppercase tracking-wider">{title}</span>
        <span className="ml-auto text-zinc-500">({count})</span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  isComparisonMode,
  isSelectedForComparison,
  onSelectForComparison,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  isComparisonMode?: boolean;
  isSelectedForComparison?: boolean;
  onSelectForComparison?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showMenu, setShowMenu] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditTitle(conversation.title);
  };

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(conversation.title);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/conversation-id', conversation.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isComparisonMode && onSelectForComparison) {
      e.stopPropagation();
      onSelectForComparison();
    } else {
      onSelect();
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelectedForComparison
          ? 'bg-blue-600/30 border border-blue-500'
          : isActive
            ? 'bg-zinc-700'
            : 'hover:bg-zinc-800'
      } ${isComparisonMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={isComparisonMode}
      onDragStart={handleDragStart}
      data-conversation-id={conversation.id}
    >
      {/* Chat icon */}
      <svg
        className="w-4 h-4 text-zinc-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>

      {/* Title */}
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-zinc-600 text-zinc-100 text-sm px-1 py-0.5 rounded outline-none"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm text-zinc-200 truncate">
          {conversation.title}
        </span>
      )}

      {/* Actions menu */}
      {!isEditing && (
        <div className="relative">
          <button
            ref={menuButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!showMenu && menuButtonRef.current) {
                const rect = menuButtonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const menuHeight = 80;

                if (spaceBelow < menuHeight + 10) {
                  setMenuStyle({
                    position: 'fixed',
                    right: window.innerWidth - rect.right,
                    bottom: window.innerHeight - rect.top + 4,
                  });
                } else {
                  setMenuStyle({
                    position: 'fixed',
                    right: window.innerWidth - rect.right,
                    top: rect.bottom + 4,
                  });
                }
              }
              setShowMenu(!showMenu);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-600 transition-opacity"
          >
            <svg
              className="w-4 h-4 text-zinc-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div
                className="z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[120px]"
                style={menuStyle}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    setIsEditing(true);
                    setEditTitle(conversation.title);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationGroup({
  title,
  conversations,
  currentId,
  onSelect,
  onDelete,
  onRename,
  isComparisonMode,
  selectedForComparison,
  onSelectForComparison,
}: {
  title: string;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isComparisonMode?: boolean;
  selectedForComparison?: string | null;
  onSelectForComparison?: (id: string | null) => void;
}) {
  if (conversations.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="px-3 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-0.5">
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === currentId}
            onSelect={() => onSelect(conv.id)}
            onDelete={() => onDelete(conv.id)}
            onRename={(newTitle) => onRename(conv.id, newTitle)}
            isComparisonMode={isComparisonMode}
            isSelectedForComparison={selectedForComparison === conv.id}
            onSelectForComparison={() => {
              if (onSelectForComparison) {
                onSelectForComparison(selectedForComparison === conv.id ? null : conv.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Skill Item Component
function SkillItem({
  skill,
  onSelect,
  onDelete,
}: {
  skill: SkillMeta;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 80; // Approximate menu height

      if (spaceBelow < menuHeight + 10) {
        // Position above
        setMenuStyle({
          position: 'fixed',
          right: window.innerWidth - rect.right,
          bottom: window.innerHeight - rect.top + 4,
        });
      } else {
        // Position below
        setMenuStyle({
          position: 'fixed',
          right: window.innerWidth - rect.right,
          top: rect.bottom + 4,
        });
      }
    }
    setShowMenu(!showMenu);
  };

  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      {/* Skill icon */}
      <svg
        className="w-4 h-4 text-zinc-400 flex-shrink-0"
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

      {/* Name and description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 truncate">{skill.name}</div>
        {skill.description && (
          <div className="text-xs text-zinc-500 truncate">{skill.description}</div>
        )}
      </div>

      {/* Actions menu */}
      <div className="relative">
        <button
          ref={menuButtonRef}
          onClick={handleMenuToggle}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-600 transition-opacity"
        >
          <svg
            className="w-4 h-4 text-zinc-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowDeleteConfirm(false);
              }}
            />
            <div
              className="z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[120px]"
              style={menuStyle}
            >
              {showDeleteConfirm ? (
                <>
                  <div className="px-3 py-1.5 text-xs text-zinc-400">Delete this skill?</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                      setShowMenu(false);
                      setShowDeleteConfirm(false);
                    }}
                    className="w-full px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 text-left"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false);
                    }}
                    className="w-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 text-left"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  isOpen,
  onToggle,
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  skills,
  skillsLoading,
  onDeleteSkill,
  onSelectSkill,
  onShowSystemPrompt,
  isComparisonMode,
  selectedForComparison,
  onSelectForComparison,
  onAddToLeft,
  onAddToRight,
}: SidebarProps) {
  // Count total conversations
  const totalConversations =
    conversations.today.length +
    conversations.yesterday.length +
    conversations.lastWeek.length +
    conversations.lastMonth.length +
    conversations.older.length;

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className={`fixed top-4 z-30 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all ${
          isOpen ? 'left-[216px]' : 'left-4'
        }`}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <svg
          className="w-5 h-5 text-zinc-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-200 z-20 ${
          isOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col h-full pt-16 pb-4">
          {/* New Chat button */}
          <div className="px-3 mb-4 flex-shrink-0">
            <button
              onClick={onNew}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <svg
                className="w-4 h-4 text-zinc-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm text-zinc-200">New chat</span>
            </button>
          </div>

          {/* Comparison mode action buttons */}
          {isComparisonMode && selectedForComparison && (
            <div className="px-3 mb-2 flex gap-2">
              <button
                onClick={() => onAddToLeft?.(selectedForComparison)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                data-testid="add-to-left"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14V5" />
                </svg>
                Add to Left
              </button>
              <button
                onClick={() => onAddToRight?.(selectedForComparison)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                data-testid="add-to-right"
              >
                Add to Right
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
                </svg>
              </button>
            </div>
          )}

          {/* Chat History Section (grows down, takes remaining space) */}
          <CollapsibleSection
            title="Chat History"
            count={totalConversations}
            storageKey="chat-history"
          >
            <div className="flex-1 overflow-y-auto px-2 min-h-0">
              <ConversationGroup
                title="Today"
                conversations={conversations.today}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                isComparisonMode={isComparisonMode}
                selectedForComparison={selectedForComparison}
                onSelectForComparison={onSelectForComparison}
              />
              <ConversationGroup
                title="Yesterday"
                conversations={conversations.yesterday}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                isComparisonMode={isComparisonMode}
                selectedForComparison={selectedForComparison}
                onSelectForComparison={onSelectForComparison}
              />
              <ConversationGroup
                title="Last 7 days"
                conversations={conversations.lastWeek}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                isComparisonMode={isComparisonMode}
                selectedForComparison={selectedForComparison}
                onSelectForComparison={onSelectForComparison}
              />
              <ConversationGroup
                title="Last 30 days"
                conversations={conversations.lastMonth}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                isComparisonMode={isComparisonMode}
                selectedForComparison={selectedForComparison}
                onSelectForComparison={onSelectForComparison}
              />
              <ConversationGroup
                title="Older"
                conversations={conversations.older}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                isComparisonMode={isComparisonMode}
                selectedForComparison={selectedForComparison}
                onSelectForComparison={onSelectForComparison}
              />
            </div>
          </CollapsibleSection>

          {/* Spacer */}
          <div className="flex-1 min-h-0" />

          {/* Divider */}
          <div className="border-t border-zinc-800 mx-2" />

          {/* Skills Section (pinned at bottom, grows up) */}
          <CollapsibleSection
            title="Skills"
            count={skills.length}
            storageKey="skills"
          >
            <div className="flex-shrink-0 max-h-[40vh] overflow-y-auto px-2">
              {skillsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-400" />
                </div>
              ) : skills.length === 0 ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                  No skills yet
                </div>
              ) : (
                <div className="space-y-0.5">
                  {skills.map((skill) => (
                    <SkillItem
                      key={skill.name}
                      skill={skill}
                      onSelect={() => onSelectSkill(skill.name)}
                      onDelete={() => onDeleteSkill(skill.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* View System Prompt button (for judges) */}
          <div className="px-3 py-3 border-t border-zinc-800 flex-shrink-0">
            <button
              onClick={onShowSystemPrompt}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span className="text-sm">View System Prompt</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
