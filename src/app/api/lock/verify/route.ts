import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/lock";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Small in-memory throttle so a wrong PIN can't be brute-forced quickly.
// This is a single-user local app, so a per-process counter is enough.
const FAIL_LIMIT = 5;
const LOCKOUT_MS = 15_000;
const attempts = { count: 0, until: 0 };

export async function POST(req: Request) {
  const denied = await authGuard();
  if (denied) return denied;
  if (Date.now() < attempts.until) {
    const wait = Math.ceil((attempts.until - Date.now()) / 1000);
    return NextResponse.json(
      { error: `too many attempts — try again in ${wait}s` },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { pin?: unknown };
    if (typeof body.pin !== "string") {
      return NextResponse.json({ error: "Pin is required" }, { status: 400 });
    }
    const ok = await verifyPin(body.pin);
    if (ok) {
      attempts.count = 0;
      return NextResponse.json({ ok: true });
    }
    attempts.count += 1;
    if (attempts.count >= FAIL_LIMIT) {
      attempts.until = Date.now() + LOCKOUT_MS;
      attempts.count = 0;
    }
    return NextResponse.json(
      { error: "Wrong pin — try again" },
      { status: 401 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to verify PIN" },
      { status: 500 },
    );
  }
}
