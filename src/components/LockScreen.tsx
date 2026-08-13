"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "./icons";
import { setLockCookie } from "@/lib/lock-client";

/**
 * Full-screen gate shown by the layout whenever the lock cookie is set.
 * Two modes:
 *   - unlock: verify the configured PIN against the server, then unlock.
 *   - setup: no PIN exists yet — create one, which immediately engages the
 *     lock as confirmation.
 */
export default function LockScreen({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!configured) {
      if (pin.length < 4) {
        setError("pin needs at least 4 characters");
        return;
      }
      if (pin !== confirm) {
        setError("pins don't match");
        return;
      }
    } else if (pin.length === 0) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(configured ? "/api/lock/verify" : "/api/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setLockCookie(configured ? "0" : "1");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPin("");
      setConfirm("");
      setBusy(false);
      pinRef.current?.focus();
    }
  }

  return (
    <div className="term-screen flex min-h-dvh flex-col items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md"
        aria-label={configured ? "Unlock" : "Set pin"}
      >
        <div className="term-dialog p-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-term-faint">
            fanaa — {configured ? "journal locked" : "first run"}
          </p>
          <p className="mt-4 text-sm text-term-bright">
            <span className="text-term-amber">$</span>{" "}
            {configured ? "unlock" : "pin --create"}
          </p>
          <p className="mt-1 text-xs leading-5 text-term-dim">
            {configured
              ? "this journal is locked — enter your pin"
              : "create a pin to protect this journal"}
          </p>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="select-none text-term-amber">$</span>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                autoComplete={configured ? "current-password" : "new-password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={configured ? "pin" : "new pin (4+ chars)"}
                aria-label={configured ? "Pin" : "New pin"}
                spellCheck={false}
                className="term-input h-8 flex-1"
              />
            </div>
            {!configured && (
              <div className="flex items-center gap-2">
                <span className="select-none text-term-faint">&gt;</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="repeat pin"
                  aria-label="Repeat pin"
                  spellCheck={false}
                  className="term-input h-8 flex-1"
                />
              </div>
            )}
            {error && (
              <p className="text-xs text-term-red" role="alert">
                ! {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="term-btn solid mt-5 h-8 w-full"
          >
            {busy ? (
              <>
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                {configured ? "unlocking…" : "setting…"}
              </>
            ) : configured ? (
              "unlock"
            ) : (
              "set pin & lock"
            )}
          </button>

          <p className="mt-5 text-[0.65rem] leading-4 text-term-faint">
            every page is encrypted locally with gpg (aes-256) before it
            reaches cloudflare r2
          </p>
        </div>
      </form>
    </div>
  );
}
