import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Hash-key gate — an optional session-level lock on the whole app.
 *
 * The hash key lives in `APP_HASH_KEY` (.env) and can be the plain key or its
 * SHA-256 hex. The user types the key once per session; the server compares a
 * hash of it and, if correct, issues an httpOnly session cookie that the root
 * layout checks on every open. `Log out` drops the cookie, which brings the
 * gate back up. Whole feature is skipped when no key is configured.
 */
export const AUTH_COOKIE = "ts_auth";

export function authKeyConfigured(): boolean {
  return typeof process.env.APP_HASH_KEY === "string" &&
    process.env.APP_HASH_KEY.trim().length > 0;
}

/** SHA-256 hex digest of the submitted key. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** The expected hash to verify against, derived from APP_HASH_KEY. */
function expectedHash(): string | null {
  const raw = process.env.APP_HASH_KEY?.trim();
  if (!raw) return null;
  // Already a SHA-256 hex? Use it directly; otherwise hash the key.
  return /^[0-9a-f]{64}$/i.test(raw) ? raw.toLowerCase() : hashKey(raw);
}

/** Constant-time check that the submitted key hashes to the configured one. */
export function verifyKey(submitted: string): boolean {
  const expected = expectedHash();
  if (!expected) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hashKey(submitted), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Stateless signed session. The cookie value is an HMAC over the session
 * label keyed with the expected hash — knowing the key is what signs in, so
 * forging a cookie requires the same secret.
 */
function sessionToken(): string | null {
  const expected = expectedHash();
  if (!expected) return null;
  return createHmac("sha256", expected)
    .update("fanaa-session-v1")
    .digest("hex");
}

export function sessionCookieValue(): string {
  return sessionToken() ?? "";
}

export function isValidSession(token: string | null | undefined): boolean {
  const expected = sessionToken();
  if (!expected || !token) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * Returns an unauthorized JSON response when the hash-key gate is configured
 * and the request has no valid session cookie, or null to let the request
 * through. Call this first in every data API route: the gate must be enforced
 * server-side, not just by hiding the UI.
 */
export async function authGuard(): Promise<NextResponse | null> {
  if (!authKeyConfigured()) return null;
  const store = await cookies();
  if (!isValidSession(store.get(AUTH_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}