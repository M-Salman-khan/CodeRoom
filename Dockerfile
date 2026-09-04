# ==============================================================================
# Stage 1: Base image with Node.js 20 and pnpm
# ==============================================================================
FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install system dependencies needed by Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ==============================================================================
# Stage 2: Install all dependencies and generate Prisma client
# ==============================================================================
FROM base AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

# ==============================================================================
# Stage 3: Build the application (Next.js production build)
# ==============================================================================
FROM base AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN pnpm exec next build

# ==============================================================================
# Stage 4: Install production dependencies only
# ==============================================================================
FROM base AS prod-dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma/

RUN pnpm install --prod --frozen-lockfile
RUN pnpm exec prisma generate

# ==============================================================================
# Stage 5: Production Runner
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL="file:/app/data/coderoom.db"
ENV PATH="/app/node_modules/.bin:$PATH"

# Install openssl (required by Prisma engine) and curl (for Docker healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create persistent data directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production node_modules from prod-dependencies stage
COPY --from=prod-dependencies --chown=node:node /app/node_modules ./node_modules

# Copy compiled Next.js build output
COPY --from=builder --chown=node:node /app/.next ./.next

# Copy application configuration and server source code
COPY --chown=node:node package.json tsconfig.json next.config.mjs ./
COPY --chown=node:node server.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src
COPY --chown=node:node docker-entrypoint.sh ./

RUN chmod +x ./docker-entrypoint.sh

# Run as non-root node user for security
USER node

# Declare data directory as a mountable volume for persistence
VOLUME ["/app/data"]

EXPOSE 3000

# Docker Healthcheck to verify the server is actively serving HTTP requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["tsx", "-r", "./src/server/polyfill.js", "server.ts"]
