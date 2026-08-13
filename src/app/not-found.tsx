import Link from "next/link";

export default function NotFound() {
  return (
    <div className="term-screen flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-bold tracking-[0.3em] text-term-red">
        ERROR 404
      </p>
      <pre className="text-xs leading-5 text-term-dim">
        {`$ cat ~/nowhere
cat: ~/nowhere: no such file or directory`}
      </pre>
      <p className="max-w-md text-xs leading-5 text-term-faint">
        the page you&apos;re looking for doesn&apos;t exist, was deleted, or was
        never written.
      </p>
      <Link href="/" className="term-btn mt-1">
        ← back to journal
      </Link>
    </div>
  );
}
