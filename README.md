# Clinical AI Platform

**AI-Powered Clinical Documentation & Patient Communication Engine** — a production-oriented implementation of the
blueprint (v1.0, 21 Sep 2026). AI drafts clinical notes, intake summaries, message triage and patient replies;
**a licensed human approves everything before it reaches the record or the patient.**

> See [`docs/blueprint-gap-analysis.md`](docs/blueprint-gap-analysis.md) for every ambiguity found in the blueprint and
> the decision taken.

## What's inside

| Path | What | Status |
|------|------|--------|
| `apps/api` | NestJS 10 REST API — auth, RBAC + row-level access, appointments, intake, encounters, documents (state machine), AI drafts + review queue, messaging + triage, escalations, notifications, audit, admin, health, Swagger | typechecks, builds, 37 unit tests incl. full DI-graph wiring test, e2e suite (needs Postgres) |
| `apps/web` | Next.js 15 patient portal, clinician workspace, admin console (blueprint §6.2 design tokens) | `next build` passes, 23 routes |
| `apps/mobile` | Expo 52 / Expo Router patient app (biometric lock, secure token storage, push registration) | skeleton; run `pnpm install` locally (Expo SDK not installed in the authoring sandbox) |
| `packages/shared` | Zod contracts for every request and AI output, enums, role→permission map, design tokens | 10 tests |
| `packages/db` | Prisma schema (32 models/enums), seed with a demo clinic | builds |
| `packages/ai` | Framework-agnostic AI gateway: providers (mock, Azure OpenAI, Bedrock, OpenAI-compatible), PHI redaction (rules/Presidio), red-flag rules, injection sanitising, output validation, prompt registry, eval metrics | 30 tests |
| `packages/api-client` | Typed HTTP client with transparent refresh, shared by web + mobile | 4 tests |
| `packages/ui` | Tailwind preset + React primitives from the design tokens | typechecks |
| `infra/` | docker compose (pgvector, Redis, MinIO, optional Qdrant/Keycloak, `app` profile), Terraform AWS reference (VPC, RDS, ElastiCache, S3/KMS, ECS Fargate, Secrets Manager), scripts | — |
| `docs/` | architecture, compliance controls, AI governance, runbooks, gap analysis | — |
| `.github/workflows/ci.yml` | lint · typecheck · unit · API e2e with Postgres/Redis · image build · audit | — |

## Quick start (local)

