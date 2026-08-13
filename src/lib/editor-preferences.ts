/**
 * Editor display preferences (font size, background, font color) chosen from
 * the editor toolbar. Persisted per browser; applied to the CodeMirror buffer
 * through CSS variables (--editor-font-size / --editor-bg / --editor-fg).
 */

export const EDITOR_FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

export const EDITOR_BGS = [
  "#02110a", // terminal page green-black
  "#000000", // pure black
  "#042312", // card green
] as const;

export const EDITOR_FGS = [
  "#3dff6b", // phosphor green
  "#a5ffc2", // bright mint
  "#ffffff", // white
  "#66ffcc", // cyan
] as const;

export const EDITOR_HLS = [
  "#3dff6b", // phosphor green
  "#66ffcc", // cyan
  "#ffc857", // amber
  "#ff6b6b", // red
  "#a5ffc2", // bright mint
] as const;

export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_BG = "#02110a";
export const DEFAULT_FG = "#3dff6b";
export const DEFAULT_HL = "#3dff6b";

const FONT_KEY = "fanaa.editor.fontSize";
const BG_KEY = "fanaa.editor.bg";
const FG_KEY = "fanaa.editor.fg";
const HL_KEY = "fanaa.editor.hl";

function readStored(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function readFontSize(): number {
  const n = Number(readStored(FONT_KEY, String(DEFAULT_FONT_SIZE)));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FONT_SIZE;
}

export function writeFontSize(v: number): void {
  try {
    window.localStorage.setItem(FONT_KEY, String(v));
  } catch {
    // Storage unavailable (private mode) — the in-memory value still applies.
  }
}

export function readBg(): string {
  return readStored(BG_KEY, DEFAULT_BG);
}

export function writeBg(v: string): void {
  try {
    window.localStorage.setItem(BG_KEY, v);
  } catch {
    // Ignore
  }
}

export function readFg(): string {
  return readStored(FG_KEY, DEFAULT_FG);
}

export function writeFg(v: string): void {
  try {
    window.localStorage.setItem(FG_KEY, v);
  } catch {
    // Ignore
  }
}

export function readHl(): string {
  return readStored(HL_KEY, DEFAULT_HL);
}

export function writeHl(v: string): void {
  try {
    window.localStorage.setItem(HL_KEY, v);
  } catch {
    // Ignore
  }
}
