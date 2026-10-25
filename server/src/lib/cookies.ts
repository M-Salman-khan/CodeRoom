import type { CookieOptions, Request, Response } from "express";
import { COOKIE_NAME } from "./auth";
import { isProduction } from "../config/env";

export function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  return req.secure || forwarded === "https" || Boolean(process.env.FORCE_COOKIE_SECURE);
}

export function sessionCookieOptions(req: Request, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureRequest(req) && isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setSessionCookie(
  res: Response,
  req: Request,
  token: string,
  maxAgeSeconds: number
): void {
  res.cookie(COOKIE_NAME, token, sessionCookieOptions(req, maxAgeSeconds));
}

export function clearSessionCookie(res: Response, req: Request): void {
  res.cookie(COOKIE_NAME, "", {
    ...sessionCookieOptions(req, 0),
    maxAge: 0,
  });
}

export function tokenFromAuthorizationHeader(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function tokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      const raw = part.substring(COOKIE_NAME.length + 1);
      try {
        return decodeURIComponent(raw).trim() || null;
      } catch {
        return raw.trim() || null;
      }
    }
  }
  return null;
}
