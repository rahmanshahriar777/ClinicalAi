# AI governance

## Principles (blueprint §13–§15, §17)

1. **Draft, never decision.** Every workflow output is a draft for a licensed human. The platform has no code path that
   sends AI text to a patient or into the record without an `Approval` row.
2. **Minimum necessary, redacted.** Context is assembled per workflow; identifiers are redacted deterministically and
   by NER before leaving the trust boundary.
3. **Deterministic safety first.** Keyword red-flag rules run before and independently of the model; AI classification can
   only raise urgency.
4. **Reproducible.** Each invocation records provider, model, `promptName@version`, input hash, tokens, latency, cost,
   redaction count and injection signals.
5. **Policy is layered.** Deployment env sets hard limits; organisations can only tighten them (`AiConfigService`).

## Workflows

| Workflow | Trigger | Reviewer | Patient-facing? |
|----------|---------|----------|-----------------|
| `CLINICAL_NOTE` | clinician on an encounter | clinician only | no (becomes a document after approval) |
| `INTAKE_SUMMARY` | automatic on intake submission (consent + flag gated) | clinician (nurse if permitted) | no |
| `MESSAGE_TRIAGE` | automatic on patient message | none — advisory metadata | no |
| `PATIENT_MESSAGE_DRAFT` | staff on a thread | clinician (nurse if permitted) | only after approval, with edit trail |
| `PATIENT_EDUCATION` | clinician on an encounter (flag off by default) | clinician only | only after approval |

## Guardrails implemented

- Prompt injection: untrusted variables are sanitised (control chars, known override phrases), length-capped and
  wrapped in `<untrusted_patient_input>` tags; signals are logged per invocation.
- Output validation: strict Zod schema per workflow; one repair round-trip; provider fallback on provider/timeouts;
  refusals are not retried.
- Clinical safety checks (`runSafetyChecks`): diagnostic/prescriptive language in patient-facing text, dose changes,
  emergency advice, reading level (Flesch–Kincaid) for patient messages and education content.
- Escalation: HIGH/EMERGENCY urgency from rules or AI → `Escalation` + care-team notification; EMERGENCY → patient guidance.

## Evaluation (blueprint §17)

`packages/ai/src/eval` provides Levenshtein/normalised edit distance and reading-grade metrics. Per-approval edit distance
and rejection reasons are stored; `GET /admin/ai-metrics` aggregates approval, edit, rejection and failure rates, latency and
cost per workflow. Suggested cadence: weekly review of rejections and safety-flagged drafts by the clinical lead;
prompt changes only via a new `PromptTemplate` version with a documented rationale.

## Changing prompts or rules

- Prompts: publish a new version in the admin console (`POST /admin/prompt-templates`); activate after review. Old versions
  remain for reproducibility.
- Red-flag rules: `packages/ai/src/safety/red-flags.ts` with unit tests; changes require clinical review (see compliance doc).
- Model/provider: environment change + release; verify `docs/runbooks.md` "AI provider incident" first.
