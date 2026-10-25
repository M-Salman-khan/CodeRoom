import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { canUserEdit } from "../lib/permissions";
import { fileFromParams, roomFromParams } from "../lib/route-helpers";
import { serializeFile } from "../lib/serializers";
import { getLanguageFromFilename } from "../lib/utils";
import { buildYjsState } from "../lib/yjs-state";
import { requireAuth } from "../middleware/auth";
import { File, type FileRecord } from "../models/file";
import { deleteFileTree } from "../services/cascade";
import { broadcastToRoom } from "../ws/room-handler";

const router = Router({ mergeParams: true });

function uniqueCopyName(originalName: string, existingNames: string[]): string {
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

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;

    const files = await File.find({ roomId: room._id })
      .sort({ type: -1, name: 1, _id: 1 })
      .exec();

    res.json({ files: files.map(serializeFile) });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;

    const allowed = await canUserEdit(user.id, room._id);
    if (!allowed) {
      res.status(403).json({ error: "You do not have permission to create files in this room." });
      return;
    }

    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type === "folder" ? "folder" : "file";
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    const content = typeof body.content === "string" ? body.content : "";

    if (!name) {
      res.status(400).json({ error: "File or folder name is required" });
      return;
    }

    if (parentId) {
      const parent = await File.findOne({ _id: parentId, roomId: room._id, type: "folder" })
        .select("_id")
        .exec();
      if (!parent) {
        res.status(400).json({ error: "Destination folder not found" });
        return;
      }
    }

    const duplicate = await File.exists({ roomId: room._id, parentId, name });
    if (duplicate) {
      res.status(409).json({ error: `An item named "${name}" already exists in this folder.` });
      return;
    }

    const language = type === "file" ? getLanguageFromFilename(name) : null;
    const fileContent = type === "file" ? content : "";

    const file = await File.create({
      roomId: room._id,
      parentId,
      name,
      type,
      language,
      content: fileContent,
      yjsState: type === "file" ? buildYjsState(fileContent) : null,
    });

    const serialized = serializeFile(file);
    broadcastToRoom(room._id, { type: "file:create", file: serialized });

    res.status(201).json({ file: serialized });
  })
);

router.get(
  "/:fileId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;

    const file = await fileFromParams(req, res, room._id);
    if (!file) return;

    res.json({ file: serializeFile(file) });
  })
);

router.patch(
  "/:fileId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;

    const file = await fileFromParams(req, res, room._id);
    if (!file) return;

    const allowed = await canUserEdit(user.id, room._id, file._id);
    if (!allowed) {
      res.status(403).json({ error: "You do not have permission to edit this file." });
      return;
    }

    const body = req.body || {};
    const nameChanged =
      typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim() !== file.name;
    const destinationParentId =
      body.parentId === undefined
        ? undefined
        : body.parentId === null || body.parentId === ""
          ? null
          : String(body.parentId);
    const destinationChanged =
      destinationParentId !== undefined && destinationParentId !== (file.parentId ?? null);

    if (nameChanged || destinationChanged) {
      const effectiveName =
        typeof body.name === "string" && body.name.trim().length > 0
          ? body.name.trim()
          : file.name;
      const effectiveParent =
        destinationParentId !== undefined ? destinationParentId : (file.parentId ?? null);

      const duplicate = await File.exists({
        roomId: room._id,
        parentId: effectiveParent,
        name: effectiveName,
        _id: { $ne: file._id },
      });
      if (duplicate) {
        res.status(409).json({
          error: `An item named "${effectiveName}" already exists in the destination.`,
        });
        return;
      }
    }

    if (destinationParentId !== undefined) {
      if (destinationParentId === file._id) {
        res.status(400).json({ error: "Cannot move an item into itself" });
        return;
      }

      if (destinationParentId !== null) {
        const targetFolder = await File.findOne({
          _id: destinationParentId,
          roomId: room._id,
          type: "folder",
        }).exec();
        if (!targetFolder) {
          res.status(400).json({ error: "Destination folder not found" });
          return;
        }

        if (file.type === "folder") {
          let currentId: string | null = targetFolder.parentId;
          while (currentId) {
            if (currentId === file._id) {
              res.status(400).json({ error: "Cannot move a folder into its own subfolder" });
              return;
            }
            const parentFolder = await File.findById(currentId).select("parentId").exec();
            currentId = parentFolder?.parentId ?? null;
          }
        }
      }

      file.parentId = destinationParentId;
    }

    if (nameChanged) {
      const trimmedName = String(body.name).trim();
      file.name = trimmedName;
      if (file.type === "file") {
        file.language = getLanguageFromFilename(trimmedName);
      }
    }

    if (body.content !== undefined && file.type === "file") {
      const content = typeof body.content === "string" ? body.content : String(body.content);
      file.content = content;
      file.yjsState = buildYjsState(content);
    }

    if (body.language !== undefined && file.type === "file") {
      file.language = typeof body.language === "string" && body.language ? body.language : null;
    }

    await file.save();

    const serialized = serializeFile(file);
    broadcastToRoom(room._id, {
      type: nameChanged ? "file:rename" : "file:update",
      file: serialized,
    });

    res.json({ file: serialized });
  })
);

