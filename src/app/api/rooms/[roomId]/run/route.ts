import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { broadcastToRoom } from "@/server/room-handler";
import {
  getRoomExecutionState,
  isRoomExecuting,
  runCodeWithLock,
  stopRoomExecution,
} from "@/server/code-runner";

export async function GET(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;
  const room = await db.room.findFirst({
    where: { OR: [{ id: roomId }, { roomCode: roomId }] },
    select: { id: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const state = getRoomExecutionState(room.id);
  return NextResponse.json({ execution: state });
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;

  try {
    const room = await db.room.findFirst({
      where: { OR: [{ id: roomId }, { roomCode: roomId }] },
      select: { id: true, ownerId: true, isPublic: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const body = await req.json();
    const { action = "run", fileId, code } = body;
    const isOwner = room.ownerId === user.id;

    // Handle STOP execution
    if (action === "stop") {
      const stopResult = stopRoomExecution(room.id, user.id, isOwner);
      if (!stopResult.success) {
        return NextResponse.json({ error: stopResult.message }, { status: 400 });
      }

      broadcastToRoom(room.id, {
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

      return NextResponse.json({ success: true, message: stopResult.message });
    }

    // Handle RUN execution
    if (!fileId) {
      return NextResponse.json({ error: "fileId is required to run code" }, { status: 400 });
    }

    // 1. Verify that user has access to run code in this room
    // The owner, any registered room member, or any participant in a public room can run code.
    const isMember = await db.roomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    const canRun = isOwner || Boolean(isMember) || room.isPublic;
    if (!canRun) {
      return NextResponse.json(
        { error: "You must be a member or have permission to run code in this room." },
        { status: 403 }
      );
    }

    // 2. Strict Check: is another user already running code in this room?
    if (isRoomExecuting(room.id)) {
      const current = getRoomExecutionState(room.id);
      return NextResponse.json(
        {
          error: `Another user (${current.username}) is currently running a program in this room. Only one user can run at a time.`,
          runningBy: current.username,
          runningFile: current.fileName,
          isRunning: true,
        },
        { status: 409 }
      );
    }

    // 3. Find file record
    const file = await db.file.findUnique({
      where: { id: fileId },
      select: { id: true, name: true, content: true, language: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const codeToRun = typeof code === "string" ? code : file.content;

    // 4. Run with mutex lock
    const result = await runCodeWithLock(
      room.id,
      user,
      file.id,
      file.name,
      codeToRun,
      () => {
        // Broadcast execution start in real time to all room members
        broadcastToRoom(room.id, {
          type: "execution:start",
          execution: {
            isRunning: true,
            userId: user.id,
            username: user.username,
            fileId: file.id,
            fileName: file.name,
            startTime: Date.now(),
          },
        });
      },
      file.language || undefined
    );

    // Broadcast execution end in real time to all room members
    broadcastToRoom(room.id, {
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

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Execution failed";
    console.error("Run code error:", err);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
