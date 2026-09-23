import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId?: string;
  userId?: string;
  role?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Per-request context propagated via AsyncLocalStorage so deep services
 * (audit, jobs) can attach actor/request metadata without parameter drilling.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContext.getStore() ?? {};
}
