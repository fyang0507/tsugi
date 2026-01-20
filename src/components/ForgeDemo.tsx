'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForgeChat, Message } from '@/hooks/useForgeChat';
import { useConversations } from '@/hooks/useConversations';
import ChatMessage, { SkillSuggestion } from './ChatMessage';
import { CumulativeStatsBar } from './CumulativeStats';
import { Sidebar } from './Sidebar';
import { SandboxTimeoutBanner } from './SandboxTimeoutBanner';
import { useSkills } from '@/hooks/useSkills';
import { DemoLayout } from './demo/DemoLayout';

const EXAMPLE_PROMPTS = [
  'What skills do I have?',
  'Learn from this video: https://youtube.com/watch?v=...',
  'Search for skills about React hooks',
];

const LLM_API_KEY_STORAGE = 'skillforge_llm_api_key';

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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
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
        <div className="px-6 py-3 border-t border-zinc-700 text-xs text-zinc-500">
          Last updated: {new Date(skill.updatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function ForgeDemo() {
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codifyingMessageId, setCodifyingMessageId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() => {
    // Load LLM API key from sessionStorage on initial render (set during onboarding, clears on tab close)
    if (typeof window !== 'undefined') {
      const savedKey = sessionStorage.getItem(LLM_API_KEY_STORAGE);
      if (savedKey) {
        return [{ key: 'GOOGLE_GENERATIVE_AI_API_KEY', value: savedKey }];
      }
    }
    return [];
  });
  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [leftConversationId, setLeftConversationId] = useState<string | null>(null);
  const [rightConversationId, setRightConversationId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<string | null>(null);

  // Skills management
  const { skills, loading: skillsLoading, deleteSkill } = useSkills();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Conversation management
  const {
    conversations,
    groupedConversations,
    currentId,
    setCurrentId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    updateMode,
    saveMessage,
  } = useConversations();

  // Track current agent mode for the conversation
  const [currentMode, setCurrentMode] = useState<'task' | 'codify-skill'>('task');

  // Messages for current conversation (loaded from DB or empty for new)
  const [loadedMessages, setLoadedMessages] = useState<Message[]>([]);
  const messageCountRef = useRef(0);

  // Use ref to track currentId for callbacks (avoids stale closure issues)
  const currentIdRef = useRef<string | null>(currentId);
  // Track if we're programmatically switching (to avoid URL sync loop)
  const isSwitchingRef = useRef(false);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  // Memoize the options to prevent infinite re-renders
  const forgeChatOptions = useMemo(() => ({
    initialMessages: loadedMessages,
    onMessageComplete: async (message: Message, index: number) => {
      const convId = currentIdRef.current;
      if (!convId) return;
      // Skip messages that were already loaded from DB
      if (index < messageCountRef.current) return;
      await saveMessage(convId, message, index);
      // Auto-title on first user message (only for new conversations)
      if (messageCountRef.current === 0 && index === 0 && message.role === 'user') {
        const title = message.rawContent.slice(0, 50) || 'New conversation';
        await renameConversation(convId, title);
      }
    },
  }), [loadedMessages, saveMessage, renameConversation]);

  const { messages, status, error, cumulativeStats, sendMessage, clearMessages, stop, sandboxTimeoutMessage, clearSandboxTimeout } = useForgeChat(forgeChatOptions);

  const isStreaming = status === 'streaming';

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = '48px'; // Reset to min height
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback(async (id: string) => {
    // Skip if already on this conversation
    if (id === currentIdRef.current) return;

    isSwitchingRef.current = true;
    const result = await switchConversation(id);
    if (result) {
      setLoadedMessages(result.messages);
      messageCountRef.current = result.messages.length;
      currentIdRef.current = id;
      setCurrentId(id);
      setCurrentMode(result.conversation.mode || 'task');
      router.push(`/task?id=${id}`, { scroll: false });
    }
    isSwitchingRef.current = false;
  }, [switchConversation, setCurrentId, router]);

  // Handle creating a new chat (at most one "New conversation" allowed)
  // excludeId: skip this ID when checking for existing "New conversation" (used after delete)
  const handleNewChat = useCallback(async (excludeId?: string) => {
    // Check if an existing "New conversation" already exists (excluding just-deleted one)
    const existingNew = conversations.find(c => c.title === 'New conversation' && c.id !== excludeId);
    if (existingNew && existingNew.id !== currentIdRef.current) {
      // Switch to existing empty conversation instead of creating another
      await handleSelectConversation(existingNew.id);
      return;
    }

    // If already on the "New conversation", just clear and focus
    if (existingNew && existingNew.id === currentIdRef.current) {
      setLoadedMessages([]);
      messageCountRef.current = 0;
      clearMessages();
      setCurrentMode('task');
      inputRef.current?.focus();
      return;
    }

    // Create new conversation
    isSwitchingRef.current = true;
    const conv = await createConversation('New conversation');
    setLoadedMessages([]);
    messageCountRef.current = 0;
    clearMessages();
    currentIdRef.current = conv.id;
    setCurrentId(conv.id);
    setCurrentMode('task');
    router.push(`/task?id=${conv.id}`, { scroll: false });
    inputRef.current?.focus();
    isSwitchingRef.current = false;
  }, [conversations, createConversation, clearMessages, setCurrentId, router, handleSelectConversation]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    const deletedConv = conversations.find(c => c.id === id);
    const wasNewConversation = deletedConv?.title === 'New conversation';

    await deleteConversation(id);

    // If we deleted the current conversation, need to navigate somewhere
    if (id === currentId) {
      currentIdRef.current = null;

      // Find another conversation to switch to (excluding the deleted one)
      const otherConv = conversations.find(c => c.id !== id);

      if (otherConv) {
        // Switch to another existing conversation
        await handleSelectConversation(otherConv.id);
      } else if (!wasNewConversation) {
        // No other conversations exist and we deleted a real conversation - create new
        handleNewChat(id);
      }
      // If we deleted a "New conversation" and no others exist, just clear the URL
      // The user can click "New chat" when ready
      else {
        setLoadedMessages([]);
        messageCountRef.current = 0;
        clearMessages();
        setCurrentId(null);
        setCurrentMode('task');
        router.push('/task', { scroll: false });
      }
    }
  }, [conversations, deleteConversation, currentId, handleNewChat, handleSelectConversation, clearMessages, setCurrentId, router]);

  // Initialize from URL on mount or browser navigation
  // This syncs React state with the browser URL (an external system),
  // which is a valid use case for setState in effects
  useEffect(() => {
    // Skip if we're in the middle of a programmatic switch
    if (isSwitchingRef.current) return;

    const id = searchParams.get('id');
    if (id && id !== currentIdRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSelectConversation(id);
    }
  }, [searchParams, handleSelectConversation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    // Create conversation if none exists
    if (!currentId) {
      const conv = await createConversation('New conversation');
      currentIdRef.current = conv.id; // Update ref immediately for callbacks
      setCurrentId(conv.id);
      router.push(`/task?id=${conv.id}`, { scroll: false });
    }

    const message = input;
    setInput('');

    // Convert envVars array to Record for API
    const envRecord = envVars.reduce((acc, { key, value }) => {
      if (key.trim()) {
        acc[key.trim()] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    // Pass conversation ID for tracing (codify-skill mode also uses it to fetch transcript from DB)
    await sendMessage(
      message,
      currentMode,
      currentId || undefined,
      Object.keys(envRecord).length > 0 ? envRecord : undefined
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  // Handle skill codification request
  const handleCodifySkill = useCallback(async (messageId: string, suggestion: SkillSuggestion) => {
    if (isStreaming || codifyingMessageId) return;

    setCodifyingMessageId(messageId);

    // Set mode to codify-skill and persist to DB
    setCurrentMode('codify-skill');
    if (currentId) {
      await updateMode(currentId, 'codify-skill');
    }

    // Send a message to trigger skill codification agent
    // Pass conversationId - the tool will fetch the transcript from DB
    const codifyPrompt = `Codify the skill "${suggestion.name}" based on the conversation above.`;
    await sendMessage(codifyPrompt, 'codify-skill', currentId || undefined);

    setCodifyingMessageId(null);
  }, [isStreaming, codifyingMessageId, sendMessage, currentId, updateMode]);

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
        // Exiting comparison mode - clear selections
        setLeftConversationId(null);
        setRightConversationId(null);
        setSelectedForComparison(null);
      }
      return !prev;
    });
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sandbox timeout notification */}
      {sandboxTimeoutMessage && (
        <SandboxTimeoutBanner
          message={sandboxTimeoutMessage}
          onDismiss={clearSandboxTimeout}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={groupedConversations}
        currentId={currentId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        onRename={renameConversation}
        skills={skills}
        skillsLoading={skillsLoading}
        onDeleteSkill={deleteSkill}
        onSelectSkill={handleSelectSkill}
        isComparisonMode={isComparisonMode}
        selectedForComparison={selectedForComparison}
        onSelectForComparison={setSelectedForComparison}
        onAddToLeft={handleAddToLeft}
        onAddToRight={handleAddToRight}
      />

      {/* Main content */}
      <div className={`flex flex-col flex-1 transition-all duration-200 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
          <div className={`${isComparisonMode ? '' : 'max-w-4xl'} mx-auto flex items-center justify-between`}>
            <div className={`transition-all ${sidebarOpen ? '' : 'ml-12'}`}>
              <h1 className="text-xl font-bold">SkillForge</h1>
              <p className="text-sm text-zinc-400">
                Learn from YouTube tutorials and create reusable skills
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Mode toggle */}
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                <button
                  onClick={handleToggleComparisonMode}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    !isComparisonMode
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={handleToggleComparisonMode}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isComparisonMode
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  data-testid="comparison-toggle"
                >
                  Comparison
                </button>
              </div>

              {/* New chat button */}
              {!isComparisonMode && messages.length > 0 && (
                <button
                  onClick={() => handleNewChat()}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  New chat
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Conditional content: Comparison mode or Normal mode */}
        {isComparisonMode ? (
          <DemoLayout
            leftConversationId={leftConversationId}
            rightConversationId={rightConversationId}
            onDropLeft={handleAddToLeft}
            onDropRight={handleAddToRight}
            onClearLeft={handleClearLeft}
            onClearRight={handleClearRight}
            skills={skills}
            skillsLoading={skillsLoading}
            onSelectSkill={handleSelectSkill}
          />
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 py-6">
                {/* Error banner */}
                {error && (
                  <div className="mb-4 p-4 bg-red-900/60 border border-red-700 rounded-lg flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-red-200 font-medium">Error</p>
                      <p className="text-red-300 text-sm mt-1">{error}</p>
                    </div>
                  </div>
                )}
                {messages.length === 0 ? (
                  // Empty state
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                    <div className="w-16 h-16 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-zinc-400"
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
                    <h2 className="text-lg font-medium mb-2">How can I help you?</h2>
                    <p className="text-zinc-400 mb-6 max-w-md">
                      Ask me to learn from a YouTube tutorial, search existing skills,
                      or help with a topic.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {EXAMPLE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleExampleClick(prompt)}
                          className="px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Messages list
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        onCodifySkill={(suggestion) => handleCodifySkill(message.id, suggestion)}
                        isCodifying={codifyingMessageId === message.id}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Cumulative stats footer */}
            <CumulativeStatsBar stats={cumulativeStats} />

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-zinc-800 px-6 py-4">
          {/* API Keys Panel */}
          <div className="max-w-4xl mx-auto mb-3">
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
              <div className="mt-3 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
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
                    placeholder="KEY"
                    className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                  <input
                    type="password"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newEnvKey.trim() && newEnvValue.trim()) {
                        setEnvVars([...envVars, { key: newEnvKey.trim(), value: newEnvValue }]);
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

          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to learn from a YouTube video or search skills..."
                  rows={1}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none overflow-y-auto"
                  style={{
                    minHeight: '48px',
                    maxHeight: '200px',
                  }}
                  disabled={isStreaming}
                />
              </div>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center gap-2"
                >
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
                </button>
              )}
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
    </div>
  );
}
