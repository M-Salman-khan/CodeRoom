# CodeRoom — MERN Migration Spec (shared contract)

This document is the single source of truth for the migration from Next.js to a traditional
**MERN (MongoDB + Express + React + Node)** server/client architecture.

Two workstreams run in parallel:

- `server/` — Express + Mongoose + `ws` + Yjs. **Owned by the server agent.**
- `client/` — Vite + React 18 + React Router + Tailwind + Monaco. **Owned by the client agent.**

Do not edit the other team's directory, the legacy `src/` tree, or root files while the
migration is in progress. The lead agent will update root scripts, Docker, README and archive
the old Next.js app after both workstreams finish.

---

## 1. Target architecture

```
CodeRoom/
  client/                 # Vite React SPA (static build in client/dist)
    index.html
    vite.config.ts
    tailwind.config.ts
    postcss.config.js
    tsconfig.json
    src/
      main.tsx  App.tsx  index.css
      pages/  components/  context/  lib/  hooks/
  server/                 # Express API + WebSocket server
    package.json  tsconfig.json  .env.example
    src/
      index.ts  app.ts  seed.ts
      config/  models/  routes/  middleware/  ws/  services/  lib/
  legacy-next/            # old Next app, archived later by the lead (do not touch)
```

Ports:

| Service | Dev | Production |
| --- | --- | --- |
| Express API + WS | `http://localhost:3000` | same |
| Vite dev server | `http://localhost:5173` | n/a (served by Express) |

In dev, Vite proxies `/api`, `/ws`, `/yjs` to `http://localhost:3000`.
In production, Express serves `client/dist` and falls back to `index.html` for non-API routes,
so everything is on one port (`3000`) for LAN access.

Package manager inside each workstream: **npm** (run `npm install` inside `client/` or
`server/`; do not run pnpm at the repo root).

---

## 2. Environment

MongoDB is already running locally at `mongodb://127.0.0.1:27017/coderoom`.

