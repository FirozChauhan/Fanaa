import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  authKeyConfigured,
  isValidSession,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the client whether the hash-key gate is enabled (and if so, how many
 *  signed in) — used to decide whether to show a Log out action in settings. */
export async function GET() {
  const configured = authKeyConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, signedIn: false });
  }
  const store = await cookies();
  const signedIn = isValidSession(store.get(AUTH_COOKIE)?.value);
  return NextResponse.json({ configured: true, signedIn });
}