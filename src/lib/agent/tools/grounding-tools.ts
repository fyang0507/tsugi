import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { getFlashModel } from '../model-provider';
import { getGenerateText } from '../braintrust-wrapper';

/**
 * Wrapped Google Search tool that makes a nested API call.
 * This works around the Gemini limitation where native grounding tools
 * and custom tools cannot coexist in the same agent.
 */
export const searchTool = {
  description: `Search the web. Appropriate uses: get specific piece of information, research HOW to accomplish tasks programmatically. NEVER use search as a data-fetching mechanism for repetitive lookups.`,
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }: { query: string }): Promise<string> => {
    const generateText = getGenerateText();
    try {
      const result = await generateText({
        model: getFlashModel(),
        tools: { googleSearch: google.tools.googleSearch({}) },
        prompt: `Search the web for: "${query}". Return a concise list of summary of relevant results with the most specific urls. Focus on breadth of information.`,
      });
      return result.text || 'No results found.';
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
  execute: async ({ url }: { url: string }): Promise<string> => {
    const generateText = getGenerateText();
    try {
      const result = await generateText({
        model: getFlashModel(),
        tools: { urlContext: google.tools.urlContext({}) },
        prompt: `Analyze this URL: ${url}`,
      });
      return result.text || 'Unable to extract content.';
    } catch (error) {
      return `URL analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};
