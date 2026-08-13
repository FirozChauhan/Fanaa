"use client";

/**
 * Vim-style status line — the single bar pinned under every screen.
 * Left: the mode tag (-- HOME --, -- INSERT -- …). Right: file/position
 * info. The hint string shows the active key bindings on the far right.
 */
export type StatusMode =
  | "home"
  | "grep"
  | "normal"
  | "insert"
  | "replace"
  | "visual"
  | "v-line"
  | "v-block"
  | "command"
  | "lock";

const MODE_LABEL: Record<StatusMode, string> = {
  home: "HOME",
  grep: "GREP",
  normal: "NORMAL",
  insert: "INSERT",
  replace: "REPLACE",
  visual: "VISUAL",
  "v-line": "V-LINE",
  "v-block": "V-BLOCK",
  command: "COMMAND",
  lock: "LOCKED",
};

const MODE_CLASS: Record<StatusMode, string> = {
  home: "",
  grep: "grep",
  normal: "",
  insert: "insert",
  replace: "replace",
  visual: "visual",
  "v-line": "visual",
  "v-block": "visual",
  command: "command",
  lock: "replace",
};

export default function StatusLine({
  mode,
  left,
  center,
  right,
  hint,
}: {
  mode: StatusMode;
  left?: string;
  center?: string;
  right?: string;
  hint?: string;
}) {
  return (
    <div className="statusline">
      <span className={`mode ${MODE_CLASS[mode]}`}>-- {MODE_LABEL[mode]} --</span>
      {left && <span>{left}</span>}
      <span className="sp" />
      {center && <span>{center}</span>}
      {right && <span>{right}</span>}
      {hint && <span className="hidden text-right md:inline">{hint}</span>}
    </div>
  );
}