Prerequisites: Node 20, pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.9 --activate`), Docker.

```bash
./infra/scripts/dev-setup.sh   # starts Postgres/Redis/MinIO, creates .env, installs, generates Prisma, migrates, seeds
pnpm dev                       # API http://localhost:4000 (Swagger at /docs), web http://localhost:3000
```

Or step by step:

```bash
cp .env.example .env                                   # set FIELD_ENCRYPTION_KEY: openssl rand -base64 32
docker compose up -d postgres redis minio minio-init
pnpm install
pnpm db:generate
pnpm --filter @app/shared --filter @app/db --filter @app/ai --filter @app/api-client build
pnpm --filter @app/db exec prisma migrate dev --name init   # creates packages/db/prisma/migrations/*_init
pnpm db:seed
pnpm dev
```

Demo logins (password `ClinicalAi!2026dev`): `dr.smith@demo-clinic.test` (clinician), `nurse@…`, `frontdesk@…`,
`admin@…`, `compliance@…`, `patient@demo-clinic.test`.

**Try the whole loop in five minutes:** sign in as the patient → *Privacy & consent* → allow AI assistance and messaging →
*Messages* → send "I have crushing chest pain" (watch the emergency guidance appear and the thread escalate) → sign in as
`dr.smith@` → *Escalations* / *Inbox* → "Draft reply with AI" → *AI review queue* → edit, approve, send.
Then *Schedule* → start the seeded encounter → add shorthand notes → *Generate SOAP draft* → review → approve → create the
document → sign.

Full stack in containers: `docker compose --profile app up --build` (API :4000, web :3000).

## Configuration

Everything is in [`.env.example`](.env.example) and validated at boot by `apps/api/src/config/env.ts`; the API refuses
to start with a dangerous combination (default JWT secret in production, external AI without PHI redaction, mock provider
in production, a provider without its credentials). Key switches:

| Variable | Meaning |
|----------|---------|
| `AUTH_MODE` | `local` (API-issued JWTs, MFA) or `oidc` (Keycloak/Auth0/Cognito/Entra resource server) |
| `AI_PROVIDER` | `mock` \| `azure-openai` \| `bedrock` \| `openai-compatible` (private/self-hosted) |
| `EXTERNAL_AI_ALLOWED` | hard gate for providers outside the trust boundary |
| `ENABLE_PHI_REDACTION`, `PHI_REDACTOR` | redact before any model call; `rules` or `presidio` |
| `REQUIRE_CLINICIAN_APPROVAL` | `true`: only clinicians approve; `false`: nurses may approve message drafts and intake summaries |
| `JOBS_INLINE` | run jobs without Redis (tests, demos) |
| `FEATURE_*` | environment defaults; per-organisation overrides in the admin console |

Organisations can only *tighten* these from the admin console (`/admin/ai-config`).

## Commands

```bash
pnpm build | typecheck | lint | test          # Turborepo across the workspace
pnpm --filter @app/api test                   # API unit tests (no DB needed)
E2E=true pnpm --filter @app/api test:e2e      # API e2e (needs DATABASE_URL + seed)
pnpm --filter @app/ai test                    # AI gateway tests (mock provider, red-team cases)
pnpm db:migrate | db:migrate:deploy | db:seed | db:studio
```

## API surface (blueprint §12.2 plus additions)

```
POST /auth/login | /auth/mfa/verify | /auth/refresh | /auth/logout | /auth/register   GET /auth/me   POST /auth/mfa/setup|confirm
GET|PATCH /patients/me   GET|POST /patients/me/consents   GET /patients   GET|PATCH /patients/:id   GET /patients/:id/consents|documents
GET|POST /appointments   GET /appointments/:id   PATCH /appointments/:id/cancel   POST /appointments/:id/check-in|no-show|encounter
GET|POST /appointments/:id/intake
GET|PATCH /encounters/:id   POST /encounters/:id/start|complete   GET|POST /encounters/:id/documents   GET|POST /encounters/:id/ai-drafts
GET|PATCH /documents/:id   POST /documents/:id/submit|approve|sign|amend|share
GET /ai-drafts (review queue)   GET /ai-drafts/:id   POST /ai-drafts/:id/approve|reject|review
GET|POST /threads   GET|PATCH /threads/:id   POST /threads/:id/messages|read|ai-drafts
GET /escalations   POST /escalations/:id/acknowledge|resolve
GET /notifications   POST /notifications/:id/read   POST|DELETE /notifications/devices
GET /audit-logs
GET|POST /admin/users   PATCH /admin/users/:id   GET|PATCH /admin/organization   GET|PUT /admin/ai-config
GET|POST /admin/prompt-templates   POST /admin/prompt-templates/:id/activate   GET|PUT /admin/feature-flags   GET /admin/ai-metrics
GET /health   GET /health/ready   GET /docs (Swagger, non-production)
```

Errors always use one envelope: `{ statusCode, code, message, details?, requestId, timestamp }` with stable `code`s from
`@app/shared` (`VALIDATION_FAILED`, `CONSENT_REQUIRED`, `INVALID_STATE_TRANSITION`, `AI_BLOCKED_BY_POLICY`, …).

## Architectural decisions (short version)

1. **Modular monolith, one API.** All safety-critical rules (consent gates, approval requirement, row-level access, audit)
   live in one process and are unit-tested; clients are thin. Split later along module boundaries if scale demands.
2. **Contracts first.** `@app/shared` Zod schemas are the single source of truth for requests *and* for what the LLM must
   return; the API validates both, prompts embed the same shape, and clients import the types.
3. **AI gateway as a library.** `@app/ai` has no framework dependency, runs entirely against a deterministic mock provider
   in CI, and exposes the 13-stage pipeline as pure functions where possible (red flags, injection, redaction, validation).
4. **Policy layering.** Environment sets hard limits (external AI, redaction, clinician approval); organisations can only
   tighten them; the router refuses any provider the policy does not allow before PHI is touched.
5. **Two auth modes.** Pilots run without an IdP; production delegates to OIDC. Same guards, same user model.
6. **Jobs with an inline mode.** BullMQ/Redis in production; `JOBS_INLINE=true` keeps tests and demos dependency-free.
7. **Deterministic safety before AI.** Keyword red-flag rules run synchronously and can never be lowered by the model;
   emergency guidance reaches the patient before any AI call.
8. **Immutable evidence.** Append-only audit, document revisions, signed content hashes, versioned prompts, invocation
   records with input hashes.

## Known limitations / next steps

- Migrations: the first `prisma migrate dev` generates `init`; commit it. (The authoring sandbox could not download the
  Prisma engines, so the SQL is not pre-generated.)
- Mobile app is a structured skeleton (login, home, appointments + intake, messages, settings); it has not been compiled here.
- Email/SMS notification adapters are `log` stubs; add SES/SendGrid/Twilio in `notification-dispatcher.ts`.
- Speech-to-text and RAG ingestion (`ContentEmbedding`) are Phase 2 per the blueprint and not wired.
- Vector search uses pgvector; Qdrant is available behind the `vector` compose profile.
