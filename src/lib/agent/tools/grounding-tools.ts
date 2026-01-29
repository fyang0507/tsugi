import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { getFlashModel } from '../model-provider';
import { getStreamText } from '../braintrust-wrapper';
import { emitToolProgress } from '../request-context';

/**
 * Wrapped Google Search tool that makes a nested API call.
 * This works around the Gemini limitation where native grounding tools
 * and custom tools cannot coexist in the same agent.
 */
export const searchTool = {
  description: `Search the web for ONE topic. RESEARCH tool for learning approaches, not for data fetching.

RULES:
- ONE query = ONE topic. For multiple topics, make separate calls.
- Use to learn HOW to do something, then implement programmatically.
- Never use as a data-fetching mechanism for repetitive lookups.`,
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async (
    { query }: { query: string },
    { abortSignal }: { abortSignal?: AbortSignal }
  ): Promise<string> => {
    const streamText = getStreamText();
    try {
      const result = streamText({
        model: getFlashModel(),
        tools: { googleSearch: google.tools.googleSearch({}) },
        prompt: `Search the web for: "${query}". Return a concise list of summary of relevant results with the most specific urls. Focus on breadth of information.`,
        abortSignal,
        onAbort: () => {
          console.log('[Search] Aborted');
          emitToolProgress('search', { status: 'complete', text: 'Search interrupted' });
        },
        onFinish: () => {
          console.log('[Search] Completed');
        },
      });

      // Stream deltas to frontend for real-time updates
      let accumulated = '';
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        emitToolProgress('search', { status: 'streaming', delta: chunk });
      }

      emitToolProgress('search', { status: 'complete', text: accumulated });
      return accumulated || 'No results found.';
    } catch (error) {
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Wrapped URL Context tool that makes a nested API call.
 * This works around the Gemini limitation where native grounding tools
 * and custom tools cannot coexist in the same agent.
 */
export const analyzeUrlTool = {
  description: `Analyze a URL and understand its content (multimedia accepted). Appropriate uses: reading documentation, analyzing video/media content. For YouTube/video content specifically, this IS the execution method since video details can only be accessed this way.`,
  inputSchema: z.object({
    url: z.string().describe('The URL to analyze'),
  }),
  execute: async (
    { url }: { url: string },
    { abortSignal }: { abortSignal?: AbortSignal }
  ): Promise<string> => {
    const streamText = getStreamText();
    try {
      const result = streamText({
        model: getFlashModel(),
        tools: { urlContext: google.tools.urlContext({}) },
        prompt: `Analyze this URL: ${url}`,
        abortSignal,
        onAbort: () => {
          console.log('[AnalyzeUrl] Aborted');
          emitToolProgress('analyze_url', { status: 'complete', text: 'URL analysis interrupted' });
        },
        onFinish: () => {
          console.log('[AnalyzeUrl] Completed');
        },
      });

      // Stream deltas to frontend for real-time updates
      let accumulated = '';
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        emitToolProgress('analyze_url', { status: 'streaming', delta: chunk });
      }

      emitToolProgress('analyze_url', { status: 'complete', text: accumulated });
      return accumulated || 'Unable to extract content.';
    } catch (error) {
      return `URL analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};
