"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import {
  DownloadIcon,
  KeyIcon,
  LockIcon,
  SettingsIcon,
  SpinnerIcon,
  XIcon,
} from "./icons";
import {
  DEFAULT_LOCK_TIMEOUT_S,
  readLockOnHidden,
  readLockTimeout,
  setLockCookie,
  writeLockOnHidden,
  writeLockTimeout,
} from "@/lib/lock-client";

const TIMEOUT_OPTIONS: { label: string; seconds: number }[] = [
  { label: "never", seconds: 0 },
  { label: "1 minute", seconds: 60 },
  { label: "5 minutes", seconds: 300 },
  { label: "15 minutes", seconds: 900 },
  { label: "30 minutes", seconds: 1800 },
];

export default function SettingsDialog({
  open,
  onClose,
  pinConfigured,
}: {
  open: boolean;
  onClose: () => void;
  pinConfigured?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [configured, setConfigured] = useState<boolean | null>(
    pinConfigured ?? null,
  );
  const [prevPinConfigured, setPrevPinConfigured] = useState(pinConfigured);
  if (prevPinConfigured !== pinConfigured) {
    setPrevPinConfigured(pinConfigured);
    setConfigured(pinConfigured ?? null);
  }
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const [timeoutS, setTimeoutS] = useState(() =>
    typeof window === "undefined" ? DEFAULT_LOCK_TIMEOUT_S : readLockTimeout(),
  );
  const [lockOnHidden, setLockOnHidden] = useState(() =>
    typeof window === "undefined" ? false : readLockOnHidden(),
  );
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (!cancelled) setAuthEnabled(Boolean(d.configured));
      })
      .catch(() => {});
    if (pinConfigured === undefined) {
      fetch("/api/lock")
        .then((r) => r.json())
        .then((d: { configured?: boolean }) => {
          if (!cancelled && typeof d.configured === "boolean") {
            setConfigured(d.configured);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [open, pinConfigured]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pinBusy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pinBusy]);

  async function savePin() {
    if (pinBusy || configured === null) return;
    if (newPin.length < 4) {
      show("pin needs at least 4 characters", "error");
      return;
    }
    if (newPin !== confirmPin) {
      show("pins don't match", "error");
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch("/api/lock/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configured ? { currentPin, newPin } : { newPin }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed to save pin");
      setConfigured(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      if (configured) {
        show("pin changed");
      } else {
        setLockCookie("1");
        router.refresh();
        return;
      }
    } catch (err) {
      show((err as Error).message, "error");
    } finally {
      setPinBusy(false);
    }
  }

  function lockNow() {
    setLockCookie("1");
    router.refresh();
  }

  async function logOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } catch {
      // Ignore
    }
  }

  if (!open) return null;

  const inputCls = "term-input w-full";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[92dvh] min-h-[60dvh] w-full max-w-[880px] flex-col term-dialog">
        <div className="term-dialog-header shrink-0">
          <p className="flex items-center gap-1.5">
            <SettingsIcon className="h-3.5 w-3.5" />
            settings
          </p>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close settings"
            className="grid h-6 w-6 place-items-center text-term-dim transition-colors hover:text-term"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid items-start gap-4 overflow-y-auto p-4 text-xs sm:grid-cols-2">
          <div className="space-y-4">
            <section>
              <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-term-faint">
                security
              </h3>
              <div className="mt-2 border border-line bg-page/60 p-3">
                <p className="text-term-dim">
                  {configured === null
                    ? "checking pin…"
                    : configured
                      ? "change your pin"
                      : "protect this journal with a pin"}
                </p>
                <div className="mt-2 space-y-2">
                  {configured && (
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="current pin"
                      aria-label="Current pin"
                      className={inputCls}
                    />
                  )}
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="new pin (4+ characters)"
                    aria-label="New pin"
                    className={inputCls}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="repeat new pin"
                    aria-label="Repeat new pin"
                    className={inputCls}
                  />
                  <button
                    onClick={savePin}
                    disabled={pinBusy || configured === null}
                    className="term-btn h-7 w-full"
                  >
                    {pinBusy && (
                      <SpinnerIcon className="h-3 w-3 animate-spin" />
                    )}
                    {configured ? "change pin" : "set pin"}
                  </button>
                </div>
                <button
                  onClick={lockNow}
                  className="term-btn h-7 w-full"
                >
                  <LockIcon className="h-3 w-3" />
                  lock now
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-term-faint">
                lock behavior
              </h3>
              <div className="mt-2 space-y-2 border border-line bg-page/60 p-3">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-term-dim">inactivity lock</span>
                  <select
                    value={timeoutS}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTimeoutS(v);
                      writeLockTimeout(v);
                    }}
                    aria-label="Lock after inactivity"
                    className="term-select"
                  >
                    {TIMEOUT_OPTIONS.map((o) => (
                      <option key={o.seconds} value={o.seconds}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-term-dim">lock on switch away</span>
                  <input
                    type="checkbox"
                    checked={lockOnHidden}
                    onChange={(e) => {
                      setLockOnHidden(e.target.checked);
                      writeLockOnHidden(e.target.checked);
                    }}
                    aria-label="Lock when switching away"
                    className="h-3.5 w-3.5 accent-[#3dff6b]"
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-term-faint">
                data
              </h3>
              <div className="mt-2 border border-line bg-page/60 p-3">
                <a href="/api/export" download className="term-btn h-7 w-full">
                  <DownloadIcon className="h-3 w-3" />
                  download backup (.zip)
                </a>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            {authEnabled && (
              <section>
                <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-term-faint">
                  session
                </h3>
                <div className="mt-2 border border-line bg-page/60 p-3">
                  <p className="flex items-center gap-1.5 text-term-dim">
                    <KeyIcon className="h-3 w-3" />
                    signed in with the hash key
                  </p>
                  <button
                    onClick={logOut}
                    className="term-btn danger mt-2 h-7 w-full"
                  >
                    log out
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
