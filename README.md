# CodeRoom 🚀

> **"Code together. Anywhere."**

A lightweight, full-stack, collaborative code room designed for teams, classmates, and friends. CodeRoom combines the real-time synchronization of Google Docs, the power of Monaco Editor (VS Code), and built-in room chat into an intuitive, self-hosted web application accessible seamlessly over both **Local Area Networks (LAN)** and the **Public Internet**.

---

## Table of Contents

- [Overview & Features](#overview--features)
- [Technology Stack](#technology-stack)
- [Architecture & Real-Time Sync](#architecture--real-time-sync)
- [System Requirements](#system-requirements)
- [Quick Start & Installation](#quick-start--installation)
- [LAN Access (Local Wi-Fi / Ethernet)](#lan-access-local-wi-fi--ethernet)
- [Docker Deployment](#docker-deployment)
  - [Using Docker Compose (Recommended)](#1-using-docker-compose-recommended)
  - [Using Standalone Docker](#2-using-standalone-docker)
  - [Persistent Database Storage](#3-persistent-database-storage)
  - [Docker Environment Variables](#4-docker-environment-variables)
- [Internet Deployment & Reverse Proxy](#internet-deployment--reverse-proxy)
  - [Nginx Configuration](#nginx-configuration-with-websockets)
  - [Caddy Configuration](#caddy-configuration)
- [Database & Seed Data](#database--seed-data)
- [Testing & Verification](#testing--verification)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview & Features

- **Real-Time Code Collaboration**: True CRDT (Conflict-free Replicated Data Type) collaborative text editing powered by **Yjs** and **Monaco Editor**. Concurrent edits merge seamlessly without entire file replacements.
- **Remote Cursors & Presence**: Collaborator cursors, selections, and username tags display in real time with unique deterministic colors.
- **Hierarchical File Explorer**: Create, rename, delete, and switch between code files and folders with language auto-detection for 15+ programming languages (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.cpp`, `.c`, `.java`, `.html`, `.css`, `.json`, `.md`, `.sql`, etc.).
- **Built-in Room Chat**: Fast, real-time WebSocket room messaging with instant delivery, conversation history, and SQLite persistence.
- **Smart Debounced Autosave**: Automatic persistence to SQLite without hitting the database on every keystroke.
- **Self-Hosted & Data Ownership**: Zero reliance on Firebase, Supabase, or external cloud backends. All accounts, code files, rooms, and chat logs are stored locally on your own server.
- **Session Authentication**: Secure HTTP-only cookies, password hashing with bcrypt, session expiration, and remember-me support.
- **Room Access Control**: Public rooms and password-protected rooms with owner controls (rename, modify description, delete room).
- **LAN + Internet Ready**: Binds to `0.0.0.0`, dynamically detects local network IPs, and provides one-click invite links with automatic host detection.
- **Responsive Interface**: 3-panel developer workspace for desktop/laptop with collapsible panels, and a responsive tab system (`Files | Editor | Chat`) for tablets and mobile devices.

---

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide React
- **Backend & WebSockets**: Node.js HTTP server, Next.js API Routes, `ws` WebSocket server handling `/ws` (chat & presence) and `/yjs` (CRDT code sync) on a single port
- **Real-Time Engine**: Yjs, `y-protocols` (Sync & Awareness), Custom Monaco-Yjs CRDT binding
- **Database**: Prisma ORM with SQLite (migratable to PostgreSQL)
- **Authentication**: Stateless signed JWT session cookies with HTTP-only security and bcrypt password hashing
- **Package Manager**: `pnpm`

---

## Architecture & Real-Time Sync

CodeRoom attaches WebSocket servers to the same Node.js HTTP server that handles Next.js requests, allowing WebSockets and HTTP traffic to share a single port (default: `3000`):

```text
User Browser A                           User Browser B
    │                                         │
    ├─ Monaco Editor (y-monaco)               ├─ Monaco Editor (y-monaco)
    ├─ Y.Doc (CRDT state)                     ├─ Y.Doc (CRDT state)
    └─ WebSockets (/yjs & /ws)                └─ WebSockets (/yjs & /ws)
             ▲                                         ▲
             │                                         │
             └──────────────────┬──────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   CodeRoom Node Server   │
                   │   (Port 3000: HTTP/WS)   │
                   ├─────────────────────────┤
                   │ • Next.js Request Handler│
                   │ • /yjs Yjs CRDT Server  │
                   │ • /ws Room & Chat Events│
                   │ • Debounced DB Autosave │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │    SQLite Database      │
                   │ (Users, Rooms, Files,   │
                   │    Messages, Members)   │
                   └─────────────────────────┘
```

### Real-Time Sync Flow

1. When a user opens a file in a room, the client connects to `/yjs/${roomId}__${fileId}`.
2. The server loads existing file contents from SQLite and synchronizes with Yjs binary protocol.
3. Every keystroke is emitted as a binary CRDT update; conflicting edits resolve deterministically.
4. Active collaborator selections and cursor locations are broadcast via Yjs Awareness protocol.
5. Inactivity for 2 seconds automatically triggers a debounced save to the SQLite database.
6. When the last client disconnects from a file, any pending changes are immediately flushed to the database.

---

## System Requirements

- **Node.js**: `v20.x` or higher
- **Package Manager**: `pnpm` (`v9.x` recommended)
- **Operating System**: Linux, macOS, or Windows

---

## Quick Start & Installation

### 1. Clone the repository

```bash
cd /home/khansalman/Code/LAN-Share
```

### 2. Install dependencies with pnpm

```bash
pnpm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review configuration in `.env`:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-secure-random-secret-key"
PORT=3000
HOST=0.0.0.0
```

### 4. Initialize Database

Push the Prisma schema to generate the local SQLite database and seed initial demo data:

```bash
pnpm run db:push
pnpm run db:seed
```

This creates demo accounts:
- Username: `demo` / Password: `password123`
- Username: `collaborator` / Password: `password123`
- Demo room code: `DEMO01`

### 5. Build and Start the Application

Build the optimized Next.js production build:

```bash
pnpm run build
```

Start the CodeRoom server:

```bash
pnpm start
```

Or for development with live reload:

```bash
pnpm run dev
```

Open your browser at `http://localhost:3000`.

---

## LAN Access (Local Wi-Fi / Ethernet)

The server binds to `0.0.0.0`, enabling anyone connected to your local network (Wi-Fi or Ethernet) to access CodeRoom directly without an internet connection.

### 1. Find your server's LAN IP address on Linux

Run:

```bash
hostname -I
# or
ip addr show | grep inet
```

Example output:

```text
192.168.1.105
```

### 2. Start the server

```bash
pnpm start
```

When CodeRoom starts, it automatically outputs all detected network IP addresses in your terminal:

```text
=======================================================
🚀 CodeRoom Server is running!
📡 Local:    http://localhost:3000
🌐 Network:  http://192.168.1.105:3000
⚡ Real-time WebSockets attached to port 3000
=======================================================
```

### 3. Connect from other devices on the same Wi-Fi

Open any phone, laptop, or tablet connected to the same Wi-Fi network and navigate to:

```text
http://192.168.1.105:3000
```

### 4. Share Room

Inside any room, click the **Share** button in the top navigation bar. CodeRoom dynamically detects the current browser host and generates a one-click invite link (e.g. `http://192.168.1.105:3000/room/X7K29P`) and a 6-character room code.

---

## Docker Deployment 🐳

CodeRoom provides a production-optimized multi-stage `Dockerfile` and `docker-compose.yml` configuration with:
- Multi-stage build (`node:20-bookworm-slim`) for minimal image footprint.
- Built-in SQLite persistence via Docker volumes (`/app/data`).
- Automatic database table generation (`prisma db push`) on startup via `docker-entrypoint.sh`.
- Non-root execution (`node` user) for container security.
- Integrated Docker health check (`curl http://localhost:3000/`).
- Built-in WebSocket and HTTP support on a single exposed port.

### 1. Using Docker Compose (Recommended)

1. **Configure Environment** (Optional):
   ```bash
   cp .env.docker.example .env
   ```
   You can customize `AUTH_SECRET` (at least 32 random characters), `PORT`, and whether to seed demo accounts (`SEED_DATABASE=true`).

2. **Build and Run**:
   ```bash
   docker compose up -d --build
   ```
   Or using the npm helper script:
   ```bash
   pnpm run docker:up
   ```

3. **Check Logs & Status**:
   ```bash
   docker compose logs -f
   # or
   pnpm run docker:logs
   ```

4. **Stop Container**:
   ```bash
   docker compose down
   # or
   pnpm run docker:down
   ```

---

### 2. Using Standalone Docker

1. **Build the Image**:
   ```bash
   docker build -t coderoom:latest .
   ```

2. **Create a Persistent Volume**:
   ```bash
   docker volume create coderoom-data
   ```

3. **Run the Container**:
   ```bash
   docker run -d \
     --name coderoom \
     --restart unless-stopped \
     -p 3000:3000 \
     -v coderoom-data:/app/data \
     -e AUTH_SECRET="your-super-secure-random-secret-key-at-least-32-chars" \
     -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
     -e SEED_DATABASE="false" \
     coderoom:latest
   ```

---

### 3. Persistent Database Storage

CodeRoom stores SQLite data inside `/app/data/coderoom.db` within the container.
- When using Docker Compose, the named volume `coderoom-data` is mounted to `/app/data`.
- All registered users, rooms, collaborative files, and chat messages are preserved across container updates and rebuilds.
- To inspect or backup the database:
  ```bash
  docker cp coderoom:/app/data/coderoom.db ./coderoom-backup.db
  ```

---

### 4. Docker Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Node.js server listens on |
| `HOST` | `0.0.0.0` | Host interface to bind to (`0.0.0.0` enables LAN access) |
| `DATABASE_URL` | `file:/app/data/coderoom.db` | SQLite database file location inside container |
| `AUTH_SECRET` | `coderoom-lan-super-secret...` | Secret key for signing session JWT tokens (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base URL used for invite links and QR codes |
| `SEED_DATABASE` | `false` | Set to `true` on initial launch to create demo users (`demo`, `collaborator`) and room `DEMO01` |

---

### 5. LAN Access with Docker

To allow phones, tablets, and other laptops on your local Wi-Fi to connect:
- Ensure port `3000` is opened in your host's firewall (e.g. `sudo ufw allow 3000`).
- Connect using `http://<HOST-LAN-IP>:3000` (find your IP with `hostname -I`).
- *(Optional on Linux)*: To let the Node.js process directly detect and print your local network IPs in the console banner, uncomment `network_mode: host` in `docker-compose.yml` and comment out the `ports:` block.

---

## Internet Deployment & Reverse Proxy

CodeRoom is self-contained and can be deployed to any VPS (Ubuntu, Debian, etc.).

### 1. Run as a Systemd Service

Create `/etc/systemd/system/coderoom.service`:

```ini
[Unit]
Description=CodeRoom Collaborative Platform
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/coderoom
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now coderoom
```

### 2. Nginx Configuration (with WebSockets)

Create `/etc/nginx/sites-available/coderoom`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name coderoom.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable HTTPS with Certbot:

```bash
sudo certbot --nginx -d coderoom.yourdomain.com
```

### 3. Caddy Configuration

If using Caddy, WebSocket upgrade is handled automatically:

```caddy
coderoom.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

---

## Database & Seed Data

Prisma manages the SQLite database schema in `prisma/schema.prisma`.

### Available Database Commands

```bash
# Push schema updates to dev.db
pnpm run db:push

# Seed development database with demo accounts and files
pnpm run db:seed
```

### Prisma Schema Models

- **User**: `id`, `username`, `passwordHash`, `createdAt`, `updatedAt`
- **Room**: `id`, `roomCode`, `name`, `description`, `passwordHash`, `isPublic`, `ownerId`
- **RoomMember**: `id`, `roomId`, `userId`, `role` (OWNER / MEMBER), `joinedAt`
- **File**: `id`, `roomId`, `parentId` (hierarchical folders), `name`, `type`, `language`, `content`
- **Message**: `id`, `roomId`, `userId`, `content`, `createdAt`

---

## Testing & Verification

CodeRoom comes with an automated end-to-end verification script testing:
1. User registration & validation
2. Password authentication & secure HTTP-only cookies
3. Room creation, joining, and permissions
4. File CRUD and syntax language detection
5. Real-time WebSocket room chat and presence
6. Yjs binary CRDT document synchronization and concurrent edit convergence
7. Database autosave debouncing

To run the verification suite against a running server:

```bash
pnpm test
# or
pnpm exec tsx test-coderoom.ts
```

All 32 test cases verify real HTTP and WebSocket operations.

---


## License

MIT License. Open source and self-hostable.
