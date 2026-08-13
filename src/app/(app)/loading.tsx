export default function Loading() {
  return (
    <div className="term-screen flex min-h-dvh flex-col justify-center px-4">
      <div className="mx-auto w-full max-w-xl text-sm">
        <p>
          <span className="text-term-faint">fanaa@journal:</span>{" "}
          <span className="text-term-faint">~</span>{" "}
          <span className="text-term">$</span>{" "}
          <span className="text-term-dim">
            ls -la ~/journal
            <span className="term-cursor" aria-hidden />
          </span>
        </p>
        <p className="mt-2 text-xs text-term-faint">reading index from r2…</p>
      </div>
    </div>
  );
}
