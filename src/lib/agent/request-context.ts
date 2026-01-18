import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  conversationId?: string;
  sandboxId?: string;
  env?: Record<string, string>;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return asyncLocalStorage.run(context, fn);
}

export function getRequestContext(): RequestContext {
  return asyncLocalStorage.getStore() ?? {};
}
