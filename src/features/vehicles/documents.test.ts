import { describe, expect, it } from "vitest";
import { docLabel, DOC_TITLE_MAX, parseDocSort, parseDocTitle, searchAndSortDocs } from "./documents";

const doc = (title: string | null, fileName: string, day: number) => ({
  title,
  fileName,
  createdAt: new Date(Date.UTC(2026, 0, day)),
});

describe("parseDocTitle", () => {
  it("requires a title and tidies spaces", () => {
    expect(parseDocTitle("  Insurance   2026-2027 ")).toEqual({ ok: true, value: "Insurance 2026-2027" });
    expect(parseDocTitle("").ok).toBe(false);
    expect(parseDocTitle("   ").ok).toBe(false);
    expect(parseDocTitle(undefined).ok).toBe(false);
  });
  it("rejects a title that is too long", () => {
    expect(parseDocTitle("a".repeat(DOC_TITLE_MAX)).ok).toBe(true);
    expect(parseDocTitle("a".repeat(DOC_TITLE_MAX + 1)).ok).toBe(false);
  });
});

describe("docLabel / parseDocSort", () => {
  it("falls back to the file name when there is no title", () => {
    expect(docLabel({ title: "Licence", fileName: "IMG_1.jpg" })).toBe("Licence");
    expect(docLabel({ title: null, fileName: "IMG_1.jpg" })).toBe("IMG_1.jpg");
    expect(docLabel({ title: "  ", fileName: "IMG_1.jpg" })).toBe("IMG_1.jpg");
  });
  it("knows only the three sorts", () => {
    expect(parseDocSort("title")).toBe("title");
    expect(parseDocSort("oldest")).toBe("oldest");
    expect(parseDocSort("nonsense")).toBe("newest");
    expect(parseDocSort(undefined)).toBe("newest");
  });
});

describe("searchAndSortDocs", () => {
  const docs = [
    doc("Insurance 2025-2026", "ins25.pdf", 1),
    doc("Licence", "IMG_0042.jpg", 2),
    doc("Insurance 2026-2027", "ins26.pdf", 3),
    doc(null, "emission-test.pdf", 4),
  ];
  it("sorts newest first by default and oldest first on request", () => {
    expect(searchAndSortDocs(docs, "", "newest").map((d) => d.fileName)).toEqual([
      "emission-test.pdf",
      "ins26.pdf",
      "IMG_0042.jpg",
      "ins25.pdf",
    ]);
    expect(searchAndSortDocs(docs, "", "oldest")[0].fileName).toBe("ins25.pdf");
  });
  it("sorts by title, using the file name when there is none, numbers in order", () => {
    expect(searchAndSortDocs(docs, "", "title").map((d) => docLabel(d))).toEqual([
      "emission-test.pdf",
      "Insurance 2025-2026",
      "Insurance 2026-2027",
      "Licence",
    ]);
  });
  it("searches title and file name, any case, every word must match", () => {
    expect(searchAndSortDocs(docs, "INSURANCE", "newest")).toHaveLength(2);
    expect(searchAndSortDocs(docs, "insurance 2026-2027", "newest").map((d) => d.fileName)).toEqual(["ins26.pdf"]);
    expect(searchAndSortDocs(docs, "img_0042", "newest").map((d) => d.title)).toEqual(["Licence"]);
    expect(searchAndSortDocs(docs, "insurance licence", "newest")).toHaveLength(0);
    expect(searchAndSortDocs(docs, "  ", "newest")).toHaveLength(4);
  });
  it("does not change the list it was given", () => {
    const copy = [...docs];
    searchAndSortDocs(docs, "ins", "title");
    expect(docs).toEqual(copy);
  });
});
