import "./src/server/polyfill";
import http from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import os from "os";
import { verifySessionToken, COOKIE_NAME } from "./src/lib/auth";
import { handleYjsConnection } from "./src/server/yjs-handler";
import { handleRoomConnection } from "./src/server/room-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

function extractToken(req: http.IncomingMessage, parsedUrl: ReturnType<typeof parse>): string | null {
  // 1. Check query parameter parsed by url.parse
  if (typeof parsedUrl.query === "object" && parsedUrl.query !== null) {
    const queryObj = parsedUrl.query as Record<string, unknown>;
    if (typeof queryObj.token === "string" && queryObj.token.trim().length > 0) {
      return queryObj.token.trim();
    }
    if (Array.isArray(queryObj.token) && typeof queryObj.token[0] === "string" && queryObj.token[0].trim().length > 0) {
      return queryObj.token[0].trim();
    }
  }

  // 2. Fallback check query parameter via URL parser
  try {
    const host = req.headers.host || "localhost";
    const queryToken = new URL(req.url || "", `http://${host}`).searchParams.get("token");
    if (queryToken && queryToken.trim().length > 0) {
      return queryToken.trim();
    }
  } catch {
    // Ignore URL parse errors
  }

  // 3. Check Authorization header
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 4. Check cookies
  const cookieHeader = req.headers["cookie"];
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${COOKIE_NAME}=`)) {
        return decodeURIComponent(cookie.substring(COOKIE_NAME.length + 1)).trim();
      }
    }
  }

  return null;
}

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const parsedUrl = parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "";

    // Allow Next.js HMR websocket in development
    if (pathname.startsWith("/_next")) {
      return;
    }

    if (!pathname.startsWith("/yjs") && !pathname.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    try {
      const token = extractToken(req, parsedUrl);
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await verifySessionToken(token);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        if (pathname.startsWith("/yjs")) {
          // Extract docName from path: e.g. /yjs/roomId__fileId
          const rawDocName = pathname.replace(/^\/yjs\/?/, "") || "default";
          const docName = decodeURIComponent(rawDocName);
          handleYjsConnection(ws, docName, user);
        } else if (pathname.startsWith("/ws")) {
          // Room events websocket: /ws?roomId=...
          const rawRoomId = (parsedUrl.query.roomId as string) || "global";
          const roomId = decodeURIComponent(rawRoomId);
          handleRoomConnection(ws, roomId, user);
        }
      });
    } catch (err) {
      console.error("Upgrade error:", err);
      socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    const lanIps = getLanIps();
    console.log("\n=======================================================");
    console.log("🚀 CodeRoom Server is running!");
    console.log(`📡 Local:    http://localhost:${port}`);
    if (lanIps.length > 0) {
      lanIps.forEach((ip) => {
        console.log(`🌐 Network:  http://${ip}:${port}`);
      });
    } else {
      console.log(`🌐 Network:  http://${hostname}:${port}`);
    }
    console.log(`⚡ Real-time WebSockets attached to port ${port}`);
    console.log("=======================================================\n");
  });

  const shutdown = () => {
    console.log("\n🛑 Gracefully shutting down CodeRoom server...");
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forcing shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
