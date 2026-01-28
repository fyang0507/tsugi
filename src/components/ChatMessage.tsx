'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@/hooks/useTsugiChat';
import { MessageStats } from './MessageStats';

export interface SkillSuggestion {
  status: 'success' | 'guidance';
  learned: string;
  name?: string;           // For status: 'success'
  suggestedName?: string;  // For status: 'guidance'
  similarSkills?: string[];
  message?: string;
}

interface ChatMessageProps {
  message: Message;
  onCodifySkill?: (suggestion: SkillSuggestion) => void;
  isCodifying?: boolean;
}

/**
 * AI SDK tool part type - tools have type 'tool-{toolName}'
 */
interface AIToolPart {
  type: string;  // 'tool-shell', 'tool-search', etc.
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

/**
 * Get display name for tool.
 */
function getToolDisplayName(toolName: string): string {
  switch (toolName) {
    case 'search':
      return 'Search';
    case 'analyze_url':
      return 'Analyze URL';
    case 'shell':
      return 'Shell';
    default:
      if (toolName.includes('get_processed_transcript')) {
        return 'Task Summary';
      }
      return toolName || 'Tool';
  }
}

/**
 * Extract tool name from AI SDK part type (e.g., 'tool-shell' -> 'shell')
 */
function getToolNameFromPartType(partType: string): string {
  if (partType.startsWith('tool-')) {
    return partType.slice(5);  // Remove 'tool-' prefix
  }
  return partType;
}

// Parse skill suggestion from tool result (skill suggest command)
function parseToolSkillSuggestion(parts: readonly { type: string; [key: string]: unknown }[]): SkillSuggestion | null {
  for (const part of parts) {
    // Check AI SDK tool parts (shell tool with skill suggest command)
    if (part.type.startsWith('tool-')) {
      const toolPart = part as unknown as AIToolPart;
      const toolName = getToolNameFromPartType(toolPart.type);
      if (toolName === 'shell' &&
          toolPart.state === 'output-available' &&
          (toolPart.input?.command as string)?.startsWith('skill suggest')) {
        try {
          const resultStr = typeof toolPart.output === 'string' ? toolPart.output : JSON.stringify(toolPart.output);
          const result = JSON.parse(resultStr);
          if (result.type === 'skill-suggestion') {
            return {
              status: result.status,
              learned: result.learned,
              name: result.name,
              suggestedName: result.suggestedName,
              similarSkills: result.similarSkills,
              message: result.message,
            };
          }
        } catch {
          // Not valid JSON or not a skill suggestion
        }
      }
    }
  }
  return null;
}

// Detect skill set command results
function parseSkillCreation(parts: readonly { type: string; [key: string]: unknown }[]): string | null {
  for (const part of parts) {
    // Check AI SDK tool parts (shell tool with skill set command)
    if (part.type.startsWith('tool-')) {
      const toolPart = part as unknown as AIToolPart;
      const toolName = getToolNameFromPartType(toolPart.type);
      if (toolName === 'shell' && toolPart.state === 'output-available') {
        const command = toolPart.input?.command as string | undefined;

        if (command?.startsWith('skill set ')) {
          // Extract skill name from result: 'Skill "name" saved'
          const resultStr = typeof toolPart.output === 'string' ? toolPart.output : '';
          const match = resultStr.match(/Skill "([^"]+)" saved/);
          if (match) {
            return match[1];
          }
        }
      }
    }
  }
  return null;
}

// Chevron icon component
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// Skill artifact component for inline display
interface SkillArtifactProps {
  skillName: string;
}

