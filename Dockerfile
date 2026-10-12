# syntax=docker/dockerfile:1.7
# Production image: Next.js standalone server plus the Prisma CLI for the migration job (design D2).

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Prisma CLI for `prisma migrate deploy` in the Container Apps migration job, same version as the build
COPY --from=build /app/node_modules/prisma/package.json /tmp/prisma-package.json
RUN npm install --prefix /opt/migrate --no-audit --no-fund --omit=dev "prisma@$(node -p "require('/tmp/prisma-package.json').version")" \
 && ln -s /opt/migrate/node_modules/.bin/prisma /usr/local/bin/prisma && npm cache clean --force
COPY --from=build /app/prisma ./prisma
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/assets ./assets
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
