"use client";

/**
 * The lock state lives in a cookie that the server layout reads, so the lock
 * screen renders server-side with zero flash of the journal content.
 */
export const LOCK_COOKIE = "ts_lock";

export function setLockCookie(value: "1" | "0"): void {
  document.cookie = `${LOCK_COOKIE}=${value}; path=/; samesite=lax; max-age=31536000`;
}

export const LOCK_TIMEOUT_KEY = "fanaa.lockTimeout";
export const LOCK_ON_HIDDEN_KEY = "fanaa.lockOnHidden";
// Keys used before the app rename; read as fallbacks so existing settings
// survive the rename.
const LEGACY_LOCK_TIMEOUT_KEY = "projectx00.lockTimeout";
const LEGACY_LOCK_ON_HIDDEN_KEY = "projectx00.lockOnHidden";

export const DEFAULT_LOCK_TIMEOUT_S = 300;

export function readLockTimeout(): number {
  const raw =
    localStorage.getItem(LOCK_TIMEOUT_KEY) ??
    localStorage.getItem(LEGACY_LOCK_TIMEOUT_KEY);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOCK_TIMEOUT_S;
}

export function readLockOnHidden(): boolean {
  return (
    localStorage.getItem(LOCK_ON_HIDDEN_KEY) ??
    localStorage.getItem(LEGACY_LOCK_ON_HIDDEN_KEY)
  ) === "1";
}

export function writeLockTimeout(v: number): void {
  localStorage.setItem(LOCK_TIMEOUT_KEY, String(v));
}

export function writeLockOnHidden(v: boolean): void {
  localStorage.setItem(LOCK_ON_HIDDEN_KEY, v ? "1" : "0");
}
