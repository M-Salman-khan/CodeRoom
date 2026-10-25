import type { Request, RequestHandler } from "express";
import { COOKIE_NAME, verifySessionToken, type SessionUser } from "../lib/auth";
import { tokenFromAuthorizationHeader, tokenFromCookieHeader } from "../lib/cookies";
import { asyncHandler } from "../lib/http";
import { User } from "../models/user";

export function extractRequestToken(req: Request): string | null {
  const fromHeader = tokenFromAuthorizationHeader(req.headers.authorization);
  if (fromHeader) return fromHeader;

  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const fromParsedCookie = cookies?.[COOKIE_NAME];
  if (fromParsedCookie && fromParsedCookie.trim().length > 0) {
    return fromParsedCookie.trim();
  }

  return tokenFromCookieHeader(req.headers.cookie);
}

/** Resolve the authenticated user from a bearer token or the session cookie. */
export async function resolveRequestUser(req: Request): Promise<SessionUser | null> {
  const token = extractRequestToken(req);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await User.findById(session.id).select("_id username").exec();
  if (!user) return null;

  return { id: user._id, username: user.username };
}

export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
});