`server/.env.example` and `server/.env`:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
MONGODB_URI=mongodb://127.0.0.1:27017/coderoom
AUTH_SECRET=coderoom-lan-super-secret-key-at-least-32-chars-long
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=
OPENAI_API_KEY=
```

The server should also fall back to the repo-root `.env` when a variable is missing
(the root `.env` already contains `AUTH_SECRET` and a `GEMINI_API_KEY`).
Never expose `AUTH_SECRET`, `passwordHash` or `yjsState` to the client.

---

## 3. Authentication

- JWT signed with `AUTH_SECRET` (HS256), payload `{ userId, username }`, using `jose`.
- Delivered two ways:
  1. httpOnly cookie `coderoom_session` (`sameSite=lax`, `path=/`, 7d or 30d when `rememberMe`).
  2. `token` in the JSON response — the SPA stores it in `localStorage`/`sessionStorage`
     and sends `Authorization: Bearer <token>`.
- Protected middleware accepts Bearer header **or** the cookie, verifies the JWT, confirms the
  user still exists in MongoDB, and exposes `req.user = { id, username }`.
- WebSocket upgrades accept `?token=`, `Authorization` header, or the cookie. The upgrade is
  rejected (`401`) before the socket is accepted unless the session is valid, and rejected (`403`)
  unless the user is the room owner or has a membership record for the requested room.
- Passwords: bcryptjs (10 rounds). Username validation: 3–30 chars, `[a-zA-Z0-9_-]+`.
  Password: 8–128 chars. Login is case-insensitive on username.

---

## 4. Data model (Mongoose)

Use **string `_id` values** (`new mongoose.Types.ObjectId().toString()`) on every model so all
foreign keys are plain strings and JSON ids map 1:1 to the old Prisma ids. Collections:

### users
`_id`, `username` (unique, indexed), `passwordHash`, `createdAt`, `updatedAt`

### rooms
`_id`, `roomCode` (unique, indexed), `name`, `description` (nullable), `passwordHash` (nullable),
`isPublic` (default true), `ownerId` (indexed, ref users), `createdAt`, `updatedAt`

### roommembers
`_id`, `roomId` (indexed, ref rooms), `userId` (indexed, ref users),
`role` (`OWNER` | `EDITOR` | `MEMBER`), `canEdit` (default false),
`allowedFiles` (`string[]`, default `[]`), `joinedAt`.
Unique compound index `{ roomId, userId }`.

### files
`_id`, `roomId` (indexed, ref rooms), `parentId` (nullable string, indexed), `name`,
`type` (`file` | `folder`), `language` (nullable, default `plaintext`), `content` (default ""),
`yjsState` (`Buffer`, nullable), `createdAt`, `updatedAt`.

### messages
`_id`, `roomId` (indexed), `userId` (indexed), `content`, `createdAt`.
Index `{ roomId: 1, createdAt: 1 }`.

### permissionrequests
`_id`, `roomId` (indexed), `userId` (indexed), `fileId` (nullable, indexed),
`status` (`PENDING` | `APPROVED` | `DECLINED`, default `PENDING`), `createdAt`, `updatedAt`.

**Serialization rule:** every JSON object returned by the API must have `id` (string) and must
not leak `_id`, `__v`, `passwordHash` or `yjsState`. `createdAt`/`updatedAt`/`joinedAt` are ISO
strings. Provide small serializer helpers rather than relying on ad-hoc transforms.

**Cascade rule:** MongoDB has no cascades. Implement them explicitly:
- delete room → delete its members, files, messages, permission requests;
- delete folder → recursively delete descendant folders/files and their permission requests;
- delete user → delete owned rooms (cascade) and memberships/messages/requests.

---

## 5. REST API contract (must match exactly)

All routes are under `/api`. Errors use `{ "error": "message" }` with the listed status.
Success responses are JSON. Protected routes return `401 { "error": "Unauthorized" }`.
Room-scoped resources return `403 {error,code:"ROOM_MEMBERSHIP_REQUIRED"}` to non-members before
reading room data. Only room lookup/join may create membership.

### Runtime config

`GET /api/config` (public) →

```jsonc
{
  "environment": "production",
  "publicBaseUrl": "https://coderoom.example.com", // or null
  "publicBaseUrlSource": "PUBLIC_BASE_URL",        // or "CLIENT_ORIGIN" / null
  "isPublicBaseUrl": true,
  "inviteLinksEnabled": true,
  "collaboration": {
    "transport": "websocket", "yjs": true, "fallback": false,
    "roomEventsPath": "/ws", "documentPath": "/yjs"
  }
}
```

`inviteLinksEnabled` is false unless `PUBLIC_BASE_URL` is a public HTTPS origin (or the explicit
development-only private override is enabled). Room payloads expose the canonical `shareUrl` or
`null`; clients must never derive invite links from `window.location.origin`.

### Auth

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{username,password,confirmPassword}` | `201 {success,user:{id,username},token}` |
| POST | `/api/auth/login` | `{username,password,rememberMe?}` | `200 {success,user:{id,username},token}` |
| GET | `/api/auth/me` | — | `200 {user:{id,username},token}` / `401 {user:null}` |
| POST | `/api/auth/logout` | — | `{success,message}`, clears cookie |
| GET | `/api/user` | — | `{user:{id,username,createdAt}}` |
| PATCH | `/api/user` | `{currentPassword,newPassword}` | `{success,message}` |

Register/login responses must also set the session cookie (login honors `rememberMe` for
cookie max-age).

