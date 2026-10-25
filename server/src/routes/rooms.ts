import { Router } from "express";
import { hashPassword, verifyPassword } from "../lib/auth";
import { asyncHandler } from "../lib/http";
import { buildRoomDetails } from "../lib/room-payload";
import { findRoomByKey, generateUniqueRoomCode } from "../lib/rooms";
import {
  serializeRoomBase,
  serializeUser,
  type SerializedRoomBase,
  type UserSummary,
} from "../lib/serializers";
import { LIMITS, validateText } from "../lib/validation";
import { buildYjsState } from "../lib/yjs-state";
import { requireAuth } from "../middleware/auth";
import { createRoomLimiter, joinRoomLimiter } from "../middleware/rate-limit";
import { File } from "../models/file";
import { Room } from "../models/room";
import { RoomMember } from "../models/room-member";
import { User } from "../models/user";
import { deleteRoomCascade } from "../services/cascade";
import { broadcastToRoom } from "../ws/room-handler";
import filesRouter from "./files";
import messagesRouter from "./messages";
import permissionsRouter from "./permissions";
import runRouter from "./run";
import aiRouter from "./ai";

const router = Router();

router.use("/:roomId/files", filesRouter);
router.use("/:roomId/messages", messagesRouter);
router.use("/:roomId/permissions", permissionsRouter);
router.use("/:roomId/run", runRouter);
router.use("/:roomId/ai", aiRouter);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const memberships = await RoomMember.find({ userId })
      .select("roomId")
      .exec();
    const memberRoomIds = memberships.map((membership) => membership.roomId);

    const rooms = await Room.find({
      $or: [{ ownerId: userId }, { _id: { $in: memberRoomIds } }],
    })
      .sort({ updatedAt: -1, _id: -1 })
      .exec();

    const ownerIds = Array.from(new Set(rooms.map((room) => room.ownerId)));
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("_id username")
      .exec();
    const ownerById = new Map(
      owners.map((owner) => [owner._id, serializeUser(owner)]),
    );

    const summaries = await Promise.all(
      rooms.map(
        async (
          room,
        ): Promise<
          SerializedRoomBase & {
            owner: UserSummary;
            _count: { members: number; files: number };
          }
        > => {
          const [memberCount, fileCount] = await Promise.all([
            RoomMember.countDocuments({ roomId: room._id }),
            File.countDocuments({ roomId: room._id }),
          ]);

          return {
            ...serializeRoomBase(room),
            owner: ownerById.get(room.ownerId) || {
              id: room.ownerId,
              username: "unknown",
            },
            _count: { members: memberCount, files: fileCount },
          };
        },
      ),
    );

    res.json({ rooms: summaries });
  }),
);

router.post(
  "/",
  requireAuth,
  createRoomLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";

    const nameValidation = validateText(name, {
      field: "Room name",
      max: LIMITS.roomName,
      required: true,
    });
    if (!nameValidation.ok) {
      res.status(400).json({ error: nameValidation.error });
      return;
    }

    const descriptionValidation = validateText(body.description, {
      field: "Room description",
      max: LIMITS.roomDescription,
    });
    if (!descriptionValidation.ok) {
      res.status(400).json({ error: descriptionValidation.error });
      return;
    }

    const passwordValidation = validateText(body.password, {
      field: "Room password",
      max: LIMITS.roomPassword,
    });
    if (!passwordValidation.ok) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const finalName = nameValidation.value || "";
    const description = descriptionValidation.value || null;
    const isPublic =
      body.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const password = passwordValidation.value || null;

    const roomCode = await generateUniqueRoomCode();
    const passwordHash = password ? await hashPassword(password) : null;

    const room = await Room.create({
      roomCode,
      name: finalName,
      description,
      passwordHash,
      isPublic,
      ownerId: userId,
    });

    await RoomMember.create({
      roomId: room._id,
      userId,
      role: "OWNER",
      canEdit: false,
      allowedFiles: [],
    });

    const mainContent = `// Welcome to ${finalName}!\n// Room Code: ${roomCode}\n\nconsole.log("Hello from CodeRoom!");\n`;
    const readmeContent = `# ${finalName}\n\nRoom Code: \`${roomCode}\`\n\nInvite your team and start coding collaboratively in real-time.\n`;

    await File.insertMany([
      {
        roomId: room._id,
        parentId: null,
        name: "main.ts",
        type: "file",
        language: "typescript",
        content: mainContent,
        yjsState: buildYjsState(mainContent),
      },
      {
        roomId: room._id,
        parentId: null,
        name: "README.md",
        type: "file",
        language: "markdown",
        content: readmeContent,
        yjsState: buildYjsState(readmeContent),
      },
    ]);

    res.status(201).json({
      room: {
        ...serializeRoomBase(room),
        owner: { id: userId, username: req.user!.username },
      },
    });
  }),
);

