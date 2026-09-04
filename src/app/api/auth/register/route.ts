import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  validateUsername,
  validatePassword,
  createSessionToken,
  COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, confirmPassword } = body;

    const trimmedUsername = username?.trim();

    const usernameValidation = validateUsername(trimmedUsername);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.error },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Check if user already exists (case-insensitive in SQLite usually, let's be explicit)
    const existingUser = await db.user.findFirst({
      where: {
        username: {
          equals: trimmedUsername,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        username: trimmedUsername,
        passwordHash,
      },
    });

    const token = await createSessionToken({
      id: user.id,
      username: user.username,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.id, username: user.username },
        token,
      },
      { status: 201 }
    );

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
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error during registration" },
      { status: 500 }
    );
  }
}
