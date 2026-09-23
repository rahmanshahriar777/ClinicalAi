import type { IncomingMessage } from 'node:http';

import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { loadEnv } from '../../config/env';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.refreshToken',
  'req.body.mfaToken',
  'req.body.code',
  'res.headers["set-cookie"]',
];

/**
 * Structured JSON logging (pino) with PHI-safe defaults: request bodies are
 * never logged, secrets are redacted, and every line carries the request id.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: loadEnv().LOG_LEVEL,
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
        genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string) ?? '',
        customProps: (req: IncomingMessage & { user?: { id: string; role: string } }) => ({
          userId: req.user?.id,
          role: req.user?.role,
        }),
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        autoLogging: { ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/health') },
        transport: loadEnv().NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      },
    }),
  ],
})
export class LoggerModule {}
