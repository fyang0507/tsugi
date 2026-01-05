'use client';

import { Message } from '@/hooks/useForgeChat';
import { useMemo } from 'react';

interface ChatMessageProps {
  message: Message;
}

// Parse message content to identify and style <shell> tags
function parseContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const shellPattern = /<shell>([\s\S]*?)<\/shell>/g;
  let lastIndex = 0;
  let match;

  while ((match = shellPattern.exec(content)) !== null) {
    // Add text before the shell tag
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex}>{content.slice(lastIndex, match.index)}</span>
      );
    }

    // Add the shell command with special styling
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded font-mono text-sm text-green-400 break-all"
      >
        <span className="text-zinc-500">$</span>
        {match[1].trim()}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={lastIndex}>{content.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [content];
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const parsedContent = useMemo(() => {
    if (message.role === 'assistant') {
      return parseContent(message.content);
    }
    return message.content;
  }, [message.content, message.role]);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 bg-blue-600 text-white rounded-2xl rounded-br-md">
          <p className="whitespace-pre-wrap break-all">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-zinc-400 font-mono">Terminal</span>
          </div>
          <pre className="p-3 text-sm font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {message.content}
          </pre>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-4 py-3 bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-md">
        <div className="whitespace-pre-wrap break-all">{parsedContent}</div>
      </div>
    </div>
  );
}
