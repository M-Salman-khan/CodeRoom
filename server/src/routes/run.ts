import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { roomFromParams } from "../lib/route-helpers";
import { requireAuth } from "../middleware/auth";
import { File } from "../models/file";
import { RoomMember } from "../models/room-member";
import {
  getRoomExecutionState,
  isRoomExecuting,
  runCodeWithLock,
  stopRoomExecution,
  type ExecutionResult,
} from "../services/code-runner";
import { broadcastToRoom } from "../ws/room-handler";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;

    res.json({ execution: getRoomExecutionState(room._id) });
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
    const action = typeof body.action === "string" ? body.action : "run";
    const fileId = typeof body.fileId === "string" ? body.fileId : null;
    const code = typeof body.code === "string" ? body.code : null;
    const isOwner = room.ownerId === user.id;

    if (action === "stop") {
      const stopResult = stopRoomExecution(room._id, user.id, isOwner);
      if (!stopResult.success) {
        res.status(400).json({ error: stopResult.message });
        return;
      }

      broadcastToRoom(room._id, {
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

      res.json({ success: true, message: stopResult.message });
      return;
    }

    if (!fileId) {
      res.status(400).json({ error: "fileId is required to run code" });
      return;
    }

    const membership = await RoomMember.findOne({ roomId: room._id, userId: user.id })
      .select("_id")
      .exec();
    const canRun = isOwner || Boolean(membership) || room.isPublic;
    if (!canRun) {
      res.status(403).json({
        error: "You must be a member or have permission to run code in this room.",
      });
      return;
    }

    if (isRoomExecuting(room._id)) {
      const current = getRoomExecutionState(room._id);
      res.status(409).json({
        error: `Another user (${current.username}) is currently running a program in this room. Only one user can run at a time.`,
        runningBy: current.username,
        runningFile: current.fileName,
        isRunning: true,
      });
      return;
    }

    const file = await File.findOne({ _id: fileId, roomId: room._id })
      .select("_id name content language")
      .exec();
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const codeToRun = code !== null ? code : file.content;

    let result: ExecutionResult;
    try {
      result = await runCodeWithLock(
        room._id,
        { id: user.id, username: user.username },
        file._id,
        file.name,
        codeToRun,
        () => {
          broadcastToRoom(room._id, {
            type: "execution:start",
            execution: {
              isRunning: true,
              userId: user.id,
              username: user.username,
              fileId: file._id,
              fileName: file.name,
              startTime: Date.now(),
            },
          });
        },
        file.language || undefined
      );
    } catch (err) {
      // Lost the mutex race between the check above and acquisition.
      if (err instanceof Error && err.message.includes("already running")) {
        const current = getRoomExecutionState(room._id);
        res.status(409).json({
          error: err.message,
          runningBy: current.username,
          runningFile: current.fileName,
          isRunning: true,
        });
        return;
      }
      throw err;
    }

    broadcastToRoom(room._id, {
      type: "execution:end",
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: result.executionTimeMs,
        killed: result.killed,
        error: result.error,
        runBy: user.username,
        fileName: file.name,
      },
    });

    res.json({ success: true, result });
  })
);

export default router;
