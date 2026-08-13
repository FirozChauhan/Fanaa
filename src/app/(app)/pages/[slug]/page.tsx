import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage, isValidSlug, type Page } from "@/lib/pages";
import VimEditor from "@/components/VimEditor";

export const dynamic = "force-dynamic";

export default async function PageEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  let page: Page | null = null;
  let loadError: string | null = null;
  try {
    page = await getPage(slug);
  } catch (err) {
    loadError = (err as Error).message ?? "Failed to load page";
  }

  if (loadError) {
    // Rendered inside the (app) layout, which already provides the terminal
    // screen + top bar — this fills the remaining space.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-term-red">
          ! could not decrypt this page
        </p>
        <p className="max-w-md text-sm leading-6 text-term-dim">{loadError}</p>
        <p className="text-xs text-term-faint">
          check that ENC_PASSPHRASE matches the one used when the page was
          saved
        </p>
        <Link href="/" className="term-btn mt-2">
          ← back to journal
        </Link>
      </div>
    );
  }

  if (!page) notFound();

  return <VimEditor page={page} />;
}
