import { taskAgent } from '@/lib/agent/task-agent';
import { skillAgent } from '@/lib/agent/skill-agent';
import { extractCommands, formatToolResults } from '@/lib/tools/command-parser';
import { executeCommand } from '@/lib/tools/command-executor';
import { toModelMessages, type APIMessage } from '@/lib/messages/transform';
import { clearSandboxExecutor, getSandboxExecutor, SandboxTimeoutError } from '@/lib/sandbox/executor';
import { mergePlaygroundEnv } from '@/lib/tools/playground-env';
import { runWithRequestContext } from '@/lib/agent/request-context';

const MAX_ITERATIONS = 10;

type AgentMode = 'task' | 'codify-skill';

interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-start' | 'tool-result' | 'agent-tool-call' | 'agent-tool-result' | 'source' | 'iteration-end' | 'done' | 'error' | 'usage' | 'raw-content' | 'tool-output' | 'sandbox_timeout' | 'sandbox_created';
  sandboxId?: string;
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


export async function POST(req: Request) {
  const { messages: initialMessages, mode = 'task', conversationId, env: uiEnv, sandboxId: requestSandboxId } = await req.json() as {
    messages: APIMessage[];
    mode?: AgentMode;
    conversationId?: string;
    env?: Record<string, string>;
    sandboxId?: string;
  };

  // Initialize executor with sandboxId if reconnecting to existing sandbox
  const executor = await getSandboxExecutor(requestSandboxId);

  // Merge UI env vars with .env.playground (local dev) or Vercel env (production)
  const mergedEnv = mergePlaygroundEnv(uiEnv);

  // Validate: task mode requires messages, codify-skill mode requires conversationId
  if (mode === 'codify-skill') {
    if (!conversationId) {
      return Response.json({ error: 'conversationId is required for codify-skill mode' }, { status: 400 });
    }
  } else if (!initialMessages || !Array.isArray(initialMessages) || initialMessages.length === 0) {
    return Response.json({ error: 'Messages array is required' }, { status: 400 });
  }

  const { stream, send, close } = createSSEStream();

  // Track abort state for sandbox cleanup
  let aborted = false;
  let sandboxUsed = false;
  let sandboxIdEmitted = false;

  // Listen for client abort (when user stops the agent)
  req.signal.addEventListener('abort', () => {
    aborted = true;
  });

  // Run the agent loop in the background
  (async () => {
    // Wrap with request context so skill agent's tool can access conversationId/sandboxId
    const currentSandboxId = requestSandboxId || executor.getSandboxId() || undefined;
    await runWithRequestContext({ conversationId, sandboxId: currentSandboxId }, async () => {
    try {
      // For codify-skill mode: build transcript from history, create agent with closure
      // The skill agent gets a blank context and calls get-processed-transcript tool
      let agent;
      let messages: APIMessage[];

      if (mode === 'codify-skill') {
        agent = skillAgent;
        // Minimal trigger message - agent instructions tell it to call get-processed-transcript first
        messages = [{ role: 'user', content: 'Start' }];
      } else {
        agent = taskAgent;
        messages = [...initialMessages];
      }
      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        // Check for abort before starting new iteration
        if (aborted) {
          send({ type: 'done' });
          break;
        }

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

        let sandboxTimedOut = false;
        for (const command of commands) {
          // Check for abort before executing each command
          if (aborted) {
            break;
          }

          // Only send tool-call if we're using the fallback path
          if (detectedCommands.length === 0) {
            send({ type: 'tool-call', command });
          }
          // Signal that this command is now actually executing
          send({ type: 'tool-start', command });

          // Track that sandbox is being used (shell commands use sandbox)
          if (!command.startsWith('skill ')) {
            sandboxUsed = true;
          }

          try {
            const result = await executeCommand(command, { env: mergedEnv });
            executions.push({ command, result });
            send({ type: 'tool-result', command, result });

            // Emit sandbox_created on first shell command when no sandboxId was provided
            if (!sandboxIdEmitted && !requestSandboxId && sandboxUsed) {
              const currentSandboxId = executor.getSandboxId();
              if (currentSandboxId) {
                send({ type: 'sandbox_created', sandboxId: currentSandboxId });
                sandboxIdEmitted = true;
              }
            }
          } catch (error) {
            if (error instanceof SandboxTimeoutError) {
              send({
                type: 'sandbox_timeout',
                content: 'Sandbox timed out due to inactivity. All non-conversational data has been cleared.',
              });
              await clearSandboxExecutor();
              sandboxUsed = false;
              sandboxTimedOut = true;
              break;
            }
            throw error;
          }
        }

        // Exit agent loop if sandbox timed out
        if (sandboxTimedOut) {
          send({ type: 'done' });
          break;
        }

        // Exit loop if aborted during command execution
        if (aborted) {
          send({ type: 'done' });
          break;
        }

        // Store results as separate tool message
        const toolMessage: APIMessage = {
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
      // Clean up sandbox if user aborted and sandbox was used
      if (aborted && sandboxUsed) {
        try {
          await clearSandboxExecutor();
          console.log('[Agent] Sandbox cleaned up after abort');
        } catch (cleanupError) {
          console.error('[Agent] Failed to cleanup sandbox:', cleanupError);
        }
      }
      close();
    }
    });
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
