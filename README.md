# CodeRoom

> **Code together. Anywhere.**

CodeRoom is a self-hosted, real-time collaborative coding workspace: Monaco (VS Code's editor),
Yjs CRDT synchronization, multi-language code execution, AI-assisted diagnostics, granular
permissions, an integrated terminal, and room chat — in the browser, over HTTPS and secure
WebSockets from any authorized internet-connected computer.

The project previously ran on Next.js. It now uses a **traditional MERN server/client split**:

- **`client/`** — Vite + React 18 SPA (static build)
- **`server/`** — Express 4 + MongoDB (Mongoose) REST API + `ws` WebSockets

Invitation links are generated **only** from a server-configured public HTTPS origin
(`PUBLIC_BASE_URL`). CodeRoom never derives them from `localhost`, a private LAN IP, or the
hostname a participant happens to be using. If no public origin is configured, invite links are
disabled and only the room code is shown.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Real-Time Collaboration](#real-time-collaboration)
- [Code Execution](#code-execution)
- [AI Diagnostics](#ai-diagnostics)
- [Permissions](#permissions)
- [Security & Limits](#security--limits)
- [Responsive Workspace](#responsive-workspace)
- [Public Deployment & Invite Links](#public-deployment--invite-links)
- [Production Docker + HTTPS](#production-docker--https)
- [Reverse Proxy](#reverse-proxy)
- [Verification & Tests](#verification--tests)
- [API Overview](#api-overview)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Features

### Real-time collaboration

- Yjs CRDT document sync for every file, bound to Monaco through a custom binding
- Remote cursors, selections, usernames, and deterministic user colors
- Presence list, live connection status, automatic reconnects with exponential backoff
- Debounced autosave to MongoDB plus immediate flush when the last editor disconnects

### Editor & terminal

- Monaco editor with syntax highlighting for 15+ languages
- Document formatting and format-on-paste via Prettier for
  JS/TS/JSON/CSS/HTML/Markdown/YAML, plus Java through `prettier-plugin-java`
- Resizable file explorer, editor, chat, and terminal panels
- Single-runner room mutex: one person runs code at a time with live "who is running" status
- Exit codes, elapsed time, clear output, stop execution, and output size/time limits
- Focus (zen) mode and a mobile four-tab workspace: Files / Editor / Output / Chat

### Files & rooms

- Nested folders, drag-free move/cut/copy/paste, duplicate, rename, recursive delete
- Public or password-protected rooms with cryptographically generated 8-character join codes
- Canonical HTTPS invite links built server-side from `PUBLIC_BASE_URL`
- Room settings, member management, and owner controls
- Dashboard with search, ownership filters, member/file counts, and quick join

### Permissions

- `OWNER`, `EDITOR`, `MEMBER` roles plus per-file edit grants
- Interactive access requests: owners get live badges and can approve/decline instantly
- Read-only enforcement on both the REST API and Yjs update path

### AI assistance

- Google Gemini and OpenAI support for error explanation, suggested fixes, and code review
- Zero-config heuristic engine that parses Python/JS/TS/GCC stack traces without any API key

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Client | React 18, Vite, TypeScript, React Router, Tailwind CSS, Radix/shadcn UI, Monaco, Yjs, y-websocket |
| Server | Node.js, Express 4, TypeScript, Mongoose 8, `ws`, Yjs, `y-protocols`, `jose`, bcryptjs |
| Database | MongoDB 7 (local service, Atlas, or Docker) |
| Real-time | Yjs CRDT over binary WebSocket + JSON room events |
| Execution | Host child processes with timeout isolation, mutex, and Judge0 cloud fallback |
| Deployment | Docker multi-stage image, Docker Compose (app + Mongo), GHCR + SSH CD workflow |

---

## Architecture

```text
Browser A                                              Browser B
   │                                                      │
   ├── React SPA (Vite build)                             │
   ├── Monaco + Yjs Y.Doc ──────────┐                     │
   │                                │                     │
   │        WebSocket /yjs          │     WebSocket /yjs  │
   │        (CRDT binary)           │                     │
   ▼                                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express server (port 3000)               │
│  ├── REST API under /api/*                                  │
│  ├── /ws     room events: presence, chat, files, execution  │
│  ├── /yjs/*  CRDT document sync + awareness                 │
│  ├── Static client build + SPA fallback                     │
│  └── Code runner / AI service / debounced autosave          │
└───────────────────────────┬─────────────────────────────────┘
                            │ Mongoose
                            ▼
                    ┌───────────────┐
                    │    MongoDB    │
                    │ users, rooms, │
                    │ files, msgs,  │
                    │ permissions   │
                    └───────────────┘
```

In development the Vite server (`:5173`) proxies `/api`, `/ws`, and `/yjs` to Express (`:3000`).
In production Express serves `client/dist`, so HTTP and WebSockets share one origin. Place Caddy
(or Nginx) in front for automatic HTTPS/WSS — browsers must be able to reach the canonical
`https://` hostname from any authorized network.

---

## Project Structure

```text
CodeRoom/
├── client/                    # Vite + React SPA
│   ├── public/fonts/          # Geist variable fonts
│   ├── src/
│   │   ├── pages/             # Landing, auth, dashboard, settings, room workspace
│   │   ├── components/        # UI primitives + room-specific components
│   │   ├── context/           # Theme provider
│   │   ├── lib/               # API/auth helpers, utils, Monaco-Yjs binding
│   │   └── main.tsx / App.tsx / index.css
│   ├── vite.config.ts         # Dev proxy + @ alias
│   └── package.json
├── server/                    # Express + MongoDB + WebSockets
│   ├── src/
│   │   ├── routes/            # auth, user, rooms, files, messages, permissions, run, ai, compile, config
│   │   ├── models/            # Mongoose schemas
│   │   ├── middleware/        # JWT auth + rate limits
│   │   ├── ws/                # room-handler, yjs-handler (membership-authorized)
│   │   ├── services/          # compiler, code-runner, ai-service, cascade
│   │   ├── lib/               # auth, permissions, public URL, validation, serializers
│   │   ├── app.ts / index.ts
│   │   └── seed.ts
│   ├── .env.example
│   └── package.json
├── .github/workflows/deploy.yml
├── Caddyfile                  # automatic HTTPS/WSS reverse proxy
├── Dockerfile
├── docker-compose.yml         # app + MongoDB (app bound to loopback)
├── docker-compose.prod.yml    # optional Caddy overlay
└── MERN_SPEC.md               # migration contract (endpoint/DTO reference)
```

---

## Requirements

- **Node.js 20+** (22 LTS recommended)
- **npm 10+**
- **MongoDB 6/7** running locally, in Docker, or a MongoDB Atlas URI
- Optional, for local code execution: `python3`, `gcc`, `g++`, `javac`, `bash`
  (missing runtimes fall back to the Judge0 cloud sandbox where supported)

---

## Quick Start

```bash
# 1. install root, client, and server dependencies
npm run setup

# 2. configure environment
cp .env.example .env
# edit .env if your MongoDB URI or AUTH_SECRET differ
cp server/.env.example server/.env   # optional overrides

# 3. start MongoDB locally (or use Docker / Atlas), then seed demo data (optional)
npm run seed

# 4. run Express (:3000) and Vite (:5173) together
npm run dev
```

Open **http://localhost:5173**.

Demo accounts after seeding: `demo` / `password123` and `collaborator` / `password123`
(room code `DEMO01`).

Local development intentionally has no shareable invite links until a public origin is
configured. Set `PUBLIC_BASE_URL=https://your-public-host` to test canonical link generation. For a
local-only shortcut, leave `PUBLIC_BASE_URL` empty and set `ALLOW_PRIVATE_BASE_URL=true` (links then
use `CLIENT_ORIGIN`); production always requires public HTTPS.

### Production build

```bash
npm run build     # builds client/dist, then server/dist
# Generate once and store securely; do not regenerate on every restart:
#   openssl rand -base64 48
PUBLIC_BASE_URL=https://coderoom.example.com \
CLIENT_ORIGIN=https://coderoom.example.com \
TRUST_PROXY=1 \
AUTH_SECRET="<persistent secret>" \
NODE_ENV=production \
npm start         # Express serves the SPA + API on :3000
```

Terminate TLS at Caddy/Nginx; Express should not be exposed directly to the internet. See
[Public Deployment & Invite Links](#public-deployment--invite-links).

---

## Environment Variables

The server reads `server/.env` first, then falls back to the repository-root `.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Set to `production` for deployed hosts |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/coderoom` | Mongo connection string |
| `AUTH_SECRET` | dev fallback | JWT signing secret; **required** in production (≥32 chars, unique, not an example value) |
| `PORT` | `3000` | Express/WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `PUBLIC_BASE_URL` | empty | Canonical public HTTPS origin for invite links, e.g. `https://coderoom.example.com` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Browser origin allowed by CORS |
| `ALLOWED_ORIGINS` | empty | Extra exact CORS origins, comma-separated |
| `TRUST_PROXY` | `0` | Trusted proxy hops: `1` behind Caddy/Nginx, `0` direct |
| `ALLOW_PRIVATE_BASE_URL` | `false` | Development-only: allow localhost/private invite links. Never enable in production |
| `GEMINI_API_KEY` | empty | Enables Gemini diagnostics/review |
| `OPENAI_API_KEY` | empty | Enables OpenAI diagnostics/review |
| `SEED_DATABASE` | `false` | Docker entrypoint seeds demo data when `true` |

In production the server refuses to start with a known development/example `AUTH_SECRET`. It also
disables invite links unless `PUBLIC_BASE_URL` is a public HTTPS origin; it never silently emits
`localhost` or a private IP.

The client requires no build-time environment variables: it fetches `GET /api/config` and uses
same-origin `/api`, `/ws`, and `/yjs` (proxied by Vite in development).

---

## Scripts

Run from the repository root:

| Script | What it does |
| --- | --- |
| `npm run setup` | Installs root, server, and client dependencies |
| `npm run dev` | Runs Express (`:3000`) and Vite (`:5173`) together |
| `npm run dev:server` | Server only (`tsx watch`) |
| `npm run dev:client` | Client only (Vite) |
| `npm run build` | Builds the client, then compiles the server |
| `npm start` | Starts the compiled production server |
| `npm run seed` | Seeds demo users, room, files, and chat |
| `npm run typecheck` | Typechecks both packages |
| `npm run docker:up` | Builds and starts app + MongoDB (loopback only) |
| `npm run docker:prod` | Starts the stack with Caddy HTTPS/WSS |
| `npm run docker:down` | Stops the stack |
| `npm run docker:logs` | Follows container logs |

Within `server/`: `dev`, `build`, `start`, `typecheck`, `seed`.
Within `client/`: `dev`, `build`, `preview`, `typecheck`.

---

## Real-Time Collaboration

1. Opening a file connects to `/yjs/<roomId>__<fileId>` with a JWT (`?token=`, header, or cookie).
2. The WebSocket upgrade is authorized **before** the connection is accepted: the user must be
   the room owner or a membership record must exist for that room.
3. The server restores `yjsState` (or seeds from `content`) and performs the Yjs sync handshake.
4. Edits are exchanged as binary CRDT updates; awareness carries cursors, names, and colors.
   Simultaneous edits merge deterministically — the server never replaces whole documents.
5. Updates from users without file edit permission are dropped server-side (read-only enforcement).
6. Changes autosave after 2s of inactivity, on last disconnect, and on graceful shutdown.
7. `/ws?roomId=…` carries presence, chat, file-tree events, permission changes, and execution
   state. It is also membership-gated at upgrade time.

The room event socket reconnects with exponential backoff and heartbeat checks. Yjs reconnects
automatically and resynchronizes the document. There is **no long-polling fallback**: networks
that block `wss://` upgrades cannot use collaborative editing. The UI shows a diagnostic banner
after repeated failures and a toast when the document socket fails.

Room codes are generated with `crypto.randomInt` (not `Math.random`) and re-checked against a
unique index. Join-room requests, authentication, writes, chat, AI, execution, and the overall API
are rate-limited.

---

## Code Execution

- Room-wide mutex guarantees a single running process per room.
- 10-second timeout, 500 KB output cap, and automatic temp-directory cleanup.
- Local runtimes: Node/tsx, Python 3, Java, C, C++, Bash.
- If a runtime is missing, supported languages fall back to the Judge0 CE cloud sandbox.
- The run/stop result is broadcast to every room member in real time.

---

## AI Diagnostics

`POST /api/rooms/:roomId/ai` supports:

- `action: "debug"` — explain a runtime/compile error, locate the failing line, suggest a fix
- `action: "review"` — review the active file for bugs, style, and improvements

Provider order: Gemini → OpenAI → built-in heuristic parser. No key is required for basic
diagnostics.

---

## Permissions

| Capability | OWNER | EDITOR | MEMBER |
| --- | --- | --- | --- |
| Read files / chat / run code | yes | yes | yes |
| Edit all files | yes | yes | no |
| Edit granted files | yes | yes | if granted |
| Grant/revoke/decline access | yes | no | no |
| Rename/delete room | yes | no | no |

Members can request edit access per file or for the whole room. Owners receive the request in
real time and can approve or decline it from the permissions dialog.

Room isolation is enforced for **every** room-scoped endpoint (files, messages, permissions,
execution, AI) as well as `/ws` and `/yjs`. A non-member receives `403 ROOM_MEMBERSHIP_REQUIRED`
before any room data is read. The only automatic membership path is joining a public/passwordless
room through its canonical link/code (`GET /api/rooms/:id` or `POST /api/rooms/:id/join`).

---

## Security & Limits

- HTTPS/WSS terminated by Caddy/Nginx; HSTS and standard security headers are sent in production.
- `PUBLIC_BASE_URL` is validated as a public HTTPS origin; localhost, private IPs, and common
  internal hostnames/suffixes are rejected for invitation links (unless the explicit
  development-only override is enabled).
- CORS and production WebSocket upgrades use an exact allowlist (`PUBLIC_BASE_URL`,
  `CLIENT_ORIGIN`, `ALLOWED_ORIGINS`); localhost is not implicitly allowed in production, and
  cross-origin browser upgrades are rejected.
- `express-rate-limit` protects auth (50 / 15 min), room join (60 / min), room creation
  (30 / hour), chat (120 / min), AI (30 / min), execution (30 / min), permissions and writes.
- JSON bodies are capped at 2 MB; file content at 1 MB; chat messages at 2,000 characters; AI
  code/output and run payloads have byte limits. WebSocket frames are capped at 2 MB.
- Room codes use `crypto.randomInt`; file names reject path separators/control characters.
- Session cookies are `httpOnly`, `SameSite=Lax`, and always `Secure` in production.
- The server refuses to start in production with known development/example `AUTH_SECRET` values.

Rate limiting is in-process; a horizontally scaled deployment should use a shared store
(Redis/Mongo) or edge limits at the reverse proxy.

---

## Responsive Workspace

- Mobile bottom tabs: **Files / Editor / Output / Chat** with unread chat badge
- Side panels become slide-over drawers on small screens instead of squeezing the editor
- `100dvh` layout with safe-area padding, 44px touch targets, and scrollable dialogs
- Touch-friendly Monaco (word wrap, adaptive font size) and auto-switch to Output on run
- Dashboard/search/filters collapse cleanly; landing and auth pages are usable down to 320px

---

## Public Deployment & Invite Links

CodeRoom is designed to run as a single HTTPS origin on a host you are authorized to use:
`https://<public-domain>`. Participants only need a browser and outbound internet access. They do
not install software, and the app does not require access to the college LAN.

### Prerequisites

1. A domain (for example `coderoom.example.com`) whose DNS A/AAAA record points at the server.
2. An internet-accessible VM/host with ports **80** and **443** open inbound (or an existing
   Nginx/Caddy reverse proxy).
3. `AUTH_SECRET` generated with `openssl rand -base64 48`.
4. A MongoDB instance (the bundled Compose stack provides one with a persistent volume).

### Configuration

```bash
cp .env.docker.example .env
# edit .env:
#   DOMAIN=coderoom.example.com
#   PUBLIC_BASE_URL=https://coderoom.example.com
#   CLIENT_ORIGIN=https://coderoom.example.com
#   AUTH_SECRET=<openssl rand -base64 48>
#   TRUST_PROXY=1
```

`PUBLIC_BASE_URL` is the **only** source of invitation links. It must be public HTTPS. If it is
missing, invalid, localhost, or a private IP, the UI disables invite links and says so rather than
copying an unreachable URL. `CLIENT_ORIGIN` should be the same origin; additional exact origins can
be listed in `ALLOWED_ORIGINS`.

### Start with automatic HTTPS (Caddy)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy
```

Caddy obtains/renews the certificate and proxies HTTP + WebSocket upgrades (`/ws`, `/yjs`) to the
app. The app container is bound to `127.0.0.1:3000`; only Caddy is exposed on 80/443.

### Verify

```bash
curl -fsS https://coderoom.example.com/api/health
curl -fsS https://coderoom.example.com/api/config
```

`/api/config` must report `"inviteLinksEnabled": true` and the exact `publicBaseUrl`. Open the
dashboard in two browsers on different networks, create a room, copy its invite link, and confirm
that the second user joins, sees the file list, and receives live keystrokes.

> **No actual public deployment was performed in this workspace.** No authorized domain, VM
> credentials, or DNS access were supplied, so DNS/TLS issuance and a real cross-network browser
> test could not be executed. The production configuration and local production-mode verification
> are provided above and in [Verification & Tests](#verification--tests).

### Networks that block WebSockets

Collaborative editing requires WebSocket upgrades. If a network or proxy strips `Upgrade`/
`Connection` headers, CodeRoom cannot fall back to polling. The UI shows a diagnostic banner and
toast after repeated failures. Fix the network/proxy policy (allow `wss://<domain>/ws` and
`wss://<domain>/yjs`); do not attempt to bypass institutional firewalls.

---

## Production Docker + HTTPS

The base stack runs the app and MongoDB:

```bash
cp .env.docker.example .env
# set AUTH_SECRET, PUBLIC_BASE_URL, CLIENT_ORIGIN, TRUST_PROXY=1

docker compose up -d --build
# app:   http://127.0.0.1:3000 (loopback only)
# mongo: internal service with the coderoom-mongo volume
```

Add the Caddy overlay for public HTTPS/WSS:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Useful commands:

```bash
docker compose logs -f coderoom
docker compose down
docker compose up -d --build        # rebuild after code changes
SEED_DATABASE=true docker compose up -d   # seed demo data
```

The Compose stack runs MongoDB 7 with a named volume (`coderoom-mongo`). To use Atlas instead,
set `MONGODB_URI` in `.env` and remove or ignore the `mongo` service. If the host already runs an
Nginx/Caddy proxy on 80/443, skip the Caddy overlay and point the existing proxy at
`127.0.0.1:3000`.

If you use the included GitHub Actions deploy workflow, create/update `.env` on the VM
(`~/CodeRoom/.env`) with `AUTH_SECRET`, `PUBLIC_BASE_URL`, `CLIENT_ORIGIN`, and `TRUST_PROXY=1`.
The workflow prints `/api/config` after deployment and warns when invitation links are disabled.

---

## Reverse Proxy

Example Nginx configuration (WebSocket upgrades included):

```nginx
server {
    listen 443 ssl http2;
    server_name coderoom.example.com;

    ssl_certificate     /etc/letsencrypt/live/coderoom.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/coderoom.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets: /ws and /yjs
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Caddy (included in this repo as [`Caddyfile`](./Caddyfile)):

```caddy
{$DOMAIN} {
    encode zstd gzip
    reverse_proxy coderoom:3000
}
```

Set `PUBLIC_BASE_URL=https://coderoom.example.com`, `CLIENT_ORIGIN` to the same value, and
`TRUST_PROXY=1` in production.

---

## Verification & Tests

Run the same checks locally:

```bash
npm run typecheck
npm run build
npm run smoke                    # expects a server at http://127.0.0.1:3000
```

For a production-mode server with a canonical URL and proxy headers:

```bash
# start NODE_ENV=production with PUBLIC_BASE_URL=https://coderoom.example.com,
# CLIENT_ORIGIN=https://coderoom.example.com, TRUST_PROXY=1, AUTH_SECRET=...
SMOKE_EXPECT_PUBLIC_BASE_URL=https://coderoom.example.com \
SMOKE_EXPECT_SECURE_COOKIES=1 \
SMOKE_EXPECT_CORS_ENFORCED=1 \
node scripts/smoke-test.mjs http://127.0.0.1:3000
```

Verified in this workspace:

- `npm --prefix server run typecheck` — passed
- `npm --prefix client run typecheck` — passed
- `npm run build` (client + server) — passed
- Development smoke suite — **56/56 checks passed**
- Production-mode smoke suite (`http://127.0.0.1:3100`, canonical
  `https://coderoom.example.com`) — **63/63 checks passed**, including:
  canonical `shareUrl`, CORS allow/deny, `Secure` + `HttpOnly` cookie behind forwarded HTTPS,
  non-member denial for files/chat/run/AI and for `/ws` + `/yjs` upgrades, payload/name/chat
  limits, authorized Yjs upgrade, room isolation, and cleanup
- Production SPA deep link `/room/DEMO01`, static assets, JSON 404, HSTS, and security headers
- `docker compose config -q` and the production overlay config — valid

Not verified here: a real DNS/TLS certificate, public cross-network browsers, Caddyfile
execution/TLS issuance, and a Docker image build/runtime (the local Docker daemon was
unavailable). See [Known Limitations](#known-limitations).

---

## API Overview

Full request/response shapes live in [`MERN_SPEC.md`](./MERN_SPEC.md). Summary:

| Area | Endpoints |
| --- | --- |
| Config | `GET /api/config` (public canonical URL + collaboration capabilities) |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| User | `GET/PATCH /api/user` |
| Rooms | `GET/POST /api/rooms`, `GET/PATCH/DELETE /api/rooms/:id`, `POST /api/rooms/:id/join` |
| Files | `GET/POST /api/rooms/:id/files`, `GET/PATCH/DELETE /api/rooms/:id/files/:fileId`, `POST .../duplicate` |
| Messages | `GET/POST/DELETE /api/rooms/:id/messages` |
| Permissions | `GET/POST /api/rooms/:id/permissions` |
| Execution | `GET/POST /api/rooms/:id/run` |
| AI | `POST /api/rooms/:id/ai` |
| Compiler | `GET /api/compile/languages`, `POST /api/compile` |
| Health | `GET /api/health` |

All room-scoped endpoints after room lookup require owner/member authorization. Invite URLs in
room payloads (`shareUrl`) are canonical server-generated URLs or `null` when disabled.

WebSockets: `GET /ws?roomId=…` (JSON room events) and `GET /yjs/<roomId>__<fileId>` (binary Yjs).
Both reject unauthenticated and non-member upgrades before the socket is accepted.

Authentication uses an httpOnly JWT cookie **and** a bearer token returned by login/register, so
reverse-proxied deployments and non-browser tools both work.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Enter` | Run the active file |
| `Ctrl/Cmd + S` | Force save / sync the CRDT document |
| `Shift + Alt + F` | Format document |
| `Ctrl/Cmd + B` | Toggle file explorer |
| `Ctrl/Cmd + J` | Toggle output terminal |
| `Alt + Z` | Toggle word wrap |
| `F11` | Toggle focus/zen mode |
| `Ctrl/Cmd + F` / `Ctrl/Cmd + H` | Find / replace |
| `Ctrl/Cmd + G` | Go to line |
| `?` | Open the shortcuts cheat sheet |

---

## Migrating from the previous Next.js version

The previous Next.js/Prisma implementation is preserved locally in `legacy-next/`
(gitignored) for reference; it is no longer part of the running stack.

Existing SQLite data can be imported into MongoDB, including user ids, bcrypt password hashes,
rooms, files, chat history, and permissions:

```bash
# inspect first (no writes)
node scripts/migrate-sqlite-to-mongo.mjs --dry-run

# replace the Mongo target with the legacy SQLite data
node scripts/migrate-sqlite-to-mongo.mjs --fresh

# or run without --fresh to upsert into an already-migrated database
npm run migrate:legacy
```

Run the end-to-end API smoke suite (server must be running):

```bash
npm run smoke            # full suite: config, auth, rooms, files, messages, permissions, run, WS, isolation
```

---

## Known Limitations

- **No public deployment was performed in this workspace.** No authorized domain, host credentials,
  or DNS access were supplied, so a real `https://` certificate and cross-network browser acceptance
  test remain outstanding. The production configuration is ready; see the deployment section.
- **Docker image build and Caddy TLS issuance were not executed here** because the local Docker
  daemon was unavailable. Compose configuration (base + production overlay) validates successfully,
  and the Caddyfile is a standard automatic-HTTPS reverse proxy, but its runtime behavior was not
  exercised in this environment.
- **WebSockets are mandatory** for collaboration. There is no long-polling fallback, by design.
  Networks that strip `Upgrade` headers cannot use live editing until the proxy/network is fixed.
- **Rate limiting is in-process.** Run a single app instance, or move limits to a shared store/edge.
- **Yjs rooms are coordinated per process.** Multi-instance horizontal scaling would need shared
  pub/sub (e.g. Redis) in addition to sticky sessions; it is not implemented here.
- **Code execution is resource-limited but not a VM-grade sandbox.** Timeouts/output caps and the
  Docker container boundary apply; do not offer arbitrary untrusted code execution to hostile users
  without stronger isolation (separate runner service, seccomp, network egress controls).
- **Internet access is required** for remote collaborators. CodeRoom does not bypass institutional
  firewalls, and no software needs to be installed on participant machines.

---

## Troubleshooting

**`MongooseServerSelectionError` / health says disconnected** — MongoDB is not reachable. Start
the local service (`services.msc` → MongoDB), run `docker compose up -d mongo`, or update
`MONGODB_URI` in `.env`.

**Vite opens but API calls fail** — Express is not running on port 3000. Use `npm run dev` (both
processes) and check `http://localhost:3000/api/health`.

**WebSocket connects then drops** — check that your proxy forwards `Upgrade`/`Connection` headers
for `/ws` and `/yjs`, and that the browser can reach `wss://<public-domain>`. There is no polling
fallback; allow WebSocket upgrades rather than bypassing the network.

**Invite link is disabled / says `PUBLIC_BASE_URL` missing** — set `PUBLIC_BASE_URL` to the public
HTTPS origin (no trailing slash, no path), set `CLIENT_ORIGIN` to the same origin, restart, and
check `GET /api/config` reports `inviteLinksEnabled: true`. Localhost/private HTTP URLs are
intentionally rejected.

**CORS error after changing domains** — set `CLIENT_ORIGIN` and/or `ALLOWED_ORIGINS` to the exact
browser origin, including scheme and port, without a trailing slash. Restart the server.

**Server exits with “AUTH_SECRET must be set…”** — production refuses the public development
fallback. Generate a unique secret (`openssl rand -base64 48`) and restart.

**HTTP 429 responses** — the API/route rate limits were hit. This can happen when many users share
one NAT IP. Wait for the window to reset or deploy shared/edge limits; do not disable protections
on a public host.

**Run button returns a missing-runtime message** — install `python3`/`gcc`/`javac` on the server
host and restart, or use the container image that includes the compilers.

**Production page returns JSON 404** — rebuild the client (`npm run build`) so `client/dist` exists
where Express serves it.

---

## License

Private project. All rights reserved unless a `LICENSE` file is added.