function SkillArtifact({ skillName }: SkillArtifactProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!expanded && !content) {
      // Fetch skill content on first expand
      setLoading(true);
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}`);
        if (res.ok) {
          const skill = await res.json();
          setContent(skill.content);
        }
      } catch (e) {
        console.error('Failed to fetch skill:', e);
      }
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  return (
    <div className="my-2 border border-teal-500/30 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 transition-colors text-left"
      >
        <ChevronIcon expanded={expanded} />
        <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-teal-400 font-medium">Skill Created</span>
        <code className="text-sm text-zinc-400 bg-zinc-700 px-1.5 rounded">{skillName}</code>
      </button>
      {expanded && (
        <div className="px-3 py-2 max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="text-zinc-500 text-sm">Loading...</div>
          ) : content ? (
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{content}</pre>
          ) : (
            <div className="text-zinc-500 text-sm">Failed to load skill content</div>
          )}
        </div>
      )}
    </div>
  );
}

// Render reasoning/thinking traces (collapsible)
function ReasoningPartView({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning.trim()) return null;

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <span className="italic">Thinking...</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-5 text-sm text-zinc-400 whitespace-pre-wrap border-l-2 border-zinc-700 pl-3">
          {reasoning}
        </div>
      )}
    </div>
  );
}

// Search icon for web search tool
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

// Globe/link icon for URL analysis tool
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

// Terminal icon for shell commands
function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// Document icon for transcript processing
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

// Loading spinner component
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// Render AI SDK tool part (search, analyze_url, shell, get_processed_transcript) - collapsible
function ToolPartView({ part }: { part: AIToolPart }) {
  const [expanded, setExpanded] = useState(false);

  const toolName = getToolNameFromPartType(part.type);
  const isSearch = toolName === 'search';
  const isAnalyzeUrl = toolName === 'analyze_url';
  const isTranscript = toolName.includes('get_processed_transcript');
  const isShellCommand = toolName === 'shell';
  const isGroundingTool = isSearch || isAnalyzeUrl;
  const toolDisplayName = getToolDisplayName(toolName);

  // Extract search query, URL, or command from input
  const input = part.input || {};
  const toolDetail = input.query || input.url || input.command || '';

  // AI SDK tool states
  const isLoading = part.state === 'input-streaming' || part.state === 'input-available';
  const hasError = part.state === 'output-error';
  const result = part.output;
  const resultContent = hasError
    ? part.errorText || 'Error'
    : typeof result === 'string' ? result : (result ? JSON.stringify(result, null, 2) : '');

  // Color coding based on tool type
  const getToolStyles = () => {
    if (hasError) return { borderColor: 'border-red-500/30', bgColor: 'bg-red-500/5', iconColor: 'text-red-400' };
    if (isSearch) return { borderColor: 'border-cyan-500/30', bgColor: 'bg-cyan-500/5', iconColor: 'text-cyan-400' };
    if (isAnalyzeUrl) return { borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/5', iconColor: 'text-purple-400' };
    if (isTranscript) return { borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5', iconColor: 'text-amber-400' };
    if (isShellCommand) return { borderColor: 'border-green-500/30', bgColor: 'bg-green-500/5', iconColor: 'text-green-400' };
    return { borderColor: 'border-zinc-700', bgColor: 'bg-zinc-800/50', iconColor: 'text-zinc-400' };
  };

  const { borderColor, bgColor, iconColor } = getToolStyles();

  const loadingText = isTranscript ? 'processing...' : isShellCommand ? 'running...' : isAnalyzeUrl ? 'analyzing...' : 'searching...';

  // For shell commands, truncate long commands
  const shellCommand = isShellCommand ? String(input.command || '') : '';
  const truncatedCommand = shellCommand.length > 60
    ? shellCommand.slice(0, 60) + '...'
    : shellCommand;

  // Get tool icon
  const ToolIcon = isSearch ? SearchIcon : isAnalyzeUrl ? GlobeIcon : isTranscript ? DocumentIcon : TerminalIcon;

  // Render grounding tools (search, analyze_url) with enhanced UI
  if (isGroundingTool) {
    return (
      <div className={`my-2 w-full min-w-0 overflow-hidden border ${borderColor} rounded-lg ${bgColor}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm w-full min-w-0 text-left p-2.5 hover:bg-white/5 transition-colors"
        >
          {isLoading ? (
            <LoadingSpinner className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
          ) : (
            <ToolIcon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
          )}
          <div className="flex flex-col flex-1 min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${iconColor}`}>{toolDisplayName}</span>
              {isLoading && <span className="text-zinc-500 text-xs italic">{loadingText}</span>}
              {hasError && <span className="text-red-400 text-xs italic">error</span>}
              {!isLoading && !hasError && <span className="text-zinc-500 text-xs">done</span>}
            </div>
            {toolDetail && (
              <span className="text-zinc-400 text-xs truncate">{String(toolDetail)}</span>
            )}
          </div>
          <ChevronIcon expanded={expanded} />
        </button>
        {expanded && (
          <div className={`px-2.5 pb-2.5 text-xs ${isTranscript ? 'max-h-[400px]' : 'max-h-[300px]'} overflow-y-auto`}>
            {resultContent ? (
              <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {resultContent}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="text-zinc-500">{isLoading ? 'Fetching results...' : 'No output'}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Original rendering for shell and transcript tools
  return (
    <div className="my-2 w-full min-w-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors w-full min-w-0 text-left overflow-hidden"
      >
        <ChevronIcon expanded={expanded} />
        {isLoading ? (
          <LoadingSpinner className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
        ) : (
          <ToolIcon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
        )}
        {isShellCommand ? (
          <span className="font-mono text-zinc-400 truncate flex-1 min-w-0">
            $ {truncatedCommand}
          </span>
        ) : (
          <>
            <span className="font-medium flex-shrink-0">{toolDisplayName}</span>
            {toolDetail && (
              <span className="text-zinc-500 truncate flex-1 min-w-0">{String(toolDetail)}</span>
            )}
          </>
        )}
        {isLoading && <span className="text-zinc-500 italic flex-shrink-0">{loadingText}</span>}
        {hasError && <span className="text-red-400 italic flex-shrink-0">error</span>}
      </button>
      {expanded && (
        <div className={`mt-1 ml-5 text-xs rounded p-2 ${isTranscript ? 'max-h-[400px]' : 'max-h-[200px]'} overflow-y-auto`}>
          {isTranscript && resultContent ? (
            <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {resultContent}
              </ReactMarkdown>
            </div>
          ) : resultContent ? (
            <pre className={`whitespace-pre-wrap break-all ${hasError ? 'text-red-400' : 'text-zinc-500'}`}>{resultContent}</pre>
          ) : (
            <span className="text-zinc-500">{isLoading ? 'Running...' : 'No output'}</span>
          )}
        </div>
      )}
    </div>
  );
}

// COMPLETE status badge
function CompleteBadge(): React.ReactNode {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 rounded-full text-sm font-medium">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>COMPLETE</span>
    </div>
  );
}

// Shared markdown components configuration
const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 hover:text-cyan-300 underline break-all"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-zinc-800 px-1 py-0.5 rounded text-sm break-all" {...props}>
        {children}
      </code>
    ) : (
      <code className={`${className} break-all`} {...props}>
        {children}
      </code>
    );
  },
};

