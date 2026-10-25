import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { buildRoomDetails } from "../lib/room-payload";
import { roomFromParams } from "../lib/route-helpers";
import { iso } from "../lib/serializers";
import { requireAuth } from "../middleware/auth";
import { File } from "../models/file";
import { PermissionRequest } from "../models/permission-request";
import { RoomMember } from "../models/room-member";
import { broadcastToRoom } from "../ws/room-handler";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;

    const details = await buildRoomDetails(room, req.user!.id);

    res.json({
      isOwner: details.isOwner,
      canEdit: details.canEdit,
      allowedFiles: details.allowedFiles,
      members: details.room.members,
      pendingRequests: details.room.pendingRequests,
      myPendingRequests: details.myPendingRequests,
    });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const room = await roomFromParams(req, res);
    if (!room) return;

    const body = req.body || {};
    const action = typeof body.action === "string" ? body.action : "";
    const isOwner = room.ownerId === user.id;

    switch (action) {
      case "request": {
        const fileId = typeof body.fileId === "string" && body.fileId ? body.fileId : null;

        let fileName = "all files";
        if (fileId) {
          const file = await File.findOne({ _id: fileId, roomId: room._id }).select("name").exec();
          if (file) fileName = file.name;
        }

        let request = await PermissionRequest.findOne({
          roomId: room._id,
          userId: user.id,
          fileId,
          status: "PENDING",
        }).exec();

        if (!request) {
          request = await PermissionRequest.create({
            roomId: room._id,
            userId: user.id,
            fileId,
            status: "PENDING",
          });
        }

        const requestPayload = {
          id: request._id,
          userId: user.id,
          username: user.username,
          fileId,
          fileName,
          createdAt: iso(request.createdAt),
        };

        broadcastToRoom(room._id, {
          type: "permission:request",
          request: requestPayload,
        });

        res.json({ success: true, request: requestPayload });
        return;
      }

      case "grant": {
        if (!isOwner) {
          res.status(403).json({ error: "Only the room owner can grant edit permission." });
          return;
        }

        const targetUserId =
          typeof body.targetUserId === "string" ? body.targetUserId : "";
        if (!targetUserId) {
          res.status(400).json({ error: "Missing targetUserId" });
          return;
        }

        const fileId = typeof body.fileId === "string" && body.fileId ? body.fileId : null;
        const scope = typeof body.scope === "string" ? body.scope : "file";

        const member = await RoomMember.findOne({ roomId: room._id, userId: targetUserId }).exec();
        if (!member) {
          res.status(404).json({ error: "Member not found in room" });
          return;
        }

        let updatedCanEdit = member.canEdit;
        const allowedFilesList = Array.isArray(member.allowedFiles)
          ? [...member.allowedFiles]
          : [];

        if (scope === "room" || !fileId) {
          updatedCanEdit = true;
        } else if (!allowedFilesList.includes(fileId)) {
          allowedFilesList.push(fileId);
        }

        member.canEdit = updatedCanEdit;
        if (updatedCanEdit) member.role = "EDITOR";
        member.allowedFiles = allowedFilesList;
        await member.save();

        await PermissionRequest.updateMany(
          {
            roomId: room._id,
            userId: targetUserId,
            status: "PENDING",
            ...(scope === "room" || !fileId ? {} : { fileId }),
          },
          { $set: { status: "APPROVED" } }
        );

        const permission = {
          userId: targetUserId,
          roomId: room._id,
          canEdit: updatedCanEdit,
          allowedFiles: allowedFilesList,
          approvedFileId: fileId,
          scope,
          grantedBy: user.username,
        };

        broadcastToRoom(room._id, { type: "permission:updated", permission });
        res.json({ success: true, permission });
        return;
      }

      case "revoke": {
        if (!isOwner) {
          res.status(403).json({ error: "Only the room owner can revoke edit permission." });
          return;
        }

        const targetUserId =
          typeof body.targetUserId === "string" ? body.targetUserId : "";
        if (!targetUserId) {
          res.status(400).json({ error: "Missing targetUserId" });
          return;
        }

        const fileId = typeof body.fileId === "string" && body.fileId ? body.fileId : null;
        const scope = typeof body.scope === "string" ? body.scope : "file";

        const member = await RoomMember.findOne({ roomId: room._id, userId: targetUserId }).exec();
        if (!member) {
          res.status(404).json({ error: "Member not found" });
          return;
        }

        let updatedCanEdit = member.canEdit;
        let allowedFilesList = Array.isArray(member.allowedFiles)
          ? [...member.allowedFiles]
          : [];

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

        const permission = {
          userId: targetUserId,
          roomId: room._id,
          canEdit: updatedCanEdit,
          allowedFiles: allowedFilesList,
          revokedFileId: fileId,
          scope,
          revokedBy: user.username,
        };

        broadcastToRoom(room._id, { type: "permission:revoked", permission });
        res.json({ success: true, permission });
        return;
      }

      case "decline": {
        if (!isOwner) {
          res.status(403).json({ error: "Only the room owner can decline requests." });
          return;
        }

        const requestId = typeof body.requestId === "string" ? body.requestId : null;
        const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : null;
        const fileId = typeof body.fileId === "string" && body.fileId ? body.fileId : null;

        if (requestId) {
          await PermissionRequest.updateOne(
            { _id: requestId, roomId: room._id },
            { $set: { status: "DECLINED" } }
          );
        } else if (targetUserId) {
          await PermissionRequest.updateMany(
            {
              roomId: room._id,
              userId: targetUserId,
              status: "PENDING",
              ...(fileId ? { fileId } : {}),
            },
            { $set: { status: "DECLINED" } }
          );
        }

        broadcastToRoom(room._id, {
          type: "permission:declined",
          requestId,
          targetUserId,
          fileId,
          declinedBy: user.username,
        });

        res.json({ success: true });
        return;
      }

      case "cancel": {
        const requestId = typeof body.requestId === "string" ? body.requestId : null;
        const fileId = typeof body.fileId === "string" && body.fileId ? body.fileId : null;

        if (requestId) {
          await PermissionRequest.deleteMany({ _id: requestId, userId: user.id, roomId: room._id });
        } else {
          await PermissionRequest.deleteMany({
            roomId: room._id,
            userId: user.id,
            status: "PENDING",
            fileId,
          });
        }

        broadcastToRoom(room._id, {
          type: "permission:cancelled",
          userId: user.id,
          fileId,
        });

        res.json({ success: true });
        return;
      }

      default:
        res.status(400).json({ error: "Invalid action" });
    }
  })
);

export default router;
