# syntax=docker/dockerfile:1

# ==============================================================================
# Base image with runtime compilers (Java, Python, C/C++) used by the code runner
# ==============================================================================

FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    bash \
    default-jdk-headless \
    python3 \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*


# ==============================================================================
# Stage 2: Build the React (Vite) client
# ==============================================================================

FROM base AS client-build

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY client/ ./
RUN npm run build


# ==============================================================================
# Stage 3: Build the Express (TypeScript) server
# ==============================================================================

FROM base AS server-build

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY server/ ./
RUN npm run build


# ==============================================================================
# Stage 4: Production runner (Express serves the SPA + API + WebSockets)
# ==============================================================================

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV MONGODB_URI=mongodb://mongo:27017/coderoom

WORKDIR /app

# Server runtime (node_modules includes tsx so TypeScript snippets stay runnable)
COPY --from=server-build /app/server/package.json ./server/package.json
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./server/dist

# Static client build served by Express
COPY --from=client-build /app/client/dist ./client/dist

COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN sed -i 's/\r$//' ./docker-entrypoint.sh \
    && chmod +x ./docker-entrypoint.sh \
    && chown -R node:node /app

USER node

WORKDIR /app/server

EXPOSE 3000

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
