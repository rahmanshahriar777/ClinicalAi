import type { NextFunction, Request, Response } from 'express';

import { requestContext } from './request-context';

export function requestContextMiddleware(req: Request & { id?: string }, _res: Response, next: NextFunction): void {
  requestContext.run(
    { requestId: req.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    () => next(),
  );
}
