import type { FileRecord } from "../models/file";
import type { MessageRecord } from "../models/message";
import type { PermissionRequestRecord } from "../models/permission-request";
import type { RoomRecord } from "../models/room";
import type { RoomMemberRecord, RoomRole } from "../models/room-member";
import type { UserRecord } from "../models/user";
import { buildInviteUrl } from "./public-url";

export function iso(
  value: Date | string | null | undefined,
  fallback: Date = new Date(),
): string {
  if (!value) return fallback.toISOString();
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export interface UserSummary {
  id: string;
  username: string;
}

export function serializeUser(
  user: Pick<UserRecord, "_id" | "username">,
): UserSummary {
  return { id: String(user._id), username: user.username };
}

export function serializeUserWithDate(
  user: Pick<UserRecord, "_id" | "username" | "createdAt">,
): { id: string; username: string; createdAt: string } {
  return {
    id: String(user._id),
    username: user.username,
    createdAt: iso(user.createdAt),
  };
}

export interface SerializedFile {
  id: string;
  roomId: string;
  parentId: string | null;
  name: string;
  type: string;
  language: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeFile(file: FileRecord): SerializedFile {
  return {
    id: String(file._id),
    roomId: file.roomId,
    parentId: file.parentId ?? null,
    name: file.name,
    type: file.type,
    language: file.language ?? null,
    content: file.content,
    createdAt: iso(file.createdAt),
    updatedAt: iso(file.updatedAt),
  };
}

export interface SerializedMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export function serializeMessage(
  message: MessageRecord,
  username: string,
): SerializedMessage {
  return {
    id: String(message._id),
    roomId: message.roomId,
    userId: message.userId,
    username,
    content: message.content,
    createdAt: iso(message.createdAt),
  };
}

export interface SerializedMember {
  id: string;
  userId: string;
  username: string;
  role: RoomRole;
  canEdit: boolean;
  allowedFiles: string[];
  joinedAt: string;
}

export function serializeMember(
  member: RoomMemberRecord,
  username: string,
): SerializedMember {
  return {
    id: String(member._id),
    userId: member.userId,
    username,
    role: member.role,
    canEdit: member.role === "OWNER" || Boolean(member.canEdit),
    allowedFiles: Array.isArray(member.allowedFiles) ? member.allowedFiles : [],
    joinedAt: iso(member.joinedAt),
  };
}

export interface SerializedPendingRequest {
  id: string;
  userId: string;
  username: string;
  fileId: string | null;
  fileName: string | null;
  createdAt: string;
}

export function serializePendingRequest(
  request: PermissionRequestRecord,
  username: string,
  fileName: string | null,
): SerializedPendingRequest {
  return {
    id: String(request._id),
    userId: request.userId,
    username,
    fileId: request.fileId ?? null,
    fileName,
    createdAt: iso(request.createdAt),
  };
}

export interface SerializedMyPendingRequest {
  id: string;
  fileId: string | null;
  fileName: string | null;
  status: string;
  createdAt: string;
}

export function serializeMyPendingRequest(
  request: PermissionRequestRecord,
  fileName: string | null,
): SerializedMyPendingRequest {
  return {
    id: String(request._id),
    fileId: request.fileId ?? null,
    fileName,
    status: request.status,
    createdAt: iso(request.createdAt),
  };
}

export interface SerializedRoomBase {
  id: string;
  roomCode: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  hasPassword: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  /** Canonical HTTPS invite URL, or null when PUBLIC_BASE_URL is unavailable. */
  shareUrl: string | null;
}

export function serializeRoomBase(room: RoomRecord): SerializedRoomBase {
  return {
    id: String(room._id),
    roomCode: room.roomCode,
    name: room.name,
    description: room.description ?? null,
    isPublic: room.isPublic,
    hasPassword: Boolean(room.passwordHash),
    ownerId: room.ownerId,
    createdAt: iso(room.createdAt),
    updatedAt: iso(room.updatedAt),
    shareUrl: buildInviteUrl(room.roomCode),
  };
}
