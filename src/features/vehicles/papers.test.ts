import { describe, expect, it } from "vitest";
import {
  buildPapers,
  byUrgency,
  daysWords,
  gapBetween,
  groupPapers,
  guessKind,
  kindOfRenewalType,
  paperFromDocument,
  parseHubName,
  searchPapers,
  toneOfDays,
  type PaperFile,
  type RenewalLike,
} from "./papers";

// Made-up plates only (the repo is public).
const file = (id: string, fileName: string, extra: Partial<PaperFile> = {}): PaperFile => ({
  id,
  ownerType: "vehicle",
  ownerId: "v1",
  fileName,
  title: null,
  mimeType: "application/pdf",
  sizeBytes: 1000,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...extra,
});

const renewal = (id: string, type: string, startDate: string | null, expiryDate: string, extra: Partial<RenewalLike> = {}): RenewalLike => ({
  id,
  type,
  provider: null,
  startDate,
  expiryDate,
  amount: null,
  renewedAt: null,
  createdAt: new Date(`${expiryDate}T00:00:00Z`),
  ...extra,
});

const TODAY = "2026-11-23";

describe("categorising a paper", () => {
  it("reads the kind and date from the name the hub gave it", () => {
    expect(parseHubName("CAB-1234_insurance_2027-05-01.pdf")).toEqual({ kind: "insurance", date: "2027-05-01" });
    expect(parseHubName("CAB-1234_book_2014-02-13_2.jpg")).toEqual({ kind: "book", date: "2014-02-13" });
    expect(parseHubName("FAMILY-CAR_service-invoice_2026-05-01.pdf")).toEqual({ kind: "other", date: "2026-05-01" });
    expect(parseHubName("IMG_2041.jpg")).toBeNull();
    expect(parseHubName("CAB-1234_license_2026-02-31.pdf")).toBeNull();
  });

  it("guesses older files from their title or name", () => {
    expect(guessKind("Insurance 2026-2027")).toBe("insurance");
    expect(guessKind("Revenue licence")).toBe("license");
    expect(guessKind("Emission test certificate")).toBe("emission");
    expect(guessKind("Vehicle book scan")).toBe("book");
    expect(guessKind("CR front page")).toBe("book");
    expect(guessKind("Tyre warranty card")).toBe("other");
  });

  it("puts a dated kind's date in `until`, a book's in `dated`, and drops a title that only repeats them", () => {
    const ins = paperFromDocument(file("a", "CAB-1234_insurance_2027-05-01.pdf", { title: "Insurance until 2027-05-01" }));
    expect(ins).toMatchObject({ kind: "insurance", until: "2027-05-01", dated: null, name: null, renewalId: null });
    const book = paperFromDocument(file("b", "CAB-1234_book_2014-02-13.pdf", { title: "Registration book" }));
    expect(book).toMatchObject({ kind: "book", until: null, dated: "2014-02-13", name: null });
    const other = paperFromDocument(file("c", "CAB-1234_service-invoice_2026-05-01.pdf", { title: "Service invoice" }));
    expect(other).toMatchObject({ kind: "other", dated: "2026-05-01", name: "Service invoice" });
  });

  it("maps renewal types to their category", () => {
    expect(kindOfRenewalType("Revenue license")).toBe("license");
    expect(kindOfRenewalType("Insurance")).toBe("insurance");
    expect(kindOfRenewalType("Emission test")).toBe("emission");
    expect(kindOfRenewalType("Fitness certificate")).toBe("other");
  });
});

