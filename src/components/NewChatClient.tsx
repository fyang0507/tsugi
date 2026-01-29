'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConversations } from '@/hooks/useConversations';
import { Sidebar } from './Sidebar';
import { useSkills } from '@/hooks/useSkills';
import { Comparison } from './chat/ChatLayout';
import { usePinnedComparisons, PinnedComparison } from '@/hooks/usePinnedComparisons';
import { FloatingOrbs } from './landing/FloatingOrbs';
import { Logo } from './landing/Logo';

const LLM_API_KEY_STORAGE = 'tsugi_llm_api_key';

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

/**
 * NewChatClient handles the "no conversation yet" state at /task.
 * When user submits first message, it creates a conversation and navigates to /task/{id}.
 */
export default function NewChatClient() {
  const router = useRouter();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Load LLM API key from sessionStorage after hydration (avoids SSR mismatch)
  useEffect(() => {
    queueMicrotask(() => {
      const savedKey = sessionStorage.getItem(LLM_API_KEY_STORAGE);
      if (savedKey) {
        setEnvVars([{ key: 'GOOGLE_GENERATIVE_AI_API_KEY', value: savedKey }]);
      }
    });
  }, []);

  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // Smart paste handler for env vars
  const handleEnvPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n');
    const parsed: Array<{ key: string; value: string }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        parsed.push({ key: match[1].toUpperCase(), value });
      }
    }
    if (parsed.length > 1) {
      e.preventDefault();
      setEnvVars(prev => {
        const merged = new Map(prev.map(v => [v.key, v.value]));
        for (const { key, value } of parsed) {
          merged.set(key, value);
        }
        return Array.from(merged, ([key, value]) => ({ key, value }));
      });
    } else if (parsed.length === 1) {
      e.preventDefault();
      setNewEnvKey(parsed[0].key);
      setNewEnvValue(parsed[0].value);
    }
  }, []);

  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [leftConversationId, setLeftConversationId] = useState<string | null>(null);
  const [rightConversationId, setRightConversationId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<string | null>(null);
  const [leftTitle, setLeftTitle] = useState<string | null>(null);
  const [rightTitle, setRightTitle] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinName, setPinName] = useState('');

  // Pinned comparisons
  const { pinnedComparisons, pinComparison, unpinComparison, renameComparison, isPinned } = usePinnedComparisons();

  // Skills management
  const { skills, loading: skillsLoading, deleteSkill } = useSkills();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation management (CRUD only)
  const {
    groupedConversations,
    createConversation,
    deleteConversation,
    renameConversation,
  } = useConversations();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(48, Math.min(textarea.scrollHeight, 200))}px`;
    }
  }, [input]);

  // Handle creating a new chat (navigates to a fresh /task page)
  const handleNewChat = useCallback(() => {
    // Exit comparison mode if active
    if (isComparisonMode) {
      setIsComparisonMode(false);
      setLeftConversationId(null);
      setRightConversationId(null);
      setSelectedForComparison(null);
      setLeftTitle(null);
      setRightTitle(null);
    }

    // Clear input and reset state - we're already on /task
    setInput('');
    inputRef.current?.focus();
  }, [isComparisonMode]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
  }, [deleteConversation]);

  // Handle form submission - creates conversation and navigates
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isCreating) return;

    setIsCreating(true);

    try {
      // Create conversation with title from first message
      const title = input.trim().slice(0, 50) || 'New conversation';
      const conv = await createConversation(title);

      // Store the pending message in sessionStorage for the next page to pick up
      sessionStorage.setItem(`tsugi_pending_message_${conv.id}`, JSON.stringify({
        content: input.trim(),
        env: envVars.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {} as Record<string, string>),
      }));

      // Navigate to the conversation page
      router.push(`/task/${conv.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Handle viewing a skill's details
  const handleSelectSkill = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSkill(data);
      }
    } catch (error) {
      console.error('Failed to fetch skill:', error);
    }
  }, []);

  // Comparison mode handlers
  const handleAddToLeft = useCallback((id: string) => {
    setLeftConversationId(id);
    setSelectedForComparison(null);
  }, []);

  const handleAddToRight = useCallback((id: string) => {
    setRightConversationId(id);
    setSelectedForComparison(null);
  }, []);

  const handleClearLeft = useCallback(() => {
    setLeftConversationId(null);
  }, []);

  const handleClearRight = useCallback(() => {
    setRightConversationId(null);
  }, []);

  const handleToggleComparisonMode = useCallback(() => {
    setIsComparisonMode(prev => {
      if (prev) {
        setLeftConversationId(null);
        setRightConversationId(null);
        setSelectedForComparison(null);
        setLeftTitle(null);
        setRightTitle(null);
      }
      return !prev;
    });
  }, []);

  const handleTitlesAvailable = useCallback((left: string | null, right: string | null) => {
    setLeftTitle(left);
    setRightTitle(right);
  }, []);

  const handleLoadPinnedComparison = useCallback((comparison: PinnedComparison) => {
    setIsComparisonMode(true);
    setLeftConversationId(comparison.leftConversationId);
    setRightConversationId(comparison.rightConversationId);
  }, []);

  const handlePinComparison = useCallback(async () => {
    if (!leftConversationId || !rightConversationId || !leftTitle || !rightTitle) return;
    const id = await pinComparison(pinName, leftConversationId, rightConversationId, leftTitle, rightTitle);
    if (id) {
      setShowPinModal(false);
      setPinName('');
    }
  }, [leftConversationId, rightConversationId, leftTitle, rightTitle, pinName, pinComparison]);

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
  }, [leftTitle, rightTitle]);

  return (
    <div className="flex h-screen text-zinc-100 overflow-hidden relative">
      {/* Background Layer - Floating Orbs */}
      <FloatingOrbs />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={groupedConversations}
        currentId={null}
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
                  onClick={handleToggleComparisonMode}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    !isComparisonMode
                      ? 'bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-cyan-100 border border-cyan-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Task
                </button>
                <button
                  onClick={handleToggleComparisonMode}
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

        {/* Conditional content: Comparison mode or Normal mode */}
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
          <>
            {/* Messages area - Empty state */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
              <div className="w-full max-w-4xl mx-auto px-6 py-6 flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-cyan-400"
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
                  <h2 className="text-2xl font-bold mb-3">
                    <span className="text-gradient">Describe any task</span>
                  </h2>
                  <p className="text-zinc-400 max-w-md">
                    I&apos;ll figure it out once, then remember how forever.
                  </p>
                </div>
              </div>
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 px-6 py-4 relative z-10">
              {/* API Keys Panel */}
              <div className="w-full max-w-4xl mx-auto mb-3">
                <button
                  type="button"
                  onClick={() => setEnvPanelOpen(!envPanelOpen)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${envPanelOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  API Keys
                  {envVars.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-zinc-700 rounded">
                      {envVars.length}
                    </span>
                  )}
                </button>

                {envPanelOpen && (
                  <div className="mt-3 p-4 bg-zinc-900/60 border border-white/10 backdrop-blur-md rounded-xl">
                    <p className="text-xs text-zinc-500 mb-3">
                      Override or add environment variables for sandbox execution
                    </p>

                    {/* Saved variables */}
                    {envVars.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {envVars.map((envVar, index) => (
                          <div key={index} className="flex gap-2 items-center bg-zinc-800/50 px-3 py-2 rounded-lg">
                            <span className="font-mono text-sm text-zinc-300">{envVar.key}</span>
                            <span className="text-zinc-500">=</span>
                            <span className="font-mono text-sm text-zinc-400 flex-1">••••••••</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newVars = envVars.filter((_, i) => i !== index);
                                setEnvVars(newVars);
                              }}
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new variable form */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        onPaste={handleEnvPaste}
                        placeholder="KEY"
                        className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
                      />
                      <input
                        type="password"
                        value={newEnvValue}
                        onChange={(e) => setNewEnvValue(e.target.value)}
                        onPaste={handleEnvPaste}
                        placeholder="value"
                        className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newEnvKey.trim() && newEnvValue.trim()) {
                            const key = newEnvKey.trim();
                            const value = newEnvValue;
                            setEnvVars(prev => {
                              const exists = prev.some(v => v.key === key);
                              if (exists) {
                                return prev.map(v => v.key === key ? { key, value } : v);
                              }
                              return [...prev, { key, value }];
                            });
                            setNewEnvKey('');
                            setNewEnvValue('');
                          }
                        }}
                        disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                        className="px-3 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-200 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything..."
                      rows={1}
                      className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none overflow-y-auto transition-all"
                      style={{
                        minHeight: '48px',
                        maxHeight: '200px',
                      }}
                      disabled={isCreating}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!input.trim() || isCreating}
                    className={`relative px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 overflow-hidden ${
                      input.trim() && !isCreating
                        ? 'shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)] hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-zinc-800 cursor-not-allowed'
                    }`}
                  >
                    {input.trim() && !isCreating && (
                      <>
                        {/* Aurora gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 bg-[length:200%_auto] animate-aurora" />
                        {/* Glass sheen */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                      </>
                    )}
                    <span className={`relative z-10 flex items-center gap-2 ${input.trim() && !isCreating ? 'text-white drop-shadow-sm' : 'text-zinc-500'}`}>
                      {isCreating ? (
                        <>
                          <svg
                            className="w-4 h-4 animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Creating...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                          Send
                        </>
                      )}
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500 text-center">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </form>
            </div>
          </>
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
