import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { generateRoomCode } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rooms = await db.room.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, username: true },
        },
        _count: {
          select: { members: true, files: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ rooms });
  } catch (err) {
    console.error("Fetch rooms error:", err);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, password, isPublic } = body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    // Generate a unique room code
    let roomCode = generateRoomCode();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const existing = await db.room.findUnique({ where: { roomCode } });
      if (!existing) {
        isUnique = true;
      } else {
        roomCode = generateRoomCode();
        attempts++;
      }
    }

    let passwordHash: string | null = null;
    if (password && password.trim().length > 0) {
      passwordHash = await hashPassword(password.trim());
    }

    const room = await db.room.create({
      data: {
        roomCode,
        name: trimmedName,
        description: description?.trim() || null,
        passwordHash,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        files: {
          create: [
            {
              name: "main.ts",
              type: "file",
              language: "typescript",
              content: `// Welcome to ${trimmedName}!\n// Room Code: ${roomCode}\n\nconsole.log("Hello from CodeRoom!");\n`,
            },
            {
              name: "README.md",
              type: "file",
              language: "markdown",
              content: `# ${trimmedName}\n\nRoom Code: \`${roomCode}\`\n\nInvite your team and start coding collaboratively in real-time.\n`,
            },
          ],
        },
      },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    console.error("Create room error:", err);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
