import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";

const JWT_SECRET = new TextEncoder().encode(env.AUTH_SECRET);

export const COOKIE_NAME = "coderoom_session";

export interface SessionUser {
  id: string;
  username: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  user: SessionUser,
  rememberMe: boolean = false
): Promise<string> {
  const expirationTime = rememberMe ? "30d" : "7d";
  return new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.userId || !payload.username) {
      return null;
    }
    return {
      id: String(payload.userId),
      username: String(payload.username),
    };
  } catch {
    return null;
  }
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3 || username.length > 30) {
    return { valid: false, error: "Username must be between 3 and 30 characters" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, underscores, and hyphens",
    };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long" };
  }
  return { valid: true };
}

export function cookieMaxAge(rememberMe: boolean): number {
  return rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
}