// Reusable markdown renderer with prose styling
function MarkdownContent({ children }: { children: string }): React.ReactNode {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Render a text part with markdown
function TextPartView({ content }: { content: string }): React.ReactNode {
  if (!content.trim()) return null;

  const trimmed = content.trim();

  // Exact match: just "COMPLETE"
  if (trimmed === 'COMPLETE') {
    return <CompleteBadge />;
  }

  // Check if ends with COMPLETE (on own line or at end of text)
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1].trim();

  // Case 1: COMPLETE on its own final line
  if (lastLine === 'COMPLETE' && lines.length > 1) {
    const textWithoutComplete = lines.slice(0, -1).join('\n').trim();
    return (
      <>
        {textWithoutComplete && <MarkdownContent>{textWithoutComplete}</MarkdownContent>}
        <div className="mt-3"><CompleteBadge /></div>
      </>
    );
  }

  // Case 2: Text ending with ". COMPLETE" or similar on same line
  if (lastLine.endsWith('. COMPLETE') || lastLine.endsWith('! COMPLETE') || lastLine.endsWith('? COMPLETE')) {
    const textWithoutComplete = trimmed.slice(0, -' COMPLETE'.length);
    return (
      <>
        <MarkdownContent>{textWithoutComplete}</MarkdownContent>
        <div className="mt-3"><CompleteBadge /></div>
      </>
    );
  }

  return <MarkdownContent>{content}</MarkdownContent>;
}

