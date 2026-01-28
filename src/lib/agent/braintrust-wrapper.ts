import * as ai from "ai";
import { initLogger, wrapAISDK } from "braintrust";

let initialized = false;
let wrappedAI: typeof ai | null = null;

function initBraintrust(): typeof ai {
  if (wrappedAI) return wrappedAI;

  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.PROJECT_NAME;

  if (!apiKey || !projectName) {
    const missing = [
      !apiKey && 'BRAINTRUST_API_KEY',
      !projectName && 'PROJECT_NAME',
    ].filter(Boolean).join(', ');

    console.warn(
      `[braintrust] Missing env vars: ${missing}. Observability tracing disabled.`
    );
    wrappedAI = ai; // Return unwrapped AI SDK
    return wrappedAI;
  }

  if (!initialized) {
    initLogger({ projectName, apiKey });
    initialized = true;
  }

  wrappedAI = wrapAISDK(ai) as typeof ai;
  return wrappedAI;
}

export function getWrappedAI() {
  return initBraintrust();
}

export function getAgent() {
  const sdk = initBraintrust();
  return (sdk as typeof ai & { Experimental_Agent?: unknown }).Experimental_Agent;
}

export function getGenerateText() {
  const sdk = initBraintrust();
  return sdk.generateText;
}

export function getStreamText() {
  const sdk = initBraintrust();
  return sdk.streamText;
}