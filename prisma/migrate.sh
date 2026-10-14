#!/bin/sh
# Migration job (Container Apps job and docker compose "migrate"): schema first, then the role of the patient zone
# with its grants (iteration 4, design D12), then the therapy catalog (therapy-catalog, design D2). All steps are
# idempotent; the job fails if any fails. The patient zone itself never runs migrations.
set -eu
cd "$(dirname "$0")/.."
prisma migrate deploy
node prisma/patient-zone-role.mjs
node prisma/catalog/sync.mjs
