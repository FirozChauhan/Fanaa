"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { getCM, Vim, vim } from "@replit/codemirror-vim";
import { extractTitle } from "@/lib/title";
import { wordCount } from "@/lib/stats";
import {
  readBg,
  readFg,
  readFontSize,
  readHl,
  writeBg,
  writeFg,
  writeFontSize,
  writeHl,
} from "@/lib/editor-preferences";
import { type Page } from "@/lib/pages";
import StatusLine, { type StatusMode } from "./StatusLine";
import EditorToolbar from "./EditorToolbar";

const AUTOSAVE_MS = 900;

// Copies yanked text to the OS clipboard (async API first, execCommand
// fallback for contexts where the async one is blocked/unavailable).
function copyToClipboard(text: string): void {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {
      // Clipboard unavailable — the vim registers still hold the yank.
    }
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

const MODE_MAP: Record<string, StatusMode> = {
  insert: "insert",
  normal: "normal",
  replace: "replace",
  visual: "visual",
  "v-line": "v-line",
  "v-block": "v-block",
};

/**
 * The journal editor as a real vim buffer: CodeMirror with the
 * @replit/codemirror-vim emulation, so every vim key works (hjkl, w/e/b,
 * d/y/p, gg/G, /-search, i/a/o, visual modes, registers, macros…).
 *
 * Ex commands:
 *   :w      save now
 *   :q      save + back to the journal list
 *   :wq     same as :q
 *   :q!     back to the list WITHOUT saving
 *   :qall / :wqall   same as :q
 *
 * The vim core routes ":q!" to the "q" command with the bang folded into
 * params.argString, so each handler checks for it explicitly.
 *
 * Autosave: edits are written ~0.9s after the last keystroke, and again on
 * tab-hide / unload, so a "lost" buffer is nearly impossible.
 */
export default function VimEditor({ page }: { page: Page }) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastSavedRef = useRef(page.content);
  const retryRef = useRef<number | undefined>(undefined);
  const autosaveRef = useRef<number | undefined>(undefined);
  const dirtyRef = useRef(false);

  const saveRef = useRef<() => void>(() => {});
  const exitRef = useRef<() => void>(() => {});
  const saveAndExitRef = useRef<() => void>(() => {});

  // Display metadata only — updated when it actually changes, so typing
  // mid-line never re-renders the chrome on every keystroke.
  const [meta, setMeta] = useState(() => ({
    title: extractTitle(page.content),
    words: wordCount(page.content),
  }));
  const [mode, setMode] = useState<StatusMode>("normal");
  const [pos, setPos] = useState("1,1");
  const [status, setStatus] = useState<string | null>(null);

  // Editor display prefs (persisted per browser).
  const [fontSize, setFontSize] = useState<number>(() => readFontSize());
  const [bg, setBg] = useState<string>(() => readBg());
  const [fg, setFg] = useState<string>(() => readFg());
  const [hl, setHl] = useState<string>(() => readHl());

  const title = meta.title;
  const words = meta.words;

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2600);
  }, []);

  const save = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    if (doc === lastSavedRef.current) return;
    try {
      const res = await fetch(`/api/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: doc }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      lastSavedRef.current = doc;
      dirtyRef.current = false;
      flash(":w — written");
    } catch (err) {
      setStatus(`:w — ${(err as Error).message}; retrying in 3s`);
      if (retryRef.current) window.clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(() => saveRef.current(), 3000);
    }
  }, [page.slug, flash]);

  const exit = useCallback(() => {
    if (retryRef.current) window.clearTimeout(retryRef.current);
    router.push("/");
  }, [router]);

  const saveAndExit = useCallback(() => {
    void (async () => {
      await saveRef.current();
      exitRef.current();
    })();
  }, []);

  // Keep the latest implementations reachable from the vim ex commands and
  // timers without re-creating the editor.
  useEffect(() => {
    saveRef.current = save;
    exitRef.current = exit;
    saveAndExitRef.current = saveAndExit;
  });

  // Mount the CodeMirror + vim editor exactly once.
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: page.content,
        extensions: [
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          highlightSelectionMatches(),
          drawSelection(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              if (!dirtyRef.current) dirtyRef.current = true;
              // Debounced autosave — the timer resets on every keystroke, so
              // a burst of typing saves once, ~0.9s after it stops.
              if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
              autosaveRef.current = window.setTimeout(
                () => saveRef.current(),
                AUTOSAVE_MS,
              );
              // Refresh the title/word-count only when they actually changed.
              const docStr = u.state.doc.toString();
              const t = extractTitle(docStr);
              const w = wordCount(docStr);
              setMeta((m) =>
                m.title === t && m.words === w ? m : { title: t, words: w },
              );
            }
            if (u.selectionSet || u.docChanged) {
              const head = u.state.selection.main.head;
              const line = u.state.doc.lineAt(head);
              const next = `${line.number},${head - line.from + 1}`;
              setPos((p) => (p === next ? p : next));
            }
          }),
          vim(),
        ],
      }),
    });
    viewRef.current = view;

    const cm = getCM(view);
    const onMode = (e: { mode?: string }) => {
      setMode(MODE_MAP[e?.mode ?? "normal"] ?? "normal");
    };
    cm?.on("vim-mode-change", onMode);

    // The vim core parses ":q!" as command "q" with "!" folded into
    // argString — check both, like the reviewer's fix prescribes.
    const bang = (params: { argString?: string; bang?: boolean }) =>
      Boolean(params.bang) || /!/.test(params.argString ?? "");

    Vim.defineEx("w", "w", () => saveRef.current());
    Vim.defineEx("q", "q", (_cm, params) => {
      if (bang(params)) exitRef.current();
      else saveAndExitRef.current();
    });
    Vim.defineEx("wq", "wq", () => saveAndExitRef.current());
    Vim.defineEx("qall", "qall", (_cm, params) => {
      if (bang(params)) exitRef.current();
      else saveAndExitRef.current();
    });
    Vim.defineEx("wqall", "wqall", () => saveAndExitRef.current());

    // The vim core only pushes yanks to the OS clipboard for the "+ register;
    // a plain `y`/`yy`/visual-y stays in vim's internal registers. Patch the
    // register controller so every yank also lands on the system clipboard.
    const registers = Vim.getRegisterController();
    const pushText = registers.pushText.bind(registers);
    registers.pushText = (registerName, operator, text, linewise, blockwise) => {
      pushText(registerName, operator, text, linewise, blockwise);
      if (operator === "yank" && registerName !== "_" && registerName !== "+") {
        copyToClipboard(text);
      }
    };

    requestAnimationFrame(() => {
      view.focus();
      const head = view.state.selection.main.head;
      const line = view.state.doc.lineAt(head);
      setPos(`${line.number},${head - line.from + 1}`);
    });

    return () => {
      cm?.off("vim-mode-change", onMode);
      if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once from the initial page payload; later page
    // changes come through the same instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save when the tab hides or the page unloads; warn when leaving dirty.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") saveRef.current();
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const view = viewRef.current;
      if (view && view.state.doc.toString() !== lastSavedRef.current) {
        e.preventDefault();
      }
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        fontSize={fontSize}
        bg={bg}
        fg={fg}
        onFontSize={(v) => {
          setFontSize(v);
          writeFontSize(v);
        }}
        onBg={(v) => {
          setBg(v);
          writeBg(v);
        }}
        onFg={(v) => {
          setFg(v);
          writeFg(v);
        }}
        hl={hl}
        onHl={(v) => {
          setHl(v);
          writeHl(v);
        }}
      />

      {/* The buffer — framed like a terminal window, spanning the full app
          width with vertical margin from the bars, and fed the display
          prefs as CSS variables. */}
      <div className="flex min-h-0 flex-1 py-3">
        <div
          ref={parentRef}
          className="min-h-0 flex-1 overflow-hidden border border-line-strong"
          aria-label={`Editing ${title}`}
          style={
            {
              "--editor-font-size": `${fontSize}px`,
              "--editor-bg": bg,
              "--editor-fg": fg,
              "--editor-hl": hl,
            } as React.CSSProperties
          }
        />
      </div>

      {status && (
        <div className="border-t border-line bg-card py-1 text-xs text-term-amber">
          {status}
        </div>
      )}

      <StatusLine
        mode={mode}
        left={`~/journal/${page.slug}.gpg`}
        center={status ?? undefined}
        right={`${words}w · L${pos}`}
        hint=":w :q :q! / i a o esc"
      />
    </div>
  );
}
