"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global Home-key binding: press Home anywhere in the app (list, calendar,
 * search, editor) to jump to the root route. It lives in the (app) layout
 * because per-screen handlers can't see the editor page, which renders its
 * own component tree.
 */
export default function HomeKeyHandler() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Home") return;
      e.preventDefault();
      router.push("/");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);

  return null;
}
