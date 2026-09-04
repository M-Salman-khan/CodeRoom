import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

  try {
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const messages = await db.message.findMany({
      where: { roomId: room.id },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    // Reverse to chronological order (oldest to newest)
    const formatted = messages.reverse().map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      userId: msg.userId,
      username: msg.user.username,
      content: msg.content,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({ messages: formatted });
  } catch (err) {
    console.error("Fetch messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

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
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: "Message content cannot be empty" },
        { status: 400 }
      );
    }

    const message = await db.message.create({
      data: {
        roomId: room.id,
        userId: user.id,
        content: trimmedContent,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: {
          id: message.id,
          roomId: message.roomId,
          userId: message.userId,
          username: message.user.username,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create message error:", err);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}
