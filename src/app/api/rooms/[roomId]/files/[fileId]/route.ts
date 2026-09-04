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
    const { name, content, language } = body;

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
