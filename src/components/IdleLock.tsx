"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  readLockOnHidden,
  readLockTimeout,
  setLockCookie,
} from "@/lib/lock-client";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Mounted (invisible) whenever the journal is unlocked. Re-locks after the
 * configured idle timeout and optionally when the tab is hidden — both by
 * setting the lock cookie and refreshing so the server renders the lock
 * screen (no content flash).
 */
export default function IdleLock() {
  const router = useRouter();

  useEffect(() => {
    const timeoutS = readLockTimeout();
    const lockOnHidden = readLockOnHidden();

    let timer: number | undefined;

    function lockNow() {
      setLockCookie("1");
      router.refresh();
    }

    function arm() {
      if (timer) window.clearTimeout(timer);
      if (timeoutS > 0) {
        timer = window.setTimeout(lockNow, timeoutS * 1000);
      }
    }

    function onVisibility() {
      if (document.hidden && lockOnHidden) lockNow();
    }

    arm();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, arm, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) window.clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, arm);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
