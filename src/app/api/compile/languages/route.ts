import { NextResponse } from "next/server";
import { getSupportedLanguages } from "@/lib/compiler";

export async function GET() {
  try {
    const languages = getSupportedLanguages();
    return NextResponse.json({
      success: true,
      languages,
      total: languages.length,
    });
  } catch (err: unknown) {
    console.error("Error fetching supported languages:", err);
    return NextResponse.json(
      { error: "Failed to retrieve supported languages" },
      { status: 500 }
    );
  }
}
