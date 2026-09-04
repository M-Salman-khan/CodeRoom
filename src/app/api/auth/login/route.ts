import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, rememberMe } = body;

    const trimmedUsername = username?.trim();
    if (!trimmedUsername || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        username: {
          equals: trimmedUsername,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Incorrect username or password" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Incorrect username or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(
      { id: user.id, username: user.username },
      Boolean(rememberMe)
    );

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username },
      token,
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      Boolean(process.env.FORCE_COOKIE_SECURE);

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error during login" },
      { status: 500 }
    );
  }
}
