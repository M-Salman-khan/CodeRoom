import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import type { FileRecord } from "../models/file";
import { File } from "../models/file";
import type { RoomRecord } from "../models/room";
import { findRoomByKey } from "./rooms";

export async function roomFromParams(
  req: Request,
  res: Response,
  errorMessage = "Room not found"
): Promise<HydratedDocument<RoomRecord> | null> {
  const room = await findRoomByKey(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: errorMessage });
    return null;
  }
  return room;
}

export async function fileFromParams(
  req: Request,
  res: Response,
  roomId?: string
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
