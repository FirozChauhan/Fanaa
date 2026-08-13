export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4">
      <p className="text-xs text-term-dim">
        <span className="text-term-amber">$</span> decrypting buffer from
        storage…
        <span className="term-cursor" aria-hidden />
      </p>
    </div>
  );
}
