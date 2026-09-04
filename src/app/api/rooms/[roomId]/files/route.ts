import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLanguageFromFilename } from "@/lib/utils";

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
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const files = await db.file.findMany({
      where: { roomId: room.id },
      orderBy: [
        { type: "desc" }, // folders first
        { name: "asc" },
      ],
    });

    return NextResponse.json({ files });
  } catch (err) {
    console.error("Fetch files error:", err);
    return NextResponse.json(
      { error: "Failed to fetch files" },
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
    const { name, type = "file", parentId = null, content = "" } = body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "File or folder name is required" },
        { status: 400 }
      );
    }

    // Check duplicate in same directory
    const duplicate = await db.file.findFirst({
      where: {
        roomId: room.id,
        parentId: parentId || null,
        name: trimmedName,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: `An item named "${trimmedName}" already exists in this folder.` },
        { status: 409 }
      );
    }

    const language = type === "file" ? getLanguageFromFilename(trimmedName) : null;

    const file = await db.file.create({
      data: {
        roomId: room.id,
        parentId: parentId || null,
        name: trimmedName,
        type,
        language,
        content: type === "file" ? content : "",
      },
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    console.error("Create file error:", err);
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}
