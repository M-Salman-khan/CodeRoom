import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLanguageFromFilename } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: { roomId: string; fileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = params;

  try {
    const file = await db.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ file });
  } catch (err) {
    console.error("Get file error:", err);
    return NextResponse.json(
      { error: "Failed to get file" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { roomId: string; fileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = params;

  try {
    const existing = await db.file.findUnique({
      where: { id: fileId },
    });

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, content, language, parentId } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined && name.trim().length > 0) {
      const trimmedName = name.trim();
      updateData.name = trimmedName;
      if (existing.type === "file") {
        updateData.language = getLanguageFromFilename(trimmedName);
      }
    }

    if (content !== undefined && existing.type === "file") {
      updateData.content = content;
    }

    if (language !== undefined && existing.type === "file") {
      updateData.language = language;
    }

    if (parentId !== undefined) {
      if (parentId === existing.id) {
        return NextResponse.json(
          { error: "Cannot move an item into itself" },
          { status: 400 }
        );
      }

      if (parentId !== null) {
        const targetFolder = await db.file.findUnique({
          where: { id: parentId },
        });

        if (!targetFolder || targetFolder.roomId !== existing.roomId || targetFolder.type !== "folder") {
          return NextResponse.json(
            { error: "Destination folder not found" },
            { status: 400 }
          );
        }

        // Prevent moving a folder into its own subfolder
        if (existing.type === "folder") {
          let currId: string | null = targetFolder.parentId;
          while (currId) {
            if (currId === existing.id) {
              return NextResponse.json(
                { error: "Cannot move a folder into its own subfolder" },
                { status: 400 }
              );
            }
            const parentFolder: { parentId: string | null } | null = await db.file.findUnique({
              where: { id: currId },
              select: { parentId: true },
            });
            currId = parentFolder?.parentId ?? null;
          }
        }
      }

      // Check for duplicate name in destination
      const destName = updateData.name ? (updateData.name as string) : existing.name;
      const duplicate = await db.file.findFirst({
        where: {
          roomId: existing.roomId,
          parentId: parentId,
          name: destName,
          id: { not: existing.id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `An item named "${destName}" already exists in the destination.` },
          { status: 409 }
        );
      }

      updateData.parentId = parentId;
    }

    const updated = await db.file.update({
      where: { id: fileId },
      data: updateData,
    });

    return NextResponse.json({ file: updated });
  } catch (err) {
    console.error("Update file error:", err);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { roomId: string; fileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = params;

  try {
    const existing = await db.file.findUnique({
      where: { id: fileId },
    });

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await db.file.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("Delete file error:", err);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
