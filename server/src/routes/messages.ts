import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireRoomMembership, roomFromParams } from "../lib/route-helpers";
import { serializeMessage } from "../lib/serializers";
import { LIMITS } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { chatLimiter } from "../middleware/rate-limit";
import { Message } from "../models/message";
import { User } from "../models/user";
import { broadcastToRoom } from "../ws/room-handler";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;
    if (!(await requireRoomMembership(req, res, room))) return;

    const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1),
      100,
    );

    const messages = await Message.find({ roomId: room._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();

    const userIds = Array.from(
      new Set(messages.map((message) => message.userId)),
    );
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id username")
      .exec();
    const usernameById = new Map(
      users.map((user) => [user._id, user.username]),
    );

    // Query is newest first; return chronological (oldest -> newest).
    const formatted = messages
      .reverse()
      .map((message) =>
        serializeMessage(
          message,
          usernameById.get(message.userId) || "unknown",
        ),
      );

    res.json({ messages: formatted });
  }),
);

router.post(
  "/",
  requireAuth,
  chatLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;
    if (!(await requireRoomMembership(req, res, room))) return;

    const body = req.body || {};
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      res.status(400).json({ error: "Message content cannot be empty" });
      return;
    }
    if (content.length > LIMITS.chatMessage) {
      res.status(400).json({
        error: `Messages must be ${LIMITS.chatMessage} characters or fewer`,
      });
      return;
    }

    const message = await Message.create({
      roomId: room._id,
      userId: user.id,
      content,
    });

    const serialized = serializeMessage(message, user.username);
    broadcastToRoom(room._id, { type: "chat:message", message: serialized });

    res.status(201).json({ message: serialized });
  }),
);

router.delete(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;
    if (!(await requireRoomMembership(req, res, room))) return;

    if (room.ownerId !== user.id) {
      res
        .status(403)
        .json({ error: "Only the room owner can clear the chat." });
      return;
    }

    await Message.deleteMany({ roomId: room._id });
    broadcastToRoom(room._id, { type: "chat:clear", clearedBy: user.username });

    res.json({ success: true, message: "Chat cleared successfully" });
  }),
);

export default router;
