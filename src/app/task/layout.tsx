'use client';

import { useCallback, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TaskLayoutProvider, useTaskLayout } from './TaskLayoutContext';
import { Sidebar } from '@/components/Sidebar';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { Logo } from '@/components/landing/Logo';
import { Comparison } from '@/components/chat/ChatLayout';
import { PinnedComparison } from '@/hooks/usePinnedComparisons';

// Full skill data for the detail view
interface SkillDetail {
  name: string;
  description: string;
  content: string;
  files: string[];
  updatedAt: string;
}

// Skill Detail Modal Component
function SkillDetailModal({
  skill,
  onClose,
}: {
  skill: SkillDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-panel border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{skill.name}</h2>
            {skill.description && (
              <p className="text-sm text-zinc-400 mt-0.5">{skill.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded-lg p-4 overflow-x-auto">
            {skill.content}
          </pre>

          {skill.files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Additional Files</h3>
              <div className="flex flex-wrap gap-2">
                {skill.files.map((file) => (
                  <span
                    key={file}
                    className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 text-xs text-zinc-500">
          Last updated: {new Date(skill.updatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// System Prompt Modal Component
function SystemPromptModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'task' | 'skill'>('task');
  const [prompts, setPrompts] = useState<{ taskAgent: string; skillAgent: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/prompts')
      .then(res => res.json())
      .then(data => {
        setPrompts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-panel border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Agent System Prompts</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              View the instructions that guide our AI agents
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('task')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'task'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Task Agent
          </button>
          <button
            onClick={() => setActiveTab('skill')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'skill'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Skill Agent
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-400" />
            </div>
          ) : (
            <>
              {activeTab === 'task' && (
                <div>
                  <div className="mb-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                    <p className="text-sm text-cyan-300">
                      <strong>Task Agent:</strong> Executes user tasks in a sandbox environment. Has access to a skill library for reusable procedures.
                    </p>
                  </div>
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded-lg p-4 overflow-x-auto">
                    {prompts?.taskAgent || 'Failed to load prompt'}
                  </pre>
                </div>
              )}
              {activeTab === 'skill' && (
                <div>
                  <div className="mb-3 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                    <p className="text-sm text-teal-300">
                      <strong>Skill Agent:</strong> Analyzes completed task transcripts and codifies reusable knowledge into skills for future runs.
                    </p>
                  </div>
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded-lg p-4 overflow-x-auto">
                    {prompts?.skillAgent || 'Failed to load prompt'}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 text-xs text-zinc-500">
          tsugi Dual-Agent System
        </div>
      </div>
    </div>
  );
}

function TaskLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Extract conversation ID from pathname
  const currentConversationId = pathname.startsWith('/task/')
    ? pathname.slice('/task/'.length)
    : null;

  const {
    sidebarOpen,
    toggleSidebar,
    groupedConversations,
    deleteConversation,
    renameConversation,
    skills,
    skillsLoading,
    deleteSkill,
    selectedSkill,
    setSelectedSkill,
    handleSelectSkill,
    showSystemPrompt,
    setShowSystemPrompt,
    isComparisonMode,
    toggleComparisonMode,
    leftConversationId,
    setLeftConversationId,
    rightConversationId,
    setRightConversationId,
    selectedForComparison,
    setSelectedForComparison,
    leftTitle,
    setLeftTitle,
    rightTitle,
    setRightTitle,
    pinnedComparisons,
    pinComparison,
    unpinComparison,
    renameComparison,
    isPinned,
    showPinModal,
    setShowPinModal,
    pinName,
    setPinName,
  } = useTaskLayout();

  // Handle creating a new chat
  const handleNewChat = useCallback(() => {
    // Exit comparison mode if active
    if (isComparisonMode) {
      toggleComparisonMode();
    }
    // Navigate to /task for new chat
    router.push('/task');
  }, [isComparisonMode, toggleComparisonMode, router]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    const wasCurrentConversation = id === currentConversationId;
    await deleteConversation(id);

    // If we deleted the current conversation, navigate to /task
    if (wasCurrentConversation) {
      router.push('/task');
    }
  }, [deleteConversation, currentConversationId, router]);

  // Comparison mode handlers
  const handleAddToLeft = useCallback((id: string) => {
    setLeftConversationId(id);
    setSelectedForComparison(null);
  }, [setLeftConversationId, setSelectedForComparison]);

  const handleAddToRight = useCallback((id: string) => {
    setRightConversationId(id);
    setSelectedForComparison(null);
  }, [setRightConversationId, setSelectedForComparison]);

  const handleClearLeft = useCallback(() => {
    setLeftConversationId(null);
  }, [setLeftConversationId]);

  const handleClearRight = useCallback(() => {
    setRightConversationId(null);
  }, [setRightConversationId]);

  const handleTitlesAvailable = useCallback((left: string | null, right: string | null) => {
    setLeftTitle(left);
    setRightTitle(right);
  }, [setLeftTitle, setRightTitle]);

  const handleLoadPinnedComparison = useCallback((comparison: PinnedComparison) => {
    if (!isComparisonMode) {
      toggleComparisonMode();
    }
    setLeftConversationId(comparison.leftConversationId);
    setRightConversationId(comparison.rightConversationId);
  }, [isComparisonMode, toggleComparisonMode, setLeftConversationId, setRightConversationId]);

  const handlePinComparison = useCallback(async () => {
    if (!leftConversationId || !rightConversationId || !leftTitle || !rightTitle) return;
    const id = await pinComparison(pinName, leftConversationId, rightConversationId, leftTitle, rightTitle);
    if (id) {
      setShowPinModal(false);
      setPinName('');
    }
  }, [leftConversationId, rightConversationId, leftTitle, rightTitle, pinName, pinComparison, setShowPinModal, setPinName]);

  const handleOpenPinModal = useCallback(() => {
    const defaultName = leftTitle && rightTitle
      ? `${leftTitle} vs ${rightTitle}`
      : leftTitle
        ? `${leftTitle} vs ...`
        : rightTitle
          ? `... vs ${rightTitle}`
          : 'Comparison';
    setPinName(defaultName);
    setShowPinModal(true);
  }, [leftTitle, rightTitle, setPinName, setShowPinModal]);

  return (
    <div className="flex h-screen text-zinc-100 overflow-hidden relative">
      {/* Background Layer - Floating Orbs */}
      <FloatingOrbs />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        conversations={groupedConversations}
        currentId={currentConversationId}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        onRename={renameConversation}
        skills={skills}
        skillsLoading={skillsLoading}
        onDeleteSkill={deleteSkill}
        onSelectSkill={handleSelectSkill}
        onShowSystemPrompt={() => setShowSystemPrompt(true)}
        isComparisonMode={isComparisonMode}
        selectedForComparison={selectedForComparison}
        onSelectForComparison={setSelectedForComparison}
        onAddToLeft={handleAddToLeft}
        onAddToRight={handleAddToRight}
        pinnedComparisons={pinnedComparisons}
        onLoadPinnedComparison={handleLoadPinnedComparison}
        onUnpinComparison={unpinComparison}
        onRenamePinnedComparison={renameComparison}
      />

      {/* Main content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 relative z-10 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="flex-shrink-0 py-4 relative z-10">
          <div className={`w-full ${isComparisonMode ? 'px-6' : 'max-w-4xl px-6'} mx-auto flex items-center justify-between`}>
            <div className={`transition-all ${sidebarOpen ? '' : 'ml-8'}`}>
              <Link href="/">
                <Logo className="h-10" />
              </Link>
              <p className="text-sm text-zinc-400 mt-1">
                Explore once. Exploit next.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Mode toggle */}
              <div className="flex items-center bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-1">
                <button
                  onClick={toggleComparisonMode}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    !isComparisonMode
                      ? 'bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-cyan-100 border border-cyan-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Task
                </button>
                <button
                  onClick={toggleComparisonMode}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    isComparisonMode
                      ? 'bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-cyan-100 border border-cyan-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  data-testid="comparison-toggle"
                >
                  Comparison
                </button>
              </div>

              {/* Pin comparison button */}
              {isComparisonMode && (
                <button
                  onClick={handleOpenPinModal}
                  disabled={!leftConversationId || !rightConversationId || !leftTitle || !rightTitle || isPinned(leftConversationId, rightConversationId)}
                  className={`px-3 py-1.5 text-sm rounded-xl transition-all flex items-center gap-1.5 ${
                    isPinned(leftConversationId, rightConversationId)
                      ? 'glass-panel border border-white/10 text-zinc-400 cursor-not-allowed'
                      : !leftConversationId || !rightConversationId || !leftTitle || !rightTitle
                        ? 'glass-panel border border-white/10 text-zinc-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {isPinned(leftConversationId, rightConversationId) ? 'Pinned' : 'Pin'}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Conditional content: Comparison mode or page content */}
        {isComparisonMode ? (
          <Comparison
            leftConversationId={leftConversationId}
            rightConversationId={rightConversationId}
            onDropLeft={handleAddToLeft}
            onDropRight={handleAddToRight}
            onClearLeft={handleClearLeft}
            onClearRight={handleClearRight}
            onTitlesAvailable={handleTitlesAvailable}
          />
        ) : (
          children
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {/* System Prompt Modal */}
      {showSystemPrompt && (
        <SystemPromptModal onClose={() => setShowSystemPrompt(false)} />
      )}

      {/* Pin Comparison Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPinModal(false)} />
          <div className="relative glass-panel border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Pin Comparison</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Save this comparison for quick access later.
            </p>
            <input
              type="text"
              value={pinName}
              onChange={(e) => setPinName(e.target.value)}
              placeholder="Comparison name"
              className="w-full px-3 py-2 bg-zinc-800/50 border border-white/10 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 mb-4 transition-all"
              autoFocus
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pinName.trim()) {
                  handlePinComparison();
                } else if (e.key === 'Escape') {
                  setShowPinModal(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePinComparison}
                disabled={!pinName.trim()}
                className="px-4 py-2 text-sm bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-cyan-500/20"
              >
                Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskLayout({ children }: { children: React.ReactNode }) {
  return (
    <TaskLayoutProvider>
      <TaskLayoutInner>{children}</TaskLayoutInner>
    </TaskLayoutProvider>
  );
}
