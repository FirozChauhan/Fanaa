import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drops the session cookie (maxAge 0 deletes it) so the next refresh
 * re-renders the hash-key gate. Open to everyone — clearing an unknown cookie
 * is harmless, and a logged-in client must be able to reach it.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    ...authCookieOptions(),
    maxAge: 0,
  });
  return res;
}