### Rooms

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/rooms` | Rooms where user is owner or member, newest `updatedAt` first. Response `{rooms:[{id,roomCode,name,description,isPublic,hasPassword,ownerId,owner:{id,username},createdAt,updatedAt,shareUrl,_count:{members,files}}]}` |
| POST | `/api/rooms` | `{name,description?,password?,isPublic?}` → `201 {room}`. Name ≤80 chars, description ≤1000, password ≤128. Generates a unique cryptographically random 8-char code (existing 6-char codes remain valid). Seeds members (OWNER) + two files: `main.ts` (typescript, welcome content) and `README.md` (markdown). |
| GET | `/api/rooms/:roomId` | Look up by **id or roomCode**. Returns the full room payload below, or `{requiresPassword:true, room:{id,roomCode,name,description,isPublic,hasPassword:true}}` when a non-member hits a password-protected room. Auto-joins the room as `MEMBER` when public / no password. |
| PATCH | `/api/rooms/:roomId` | Owner only: `{name?,description?,isPublic?,password?}` (`password:""` clears). → `{success,room}` |
| DELETE | `/api/rooms/:roomId` | Owner only → `{success,message}` |
| POST | `/api/rooms/:roomId/join` | `{password?}` → `{success,roomId,roomCode}`; `403 {error,requiresPassword:true}`. Join attempts are rate-limited. |

`GET /api/rooms/:roomId` room payload:

```jsonc
{
  "room": {
    "id": "...", "roomCode": "ABC123", "name": "...", "description": null,
    "isPublic": true, "hasPassword": false, "ownerId": "...",
    "owner": { "id": "...", "username": "..." },
    "members": [{ "id": "...", "userId": "...", "username": "...", "role": "OWNER",
                  "canEdit": true, "allowedFiles": [], "joinedAt": "ISO" }],
    "pendingRequests": [{ "id","userId","username","fileId","fileName","createdAt" }],
    "createdAt": "ISO", "updatedAt": "ISO",
    "shareUrl": "https://coderoom.example.com/room/ABC123" // or null
  },
  "isOwner": true,
  "userRole": "OWNER" | "EDITOR" | "MEMBER",
  "canEdit": true,
  "allowedFiles": ["*"] ,
  "myPendingRequests": [{ "id","fileId","fileName","status","createdAt" }]
}
```

`pendingRequests` is owner-only (empty array for everyone else). `shareUrl` is generated on the
server from `PUBLIC_BASE_URL` and is `null` when invite links are disabled.

### Files

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/rooms/:roomId/files` | Requires membership. `{files:[...]}` sorted folders first then name asc. Ids in order stable. |
| POST | `/api/rooms/:roomId/files` | `{name,type?="file",parentId?=null,content?=""}` → `201 {file}`. Requires membership + room-wide edit permission. Names ≤120 chars, no `/`, `\`, or control characters. Content ≤1,000,000 UTF-8 bytes (`413`). Reject duplicate name in same parent with `409`. Build initial Yjs state (`Y.Doc`, text key `monaco`) for files. |
| GET | `/api/rooms/:roomId/files/:fileId` | Requires membership → `{file}` |
| PATCH | `/api/rooms/:roomId/files/:fileId` | Requires membership + edit permission on that file. `{name?,content?,language?,parentId?}` → `{file}`. Same name/size validation; `content` updates also rebuild `yjsState`. Prevent moving into itself / own descendant, validate destination folder, duplicate names. |
| DELETE | `/api/rooms/:roomId/files/:fileId` | Requires membership + edit permission → `{success,message}` |
| POST | `/api/rooms/:roomId/files/:fileId/duplicate` | Requires membership + edit permission. `{targetParentId?}` → duplicate file or recursive folder copy, unique names (`x copy`, `x copy 2`). Response `{files:[...]}` (all created). |

File JSON: `{id,roomId,parentId,name,type,language,content,createdAt,updatedAt}`.

### Messages

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/rooms/:roomId/messages?limit=50` | Requires membership. newest `limit` (max 100), returned oldest→newest. `{messages:[{id,roomId,userId,username,content,createdAt}]}` |
| POST | `/api/rooms/:roomId/messages` | Requires membership. `{content}` non-empty, ≤2,000 chars → `201 {message}` and broadcast `chat:message` |
| DELETE | `/api/rooms/:roomId/messages` | Owner only: clear all → `{success,message}` + broadcast `chat:clear` |

### Permissions

`GET /api/rooms/:roomId/permissions` →
`{isOwner,canEdit,allowedFiles,members:[...],pendingRequests:[...],myPendingRequests:[...]}`

`POST /api/rooms/:roomId/permissions` with `{action}`:

- `request` `{fileId?}` — find-or-create PENDING request; broadcast `permission:request`;
  respond `{success,request:{id,userId,username,fileId,fileName,createdAt}}`.
- `grant` `{targetUserId,fileId?,scope?}` (owner only) — `scope:"room"` or no `fileId` sets
  `canEdit=true`; otherwise appends `fileId` to `allowedFiles`. Approve matching requests.
  Broadcast `permission:updated` `{permission:{userId,roomId,canEdit,allowedFiles,approvedFileId,scope,grantedBy}}`.
- `revoke` `{targetUserId,fileId?,scope?}` (owner only) — clear room-wide or remove one file.
  Broadcast `permission:revoked` `{permission:{...,revokedFileId,scope,revokedBy}}`.
- `decline` `{requestId?|targetUserId?,fileId?}` (owner only) — mark DECLINED;
  broadcast `permission:declined`.
- `cancel` `{requestId?|fileId?}` — user cancels own pending request; broadcast `permission:cancelled`.

Edit checks: owner always edits; `canEdit` edits everything; `allowedFiles` may contain specific
file ids or `"*"`.

