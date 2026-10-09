# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable \
    && corepack prepare pnpm@10.15.1 --activate

WORKDIR /workspace


# --------------------------------------------------
# Dependencies
# --------------------------------------------------

FROM base AS deps

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install \
    --frozen-lockfile \
    --filter web...


# --------------------------------------------------
# Build
# --------------------------------------------------

FROM deps AS build

COPY apps/web ./apps/web

# NEXT_PUBLIC_* values are embedded into the browser
# build, so they have to exist at image build time.
ARG APP_BASE_URL=http://localhost:3000

ARG AUTH0_AUDIENCE=https://api.opsdesk.dev

ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:3001

ARG NEXT_PUBLIC_R2_ORIGIN

ENV APP_BASE_URL=${APP_BASE_URL}

ENV AUTH0_AUDIENCE=${AUTH0_AUDIENCE}

ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}

ENV NEXT_PUBLIC_R2_ORIGIN=${NEXT_PUBLIC_R2_ORIGIN}

RUN pnpm --filter web build


# --------------------------------------------------
# Runtime
# --------------------------------------------------

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build \
  --chown=node:node \
  /workspace/apps/web/.next/standalone \
  ./

COPY --from=build \
  --chown=node:node \
  /workspace/apps/web/.next/static \
  ./apps/web/.next/static

COPY --from=build \
  --chown=node:node \
  /workspace/apps/web/public \
  ./apps/web/public

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
