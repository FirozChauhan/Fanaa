export default function Loading() {
  return (
    <div className="term-screen flex min-h-dvh flex-col justify-center px-4">
      <div className="mx-auto w-full max-w-xl text-sm">
        <p className="text-term-bright">
          <span className="text-term-amber">$</span> boot fanaa
        </p>
        <p className="mt-1 text-xs text-term-faint">
          initializing terminal…
          <span className="term-cursor" aria-hidden />
        </p>
      </div>
    </div>
  );
}
