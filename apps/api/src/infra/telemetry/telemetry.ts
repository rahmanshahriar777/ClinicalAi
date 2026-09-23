import { loadEnv } from '../../config/env';

/**
 * OpenTelemetry + Sentry bootstrap. Must run before Nest is imported so
 * auto-instrumentation can patch http/express/pg/ioredis. Both are opt-in
 * and never send request bodies (PHI) — only spans, timings and error
 * stack traces with scrubbed data.
 */
export async function initTelemetry(): Promise<() => Promise<void>> {
  const env = loadEnv();
  const shutdowns: Array<() => Promise<void>> = [];

  if (env.SENTRY_DSN) {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1,
      beforeSend(event) {
        // Strip request bodies and headers that could contain PHI or secrets.
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          if (event.request.headers) delete event.request.headers.authorization;
        }
        return event;
      },
    });
    shutdowns.push(async () => {
      await Sentry.close(2000);
    });
  }

  if (env.OTEL_ENABLED) {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { Resource } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
    const sdk = new NodeSDK({
      resource: new Resource({ [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME }),
      traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT ? `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` : undefined }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/health') },
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });
    sdk.start();
    shutdowns.push(() => sdk.shutdown());
  }

  return async () => {
    for (const s of shutdowns) await s();
  };
}
