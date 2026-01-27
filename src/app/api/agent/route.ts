import { createTaskAgent } from '@/lib/agent/task-agent';
import { createSkillAgent } from '@/lib/agent/skill-agent';
import { toModelMessages, type Message } from '@/lib/messages/transform';
import { clearSandboxExecutor, getSandboxExecutor } from '@/lib/sandbox/executor';
import { mergePlaygroundEnv } from '@/lib/tools/playground-env';
import { runWithRequestContext } from '@/lib/agent/request-context';
import { traced, flush } from 'braintrust';
import { fetchTraceStats } from '@/lib/braintrust-api';
import { createSSEStream, SSE_HEADERS } from '@/lib/sse';

type AgentMode = 'task' | 'codify-skill';


export async function POST(req: Request) {
  const { messages: initialMessages, mode = 'task', conversationId, env: uiEnv, sandboxId: requestSandboxId } = await req.json() as {
    messages: Message[];
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
      // Create agent per-request INSIDE request context so it picks up user-provided API key
      let agent;
      let messages: Message[];

      if (mode === 'codify-skill') {
        agent = createSkillAgent();
        // Use conversation history if provided (follow-up messages), otherwise trigger with 'Start'
        messages = initialMessages.length > 0 ? [...initialMessages] : [{ role: 'user', rawContent: 'Start' }];
      } else {
        agent = createTaskAgent();
        messages = [...initialMessages];
      }

      const startTime = Date.now();

      // Convert to ModelMessage array (preserves structure for KV cache)
      const modelMessages = toModelMessages(messages);

      // Collect all raw stream parts for debugging
      const rawStreamParts: unknown[] = [];

      // Wrap agent execution with Braintrust tracing to capture root span ID
      // This allows us to query BTQL for aggregated token stats across all nested LLM calls
      let rootSpanId: string | undefined;

      // Stream agent response - agent handles multi-step via stopWhen condition
      const result = await traced(
        async (span) => {
          // Capture root span ID for BTQL query
          const spanAny = span as unknown as Record<string, unknown>;
          rootSpanId = (spanAny._rootSpanId as string) ?? span.id;
          return agent.stream({ messages: modelMessages });
        },
        { name: `${mode === 'codify-skill' ? 'skill' : 'task'}-agent-${conversationId || 'anonymous'}` }
      );

      // Use fullStream to capture both text and tool calls
      for await (const part of result.fullStream) {
        // Check for abort
        if (aborted) {
          break;
        }

        console.log('[Stream Debug] Event type:', part.type, part.type === 'tool-call' ? part.toolName : '');

        // Collect raw stream part for debugging
        rawStreamParts.push(part);

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
              // Emit sandbox_active when:
              // 1. No sandboxId was provided (new sandbox created)
              // 2. Provided sandboxId differs from actual (reconnect failed, new sandbox created)
              if (!sandboxIdEmitted && sandboxUsed) {
                const currentSandboxId = executor.getSandboxId();
                if (currentSandboxId && currentSandboxId !== requestSandboxId) {
                  send({ type: 'sandbox_active', sandboxId: currentSandboxId });
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
          case 'error': {
            // AI SDK stream error - extract meaningful message and send to client
            const errorPart = part as { error?: { message?: string; responseBody?: string; data?: { error?: { message?: string } } } };
            let errorMessage = 'An error occurred';
            if (errorPart.error) {
              // Try to get message from nested data.error.message (API errors)
              if (errorPart.error.data?.error?.message) {
                errorMessage = errorPart.error.data.error.message;
              } else if (errorPart.error.message) {
                errorMessage = errorPart.error.message;
              }
            }
            console.error('[Agent] Stream error:', errorPart.error);
            send({ type: 'error', content: errorMessage });
            break;
          }
          default: {
            // Handle step-finish events (not in TypeScript types but emitted by AI SDK)
            const eventType = (part as { type: string }).type;
            if (eventType === 'step-finish') {
              console.log('[Step Debug] Step finished');
            } else {
              // Log other unhandled event types for debugging
              console.log('[Stream Debug] Unhandled event type:', eventType);
            }
            break;
          }
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Fetch complete token stats from Braintrust BTQL
      // This includes all nested LLM calls from tools (search, analyze_url, etc.)
      let braintrustStats = null;
      if (rootSpanId) {
        // Flush pending spans to Braintrust before querying
        await flush();
        braintrustStats = await fetchTraceStats(rootSpanId);
      }

      console.log('[Braintrust Stats]', {
        rootSpanId,
        stats: braintrustStats,
        executionTimeMs,
      });

      // Send usage stats - may be null if Braintrust is unavailable
      send({
        type: 'usage',
        usage: braintrustStats ? {
          promptTokens: braintrustStats.promptTokens,
          completionTokens: braintrustStats.completionTokens,
          cachedContentTokenCount: braintrustStats.cachedTokens,
          reasoningTokens: braintrustStats.reasoningTokens,
        } : null,
        executionTimeMs,
        agent: mode === 'codify-skill' ? 'skill' : 'task',
      });

      // Send raw stream parts for debugging
      send({ type: 'raw_payload', rawPayload: rawStreamParts });

      send({ type: 'done' });
    } catch (error) {
      // Extract meaningful error message from various error types
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for nested error details (common in AI SDK errors)
        const anyError = error as unknown as Record<string, unknown>;
        if (anyError.cause && typeof anyError.cause === 'object') {
          const cause = anyError.cause as Record<string, unknown>;
          if (cause.message) {
            errorMessage = `${error.message}: ${cause.message}`;
          }
        }
        // Check for response body in API errors
        if (anyError.responseBody) {
          errorMessage = `${error.message} - ${JSON.stringify(anyError.responseBody)}`;
        }
      }
      console.error('[Agent] Error during streaming:', error);
      send({
        type: 'error',
        content: errorMessage,
      });
    } finally {
      // Clean up sandbox if user aborted and sandbox was used (only in deployed env to save costs)
      // In local env, keep sandbox alive for faster iteration during development
      if (aborted && sandboxUsed && process.env.VERCEL === '1') {
        try {
          await clearSandboxExecutor();
          send({ type: 'sandbox_terminated', content: 'User aborted' });
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
    headers: SSE_HEADERS,
  });
}
