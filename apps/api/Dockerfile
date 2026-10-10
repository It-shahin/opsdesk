# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS os

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM os AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable \
    && corepack prepare pnpm@10.15.1 --activate

WORKDIR /workspace


# --------------------------------------------------
# Full dependencies used for build + Prisma tooling
# --------------------------------------------------

FROM base AS deps

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install \
    --frozen-lockfile \
    --filter api...


# --------------------------------------------------
# Build
# --------------------------------------------------

FROM deps AS build

COPY apps/api ./apps/api

# Prisma generate does not connect to PostgreSQL,
# but prisma7.config.ts expects DATABASE_URL to exist.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/opsdesk"

RUN cd apps/api \
    && pnpm exec prisma generate \
       --config prisma7.config.ts

RUN pnpm --filter api build


# --------------------------------------------------
# Migration image target
#
# This target is intentionally separate from runtime.
# Phase 11C will define exactly when deployment runs it.
# --------------------------------------------------

FROM build AS migrate

WORKDIR /workspace/apps/api

CMD ["pnpm", "exec", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]


# --------------------------------------------------
# Production-only dependencies
# --------------------------------------------------

FROM base AS prod-deps

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install \
    --frozen-lockfile \
    --prod \
    --filter api... \
    && cd apps/api \
    && pnpm exec prisma --version


# --------------------------------------------------
# Minimal production runtime
# --------------------------------------------------

FROM os AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/apps/api

COPY --from=prod-deps \
  /workspace/node_modules \
  /app/node_modules

COPY --from=prod-deps \
  /workspace/apps/api/node_modules \
  ./node_modules

COPY --from=build \
  /workspace/apps/api/dist \
  ./dist

COPY --from=build \
  /workspace/apps/api/package.json \
  ./package.json

COPY --from=build \
  /workspace/apps/api/prisma \
  ./prisma

COPY --from=build \
  /workspace/apps/api/prisma7.config.ts \
  ./prisma7.config.ts

USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]
