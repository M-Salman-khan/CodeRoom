import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    const room = await db.room.findFirst({
      where: {
        OR: [{ id: roomId }, { roomCode: roomId.toUpperCase() }, { roomCode: roomId }],
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "This room could not be found." },
        { status: 404 }
      );
    }

    // Check if password required
    if (room.passwordHash && room.ownerId !== user.id) {
      if (!password) {
        return NextResponse.json(
          { error: "Password is required to join this room.", requiresPassword: true },
          { status: 403 }
        );
      }
      const match = await verifyPassword(password, room.passwordHash);
      if (!match) {
        return NextResponse.json(
          { error: "Incorrect room password.", requiresPassword: true },
          { status: 403 }
        );
      }
    }

    // Add as member if not already
    const existing = await db.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    });

    if (!existing) {
      await db.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          role: room.ownerId === user.id ? "OWNER" : "MEMBER",
        },
      });
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      roomCode: room.roomCode,
    });
  } catch (err) {
    console.error("Join room error:", err);
    return NextResponse.json(
      { error: "Failed to join room." },
      { status: 500 }
    );
  }
}
