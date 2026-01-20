import { taskAgent } from '@/lib/agent/task-agent';
import { skillAgent } from '@/lib/agent/skill-agent';
import { toModelMessages, type APIMessage } from '@/lib/messages/transform';
import { clearSandboxExecutor, getSandboxExecutor } from '@/lib/sandbox/executor';
import { mergePlaygroundEnv } from '@/lib/tools/playground-env';
import { runWithRequestContext } from '@/lib/agent/request-context';

type AgentMode = 'task' | 'codify-skill';

interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-start' | 'tool-result' | 'agent-tool-call' | 'agent-tool-result' | 'source' | 'iteration-end' | 'done' | 'error' | 'usage' | 'raw-content' | 'tool-output' | 'sandbox_timeout' | 'sandbox_created';
  sandboxId?: string;
  content?: string;
  command?: string;
  commandId?: string;  // Unique identifier for command tracking
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
  // Which agent generated this response
  agent?: 'task' | 'skill';
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
    // Wrap with request context so skill agent's tool can access conversationId/sandboxId/env
    const currentSandboxId = requestSandboxId || executor.getSandboxId() || undefined;
    await runWithRequestContext({ conversationId, sandboxId: currentSandboxId, env: mergedEnv }, async () => {
    try {
      // For codify-skill mode: build transcript from history, create agent with closure
      // The skill agent gets a blank context and calls get_processed_transcript tool
      let agent;
      let messages: APIMessage[];

      if (mode === 'codify-skill') {
        agent = skillAgent;
        // Minimal trigger message - agent instructions tell it to call get_processed_transcript first
        messages = [{ role: 'user', content: 'Start' }];
      } else {
        agent = taskAgent;
        messages = [...initialMessages];
      }

      const startTime = Date.now();

      // Convert to ModelMessage array (preserves structure for KV cache)
      const modelMessages = toModelMessages(messages);

      // Track cumulative usage across all steps (for multi-step agentic flows)
      const cumulativeUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: 0,
      };

      // Stream agent response - agent handles multi-step via stopWhen condition
      const result = await agent.stream({ messages: modelMessages });

      // Use fullStream to capture both text and tool calls
      for await (const part of result.fullStream) {
        // Check for abort
        if (aborted) {
          break;
        }

        console.log('[Stream Debug] Event type:', part.type, part.type === 'tool-call' ? part.toolName : '');
        switch (part.type) {
          case 'reasoning-delta':
            send({ type: 'reasoning', content: part.text });
            break;
          case 'text-delta':
            send({ type: 'text', content: part.text });
            break;
          case 'tool-call': {
            // AI SDK uses 'input' instead of 'args' for tool arguments
            const toolInput = (part as { input?: Record<string, unknown> }).input;
            // Normalize tool name (strip erroneous prefixes like "google:")
            const normalizedToolName = part.toolName.includes(':')
              ? part.toolName.split(':').pop()!
              : part.toolName;
            // Track sandbox usage for shell tool
            if (normalizedToolName === 'shell') {
              const command = (toolInput as { command?: string })?.command;
              if (command && !command.startsWith('skill ')) {
                sandboxUsed = true;
              }
              // Emit sandbox_created on first shell use when no sandboxId was provided
              if (!sandboxIdEmitted && !requestSandboxId && sandboxUsed) {
                const currentSandboxId = executor.getSandboxId();
                if (currentSandboxId) {
                  send({ type: 'sandbox_created', sandboxId: currentSandboxId });
                  sandboxIdEmitted = true;
                }
              }
            }
            send({
              type: 'agent-tool-call',
              toolName: normalizedToolName,
              toolArgs: toolInput,
              toolCallId: part.toolCallId,
            });
            break;
          }
          case 'tool-result': {
            // Tool results (AI SDK handles execution automatically)
            // AI SDK v6 uses 'output' instead of 'result'
            const output = (part as { output?: unknown }).output;
            const resultStr = typeof output === 'string' ? output : JSON.stringify(output ?? '');
            send({
              type: 'agent-tool-result',
              toolCallId: part.toolCallId,
              result: resultStr,
            });
            break;
          }
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
          default: {
            // Handle step-finish events (not in TypeScript types but emitted by AI SDK)
            const eventType = (part as { type: string }).type;
            if (eventType === 'step-finish') {
              // Accumulate usage from each step (for multi-step agentic flows)
              // AI SDK v6 uses inputTokens/outputTokens (not promptTokens/completionTokens)
              const stepPart = part as {
                usage?: {
                  inputTokens?: number;
                  outputTokens?: number;
                  inputTokenDetails?: {
                    cacheReadTokens?: number;
                  };
                  outputTokenDetails?: {
                    reasoningTokens?: number;
                  };
                };
              };
              if (stepPart.usage) {
                cumulativeUsage.inputTokens += stepPart.usage.inputTokens || 0;
                cumulativeUsage.outputTokens += stepPart.usage.outputTokens || 0;
                cumulativeUsage.cacheReadTokens += stepPart.usage.inputTokenDetails?.cacheReadTokens || 0;
                cumulativeUsage.reasoningTokens += stepPart.usage.outputTokenDetails?.reasoningTokens || 0;
              }
              console.log('[Step Debug] Step finished, cumulative usage:', cumulativeUsage);
            } else {
              // Log other unhandled event types for debugging
              console.log('[Stream Debug] Unhandled event type:', eventType);
            }
            break;
          }
        }
      }

      // Get usage metadata including cache stats
      const usage = await result.usage;
      const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens;
      const reasoningTokens = (usage?.outputTokenDetails as { reasoningTokens?: number })?.reasoningTokens;
      const executionTimeMs = Date.now() - startTime;

      // Use cumulative usage from step-finish events if available (more accurate for multi-step)
      // Fall back to final result.usage if no step events were captured
      const hasCumulativeUsage = cumulativeUsage.inputTokens > 0 || cumulativeUsage.outputTokens > 0;
      const finalInputTokens = hasCumulativeUsage ? cumulativeUsage.inputTokens : usage?.inputTokens;
      const finalOutputTokens = hasCumulativeUsage ? cumulativeUsage.outputTokens : usage?.outputTokens;
      const finalCacheTokens = hasCumulativeUsage ? cumulativeUsage.cacheReadTokens : cacheReadTokens;
      const finalReasoningTokens = hasCumulativeUsage ? cumulativeUsage.reasoningTokens : reasoningTokens;

      console.log('[Cache Debug]', {
        inputTokens: finalInputTokens,
        outputTokens: finalOutputTokens,
        cacheReadTokens: finalCacheTokens,
        reasoningTokens: finalReasoningTokens,
        executionTimeMs,
        usedCumulative: hasCumulativeUsage,
        rawUsage: { input: usage?.inputTokens, output: usage?.outputTokens },
        inputTokenDetails: JSON.stringify(usage?.inputTokenDetails),
      });

      send({
        type: 'usage',
        usage: {
          promptTokens: finalInputTokens,
          completionTokens: finalOutputTokens,
          cachedContentTokenCount: finalCacheTokens,
          reasoningTokens: finalReasoningTokens,
        },
        executionTimeMs,
        agent: mode === 'codify-skill' ? 'skill' : 'task',
      });

      send({ type: 'done' });
    } catch (error) {
      send({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Clean up sandbox if user aborted and sandbox was used (only in deployed env to save costs)
      // In local env, keep sandbox alive for faster iteration during development
      if (aborted && sandboxUsed && process.env.VERCEL === '1') {
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