### Execution

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/rooms/:roomId/run` | `{execution:{isRunning,userId,username,fileId,fileName,startTime}}` |
| POST | `/api/rooms/:roomId/run` | `{action:"run"\|"stop",fileId?,code?}` |

Run requires owner, member, or public room. Enforce a **single room-wide runner mutex**.
If busy → `409 {error,runningBy,runningFile,isRunning:true}`.
On run broadcast `execution:start`; on finish broadcast `execution:end` with
`{stdout,stderr,exitCode,executionTimeMs,killed,error?,runBy,fileName}`.
Respond `{success,result}`. Stop is allowed for the runner or the owner; broadcast
`execution:end` with `killed:true, stoppedBy`. Execution timeout 10s, output capped at 500 KB.

### AI

`POST /api/rooms/:roomId/ai` — `{action:"debug"|"review", fileName, code, error?, stdout?}` →
`{success,result}`. Reuse the existing dual Gemini/OpenAI + heuristic engine; if no key,
return the heuristic result (never 500 just because a key is missing).

### Compiler (standalone playground)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/compile/languages` | `{success,languages,total}` |
| POST | `/api/compile` | Requires authentication + execution rate limit. `{code,language,stdin?,filename?,preferEngine?="auto",timeoutMs?=10000}` → `{success,result,language}`. Clamp timeout to 1-20s. |

### Health

`GET /api/health` → `200 {status:"healthy",timestamp,uptime,database:"connected"}` when Mongo is
connected, otherwise `503` with `status:"unhealthy"`, `database:"disconnected"`, `error`.
`GET /api/config` is public and described in §5.

The API applies CORS allowlisting, `express-rate-limit` (API, auth, join, create, writes, chat,
permissions, run, AI), `express.json({limit:"2mb"})`, security headers, and HSTS on secure
requests.

---

## 6. WebSocket contract

One `WebSocketServer({ noServer:true, maxPayload: 2MB })` sharing the HTTP server, routed on `upgrade`.

### `/ws?roomId=<roomId>` — room events

Auth from query/header/cookie. The upgrade is rejected with `401` without a valid session and `403`
unless the user is the room owner/member; room codes are resolved to canonical ids. In production,
cross-origin browser upgrades are rejected against the same exact allowlist used for CORS (plus
same-host requests). Server keeps `Map<roomId, Set<client>>`.

Server → client messages (JSON):

```jsonc
{ "type":"presence:update", "onlineUsers":[{id,username}], "execution":{...} }
{ "type":"chat:message", "message":{id,roomId,userId,username,content,createdAt} }
{ "type":"chat:clear", "clearedBy":"username" }
{ "type":"file:create"|"file:rename"|"file:update", "file":{...} }
{ "type":"file:delete", "fileId":"..." }
{ "type":"room:update", "room":{...} }
{ "type":"execution:start", "execution":{isRunning,userId,username,fileId,fileName,startTime} }
{ "type":"execution:end", "result":{stdout,stderr,exitCode,executionTimeMs,killed,error?,runBy?,fileName?,stoppedBy?} }
{ "type":"execution:update", "execution":{...} }
{ "type":"permission:request", "request":{...} }
{ "type":"permission:updated"|"permission:revoked", "permission":{...} }
{ "type":"permission:declined", "requestId","targetUserId","fileId","declinedBy" }
{ "type":"permission:cancelled", "userId","fileId" }
{ "type":"code:run", "user":{id,username}, "filename","language","result","timestamp" }
```

Client → server messages: `{type, payload}` for
`presence:query`, `execution:query`, `execution:stop`, `chat:send` (`payload.content`),
`chat:clear`, `file:create|rename|delete|update`, `room:update`, `code:run`,
`permission:request|grant|decline|revoke|cancel`.

Only the owner may grant/decline/revoke or clear chat. Persist every write to MongoDB before
broadcasting. Chat frames are capped at 2,000 characters and 20 messages/10s per socket.
Ping/pong keep-alive every 30s; terminate dead sockets; recompute presence on close.

### `/yjs/<roomId>__<fileId>` — CRDT documents

The upgrade is rejected unless the user is the room owner/member; the room key may be an id or
code and is rewritten to the canonical id. Non-members cannot read the document. Use
`y-websocket` on the client (`new WebsocketProvider(wsUrl, `${roomId}__${fileId}`, ydoc, { params:{token} })`).
Implement the same protocol as `src/server/yjs-handler.ts`: message types 0 (sync), 1 (awareness),
3 (query awareness); `Y.Doc` text key `monaco`; seed from `file.yjsState` or `file.content`;
broadcast updates; debounce persistence of `{content, yjsState}` by 2s; flush on last disconnect,
on shutdown, and keep the doc in memory for 5 minutes after the last client leaves.
Reject/ignore sync **updates** from users without edit permission.

