import type { AiWorkflow, UrgencyLevel } from '@app/shared';

/* ------------------------------------------------------------------ */
/* Provider abstraction                                                 */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  workflow: AiWorkflow;
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  /** Ask the provider for a JSON object response where supported. */
  jsonMode: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** True when the provider signalled a refusal / content filter. */
  refused?: boolean;
  finishReason?: string;
}

export interface LlmProvider {
  readonly name: string;
  /**
   * True when requests leave the organisation's trust boundary
   * (blueprint §11.5). Gated by EXTERNAL_AI_ALLOWED.
   */
  readonly isExternal: boolean;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

/* ------------------------------------------------------------------ */
/* Prompts                                                               */
/* ------------------------------------------------------------------ */

export interface PromptTemplateDef {
  name: string;
  workflow: AiWorkflow;
  version: number;
  systemPrompt: string;
  userTemplate: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Gateway request / result                                              */
/* ------------------------------------------------------------------ */

export type ModelTier = 'primary' | 'light';

export interface AiPolicy {
  externalAiAllowed: boolean;
  phiRedactionEnabled: boolean;
  temperature?: number;
  maxTokens?: number;
  modelTier?: ModelTier;
}

export interface KnownPhiEntity {
  /** Literal value to redact (e.g. patient's full name). */
  value: string;
  /** Placeholder label, e.g. PATIENT_NAME, CLINICIAN_NAME, MRN. */
  label: string;
}

export interface AiGenerateRequest {
  workflow: AiWorkflow;
  prompt: PromptTemplateDef;
  /** Variables rendered into the user template. */
  variables: Record<string, string>;
  /** Variable names that contain patient-supplied (untrusted) content. */
  untrustedVariables?: string[];
  /** Known identifiers to redact deterministically before the call. */
  knownPhi?: KnownPhiEntity[];
  policy: AiPolicy;
  /** Correlation data written to logs; never sent to the provider. */
  metadata?: Record<string, unknown>;
}

export interface RedactionReport {
  applied: boolean;
  entityCount: number;
  labels: string[];
}

export interface AiGenerateResult<T = unknown> {
  output: T;
  rawText: string;
  provider: string;
  model: string;
  promptName: string;
  promptVersion: number;
  inputHash: string;
  confidence: number | null;
  safetyFlags: string[];
  redFlags: RedFlagMatch[];
  redaction: RedactionReport;
  injectionSignals: string[];
  usage: { inputTokens?: number; outputTokens?: number; costEstimate?: number };
  latencyMs: number;
  attempts: number;
}

/* ------------------------------------------------------------------ */
/* Safety                                                               */
/* ------------------------------------------------------------------ */

export interface RedFlagMatch {
  category: string;
  urgency: UrgencyLevel;
  matchedText: string;
  negated: boolean;
}

export interface RedFlagReport {
  urgency: UrgencyLevel;
  flags: RedFlagMatch[];
  /** Matches that were negated ("no chest pain") — kept for audit only. */
  negated: RedFlagMatch[];
}
