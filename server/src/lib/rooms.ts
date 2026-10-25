import { Room } from "../models/room";
import { RoomMember } from "../models/room-member";
import { generateRoomCode } from "./utils";

/** Find a room by its id, room code, or uppercase room code. */
export function findRoomByKey(key: string) {
  const or: Array<Record<string, string>> = [{ _id: key }, { roomCode: key }];
  const upper = key.toUpperCase();
  if (upper !== key) {
    or.push({ roomCode: upper });
  }
  return Room.findOne({ $or: or });
}

export interface RoomAccess {
  roomId: string;
  roomCode: string;
  isOwner: boolean;
}

/**
 * Resolve a room key (id or code) and require the user to be its owner or a
 * membership record. Used by WebSocket upgrades and other non-route callers.
 */
export async function authorizeRoomKey(
  userId: string,
  key: string,
): Promise<RoomAccess | null> {
  if (!key || key.length > 64) return null;
  const room = await findRoomByKey(key).select("_id roomCode ownerId").exec();
  if (!room) return null;

  if (room.ownerId === userId) {
    return { roomId: String(room._id), roomCode: room.roomCode, isOwner: true };
  }

  const member = await RoomMember.exists({ roomId: room._id, userId });
  if (!member) return null;

  return { roomId: String(room._id), roomCode: room.roomCode, isOwner: false };
}

/** Generate a room code that isn't already used, retrying a bounded number of times. */
export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    const existing = await Room.exists({ roomCode: code });
    if (!existing) return code;
  }
  // Extremely unlikely fallback: keep generating until a free code is found.
  for (;;) {
    const code = generateRoomCode();
    const existing = await Room.exists({ roomCode: code });
    if (!existing) return code;
  }
}
