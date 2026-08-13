"use client";

import { useState } from "react";
import Link from "next/link";
import SearchInput from "./SearchInput";
import LockButton from "./LockButton";
import NewPageButton from "./NewPageButton";
import SettingsDialog from "./SettingsDialog";
import { SettingsIcon } from "./icons";

/**
 * Terminal title bar. Left: the shell prompt line (fanaa@journal: ~$).
 * Right: the grep/search input, lock, settings and new-entry buttons.
 */
export default function HomeHeader({
  version,
  storageOk = true,
}: {
  version: string;
  storageOk?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const leading = version[0] === "v" ? "v" : "";
  const body = leading ? version.slice(1) : version;

  return (
    <header className="sticky top-0 z-20 bg-page/95">
      <div className="mx-auto flex w-[80%] items-center gap-2 border-b border-line-strong py-3 sm:gap-3">
        <Link
          href="/"
          aria-label="FANAA — home"
          title="فناء"
          className="flex min-w-0 items-baseline gap-2 text-sm text-term-bright transition-colors hover:text-term"
        >
          <span className="font-cairo min-w-0 truncate text-2xl font-bold leading-none tracking-wide">
            فناء{" "}
            <span className="font-mono text-[0.35em] font-normal leading-none tracking-[0.18em] text-term-dim">
              {leading}
              {body}
            </span>
          </span>
        </Link>

        {storageOk && (
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <SearchInput className="w-32 sm:w-56" />
            <LockButton className="hidden sm:inline-flex" />
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
              className="term-btn hidden h-8 w-8 sm:inline-flex"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
            <NewPageButton />
          </div>
        )}
      </div>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  );
}
