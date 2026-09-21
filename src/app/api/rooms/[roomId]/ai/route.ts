import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { analyzeErrorWithAI, reviewCodeWithAI } from "@/server/ai-service";

export async function POST(
  req: Request,
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

  try {
    const body = await req.json();
    const { action = "debug", fileName = "code.txt", code = "", error = "", stdout = "" } = body;

    if (action === "review") {
      const reviewResult = await reviewCodeWithAI(fileName, code);
      return NextResponse.json({ success: true, result: reviewResult });
    }

    // Default action: debug execution error
    const analysisResult = await analyzeErrorWithAI(fileName, code, error, stdout);
    return NextResponse.json({ success: true, result: analysisResult });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "AI analysis failed";
    console.error("AI service error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
