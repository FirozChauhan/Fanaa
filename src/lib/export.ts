import JSZip from "jszip";
import { getPage, listPages, mapLimit, readIndex } from "./pages";

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "entry";
}

/**
 * Bundle every page as a plain text (.md) file plus index.json and a short
 * README, so a backup is usable without the app. Pages are unencrypted in
 * this archive — the user is warned to store it safely.
 */
export async function buildBackupZip(): Promise<Buffer> {
  const zip = new JSZip();
  const index = await readIndex();
  const metas = await listPages(index);
  const indexOut: Record<string, unknown> = {};

  // Decrypt pages concurrently (each is an R2 fetch + gpg spawn) instead of
  // one after another; exporting a large journal used to take forever.
  const pages = await mapLimit(metas, 4, (meta) => getPage(meta.slug, index));
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const page = pages[i];
    if (!page) continue;
    zip.file(`${safeFileName(meta.title)}.md`, page.content);
    indexOut[meta.slug] = {
      title: meta.title,
      updatedAt: meta.updatedAt,
      date: meta.date ?? null,
    };
  }

  zip.file("index.json", JSON.stringify(indexOut, null, 2));
  zip.file(
    "README.txt",
    [
      "FANAA backup",
      "",
      "Each .md file is one journal page (markdown). index.json maps metadata",
      "(slug, title, last updated, optional calendar date) to every page.",
      "",
      "These files are UNENCRYPTED plain text — keep the archive somewhere",
      "only you can reach.",
    ].join("\n"),
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
