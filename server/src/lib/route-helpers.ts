import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import type { FileRecord } from "../models/file";
import { File } from "../models/file";
import type { RoomRecord } from "../models/room";
import { RoomMember } from "../models/room-member";
import { findRoomByKey } from "./rooms";

export async function roomFromParams(
  req: Request,
  res: Response,
  errorMessage = "Room not found",
): Promise<HydratedDocument<RoomRecord> | null> {
  const room = await findRoomByKey(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: errorMessage });
    return null;
  }
  return room;
}

/**
 * Every room-scoped resource (files, chat, execution, AI, permissions) requires
 * an owner or membership record. Public-room auto-join happens in
 * GET /api/rooms/:roomId and POST /api/rooms/:roomId/join, not implicitly here.
 */
export async function requireRoomMembership(
  req: Request,
  res: Response,
  room: Pick<RoomRecord, "_id" | "ownerId">,
): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  if (room.ownerId === userId) return true;

  const member = await RoomMember.exists({ roomId: room._id, userId });
  if (!member) {
    res.status(403).json({
      error: "You are not a member of this room. Join the room first.",
      code: "ROOM_MEMBERSHIP_REQUIRED",
    });
    return false;
  }
  return true;
}

export async function fileFromParams(
  req: Request,
  res: Response,
  roomId?: string,
): Promise<HydratedDocument<FileRecord> | null> {
  const query: Record<string, unknown> = { _id: req.params.fileId };
  if (roomId) query.roomId = roomId;

  const file = await File.findOne(query).exec();
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return null;
  }
  return file;
}
