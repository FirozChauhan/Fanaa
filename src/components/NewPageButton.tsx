"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { SpinnerIcon } from "./icons";
import { formatDayLong } from "@/lib/stats";
import { CREATE_END, CREATE_START } from "@/lib/new-entry";

/**
 * Create a new text-document entry. When `date` (YYYY-MM-DD) is given, the
 * entry is attached to that calendar day and its title is that day.
 */
export default function NewPageButton({
  date,
  label = "New entry",
  className = "",
}: {
  date?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  // The `o` hotkey creates entries from the list/calendar without going
  // through this button — watch for it so the button shows the same spinner.
  useEffect(() => {
    const start = () => setBusy(true);
    const end = () => setBusy(false);
    window.addEventListener(CREATE_START, start);
    window.addEventListener(CREATE_END, end);
    return () => {
      window.removeEventListener(CREATE_START, start);
      window.removeEventListener(CREATE_END, end);
    };
  }, []);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const dayTitle = date ? formatDayLong(date) : "";
      const content = `# ${dayTitle || "Untitled"}\n\n`;
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(date ? { date } : {}),
        }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !data.slug) throw new Error(data.error ?? "create failed");
      // The header survives navigation (it lives in the (app) layout), so
      // settle the spinner explicitly instead of relying on unmount.
      setBusy(false);
      router.push(`/pages/${data.slug}`);
    } catch (err) {
      show(`failed to create entry: ${(err as Error).message}`, "error");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void create()}
      disabled={busy}
      title={date ? `Write an entry for ${formatDayLong(date)}` : undefined}
      className={`term-btn solid h-8 min-w-[6.25rem] ${className ?? ""}`}
    >
      {busy ? (
        <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <span className="text-sm leading-none">+</span>
      )}
      {busy ? "creating" : label}
    </button>
  );
}
