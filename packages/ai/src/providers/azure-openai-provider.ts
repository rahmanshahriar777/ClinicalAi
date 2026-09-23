import type { CompletionRequest, CompletionResponse, LlmProvider } from '../types';

import { fetchJson } from './http';

interface AzureChatResponse {
  model?: string;
  choices: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface AzureOpenAiOptions {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

/** Azure OpenAI chat completions (blueprint §16.2). External unless deployed inside a private VNet with a BAA. */
export class AzureOpenAiProvider implements LlmProvider {
  readonly name = 'azure-openai';
  readonly isExternal = true;

  constructor(private readonly opts: AzureOpenAiOptions) {
    if (!opts.endpoint || !opts.apiKey || !opts.deployment) {
      throw new Error('AzureOpenAiProvider requires endpoint, apiKey and deployment');
    }
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.opts.endpoint.replace(/\/$/, '')}/openai/deployments/${this.opts.deployment}/chat/completions?api-version=${this.opts.apiVersion ?? '2024-10-21'}`;
    const body = {
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
    const data = await fetchJson<AzureChatResponse>(
      url,
      { method: 'POST', headers: { 'content-type': 'application/json', 'api-key': this.opts.apiKey }, body: JSON.stringify(body), timeoutMs: req.timeoutMs },
      this.opts.fetchImpl,
    );
    const choice = data.choices[0];
    const refused = Boolean(choice?.message?.refusal) || choice?.finish_reason === 'content_filter';
    return {
      text: choice?.message?.content ?? '',
      model: data.model ?? this.opts.deployment,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      refused,
      finishReason: choice?.finish_reason,
    };
  }
}
