import { AI_OUTPUT_SCHEMAS, type AiWorkflow } from '@app/shared';
import type { ZodTypeAny } from 'zod';

import { AiError, AiOutputInvalidError } from './errors';
import { renderTemplate } from './prompts/render';
import { rehydrate, type PhiRedactor, RulesPhiRedactor } from './redaction';
import type { ModelRouter } from './router';
import { sanitizeUntrusted, wrapUntrusted } from './safety/injection';
import { runSafetyChecks } from './safety/output-validator';
import { detectRedFlags } from './safety/red-flags';
import type { AiGenerateRequest, AiGenerateResult, CompletionResponse, LlmProvider, RedFlagMatch } from './types';
import { extractJson, mapStrings, sha256 } from './util';

export interface AiGatewayOptions {
  router: ModelRouter;
  redactor?: PhiRedactor;
  defaults?: { temperature?: number; maxTokens?: number; timeoutMs?: number; maxRetries?: number };
  /** Optional cost table: model → USD per 1k input / output tokens. */
  pricing?: Record<string, { inputPer1k: number; outputPer1k: number }>;
  logger?: { info: (o: object, msg?: string) => void; warn: (o: object, msg?: string) => void };
}

/**
 * AI Gateway (blueprint §13.1). Implements pipeline stages 4–10:
 * context is supplied by the caller (stage 4), then:
 *   5  PHI redaction + injection sanitising
 *   6  prompt rendering
 *   7  model routing (policy gate)
 *   8  provider call (timeout, retry, fallback)
 *   9  output parsing
 *  10  schema validation + clinical safety checks
 * Stages 1–3 (permission, consent, feature checks) and 11–13 (storage,
 * audit, review queue) are the API's responsibility.
 */
