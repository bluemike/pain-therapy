# syntax=docker/dockerfile:1.7
# Image of the patient zone (patient-zone-app, iteration 4 design D11, D13). Build from the repository root:
#   docker build -f apps/patient-zone/Dockerfile -t pain-therapy-zone .
# Next.js standalone server only: no Prisma CLI, no migrations (those run in the practice app's migration job).

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/patient-zone/package.json ./apps/patient-zone/
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY packages/shared ./packages/shared
COPY apps/patient-zone ./apps/patient-zone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build -w @pain-therapy/patient-zone

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/patient-zone/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/patient-zone/.next/static ./apps/patient-zone/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/patient-zone/server.js"]
