import { File } from "../models/file";
import { PermissionRequest } from "../models/permission-request";
import type { RoomRecord } from "../models/room";
import { RoomMember } from "../models/room-member";
import { User } from "../models/user";
import {
  iso,
  serializeMember,
  serializeMyPendingRequest,
  serializePendingRequest,
  serializeRoomBase,
  type SerializedMember,
  type SerializedMyPendingRequest,
  type SerializedPendingRequest,
  type SerializedRoomBase,
  type UserSummary,
} from "./serializers";

export type UserRole = "OWNER" | "EDITOR" | "MEMBER";

export interface RoomDetailsPayload {
  room: SerializedRoomBase & {
    owner: UserSummary;
    members: SerializedMember[];
    pendingRequests: SerializedPendingRequest[];
  };
  isOwner: boolean;
  userRole: UserRole;
  canEdit: boolean;
  allowedFiles: string[];
  myPendingRequests: SerializedMyPendingRequest[];
}

/**
 * Build the full room payload (members, pending permission requests and the
 * current user's permissions) used by GET /api/rooms/:roomId and permissions.
 */
export async function buildRoomDetails(
  room: RoomRecord,
  userId: string
): Promise<RoomDetailsPayload> {
  const isOwner = room.ownerId === userId;

  const [owner, members, pendingRequests] = await Promise.all([
    User.findById(room.ownerId).select("_id username").exec(),
    RoomMember.find({ roomId: room._id }).sort({ joinedAt: 1, _id: 1 }).exec(),
    PermissionRequest.find({ roomId: room._id, status: "PENDING" })
      .sort({ createdAt: -1 })
      .exec(),
  ]);

  const referencedUserIds = new Set<string>([room.ownerId]);
  members.forEach((member) => referencedUserIds.add(member.userId));
  pendingRequests.forEach((request) => referencedUserIds.add(request.userId));

  const users = await User.find({ _id: { $in: Array.from(referencedUserIds) } })
    .select("_id username")
    .exec();
  const usernameById = new Map(users.map((user) => [user._id, user.username]));

  const fileIds = pendingRequests
    .map((request) => request.fileId)
    .filter((fileId): fileId is string => Boolean(fileId));
  const files =
    fileIds.length > 0
      ? await File.find({ _id: { $in: fileIds } }).select("_id name").exec()
      : [];
  const fileNameById = new Map(files.map((file) => [file._id, file.name]));

  const serializedMembers = members.map((member) =>
    serializeMember(member, usernameById.get(member.userId) || "unknown")
  );

  const currentMember = members.find((member) => member.userId === userId);
  const allowedFiles = isOwner
    ? ["*"]
    : Array.isArray(currentMember?.allowedFiles)
      ? [...(currentMember?.allowedFiles as string[])]
      : [];
  const canEdit = isOwner || Boolean(currentMember?.canEdit);
  const userRole: UserRole = isOwner ? "OWNER" : canEdit ? "EDITOR" : "MEMBER";

  const serializedPending = pendingRequests.map((request) =>
    serializePendingRequest(
      request,
      usernameById.get(request.userId) || "unknown",
      request.fileId ? fileNameById.get(request.fileId) || null : null
    )
  );

  return {
    room: {
      ...serializeRoomBase(room),
      owner: {
        id: room.ownerId,
        username: owner?.username || usernameById.get(room.ownerId) || "unknown",
      },
      members: serializedMembers,
      pendingRequests: isOwner ? serializedPending : [],
    },
    isOwner,
    userRole,
    canEdit,
    allowedFiles,
    myPendingRequests: pendingRequests
      .filter((request) => request.userId === userId)
      .map((request) =>
        serializeMyPendingRequest(
          request,
          request.fileId ? fileNameById.get(request.fileId) || null : null
        )
      ),
  };
}

export function serializedCreatedAt(room: RoomRecord): string {
  return iso(room.createdAt);
}
