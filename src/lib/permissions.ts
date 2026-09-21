import { db } from "./db";

export interface UserPermissionInfo {
  isOwner: boolean;
  canEdit: boolean;
  allowedFiles: string[];
}

/**
 * Get permission information for a user in a specific room.
 * Admin/Owner always has full edit rights.
 */
export async function getUserPermissionInfo(
  userId: string,
  roomId: string
): Promise<UserPermissionInfo> {
  const room = await db.room.findFirst({
    where: {
      OR: [{ id: roomId }, { roomCode: roomId }],
    },
    select: { id: true, ownerId: true },
  });

  if (!room) {
    return { isOwner: false, canEdit: false, allowedFiles: [] };
  }

  if (room.ownerId === userId) {
    return { isOwner: true, canEdit: true, allowedFiles: ["*"] };
  }

  const member = await db.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
    select: { role: true, canEdit: true, allowedFiles: true },
  });

  if (!member) {
    return { isOwner: false, canEdit: false, allowedFiles: [] };
  }

  let allowedFilesList: string[] = [];
  try {
    allowedFilesList = JSON.parse(member.allowedFiles || "[]");
  } catch {
    allowedFilesList = [];
  }

  return {
    isOwner: false,
    canEdit: member.canEdit,
    allowedFiles: allowedFilesList,
  };
}

/**
 * Check whether a user has permission to edit a specific file (or any file) in a room.
 */
export async function canUserEdit(
  userId: string,
  roomId: string,
  fileId?: string | null
): Promise<boolean> {
  const info = await getUserPermissionInfo(userId, roomId);
  if (info.isOwner || info.canEdit) {
    return true;
  }
  if (fileId && (info.allowedFiles.includes(fileId) || info.allowedFiles.includes("*"))) {
    return true;
  }
  return false;
}
