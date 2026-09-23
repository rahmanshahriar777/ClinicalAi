# Blueprint gap analysis and decisions

The blueprint (v1.0, 21 Sep 2026) is thorough, but implementing it surfaced ambiguities and a few
internal inconsistencies. Each item below records the issue, the options, and what this codebase does.
Where the blueprint was silent, the most conservative clinical-safety reading was chosen.

| # | Area | Issue in the blueprint | Decision in this codebase |
|---|------|------------------------|---------------------------|
| 1 | Roles | §3 lists a **Compliance Officer**, but the §10 `UserRole` enum omits it. | Added `COMPLIANCE` role with `audit:read`, `consent:read`, `escalation:read` only. |
| 2 | Messaging states | §4.3 defines pipeline states (Received → AI Classification → Routing → … → Sent) while §10 `MessageStatus` is a *delivery* status (QUEUED/SENT/DELIVERED/READ/FAILED). Both are needed. | Pipeline state lives on the **thread** (`ThreadStatus`: OPEN, TRIAGING, ROUTED, AWAITING_REVIEW, ESCALATED, RESOLVED, CLOSED); delivery status stays on the message. |
| 3 | Document states | §4.2 has an "Edited/Revised" state; §10 `DocumentStatus` has none. | Added `REVISED`; the state machine is in `apps/api/src/modules/documents/document-state.ts` and is unit-tested. |
| 4 | Authentication | §11.1 mandates an external OIDC IdP, but §12.2 specifies `/auth/login`, `/auth/refresh`, `/auth/logout` that issue tokens. | `AUTH_MODE=local` (API issues JWTs; argon2id, rotating refresh tokens, TOTP MFA) for pilots/dev, `AUTH_MODE=oidc` (resource server validating IdP JWKS) for production. The env schema refuses unsafe combinations. |
| 5 | Appointments | `Appointment` has no `clinicianId`/`organizationId`, so "clinicians see only patients under their care" (§11.2) cannot be enforced. | Added both, plus a `CareTeamAssignment` model. `AccessPolicyService` implements the scope rules. |
| 6 | Documents | `createdBy` / `approvedBy` are free-text strings. | Foreign keys to `User`, plus `DocumentRevision` history and a `contentHash` frozen at signing. |
| 7 | Enums | Several status/decision/type columns are strings. | All are Prisma enums, mirrored in `@app/shared` so clients never import Prisma. |
| 8 | Walk-ins | Encounter is 1:1 with Appointment; walk-ins are not described. | Kept 1:1; front desk books a same-time appointment for a walk-in. Documented as a future extension. |
| 9 | Intake | §4.2 starts with a patient intake form but there is no `IntakeForm` model. | Added `IntakeForm` (validated answers, rule-based red flags, urgency) created with every appointment. |
| 10 | Notifications | §5.1 lists reminders/alerts but no model. | Added `Notification`, `DevicePushToken` and per-patient channel preferences. Push payloads carry no PHI (§18.5). |
| 11 | Prompt versioning | §15.1 requires prompt version control; nothing stores prompts. | `PromptTemplate` registry (global defaults seeded from code, per-organisation overrides, immutable versions). Every `AiInvocation` records `promptName@version` and an input hash. |
| 12 | Escalation | §4.4 describes a human review queue; no model exists. | Added `Escalation` (source INTAKE/MESSAGE/AI_OUTPUT/MANUAL, ack/resolve, care-team notification). |
| 13 | Sessions | Refresh tokens need server-side revocation. | Added `Session` with hashed tokens, rotation and reuse detection. |
| 14 | Message sender | `senderType` string, no sender FK. | `SenderType` enum (PATIENT/STAFF/SYSTEM) + `senderId → User`. SYSTEM is used for emergency guidance. |
| 15 | AI provider vs. policy | `.env.example` sets `AI_PROVIDER=azure-openai` **and** `EXTERNAL_AI_ALLOWED=false`, which would block every call. | Default `AI_PROVIDER=mock` (deterministic, schema-valid). `ModelRouter` hard-gates external providers; `openai-compatible` covers the private/self-hosted path (§11.5 Path B). |
| 16 | Output contracts | §13.2 workflow outputs and §14 prompt output schemas differ (e.g. `structuredFields` vs `structuredData`, missing `safetyFlags`). | One superset Zod schema per workflow in `@app/shared/src/schemas/ai.ts`; prompts and validation both derive from it. |
| 17 | Message draft schema | §14.2 returns `needsClinicianReview` and §13.2 returns `escalationRecommended`; both are useful. | Both retained; `needsClinicianReview` is informational — the platform never bypasses review regardless of its value. |
| 18 | Vector store | Both pgvector and Qdrant are listed. | pgvector (`ContentEmbedding`) is the default; Qdrant is behind the `vector` compose profile for scale-out. |
| 19 | HTTP verbs | `PATCH /appointments/:id/cancel` is unusual (POST is conventional). | Kept exactly as documented for client compatibility. |
| 20 | Roles vs permissions | §11.2 mixes role names and permission strings. | Guards check **permissions**; `ROLE_PERMISSIONS` maps roles to them so adding a role never touches controllers. Row-level rules are separate. |
| 21 | Consents | Only `POST /patients/me/consents` is listed. | Added `GET` (history) and consent enforcement (`AI_PROCESSING` gates every AI call; `MESSAGING` gates messaging). |
| 22 | Nurse approval | §11.2 "Nurse: review AI drafts *if permitted*" is undefined. | `REQUIRE_CLINICIAN_APPROVAL=true` (default): only clinicians approve. `false`: nurses may approve **patient-message drafts and intake summaries only**; clinical notes and patient education always need a clinician. Organisations can only make this stricter. |
| 23 | Triage output | Message triage is "AI classification" but also an output needing review. | Triage is **advisory metadata** (intent, urgency, route). It is auto-marked APPROVED, never patient-facing, never in the review queue; it can only *raise* thread urgency and create escalations, never lower urgency. |
| 24 | Emergency guidance | §4.4 says the patient receives emergency guidance, source unspecified. | `Organization.emergencyGuidanceText` (admin-editable) is posted as a SYSTEM message and pushed on any EMERGENCY red flag. Rule-based detection runs synchronously so this happens before any AI call. |
| 25 | docker-compose | Uses the obsolete top-level `version:` key. | Removed. Added `pgcrypto`/`vector` init and `app` / `vector` / `oidc` profiles. |
| 26 | Message send on approval | Unclear whether approving a message draft sends it. | `sendOnApprove` (default `true`) on the review request; the sent message is stamped `aiDrafted=true` with the approval id in the audit trail. |
| 27 | Speech-to-text | Listed as optional in Phase 2. | Feature flag exists (`FEATURE_SPEECH_TO_TEXT`, default off); no transcription provider is wired in this release. |
| 28 | PHI in logs | The blueprint requires no PHI in logs but the sample logging config would log request bodies. | pino redaction list + body logging disabled; audit rows store ids, statuses and hashes, never free text. |
