import rateLimit from "express-rate-limit";

/**
 * In-process rate limiting. Suitable for the single-instance deployment
 * documented in the README; horizontally scaled clusters should use a shared
 * store (Redis/Mongo) instead.
 */
function limiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: message },
    // The app configures Express `trust proxy` explicitly; avoid noisy library
    // validation for deployments that intentionally sit behind a reverse proxy.
    validate: { xForwardedForHeader: false },
  });
}

export const apiLimiter = limiter(
  60_000,
  600,
  "Too many requests. Please slow down and try again shortly.",
);

export const authLimiter = limiter(
  15 * 60_000,
  50,
  "Too many authentication attempts. Try again in a few minutes.",
);

export const joinRoomLimiter = limiter(
  60_000,
  60,
  "Too many room join attempts. Try again in a minute.",
);

export const createRoomLimiter = limiter(
  60 * 60_000,
  30,
  "Too many rooms created from this network. Try again later.",
);

export const writeLimiter = limiter(
  60_000,
  120,
  "Too many write requests. Please slow down.",
);

export const chatLimiter = limiter(
  60_000,
  120,
  "Too many chat messages. Please slow down.",
);

export const aiLimiter = limiter(
  60_000,
  30,
  "Too many AI requests. Please slow down.",
);

export const runLimiter = limiter(
  60_000,
  30,
  "Too many execution requests. Please slow down.",
);

export const permissionLimiter = limiter(
  60_000,
  60,
  "Too many permission requests. Please slow down.",
);
