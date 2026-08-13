/**
 * Editor line-height: a global default (a browser-local reading preference)
 * plus an optional per-entry override stored with each page in the index.
 * The toolbar picker sets the per-entry override; settings sets the default.
 */

export const DEFAULT_LINE_HEIGHT = 1.8;

/** Selectable line-heights shown in the picker and in settings. */
export const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2] as const;

export type LineHeight = (typeof LINE_HEIGHTS)[number];

export const LINE_HEIGHT_KEY = "fanaa:line-height";
// Key used before the app rename; read as a fallback so existing settings
// survive the rename.
const LEGACY_LINE_HEIGHT_KEY = "projectx00:line-height";

export function isLineHeight(v: unknown): v is LineHeight {
  return (
    typeof v === "number" &&
    (LINE_HEIGHTS as readonly number[]).includes(v)
  );
}

/** Global default from localStorage; safe to call on the server. */
export function readGlobalLineHeight(): number {
  if (typeof window === "undefined") return DEFAULT_LINE_HEIGHT;
  const raw =
    localStorage.getItem(LINE_HEIGHT_KEY) ??
    localStorage.getItem(LEGACY_LINE_HEIGHT_KEY);
  const n = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LINE_HEIGHT;
}

export function writeGlobalLineHeight(v: number): void {
  localStorage.setItem(LINE_HEIGHT_KEY, String(v));
}
