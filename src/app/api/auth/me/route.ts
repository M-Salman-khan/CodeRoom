import { NextResponse } from "next/server";
import { getCurrentUser, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const cookieStore = cookies();
  let token = cookieStore.get(COOKIE_NAME)?.value || null;
  if (!token) {
    token = await createSessionToken(user);
  }

  return NextResponse.json({ user, token });
}
