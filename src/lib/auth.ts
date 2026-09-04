import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { db } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "coderoom-default-fallback-secret-at-least-32-chars-long"
);

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
      id: payload.userId as string,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(req?: Request): Promise<SessionUser | null> {
  try {
    let token: string | undefined;

    // 1. Check direct request authorization header if passed
    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // 2. Check Next.js headers()
    if (!token) {
      try {
        const reqHeaders = headers();
        const authHeader = reqHeaders.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
        }
      } catch {}
    }

    // 3. Check cookies
    if (!token) {
      const cookieStore = cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    // Verify user exists in database
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true },
    });

    return user;
  } catch {
    return null;
  }
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3 || username.length > 30) {
    return { valid: false, error: "Username must be between 3 and 30 characters" };
  }
  const regex = /^[a-zA-Z0-9_-]+$/;
  if (!regex.test(username)) {
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
