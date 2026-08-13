"use client";

import { useRouter } from "next/navigation";
import { LockIcon } from "./icons";
import { setLockCookie } from "@/lib/lock-client";

export default function LockButton({ className }: { className?: string }) {
  const router = useRouter();

  function lockNow() {
    setLockCookie("1");
    router.refresh();
  }

  return (
    <button
      onClick={lockNow}
      title="Lock now"
      aria-label="Lock now"
      className={`term-btn h-8 w-8 ${className ?? ""}`}
    >
      <LockIcon className="h-4 w-4" />
    </button>
  );
}
