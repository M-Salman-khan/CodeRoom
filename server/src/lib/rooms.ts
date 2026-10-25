import { Room } from "../models/room";
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
