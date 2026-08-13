import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./crypto";
import { deleteObject, getObject, putObject } from "./r2";
import { extractTitle } from "./title";
import { toKey, wordCount } from "./stats";

export type PageMeta = {
  slug: string;
  title: string;
  updatedAt: string;
  /** Optional calendar day the entry belongs to ("YYYY-MM-DD"). */
  date?: string | null;
  /** Per-entry line-height override; null/absent = use the global default. */
  lineHeight?: number | null;
};

export type Page = PageMeta & { content: string };

export type SearchResult = {
  slug: string;
  title: string;
  updatedAt: string;
  date: string | null;
  snippet: string;
};

export type Index = {
  pages: Record<
    string,
    {
      title: string;
      updatedAt: string;
      date?: string;
      words?: number;
      lineHeight?: number;
    }
  >;
};

/**
 * The bucket holds (under R2_FOLDER/ if set):
 *   <slug>.gpg   - the encrypted markdown file (gpg --symmetric AES256)
 *   index.json   - plaintext titles/updatedAt/date/words only, used to render
 *                  the page list and stats without decrypting every file.
 */
const INDEX_KEY = "index.json";

const SLUG_RE = /^[a-f0-9]{8}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** Title derivation: the markdown first line. */
export function deriveTitle(content: string): string {
  return extractTitle(content);
}

/** Word count for the index stat. */
function deriveWords(content: string): number {
  return wordCount(content);
}

/** Plain text used to search through a page's content. */
export function deriveText(content: string): string {
  return content;
}

/** Normalize an optional date field for the index. */
function normalizeDate(date: string | null | undefined): string | undefined {
  if (typeof date !== "string") return undefined;
  const d = date.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

export async function readIndex(): Promise<Index> {
  const raw = await getObject(INDEX_KEY);
  if (!raw) return { pages: {} };
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as Index;
    if (!parsed.pages || typeof parsed.pages !== "object") return { pages: {} };
    return parsed;
  } catch {
    return { pages: {} };
  }
}

async function writeIndex(index: Index): Promise<void> {
  await putObject(INDEX_KEY, Buffer.from(JSON.stringify(index), "utf8"));
}

/**
 * Serialize read-modify-write cycles on index.json so concurrent saves from
 * two tabs can't interleave and drop a title/date/words update. Content files
 * are written separately, so only the metadata index needs this.
 */
let indexQueue: Promise<unknown> = Promise.resolve();

function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = indexQueue.then(fn, fn);
  // Keep the chain alive even when a mutation rejects.
  indexQueue = run.catch(() => {});
  return run;
}

