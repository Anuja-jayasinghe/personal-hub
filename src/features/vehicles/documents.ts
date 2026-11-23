/**
 * Rules for a vehicle document's title (P39, C72): a short name the owner types ("Insurance 2026-2027"),
 * used when renaming. Searching and grouping the papers moved to papers.ts (issue #187). Pure: plain
 * values in and out, no database or FormData, so it is easy to test.
 */

export const DOC_TITLE_MAX = 100;

/** The title, trimmed and with spaces collapsed; it is required. */
export function parseDocTitle(raw: string | undefined): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Give the document a short title, e.g. “Insurance 2026-2027”." };
  if (value.length > DOC_TITLE_MAX) return { ok: false, error: `The title must be at most ${DOC_TITLE_MAX} characters.` };
  return { ok: true, value };
}
