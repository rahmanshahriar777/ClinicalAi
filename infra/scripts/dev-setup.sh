#!/usr/bin/env bash
# One-shot local bootstrap: infra containers, env file, deps, DB migrate + seed.
set -euo pipefail
cd "$(dirname "$0")/../.."

command -v pnpm >/dev/null || { echo "pnpm 9+ is required (corepack enable && corepack prepare pnpm@9 --activate)"; exit 1; }
command -v docker >/dev/null || { echo "Docker is required"; exit 1; }

[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example"; }
if ! grep -q '^FIELD_ENCRYPTION_KEY=.\+' .env; then
  key=$(openssl rand -base64 32)
  sed -i.bak "s#^FIELD_ENCRYPTION_KEY=.*#FIELD_ENCRYPTION_KEY=${key}#" .env && rm -f .env.bak
  echo "Generated FIELD_ENCRYPTION_KEY"
fi

docker compose up -d postgres redis minio minio-init
pnpm install
pnpm db:generate
pnpm --filter @app/shared --filter @app/db --filter @app/ai --filter @app/api-client build
pnpm --filter @app/db exec prisma migrate dev --name init --skip-seed
pnpm db:seed
echo
echo "Ready. Start the stack with: pnpm dev   (API :4000, web :3000, Swagger at /docs)"
echo "Demo logins (password ClinicalAi!2026dev): dr.smith@ / nurse@ / frontdesk@ / admin@ / compliance@ / patient@demo-clinic.test"
