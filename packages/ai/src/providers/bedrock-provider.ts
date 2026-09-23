import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

import { AiError } from '../errors';
import type { CompletionRequest, CompletionResponse, LlmProvider } from '../types';
import { withTimeout } from '../util';

export interface BedrockOptions {
  region: string;
  modelId: string;
  /** Set true when calling through a VPC endpoint under a BAA. */
  isExternal?: boolean;
  client?: BedrockRuntimeClient;
}

/** AWS Bedrock via the Converse API (blueprint §16.2 "Claude on Bedrock"). Credentials come from the default AWS chain. */
export class BedrockProvider implements LlmProvider {
  readonly name = 'bedrock';
  readonly isExternal: boolean;
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly opts: BedrockOptions) {
    this.client = opts.client ?? new BedrockRuntimeClient({ region: opts.region });
    this.isExternal = opts.isExternal ?? true;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const cmd = new ConverseCommand({
      modelId: req.model || this.opts.modelId,
      system: [{ text: req.system }],
      messages: req.messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
      inferenceConfig: { temperature: req.temperature, maxTokens: req.maxTokens },
    });
    try {
      const res = await withTimeout(this.client.send(cmd), req.timeoutMs, () => new AiError('AI_TIMEOUT', 'Bedrock timed out'));
      const text = res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
      return {
        text,
        model: req.model || this.opts.modelId,
        inputTokens: res.usage?.inputTokens,
        outputTokens: res.usage?.outputTokens,
        refused: res.stopReason === 'content_filtered' || res.stopReason === 'guardrail_intervened',
        finishReason: res.stopReason,
      };
    } catch (e) {
      if (e instanceof AiError) throw e;
      throw new AiError('AI_PROVIDER_ERROR', (e as Error).message);
    }
  }
}
