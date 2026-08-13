import { NextResponse } from "next/server";
import { isPinConfigured, isValidPin, setPin } from "@/lib/lock";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    return NextResponse.json({ configured: await isPinConfigured() });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to read lock state" },
      { status: 500 },
    );
  }
}

/** Set the initial PIN (only allowed when none is configured yet). */
export async function POST(req: Request) {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    if (await isPinConfigured()) {
      return NextResponse.json(
        { error: "A PIN is already configured" },
        { status: 409 },
      );
    }
    const body = (await req.json()) as { pin?: unknown };
    if (typeof body.pin !== "string" || !isValidPin(body.pin)) {
      return NextResponse.json(
        { error: "Pin must be 4–64 characters" },
        { status: 400 },
      );
    }
    await setPin(body.pin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to set PIN" },
      { status: 500 },
    );
  }
}
