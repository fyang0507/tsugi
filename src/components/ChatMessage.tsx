'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessagePart } from '@/hooks/useForgeChat';
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
    if (part.type === 'tool' && part.command?.startsWith('skill suggest')) {
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
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <div className={`w-2 h-2 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
        <span className="font-mono text-zinc-400 truncate max-w-[400px]">
          $ {part.command}
        </span>
        {config.label && <span className="text-zinc-500 italic">{config.label}</span>}
      </button>
      {expanded && (
        <div className="mt-1 ml-5 text-xs bg-zinc-900 rounded p-2 max-h-[200px] overflow-y-auto">
          <pre className="font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {part.content || <span className="text-zinc-500">{status === 'running' ? 'Running...' : 'Queued...'}</span>}
          </pre>
        </div>
      )}
    </div>
  );
}

// Render agent tool call (google_search, url_context, get-processed-transcript) - collapsible
function AgentToolPart({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);

  // Tool names may have namespace prefix like "google_search:google_search"
  const toolName = part.toolName || '';
  const isGoogleSearch = toolName.includes('google_search');
  const isTranscript = toolName.includes('get-processed-transcript');
  const isShellCommand = toolName === 'execute_shell';
  const toolDisplayName = isGoogleSearch
    ? 'Google Search'
    : toolName.includes('url_context')
      ? 'URL Context'
      : isTranscript
        ? 'Task Summary'
        : isShellCommand
          ? 'Shell'
          : toolName || 'Tool';

  // Extract search query, URL, or command from args
  const args = part.toolArgs as Record<string, unknown> | undefined;
  const queries = args?.queries as string[] | undefined;
  const toolDetail = queries?.[0] || args?.url || args?.command || '';

  const isLoading = !part.content;
  const sources = part.sources || [];

  // Color coding: purple for transcript, green for shell, blue for search tools
  const dotColor = isTranscript ? 'bg-purple-500' : isShellCommand ? 'bg-green-500' : 'bg-blue-500';
  const loadingText = isTranscript ? 'processing...' : isShellCommand ? 'running...' : 'searching...';

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <div className={`w-2 h-2 rounded-full ${dotColor} ${isLoading ? 'animate-pulse' : ''}`} />
        <span className="font-medium">{toolDisplayName}</span>
        {toolDetail && (
          <span className="text-zinc-500 truncate max-w-[250px]">{String(toolDetail)}</span>
        )}
        {isLoading && <span className="text-zinc-500 italic">{loadingText}</span>}
        {!isLoading && sources.length > 0 && (
          <span className="text-zinc-500">{sources.length} sources</span>
        )}
      </button>
      {expanded && (
        <div className={`mt-1 ml-5 text-xs bg-zinc-900 rounded p-2 ${isTranscript ? 'max-h-[400px]' : 'max-h-[200px]'} overflow-y-auto`}>
          {isGoogleSearch && sources.length > 0 ? (
            <ul className="space-y-1">
              {sources.map((source) => (
                <li key={source.id} className="text-zinc-400">
                  • {source.title}
                </li>
              ))}
            </ul>
          ) : isTranscript && part.content ? (
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
function CompleteBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-sm font-medium">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>COMPLETE</span>
    </div>
  );
}

// Render a text part with markdown
function TextPart({ content }: { content: string }) {
  if (!content.trim()) return null;

  const trimmed = content.trim();

  // Exact match: just "COMPLETE"
  if (trimmed === 'COMPLETE') {
    return <CompleteBadge />;
  }

  // Check if ends with COMPLETE on own line
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1].trim();
  if (lastLine === 'COMPLETE' && lines.length > 1) {
    const textWithoutComplete = lines.slice(0, -1).join('\n').trim();
    return (
      <>
        {textWithoutComplete && (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline break-all"
                  >
                    {children}
                  </a>
                ),
                code: ({ className, children, ...props }) => {
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
              }}
            >
              {textWithoutComplete}
            </ReactMarkdown>
          </div>
        )}
        <div className="mt-3"><CompleteBadge /></div>
      </>
    );
  }

  // Regular markdown rendering
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Properly render links with URL handling
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
            >
              {children}
            </a>
          ),
          // Ensure code blocks handle long content
          code: ({ className, children, ...props }) => {
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
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
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 bg-blue-600 text-white rounded-2xl rounded-br-md">
          <p className="whitespace-pre-wrap break-all">{textContent}</p>
        </div>
      </div>
    );
  }

  // Assistant message - render parts inline
  const hasParts = message.parts.length > 0;

  // Check for skill suggestion in tool results (from skill suggest command)
  const skillSuggestion = parseToolSkillSuggestion(message.parts);

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] px-4 py-3 bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-md">
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
            {skillSuggestion && skillSuggestion.status === 'success' && onCodifySkill && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <button
                  onClick={() => onCodifySkill(skillSuggestion)}
                  disabled={isCodifying}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500"
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
