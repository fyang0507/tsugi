'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessagePart } from '@/hooks/useTsugiChat';
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

// Parse skill suggestion from tool result (skill suggest command)
function parseToolSkillSuggestion(parts: MessagePart[]): SkillSuggestion | null {
  for (const part of parts) {
    // Check legacy 'tool' type parts
    const isLegacySkillSuggest = part.type === 'tool' && part.command?.startsWith('skill suggest');
    // Check new 'agent-tool' type parts (AI SDK shell tool)
    const isAgentSkillSuggest = part.type === 'agent-tool' &&
      part.toolName === 'shell' &&
      (part.toolArgs?.command as string)?.startsWith('skill suggest');

    if (isLegacySkillSuggest || isAgentSkillSuggest) {
      try {
        const result = JSON.parse(part.content);
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
  return null;
}

// Detect skill set command results
function parseSkillCreation(parts: MessagePart[]): string | null {
  for (const part of parts) {
    // Check shell tool results for "Skill "X" saved" pattern
    const isShellTool = part.type === 'agent-tool' && part.toolName === 'shell';
    const command = part.toolArgs?.command as string | undefined;

    if (isShellTool && command?.startsWith('skill set ')) {
      // Extract skill name from result: 'Skill "name" saved'
      const match = part.content?.match(/Skill "([^"]+)" saved/);
      if (match) {
        return match[1];
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
function ReasoningPart({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);

  if (!part.content.trim()) return null;

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
          {part.content}
        </div>
      )}
    </div>
  );
}

// Render a tool (terminal) part - collapsible (styled like AgentToolPart for consistency)
function ToolPart({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);
  const status = part.toolStatus || (part.content ? 'completed' : 'queued');

  // Status indicator colors and labels
  const statusConfig = {
    queued: { color: 'bg-zinc-500', label: 'queued', animate: false },
    running: { color: 'bg-yellow-500', label: 'running...', animate: true },
    completed: { color: 'bg-green-500', label: null, animate: false },
  };
  const config = statusConfig[status];

  return (
    <div className="my-2 w-full min-w-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors w-full min-w-0 text-left overflow-hidden"
      >
        <ChevronIcon expanded={expanded} />
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
        <span className="font-mono text-zinc-400 truncate flex-1 min-w-0">
          $ {part.command}
        </span>
        {config.label && <span className="text-zinc-500 italic flex-shrink-0">{config.label}</span>}
      </button>
      {expanded && (
        <div className="mt-1 ml-5 text-xs rounded p-2 max-h-[200px] overflow-y-auto">
          <pre className="font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {part.content || <span className="text-zinc-500">{status === 'running' ? 'Running...' : 'Queued...'}</span>}
          </pre>
        </div>
      )}
    </div>
  );
}

// Get display name for agent tool
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

// Render agent tool call (search, analyze_url, get_processed_transcript) - collapsible
function AgentToolPart({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);

  const toolName = part.toolName || '';
  const isSearch = toolName === 'search';
  const isAnalyzeUrl = toolName === 'analyze_url';
  const isTranscript = toolName.includes('get_processed_transcript');
  const isShellCommand = toolName === 'shell';
  const toolDisplayName = getToolDisplayName(toolName);

  // Extract search query, URL, or command from args
  const args = part.toolArgs as Record<string, unknown> | undefined;
  const toolDetail = args?.query || args?.url || args?.command || '';

  const isLoading = !part.content;
  const sources = part.sources || [];

  // Color coding: purple for transcript, green for shell, blue for search tools
  const dotColor = isTranscript ? 'bg-purple-500' : isShellCommand ? 'bg-green-500' : 'bg-blue-500';
  const loadingText = isTranscript ? 'processing...' : isShellCommand ? 'running...' : 'searching...';

  // For shell commands, truncate long commands
  const shellCommand = isShellCommand ? String(args?.command || '') : '';
  const truncatedCommand = shellCommand.length > 60
    ? shellCommand.slice(0, 60) + '...'
    : shellCommand;

  return (
    <div className="my-2 w-full min-w-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors w-full min-w-0 text-left overflow-hidden"
      >
        <ChevronIcon expanded={expanded} />
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${isLoading ? 'animate-pulse' : ''}`} />
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
        {!isLoading && sources.length > 0 && (
          <span className="text-zinc-500 flex-shrink-0">{sources.length} sources</span>
        )}
      </button>
      {expanded && (
        <div className={`mt-1 ml-5 text-xs rounded p-2 ${isTranscript ? 'max-h-[400px]' : 'max-h-[200px]'} overflow-y-auto`}>
          {(isTranscript || isSearch || isAnalyzeUrl) && part.content ? (
            <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {part.content}
              </ReactMarkdown>
            </div>
          ) : part.content ? (
            <pre className="whitespace-pre-wrap break-all text-zinc-500">{part.content}</pre>
          ) : null}
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
function TextPart({ content }: { content: string }): React.ReactNode {
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

// Render sources citations
function SourcesPart({ part }: { part: MessagePart }) {
  const sources = part.sources || [];
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 pt-2 border-t border-zinc-700">
      <div className="text-xs text-zinc-500 mb-1">Sources:</div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors"
          >
            {source.title}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ChatMessage({ message, onCodifySkill, isCodifying }: ChatMessageProps) {
  // User message
  if (message.role === 'user') {
    const textContent = message.parts[0]?.content || '';
    return (
      <div className="flex justify-end w-full min-w-0 max-w-full">
        <div className="max-w-[80%] min-w-0 px-4 py-3 chat-bubble-user text-zinc-100 rounded-2xl rounded-br-md overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          <p className="whitespace-pre-wrap break-words">{textContent}</p>
        </div>
      </div>
    );
  }

  // Assistant message - render parts inline
  const hasParts = message.parts.length > 0;

  // Check for skill suggestion in tool results (from skill suggest command)
  const skillSuggestion = parseToolSkillSuggestion(message.parts);

  // Check for skill creation in tool results (from skill set command)
  const createdSkillName = parseSkillCreation(message.parts);

  return (
    <div className="flex justify-start w-full min-w-0">
      <div className="max-w-[90%] min-w-0 px-4 py-3 chat-bubble-assistant text-zinc-100 rounded-2xl rounded-bl-md overflow-hidden">
        {hasParts ? (
          <>
            {message.parts.map((part, index) => {
              if (part.type === 'reasoning') {
                return <ReasoningPart key={index} part={part} />;
              }
              if (part.type === 'tool') {
                return <ToolPart key={index} part={part} />;
              }
              if (part.type === 'agent-tool') {
                return <AgentToolPart key={index} part={part} />;
              }
              if (part.type === 'sources') {
                return <SourcesPart key={index} part={part} />;
              }
              return <TextPart key={index} content={part.content} />;
            })}
            <MessageStats stats={message.stats} />
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