export default function ChatMessage({ message, onCodifySkill, isCodifying }: ChatMessageProps) {
  // User message - extract text from first text part
  if (message.role === 'user') {
    const firstPart = message.parts?.[0];
    const textContent = firstPart && firstPart.type === 'text'
      ? (firstPart as unknown as { type: 'text'; text: string }).text
      : '';
    return (
      <div className="flex justify-end w-full min-w-0 max-w-full">
        <div className="max-w-[80%] min-w-0 px-4 py-3 chat-bubble-user text-zinc-100 rounded-2xl rounded-br-md overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          <p className="whitespace-pre-wrap break-words">{textContent}</p>
        </div>
      </div>
    );
  }

  // Assistant message - render parts inline
  const parts = message.parts || [];
  const hasParts = parts.length > 0;

  // Check for skill suggestion in tool results (from skill suggest command)
  const skillSuggestion = parseToolSkillSuggestion(parts);

  // Check for skill creation in tool results (from skill set command)
  const createdSkillName = parseSkillCreation(parts);

  // Get stats from message - check data-usage part first (live), then metadata (persisted from DB)
  const stats = (() => {
    // First check for data-usage part in message parts (from live stream)
    const usagePart = parts.find((p) => p.type === 'data-usage');
    if (usagePart && 'data' in usagePart) {
      const data = usagePart.data as { usage: { promptTokens?: number; completionTokens?: number; cachedContentTokenCount?: number; reasoningTokens?: number } | null; executionTimeMs: number };
      const { usage, executionTimeMs } = data;
      return {
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        cachedTokens: usage?.cachedContentTokenCount,
        reasoningTokens: usage?.reasoningTokens,
        executionTimeMs,
        tokensUnavailable: usage === null,
      };
    }
    // Fall back to metadata (loaded from DB)
    return message.metadata?.stats;
  })();

  return (
    <div className="flex justify-start w-full min-w-0">
      <div className="max-w-[90%] min-w-0 px-4 py-3 chat-bubble-assistant text-zinc-100 rounded-2xl rounded-bl-md overflow-hidden">
        {hasParts ? (
          <>
            {parts.map((part, index) => {
              // AI SDK reasoning part - uses .reasoning property (but may be typed differently)
              if (part.type === 'reasoning') {
                const reasoningPart = part as unknown as { type: 'reasoning'; reasoning?: string; text?: string };
                const reasoning = reasoningPart.reasoning || reasoningPart.text || '';
                return <ReasoningPartView key={index} reasoning={reasoning} />;
              }
              // AI SDK tool part - type starts with 'tool-'
              if (part.type.startsWith('tool-')) {
                return <ToolPartView key={index} part={part as unknown as AIToolPart} />;
              }
              // AI SDK text part - uses .text property
              if (part.type === 'text') {
                const textPart = part as unknown as { type: 'text'; text: string };
                return <TextPartView key={index} content={textPart.text || ''} />;
              }
              // Skip data parts (sandbox, usage) - they're handled elsewhere
              if (part.type.startsWith('data-')) {
                return null;
              }
              // Fallback for unknown part types
              return null;
            })}
            <MessageStats stats={stats} />
            {createdSkillName && <SkillArtifact skillName={createdSkillName} />}
            {skillSuggestion && skillSuggestion.status === 'success' && onCodifySkill && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => onCodifySkill(skillSuggestion)}
                  disabled={isCodifying}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-xl transition-all disabled:bg-zinc-600 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20"
                >
                  {isCodifying ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Codifying...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Codify as Skill</span>
                    </>
                  )}
                </button>
                <p className="mt-1 text-xs text-zinc-500">
                  <code className="bg-zinc-700 px-1 rounded">{skillSuggestion.name}</code>: {skillSuggestion.learned}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-zinc-500 text-sm">Thinking...</div>
        )}
      </div>
    </div>
  );
}
