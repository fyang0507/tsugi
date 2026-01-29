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

  // Track abort state for sandbox cleanup
  let aborted = false;
  let sandboxUsed = false;
  let sandboxIdEmitted = false;
  let currentSandboxId: string | undefined = requestSandboxId || undefined;

  // Listen for client abort (when user stops the agent)
  req.signal.addEventListener('abort', () => {
    aborted = true;
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Wrap with request context so skill agent's tool can access conversationId/sandboxId/env
      // Also pass writer so nested tools can emit progress updates
      await runWithRequestContext({ conversationId, sandboxId: currentSandboxId, env: mergedEnv, streamWriter: writer }, async () => {
        try {
          // Create agent per-request INSIDE request context so it picks up user-provided API key
          let agent;
          let messages: UIMessage[];

          if (mode === 'codify-skill') {
            agent = createSkillAgent();
            // Use conversation history if provided (follow-up messages), otherwise trigger with 'Start'
            messages = initialMessages.length > 0 ? [...initialMessages] : [{
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text: 'Start' }],
            } as UIMessage];
          } else {
            agent = createTaskAgent();
            messages = [...initialMessages];
          }

          const startTime = Date.now();

          // Convert UIMessages to ModelMessages using AI SDK's converter
          const modelMessages = await convertToModelMessages(messages);

          // Wrap agent execution with Braintrust tracing to capture root span ID
          let rootSpanId: string | undefined;

          const result = await traced(
            async (span) => {
              const spanAny = span as unknown as Record<string, unknown>;
              rootSpanId = (spanAny._rootSpanId as string) ?? span.id;
              return agent.stream({ messages: modelMessages, abortSignal: req.signal });
            },
            { name: `${mode === 'codify-skill' ? 'skill' : 'task'}-agent-${conversationId || 'anonymous'}` }
          );

          // Stream UI message chunks, tracking sandbox usage from tool calls
          const uiStream = result.toUIMessageStream();
          for await (const chunk of uiStream) {
            if (aborted) break;

            // Track sandbox usage from tool calls
            // When a shell command (non-skill) is detected, eagerly initialize the sandbox
            // and emit its ID to the client before the command runs
            if (chunk.type === 'tool-input-available' && chunk.toolName === 'shell') {
              const input = chunk.input as { command?: string } | undefined;
              const command = input?.command;
              if (command && !command.startsWith('skill ')) {
                sandboxUsed = true;

                // Eagerly initialize sandbox and emit ID on first shell command
                if (!sandboxIdEmitted) {
                  const newSandboxId = await executor.initialize();
                  if (newSandboxId !== requestSandboxId) {
                    currentSandboxId = newSandboxId;
                    writer.write({
                      type: 'data-sandbox',
                      data: { status: 'sandbox_created', sandboxId: newSandboxId },
                      transient: true,
                    });
                  }
                  sandboxIdEmitted = true;
                }
              }
            }

            // Forward all chunks to the stream
            writer.write(chunk);
          }

          const executionTimeMs = Date.now() - startTime;

          // Fetch complete token stats from Braintrust BTQL
          let braintrustStats = null;
          if (rootSpanId) {
            await flush();
            braintrustStats = await fetchTraceStats(rootSpanId);
          }

          console.log('[Braintrust Stats]', {
            rootSpanId,
            stats: braintrustStats,
            executionTimeMs,
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
    onFinish: async ({ isAborted }) => {
      if (isAborted) {
        console.log('[Agent] Stream aborted by user');
      } else {
        console.log('[Agent] Stream completed normally');
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
