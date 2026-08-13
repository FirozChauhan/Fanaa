import { searchPages } from "@/lib/pages";
import GrepResults from "@/components/GrepResults";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let results: Awaited<ReturnType<typeof searchPages>> = [];
  let error: string | null = null;
  if (query) {
    try {
      results = await searchPages(query);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  // Keyed by query: each new search remounts the list with a fresh cursor.
  return <GrepResults key={query} query={query} results={results} error={error} />;
}
