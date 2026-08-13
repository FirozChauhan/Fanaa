"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type PageMeta } from "@/lib/pages";
import { dayKeyOf, formatDayShort } from "@/lib/stats";
import { setLockCookie } from "@/lib/lock-client";
import { emitCreateEnd, emitCreateStart } from "@/lib/new-entry";
import Calendar from "./Calendar";

export type HomeStats = {
  entries: number;
  words: number;
  streak: number;
  today: number;
};

type Prompt =
  | { kind: "grep"; buf: string }
  | { kind: "command"; buf: string }
  | { kind: "delete"; slugs: string[] };

const fmtWords = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/** Entries per page on the home list — bounded so the list never overflows
 *  the viewport (the footer must always stay on screen). */
const PAGE_SIZE = 17;

/** How long a deleted row's exit animation runs before the list refreshes. */
const REMOVE_MS = 320;

export default function HomeMain({
  pages,
  stats,
}: {
  pages: PageMeta[];
  stats: HomeStats;
}) {
  const router = useRouter();
  const promptRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<"" | "g">("");
  const cursorRef = useRef<HTMLDivElement>(null);

  const [cursor, setCursor] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "calendar">("list");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<number | undefined>(undefined);

  // Show a status line and auto-dismiss it after a second — status messages
  // (":w written", "rm: removed …") must never linger on screen.
  const flash = useCallback((msg: string) => {
    setMessage(msg);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    };
  }, []);

  // Pagination: the visible list is a PAGE_SIZE slice of `pages`. The cursor
  // stays an absolute index; the page follows it (and explicit page jumps
  // move the cursor to the new page's first entry).
  const totalPages = Math.max(1, Math.ceil(pages.length / PAGE_SIZE));
  const safePage = Math.min(pageIdx, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, pages.length);
  const pageEntries = pages.slice(pageStart, pageEnd);

  const safeCursor = Math.min(cursor, Math.max(0, pages.length - 1));
  const page = pages[safeCursor];

  const days = new Set(pages.map((p) => dayKeyOf(p)));

  const goPage = useCallback(
    (p: number) => {
      const next = Math.max(0, Math.min(p, totalPages - 1));
      setPageIdx(next);
      setCursor(Math.min(next * PAGE_SIZE, Math.max(0, pages.length - 1)));
    },
    [pages.length, totalPages],
  );

  const doCreate = useCallback(async () => {
    emitCreateStart();
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# Untitled\n\n" }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !data.slug) throw new Error(data.error ?? "create failed");
      emitCreateEnd();
      router.push(`/pages/${data.slug}`);
    } catch (err) {
      emitCreateEnd();
      flash(`:e — ${(err as Error).message}`);
    }
  }, [router, flash]);

  const doDelete = useCallback(
    async (slugs: string[]) => {
      // Close the confirmation immediately — the row(s) animate out below.
      setPrompt(null);
      setSelected(new Set());
      setRemoving((prev) => {
        const next = new Set(prev);
        for (const slug of slugs) next.add(slug);
        return next;
      });
      flash(
        `rm: removing ${slugs.length} file${slugs.length === 1 ? "" : "s"}…`,
      );
      // Run the delete request and the exit animation in parallel, and only
      // refresh once BOTH finish — so the row is never yanked out mid-fade.
      const [results] = await Promise.all([
        Promise.allSettled(
          slugs.map(async (slug) => {
            const res = await fetch(`/api/pages/${slug}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`delete ${slug} failed`);
          }),
        ),
        new Promise((r) => setTimeout(r, REMOVE_MS)),
      ]);
      const failed = results
        .map((r, i) => (r.status === "rejected" ? slugs[i] : null))
        .filter((s): s is string => s !== null);
      // Failed rows must come back; successfully deleted ones stay in
      // `removing` (hidden) until the refresh removes them from the list —
      // the pages-watching effect below prunes them then, so they never
      // flash back on screen.
      setRemoving((prev) => {
        if (failed.length === 0) return prev;
        const next = new Set(prev);
        for (const slug of failed) next.delete(slug);
        return next;
      });
      flash(
        failed.length > 0
          ? `rm: ${failed.length} delete${failed.length === 1 ? "" : "s"} failed`
          : `rm: removed ${slugs.length} file${slugs.length === 1 ? "" : "s"}`,
      );
      router.refresh();
    },
    [router, flash],
  );

  const doLock = useCallback(() => {
    setLockCookie("1");
    router.refresh();
  }, [router]);

  const commitPrompt = useCallback(() => {
    if (!prompt) return;
    if (prompt.kind === "grep") {
      const q = prompt.buf.trim();
      setPrompt(null);
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      return;
    }
    if (prompt.kind === "delete") return;
    const args = prompt.buf.trim().split(/\s+/).filter(Boolean);
    const [cmd] = args;
    setPrompt(null);
    switch (cmd) {
      case "w":
      case "write":
        flash(":w — journal refreshed");
        router.refresh();
        break;
      case "q":
      case "quit":
        doLock();
        break;
      case "h":
      case "help":
        setShowHelp((s) => !s);
        break;
      case "e":
      case "new":
        void doCreate();
        break;
      default:
        if (cmd) flash(`zsh: command not found: :${cmd}`);
    }
  }, [prompt, router, doCreate, doLock, flash]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Delete confirmation: the window owns Enter / Escape.
      if (prompt?.kind === "delete") {
        e.preventDefault();
        if (e.key === "Enter") void doDelete(prompt.slugs);
        else if (e.key === "Escape" || e.key === "n" || e.key === "N")
          setPrompt(null);
        return;
      }

      // The calendar view owns j/k/h/l/Enter — let it handle everything.
      if (view === "calendar") return;

      // Grep/command inputs handle Enter/Escape themselves.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
        return;

      if (pendingRef.current === "g" && e.key !== "g") pendingRef.current = "";

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(safeCursor + 1, Math.max(0, pages.length - 1));
          setCursor(next);
          // Fell off the bottom of this page → land on the next one.
          if (pages.length > 0 && next >= pageEnd) goPage(safePage + 1);
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const next = Math.max(safeCursor - 1, 0);
          setCursor(next);
          // Went above the top of this page → land on the previous one.
          if (next < pageStart) goPage(safePage - 1);
          break;
        }
        case "PageDown":
        case "]":
          e.preventDefault();
          goPage(safePage + 1);
          break;
        case "PageUp":
        case "[":
          e.preventDefault();
          goPage(safePage - 1);
          break;
        case "g":
          e.preventDefault();
          if (pendingRef.current === "g") {
            pendingRef.current = "";
            goPage(0);
          } else {
            pendingRef.current = "g";
          }
          break;
        case "G":
          e.preventDefault();
          setCursor(Math.max(0, pages.length - 1));
          setPageIdx(totalPages - 1);
          break;
        case "Enter":
        case "l":
        case "L":
          e.preventDefault();
          if (page) router.push(`/pages/${page.slug}`);
          break;
        case "n":
          e.preventDefault();
          void doCreate();
          break;
        case "v": {
          e.preventDefault();
          const slug = page?.slug;
          if (!slug) break;
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            return next;
          });
          break;
        }
        case "d": {
          e.preventDefault();
          const slugs =
            selected.size > 0 ? [...selected] : page ? [page.slug] : [];
          if (slugs.length > 0) setPrompt({ kind: "delete", slugs });
          break;
        }
        case "/":
          e.preventDefault();
          setPrompt({ kind: "grep", buf: "" });
          break;
        case ":":
          e.preventDefault();
          setPrompt({ kind: "command", buf: "" });
          break;
        case "c":
          e.preventDefault();
          setView((v) => (v === "calendar" ? "list" : "calendar"));
          break;
        case "?":
          e.preventDefault();
          setShowHelp((s) => !s);
          break;
        case "r":
          e.preventDefault();
          router.refresh();
          break;
      }
    },
    [
      pages,
      selected,
      view,
      prompt,
      page,
      router,
      doCreate,
      doDelete,
      safeCursor,
      pageStart,
      pageEnd,
      safePage,
      totalPages,
      goPage,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Focus the prompt input the moment it appears.
  useEffect(() => {
    if (prompt && prompt.kind !== "delete") promptRef.current?.focus();
  }, [prompt]);

  // Keep the cursor row in view as j/k move it (the list scrolls internally).
  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeCursor, safePage]);

  // Once the server refresh replaces `pages`, deleted slugs are gone from it —
  // drop them from `removing` (nothing renders for them, so the prune is
  // invisible). Deferred out of the effect body so the prune never cascades
  // during render; successful deletes stay hidden in `removing` until then,
  // which is what stops them flashing back on screen.
  useEffect(() => {
    if (removing.size === 0) return;
    const present = new Set(pages.map((p) => p.slug));
    const prune = window.setTimeout(() => {
      setRemoving((prev) => {
        let changed = false;
        const next = new Set<string>();
        for (const slug of prev) {
          if (present.has(slug)) next.add(slug);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 0);
    return () => window.clearTimeout(prune);
  }, [pages, removing.size]);

  if (view === "calendar") {
    return (
      <div className="term-screen flex min-h-0 flex-1 flex-col">
        <Calendar
          days={days}
          entries={pages}
          onExit={() => setView("list")}
        />
      </div>
    );
  }

  return (
    <div className="term-screen flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
      {message && (
        <p className="pb-1 text-xs text-term-dim" role="status">
          {message}
        </p>
      )}

      <p className="pb-2 text-right text-xs text-term-dim">
        {stats.entries} file{stats.entries === 1 ? "" : "s"}
        <span className="text-term-faint"> · </span>
        {fmtWords(stats.words)} words
        <span className="text-term-faint"> · </span>
        streak {stats.streak}d
        <span className="text-term-faint"> · </span>
        {stats.today} today
      </p>

      <div className="mt-5">
        {pages.length === 0 ? (
          <p className="px-3 py-6 text-sm text-term-dim">
            ~/journal is empty — press{" "}
            <span className="term-rev px-1 font-bold">n</span> to write the
            first entry
          </p>
        ) : (
          pageEntries.map((p, i) => {
            const abs = pageStart + i;
            const isCursor = abs === safeCursor;
            const isSelected = selected.has(p.slug);
            const isRemoving = removing.has(p.slug);
            return (
              <div
                key={p.slug}
                ref={isCursor ? cursorRef : undefined}
                role="row"
                aria-selected={isCursor}
                onClick={() => router.push(`/pages/${p.slug}`)}
                onMouseEnter={() => setCursor(abs)}
                className={`home-row ${isCursor ? "is-cursor" : ""} ${
                  isRemoving ? "is-removing" : ""
                }`}
                style={
                  isSelected && !isCursor
                    ? { background: "rgba(255, 200, 87, 0.18)" }
                    : undefined
                }
              >
                <span className="dim text-right tabular-nums">{i + 1}.</span>
                <span className="dim text-term-faint">{p.slug}</span>
                <span className="row-title min-w-0 truncate">
                  {p.title || "Untitled"}
                </span>
                <span className="date dim">{formatDayShort(dayKeyOf(p))}</span>
              </div>
            );
          })
        )}
      </div>

      {pages.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-term-dim">
          <span className="tabular-nums">
            {pageStart + 1}–{pageEnd} of {pages.length}
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => goPage(safePage - 1)}
              disabled={safePage === 0}
              aria-label="Previous page"
              title="Previous page ([)"
              className="term-btn h-6 px-2"
            >
              ←
            </button>
            <span className="tabular-nums text-term">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => goPage(safePage + 1)}
              disabled={safePage === totalPages - 1}
              aria-label="Next page"
              title="Next page (])"
              className="term-btn h-6 px-2"
            >
              →
            </button>
          </span>
        </div>
      )}

      {/* Prompt lines — sticky to the bottom of the (internally scrolling)
          list so a confirmation is always on screen, never below the fold. */}
      {prompt?.kind === "grep" && (
        <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2 border border-line bg-card px-2 py-1.5">
          <span className="text-term-amber">/</span>
          <input
            ref={promptRef}
            name="grep"
            value={prompt.buf}
            onChange={(e) =>
              setPrompt({ kind: "grep", buf: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPrompt();
              else if (e.key === "Escape") setPrompt(null);
            }}
            placeholder="search journal"
            aria-label="Grep the journal"
            spellCheck={false}
            className="term-input h-6 flex-1 border-none bg-transparent"
          />
          <span className="term-cursor" aria-hidden />
        </div>
      )}

      {prompt?.kind === "command" && (
        <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2 border border-line bg-card px-2 py-1.5">
          <span className="text-term-amber">:</span>
          <input
            ref={promptRef}
            name="command"
            value={prompt.buf}
            onChange={(e) =>
              setPrompt({ kind: "command", buf: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPrompt();
              else if (e.key === "Escape") setPrompt(null);
            }}
            placeholder="w | q | help | new"
            aria-label="Command"
            spellCheck={false}
            className="term-input h-6 flex-1 border-none bg-transparent"
          />
        </div>
      )}

      {prompt?.kind === "delete" && (
        <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2 border border-line bg-card px-2 py-1.5">
          <span className="text-term-red">!</span>
          <span className="min-w-0 flex-1 text-sm">
            rm: delete {prompt.slugs.length} file
            {prompt.slugs.length === 1 ? "" : "s"}?{" "}
            <span className="text-term-amber">[Enter]</span>
          </span>
          <span className="term-cursor" aria-hidden />
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div className="mt-3 border border-line-strong bg-card p-3 text-xs leading-6">
          <p className="mb-1 text-term-amber">~ key bindings ~</p>
          <pre className="whitespace-pre text-term">
{`j/k/↑/↓    move cursor        Enter/l   open entry
gg          top of list        G         bottom of list
[ / ]       prev/next page     PgUp/Dn   page up/down
n           new entry          /         grep journal
:           ex command         d         delete · Enter confirm
v           toggle select      c         calendar view
r           refresh            ?         this help`}
          </pre>
        </div>
      )}

    </div>
  );
}
