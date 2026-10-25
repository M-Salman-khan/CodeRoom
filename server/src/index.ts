import http from "http";
import os from "os";
import { WebSocketServer } from "ws";
import { env, isProduction, validateProductionEnvironment } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { createApp } from "./app";
import {
  tokenFromAuthorizationHeader,
  tokenFromCookieHeader,
} from "./lib/cookies";
import { verifySessionToken, type SessionUser } from "./lib/auth";
import { isAllowedOrigin } from "./lib/origins";
import { authorizeRoomKey } from "./lib/rooms";
import { resolvePublicBaseUrl } from "./lib/public-url";
import { User } from "./models/user";
import { handleRoomConnection, shutdownRoomHandlers } from "./ws/room-handler";
import { handleYjsConnection, shutdownYjs } from "./ws/yjs-handler";

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name];
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === "IPv4" && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

function extractUpgradeToken(
  req: http.IncomingMessage,
  url: URL,
): string | null {
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken.trim()) return queryToken.trim();

  const headerToken = tokenFromAuthorizationHeader(req.headers.authorization);
  if (headerToken) return headerToken;

  return tokenFromCookieHeader(req.headers.cookie);
}

function rejectUpgrade(
  socket: import("stream").Duplex,
  status = "401 Unauthorized",
): void {
  try {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  } catch {
    // ignore
  }
  socket.destroy();
}

async function authenticateUpgrade(
  req: http.IncomingMessage,
  url: URL,
): Promise<SessionUser | null> {
  const token = extractUpgradeToken(req, url);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const exists = await User.exists({ _id: session.id });
  if (!exists) return null;

  return session;
}

async function main(): Promise<void> {
  validateProductionEnvironment();
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  // Cap frame size to bound memory use from a single abusive client. Real
  // editor documents are limited to 1 MB elsewhere in the API.
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024,
  });

  server.on("upgrade", (req, socket, head) => {
    void (async () => {
      let url: URL;
      try {
        url = new URL(
          req.url || "/",
          `http://${req.headers.host || "localhost"}`,
        );
      } catch {
        rejectUpgrade(socket, "400 Bad Request");
        return;
      }

      const pathname = url.pathname;
      const isRoomSocket = pathname === "/ws" || pathname === "/ws/";
      const isYjsSocket = pathname === "/yjs" || pathname.startsWith("/yjs/");
      if (!isRoomSocket && !isYjsSocket) {
        socket.destroy();
        return;
      }

      // Browsers send Origin on WebSocket handshakes. Reject cross-origin
      // upgrades in production so a hostile page cannot reuse a session cookie.
      const requestOrigin = Array.isArray(req.headers.origin)
        ? req.headers.origin[0]
        : req.headers.origin;
      if (!isAllowedOrigin(requestOrigin, req.headers.host)) {
        rejectUpgrade(socket, "403 Forbidden");
        return;
      }

      try {
        const user = await authenticateUpgrade(req, url);
        if (!user) {
          rejectUpgrade(socket, "401 Unauthorized");
          return;
        }

        if (pathname.startsWith("/yjs")) {
          const rawDocName = pathname.replace(/^\/yjs\/?/, "");
          let docName: string;
          try {
            docName = decodeURIComponent(rawDocName);
          } catch {
            rejectUpgrade(socket, "400 Bad Request");
            return;
          }

          const separator = docName.indexOf("__");
          const roomKey = separator > 0 ? docName.slice(0, separator) : "";
          const fileId = separator > 0 ? docName.slice(separator + 2) : "";
          if (!roomKey || !fileId) {
            rejectUpgrade(socket, "400 Bad Request");
            return;
          }

          const access = await authorizeRoomKey(user.id, roomKey);
          if (!access) {
            rejectUpgrade(socket, "403 Forbidden");
            return;
          }

          wss.handleUpgrade(req, socket, head, (ws) => {
            // Rewrite a room code to the canonical id so the Yjs document key
            // is stable even if a client used the short code in the path.
            void handleYjsConnection(ws, `${access.roomId}__${fileId}`, user);
          });
          return;
        }

        const rawRoomId = url.searchParams.get("roomId");
        if (!rawRoomId) {
          rejectUpgrade(socket, "400 Bad Request");
          return;
        }

        let roomKey: string;
        try {
          roomKey = decodeURIComponent(rawRoomId);
        } catch {
          rejectUpgrade(socket, "400 Bad Request");
          return;
        }

        const access = await authorizeRoomKey(user.id, roomKey);
        if (!access) {
          rejectUpgrade(socket, "403 Forbidden");
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          void handleRoomConnection(ws, access.roomId, user);
        });
      } catch (err) {
        console.error("WebSocket upgrade error:", err);
        socket.destroy();
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(env.PORT, env.HOST, resolve);
  });

  const publicUrl = resolvePublicBaseUrl();
  const lanIps = getLanIps();
  console.log("\n=======================================================");
  console.log("🚀 CodeRoom Server is running!");
  console.log(`📡 Local:    http://localhost:${env.PORT}`);
  if (isProduction) {
    if (publicUrl.inviteLinksEnabled && publicUrl.url) {
      console.log(`🌐 Public:   ${publicUrl.url}`);
    } else {
      console.warn(
        "⚠️  Invitation links are disabled. Set PUBLIC_BASE_URL to a public HTTPS origin " +
          "(for example https://coderoom.example.com).",
      );
    }
  } else if (lanIps.length > 0) {
    lanIps.forEach((ip) =>
      console.log(`🌐 Network:  http://${ip}:${env.PORT}`),
    );
  }
  console.log(
    `⚡ Real-time WebSockets attached to port ${env.PORT} (/ws and /yjs)`,
  );
  console.log("=======================================================\n");

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(
      `\n🛑 Received ${signal}. Gracefully shutting down CodeRoom server...`,
    );

    const forceExit = setTimeout(() => {
      console.error("Forcing shutdown after timeout.");
      process.exit(1);
    }, 10000);
    forceExit.unref();

    void (async () => {
      try {
        shutdownRoomHandlers();
        await shutdownYjs();
        console.log("Flushed all collaborative documents to the database.");
      } catch (err) {
        console.error("Error flushing Yjs documents on shutdown:", err);
      }

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const client of wss.clients) {
          try {
            client.close(1001, "Server shutting down");
          } catch {
            // ignore
          }
        }
      });

      try {
        await disconnectDatabase();
      } catch (err) {
        console.error("Error disconnecting MongoDB:", err);
      }

      clearTimeout(forceExit);
      console.log("Server closed.");
      process.exit(0);
    })();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

main().catch((err) => {
  console.error("Failed to start CodeRoom server:", err);
  process.exit(1);
});
