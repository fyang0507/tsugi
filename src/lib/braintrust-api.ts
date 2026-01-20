/**
 * Braintrust BTQL API Client
 *
 * Fetches aggregated token stats from Braintrust by querying all spans
 * within a trace using the root_span_id.
 */

export interface TraceStats {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
}

interface BTQLResponse {
  data?: Array<{
    prompt_tokens: number;
    completion_tokens: number;
    cached_tokens: number;
    reasoning_tokens: number;
  }>;
}

interface ProjectResponse {
  objects?: Array<{ id: string; name: string }>;
}

// Cache project ID to avoid repeated lookups
let cachedProjectId: string | null = null;

/**
 * Resolves project name to project ID using Braintrust REST API.
 * BTQL requires project ID (UUID), not project name.
 */
async function getProjectId(apiKey: string, projectName: string): Promise<string | null> {
  if (cachedProjectId) return cachedProjectId;

  try {
    const response = await fetch('https://api.braintrust.dev/v1/project', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.error('[Braintrust] Failed to fetch projects:', response.status);
      return null;
    }

    const result: ProjectResponse = await response.json();
    const project = result.objects?.find(p => p.name === projectName);

    if (!project) {
      console.error('[Braintrust] Project not found:', projectName);
      return null;
    }

    cachedProjectId = project.id;
    return cachedProjectId;
  } catch (error) {
    console.error('[Braintrust] Failed to resolve project ID:', error);
    return null;
  }
}

/**
 * Fetches aggregated token stats for a trace from Braintrust BTQL API.
 *
 * @param rootSpanId - The root span ID to query stats for
 * @returns TraceStats if successful, null if Braintrust is unavailable
 */
export async function fetchTraceStats(rootSpanId: string): Promise<TraceStats | null> {
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.PROJECT_NAME;

  if (!apiKey || !projectName) {
    console.warn('[Braintrust] Missing API key or project name, cannot fetch stats');
    return null;
  }

  // Resolve project name to ID (BTQL requires UUID, not name)
  const projectId = await getProjectId(apiKey, projectName);
  if (!projectId) {
    return null;
  }

  try {
    // BTQL query to get metrics from the top-level agent span
    // Query all spans in the trace and find the one with highest token count
    // (the root agent span aggregates metrics from all children)
    const query = `
      SELECT
        COALESCE(metrics.prompt_tokens, 0) as prompt_tokens,
        COALESCE(metrics.completion_tokens, 0) as completion_tokens,
        COALESCE(metrics.prompt_cached_tokens, 0) as cached_tokens,
        COALESCE(metrics.completion_reasoning_tokens, 0) as reasoning_tokens
      FROM project_logs('${projectId}', shape => 'spans')
      WHERE root_span_id = '${rootSpanId}'
      ORDER BY (COALESCE(metrics.prompt_tokens, 0) + COALESCE(metrics.completion_tokens, 0)) DESC
      LIMIT 1
    `;

    const response = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, fmt: 'json' }),
    });

    if (!response.ok) {
      console.error('[Braintrust] BTQL query failed:', response.status, await response.text());
      return null;
    }

    const result: BTQLResponse = await response.json();

    if (!result.data || result.data.length === 0) {
      console.warn('[Braintrust] No data returned for rootSpanId:', rootSpanId);
      return null;
    }

    const row = result.data[0];
    return {
      promptTokens: row.prompt_tokens ?? 0,
      completionTokens: row.completion_tokens ?? 0,
      cachedTokens: row.cached_tokens ?? 0,
      reasoningTokens: row.reasoning_tokens ?? 0,
    };
  } catch (error) {
    console.error('[Braintrust] Failed to fetch stats:', error);
    return null;
  }
}
