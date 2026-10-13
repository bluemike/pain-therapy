#!/bin/sh
# Migration job (Container Apps job and docker compose "migrate"): schema first, then the therapy catalog
# (therapy-catalog, design D2). Both steps are idempotent; the job fails if either fails.
set -eu
cd "$(dirname "$0")/.."
prisma migrate deploy
node prisma/catalog/sync.mjs
