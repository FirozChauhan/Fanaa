"use client";

import { useState } from "react";
import SettingsDialog from "./SettingsDialog";

export default function PinBanner() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 border border-term-amber/50 bg-card px-4 py-2.5">
      <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-term-dim">
        <span aria-hidden className="shrink-0 font-bold text-term-amber">
          !
        </span>
        <span className="min-w-0 truncate">
          this journal has no pin yet — anyone who opens this app can read it
        </span>
      </p>
      <button
        onClick={() => setOpen(true)}
        className="term-btn h-8 shrink-0 text-term-amber"
      >
        set a pin
      </button>
      <SettingsDialog
        open={open}
        onClose={() => setOpen(false)}
        pinConfigured={false}
      />
    </section>
  );
}