Production build note: the client's Yjs URL must be same-origin (`window.location.host`), which
works through the Vite proxy in dev and Express in production.

---

## 7. Server implementation notes

- Express 4, `cors` with `credentials:true` and an exact production allowlist built from
  `PUBLIC_BASE_URL`, `CLIENT_ORIGIN`, and `ALLOWED_ORIGINS`. Development allows LAN origins.
- `app.set("trust proxy", TRUST_PROXY)` (0 direct, 1 behind Caddy/Nginx).
- `cookie-parser`, `express.json({ limit: "2mb" })`, `express-rate-limit`, security headers and HSTS.
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production over HTTPS.
- Static: `express.static(clientDist)` + SPA fallback (`app.get("*")` excluding `/api`, `/ws`, `/yjs`).
- TypeScript in strict mode, CommonJS output (`tsconfig`: target ES2022, module commonjs,
  moduleResolution node, outDir dist, rootDir src, esModuleInterop true).
- Scripts: `dev: tsx watch src/index.ts`, `build: tsc -p tsconfig.json`,
  `start: node dist/index.js`, `typecheck: tsc --noEmit`, `seed: tsx src/seed.ts`.
- Dependencies: express, mongoose, bcryptjs, jose, cookie-parser, cors, express-rate-limit, ws,
  yjs, y-protocols, lib0, dotenv. Dev: typescript, tsx, @types/express, @types/node, @types/ws,
  @types/cookie-parser, @types/cors, @types/bcryptjs.
- Reuse (copy, then fix imports) from the legacy tree:
  - `src/lib/compiler.ts` → `server/src/services/compiler.ts` (774 lines, self-contained Node code)
  - `src/server/code-runner.ts` → `server/src/services/code-runner.ts` (update `@/lib/compiler`)
  - `src/server/ai-service.ts` → `server/src/services/ai-service.ts`
  - `src/server/yjs-handler.ts` → `server/src/ws/yjs-handler.ts` (Mongoose instead of Prisma)
  - `src/server/room-handler.ts` → `server/src/ws/room-handler.ts` (Mongoose instead of Prisma)
  - `src/lib/utils.ts` → `server/src/lib/utils.ts` (`generateRoomCode` via `crypto.randomInt`,
  `getLanguageFromFilename`)
- Startup: validate production env, connect Mongo, log the local/public origins, start HTTP + WS,
  add graceful SIGTERM/SIGINT shutdown that flushes Yjs docs and closes Mongo. Do not advertise
  LAN-only URLs in production.
- Seed (`npm run seed`): users `demo` / `collaborator` (password `password123`) and room
  `DEMO01` "Getting Started with CodeRoom" with the same nested `src/index.ts`, `src/utils.ts`,
  `README.md`, plus two welcome chat messages. Make seed idempotent (drop/replace demo data).

---

## 8. Client implementation notes

Port the existing UI faithfully; do **not** redesign from scratch. Reuse the legacy files:

- `src/components/ui/*` → `client/src/components/ui/*` (all shadcn/Radix primitives)
- `src/components/room/*` → `client/src/components/room/*`
- `src/components/{CreateRoomModal,JoinRoomModal,ThemeToggle}.tsx`
- `src/context/ThemeContext.tsx`
- `src/lib/{utils.ts,y-monaco.ts}`
- `src/app/globals.css` → `client/src/index.css` (+ Geist `@font-face` rules)
- `src/app/{page,dashboard,login,register,settings}.tsx` → `client/src/pages/*`
- `src/app/room/[roomId]/page.tsx` → `client/src/pages/RoomPage.tsx`
- `src/app/error.tsx` → error boundary component; `loading.tsx` → route loading state.

Mechanical rewrites:

- Delete `"use client"` directives (harmless but noisy in Vite).
- `next/link` → `Link` from `react-router-dom`; change `href=` → `to=`.
  Keep plain `<a href="#...">` for in-page anchors.
- `useRouter` → `useNavigate` (`router.push(x)` → `navigate(x)`, `router.back()` → `navigate(-1)`,
  `router.refresh()` → no-op/reload).
- `useParams` / `useSearchParams` come from `react-router-dom` (search params API is compatible).
- `next/dynamic` in `CodeEditor.tsx`: replace with a normal `import Editor from "@monaco-editor/react"`
  (or `React.lazy` + `Suspense`); drop `ssr:false`.
