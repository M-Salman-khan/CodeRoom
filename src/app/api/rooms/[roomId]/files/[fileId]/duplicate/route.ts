import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLanguageFromFilename } from "@/lib/utils";

function getUniqueName(originalName: string, existingNames: string[]) {
  if (!existingNames.includes(originalName)) {
    return originalName;
  }

  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex > 0 ? originalName.substring(0, dotIndex) : originalName;
  const ext = dotIndex > 0 ? originalName.substring(dotIndex) : "";

  let candidate = `${base} copy${ext}`;
  let counter = 2;
  while (existingNames.includes(candidate)) {
    candidate = `${base} copy ${counter}${ext}`;
    counter++;
  }
  return candidate;
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string; fileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = params;

  try {
    const source = await db.file.findUnique({
      where: { id: fileId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source file not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const targetParentId: string | null =
      body.targetParentId !== undefined ? body.targetParentId : source.parentId;

    if (targetParentId !== null) {
      const targetFolder = await db.file.findUnique({
        where: { id: targetParentId },
      });
      if (!targetFolder || targetFolder.roomId !== source.roomId || targetFolder.type !== "folder") {
        return NextResponse.json({ error: "Invalid target folder" }, { status: 400 });
      }

      // Cannot paste folder into its own descendant
      if (source.type === "folder") {
        let currId: string | null = targetParentId;
        while (currId) {
          if (currId === source.id) {
            return NextResponse.json(
              { error: "Cannot copy a folder into its own subfolder" },
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

    // Get sibling names in destination to avoid collision
    const siblings = await db.file.findMany({
      where: {
        roomId: source.roomId,
        parentId: targetParentId,
      },
      select: { name: true },
    });
    const siblingNames = siblings.map((s) => s.name);

    let newName: string;
    if (targetParentId === source.parentId) {
      const dotIndex = source.name.lastIndexOf(".");
      const base = dotIndex > 0 ? source.name.substring(0, dotIndex) : source.name;
      const ext = dotIndex > 0 ? source.name.substring(dotIndex) : "";
      let candidate = `${base} copy${ext}`;
      let counter = 2;
      while (siblingNames.includes(candidate)) {
        candidate = `${base} copy ${counter}${ext}`;
        counter++;
      }
      newName = candidate;
    } else {
      newName = getUniqueName(source.name, siblingNames);
    }

    interface CreatedFileRecord {
      id: string;
      roomId: string;
      parentId: string | null;
      name: string;
      type: string;
      language: string | null;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }

    const createdFiles: CreatedFileRecord[] = [];

    if (source.type === "file") {
      const newFile = await db.file.create({
        data: {
          roomId: source.roomId,
          parentId: targetParentId,
          name: newName,
          type: "file",
          language: getLanguageFromFilename(newName),
          content: source.content,
        },
      });
      createdFiles.push(newFile);
    } else {
      const newRootFolder = await db.file.create({
        data: {
          roomId: source.roomId,
          parentId: targetParentId,
          name: newName,
          type: "folder",
          content: "",
        },
      });
      createdFiles.push(newRootFolder);

      async function copyChildren(originalParentId: string, newParentFolderId: string) {
        const children = await db.file.findMany({
          where: {
            roomId: source!.roomId,
            parentId: originalParentId,
          },
        });

        for (const child of children) {
          if (child.type === "folder") {
            const childFolder = await db.file.create({
              data: {
                roomId: source!.roomId,
                parentId: newParentFolderId,
                name: child.name,
                type: "folder",
                content: "",
              },
            });
            createdFiles.push(childFolder);
            await copyChildren(child.id, childFolder.id);
          } else {
            const childFile = await db.file.create({
              data: {
                roomId: source!.roomId,
                parentId: newParentFolderId,
                name: child.name,
                type: "file",
                language: child.language,
                content: child.content,
              },
            });
            createdFiles.push(childFile);
          }
        }
      }

      await copyChildren(source.id, newRootFolder.id);
    }

    return NextResponse.json({ files: createdFiles });
  } catch (err) {
    console.error("Duplicate file error:", err);
    return NextResponse.json({ error: "Failed to duplicate item" }, { status: 500 });
  }
}