export class AiGateway {
  private readonly redactor: PhiRedactor;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly opts: AiGatewayOptions) {
    this.redactor = opts.redactor ?? new RulesPhiRedactor();
    this.temperature = opts.defaults?.temperature ?? 0.2;
    this.maxTokens = opts.defaults?.maxTokens ?? 2048;
    this.timeoutMs = opts.defaults?.timeoutMs ?? 45_000;
    this.maxRetries = opts.defaults?.maxRetries ?? 1;
  }

  async generate<W extends AiWorkflow>(req: AiGenerateRequest & { workflow: W }): Promise<AiGenerateResult<ReturnType<(typeof AI_OUTPUT_SCHEMAS)[W]['parse']>>> {
    const started = Date.now();
    const schema: ZodTypeAny = AI_OUTPUT_SCHEMAS[req.workflow];
    if (req.prompt.workflow !== req.workflow) {
      throw new AiError('AI_CONFIG_ERROR', `Prompt ${req.prompt.name} is for ${req.prompt.workflow}, not ${req.workflow}`);
    }

    // --- Stage 7 (early): route first so policy blocks before any PHI processing.
    const route = this.opts.router.route(req.workflow, { externalAiAllowed: req.policy.externalAiAllowed, tier: req.policy.modelTier });

    // --- Stage 5: sanitise untrusted variables; detect red flags on raw patient input.
    const variables: Record<string, string> = { ...req.variables };
    const injectionSignals = new Set<string>();
    const redFlags: RedFlagMatch[] = [];
    for (const key of req.untrustedVariables ?? []) {
      const raw = variables[key];
      if (!raw) continue;
      const rf = detectRedFlags(raw);
      redFlags.push(...rf.flags);
      const s = sanitizeUntrusted(raw);
      s.signals.forEach((sig) => injectionSignals.add(sig));
      if (s.truncated) injectionSignals.add('input_truncated');
      variables[key] = wrapUntrusted(s.text);
    }

    // --- Stage 5: PHI redaction (always when the provider is external and redaction is enabled).
    const mapping: Record<string, string> = {};
    let redaction = { applied: false, entityCount: 0, labels: [] as string[] };
    const shouldRedact = req.policy.phiRedactionEnabled && (route.provider.isExternal || req.policy.phiRedactionEnabled);
    if (shouldRedact) {
      const combined = Object.entries(variables);
      const merged: Record<string, string> = {};
      const labels = new Set<string>();
      let entityCount = 0;
      for (const [k, v] of combined) {
        const r = await this.redactor.redact(v, req.knownPhi);
        merged[k] = r.text;
        Object.assign(mapping, r.mapping);
        r.labels.forEach((l) => labels.add(l));
        entityCount += r.entityCount;
      }
      Object.assign(variables, merged);
      redaction = { applied: true, entityCount: Object.keys(mapping).length || entityCount, labels: [...labels] };
    }

    // --- Stage 6: render prompt.
    const system = req.prompt.systemPrompt;
    const user = renderTemplate(req.prompt.userTemplate, variables);
    const inputHash = sha256(`${req.prompt.name}@${req.prompt.version}\n${system}\n${user}`);

    // --- Stage 8–10: call, parse, validate; retry with repair; fallback provider on provider error.
    let provider: LlmProvider = route.provider;
    let attempts = 0;
    let lastError: unknown;
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: user }];
    let usage = { inputTokens: 0, outputTokens: 0 };
    let response: CompletionResponse | undefined;

    while (attempts <= this.maxRetries) {
      attempts++;
      try {
        response = await provider.complete({
          workflow: req.workflow,
          model: route.model,
          system,
          messages,
          temperature: req.policy.temperature ?? this.temperature,
          maxTokens: req.policy.maxTokens ?? this.maxTokens,
          jsonMode: true,
          timeoutMs: this.timeoutMs,
        });
        usage = { inputTokens: usage.inputTokens + (response.inputTokens ?? 0), outputTokens: usage.outputTokens + (response.outputTokens ?? 0) };
        if (response.refused) throw new AiError('AI_REFUSED', 'Provider refused the request', { finishReason: response.finishReason });

        const parsed = schema.safeParse(JSON.parse(extractJson(response.text)));
        if (parsed.success) {
          const rehydrated = redaction.applied ? mapStrings(parsed.data, (s) => rehydrate(s, mapping)) : parsed.data;
          const safety = runSafetyChecks(req.workflow, rehydrated);
          const confidence = typeof (rehydrated as { confidence?: unknown }).confidence === 'number' ? (rehydrated as { confidence: number }).confidence : null;
          const latencyMs = Date.now() - started;
          this.opts.logger?.info({ workflow: req.workflow, provider: provider.name, model: response.model, attempts, latencyMs, redaction, injectionSignals: [...injectionSignals] }, 'ai.generate.ok');
          return {
            output: rehydrated,
            rawText: response.text,
            provider: provider.name,
            model: response.model,
            promptName: req.prompt.name,
            promptVersion: req.prompt.version,
            inputHash,
            confidence,
            safetyFlags: safety.flags,
            redFlags,
            redaction,
            injectionSignals: [...injectionSignals],
            usage: { ...usage, costEstimate: this.estimateCost(response.model, usage) },
            latencyMs,
            attempts,
          };
        }
        lastError = new AiOutputInvalidError('Model output failed schema validation', parsed.error.flatten());
        // Ask the model to repair its output (one round-trip, same provider).
        messages.push({ role: 'assistant', content: response.text });
        messages.push({ role: 'user', content: `Your previous output was not valid. Errors: ${JSON.stringify(parsed.error.issues.slice(0, 10))}. Return ONLY a corrected JSON object matching the schema exactly.` });
      } catch (e) {
        if (e instanceof SyntaxError) {
          lastError = new AiOutputInvalidError('Model output was not valid JSON', { snippet: response?.text.slice(0, 200) });
          messages.push({ role: 'assistant', content: response?.text ?? '' });
          messages.push({ role: 'user', content: 'Your previous output was not valid JSON. Return ONLY a single valid JSON object matching the schema exactly.' });
          continue;
        }
        lastError = e;
        const code = (e as AiError).code;
        if (code === 'AI_PROVIDER_ERROR' || code === 'AI_TIMEOUT') {
          const fb = this.opts.router.fallbackFor(provider, req.policy.externalAiAllowed);
          if (fb) {
            this.opts.logger?.warn({ from: provider.name, to: fb.name, code }, 'ai.generate.fallback');
            provider = fb;
            continue;
          }
        }
        if (code === 'AI_REFUSED') break; // do not hammer a refusal
      }
    }

    this.opts.logger?.warn({ workflow: req.workflow, attempts, error: (lastError as Error)?.message }, 'ai.generate.failed');
    if (lastError instanceof AiError) throw lastError;
    throw new AiError('AI_PROVIDER_ERROR', (lastError as Error)?.message ?? 'Unknown AI error');
  }

  private estimateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number | undefined {
    const p = this.opts.pricing?.[model];
    if (!p) return undefined;
    return (usage.inputTokens / 1000) * p.inputPer1k + (usage.outputTokens / 1000) * p.outputPer1k;
  }
}
