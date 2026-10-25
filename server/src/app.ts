import fs from "fs";
import path from "path";
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env, isProduction } from "./config/env";
import { isSecureRequest } from "./lib/cookies";
import { isAllowedOrigin } from "./lib/origins";
import { apiLimiter } from "./middleware/rate-limit";
import aiRouter from "./routes/ai";
import authRouter from "./routes/auth";
import compileRouter from "./routes/compile";
import configRouter from "./routes/config";
import healthRouter from "./routes/health";
import roomsRouter from "./routes/rooms";
import userRouter from "./routes/user";

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedOrigin(origin));
}

const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (err && typeof err === "object" && "type" in err) {
    const type = (err as { type?: string }).type;
    if (type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large" });
      return;
    }
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  console.error("Unhandled request error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Only trust forwarded headers when explicitly configured. Behind Caddy or
  // Nginx set TRUST_PROXY=1 so req.ip and req.secure are accurate.
  app.set("trust proxy", env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (isProduction && isSecureRequest(req)) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
    next();
  });

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use("/api", apiLimiter);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/config", configRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/user", userRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/compile", compileRouter);

  // Unknown API routes keep the JSON error contract.
  app.use("/api", apiNotFound);

  const indexPath = path.join(env.CLIENT_DIST, "index.html");
  if (fs.existsSync(indexPath)) {
    app.use(express.static(env.CLIENT_DIST));

    app.get("*", (req, res, next) => {
      if (
        req.path.startsWith("/api") ||
        req.path.startsWith("/ws") ||
        req.path.startsWith("/yjs")
      ) {
        next();
        return;
      }
      res.sendFile(indexPath);
    });
  } else {
    // Dev-friendly: the Vite client may not be built yet.
    app.get("/", (_req, res) => {
      res
        .status(200)
        .type("text/plain")
        .send(
          "CodeRoom API is running. Client build not found at client/dist.",
        );
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
