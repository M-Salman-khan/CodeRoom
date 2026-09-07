import { NextResponse } from "next/server";
import { executeCode, resolveLanguage } from "@/lib/compiler";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      code,
      language,
      stdin = "",
      filename,
      preferEngine = "auto",
      timeoutMs = 10000,
    } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required and must be a string." },
        { status: 400 }
      );
    }

    const resolved = resolveLanguage(language, filename);
    const result = await executeCode({
      code,
      language: resolved.id,
      stdin,
      filename,
      preferEngine,
      timeoutMs: Math.min(Math.max(timeoutMs, 1000), 20000),
    });

    return NextResponse.json({
      success: true,
      result,
      language: resolved,
    });
  } catch (err: unknown) {
    console.error("Compilation / execution error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Execution failed",
        details: msg,
      },
      { status: 500 }
    );
  }
}
