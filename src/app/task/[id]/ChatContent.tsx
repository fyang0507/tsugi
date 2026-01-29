'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTsugiChat, Message } from '@/hooks/useTsugiChat';
import { useTaskLayout } from '../TaskLayoutContext';
import ChatMessage, { SkillSuggestion } from '@/components/ChatMessage';
import { CumulativeStatsBar } from '@/components/CumulativeStats';
import { SandboxTimeoutBanner } from '@/components/SandboxTimeoutBanner';

const LLM_API_KEY_STORAGE = 'tsugi_llm_api_key';

interface ChatContentProps {
  conversationId: string;
  initialMessages: Message[];
  initialMode: 'task' | 'codify-skill';
}

/**
 * ChatContent renders the messages and input for an existing conversation.
 * Layout elements (sidebar, header, modals) are handled by the parent layout.
 */
export default function ChatContent({
  conversationId,
  initialMessages,
  initialMode,
}: ChatContentProps) {
  const {
    saveMessage,
    renameConversation,
    updateMode,
    isComparisonMode,
  } = useTaskLayout();

  const [input, setInput] = useState('');
  const [codifyingMessageId, setCodifyingMessageId] = useState<string | null>(null);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [currentMode, setCurrentMode] = useState<'task' | 'codify-skill'>(initialMode);
  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load LLM API key from sessionStorage after hydration
  useEffect(() => {
    queueMicrotask(() => {
      const savedKey = sessionStorage.getItem(LLM_API_KEY_STORAGE);
      if (savedKey) {
        setEnvVars([{ key: 'GOOGLE_GENERATIVE_AI_API_KEY', value: savedKey }]);
      }
    });
  }, []);

  // Track initial message count to avoid re-saving loaded messages
  const initialMessageCount = useMemo(() => initialMessages.length, [initialMessages]);

  // useTsugiChat hook configuration
  const tsugiChatOptions = useMemo(() => ({
    conversationId,
    initialMessages,
    onMessageComplete: async (message: Message, index: number) => {
      if (index < initialMessageCount) return;
      await saveMessage(conversationId, message, index);
      // Auto-title on first user message
      if (initialMessageCount === 0 && index === 0 && message.role === 'user') {
        const textPart = message.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
        const textContent = textPart?.text || '';
        const title = textContent.slice(0, 50) || 'New conversation';
        await renameConversation(conversationId, title);
      }
    },
  }), [conversationId, initialMessages, initialMessageCount, saveMessage, renameConversation]);

  const {
    messages,
    status,
    error,
    cumulativeStats,
    sendMessage,
    stop,
    sandboxTimeoutMessage,
    clearSandboxTimeout,
    sandboxStatus,
    toolProgress,
  } = useTsugiChat(tsugiChatOptions);

  const isStreaming = status === 'streaming';

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= threshold;
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle pending message from NewChatContent
  // This syncs state from sessionStorage (an external system), which is valid for effects
  const hasSentPendingMessage = useRef(false);
  useEffect(() => {
    if (hasSentPendingMessage.current) return;

    const storageKey = `tsugi_pending_message_${conversationId}`;
    const pendingData = sessionStorage.getItem(storageKey);

    if (pendingData) {
      hasSentPendingMessage.current = true;
      sessionStorage.removeItem(storageKey);

      try {
        const { content, env } = JSON.parse(pendingData);
        if (env && Object.keys(env).length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from external storage
          setEnvVars(Object.entries(env).map(([key, value]) => ({ key, value: value as string })));
        }
        requestAnimationFrame(() => {
          sendMessage(content, 'task', conversationId, env);
        });
      } catch (e) {
        console.error('Failed to parse pending message:', e);
      }
    }
  }, [conversationId, sendMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(48, Math.min(textarea.scrollHeight, 200))}px`;
    }
  }, [input]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input;
    setInput('');

    const envRecord = envVars.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

    await sendMessage(
      message,
      currentMode,
      conversationId,
      Object.keys(envRecord).length > 0 ? envRecord : undefined
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Handle skill codification
  const handleCodifySkill = useCallback(async (messageId: string, suggestion: SkillSuggestion) => {
    if (isStreaming || codifyingMessageId) return;

    setCodifyingMessageId(messageId);
    setCurrentMode('codify-skill');
    await updateMode(conversationId, 'codify-skill');

    const codifyPrompt = `Codify the skill "${suggestion.name}" based on the conversation above.`;
    await sendMessage(codifyPrompt, 'codify-skill', conversationId);

    setCodifyingMessageId(null);
  }, [isStreaming, codifyingMessageId, sendMessage, conversationId, updateMode]);

  // Don't render content when in comparison mode
  if (isComparisonMode) {
    return null;
  }

  return (
    <>
      {/* Sandbox timeout notification */}
      {sandboxTimeoutMessage && (
        <SandboxTimeoutBanner
          message={sandboxTimeoutMessage}
          onDismiss={clearSandboxTimeout}
        />
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col"
      >
        <div className={`w-full max-w-4xl mx-auto px-6 py-6 ${messages.length === 0 ? 'flex-1 flex flex-col' : ''}`}>
          {/* Error banner */}
          {error && (
            <div className="mb-4 p-4 glass-panel bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3">
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
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">
                <span className="text-gradient">Describe any task</span>
              </h2>
              <p className="text-zinc-400 max-w-md">
                I&apos;ll figure it out once, then remember how forever.
              </p>
            </div>
          ) : (
            // Messages list
            <div className="space-y-4">
              {messages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCodifySkill={(suggestion) => handleCodifySkill(message.id, suggestion)}
                  isCodifying={codifyingMessageId === message.id}
                  toolProgress={idx === messages.length - 1 ? toolProgress : undefined}
                  isStreaming={isStreaming && idx === messages.length - 1 && message.role === 'assistant'}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Cumulative stats footer */}
      <CumulativeStatsBar stats={cumulativeStats} sandboxStatus={sandboxStatus} />

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

              {envVars.length > 0 && (
                <div className="space-y-2 mb-3">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2 items-center bg-zinc-800/50 px-3 py-2 rounded-lg">
                      <span className="font-mono text-sm text-zinc-300">{envVar.key}</span>
                      <span className="text-zinc-500">=</span>
                      <span className="font-mono text-sm text-zinc-400 flex-1">••••••••</span>
                      <button
                        type="button"
                        onClick={() => setEnvVars(envVars.filter((_, i) => i !== index))}
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
                style={{ minHeight: '48px', maxHeight: '200px' }}
                disabled={isStreaming}
              />
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`relative px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 overflow-hidden ${
                  input.trim()
                    ? 'shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)] hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-zinc-800 cursor-not-allowed'
                }`}
              >
                {input.trim() && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 bg-[length:200%_auto] animate-aurora" />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                  </>
                )}
                <span className={`relative z-10 flex items-center gap-2 ${input.trim() ? 'text-white drop-shadow-sm' : 'text-zinc-500'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </span>
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </>
  );
}
