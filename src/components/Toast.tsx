"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

const ToastContext = createContext<{
  show: (message: string, type?: ToastType) => void;
} | null>(null);

/**
 * Terminal-style toasts: fixed bottom-center stack, auto-dismissing,
 * accessible (aria-live). Errors get the red prompt treatment; successes are
 * plain terminal green.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.slice(-4).map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-full items-center gap-2 border px-3.5 py-2 font-mono text-xs shadow-xl shadow-black/60 ${
              t.type === "error"
                ? "border-term-red/70 bg-page text-term-red"
                : "border-line-strong bg-card text-term"
            }`}
          >
            <span aria-hidden className="shrink-0 font-bold">
              {t.type === "error" ? "!" : "$"}
            </span>
            <span className="min-w-0 truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
