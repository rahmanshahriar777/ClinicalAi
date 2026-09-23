#!/usr/bin/env bash
# Production migration step (run from CI/CD before rolling out a new API image).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?DATABASE_URL must be set}"
pnpm --filter @app/db exec prisma migrate deploy
