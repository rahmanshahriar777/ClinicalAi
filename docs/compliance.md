# Compliance & security controls

This document maps blueprint §11 and §19 requirements to concrete controls in the codebase. It is an engineering
control inventory, not a legal opinion; HIPAA/GDPR applicability and BAAs/DPAs must be confirmed by counsel.

## Identity and access

| Control | Implementation |
|---------|----------------|
| Strong authentication | `AUTH_MODE=oidc` delegates to an enterprise IdP (MFA, SSO). Local mode: argon2id, 12-char password policy, lockout after 5 failures, TOTP MFA with AES-256-GCM-encrypted seeds. |
| Short-lived credentials | 15-minute access tokens; opaque refresh tokens hashed at rest, rotated on every use; reuse revokes the whole family. |
| Least privilege | Role → permission map; row-level `AccessPolicyService`; admins scoped to their organisation; compliance officers are read-only. |
| Session revocation | Deactivating a user revokes sessions; guards re-read the user row (≤30 s cache). |

## Data protection

| Control | Implementation |
|---------|----------------|
| Encryption in transit | TLS at the ALB (TLS 1.3 policy), `rediss://`, `sslmode=require` to RDS, HSTS on the web app. |
| Encryption at rest | KMS-encrypted RDS, S3 (SSE-KMS) and Redis; MFA secrets field-encrypted. |
| PHI minimisation to AI | `ContextBuilderService` sends only what the workflow needs; `knownPhi` deterministic redaction plus rules/Presidio NER; rehydration only for the clinician view. |
| External AI gate | `EXTERNAL_AI_ALLOWED` is a deployment hard gate; production refuses external AI without redaction. |
| No PHI in logs / errors / push | pino redaction, no body logging, generic 500 messages, push notifications carry only a title and deep-link. |
| Secrets | Never in the repo; Secrets Manager/Key Vault injected at runtime; env validation rejects default secrets in production. |

## Audit trail (§11.4)

`AuditLog` records actor, role, action, resource, patient, request id, IP and user agent for: login/logout/refresh,
consent changes, every PHI read by staff (`PHI_ACCESSED`), appointment/encounter/document lifecycle, every AI request,
generation, block, edit, approval and rejection, messages sent/read, escalations, and admin changes. Rows are append-only;
`GET /audit-logs` is limited to `audit:read` (admin, compliance) and to the caller's organisation.

## Consent (§19.3)

Consents are versioned, timestamped and IP/UA stamped. `AI_PROCESSING` is enforced before any AI job is queued;
`MESSAGING` before any message is created. Withdrawal takes effect immediately (latest row wins).

## Human-in-the-loop (§15, §19.1)

- AI output is persisted as `AiDraft(PENDING_REVIEW)`; only an `Approval` row moves it to `APPROVED`.
- Patient-facing messages are created **only** from an approved draft (`aiDrafted=true`, approval id audited) or by a human.
- Every AI-facing UI shows the AI disclosure banner; the patient portal never displays raw AI output.
- Edit distance between draft and approved text is recorded per approval for quality monitoring (§17).

## Emergency handling (§4.4)

Deterministic red-flag rules run synchronously on every patient message and intake submission. EMERGENCY matches
escalate, notify the care team, and post the organisation's emergency guidance to the patient before any AI processing.
AI triage can raise but never lower urgency.

## Retention and deletion

- Audit logs: retain ≥ 6 years (RDS backups 35 days + log export; configure S3 Glacier export in the runbooks).
- Sessions expire after `JWT_REFRESH_TTL_DAYS`; expired rows can be purged by a scheduled job.
- Data-subject requests: `Patient` cascade is intentionally **not** automatic — deletion requires a documented process
  (see runbooks) because clinical records have statutory retention.

## Open items before go-live

1. Signed BAA/DPA with the AI provider if `EXTERNAL_AI_ALLOWED=true`.
2. Penetration test and dependency SBOM (CI runs `pnpm audit`).
3. Clinical governance sign-off of the red-flag rule list and prompt templates.
4. DPIA / risk assessment per deployment region.
