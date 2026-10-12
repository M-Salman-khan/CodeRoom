# ==============================================================================
# Stage 1: Base image with runtime compilers (Java, Python, C/C++)
# ==============================================================================

FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

# Install compilers for runtime code execution engine and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    default-jdk-headless \
    python3 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate \
    && pnpm config set store-dir /pnpm/store


# ==============================================================================
# Stage 2: Install all dependencies (with persistent BuildKit pnpm store cache)
# ==============================================================================

FROM base AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm exec prisma generate


# ==============================================================================
# Stage 3: Build Next.js application (with BuildKit Next.js cache mount)
# ==============================================================================

FROM base AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN --mount=type=cache,target=/app/.next/cache \
    pnpm exec next build


# ==============================================================================
# Stage 4: Production dependencies only
# ==============================================================================

FROM base AS prod-dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

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

# Create persistent data directory and assign ownership to node user
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production node_modules from prod-dependencies stage
COPY --from=prod-dependencies --chown=node:node \
    /app/node_modules ./node_modules

# Copy Next.js production build output
COPY --from=builder --chown=node:node \
    /app/.next ./.next

# Copy server entrypoint and source files required at runtime by tsx
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

RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

USER node

VOLUME ["/app/data"]

EXPOSE 3000

# Explicitly notify Docker to forward SIGTERM for graceful Yjs document flushing
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["tsx", "-r", "./src/server/polyfill.js", "server.ts"]