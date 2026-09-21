import { WebSocket } from "ws";
import { db } from "../lib/db";
import { SessionUser } from "../lib/auth";
import { getRoomExecutionState, stopRoomExecution } from "./code-runner";

interface RoomClient {
  ws: WebSocket;
  user: SessionUser;
  isAlive: boolean;
}

// Map of roomId -> Set of connected clients (Shared across server and Next.js route bundles via globalThis)
const globalForRoom = globalThis as unknown as {
  __roomClients?: Map<string, Set<RoomClient>>;
};
export const roomClients: Map<string, Set<RoomClient>> =
  globalForRoom.__roomClients || (globalForRoom.__roomClients = new Map<string, Set<RoomClient>>());

export function broadcastToRoom(
  roomId: string,
  data: Record<string, unknown>,
  excludeWs?: WebSocket
) {
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
    unique.set(client.user.id, {
      id: client.user.id,
      username: client.user.username,
    });
  });
  return Array.from(unique.values());
}

export function handleRoomConnection(
  ws: WebSocket,
  roomId: string,
  user: SessionUser
) {
  if (!roomClients.has(roomId)) {
    roomClients.set(roomId, new Set());
  }

  const clients = roomClients.get(roomId)!;
  const client: RoomClient = { ws, user, isAlive: true };
  clients.add(client);

  // Send initial presence directly to new client and broadcast to others
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
  } catch {}

  broadcastToRoom(
    roomId,
    {
      type: "presence:update",
      onlineUsers: currentOnline,
    },
    ws
  );

  // Keep-alive ping
  ws.on("pong", () => {
    client.isAlive = true;
  });

  ws.on("message", async (rawData: string) => {
    try {
      const message = JSON.parse(rawData.toString());
      const { type, payload } = message;

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
          const room = await db.room.findUnique({
            where: { id: roomId },
            select: { ownerId: true },
          });
          const isOwner = room?.ownerId === user.id;
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
          const content = payload?.content?.trim();
          if (!content) return;

          // Save message to database
          const savedMsg = await db.message.create({
            data: {
              roomId,
              userId: user.id,
              content,
            },
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          });

          broadcastToRoom(roomId, {
            type: "chat:message",
            message: {
              id: savedMsg.id,
              roomId: savedMsg.roomId,
              userId: savedMsg.userId,
              username: savedMsg.user.username,
              content: savedMsg.content,
              createdAt: savedMsg.createdAt,
            },
          });
          break;
        }

        case "chat:clear": {
          try {
            await db.message.deleteMany({
              where: { roomId },
            });

            broadcastToRoom(roomId, {
              type: "chat:clear",
              clearedBy: user.username,
            });
          } catch (err) {
            console.error("Error clearing chat messages:", err);
          }
          break;
        }

        case "file:create": {
          broadcastToRoom(
            roomId,
            {
              type: "file:create",
              file: payload.file,
            },
            ws
          );
          break;
        }

        case "file:rename": {
          broadcastToRoom(
            roomId,
            {
              type: "file:rename",
              file: payload.file,
            },
            ws
          );
          break;
        }

        case "file:delete": {
          broadcastToRoom(
            roomId,
            {
              type: "file:delete",
              fileId: payload.fileId,
            },
            ws
          );
          break;
        }

        case "file:update": {
          broadcastToRoom(
            roomId,
            {
              type: "file:update",
              file: payload.file,
            },
            ws
          );
          break;
        }

        case "room:update": {
          broadcastToRoom(roomId, {
            type: "room:update",
            room: payload.room,
          });
          break;
        }

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
          const fileId = payload?.fileId || null;
          let fileName = "all files";
          if (fileId) {
            const fileRec = await db.file.findUnique({
              where: { id: fileId },
              select: { name: true },
            });
            if (fileRec) fileName = fileRec.name;
          }

          let reqRec = await db.permissionRequest.findFirst({
            where: {
              roomId,
              userId: user.id,
              fileId,
              status: "PENDING",
            },
          });

          if (!reqRec) {
            reqRec = await db.permissionRequest.create({
              data: {
                roomId,
                userId: user.id,
                fileId,
                status: "PENDING",
              },
            });
          }

          broadcastToRoom(roomId, {
            type: "permission:request",
            request: {
              id: reqRec.id,
              userId: user.id,
              username: user.username,
              fileId,
              fileName,
              createdAt: reqRec.createdAt,
            },
          });
          break;
        }

        case "permission:grant": {
          const room = await db.room.findUnique({
            where: { id: roomId },
            select: { ownerId: true },
          });

          if (room?.ownerId !== user.id) return; // Only owner can grant

          const targetUserId = payload?.targetUserId;
          const fileId = payload?.fileId || null;
          const scope = payload?.scope || (fileId ? "file" : "room");

          if (!targetUserId) return;

          const member = await db.roomMember.findUnique({
            where: {
              roomId_userId: { roomId, userId: targetUserId },
            },
          });

          if (!member) return;

          let updatedCanEdit = member.canEdit;
          let allowedFilesList: string[] = [];
          try {
            allowedFilesList = JSON.parse(member.allowedFiles || "[]");
          } catch {
            allowedFilesList = [];
          }

          if (scope === "room" || !fileId) {
            updatedCanEdit = true;
          } else if (fileId) {
            if (!allowedFilesList.includes(fileId)) {
              allowedFilesList.push(fileId);
            }
          }

          await db.roomMember.update({
            where: { id: member.id },
            data: {
              canEdit: updatedCanEdit,
              role: updatedCanEdit ? "EDITOR" : member.role,
              allowedFiles: JSON.stringify(allowedFilesList),
            },
          });

          await db.permissionRequest.updateMany({
            where: {
              roomId,
              userId: targetUserId,
              status: "PENDING",
              ...(scope === "room" ? {} : { fileId }),
            },
            data: { status: "APPROVED" },
          });

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

        case "permission:decline": {
          const room = await db.room.findUnique({
            where: { id: roomId },
            select: { ownerId: true },
          });

          if (room?.ownerId !== user.id) return;

          const targetUserId = payload?.targetUserId;
          const fileId = payload?.fileId || null;
          const requestId = payload?.requestId;

          if (requestId) {
            await db.permissionRequest.update({
              where: { id: requestId },
              data: { status: "DECLINED" },
            });
          } else if (targetUserId) {
            await db.permissionRequest.updateMany({
              where: {
                roomId,
                userId: targetUserId,
                status: "PENDING",
                ...(fileId ? { fileId } : {}),
              },
              data: { status: "DECLINED" },
            });
          }

          broadcastToRoom(roomId, {
            type: "permission:declined",
            requestId: requestId || null,
            targetUserId: targetUserId || null,
            fileId: fileId || null,
            declinedBy: user.username,
          });
          break;
        }

        case "permission:revoke": {
          const room = await db.room.findUnique({
            where: { id: roomId },
            select: { ownerId: true },
          });

          if (room?.ownerId !== user.id) return;

          const targetUserId = payload?.targetUserId;
          const fileId = payload?.fileId || null;
          const scope = payload?.scope || (fileId ? "file" : "room");

          if (!targetUserId) return;

          const member = await db.roomMember.findUnique({
            where: {
              roomId_userId: { roomId, userId: targetUserId },
            },
          });

          if (!member) return;

          let updatedCanEdit = member.canEdit;
          let allowedFilesList: string[] = [];
          try {
            allowedFilesList = JSON.parse(member.allowedFiles || "[]");
          } catch {
            allowedFilesList = [];
          }

          if (scope === "room" || !fileId) {
            updatedCanEdit = false;
            allowedFilesList = [];
          } else if (fileId) {
            allowedFilesList = allowedFilesList.filter((id) => id !== fileId);
          }

          await db.roomMember.update({
            where: { id: member.id },
            data: {
              canEdit: updatedCanEdit,
              role: updatedCanEdit ? "EDITOR" : "MEMBER",
              allowedFiles: JSON.stringify(allowedFilesList),
            },
          });

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

        case "permission:cancel": {
          const fileId = payload?.fileId || null;
          await db.permissionRequest.deleteMany({
            where: {
              roomId,
              userId: user.id,
              status: "PENDING",
              fileId,
            },
          });

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
      console.error("Error parsing room ws message:", err);
    }
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

// Periodic cleanup of dead connections
setInterval(() => {
  roomClients.forEach((clients, roomId) => {
    clients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
      } else {
        client.isAlive = false;
        client.ws.ping();
      }
    });
    if (clients.size === 0) {
      roomClients.delete(roomId);
    } else {
      broadcastToRoom(roomId, {
        type: "presence:update",
        onlineUsers: getOnlineUsers(roomId),
      });
    }
  });
}, 30000);
