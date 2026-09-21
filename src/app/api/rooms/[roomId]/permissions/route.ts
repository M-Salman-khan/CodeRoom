import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserPermissionInfo } from "@/lib/permissions";
import { broadcastToRoom } from "@/server/room-handler";

export async function GET(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
        permissionRequests: {
          where: { status: "PENDING" },
          include: {
            user: { select: { id: true, username: true } },
            file: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isOwner = room.ownerId === user.id;
    const permInfo = await getUserPermissionInfo(user.id, room.id);

    return NextResponse.json({
      isOwner,
      canEdit: permInfo.canEdit,
      allowedFiles: permInfo.allowedFiles,
      members: room.members.map((m) => {
        let allowed: string[] = [];
        try {
          allowed = JSON.parse(m.allowedFiles || "[]");
        } catch {}
        return {
          id: m.id,
          userId: m.userId,
          username: m.user.username,
          role: m.role,
          canEdit: m.role === "OWNER" || m.canEdit,
          allowedFiles: allowed,
          joinedAt: m.joinedAt,
        };
      }),
      pendingRequests: isOwner
        ? room.permissionRequests.map((r) => ({
            id: r.id,
            userId: r.userId,
            username: r.user.username,
            fileId: r.fileId,
            fileName: r.file?.name || null,
            createdAt: r.createdAt,
          }))
        : [],
      myPendingRequests: room.permissionRequests
        .filter((r) => r.userId === user.id)
        .map((r) => ({
          id: r.id,
          fileId: r.fileId,
          fileName: r.file?.name || null,
          status: r.status,
          createdAt: r.createdAt,
        })),
    });
  } catch (err) {
    console.error("Get permissions error:", err);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      select: { id: true, ownerId: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;
    const isOwner = room.ownerId === user.id;

    switch (action) {
      case "request": {
        const { fileId } = body;

        let fileName = "all files";
        if (fileId) {
          const fileRec = await db.file.findUnique({
            where: { id: fileId },
            select: { name: true },
          });
          if (fileRec) fileName = fileRec.name;
        }

        // Find or create pending request
        let requestRec = await db.permissionRequest.findFirst({
          where: {
            roomId: room.id,
            userId: user.id,
            fileId: fileId || null,
            status: "PENDING",
          },
        });

        if (!requestRec) {
          requestRec = await db.permissionRequest.create({
            data: {
              roomId: room.id,
              userId: user.id,
              fileId: fileId || null,
              status: "PENDING",
            },
          });
        }

        const payload = {
          type: "permission:request",
          request: {
            id: requestRec.id,
            userId: user.id,
            username: user.username,
            fileId: fileId || null,
            fileName,
            createdAt: requestRec.createdAt,
          },
        };

        broadcastToRoom(room.id, payload);

        return NextResponse.json({
          success: true,
          request: payload.request,
        });
      }

      case "grant": {
        if (!isOwner) {
          return NextResponse.json(
            { error: "Only the room owner can grant edit permission." },
            { status: 403 }
          );
        }

        const { targetUserId, fileId, scope = "file" } = body;
        if (!targetUserId) {
          return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
        }

        const member = await db.roomMember.findUnique({
          where: {
            roomId_userId: { roomId: room.id, userId: targetUserId },
          },
        });

        if (!member) {
          return NextResponse.json({ error: "Member not found in room" }, { status: 404 });
        }

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

        // Mark matching pending requests as APPROVED
        await db.permissionRequest.updateMany({
          where: {
            roomId: room.id,
            userId: targetUserId,
            status: "PENDING",
            ...(scope === "room" ? {} : { fileId }),
          },
          data: { status: "APPROVED" },
        });

        const broadcastPayload = {
          type: "permission:updated",
          permission: {
            userId: targetUserId,
            roomId: room.id,
            canEdit: updatedCanEdit,
            allowedFiles: allowedFilesList,
            approvedFileId: fileId || null,
            scope,
            grantedBy: user.username,
          },
        };

        broadcastToRoom(room.id, broadcastPayload);

        return NextResponse.json({ success: true, permission: broadcastPayload.permission });
      }

      case "revoke": {
        if (!isOwner) {
          return NextResponse.json(
            { error: "Only the room owner can revoke edit permission." },
            { status: 403 }
          );
        }

        const { targetUserId, fileId, scope = "file" } = body;
        if (!targetUserId) {
          return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
        }

        const member = await db.roomMember.findUnique({
          where: {
            roomId_userId: { roomId: room.id, userId: targetUserId },
          },
        });

        if (!member) {
          return NextResponse.json({ error: "Member not found" }, { status: 404 });
        }

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

        const broadcastPayload = {
          type: "permission:revoked",
          permission: {
            userId: targetUserId,
            roomId: room.id,
            canEdit: updatedCanEdit,
            allowedFiles: allowedFilesList,
            revokedFileId: fileId || null,
            scope,
            revokedBy: user.username,
          },
        };

        broadcastToRoom(room.id, broadcastPayload);

        return NextResponse.json({ success: true, permission: broadcastPayload.permission });
      }

      case "decline": {
        if (!isOwner) {
          return NextResponse.json(
            { error: "Only the room owner can decline requests." },
            { status: 403 }
          );
        }

        const { requestId, targetUserId, fileId } = body;

        if (requestId) {
          await db.permissionRequest.update({
            where: { id: requestId },
            data: { status: "DECLINED" },
          });
        } else if (targetUserId) {
          await db.permissionRequest.updateMany({
            where: {
              roomId: room.id,
              userId: targetUserId,
              status: "PENDING",
              ...(fileId ? { fileId } : {}),
            },
            data: { status: "DECLINED" },
          });
        }

        broadcastToRoom(room.id, {
          type: "permission:declined",
          requestId: requestId || null,
          targetUserId: targetUserId || null,
          fileId: fileId || null,
          declinedBy: user.username,
        });

        return NextResponse.json({ success: true });
      }

      case "cancel": {
        const { requestId, fileId } = body;
        if (requestId) {
          await db.permissionRequest.deleteMany({
            where: { id: requestId, userId: user.id },
          });
        } else {
          await db.permissionRequest.deleteMany({
            where: {
              roomId: room.id,
              userId: user.id,
              status: "PENDING",
              fileId: fileId || null,
            },
          });
        }

        broadcastToRoom(room.id, {
          type: "permission:cancelled",
          userId: user.id,
          fileId: fileId || null,
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Handle permission error:", err);
    return NextResponse.json({ error: "Failed to process permission action" }, { status: 500 });
  }
}
