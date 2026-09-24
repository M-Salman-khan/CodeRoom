# ==============================================================================
# Stage 1: Base image
# ==============================================================================

FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    default-jdk-headless \
    python3 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate


# ==============================================================================
# Stage 2: Install dependencies and generate Prisma client
# ==============================================================================

FROM base AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

RUN pnpm exec prisma generate


# ==============================================================================
# Stage 3: Build Next.js application
# ==============================================================================

FROM base AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .

ENV NODE_ENV=production

RUN pnpm exec next build && rm -rf .next/cache


# ==============================================================================
# Stage 4: Production dependencies
# ==============================================================================

FROM base AS prod-dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

COPY prisma ./prisma/

RUN pnpm install --prod --frozen-lockfile

RUN pnpm exec prisma generate


# ==============================================================================
# Stage 5: Production runner
# ==============================================================================

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL="file:/app/data/coderoom.db"
ENV PATH="/app/node_modules/.bin:$PATH"

RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=prod-dependencies --chown=node:node \
    /app/node_modules ./node_modules

COPY --from=builder --chown=node:node \
    /app/.next ./.next

COPY --chown=node:node \
    package.json tsconfig.json next.config.mjs ./

COPY --chown=node:node \
    server.ts ./

COPY --chown=node:node \
    prisma ./prisma

COPY --chown=node:node \
    src ./src

COPY --chown=node:node \
    docker-entrypoint.sh ./

RUN chmod +x ./docker-entrypoint.sh

USER node

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["tsx", "-r", "./src/server/polyfill.js", "server.ts"]