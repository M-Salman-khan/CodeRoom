import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getCurrentUser,
  verifyPassword,
  hashPassword,
  validatePassword,
} from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDoc = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, createdAt: true },
  });

  return NextResponse.json({ user: userDoc });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new passwords are required" },
        { status: 400 }
      );
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const userDoc = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const match = await verifyPassword(currentPassword, userDoc.passwordHash);
    if (!match) {
      return NextResponse.json(
        { error: "Incorrect current password" },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Update password error:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