- `@/…` path imports stay valid via `tsconfig` + Vite alias `@` → `client/src`.
- `CompilerPanel` currently imports types from `@/lib/compiler` (server-only file). Create
  `client/src/lib/compiler-types.ts` containing just `SupportedLanguage` and `ExecutionResult`
  interfaces and switch that import to `import type`.
- Fonts: copy `src/app/fonts/*.woff` to `client/public/fonts/`, add:

```css
@font-face { font-family: "Geist"; src: url("/fonts/GeistVF.woff") format("woff"); font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Geist Mono"; src: url("/fonts/GeistMonoVF.woff") format("woff"); font-weight: 100 900; font-display: swap; }
:root { --font-geist-sans: "Geist"; --font-geist-mono: "Geist Mono"; }
```

- Routes: `/`, `/login`, `/register`, `/dashboard`, `/settings`, `/room/:roomId`, `*` → NotFound.
- Keep `coderoom_token` in `localStorage` (and `sessionStorage` where the old code does), send
  `Authorization: Bearer …`, and use `credentials: "include"` so cookies work too.
- Keep theme initialization inline in `index.html` (no flash of wrong theme), `ThemeProvider`,
  `TooltipProvider`, `Toaster`.
- Dev proxy (vite.config.ts):

```ts
server: {
  port: 5173,
  proxy: {
    "/api": { target: "http://localhost:3000", changeOrigin: true },
    "/ws":  { target: "ws://localhost:3000", ws: true },
    "/yjs": { target: "ws://localhost:3000", ws: true },
  },
}
```

### Responsiveness & functional upgrades (required beyond a pure port)

Apply these without breaking desktop behavior:

1. **Room workspace**: use `100dvh` (not `100vh`) with `min-h-0` flex children, `overscroll-none`,
   safe-area padding (`env(safe-area-inset-bottom)`), and a mobile bottom tab bar
   (Files / Editor / Output / Chat) with 44px touch targets and an unread-chat badge.
   Keep the existing auto-switch to Output on run.
2. **Responsive panels**: left/right sidebars become slide-over drawers on `< md`, never squeeze
   the editor; resizers remain desktop-only. Modals must be `max-h-[90dvh] overflow-y-auto`.
3. **Landing / auth / dashboard**: verify at 320px, 375px, 768px, 1024px, 1440px. No horizontal
   scroll; mobile nav closes on navigation; room cards switch to a single column; filters/search
   stay usable.
4. **Connection reliability**: room WebSocket auto-reconnect with exponential backoff
   (1s→30s, jitter), heartbeat, and a visible "Reconnecting/Offline" banner; queue chat while
   disconnected or disable send with a clear reason.
5. **Chat UX**: optimistic message send (dedupe by id from the server broadcast), auto-scroll
   only when near bottom, unread counter, Enter to send / Shift+Enter newline.
6. **Editor UX**: show file name + language + save status on mobile, `Ctrl/Cmd+Enter` run,
   `Ctrl/Cmd+S` no-op save toast (autosave), and make sure Monaco fills its container after
   tab switches (`layout()` on resize/visibility).
7. **Files**: search/filter exists — keep it; add empty states and disable actions the user
   cannot perform (based on `canEdit` / `allowedFiles`).
8. **Accessibility**: focus-visible rings, `aria-label`s on icon-only buttons, `Esc` closes
   dialogs/drawers, keyboard navigation for file tree.
9. **Performance**: lazy-load Monaco (`React.lazy`) so the landing/auth pages stay light;
   memoize heavy tree calculations; avoid layout shift.

Ship a brief `client/README.md` describing scripts, proxy and env.

---

## 9. Definition of done (each workstream)

Server:
- `npm install`, `npm run typecheck`, `npm run build` all pass.
- `npm run seed` works against the local Mongo.
- Server starts on port 3000 and `GET /api/health` reports connected.
- Auth, rooms, files, messages, permissions, run, AI, compile routes respond with the exact
  DTOs above; `/ws` and `/yjs` upgrade successfully with a valid token.

Client:
- `npm install`, `npm run typecheck`, `npm run build` all pass.
- Every page listed above renders, links work, login/register/dashboard/settings/room flows use
  the API contract, Monaco + Yjs collaboration still work.
- Responsive checks above are addressed; no TypeScript `any`-sprinkling to silence errors
  (prefer correct types).
- `npm run dev` runs on 5173 with the proxy configured.

Report back: files created, commands run, verification results, and anything still missing.
