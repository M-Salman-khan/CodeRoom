#!/usr/bin/env node
/**
 * End-to-end API smoke test for the MERN CodeRoom server.
 *
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 * Default: http://localhost:3000
 *
 * Creates throwaway users/room and deletes the room at the end.
 */
const BASE = (
  process.argv[2] ||
  process.env.SMOKE_BASE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const WS_BASE = BASE.replace(/^http/, "ws");

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function request(
  method,
  path,
  { token, body, cookie, headers: extraHeaders } = {},
) {
  const headers = { ...(extraHeaders ?? {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json, headers: res.headers };
}

function wsOutcome(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let settled = false;
    let ws;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      resolve(outcome);
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch {
      finish("error");
      return;
    }
    ws.addEventListener("open", () => finish("open"));
    ws.addEventListener("error", () => finish("error"));
    ws.addEventListener("close", () => finish("close"));
  });
}

function waitForMessage(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message"));
    }, timeoutMs);
    const onMessage = (event) => {
      try {
        const data = JSON.parse(
          typeof event.data === "string" ? event.data : event.data.toString(),
        );
        if (predicate(data)) {
          cleanup();
          resolve(data);
        }
      } catch {
        // ignore non-JSON frames
      }
    };
    const onError = (event) => {
      cleanup();
      reject(new Error(`WebSocket error: ${event?.message || "unknown"}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
    };
    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError);
  });
}

const suffix = Math.random().toString(36).slice(2, 8);
const ownerName = `smoke_owner_${suffix}`;
const guestName = `smoke_guest_${suffix}`;
const password = "password123";
let owner;
let guest;
let room;
let appConfig;
let roomFile;
const expectedPublicBaseUrl = (
  process.env.SMOKE_EXPECT_PUBLIC_BASE_URL || ""
).replace(/\/$/, "");

console.log(`\nCodeRoom smoke test → ${BASE}\n`);

// ---------------------------------------------------------------------------
console.log("Health");
{
  const { status, body } = await request("GET", "/api/health");
  check("GET /api/health is 200", status === 200, `status ${status}`);
  check(
    "database is connected",
    body?.database === "connected",
    JSON.stringify(body),
  );
}

// ---------------------------------------------------------------------------
console.log("\nRuntime config");
{
  const { status, body } = await request("GET", "/api/config");
  appConfig = body;
  check("GET /api/config is 200", status === 200, `status ${status}`);
  check(
    "config declares WebSocket/Yjs with no polling fallback",
    body?.collaboration?.transport === "websocket" &&
      body?.collaboration?.yjs === true &&
      body?.collaboration?.fallback === false,
  );
  if (expectedPublicBaseUrl) {
    check(
      "canonical public base URL matches deployment",
      body?.publicBaseUrl === expectedPublicBaseUrl,
      JSON.stringify(body?.publicBaseUrl),
    );
    check(
      "invite links are enabled for a public HTTPS origin",
      body?.inviteLinksEnabled === true,
    );
    check(
      "canonical URL is not localhost/private",
      typeof body?.publicBaseUrl === "string" &&
        !/localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(
          body.publicBaseUrl,
        ),
    );
  }
}

if (process.env.SMOKE_EXPECT_CORS_ENFORCED === "1") {
  const evil = await request("GET", "/api/health", {
    headers: { Origin: "https://evil.example" },
  });
  check(
    "CORS rejects an unknown origin",
    !evil.headers.get("access-control-allow-origin"),
    evil.headers.get("access-control-allow-origin") || "",
  );

  if (expectedPublicBaseUrl) {
    const allowed = await request("GET", "/api/health", {
      headers: { Origin: expectedPublicBaseUrl },
    });
    check(
      "CORS allows the canonical public origin",
      allowed.headers.get("access-control-allow-origin") ===
        expectedPublicBaseUrl,
      allowed.headers.get("access-control-allow-origin") || "",
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\nAuth");
{
  const { status, body } = await request("POST", "/api/auth/register", {
    body: { username: ownerName, password, confirmPassword: password },
  });
  check(
    "register owner returns 201",
    status === 201,
    `status ${status} ${JSON.stringify(body)}`,
  );
  owner = {
    token: body?.token,
    user: body?.user,
    cookie: body?.token ? `coderoom_session=${body.token}` : "",
  };
  check("register returns a token", Boolean(owner.token));
}

{
  const { status, body } = await request("POST", "/api/auth/register", {
    body: { username: guestName, password, confirmPassword: password },
  });
  check("register guest returns 201", status === 201, `status ${status}`);
  guest = { token: body?.token, user: body?.user };
}

{
  const { status, body, headers } = await request("POST", "/api/auth/login", {
    body: { username: ownerName.toUpperCase(), password, rememberMe: true },
    headers:
      process.env.SMOKE_EXPECT_SECURE_COOKIES === "1"
        ? { "X-Forwarded-Proto": "https" }
        : undefined,
  });
  check(
    "login is case-insensitive",
    status === 200 && body?.user?.username === ownerName,
    `status ${status}`,
  );
  if (process.env.SMOKE_EXPECT_SECURE_COOKIES === "1") {
    const setCookie = headers.get("set-cookie") || "";
    check(
      "session cookie is Secure over forwarded HTTPS",
      /;\s*Secure/i.test(setCookie),
      setCookie,
    );
    check(
      "session cookie is httpOnly",
      /;\s*HttpOnly/i.test(setCookie),
      setCookie,
    );
  }
}

{
  const { status, body } = await request("GET", "/api/auth/me", {
    token: owner.token,
  });
  check(
    "GET /api/auth/me returns the user",
    status === 200 && body?.user?.id === owner.user.id,
  );
  check("me returns token", Boolean(body?.token));
}

{
  const { status } = await request("GET", "/api/auth/me", {
    token: "invalid.jwt.token",
  });
  check("invalid token is rejected", status === 401, `status ${status}`);
}

// ---------------------------------------------------------------------------
console.log("\nRooms");
{
  const { status, body } = await request("POST", "/api/rooms", {
    token: owner.token,
    body: {
      name: `Smoke Room ${suffix}`,
      description: "temporary",
      isPublic: true,
    },
  });
  check(
    "create room returns 201",
    status === 201,
    `status ${status} ${JSON.stringify(body)}`,
  );
  room = body?.room;
  check(
    "room has a valid generated code",
    typeof room?.roomCode === "string" &&
      /^[A-Z0-9]{6,16}$/.test(room.roomCode),
    room?.roomCode,
  );
  if (appConfig?.inviteLinksEnabled) {
    check(
      "room payload uses the canonical invite URL",
      room?.shareUrl === `${appConfig.publicBaseUrl}/room/${room.roomCode}`,
      JSON.stringify(room?.shareUrl),
    );
  } else {
    check(
      "room shareUrl is null when invite links are disabled",
      room?.shareUrl === null,
    );
  }
}

{
  const { status } = await request("POST", "/api/rooms", {
    token: owner.token,
    body: { name: "x".repeat(81) },
  });
  check(
    "room name over 80 chars is rejected",
    status === 400,
    `status ${status}`,
  );
}

{
  const { status } = await request("GET", `/api/rooms/${room.id}/files`, {
    token: guest.token,
  });
  check(
    "non-member cannot list room files",
    status === 403,
    `status ${status}`,
  );
}

{
  const { status } = await request("GET", `/api/rooms/${room.id}/messages`, {
    token: guest.token,
  });
  check("non-member cannot read room chat", status === 403, `status ${status}`);
}

{
  const { status } = await request("GET", `/api/rooms/${room.id}/run`, {
    token: guest.token,
  });
  check(
    "non-member cannot read execution state",
    status === 403,
    `status ${status}`,
  );
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/ai`, {
    token: guest.token,
    body: { action: "debug", code: "console.log(1)" },
  });
  check("non-member cannot call room AI", status === 403, `status ${status}`);
}

{
  const outcome = await wsOutcome(
    `${WS_BASE}/ws?roomId=${encodeURIComponent(room.id)}&token=${encodeURIComponent(guest.token)}`,
  );
  check(
    "non-member /ws upgrade is rejected",
    outcome === "error" || outcome === "close",
    outcome,
  );
}

{
  const outcome = await wsOutcome(
    `${WS_BASE}/yjs/${encodeURIComponent(room.id)}__fakefile?token=${encodeURIComponent(guest.token)}`,
  );
  check(
    "non-member /yjs upgrade is rejected",
    outcome === "error" || outcome === "close",
    outcome,
  );
}

// Grab a file id while still an owner, for later authorized Yjs checks.
{
  const { status, body } = await request("GET", `/api/rooms/${room.id}/files`, {
    token: owner.token,
  });
  check(
    "owner can list room files",
    status === 200 && Array.isArray(body?.files),
  );
  roomFile = body?.files?.find((entry) => entry.type === "file");
}

{
  const { status, body } = await request("GET", "/api/rooms", {
    token: owner.token,
  });
  check(
    "list rooms includes the new room",
    status === 200 && body?.rooms?.some((r) => r.id === room.id),
  );
  check(
    "list rooms includes owner + counts",
    Boolean(body?.rooms?.[0]?.owner?.username) &&
      Boolean(body?.rooms?.[0]?._count),
  );
}

{
  const { status, body } = await request("GET", `/api/rooms/${room.roomCode}`, {
    token: guest.token,
  });
  check(
    "get room by code auto-joins public room",
    status === 200 && body?.room?.id === room.id,
    `status ${status}`,
  );
  check(
    "guest is a MEMBER",
    body?.userRole === "MEMBER" && body?.canEdit === false,
    JSON.stringify(body?.userRole),
  );
}

{
  const { status, body } = await request("GET", `/api/rooms/${room.id}`, {
    token: owner.token,
  });
  check("get room by id", status === 200 && body?.isOwner === true);
  check("owner canEdit", body?.canEdit === true);
  check(
    "room payload includes members",
    Array.isArray(body?.room?.members) && body.room.members.length >= 2,
  );
}

// ---------------------------------------------------------------------------
console.log("\nFiles");
let file;
{
  const { status, body } = await request("GET", `/api/rooms/${room.id}/files`, {
    token: owner.token,
  });
  check(
    "new room is seeded with files",
    status === 200 && body?.files?.length >= 2,
  );
  file = body?.files?.find((f) => f.type === "file");
}

{
  const { status, body } = await request(
    "POST",
    `/api/rooms/${room.id}/files`,
    {
      token: owner.token,
      body: {
        name: `smoke_${suffix}.js`,
        type: "file",
        content: "console.log('hi');",
      },
    },
  );
  check(
    "create file returns 201",
    status === 201,
    `status ${status} ${JSON.stringify(body)}`,
  );
  check(
    "file language inferred",
    body?.file?.language === "javascript",
    body?.file?.language,
  );
  file = body?.file ?? file;
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/files`, {
    token: owner.token,
    body: {
      name: "too-large.js",
      type: "file",
      content: "x".repeat(1_000_001),
    },
  });
  check(
    "file content over 1 MB is rejected",
    status === 413,
    `status ${status}`,
  );
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/files`, {
    token: owner.token,
    body: {
      name: "huge-json.js",
      type: "file",
      content: "x".repeat(2_100_000),
    },
  });
  check("JSON body over 2 MB is rejected", status === 413, `status ${status}`);
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/files`, {
    token: owner.token,
    body: { name: "../escape.js", type: "file" },
  });
  check(
    "file names with path separators are rejected",
    status === 400,
    `status ${status}`,
  );
}

{
  const { status, body } = await request(
    "PATCH",
    `/api/rooms/${room.id}/files/${file.id}`,
    {
      token: owner.token,
      body: { content: "console.log('updated');" },
    },
  );
  check(
    "update file content",
    status === 200 && body?.file?.content.includes("updated"),
  );
}

{
  const { status, body } = await request(
    "POST",
    `/api/rooms/${room.id}/files/${file.id}/duplicate`,
    {
      token: owner.token,
      body: {},
    },
  );
  check(
    "duplicate file",
    status === 200 && Array.isArray(body?.files) && body.files.length === 1,
  );
  const copy = body?.files?.[0];
  if (copy) {
    const del = await request(
      "DELETE",
      `/api/rooms/${room.id}/files/${copy.id}`,
      { token: owner.token },
    );
    check("delete duplicate", del.status === 200);
  }
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/files`, {
    token: guest.token,
    body: { name: "nope.js", type: "file" },
  });
  check(
    "member without edit permission cannot create files",
    status === 403,
    `status ${status}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nMessages");
{
  const { status, body } = await request(
    "POST",
    `/api/rooms/${room.id}/messages`,
    {
      token: guest.token,
      body: { content: "hello from the smoke test" },
    },
  );
  check(
    "post message",
    status === 201 && body?.message?.username === guestName,
  );
}

{
  const { status, body } = await request(
    "GET",
    `/api/rooms/${room.id}/messages`,
    { token: owner.token },
  );
  check(
    "list messages",
    status === 200 &&
      body?.messages?.some((m) => m.content.includes("smoke test")),
  );
}

{
  const { status } = await request("POST", `/api/rooms/${room.id}/messages`, {
    token: guest.token,
    body: { content: "x".repeat(2_001) },
  });
  check(
    "chat message over 2,000 chars is rejected",
    status === 400,
    `status ${status}`,
  );
}

{
  const { status } = await request("DELETE", `/api/rooms/${room.id}/messages`, {
    token: guest.token,
  });
  check("non-owner cannot clear room chat", status === 403, `status ${status}`);
}

// ---------------------------------------------------------------------------
console.log("\nPermissions");
{
  const { status, body } = await request(
    "POST",
    `/api/rooms/${room.id}/permissions`,
    {
      token: guest.token,
      body: { action: "request" },
    },
  );
  check(
    "guest requests edit access",
    status === 200 && Boolean(body?.request?.id),
  );
}

{
  const { status, body } = await request(
    "GET",
    `/api/rooms/${room.id}/permissions`,
    { token: owner.token },
  );
  check(
    "owner sees pending request",
    status === 200 && body?.pendingRequests?.length >= 1,
  );
}

{
  const { status, body } = await request(
    "POST",
    `/api/rooms/${room.id}/permissions`,
    {
      token: owner.token,
      body: { action: "grant", targetUserId: guest.user.id, scope: "room" },
    },
  );
  check(
    "owner grants room-wide edit",
    status === 200 && body?.permission?.canEdit === true,
  );
}

{
  const { status, body } = await request("GET", `/api/rooms/${room.id}`, {
    token: guest.token,
  });
  check("guest now canEdit", status === 200 && body?.canEdit === true);
}

// ---------------------------------------------------------------------------
console.log("\nExecution & compiler");
{
  const { status, body } = await request("GET", `/api/rooms/${room.id}/run`, {
    token: owner.token,
  });
  check(
    "execution state is idle",
    status === 200 && body?.execution?.isRunning === false,
  );
}

{
  const { status, body } = await request("POST", `/api/rooms/${room.id}/run`, {
    token: owner.token,
    body: {
      action: "run",
      fileId: file.id,
      code: "console.log('smoke-run-ok');",
    },
  });
  check(
    "run JS in room",
    status === 200 && body?.success === true,
    `status ${status} ${JSON.stringify(body?.error || body?.result)}`,
  );
  const result = body?.result;
  check(
    "run produces stdout",
    typeof result?.stdout === "string",
    JSON.stringify(result),
  );
}

{
  const { status } = await request("POST", "/api/compile", {
    body: { code: "console.log(1)", language: "javascript" },
  });
  check(
    "compile endpoint requires authentication",
    status === 401,
    `status ${status}`,
  );
}

{
  const { status, body } = await request("GET", "/api/compile/languages");
  check(
    "list languages",
    status === 200 &&
      Array.isArray(body?.languages) &&
      body.languages.length > 5,
  );
}

// ---------------------------------------------------------------------------
console.log("\nWebSocket");
{
  let ws;
  try {
    ws = new WebSocket(
      `${WS_BASE}/ws?roomId=${encodeURIComponent(room.id)}&token=${encodeURIComponent(owner.token)}`,
    );
    const presence = await waitForMessage(
      ws,
      (data) => data.type === "presence:update",
    );
    check(
      "/ws authenticates and sends presence",
      Array.isArray(presence.onlineUsers),
    );
  } catch (error) {
    check("/ws connects with a valid token", false, error.message);
  } finally {
    ws?.close();
  }
}

{
  let rejected = false;
  try {
    const ws = new WebSocket(
      `${WS_BASE}/ws?roomId=${encodeURIComponent(room.id)}&token=bogus`,
    );
    await new Promise((resolve) => {
      ws.addEventListener("error", () => {
        rejected = true;
        resolve();
      });
      ws.addEventListener("open", () => resolve());
      setTimeout(resolve, 2000);
    });
    ws.close();
  } catch {
    rejected = true;
  }
  check("/ws rejects an invalid token", rejected);
}

{
  const outcome = await wsOutcome(
    `${WS_BASE}/yjs/${encodeURIComponent(room.id)}__${encodeURIComponent(roomFile.id)}?token=${encodeURIComponent(owner.token)}`,
  );
  check("member /yjs upgrade is accepted", outcome === "open", outcome);
}

// ---------------------------------------------------------------------------
console.log("\nCleanup");
{
  const { status } = await request("DELETE", `/api/rooms/${room.id}`, {
    token: owner.token,
  });
  check("delete test room", status === 200);
}

console.log(
  `\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`,
);
process.exit(failed === 0 ? 0 : 1);
