"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type PageMeta } from "@/lib/pages";
import { dayKeyOf, formatDayLong } from "@/lib/stats";
import { emitCreateEnd, emitCreateStart } from "@/lib/new-entry";
import StatusLine from "./StatusLine";

type Sel = { y: number; m: number; d: number };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function keyOf(s: Sel): string {
  return `${s.y}-${String(s.m + 1).padStart(2, "0")}-${String(s.d).padStart(2, "0")}`;
}

/**
 * Unix `cal`-style month grid, navigable with vim keys:
 *   h/l  previous/next day     j/k  ±7 days
 *   [ / ]  previous/next month Enter  open the selected day's entry
 *   n    new entry for the day q / Escape  back to the list
 * Days that have entries are brightened; today is amber; the selection is
 * reverse-video.
 */
export default function Calendar({
  days,
  entries,
  onExit,
}: {
  days: Set<string>;
  entries: PageMeta[];
  onExit: () => void;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Sel>(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  });

  const todayKey = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  const dayKey = keyOf(sel);
  const dayEntries = useMemo(
    () => entries.filter((p) => dayKeyOf(p) === dayKey),
    [entries, dayKey],
  );

  const firstDow = useMemo(
    () => new Date(Date.UTC(sel.y, sel.m, 1)).getUTCDay(),
    [sel],
  );
  const daysInMonth = useMemo(
    () => new Date(Date.UTC(sel.y, sel.m + 1, 0)).getUTCDate(),
    [sel],
  );

  function move(delta: number) {
    setSel((s) => {
      const dt = new Date(Date.UTC(s.y, s.m, s.d + delta));
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
    });
  }

  /** Month navigation — Date-normalized so e.g. Jan 31 → Feb 28, never "Feb 31". */
  function moveToMonth(delta: number) {
    setSel((s) => {
      const target = new Date(Date.UTC(s.y, s.m + delta, 1));
      const dim = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();
      return {
        y: target.getUTCFullYear(),
        m: target.getUTCMonth(),
        d: Math.min(s.d, dim),
      };
    });
  }

  const openDay = useCallback(
    (k: string) => {
      const entry = entries.find((p) => dayKeyOf(p) === k);
      if (entry) router.push(`/pages/${entry.slug}`);
    },
    [entries, router],
  );

  const createForDay = useCallback(
    async (k: string) => {
      emitCreateStart();
      try {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `# ${formatDayLong(k)}\n\n`,
            date: k,
          }),
        });
        const data = (await res.json()) as { slug?: string; error?: string };
        if (!res.ok || !data.slug) throw new Error(data.error ?? "create failed");
        emitCreateEnd();
        router.push(`/pages/${data.slug}`);
      } catch (err) {
        emitCreateEnd();
        // Fail silently in the calendar; the list view surfaces errors.
        console.error((err as Error).message);
      }
    },
    [router],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      switch (e.key) {
        case "h":
        case "ArrowLeft":
          e.preventDefault();
          move(-1);
          break;
        case "l":
        case "ArrowRight":
        case "Enter":
          e.preventDefault();
          if (e.key === "Enter") openDay(dayKey);
          else move(1);
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          move(7);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          move(-7);
          break;
        case "[":
          e.preventDefault();
          moveToMonth(-1);
          break;
        case "]":
          e.preventDefault();
          moveToMonth(1);
          break;
        case "n":
          e.preventDefault();
          void createForDay(dayKey);
          break;
        case "q":
        case "Q":
        case "Escape":
          e.preventDefault();
          onExit();
          break;
      }
    },
    [dayKey, openDay, createForDay, onExit],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <p className="pb-1 text-xs text-term-dim">
          <span className="text-term-amber">~</span> cal -m {sel.m + 1} {sel.y}
          <span className="text-term-faint">
            {" "}
            · j/k/h/l move · Enter open · n new · [ ] month · q back
          </span>
        </p>

        <div className="mx-auto max-w-md border-y border-line py-2">
        <p className="pb-2 text-center text-sm font-bold tracking-[0.2em] text-term-bright">
          {MONTHS[sel.m]} {sel.y}
        </p>
        <div className="grid grid-cols-7 text-center text-[11px]">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-0.5 text-term-faint">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center text-sm">
          {cells.map((d, i) => {
            if (d === null) return <span key={`b${i}`} />;
            const k = `${sel.y}-${String(sel.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const has = days.has(k);
            const isSel = k === dayKey;
            const isToday = k === todayKey;
            return (
              <button
                key={k}
                onClick={() => setSel({ y: sel.y, m: sel.m, d })}
                onDoubleClick={() => openDay(k)}
                aria-label={k}
                className={`relative py-1 tabular-nums transition-colors ${
                  isSel
                    ? "term-rev font-bold"
                    : has
                      ? "font-bold text-term"
                      : "text-term-dim"
                } ${isToday && !isSel ? "text-term-amber" : ""}`}
              >
                {d}
                {has && !isSel && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-term"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-3 min-h-[3rem] w-full max-w-md border border-line bg-card px-3 py-2 text-xs">
        <p className="text-term-amber">{formatDayLong(dayKey)}</p>
        {dayEntries.length === 0 ? (
          <p className="pt-1 text-term-faint">no entries — press n to write one</p>
        ) : (
          dayEntries.map((p) => (
            <button
              key={p.slug}
              onClick={() => router.push(`/pages/${p.slug}`)}
              className="block max-w-full truncate pt-1 text-left text-term hover:text-term-bright"
            >
              <span className="mr-2 text-term-dim">›</span>
              {p.title || "Untitled"}
            </button>
          ))
        )}
      </div>
      </div>

      <StatusLine
        mode="home"
        left={`cal ${sel.m + 1} ${sel.y}`}
        right={`${dayKey} · ${dayEntries.length} entr${dayEntries.length === 1 ? "y" : "ies"}`}
        hint="h l j k [ ] n q"
      />
    </div>
  );
}
