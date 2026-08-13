"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/pages";
import StatusLine from "./StatusLine";

export default function GrepResults({
  query,
  results,
  error,
}: {
  query: string;
  results: SearchResult[];
  error: string | null;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef<HTMLAnchorElement>(null);
  const pendingRef = useRef<string | null>(null);

  // Clamp on render; the parent keys <GrepResults> by query, so a new search
  // remounts the list with a fresh cursor.
  const safeCursor = results.length === 0 ? 0 : Math.min(cursor, results.length - 1);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeCursor]);

  const result = results[safeCursor];

  // Vim navigation: j/k move, enter/l open, gg/G, q back, / search,
  // h back, n/N jump to next/prev match.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, Math.max(0, results.length - 1)));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((c) => Math.max(0, c - 1));
          break;
        case "g": {
          if (pendingRef.current === "g") {
            e.preventDefault();
            pendingRef.current = null;
            setCursor(0);
          } else {
            e.preventDefault();
            pendingRef.current = "g";
          }
          break;
        }
        case "G":
          e.preventDefault();
          pendingRef.current = null;
          setCursor(Math.max(0, results.length - 1));
          break;
        case "Enter":
        case "l":
          e.preventDefault();
          if (result) router.push(`/pages/${result.slug}`);
          break;
        case "h":
        case "q":
        case "Escape":
          e.preventDefault();
          router.push("/");
          break;
        default:
          if (pendingRef.current) pendingRef.current = null;
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results.length, result, router]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <p className="flex min-w-0 items-center gap-2 text-xs text-term-dim">
          <span aria-hidden className="shrink-0 select-none text-term-faint">
            fanaa@journal:~$
          </span>
          <span className="shrink-0">grep -i</span>
          <span className="min-w-0 truncate text-term-bright">“{query}”</span>
          <span className="shrink-0">~/journal</span>
        </p>

        {error ? (
          <p className="mt-6 text-xs text-term-red">{error}</p>
        ) : !query ? (
          <p className="mt-6 text-xs text-term-faint">
            type something to search every entry of your journal.
          </p>
        ) : results.length === 0 ? (
          <p className="mt-6 text-xs text-term-faint">
            no entries match “{query}”.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[0.7rem] text-term-faint">
              {results.length} {results.length === 1 ? "match" : "matches"}
            </p>
            <ul className="mt-2 overflow-hidden border border-line">
              {results.map((r, i) => {
                const isCursor = i === safeCursor;
                return (
                  <li key={r.slug}>
                    <Link
                      ref={isCursor ? cursorRef : undefined}
                      href={`/pages/${r.slug}`}
                      className={`flex min-w-0 items-baseline gap-2 px-3 py-1.5 text-xs ${
                        isCursor ? "term-rev" : "hover:bg-term/5"
                      }`}
                      aria-current={isCursor ? "true" : undefined}
                    >
                      <span className={`shrink-0 tabular-nums ${isCursor ? "" : "text-term-faint"}`}>
                        {String(i + 1).padStart(3, "0")}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          isCursor ? "" : "text-term"
                        }`}
                      >
                        {r.title || "Untitled"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-term-dim">
                        {r.snippet}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <StatusLine
        mode="grep"
        left="~/journal"
        center={
          results.length
            ? `${results.length} ${results.length === 1 ? "match" : "matches"}`
            : "no matches"
        }
        right={result ? `${safeCursor + 1}/${results.length}` : ""}
        hint="j/k move · enter open · q back"
      />
    </main>
  );
}