export async function listPages(index?: Index): Promise<PageMeta[]> {
  const idx = index ?? (await readIndex());
  return Object.entries(idx.pages)
    .map(([slug, meta]) => ({
      slug,
      title: meta.title,
      updatedAt: meta.updatedAt,
      date: meta.date ?? null,
      lineHeight: meta.lineHeight ?? null,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPage(slug: string, index?: Index): Promise<Page | null> {
  const raw = await getObject(`${slug}.gpg`);
  if (!raw) return null;
  const content = await decrypt(raw);
  const idx = index ?? (await readIndex());
  const meta = idx.pages[slug];
  return {
    slug,
    content,
    title: meta?.title ?? deriveTitle(content),
    updatedAt: meta?.updatedAt ?? new Date(0).toISOString(),
    date: meta?.date ?? null,
    lineHeight: meta?.lineHeight ?? null,
  };
}

export async function createPage(
  content: string,
  date?: string | null,
): Promise<PageMeta> {
  const slug = randomBytes(4).toString("hex");
  const title = deriveTitle(content);
  const updatedAt = new Date().toISOString();
  // Every new entry automatically carries the day it was created, unless the
  // caller explicitly passes a different date (or null to opt out).
  const effective = date === undefined ? toKey(new Date()) : date;
  const normalized = normalizeDate(effective);
  const cipher = await encrypt(content);
  await putObject(`${slug}.gpg`, cipher);
  await withIndexLock(async () => {
    const index = await readIndex();
    index.pages[slug] = {
      title,
      updatedAt,
      ...(normalized ? { date: normalized } : {}),
      words: deriveWords(content),
    };
    await writeIndex(index);
  });
  return { slug, title, updatedAt, date: normalized ?? null };
}

export async function updatePage(
  slug: string,
  content: string,
  date?: string | null,
  lineHeight?: number | null,
): Promise<PageMeta> {
  const title = extractTitle(content);
  const updatedAt = new Date().toISOString();
  const cipher = await encrypt(content);
  await putObject(`${slug}.gpg`, cipher);
  const { date: dateOut, lineHeight: lineHeightOut } = await withIndexLock(
    async () => {
      const index = await readIndex();
      const prev = index.pages[slug] ?? {};
      const next: Index["pages"][string] = {
        title: deriveTitle(content),
        updatedAt,
        words: deriveWords(content),
      };
      if (date === null) {
        // Explicit clear — no date key is written.
      } else if (date !== undefined) {
        const d = normalizeDate(date);
        if (d) next.date = d;
      } else if (prev.date) {
        // Caller didn't send a date — preserve the previous one.
        next.date = prev.date;
      }
      if (lineHeight === null) {
        // Explicit clear — falls back to the global default.
      } else if (lineHeight !== undefined) {
        next.lineHeight = lineHeight;
      } else if (prev.lineHeight) {
        // Caller didn't send a line height — preserve the previous one.
        next.lineHeight = prev.lineHeight;
      }
      index.pages[slug] = next;
      await writeIndex(index);
      return { date: next.date ?? null, lineHeight: next.lineHeight ?? null };
    },
  );
  return { slug, title, updatedAt, date: dateOut, lineHeight: lineHeightOut };
}

export async function deletePage(slug: string): Promise<void> {
  await deleteObject(`${slug}.gpg`);
  await withIndexLock(async () => {
    const index = await readIndex();
    delete index.pages[slug];
    await writeIndex(index);
  });
}

/** Total word count across all pages (cheap — comes from the index). */
export async function totalWords(index?: Index): Promise<number> {
  const idx = index ?? (await readIndex());
  return Object.values(idx.pages).reduce(
    (sum, meta) => sum + (meta.words ?? 0),
    0,
  );
}

/**
 * Run `fn` over `items` with at most `limit` promises in flight, preserving
 * order. Used where N independent async jobs would otherwise serialize on
 * network latency — e.g. decrypting every page for search/export, where each
 * job is an R2 round-trip plus a gpg subprocess spawn.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

// Decrypting every page for a search used to run strictly one-after-another:
// with N entries that is N serial round-trips + N gpg spawns. Run a few in
// parallel instead — bounded so we never spawn dozens of gpg processes at once.
const SEARCH_CONCURRENCY = 4;

/**
 * Full-text search. Every page is decrypted and matched against the query;
 * results include a small snippet around the first match. Personal-journal
 * scale makes this fast enough to do on demand.
 */
export async function searchPages(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Read the index once and reuse it for every page lookup (and the page
  // list) instead of re-fetching it inside each getPage call.
  const index = await readIndex();
  const metas = await listPages(index);
  const pages = await mapLimit(metas, SEARCH_CONCURRENCY, (meta) =>
    getPage(meta.slug, index),
  );
  const results: SearchResult[] = [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const page = pages[i];
    if (!page) continue;
    const text = deriveText(page.content);
    const idx = text.toLowerCase().indexOf(q);
    const inTitle = meta.title.toLowerCase().includes(q);
    if (idx === -1 && !inTitle) continue;
    results.push({
      slug: meta.slug,
      title: meta.title,
      updatedAt: meta.updatedAt,
      date: meta.date ?? null,
      snippet: makeSnippet(text, q, idx),
    });
  }
  return results;
}

function makeSnippet(content: string, q: string, idx: number): string {
  if (idx === -1) {
    // Title-only match: show the first non-empty line of content.
    const first = content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    return (first ?? "").slice(0, 140);
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + q.length + 100);
  let s = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) s = `…${s}`;
  if (end < content.length) s = `${s}…`;
  return s;
}
