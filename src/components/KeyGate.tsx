"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "./icons";

/**
 * Full-screen gate shown by the layout whenever a hash key is configured and
 * no valid session cookie exists. Submitting the key calls the login route,
 * which sets an httpOnly session cookie; a router refresh then re-renders the
 * layout and reveals the app.
 */
export default function KeyGate() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!key) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to sign in");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setKey("");
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="term-screen flex min-h-dvh flex-col items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md" aria-label="Sign in">
        <div className="term-dialog p-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-term-faint">
            fanaa — private journal
          </p>
          <p className="mt-4 text-sm text-term-bright">
            <span className="text-term-amber">$</span> open --hash-key
          </p>
          <p className="mt-1 text-xs leading-5 text-term-dim">
            enter the hash key to decrypt this journal
          </p>

          <div className="mt-5 flex items-center gap-2">
            <span className="select-none text-term-amber">$</span>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="hash key"
              aria-label="Hash key"
              spellCheck={false}
              className="term-input h-8 flex-1"
            />
            <span className="term-cursor" aria-hidden />
          </div>
          {error && (
            <p className="mt-3 text-xs text-term-red" role="alert">
              ! {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="term-btn solid mt-5 h-8 w-full"
          >
            {busy ? (
              <>
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                entering…
              </>
            ) : (
              "enter"
            )}
          </button>

          <p className="mt-5 text-[0.65rem] leading-4 text-term-faint">
            signed in for this session — log out from settings when you&apos;re
            done
          </p>
        </div>
      </form>
    </div>
  );
}
