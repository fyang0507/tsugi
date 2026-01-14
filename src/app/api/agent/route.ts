import { ModelMessage } from 'ai';
import { taskAgent } from '@/lib/agent/task-agent';
import { skillAgent } from '@/lib/agent/skill-agent';
import { extractCommands, formatToolResults } from '@/lib/tools/command-parser';
import { executeCommand } from '@/lib/tools/skill-commands';

const MAX_ITERATIONS = 10;

type AgentMode = 'task' | 'codify-skill';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-start' | 'tool-result' | 'agent-tool-call' | 'agent-tool-result' | 'source' | 'iteration-end' | 'done' | 'error' | 'usage' | 'raw-content' | 'tool-output';
  content?: string;
  command?: string;
  result?: string;
  hasMoreCommands?: boolean;
  // For agent tool calls (google_search, url_context)
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  // For source citations (Gemini grounding)
  sourceId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedContentTokenCount?: number;
    reasoningTokens?: number;
  };
  executionTimeMs?: number;
  // For KV cache support
  rawContent?: string;
  toolOutput?: string;
}

function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(event: SSEEvent) {
    if (controller) {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch {
        // Controller already closed (client disconnected, etc.)
        controller = null;
      }
    }
  }

  function close() {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Controller already closed (client disconnected, etc.)
      }
      controller = null;
    }
  }

  return { stream, send, close };
}


/**
 * Convert our internal message format to AI SDK ModelMessage format.
 * This preserves each message as a separate entry for KV cache efficiency.
 */
function toModelMessages(messages: Message[]): ModelMessage[] {
  return messages.map((m): ModelMessage => {
    if (m.role === 'user') {
      return { role: 'user', content: m.content };
    }
    if (m.role === 'assistant') {
      return { role: 'assistant', content: m.content };
    }
    // Tool results - use 'user' role with clear prefix since we don't have
    // actual tool calls (we parse <shell> tags from assistant text output)
    return { role: 'user', content: `[Shell Output]\n${m.content}` };
  });
}

export async function POST(req: Request) {
  const { messages: initialMessages, mode = 'task' } = await req.json() as {
    messages: Message[];
    mode?: AgentMode;
  };

  if (!initialMessages || !Array.isArray(initialMessages) || initialMessages.length === 0) {
    return Response.json({ error: 'Messages array is required' }, { status: 400 });
  }

  const { stream, send, close } = createSSEStream();

  // Run the agent loop in the background
  (async () => {
    try {
      const agent = mode === 'codify-skill' ? skillAgent : taskAgent;
      const messages: Message[] = [...initialMessages];
      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const iterationStartTime = Date.now();

        // Convert to ModelMessage array (preserves structure for KV cache)
        const modelMessages = toModelMessages(messages);

        // Stream agent response with proper message array
        const result = await agent.stream({ messages: modelMessages });
        let fullOutput = '';

        // Track shell commands detected during streaming for proper sequencing
        let lastProcessedIndex = 0;
        const detectedCommands: string[] = [];

        // Use fullStream to capture both text and tool calls
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'reasoning-delta':
              send({ type: 'reasoning', content: part.text });
              break;
            case 'text-delta':
              fullOutput += part.text;
              send({ type: 'text', content: part.text });

              // Detect complete shell commands as they stream in
              // This ensures tool-call events are sent in sequence with text
              const shellRegex = /<shell>([\s\S]*?)<\/shell>/g;
              let match;
              while ((match = shellRegex.exec(fullOutput)) !== null) {
                // Only process commands we haven't seen yet
                if (match.index >= lastProcessedIndex) {
                  const command = match[1].trim();
                  if (command && !detectedCommands.includes(command)) {
                    detectedCommands.push(command);
                    send({ type: 'tool-call', command });
                  }
                  lastProcessedIndex = match.index + match[0].length;
                }
              }
              break;
            case 'tool-call':
              // Native tool calls (if using non-Gemini providers)
              send({
                type: 'agent-tool-call',
                toolName: part.toolName,
                toolArgs: part.input as Record<string, unknown>,
                toolCallId: part.toolCallId,
              });
              break;
            case 'tool-result':
              // Native tool results
              send({
                type: 'agent-tool-result',
                toolCallId: part.toolCallId,
                result: typeof part.output === 'string' ? part.output : JSON.stringify(part.output),
              });
              break;
            case 'source': {
              // Gemini grounding sources - citations for the response
              const sourcePart = part as { id?: string; url?: string; title?: string };
              send({
                type: 'source',
                sourceId: sourcePart.id,
                sourceUrl: sourcePart.url,
                sourceTitle: sourcePart.title,
              });
              break;
            }
          }
        }

        // Get usage metadata including cache stats
        const usage = await result.usage;
        const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens;
        const reasoningTokens = (usage?.outputTokenDetails as { reasoningTokens?: number })?.reasoningTokens;
        const executionTimeMs = Date.now() - iterationStartTime;

        console.log('[Cache Debug] Iteration', iteration, {
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          cacheReadTokens,
          reasoningTokens,
          executionTimeMs,
          inputTokenDetails: JSON.stringify(usage?.inputTokenDetails),
        });

        send({
          type: 'usage',
          usage: {
            promptTokens: usage?.inputTokens,
            completionTokens: usage?.outputTokens,
            cachedContentTokenCount: cacheReadTokens,
            reasoningTokens,
          },
          executionTimeMs,
        });

        // Send raw content for KV cache support
        send({ type: 'raw-content', rawContent: fullOutput });

        // Store raw output verbatim as assistant message
        messages.push({ role: 'assistant', content: fullOutput });

        // Use commands detected during streaming (already sent tool-call events)
        // Fall back to extractCommands for any edge cases
        const commands = detectedCommands.length > 0
          ? detectedCommands
          : extractCommands(fullOutput);

        if (commands.length === 0) {
          // No commands, we're done
          send({ type: 'iteration-end', hasMoreCommands: false });
          break;
        }

        // Execute commands and create separate tool message
        // Note: tool-call events were already sent during streaming
        const executions: Array<{ command: string; result: string }> = [];

        for (const command of commands) {
          // Only send tool-call if we're using the fallback path
          if (detectedCommands.length === 0) {
            send({ type: 'tool-call', command });
          }
          // Signal that this command is now actually executing
          send({ type: 'tool-start', command });
          const result = await executeCommand(command);
          executions.push({ command, result });
          send({ type: 'tool-result', command, result });
        }

        // Store results as separate tool message
        const toolMessage: Message = {
          role: 'tool',
          content: formatToolResults(executions),
        };
        messages.push(toolMessage);

        // Send tool output for KV cache support
        send({ type: 'tool-output', toolOutput: toolMessage.content });

        send({ type: 'iteration-end', hasMoreCommands: true });
      }

      send({ type: 'done' });
    } catch (error) {
      send({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
