import { createTaskAgent } from '@/lib/agent/task-agent';
import { createSkillAgent } from '@/lib/agent/skill-agent';
import { clearSandboxExecutor, getSandboxExecutor } from '@/lib/sandbox/executor';
import { mergePlaygroundEnv } from '@/lib/tools/playground-env';
import { runWithRequestContext } from '@/lib/agent/request-context';
import { traced, flush } from 'braintrust';
import { fetchTraceStats } from '@/lib/braintrust-api';
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages, type UIMessage } from 'ai';

type AgentMode = 'task' | 'codify-skill';

export async function POST(req: Request) {
  const { messages: initialMessages, mode = 'task', conversationId, env: uiEnv, sandboxId: requestSandboxId } = await req.json() as {
    messages: UIMessage[];
    mode?: AgentMode;
    conversationId?: string;
    env?: Record<string, string>;
    sandboxId?: string;
  };

  // Sandbox lifecycle:
  // - If sandboxId provided: reconnect to existing sandbox (continuing conversation)
  // - If no sandboxId: create fresh sandbox for new conversation
  // forceNew=true ensures we don't reuse a stale cached executor from a previous conversation
  const isNewConversation = !requestSandboxId;
  const executor = await getSandboxExecutor(requestSandboxId, isNewConversation);

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

  // Initialize sandbox upfront for new task conversations
  // This allows us to pass the sandbox ID in headers before streaming starts
  let currentSandboxId: string | undefined = requestSandboxId || undefined;
  if (mode === 'task' && isNewConversation) {
    currentSandboxId = await executor.initialize();
  }

  // Track abort state for sandbox cleanup
  let aborted = false;
  let sandboxUsed = false;

  // Create local AbortController to explicitly propagate abort to agent
  // req.signal only fires when client disconnects; we need to actively abort the agent
  const agentAbortController = new AbortController();

  // Listen for client abort (when user stops the agent)
  req.signal.addEventListener('abort', () => {
    aborted = true;
    agentAbortController.abort(); // Explicitly abort agent execution
  });

  // Prepare messages for the agent
  let messages: UIMessage[];
  if (mode === 'codify-skill') {
    // Filter to only include skill agent messages (exclude task agent history)
    // This prevents the skill agent from being confused by task agent's tool calls
    const skillMessages = initialMessages.filter(
      (m) => (m as UIMessage & { metadata?: { agent?: string } }).metadata?.agent === 'skill'
    );
    // Use skill agent history if available, otherwise start fresh with 'Start'
    // The skill agent will call get_processed_transcript to fetch task history from DB
    messages = skillMessages.length > 0 ? skillMessages : [{
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Start' }],
    } as UIMessage];
  } else {
    messages = [...initialMessages];
  }

  // Build response headers with sandbox ID for new conversations
  const responseHeaders: HeadersInit = {};
  if (currentSandboxId && currentSandboxId !== requestSandboxId) {
    responseHeaders['X-Sandbox-Id'] = currentSandboxId;
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Wrap with request context so tools can access conversationId/sandboxId/env
      await runWithRequestContext({ conversationId, sandboxId: currentSandboxId, env: mergedEnv }, async () => {
        try {
          // Create agent per-request INSIDE request context so it picks up user-provided API key
          const agent = mode === 'codify-skill' ? createSkillAgent() : createTaskAgent();

          const startTime = Date.now();

          // Convert UIMessages to ModelMessages using AI SDK's converter
          const modelMessages = await convertToModelMessages(messages);

          // Wrap agent execution with Braintrust tracing to capture root span ID for stats
          let rootSpanId: string | undefined;

          const result = await traced(
            async (span) => {
              const spanAny = span as unknown as Record<string, unknown>;
              rootSpanId = (spanAny._rootSpanId as string) ?? span.id;
              return agent.stream({ messages: modelMessages, abortSignal: agentAbortController.signal });
            },
            { name: `${mode === 'codify-skill' ? 'skill' : 'task'}-agent-${conversationId || 'anonymous'}` }
          );

          // Heartbeat to detect client disconnect (req.signal is unreliable in Next.js streaming)
          // Periodically write a transient data message; if it fails, client has disconnected
          const heartbeatInterval = setInterval(() => {
            try {
              // Use transient data message (won't be persisted, but detects closed connection)
              writer.write({ type: 'data-heartbeat', data: {}, transient: true });
            } catch {
              console.log('[Agent] Heartbeat failed, client disconnected');
              aborted = true;
              agentAbortController.abort();
              clearInterval(heartbeatInterval);
            }
          }, 500); // Check every 500ms

          try {
            // Stream UI message chunks, tracking sandbox usage from tool calls
            const uiStream = result.toUIMessageStream();
            for await (const chunk of uiStream) {
              if (aborted) break;

              // Track sandbox usage from tool calls (for cleanup on abort)
              if (chunk.type === 'tool-input-available' && chunk.toolName === 'shell') {
                const input = chunk.input as { command?: string } | undefined;
                const command = input?.command;
                if (command && !command.startsWith('skill ')) {
                  sandboxUsed = true;
                }
              }

              // Forward all chunks to the stream
              writer.write(chunk);
            }
          } finally {
            clearInterval(heartbeatInterval);
          }

          const executionTimeMs = Date.now() - startTime;

          // Flush Braintrust spans (don't block on stats - client will poll)
          let braintrustStats = null;
          if (!aborted && rootSpanId) {
            await flush();
            // Attempt a quick fetch - if stats aren't ready, client will poll
            braintrustStats = await fetchTraceStats(rootSpanId);
          }

          // Determine status for eventual consistency
          let usageStatus: 'resolved' | 'pending' | 'unavailable';
          if (!rootSpanId || !process.env.BRAINTRUST_API_KEY) {
            usageStatus = 'unavailable';
          } else if (braintrustStats) {
            usageStatus = 'resolved';
          } else {
            usageStatus = 'pending';  // Stats not yet available, client should poll
          }

          console.log('[Braintrust Stats]', {
            rootSpanId,
            stats: braintrustStats,
            status: usageStatus,
            executionTimeMs,
            aborted,
          });

          // Send usage stats as persistent data (will be part of message)
          writer.write({
            type: 'data-usage',
            data: {
              usage: braintrustStats ? {
                promptTokens: braintrustStats.promptTokens,
                completionTokens: braintrustStats.completionTokens,
                cachedContentTokenCount: braintrustStats.cachedTokens,
                reasoningTokens: braintrustStats.reasoningTokens,
              } : null,
              executionTimeMs,
              agent: mode === 'codify-skill' ? 'skill' : 'task',
              rootSpanId,           // Include for potential polling
              status: usageStatus,  // Explicit status for client
            },
          });

        } catch (error) {
          // Extract meaningful error message from various error types
          let errorMessage = 'Unknown error';
          if (error instanceof Error) {
            errorMessage = error.message;
            const anyError = error as unknown as Record<string, unknown>;
            if (anyError.cause && typeof anyError.cause === 'object') {
              const cause = anyError.cause as Record<string, unknown>;
              if (cause.message) {
                errorMessage = `${error.message}: ${cause.message}`;
              }
            }
            if (anyError.responseBody) {
              errorMessage = `${error.message} - ${JSON.stringify(anyError.responseBody)}`;
            }
          }
          console.error('[Agent] Error during streaming:', error);
          writer.write({ type: 'error', errorText: errorMessage });
        } finally {
          // Clean up sandbox if user aborted and sandbox was used (only in deployed env to save costs)
          if (aborted && sandboxUsed && process.env.VERCEL === '1') {
            try {
              await clearSandboxExecutor();
              writer.write({
                type: 'data-sandbox',
                data: { status: 'sandbox_terminated', reason: 'User aborted' },
                transient: true,
              });
              console.log('[Agent] Sandbox cleaned up after abort');
            } catch (cleanupError) {
              console.error('[Agent] Failed to cleanup sandbox:', cleanupError);
            }
          }
        }
      });
    },
    onError: (error) => {
      console.error('[Agent] Stream error:', error);
      return error instanceof Error ? error.message : 'Unknown error';
    },
  });

  return createUIMessageStreamResponse({ stream, headers: responseHeaders });
}
