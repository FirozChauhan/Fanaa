"use client";

import {
  EDITOR_BGS,
  EDITOR_FGS,
  EDITOR_FONT_SIZES,
  EDITOR_HLS,
} from "@/lib/editor-preferences";

/**
 * Second bar under the app top bar, shown on the editor page: font size
 * (select) plus background / font color swatches. Values are persisted in
 * localStorage and applied to the buffer through CSS variables.
 */
export default function EditorToolbar({
  fontSize,
  bg,
  fg,
  hl,
  onFontSize,
  onBg,
  onFg,
  onHl,
}: {
  fontSize: number;
  bg: string;
  fg: string;
  hl: string;
  onFontSize: (v: number) => void;
  onBg: (v: string) => void;
  onFg: (v: string) => void;
  onHl: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-card/80 py-1.5 text-xs text-term-dim">
      <label className="flex items-center gap-1.5">
        <span className="text-term-faint">size</span>
        <select
          value={fontSize}
          onChange={(e) => onFontSize(Number(e.target.value))}
          aria-label="Editor font size"
          className="term-select h-6"
        >
          {EDITOR_FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        <span className="text-term-faint">bg</span>
        <div className="flex gap-1">
          {EDITOR_BGS.map((c) => (
            <button
              key={c}
              onClick={() => onBg(c)}
              aria-pressed={bg === c}
              title={`Background ${c}`}
              className={`h-4 w-4 border transition-colors ${
                bg === c ? "border-term" : "border-line-strong hover:border-term"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-term-faint">fg</span>
        <div className="flex gap-1">
          {EDITOR_FGS.map((c) => (
            <button
              key={c}
              onClick={() => onFg(c)}
              aria-pressed={fg === c}
              title={`Font ${c}`}
              className={`h-4 w-4 border transition-colors ${
                fg === c ? "border-term" : "border-line-strong hover:border-term"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-term-faint">hl</span>
        <div className="flex gap-1">
          {EDITOR_HLS.map((c) => (
            <button
              key={c}
              onClick={() => onHl(c)}
              aria-pressed={hl === c}
              title={`Highlight ${c}`}
              className={`h-4 w-4 border transition-colors ${
                hl === c ? "border-term" : "border-line-strong hover:border-term"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <span className="ml-auto hidden text-term-faint md:inline">
        :w save · :q save & exit · :q! discard
      </span>
    </div>
  );
}
