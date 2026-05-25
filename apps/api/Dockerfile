FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for native modules (argon2)
RUN apk add --no-cache python3 make g++

# ── Install dependencies ───────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# ── Build ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ── Production image ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/src/db/migrations ./dist/src/db/migrations
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "dist/src/server.js"]
