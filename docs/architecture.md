# Architecture

## Shape

A **modular monolith** in a pnpm/Turborepo monorepo. One NestJS API owns all business rules; web and mobile are thin
clients that share the same Zod contracts and HTTP client. This keeps the human-in-the-loop guarantees (nothing AI-generated
reaches a patient without an approval row) in exactly one place and makes them testable.

```
apps/api        NestJS 10 · Prisma · BullMQ            packages/shared      Zod contracts, enums, permissions, tokens
apps/web        Next.js 15 (App Router) · Tailwind     packages/db          Prisma schema, migrations, seed
apps/mobile     Expo 52 / Expo Router                  packages/ai          AI gateway: providers, redaction, safety, prompts
                                                       packages/api-client  typed fetch client (web + mobile)
infra/          docker compose, Terraform (AWS), scripts   packages/ui       design tokens + React primitives
```

## Request path

`x-request-id` middleware → AsyncLocalStorage request context → pino access log (bodies never logged) →
`ThrottlerGuard` → `JwtAuthGuard` (local HS256 or IdP JWKS; live user lookup, 30 s cache) → `PermissionsGuard`
(role → permission map from `@app/shared`) → controller (`ZodValidationPipe`) → service → `AccessPolicyService`
(row-level scope) → Prisma. Every PHI read or state change writes an `AuditLog` row through `AuditService`, which reads
actor/request metadata from the request context so services never pass it around.

## Row-level authorisation

`AccessPolicyService.assert*Access()` is called by every service method that touches a specific record:

- **PATIENT** → own records only (`patientId` from the session, never from the request body)
- **CLINICIAN** → patients on their care team or with an appointment/encounter assigned to them
- **NURSE / FRONT_DESK / ADMIN / COMPLIANCE** → any patient in the same organisation, limited by permissions
- cross-organisation access is always a 404 (no existence leak)

## AI pipeline (blueprint §13.1)

| Stage | Where |
|-------|-------|
| 1 permission · 2 consent · 3 feature/policy | `AiDraftsService.requestDraft` (`PermissionsGuard`, `ConsentsService`, `FeatureFlagsService`, `AiConfigService`) |
| 4 context | `ContextBuilderService` — minimum-necessary variables, `untrustedVariables`, `knownPhi` |
| 5 redaction + injection sanitising | `packages/ai` `RulesPhiRedactor` / `PresidioPhiRedactor`, `sanitizeUntrusted`, `wrapUntrusted` |
| 6 prompt render · 7 routing | `renderTemplate`, `ModelRouter` (policy gate, tier per workflow) |
| 8 provider call | `MockProvider` / `AzureOpenAiProvider` / `BedrockProvider` / `OpenAiCompatibleProvider` — timeout, retry, repair, fallback |
| 9 parse · 10 validate | `extractJson` + `AI_OUTPUT_SCHEMAS[workflow]` + `runSafetyChecks` |
| 11 store · 12 audit · 13 review queue | `AiDraftsService.process` → `AiInvocation`, `AiDraft(PENDING_REVIEW)`, audit rows, notifications, escalations |

The gateway is framework-agnostic and fully unit-tested with the mock provider; the API only adds persistence and policy.

## Jobs

`JobsService` has two modes. With Redis, BullMQ runs `AI_DRAFT_GENERATE`, `MESSAGE_TRIAGE` and `NOTIFICATION_DISPATCH`
in an in-process worker (retry with exponential backoff). With `JOBS_INLINE=true` handlers run on the next tick — no
Redis needed for tests, demos or single-container deployments.

## Data model highlights

- `AiDraft` → `Approval` (reviewer is a `User` so nurse approval can be permitted) → `ClinicalDocument` / `Message`
- `ClinicalDocument.revisions[]` full history; `contentHash` frozen at signing
- `Consent` is an append-only ledger; the latest row per type is the current state
- `AuditLog` is append-only: no update/delete path exists in the codebase
- `ContentEmbedding` (pgvector) is ready for RAG over authorised content; ingestion is a Phase 2 item

## Deployment

Containers (non-root, read-only root FS) on ECS Fargate behind an ALB (see `infra/terraform`), RDS PostgreSQL 16 with
pgvector, ElastiCache Redis (TLS), S3 with KMS, Secrets Manager, VPC endpoints for S3 and Bedrock. Azure mapping:
Container Apps, PostgreSQL Flexible Server, Azure Cache for Redis, Blob Storage, Key Vault, Azure OpenAI private endpoint.

## Observability

- pino JSON logs with redaction; request id on every line and in every error envelope
- OpenTelemetry auto-instrumentation (opt-in), Sentry with PII scrubbing (opt-in)
- `GET /admin/ai-metrics`: approval/edit/rejection rates, edit distance, latency, cost by workflow
- `/health` (liveness) and `/health/ready` (DB reachable)
