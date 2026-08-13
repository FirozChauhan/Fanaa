import { NextResponse } from "next/server";
import {
  isPinConfigured,
  isValidPin,
  setPin,
  verifyPin,
} from "@/lib/lock";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Change the PIN (requires the current PIN) or set it if none exists yet. */
export async function POST(req: Request) {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      currentPin?: unknown;
      newPin?: unknown;
    };
    if (typeof body.newPin !== "string" || !isValidPin(body.newPin)) {
      return NextResponse.json(
        { error: "New pin must be 4–64 characters" },
        { status: 400 },
      );
    }
    if (await isPinConfigured()) {
      if (typeof body.currentPin !== "string") {
        return NextResponse.json(
          { error: "Current pin is required" },
          { status: 400 },
        );
      }
      const ok = await verifyPin(body.currentPin);
      if (!ok) {
        return NextResponse.json(
          { error: "Current pin is incorrect" },
          { status: 401 },
        );
      }
    }
    await setPin(body.newPin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to change PIN" },
      { status: 500 },
    );
  }
}
