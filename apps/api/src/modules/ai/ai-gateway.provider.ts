import {
  AiGateway,
  AzureOpenAiProvider,
  BedrockProvider,
  type LlmProvider,
  MockProvider,
  ModelRouter,
  OpenAiCompatibleProvider,
  type PhiRedactor,
  PresidioPhiRedactor,
  RulesPhiRedactor,
} from '@app/ai';
import { Logger } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

type ProviderName = Exclude<Env['AI_PROVIDER'] | Env['AI_FALLBACK_PROVIDER'], ''>;

export function buildProvider(name: ProviderName, env: Env): LlmProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    case 'azure-openai':
      return new AzureOpenAiProvider({ endpoint: env.AZURE_OPENAI_ENDPOINT!, apiKey: env.AZURE_OPENAI_API_KEY!, deployment: env.AZURE_OPENAI_DEPLOYMENT!, apiVersion: env.AZURE_OPENAI_API_VERSION });
    case 'bedrock':
      return new BedrockProvider({ region: env.AWS_REGION, modelId: env.BEDROCK_MODEL_ID! });
    case 'openai-compatible':
      return new OpenAiCompatibleProvider({ baseUrl: env.OPENAI_COMPATIBLE_BASE_URL!, apiKey: env.OPENAI_COMPATIBLE_API_KEY, model: env.OPENAI_COMPATIBLE_MODEL! });
  }
}

export function buildRedactor(env: Env): PhiRedactor {
  return env.PHI_REDACTOR === 'presidio' ? new PresidioPhiRedactor(env.PRESIDIO_ANALYZER_URL!, env.PRESIDIO_ANONYMIZER_URL!) : new RulesPhiRedactor();
}

/** Nest provider that assembles the framework-agnostic AiGateway from the environment. */
export const aiGatewayProvider = {
  provide: AI_GATEWAY,
  inject: [ENV],
  useFactory: (env: Env): AiGateway => {
    const logger = new Logger('AiGateway');
    const primary = buildProvider(env.AI_PROVIDER, env);
    const fallback = env.AI_FALLBACK_PROVIDER && env.AI_FALLBACK_PROVIDER !== env.AI_PROVIDER ? buildProvider(env.AI_FALLBACK_PROVIDER, env) : undefined;
    const router = new ModelRouter({
      primary,
      fallback,
      models: { primary: env.AI_PROVIDER === 'openai-compatible' ? env.OPENAI_COMPATIBLE_MODEL! : env.AI_PROVIDER === 'bedrock' ? env.BEDROCK_MODEL_ID! : env.AI_MODEL_PRIMARY, light: env.AI_PROVIDER === 'openai-compatible' ? env.OPENAI_COMPATIBLE_MODEL! : env.AI_PROVIDER === 'bedrock' ? env.BEDROCK_MODEL_ID! : env.AI_MODEL_LIGHT },
    });
    return new AiGateway({
      router,
      redactor: buildRedactor(env),
      defaults: { temperature: env.AI_TEMPERATURE, maxTokens: env.AI_MAX_TOKENS, timeoutMs: env.AI_TIMEOUT_MS, maxRetries: env.AI_MAX_RETRIES },
      pricing: { 'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 }, 'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 } },
      logger: { info: (o, m) => logger.log({ ...o, msg: m }), warn: (o, m) => logger.warn({ ...o, msg: m }) },
    });
  },
};
