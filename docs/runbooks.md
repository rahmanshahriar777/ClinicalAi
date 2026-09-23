# Runbooks

## Local development

```
./infra/scripts/dev-setup.sh      # containers, .env, install, generate, migrate, seed
pnpm dev                          # API :4000 (Swagger /docs), web :3000
pnpm --filter @app/mobile start   # Expo (set EXPO_PUBLIC_API_URL to your LAN IP)
```
Demo accounts (password `ClinicalAi!2026dev`): `dr.smith@`, `nurse@`, `frontdesk@`, `admin@`, `compliance@`,
`patient@demo-clinic.test`.

## Deploy (per environment)

1. CI builds and pushes `ghcr.io/<org>/<repo>/api:<sha>` and `web:<sha>`.
2. `terraform apply -var api_image=… -var web_image=…`.
3. Run `infra/scripts/db-migrate-deploy.sh` from a runner inside the VPC **before** the new API tasks receive traffic.
4. Verify `GET /health/ready` and a synthetic login; watch error rate for 15 minutes.

Rollback: re-apply with the previous image tags (migrations are forward-only; write backward-compatible migrations).

## AI provider incident (timeouts, refusals, invalid output spike)

- Symptoms: `AI_DRAFT_FAILED` audit events, `FAILED` drafts, `ai.generate.failed` logs, latency alerts.
- Immediate: set `AI_FALLBACK_PROVIDER` or switch `AI_PROVIDER` and redeploy; or disable the affected workflow per
  organisation in the admin console (`PUT /admin/ai-config` → `workflows`). Clinical work continues manually.
- Never lower `ENABLE_PHI_REDACTION` or raise `EXTERNAL_AI_ALLOWED` to mitigate an incident.

## Suspected PHI exposure

1. Freeze: rotate `JWT_SECRET`, revoke sessions (`UPDATE "Session" SET "revokedAt"=now()`), disable the affected user.
2. Scope: query `AuditLog` by `actorId`, `patientId`, `requestId`; export for the incident record.
3. Notify the compliance officer; follow the organisation's breach process.

## Queue backlog

- Check Redis (`redis-cli info`), worker logs (`job start`), and BullMQ failed count.
- Scale API tasks (worker is in-process) or temporarily set `JOBS_INLINE=true` on a single task for drain.

## Escalation queue not being actioned

- Alert on `Escalation.status = OPEN` older than 15 minutes (EMERGENCY) / 4 hours (HIGH).
- Confirm care-team notifications are delivered (`Notification.status`), and that clinicians/nurses exist and are active.

## Data-subject request (access / erasure)

- Access: export via `GET /patients/:id`, `/appointments`, `/threads`, `/patients/:id/documents`, `/audit-logs?patientId=`.
- Erasure: clinical records are subject to statutory retention; anonymise `User` (email, names, phone) and delete
  `Session`, `DevicePushToken`, `Notification` rows; record the decision in the audit log (`EXPORT_REQUESTED`).

## Backups and restore

- RDS automated backups (35 days prod) + weekly manual snapshot before schema migrations.
- Restore test quarterly: restore to a scratch instance, run `prisma migrate status`, boot the API against it.