router.delete(
  "/:fileId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;

    const file = await fileFromParams(req, res, room._id);
    if (!file) return;

    const allowed = await canUserEdit(user.id, room._id, file._id);
    if (!allowed) {
      res.status(403).json({ error: "You do not have permission to delete this file." });
      return;
    }

    const deletedIds = await deleteFileTree(room._id, file._id);
    for (const id of deletedIds) {
      broadcastToRoom(room._id, { type: "file:delete", fileId: id });
    }

    res.json({ success: true, message: "Deleted successfully" });
  })
);

router.post(
  "/:fileId/duplicate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;

    const source = await fileFromParams(req, res, room._id);
    if (!source) return;

    const allowed = await canUserEdit(user.id, room._id, source._id);
    if (!allowed) {
      res.status(403).json({ error: "You do not have permission to duplicate this item." });
      return;
    }

    const body = req.body || {};
    const targetParentId: string | null =
      body.targetParentId !== undefined
        ? body.targetParentId === null || body.targetParentId === ""
          ? null
          : String(body.targetParentId)
        : (source.parentId ?? null);

    if (targetParentId !== null) {
      const targetFolder = await File.findOne({
        _id: targetParentId,
        roomId: room._id,
        type: "folder",
      }).exec();
      if (!targetFolder) {
        res.status(400).json({ error: "Invalid target folder" });
        return;
      }

      if (source.type === "folder") {
        let currentId: string | null = targetParentId;
        while (currentId) {
          if (currentId === source._id) {
            res.status(400).json({ error: "Cannot copy a folder into its own subfolder" });
            return;
          }
          const parentFolder = await File.findById(currentId).select("parentId").exec();
          currentId = parentFolder?.parentId ?? null;
        }
      }
    }

    const siblings = await File.find({ roomId: room._id, parentId: targetParentId })
      .select("name")
      .exec();
    const newName = uniqueCopyName(
      source.name,
      siblings.map((sibling) => sibling.name)
    );

    const createdFiles: FileRecord[] = [];

    if (source.type === "file") {
      const duplicate = await File.create({
        roomId: room._id,
        parentId: targetParentId,
        name: newName,
        type: "file",
        language: getLanguageFromFilename(newName),
        content: source.content,
        yjsState: buildYjsState(source.content),
      });
      createdFiles.push(duplicate);
    } else {
      const rootFolder = await File.create({
        roomId: room._id,
        parentId: targetParentId,
        name: newName,
        type: "folder",
        language: null,
        content: "",
      });
      createdFiles.push(rootFolder);

      const copyChildren = async (originalParentId: string, newParentFolderId: string): Promise<void> => {
        const children = await File.find({
          roomId: room._id,
          parentId: originalParentId,
        })
          .sort({ name: 1 })
          .exec();

        for (const child of children) {
          if (child.type === "folder") {
            const childFolder = await File.create({
              roomId: room._id,
              parentId: newParentFolderId,
              name: child.name,
              type: "folder",
              language: null,
              content: "",
            });
            createdFiles.push(childFolder);
            await copyChildren(child._id, childFolder._id);
          } else {
            const childFile = await File.create({
              roomId: room._id,
              parentId: newParentFolderId,
              name: child.name,
              type: "file",
              language: child.language,
              content: child.content,
              yjsState: buildYjsState(child.content),
            });
            createdFiles.push(childFile);
          }
        }
      };

      await copyChildren(source._id, rootFolder._id);
    }

    const serialized = createdFiles.map(serializeFile);
    for (const file of serialized) {
      broadcastToRoom(room._id, { type: "file:create", file });
    }

    res.json({ files: serialized });
  })
);

export default router;
