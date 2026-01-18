import { google as defaultGoogle, createGoogleGenerativeAI } from '@ai-sdk/google';
import type { GoogleGenerativeAIProvider } from '@ai-sdk/google';

const MODEL_NAMES = {
  pro: 'gemini-3-pro-preview',
  flash: 'gemini-3-flash',
} as const;

type ProviderMode = 'direct' | 'gateway';

interface ProviderConfig {
  provider: GoogleGenerativeAIProvider;
  mode: ProviderMode;
}

let cachedConfig: ProviderConfig | null = null;

function getConfig(): ProviderConfig {
  if (cachedConfig) return cachedConfig;

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    cachedConfig = {
      provider: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY }),
      mode: 'direct',
    };
    return cachedConfig;
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    cachedConfig = {
      provider: defaultGoogle,
      mode: 'gateway',
    };
    return cachedConfig;
  }

  throw new Error(
    'No AI provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY.'
  );
}

export function getGoogleProvider(): GoogleGenerativeAIProvider {
  return getConfig().provider;
}

export function getProModel() {
  const { provider, mode } = getConfig();
  // Gateway uses string model IDs, direct uses instantiated models
  return mode === 'gateway' ? `google/${MODEL_NAMES.pro}` : provider(MODEL_NAMES.pro);
}

export function getFlashModel() {
  const { provider, mode } = getConfig();
  return mode === 'gateway' ? `google/${MODEL_NAMES.flash}` : provider(MODEL_NAMES.flash);
}
