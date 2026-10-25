# CodeRoom client

Vite + React 18 + TypeScript + Tailwind single-page app for CodeRoom. It is the
Vite port of the legacy Next.js UI and talks to the Express/Mongo API in
`../server`.

## Scripts

Run these from `client/`:

```bash
npm install       # install dependencies
npm run dev       # start Vite on http://localhost:5173
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production bundle in dist/
npm run preview   # serve the production build locally
```

Node 20+ is recommended (developed against Node 24).

## Dev proxy

`vite.config.ts` proxies same-origin requests to the API server on port 3000:

| Path   | Target                  | Notes             |
| ------ | ----------------------- | ----------------- |
| `/api` | `http://localhost:3000` | REST              |
| `/ws`  | `ws://localhost:3000`   | room event socket |
| `/yjs` | `ws://localhost:3000`   | Yjs document sync |

Start the server first (`cd ../server && npm run dev`). The client and server
must agree on the origin for cookies and WebSockets; no extra CORS setup is
needed when using the proxy.

## Authentication

- Login/register store the JWT in `sessionStorage` **and** `localStorage` under
  `coderoom_token`, and the API also sets an httpOnly cookie.
- Requests use `apiFetch` (`src/lib/auth.ts`), which sends `credentials:
  "include"` plus an `Authorization: Bearer …` header when a token is present.
- WebSocket URLs are built from `window.location.host`, so the Vite proxy (or a
  reverse proxy in production) forwards `/ws` and `/yjs` automatically.

## Routes

| Route            | Page             |
| ---------------- | ---------------- |
| `/`              | Landing          |
| `/login`         | Login            |
| `/register`      | Register         |
| `/dashboard`     | Dashboard        |
| `/settings`      | Account settings |
| `/room/:roomId`  | Collaborative room |
| `*`              | Not found        |

## Environment

No client environment variables are required. In production, serve `dist/`
from the same origin as the API and forward `/api`, `/ws` and `/yjs` to the
Node server.

## Notes

- Monaco is lazy-loaded (`React.lazy`) so landing/auth/dashboard stay light.
- The room workspace reconnects its WebSocket with exponential backoff + jitter,
  queues chat while offline, and uses slide-over drawers with a bottom tab bar on
  mobile.
- Fonts are self-hosted in `public/fonts`; there are no external CDN calls.
