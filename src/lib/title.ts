/** Derive a title from the first non-empty line of the markdown. */
export function extractTitle(markdown: string): string {
  const line =
    markdown
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "Untitled";
  const cleaned = line
    .replace(/^#{1,6}\s*/, "")
    .replace(/[*_`>\[\]#]+/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "Untitled";
}
