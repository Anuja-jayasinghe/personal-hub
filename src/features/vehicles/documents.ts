/**
 * Rules for a vehicle's Documents (P39): every document has a short title the owner types
 * ("Insurance 2026-2027"), and the list can be searched and sorted. Pure: plain values in and
 * out, no database or FormData, so it is easy to test.
 */

export const DOC_TITLE_MAX = 100;

export type DocSort = "newest" | "oldest" | "title";
export const DOC_SORTS: readonly { key: DocSort; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
];

export type DocumentLike = { title: string | null; fileName: string; createdAt: Date };

/** The title, trimmed and with spaces collapsed; it is required. */
export function parseDocTitle(raw: string | undefined): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Give the document a short title, e.g. “Insurance 2026-2027”." };
  if (value.length > DOC_TITLE_MAX) return { ok: false, error: `The title must be at most ${DOC_TITLE_MAX} characters.` };
  return { ok: true, value };
}

/** What to show for a document: its title, or the file name for files uploaded before titles existed. */
export function docLabel(d: Pick<DocumentLike, "title" | "fileName">): string {
  return d.title?.trim() || d.fileName;
}

export function parseDocSort(raw: string | undefined): DocSort {
  return DOC_SORTS.some((s) => s.key === raw) ? (raw as DocSort) : "newest";
}

/**
 * Keeps documents whose title or file name contains every word of `query` (any case), then sorts
 * them. An empty query keeps everything. Does not change the input.
 */
export function searchAndSortDocs<T extends DocumentLike>(docs: readonly T[], query: string, sort: DocSort): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const kept = docs.filter((d) => {
    const haystack = `${docLabel(d)} ${d.fileName}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  return kept.sort((a, b) => {
    if (sort === "title") return docLabel(a).localeCompare(docLabel(b), undefined, { sensitivity: "base", numeric: true });
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    return sort === "oldest" ? diff : -diff;
  });
}
