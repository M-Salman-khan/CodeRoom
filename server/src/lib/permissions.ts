import { Room } from "../models/room";
import { RoomMember } from "../models/room-member";

export interface UserPermissionInfo {
  isOwner: boolean;
  canEdit: boolean;
  allowedFiles: string[];
}

/** Get permission information for a user in a specific room (by id or code). */
export async function getUserPermissionInfo(
  userId: string,
  roomIdOrCode: string
): Promise<UserPermissionInfo> {
  const room = await Room.findOne({
    $or: [{ _id: roomIdOrCode }, { roomCode: roomIdOrCode }, { roomCode: roomIdOrCode.toUpperCase() }],
  })
    .select("_id ownerId")
    .exec();

  if (!room) {
    return { isOwner: false, canEdit: false, allowedFiles: [] };
  }

  if (room.ownerId === userId) {
    return { isOwner: true, canEdit: true, allowedFiles: ["*"] };
  }

  const member = await RoomMember.findOne({ roomId: room._id, userId })
    .select("canEdit allowedFiles")
    .exec();

  if (!member) {
    return { isOwner: false, canEdit: false, allowedFiles: [] };
  }

  const allowedFiles = Array.isArray(member.allowedFiles) ? member.allowedFiles : [];

  return {
    isOwner: false,
    canEdit: Boolean(member.canEdit),
    allowedFiles,
  };
}

/** Check whether a user may edit a room or a specific file inside it. */
export async function canUserEdit(
  userId: string,
  roomIdOrCode: string,
  fileId?: string | null
): Promise<boolean> {
  const info = await getUserPermissionInfo(userId, roomIdOrCode);
  if (info.isOwner || info.canEdit) return true;
  if (fileId && (info.allowedFiles.includes(fileId) || info.allowedFiles.includes("*"))) {
    return true;
  }
  return false;
}

export async function isRoomMember(userId: string, roomId: string): Promise<boolean> {
  const member = await RoomMember.findOne({ roomId, userId }).select("_id").exec();
  return Boolean(member);
}
