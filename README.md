# CodeRoom

> **Code together. Anywhere.**

CodeRoom is a self-hosted, real-time collaborative coding workspace: Monaco (VS Code's editor),
Yjs CRDT synchronization, multi-language code execution, AI-assisted diagnostics, granular
permissions, an integrated terminal, and room chat — in the browser, over LAN or the internet.

The project previously ran on Next.js. It now uses a **traditional MERN server/client split**:

- **`client/`** — Vite + React 18 SPA (static build)
- **`server/`** — Express 4 + MongoDB (Mongoose) REST API + `ws` WebSockets

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
- [Responsive Workspace](#responsive-workspace)
- [LAN Access](#lan-access)
- [Docker Deployment](#docker-deployment)
- [Reverse Proxy](#reverse-proxy)
- [API Overview](#api-overview)
- [Keyboard Shortcuts](#keyboard-shortcuts)
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
- Resizable file explorer, editor, chat, and terminal panels
- Single-runner room mutex: one person runs code at a time with live "who is running" status
- Exit codes, elapsed time, clear output, stop execution, and output size/time limits
- Focus (zen) mode and a mobile four-tab workspace: Files / Editor / Output / Chat

### Files & rooms

- Nested folders, drag-free move/cut/copy/paste, duplicate, rename, recursive delete
- Public or password-protected rooms with 6-character join codes
- Share links, room settings, member management, and owner controls
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
In production Express serves `client/dist`, so HTTP and WebSockets share one port for simple LAN
and reverse-proxy setups.

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
│   │   ├── routes/            # auth, user, rooms, files, messages, permissions, run, ai, compile
│   │   ├── models/            # Mongoose schemas
│   │   ├── middleware/        # JWT auth
│   │   ├── ws/                # room-handler, yjs-handler
│   │   ├── services/          # compiler, code-runner, ai-service, cascade
│   │   ├── lib/               # auth, permissions, serializers, helpers
│   │   ├── app.ts / index.ts
│   │   └── seed.ts
│   ├── .env.example
│   └── package.json
├── .github/workflows/deploy.yml
├── Dockerfile
├── docker-compose.yml
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

### Production build

```bash
npm run build     # builds client/dist, then server/dist
npm start         # Express serves the SPA + API on :3000
```

---

## Environment Variables

The server reads `server/.env` first, then falls back to the repository-root `.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/coderoom` | Mongo connection string |
| `AUTH_SECRET` | dev fallback | JWT signing secret (≥32 chars in production) |
| `PORT` | `3000` | Express/WebSocket port |
| `HOST` | `0.0.0.0` | Bind address (use `0.0.0.0` for LAN) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin in production |
| `GEMINI_API_KEY` | empty | Enables Gemini diagnostics/review |
| `OPENAI_API_KEY` | empty | Enables OpenAI diagnostics/review |
| `SEED_DATABASE` | `false` | Docker entrypoint seeds demo data when `true` |

The client requires no build-time environment variables: it uses same-origin `/api`, `/ws`, and
`/yjs` (proxied by Vite in development).

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
| `npm run docker:up` | Builds and starts app + MongoDB |
| `npm run docker:down` | Stops the stack |
| `npm run docker:logs` | Follows container logs |

Within `server/`: `dev`, `build`, `start`, `typecheck`, `seed`.
Within `client/`: `dev`, `build`, `preview`, `typecheck`.

---

## Real-Time Collaboration

1. Opening a file connects to `/yjs/<roomId>__<fileId>` with a JWT (`?token=`, header, or cookie).
2. The server restores `yjsState` (or seeds from `content`) and performs the Yjs sync handshake.
3. Edits are exchanged as binary CRDT updates; awareness carries cursors, names, and colors.
4. Updates from users without file edit permission are dropped server-side (read-only enforcement).
5. Changes autosave after 2s of inactivity, on last disconnect, and on graceful shutdown.
6. `/ws?roomId=…` carries presence, chat, file-tree events, permission changes, and execution state.

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

---

## Responsive Workspace

- Mobile bottom tabs: **Files / Editor / Output / Chat** with unread chat badge
- Side panels become slide-over drawers on small screens instead of squeezing the editor
- `100dvh` layout with safe-area padding, 44px touch targets, and scrollable dialogs
- Touch-friendly Monaco (word wrap, adaptive font size) and auto-switch to Output on run
- Dashboard/search/filters collapse cleanly; landing and auth pages are usable down to 320px

---

## LAN Access

1. Set `HOST=0.0.0.0` and start the server.
2. Find the host machine's LAN IP (`ipconfig` / `ip addr`).
3. Open `http://<lan-ip>:3000` from another device.

The server prints all detected LAN URLs at startup. Allow port 3000 through the host firewall.
In development, open `http://<lan-ip>:5173` and ensure the Vite proxy targets the host's `:3000`.

---

## Docker Deployment

```bash
cp .env.docker.example .env
# set AUTH_SECRET, CLIENT_ORIGIN, optional AI keys

docker compose up -d --build
# app:   http://localhost:3000
# mongo: internal service with the coderoom-mongo volume
```

Useful commands:

```bash
docker compose logs -f coderoom
docker compose down
docker compose up -d --build        # rebuild after code changes
SEED_DATABASE=true docker compose up -d   # seed demo data
```

The Compose stack runs MongoDB 7 with a named volume (`coderoom-mongo`). To use Atlas instead,
set `MONGODB_URI` in `.env` and remove or ignore the `mongo` service.

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

Caddy equivalent:

```caddy
coderoom.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set `CLIENT_ORIGIN=https://coderoom.example.com` in production.

---

## API Overview

Full request/response shapes live in [`MERN_SPEC.md`](./MERN_SPEC.md). Summary:

| Area | Endpoints |
| --- | --- |
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

WebSockets: `GET /ws?roomId=…` (JSON room events) and `GET /yjs/<roomId>__<fileId>` (binary Yjs).

Authentication uses an httpOnly JWT cookie **and** a bearer token returned by login/register, so
LAN clients and non-browser tools both work.

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
npm run smoke            # 38 checks: auth, rooms, files, messages, permissions, run, WS
```

---

## Troubleshooting

**`MongooseServerSelectionError` / health says disconnected** — MongoDB is not reachable. Start
the local service (`services.msc` → MongoDB), run `docker compose up -d mongo`, or update
`MONGODB_URI` in `.env`.

**Vite opens but API calls fail** — Express is not running on port 3000. Use `npm run dev` (both
processes) and check `http://localhost:3000/api/health`.

**WebSocket connects then drops** — check that your proxy forwards `Upgrade`/`Connection` headers
for `/ws` and `/yjs`.

**Run button returns a missing-runtime message** — install `python3`/`gcc`/`javac` on the host and
restart the server so the PATH is reloaded, or rely on the cloud fallback.

**Production page returns JSON 404** — rebuild the client (`npm run build`) so `client/dist` exists
where Express serves it.

---

## License

Private project. All rights reserved unless a `LICENSE` file is added.