describe("renewal files in their category", () => {
  it("makes one paper per renewal with its files, including one without files yet", () => {
    const papers = buildPapers({
      renewals: [renewal("r1", "Insurance", "2025-12-24", "2026-12-23", { provider: "Sample Insurance Co." }), renewal("r2", "Emission test", "2026-03-05", "2027-03-05")],
      renewalFiles: new Map([["r1", [file("f2", "CAB-1234_insurance_2026-12-23_2.jpg", { createdAt: new Date("2026-02-01") }), file("f1", "CAB-1234_insurance_2026-12-23.jpg")]]]),
      documents: [],
    });
    expect(papers).toHaveLength(2);
    expect(papers[0]).toMatchObject({ kind: "insurance", renewalId: "r1", name: "Sample Insurance Co.", until: "2026-12-23" });
    expect(papers[0].files.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(papers[1]).toMatchObject({ kind: "emission", files: [] });
  });

  it("joins a Documents upload to the renewal it is a copy of", () => {
    const papers = buildPapers({
      renewals: [renewal("r1", "Revenue license", "2026-02-13", "2027-02-12")],
      renewalFiles: new Map(),
      documents: [file("d1", "CAB-1234_license_2027-02-12.pdf"), file("d2", "CAB-1234_license_2026-02-12.pdf")],
    });
    expect(papers).toHaveLength(2);
    expect(papers.find((p) => p.renewalId === "r1")?.files.map((f) => f.id)).toEqual(["d1"]);
    expect(papers.find((p) => p.key === "d:d2")).toMatchObject({ kind: "license", until: "2026-02-12" });
  });
});

describe("current versus earlier", () => {
  it("takes the latest valid-until as current and keeps the rest newest first", () => {
    const papers = buildPapers({
      renewals: [
        renewal("old", "Revenue license", "2014-02-13", "2015-02-12", { renewedAt: new Date("2015-02-10") }),
        renewal("now", "Revenue license", "2026-02-13", "2027-02-12"),
        renewal("mid", "Revenue license", "2025-02-13", "2026-02-12", { renewedAt: new Date("2026-02-10") }),
      ],
      renewalFiles: new Map(),
      documents: [],
    });
    const license = groupPapers(papers, TODAY).find((g) => g.kind === "license")!;
    expect(license.current?.renewalId).toBe("now");
    expect(license.earlier.map((p) => p.renewalId)).toEqual(["mid", "old"]);
    expect(license.status).toEqual({ tone: "ok", days: 81 });
  });

  it("keeps the newest book as current and every other paper in a plain list", () => {
    const papers = buildPapers({
      renewals: [],
      renewalFiles: new Map(),
      documents: [file("b1", "CAB-1234_book_2014-02-13.pdf"), file("b2", "CAB-1234_book_2020-06-01.pdf"), file("o1", "CAB-1234_tyre-warranty_2025-01-01.pdf"), file("o2", "CAB-1234_service-invoice_2026-05-01.pdf")],
    });
    const groups = groupPapers(papers, TODAY);
    const book = groups.find((g) => g.kind === "book")!;
    expect(book.current?.key).toBe("d:b2");
    expect(book.earlier.map((p) => p.key)).toEqual(["d:b1"]);
    expect(book.status).toEqual({ tone: "file", count: 2 });
    const other = groups.find((g) => g.kind === "other")!;
    expect(other.current).toBeNull();
    expect(other.earlier.map((p) => p.key)).toEqual(["d:o2", "d:o1"]);
    expect(groups.find((g) => g.kind === "insurance")!.status).toEqual({ tone: "none" });
  });

  it("colours days left like the countdown ring and words them plainly", () => {
    expect([toneOfDays(31), toneOfDays(30), toneOfDays(8), toneOfDays(7), toneOfDays(-2)]).toEqual(["ok", "soon", "soon", "overdue", "overdue"]);
    expect(daysWords(81)).toBe("81 days left");
    expect(daysWords(1)).toBe("1 day left");
    expect(daysWords(0)).toBe("expires today");
    expect(daysWords(-3)).toBe("expired 3 days ago");
  });
});

describe("gaps between papers", () => {
  const papers = buildPapers({
    renewals: [
      renewal("a", "Revenue license", "2026-02-13", "2027-02-12"),
      renewal("b", "Revenue license", "2025-02-13", "2026-02-12", { renewedAt: new Date() }),
      renewal("c", "Revenue license", "2022-02-13", "2025-02-12", { renewedAt: new Date() }),
      renewal("d", "Revenue license", "2014-02-13", "2015-02-12", { renewedAt: new Date() }),
    ],
    renewalFiles: new Map(),
    documents: [],
  });
  const license = groupPapers(papers, TODAY).find((g) => g.kind === "license")!;

  it("finds the years with no license on file", () => {
    expect(license.timeline.map((e) => (e.type === "gap" ? `gap ${e.from}..${e.to}` : e.paper.renewalId))).toEqual(["b", "c", "gap 2015-02-13..2022-02-12", "d"]);
  });

  it("ignores a short late renewal and papers whose start is unknown", () => {
    const [late, before] = buildPapers({
      renewals: [renewal("x", "Insurance", "2026-01-20", "2027-01-19"), renewal("y", "Insurance", "2025-01-01", "2025-12-31")],
      renewalFiles: new Map(),
      documents: [],
    });
    expect(gapBetween(late, before)).toBeNull();
    const unknownStart = paperFromDocument(file("u", "CAB-1234_insurance_2030-01-01.pdf"));
    expect(gapBetween(unknownStart, before)).toBeNull();
  });
});

describe("urgency order", () => {
  it("puts the soonest expiry first, then the book, then other papers, then empty categories", () => {
    const papers = buildPapers({
      renewals: [renewal("l", "Revenue license", null, "2027-02-12"), renewal("i", "Insurance", null, "2026-12-23"), renewal("late", "Emission test", null, "2026-11-20")],
      renewalFiles: new Map(),
      documents: [file("b", "CAB-1234_book_2014-02-13.pdf"), file("o", "CAB-1234_service-invoice_2026-05-01.pdf")],
    });
    expect(byUrgency(groupPapers(papers, TODAY)).map((g) => g.kind)).toEqual(["emission", "insurance", "license", "book", "other"]);

    const fewer = buildPapers({ renewals: [renewal("i", "Insurance", null, "2026-12-23")], renewalFiles: new Map(), documents: [] });
    expect(byUrgency(groupPapers(fewer, TODAY)).map((g) => g.kind)).toEqual(["insurance", "book", "license", "emission", "other"]);
  });
});

describe("searchPapers", () => {
  it("matches every word against names, kinds and file names", () => {
    const papers = buildPapers({
      renewals: [renewal("i", "Insurance", null, "2026-12-23", { provider: "Sample Insurance Co." })],
      renewalFiles: new Map(),
      documents: [file("o", "CAB-1234_service-invoice_2026-05-01.pdf", { title: "Service invoice" })],
    });
    expect(searchPapers(papers, "sample insurance").map((p) => p.key)).toEqual(["r:i"]);
    expect(searchPapers(papers, "INVOICE 2026").map((p) => p.key)).toEqual(["d:o"]);
    expect(searchPapers(papers, "  ")).toEqual([]);
  });
});
