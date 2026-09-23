import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

/**
 * Ensures every request carries an `x-request-id` (accepted from trusted
 * upstream proxies, generated otherwise) and echoes it to the client so
 * support staff can correlate logs, audit rows and error envelopes.
 */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && /^[A-Za-z0-9-_.]{8,128}$/.test(incoming) ? incoming : randomUUID();
  req.id = id;
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
