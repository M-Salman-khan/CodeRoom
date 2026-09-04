import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    // Look up by id or roomCode
    const room = await db.room.findFirst({
      where: {
        OR: [{ id: roomId }, { roomCode: roomId }],
      },
      include: {
        owner: {
          select: { id: true, username: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "This room could not be found." },
        { status: 404 }
      );
    }

    const isMember = room.members.some((m) => m.userId === user.id);
    const isOwner = room.ownerId === user.id;

    // Check password protection if not member or owner
    if (!isMember && !isOwner && room.passwordHash) {
      return NextResponse.json({
        requiresPassword: true,
        room: {
          id: room.id,
          roomCode: room.roomCode,
          name: room.name,
          description: room.description,
          isPublic: room.isPublic,
          hasPassword: true,
        },
      });
    }

    // If public or user has access but not yet member, automatically add as member
    if (!isMember && !isOwner && (!room.passwordHash || room.isPublic)) {
      await db.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          role: "MEMBER",
        },
      });
    }

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        name: room.name,
        description: room.description,
        isPublic: room.isPublic,
        hasPassword: Boolean(room.passwordHash),
        ownerId: room.ownerId,
        owner: room.owner,
        members: room.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          username: m.user.username,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
      isOwner,
      userRole: isOwner ? "OWNER" : "MEMBER",
    });
  } catch (err) {
    console.error("Fetch room error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const room = await db.room.findFirst({
      where: {
        OR: [{ id: roomId }, { roomCode: roomId }],
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "This room could not be found." },
        { status: 404 }
      );
    }

    if (room.ownerId !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to modify this room." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, isPublic, password } = body;

    const data: Record<string, unknown> = {};
    if (name && name.trim()) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (isPublic !== undefined) data.isPublic = Boolean(isPublic);
    if (password !== undefined) {
      if (password === "") {
        data.passwordHash = null; // remove password
      } else {
        data.passwordHash = await hashPassword(password);
      }
    }

    const updated = await db.room.update({
      where: { id: room.id },
      data,
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (err) {
    console.error("Update room error:", err);
    return NextResponse.json(
      { error: "Failed to update room settings." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const room = await db.room.findFirst({
      where: {
        OR: [{ id: roomId }, { roomCode: roomId }],
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "This room could not be found." },
        { status: 404 }
      );
    }

    if (room.ownerId !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this room." },
        { status: 403 }
      );
    }

    await db.room.delete({
      where: { id: room.id },
    });

    return NextResponse.json({ success: true, message: "Room deleted" });
  } catch (err) {
    console.error("Delete room error:", err);
    return NextResponse.json(
      { error: "Failed to delete room." },
      { status: 500 }
    );
  }
}
