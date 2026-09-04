import { WebSocket } from "ws";
import { db } from "../lib/db";
import { SessionUser } from "../lib/auth";

interface RoomClient {
  ws: WebSocket;
  user: SessionUser;
  isAlive: boolean;
}

// Map of roomId -> Set of connected clients
const roomClients = new Map<string, Set<RoomClient>>();

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
  try {
    ws.send(
      JSON.stringify({
        type: "presence:update",
        onlineUsers: currentOnline,
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
            })
          );
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
