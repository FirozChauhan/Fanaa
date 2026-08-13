/**
 * Small shared stats helpers for the journal home page.
 *
 * Dates are handled in UTC so that `updatedAt` ISO timestamps (which are UTC)
 * and calendar "today" agree with each other regardless of the server's local
 * timezone.
 */

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** "YYYY-MM-DD" in UTC for the given date. */
export function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/** "YYYY-MM-DD" → e.g. "August 7, 2026" (UTC-safe). */
export function formatDayLong(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "YYYY-MM-DD" → e.g. "Aug 7, 2026" (UTC-safe). */
export function formatDayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The calendar day an entry belongs to: its explicit date, else updatedAt. */
export function dayKeyOf(item: { updatedAt: string; date?: string | null }): string {
  const day = item.date ?? item.updatedAt.slice(0, 10);
  return isValidDayKey(day) ? day : item.updatedAt.slice(0, 10);
}

/**
 * The set of calendar days (UTC, "YYYY-MM-DD") that have at least one entry,
 * using the entry's explicit date when set, falling back to its updatedAt.
 */
export function activityDays(
  items: { updatedAt: string; date?: string | null }[],
): Set<string> {
  const days = new Set<string>();
  for (const it of items) {
    const day = it.date ?? it.updatedAt.slice(0, 10);
    if (isValidDayKey(day)) days.add(day);
  }
  return days;
}

/**
 * Consecutive days with at least one entry, counting back from today.
 * A streak that stopped yesterday (nothing written today yet) is still counted.
 */
export function computeStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!days.has(toKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (days.has(toKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
