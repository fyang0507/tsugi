'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessagePart } from '@/hooks/useForgeChat';
import { MessageStats } from './MessageStats';

export interface SkillSuggestion {
  learned: string;
  skillToUpdate?: string | null;
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
            learned: result.learned,
            skillToUpdate: result.skillToUpdate || null,
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

// Render agent tool call (google_search, url_context) - collapsible
function AgentToolPart({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);

  // Tool names may have namespace prefix like "google_search:google_search"
  const toolName = part.toolName || '';
  const isGoogleSearch = toolName.includes('google_search');
  const toolDisplayName = isGoogleSearch
    ? 'Google Search'
    : toolName.includes('url_context')
      ? 'URL Context'
      : toolName || 'Tool';

  // Extract search query or URL from args
  const args = part.toolArgs as Record<string, unknown> | undefined;
  const queries = args?.queries as string[] | undefined;
  const toolDetail = queries?.[0] || args?.url || '';

  const isLoading = !part.content;
  const sources = part.sources || [];

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-500 animate-pulse' : 'bg-blue-500'}`} />
        <span className="font-medium">{toolDisplayName}</span>
        {toolDetail && (
          <span className="text-zinc-500 truncate max-w-[250px]">{String(toolDetail)}</span>
        )}
        {isLoading && <span className="text-zinc-500 italic">searching...</span>}
        {!isLoading && sources.length > 0 && (
          <span className="text-zinc-500">{sources.length} sources</span>
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-5 text-xs bg-zinc-900 rounded p-2 max-h-[200px] overflow-y-auto">
          {isGoogleSearch && sources.length > 0 ? (
            <ul className="space-y-1">
              {sources.map((source) => (
                <li key={source.id} className="text-zinc-400">
                  • {source.title}
                </li>
              ))}
            </ul>
          ) : part.content ? (
            <pre className="whitespace-pre-wrap break-all text-zinc-500">{part.content}</pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Render a text part with markdown
function TextPart({ content }: { content: string }) {
  if (!content.trim()) return null;
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
            {skillSuggestion && onCodifySkill && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <button
                  onClick={() => onCodifySkill(skillSuggestion)}
                  disabled={isCodifying}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed ${
                    skillSuggestion.skillToUpdate
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {isCodifying ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{skillSuggestion.skillToUpdate ? 'Updating...' : 'Codifying...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {skillSuggestion.skillToUpdate ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        )}
                      </svg>
                      <span>{skillSuggestion.skillToUpdate ? 'Update Skill' : 'Codify as Skill'}</span>
                    </>
                  )}
                </button>
                <p className="mt-1 text-xs text-zinc-500">
                  {skillSuggestion.skillToUpdate ? (
                    <>Update <code className="bg-zinc-700 px-1 rounded">{skillSuggestion.skillToUpdate}</code>: {skillSuggestion.learned}</>
                  ) : (
                    <>Learned: {skillSuggestion.learned}</>
                  )}
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
