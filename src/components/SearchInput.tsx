"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SearchInput({
  initialValue = "",
  autoFocus = false,
  className = "",
}: {
  initialValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialValue);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/");
  }

  return (
    <form
      onSubmit={submit}
      className={`relative min-w-0 ${className}`}
      role="search"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 select-none text-term-amber"
      >
        /
      </span>
      <input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="grep journal…"
        aria-label="Search journal"
        spellCheck={false}
        className="term-input h-8 w-full pl-6"
      />
    </form>
  );
}