router.get(
  "/:roomId",
  requireAuth,
  joinRoomLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    if (String(req.params.roomId).length > 64) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }
    const room = await findRoomByKey(req.params.roomId);

    if (!room) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }

    const isOwner = room.ownerId === userId;
    const existingMember = isOwner
      ? null
      : await RoomMember.findOne({ roomId: room._id, userId }).exec();

    if (!isOwner && !existingMember && room.passwordHash) {
      res.json({
        requiresPassword: true,
        room: {
          id: room._id,
          roomCode: room.roomCode,
          name: room.name,
          description: room.description,
          isPublic: room.isPublic,
          hasPassword: true,
        },
      });
      return;
    }

    // Auto-join public / passwordless rooms.
    if (!isOwner && !existingMember && (!room.passwordHash || room.isPublic)) {
      try {
        await RoomMember.create({
          roomId: room._id,
          userId,
          role: "MEMBER",
          canEdit: false,
          allowedFiles: [],
        });
      } catch (err) {
        // Unique index race: another request already joined the user.
        const duplicate =
          err instanceof Error &&
          "code" in err &&
          (err as { code?: number }).code === 11000;
        if (!duplicate) throw err;
      }
    }

    const payload = await buildRoomDetails(room, userId);
    res.json(payload);
  }),
);

router.patch(
  "/:roomId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const room = await findRoomByKey(req.params.roomId);

    if (!room) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }
    if (room.ownerId !== userId) {
      res
        .status(403)
        .json({ error: "You don't have permission to modify this room." });
      return;
    }

    const body = req.body || {};

    if (body.name !== undefined) {
      const nameValidation = validateText(body.name, {
        field: "Room name",
        max: LIMITS.roomName,
        required: true,
      });
      if (!nameValidation.ok) {
        res.status(400).json({ error: nameValidation.error });
        return;
      }
      room.name = nameValidation.value || room.name;
    }
    if (body.description !== undefined) {
      const descriptionValidation = validateText(body.description, {
        field: "Room description",
        max: LIMITS.roomDescription,
      });
      if (!descriptionValidation.ok) {
        res.status(400).json({ error: descriptionValidation.error });
        return;
      }
      room.description = descriptionValidation.value || null;
    }
    if (body.isPublic !== undefined) {
      room.isPublic = Boolean(body.isPublic);
    }
    if (body.password !== undefined) {
      if (body.password === "") {
        room.passwordHash = null;
      } else {
        const passwordValidation = validateText(body.password, {
          field: "Room password",
          max: LIMITS.roomPassword,
        });
        if (!passwordValidation.ok) {
          res.status(400).json({ error: passwordValidation.error });
          return;
        }
        if (passwordValidation.value) {
          room.passwordHash = await hashPassword(passwordValidation.value);
        }
      }
    }

    await room.save();

    const serialized = serializeRoomBase(room);
    broadcastToRoom(room._id, { type: "room:update", room: serialized });

    res.json({ success: true, room: serialized });
  }),
);

router.delete(
  "/:roomId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const room = await findRoomByKey(req.params.roomId);

    if (!room) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }
    if (room.ownerId !== userId) {
      res
        .status(403)
        .json({ error: "You don't have permission to delete this room." });
      return;
    }

    await deleteRoomCascade(room._id);
    res.json({ success: true, message: "Room deleted" });
  }),
);

router.post(
  "/:roomId/join",
  requireAuth,
  joinRoomLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    if (String(req.params.roomId).length > 64) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }
    const room = await findRoomByKey(req.params.roomId);

    if (!room) {
      res.status(404).json({ error: "This room could not be found." });
      return;
    }

    const body = req.body || {};
    const password = typeof body.password === "string" ? body.password : "";

    if (password.length > LIMITS.roomPassword) {
      res.status(400).json({ error: "Incorrect room password." });
      return;
    }

    if (room.passwordHash && room.ownerId !== userId) {
      if (!password) {
        res.status(403).json({
          error: "Password is required to join this room.",
          requiresPassword: true,
        });
        return;
      }
      const matches = await verifyPassword(password, room.passwordHash);
      if (!matches) {
        res.status(403).json({
          error: "Incorrect room password.",
          requiresPassword: true,
        });
        return;
      }
    }

    const existing = await RoomMember.findOne({
      roomId: room._id,
      userId,
    }).exec();
    if (!existing) {
      await RoomMember.create({
        roomId: room._id,
        userId,
        role: room.ownerId === userId ? "OWNER" : "MEMBER",
        canEdit: false,
        allowedFiles: [],
      });
    }

    res.json({
      success: true,
      roomId: room._id,
      roomCode: room.roomCode,
    });
  }),
);

export default router;
