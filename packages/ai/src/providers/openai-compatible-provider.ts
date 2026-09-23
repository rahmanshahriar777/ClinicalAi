import type { CompletionRequest, CompletionResponse, LlmProvider } from '../types';

import { fetchJson } from './http';

interface ChatResponse {
  model?: string;
  choices: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Mark true if the endpoint is outside your trust boundary. Defaults to false (private/self-hosted). */
  isExternal?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Provider for any OpenAI-compatible endpoint: vLLM, Ollama, TGI, or a
 * private gateway (blueprint §11.5 Path B "private/self-hosted model").
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai-compatible';
  readonly isExternal: boolean;

  constructor(private readonly opts: OpenAiCompatibleOptions) {
    if (!opts.baseUrl || !opts.model) throw new Error('OpenAiCompatibleProvider requires baseUrl and model');
    this.isExternal = opts.isExternal ?? false;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`;
    const body = {
      model: req.model || this.opts.model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
    const data = await fetchJson<ChatResponse>(url, { method: 'POST', headers, body: JSON.stringify(body), timeoutMs: req.timeoutMs }, this.opts.fetchImpl);
    const choice = data.choices[0];
    return {
      text: choice?.message?.content ?? '',
      model: data.model ?? this.opts.model,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      finishReason: choice?.finish_reason,
    };
  }
}
