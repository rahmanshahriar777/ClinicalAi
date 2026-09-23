import type { AiWorkflow } from '@app/shared';

import { AiBlockedByPolicyError } from './errors';
import type { LlmProvider, ModelTier } from './types';

export interface ModelRouterConfig {
  primary: LlmProvider;
  fallback?: LlmProvider;
  models: Record<ModelTier, string>;
  /** Per-workflow default tier (blueprint §16.3). */
  workflowTiers?: Partial<Record<AiWorkflow, ModelTier>>;
}

export interface RouteDecision {
  provider: LlmProvider;
  model: string;
  tier: ModelTier;
}

const DEFAULT_TIERS: Record<AiWorkflow, ModelTier> = {
  CLINICAL_NOTE: 'primary',
  PATIENT_MESSAGE_DRAFT: 'primary',
  INTAKE_SUMMARY: 'light',
  PATIENT_EDUCATION: 'primary',
  MESSAGE_TRIAGE: 'light',
};

/**
 * Model router (blueprint §13.1 stage 7). Chooses tier per workflow and
 * enforces the external-AI policy gate: a provider that leaves the trust
 * boundary is only used when the organisation's policy allows it.
 */
export class ModelRouter {
  constructor(private readonly cfg: ModelRouterConfig) {}

  route(workflow: AiWorkflow, opts: { externalAiAllowed: boolean; tier?: ModelTier }): RouteDecision {
    const tier = opts.tier ?? this.cfg.workflowTiers?.[workflow] ?? DEFAULT_TIERS[workflow];
    const candidates = [this.cfg.primary, this.cfg.fallback].filter((p): p is LlmProvider => Boolean(p));
    const allowed = candidates.find((p) => !p.isExternal || opts.externalAiAllowed);
    if (!allowed) {
      throw new AiBlockedByPolicyError(
        'No AI provider is permitted by policy: external AI is disabled and no private provider is configured.',
        { candidates: candidates.map((c) => ({ name: c.name, isExternal: c.isExternal })) },
      );
    }
    return { provider: allowed, model: this.cfg.models[tier], tier };
  }

  /** Next provider after `current` failed, respecting policy. */
  fallbackFor(current: LlmProvider, externalAiAllowed: boolean): LlmProvider | undefined {
    const f = this.cfg.fallback;
    if (!f || f === current) return undefined;
    return !f.isExternal || externalAiAllowed ? f : undefined;
  }
}
