import http from "http";
import os from "os";
import { WebSocketServer } from "ws";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { createApp } from "./app";
import { tokenFromAuthorizationHeader, tokenFromCookieHeader } from "./lib/cookies";
import { verifySessionToken, type SessionUser } from "./lib/auth";
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

function extractUpgradeToken(req: http.IncomingMessage, url: URL): string | null {
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken.trim()) return queryToken.trim();

  const headerToken = tokenFromAuthorizationHeader(req.headers.authorization);
  if (headerToken) return headerToken;

  return tokenFromCookieHeader(req.headers.cookie);
}

function rejectUpgrade(socket: import("stream").Duplex, status = "401 Unauthorized"): void {
  try {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  } catch {
    // ignore
  }
  socket.destroy();
}

async function authenticateUpgrade(
  req: http.IncomingMessage,
  url: URL
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
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    void (async () => {
      let url: URL;
      try {
        url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      } catch {
        rejectUpgrade(socket, "400 Bad Request");
        return;
      }

      const pathname = url.pathname;
      if (!pathname.startsWith("/ws") && !pathname.startsWith("/yjs")) {
        socket.destroy();
        return;
      }

      try {
        const user = await authenticateUpgrade(req, url);
        if (!user) {
          rejectUpgrade(socket, "401 Unauthorized");
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          if (pathname.startsWith("/yjs")) {
            const rawDocName = pathname.replace(/^\/yjs\/?/, "");
            const docName = decodeURIComponent(rawDocName || "default");
            void handleYjsConnection(ws, docName, user);
          } else {
            const rawRoomId = url.searchParams.get("roomId") || "global";
            handleRoomConnection(ws, decodeURIComponent(rawRoomId), user);
          }
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

  const lanIps = getLanIps();
  console.log("\n=======================================================");
  console.log("🚀 CodeRoom Server is running!");
  console.log(`📡 Local:    http://localhost:${env.PORT}`);
  if (lanIps.length > 0) {
    lanIps.forEach((ip) => console.log(`🌐 Network:  http://${ip}:${env.PORT}`));
  } else {
    console.log(`🌐 Network:  http://${env.HOST}:${env.PORT}`);
  }
  console.log(`⚡ Real-time WebSockets attached to port ${env.PORT}`);
  console.log("=======================================================\n");

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down CodeRoom server...`);

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
