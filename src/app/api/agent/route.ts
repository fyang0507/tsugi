import { ModelMessage } from 'ai';
import { createForgeAgent } from '@/lib/agent/forge-agent';
import { extractCommands, formatToolResults, truncateOutput } from '@/lib/tools/command-parser';
import { createSkillCommands } from '@/lib/tools/skill-commands';

const MAX_ITERATIONS = 10;

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

interface SSEEvent {
  type: 'text' | 'tool-call' | 'tool-result' | 'iteration-end' | 'done' | 'error';
  content?: string;
  command?: string;
  result?: string;
  hasMoreCommands?: boolean;
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
      const data = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(encoder.encode(data));
    }
  }

  function close() {
    if (controller) {
      controller.close();
    }
  }

  return { stream, send, close };
}

async function executeCommand(command: string): Promise<string> {
  const commands = createSkillCommands();
  const sortedCommands = Object.keys(commands).sort((a, b) => b.length - a.length);

  for (const cmd of sortedCommands) {
    if (command === cmd || command.startsWith(cmd + ' ')) {
      const args = command.slice(cmd.length).trim();
      const handler = commands[cmd];
      const result = await handler(args);
      return truncateOutput(result);
    }
  }

  return `Unknown command: ${command}. Run "skill help" for available commands.`;
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
  const { messages: initialMessages } = await req.json() as { messages: Message[] };

  if (!initialMessages || !Array.isArray(initialMessages) || initialMessages.length === 0) {
    return Response.json({ error: 'Messages array is required' }, { status: 400 });
  }

  const { stream, send, close } = createSSEStream();

  // Run the agent loop in the background
  (async () => {
    try {
      const agent = createForgeAgent();
      const messages: Message[] = [...initialMessages];
      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        // Convert to ModelMessage array (preserves structure for KV cache)
        const modelMessages = toModelMessages(messages);

        // Stream agent response with proper message array
        const result = await agent.stream({ messages: modelMessages });
        let fullOutput = '';

        for await (const chunk of result.textStream) {
          fullOutput += chunk;
          send({ type: 'text', content: chunk });
        }

        // Store raw output verbatim as assistant message
        messages.push({ role: 'assistant', content: fullOutput });

        // Parse for commands (read-only, don't modify the message)
        const commands = extractCommands(fullOutput);

        if (commands.length === 0) {
          // No commands, we're done
          send({ type: 'iteration-end', hasMoreCommands: false });
          break;
        }

        // Execute commands and create separate tool message
        const executions: Array<{ command: string; result: string }> = [];

        for (const command of commands) {
          send({ type: 'tool-call', command });
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
