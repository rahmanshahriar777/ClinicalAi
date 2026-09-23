import 'reflect-metadata';

import { loadEnv } from './config/env';
import { initTelemetry } from './infra/telemetry/telemetry';

/**
 * API entry point. Telemetry is initialised before Nest so auto-instrumentation
 * can patch http/pg/redis. Security headers, CORS, body limits and Swagger are
 * configured here; everything else lives in AppModule.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const shutdownTelemetry = await initTelemetry();

  const { NestFactory } = await import('@nestjs/core');
  const { Logger: PinoLogger } = await import('nestjs-pino');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const helmet = (await import('helmet')).default;
  const { json, urlencoded } = await import('express');
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();

  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, exposedHeaders: ['x-request-id'], maxAge: 600 });
  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false, crossOriginEmbedderPolicy: false }));
  app.use(json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Clinical AI Platform API')
      .setDescription('AI-Powered Clinical Documentation & Patient Communication Engine — REST API. All AI outputs are drafts pending human review.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), { swaggerOptions: { persistAuthorization: true } });
  }

  await app.listen(env.API_PORT);
  app.get(PinoLogger).log(`API listening on :${env.API_PORT} (auth=${env.AUTH_MODE}, ai=${env.AI_PROVIDER}, jobs=${env.JOBS_INLINE ? 'inline' : 'queue'})`);

  const stop = async (signal: string): Promise<void> => {
    app.get(PinoLogger).log(`${signal} received, shutting down`);
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop('SIGTERM'));
  process.once('SIGINT', () => void stop('SIGINT'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
