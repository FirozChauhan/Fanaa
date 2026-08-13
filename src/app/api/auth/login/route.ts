import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authCookieOptions,
  authKeyConfigured,
  sessionCookieValue,
  verifyKey,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory throttle so the hash key can't be brute-forced quickly. Same
// single-user, single-process trade-off as the PIN lockout.
const FAIL_LIMIT = 5;
const LOCKOUT_MS = 15_000;
const attempts = { count: 0, until: 0 };

export async function POST(req: Request) {
  if (!authKeyConfigured()) {
    return NextResponse.json(
      { error: "Hash key auth is not configured on this server" },
      { status: 503 },
    );
  }
  if (Date.now() < attempts.until) {
    return NextResponse.json(
      { error: "too many attempts — try again later" },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { key?: unknown };
    const key = typeof body.key === "string" ? body.key : "";
    if (!key) {
      return NextResponse.json({ error: "Enter the hash key" }, { status: 400 });
    }
    if (!verifyKey(key)) {
      attempts.count += 1;
      if (attempts.count >= FAIL_LIMIT) {
        attempts.until = Date.now() + LOCKOUT_MS;
        attempts.count = 0;
      }
      return NextResponse.json({ error: "Wrong hash key" }, { status: 401 });
    }
    attempts.count = 0;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, sessionCookieValue(), authCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }
}