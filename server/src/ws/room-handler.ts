import { WebSocket } from "ws";
import type { SessionUser } from "../lib/auth";
import { canUserEdit } from "../lib/permissions";
import { serializeFile, serializeRoomBase } from "../lib/serializers";
import { getLanguageFromFilename } from "../lib/utils";
import { File } from "../models/file";
import { Message } from "../models/message";
import { PermissionRequest } from "../models/permission-request";
import { Room } from "../models/room";
import { RoomMember } from "../models/room-member";
import { deleteFileTree } from "../services/cascade";
import { getRoomExecutionState, stopRoomExecution } from "../services/code-runner";

interface RoomClient {
  ws: WebSocket;
  user: SessionUser;
  isAlive: boolean;
}

// Map of roomId -> connected clients. Shared through globalThis like the legacy
// server so multiple module instances (route bundles) see the same set.
const globalForRoom = globalThis as unknown as {
  __coderoomRoomClients?: Map<string, Set<RoomClient>>;
};
export const roomClients: Map<string, Set<RoomClient>> =
  globalForRoom.__coderoomRoomClients ||
  (globalForRoom.__coderoomRoomClients = new Map<string, Set<RoomClient>>());

export function broadcastToRoom(
  roomId: string,
  data: Record<string, unknown>,
  excludeWs?: WebSocket
): void {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

function getOnlineUsers(roomId: string): Array<{ id: string; username: string }> {
  const clients = roomClients.get(roomId);
  if (!clients) return [];

  const unique = new Map<string, { id: string; username: string }>();
  clients.forEach((client) => {
    unique.set(client.user.id, { id: client.user.id, username: client.user.username });
  });
  return Array.from(unique.values());
}

async function isRoomOwner(roomId: string, userId: string): Promise<boolean> {
  const room = await Room.findById(roomId).select("ownerId").exec();
  return room?.ownerId === userId;
}

// ---------------------------------------------------------------------------
// File event persistence (REST already writes; these handlers are idempotent)
// ---------------------------------------------------------------------------

async function handleFileCreate(roomId: string, user: SessionUser, payload: Record<string, unknown>): Promise<void> {
  const incoming = payload.file as Record<string, unknown> | undefined;
  if (!incoming) return;

  const incomingId = typeof incoming.id === "string" ? incoming.id : null;
  if (incomingId) {
    const existing = await File.findOne({ _id: incomingId, roomId }).exec();
    if (existing) {
      // Already persisted by the REST route; fan out a sanitized copy.
      if (!(await canUserEdit(user.id, roomId, existing._id))) return;
      broadcastToRoom(roomId, { type: "file:create", file: serializeFile(existing) });
      return;
    }
  }

  if (!(await canUserEdit(user.id, roomId))) return;

  const name = typeof incoming.name === "string" ? incoming.name.trim() : "";
  if (!name) return;

  const type = incoming.type === "folder" ? "folder" : "file";
  const parentId = typeof incoming.parentId === "string" ? incoming.parentId : null;

  if (parentId) {
    const folder = await File.findOne({ _id: parentId, roomId, type: "folder" }).select("_id").exec();
    if (!folder) return;
  }

  const duplicate = await File.exists({ roomId, parentId, name });
  if (duplicate) return;

  const content = typeof incoming.content === "string" ? incoming.content : "";
  const created = await File.create({
    roomId,
    parentId,
    name,
    type,
    language: type === "file" ? getLanguageFromFilename(name) : null,
    content: type === "file" ? content : "",
  });

  broadcastToRoom(roomId, { type: "file:create", file: serializeFile(created) });
}

async function handleFileRename(roomId: string, user: SessionUser, payload: Record<string, unknown>): Promise<void> {
  const incoming = payload.file as Record<string, unknown> | undefined;
  if (!incoming || typeof incoming.id !== "string") return;

  const name = typeof incoming.name === "string" ? incoming.name.trim() : "";
  if (!name) return;
  if (!(await canUserEdit(user.id, roomId, incoming.id))) return;

  const file = await File.findOne({ _id: incoming.id, roomId }).exec();
  if (!file) return;

  const duplicate = await File.exists({
    roomId,
    parentId: file.parentId,
    name,
    _id: { $ne: file._id },
  });
  if (duplicate) return;

  file.name = name;
  if (file.type === "file") {
    file.language = getLanguageFromFilename(name);
  }
  await file.save();

  broadcastToRoom(roomId, { type: "file:rename", file: serializeFile(file) });
}

async function handleFileUpdate(roomId: string, user: SessionUser, payload: Record<string, unknown>): Promise<void> {
  const incoming = payload.file as Record<string, unknown> | undefined;
  if (!incoming || typeof incoming.id !== "string") return;
  if (!(await canUserEdit(user.id, roomId, incoming.id))) return;

  const file = await File.findOne({ _id: incoming.id, roomId }).exec();
  if (!file) return;

  let changed = false;

  if (incoming.parentId !== undefined) {
    const parentId = incoming.parentId === null ? null : String(incoming.parentId);
    if (parentId) {
      const folder = await File.findOne({ _id: parentId, roomId, type: "folder" }).select("_id parentId").exec();
      if (!folder) return;

      if (file.type === "folder") {
        let current: string | null = folder.parentId;
        while (current) {
          if (current === file._id) return;
          const ancestor = await File.findById(current).select("parentId").exec();
          current = ancestor?.parentId ?? null;
        }
      }
    }
    file.parentId = parentId;
    changed = true;
  }

  if (changed) {
    await file.save();
    broadcastToRoom(roomId, { type: "file:update", file: serializeFile(file) });
  }
}

async function handleFileDelete(roomId: string, user: SessionUser, payload: Record<string, unknown>): Promise<void> {
  const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
  if (!fileId) return;

  const exists = await File.exists({ _id: fileId, roomId });
  if (!exists) {
    // Already deleted through the REST route; keep peers in sync.
    broadcastToRoom(roomId, { type: "file:delete", fileId });
    return;
  }

  if (!(await canUserEdit(user.id, roomId, fileId))) return;

  const deletedIds = await deleteFileTree(roomId, fileId);
  for (const id of deletedIds) {
    broadcastToRoom(roomId, { type: "file:delete", fileId: id });
  }
}

async function handleRoomUpdate(roomId: string, user: SessionUser, payload: Record<string, unknown>): Promise<void> {
  const incoming = payload.room as Record<string, unknown> | undefined;
  if (!incoming) return;
  if (!(await isRoomOwner(roomId, user.id))) return;

  const room = await Room.findById(roomId).exec();
  if (!room) return;

  if (typeof incoming.name === "string" && incoming.name.trim()) {
    room.name = incoming.name.trim();
  }
  if (incoming.description !== undefined) {
    const description = typeof incoming.description === "string" ? incoming.description.trim() : "";
    room.description = description || null;
  }
  if (typeof incoming.isPublic === "boolean") {
    room.isPublic = incoming.isPublic;
  }
  await room.save();

  broadcastToRoom(roomId, { type: "room:update", room: serializeRoomBase(room) });
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

export function handleRoomConnection(ws: WebSocket, roomId: string, user: SessionUser): void {
  if (!roomClients.has(roomId)) {
    roomClients.set(roomId, new Set());
  }

  const clients = roomClients.get(roomId)!;
  const client: RoomClient = { ws, user, isAlive: true };
  clients.add(client);

  const currentOnline = getOnlineUsers(roomId);
  const currentExecution = getRoomExecutionState(roomId);

  try {
    ws.send(
      JSON.stringify({
        type: "presence:update",
        onlineUsers: currentOnline,
        execution: currentExecution,
      })
    );
  } catch {
    // socket may already be closed
  }

  broadcastToRoom(
    roomId,
    { type: "presence:update", onlineUsers: currentOnline },
    ws
  );

  ws.on("pong", () => {
    client.isAlive = true;
  });

  ws.on("message", (rawData: { toString(): string }) => {
    void (async () => {
      try {
        const message = JSON.parse(rawData.toString()) as {
          type?: string;
          payload?: Record<string, unknown>;
        };
        const type = message.type;
        const payload = message.payload || {};

        switch (type) {
          case "presence:query": {
            ws.send(
              JSON.stringify({
                type: "presence:update",
                onlineUsers: getOnlineUsers(roomId),
                execution: getRoomExecutionState(roomId),
              })
            );
            break;
          }

          case "execution:query": {
            ws.send(
              JSON.stringify({
                type: "execution:update",
                execution: getRoomExecutionState(roomId),
              })
            );
            break;
          }

          case "execution:stop": {
            const isOwner = await isRoomOwner(roomId, user.id);
            const stopResult = stopRoomExecution(roomId, user.id, isOwner);
            if (stopResult.success) {
              broadcastToRoom(roomId, {
                type: "execution:end",
                result: {
                  stdout: "",
                  stderr: `\n[Execution stopped by ${user.username}]`,
                  exitCode: -1,
                  executionTimeMs: 0,
                  killed: true,
                  stoppedBy: user.username,
                },
              });
            }
            break;
          }

          case "chat:send": {
            const content = typeof payload.content === "string" ? payload.content.trim() : "";
            if (!content) return;

            const saved = await Message.create({ roomId, userId: user.id, content });
            broadcastToRoom(roomId, {
              type: "chat:message",
              message: {
                id: saved._id,
                roomId: saved.roomId,
                userId: saved.userId,
                username: user.username,
                content: saved.content,
                createdAt: saved.createdAt.toISOString(),
              },
            });
            break;
          }

          case "chat:clear": {
            await Message.deleteMany({ roomId });
            broadcastToRoom(roomId, { type: "chat:clear", clearedBy: user.username });
            break;
          }

          case "file:create":
            await handleFileCreate(roomId, user, payload);
            break;

          case "file:rename":
            await handleFileRename(roomId, user, payload);
            break;

          case "file:update":
            await handleFileUpdate(roomId, user, payload);
            break;

          case "file:delete":
            await handleFileDelete(roomId, user, payload);
            break;

          case "room:update":
            await handleRoomUpdate(roomId, user, payload);
            break;

          case "code:run": {
            broadcastToRoom(
              roomId,
              {
                type: "code:run",
                user: { id: user.id, username: user.username },
                filename: payload.filename,
                language: payload.language,
                result: payload.result,
                timestamp: Date.now(),
              },
              ws
            );
            break;
          }

          case "permission:request": {
            const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
            let fileName = "all files";
            if (fileId) {
              const fileRecord = await File.findOne({ _id: fileId, roomId }).select("name").exec();
              if (fileRecord) fileName = fileRecord.name;
            }

            let requestRecord = await PermissionRequest.findOne({
              roomId,
              userId: user.id,
              fileId,
              status: "PENDING",
            }).exec();

            if (!requestRecord) {
              requestRecord = await PermissionRequest.create({
                roomId,
                userId: user.id,
                fileId,
                status: "PENDING",
              });
            }

            broadcastToRoom(roomId, {
              type: "permission:request",
              request: {
                id: requestRecord._id,
                userId: user.id,
                username: user.username,
                fileId,
                fileName,
                createdAt: requestRecord.createdAt.toISOString(),
              },
            });
            break;
          }

          case "permission:grant": {
            if (!(await isRoomOwner(roomId, user.id))) return;

            const targetUserId = typeof payload.targetUserId === "string" ? payload.targetUserId : null;
            if (!targetUserId) return;
            const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
            const scope = typeof payload.scope === "string" ? payload.scope : fileId ? "file" : "room";

            const member = await RoomMember.findOne({ roomId, userId: targetUserId }).exec();
            if (!member) return;

            let updatedCanEdit = member.canEdit;
            const allowedFilesList = Array.isArray(member.allowedFiles) ? [...member.allowedFiles] : [];

            if (scope === "room" || !fileId) {
              updatedCanEdit = true;
            } else if (!allowedFilesList.includes(fileId)) {
              allowedFilesList.push(fileId);
            }

            member.canEdit = updatedCanEdit;
            member.role = updatedCanEdit ? "EDITOR" : member.role;
            member.allowedFiles = allowedFilesList;
            await member.save();

            await PermissionRequest.updateMany(
              {
                roomId,
                userId: targetUserId,
                status: "PENDING",
                ...(scope === "room" ? {} : { fileId }),
              },
              { $set: { status: "APPROVED" } }
            );

            broadcastToRoom(roomId, {
              type: "permission:updated",
              permission: {
                userId: targetUserId,
                roomId,
                canEdit: updatedCanEdit,
                allowedFiles: allowedFilesList,
                approvedFileId: fileId,
                scope,
                grantedBy: user.username,
              },
            });
            break;
          }

          case "permission:revoke": {
            if (!(await isRoomOwner(roomId, user.id))) return;

            const targetUserId = typeof payload.targetUserId === "string" ? payload.targetUserId : null;
            if (!targetUserId) return;
            const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
            const scope = typeof payload.scope === "string" ? payload.scope : fileId ? "file" : "room";

            const member = await RoomMember.findOne({ roomId, userId: targetUserId }).exec();
            if (!member) return;

            let updatedCanEdit = member.canEdit;
            let allowedFilesList = Array.isArray(member.allowedFiles) ? [...member.allowedFiles] : [];

            if (scope === "room" || !fileId) {
              updatedCanEdit = false;
              allowedFilesList = [];
            } else {
              allowedFilesList = allowedFilesList.filter((id) => id !== fileId);
            }

            member.canEdit = updatedCanEdit;
            member.role = updatedCanEdit ? "EDITOR" : "MEMBER";
            member.allowedFiles = allowedFilesList;
            await member.save();

            broadcastToRoom(roomId, {
              type: "permission:revoked",
              permission: {
                userId: targetUserId,
                roomId,
                canEdit: updatedCanEdit,
                allowedFiles: allowedFilesList,
                revokedFileId: fileId,
                scope,
                revokedBy: user.username,
              },
            });
            break;
          }

          case "permission:decline": {
            if (!(await isRoomOwner(roomId, user.id))) return;

            const targetUserId = typeof payload.targetUserId === "string" ? payload.targetUserId : null;
            const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
            const requestId = typeof payload.requestId === "string" ? payload.requestId : null;

            if (requestId) {
              await PermissionRequest.updateOne(
                { _id: requestId, roomId },
                { $set: { status: "DECLINED" } }
              );
            } else if (targetUserId) {
              await PermissionRequest.updateMany(
                {
                  roomId,
                  userId: targetUserId,
                  status: "PENDING",
                  ...(fileId ? { fileId } : {}),
                },
                { $set: { status: "DECLINED" } }
              );
            }

            broadcastToRoom(roomId, {
              type: "permission:declined",
              requestId,
              targetUserId,
              fileId,
              declinedBy: user.username,
            });
            break;
          }

          case "permission:cancel": {
            const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
            const requestId = typeof payload.requestId === "string" ? payload.requestId : null;

            if (requestId) {
              await PermissionRequest.deleteOne({ _id: requestId, userId: user.id, roomId });
            } else {
              await PermissionRequest.deleteMany({
                roomId,
                userId: user.id,
                status: "PENDING",
                fileId,
              });
            }

            broadcastToRoom(roomId, {
              type: "permission:cancelled",
              userId: user.id,
              fileId,
            });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Error handling room WebSocket message:", err);
      }
    })();
  });

  ws.on("close", () => {
    clients.delete(client);
    if (clients.size === 0) {
      roomClients.delete(roomId);
    } else {
      broadcastToRoom(roomId, {
        type: "presence:update",
        onlineUsers: getOnlineUsers(roomId),
      });
    }
  });
}

// Keep-alive sweep: terminate dead sockets and refresh presence every 30s.
const presenceInterval = setInterval(() => {
  roomClients.forEach((clients, roomId) => {
    let removed = false;
    clients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        removed = true;
      } else {
        client.isAlive = false;
        client.ws.ping();
      }
    });

    if (clients.size === 0) {
      roomClients.delete(roomId);
    } else if (removed) {
      broadcastToRoom(roomId, {
        type: "presence:update",
        onlineUsers: getOnlineUsers(roomId),
      });
    }
  });
}, 30000);
presenceInterval.unref?.();

export function shutdownRoomHandlers(): void {
  clearInterval(presenceInterval);
  roomClients.forEach((clients) => {
    clients.forEach((client) => {
      try {
        client.ws.close(1001, "Server shutting down");
      } catch {
        // ignore
      }
    });
  });
  roomClients.clear();
}
