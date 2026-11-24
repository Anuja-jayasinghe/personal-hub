import { describe, expect, it } from "vitest";
import {
  buildPapers,
  byUrgency,
  daysWords,
  gapBetween,
  glanceGroups,
  glanceLabel,
  glanceTarget,
  groupPapers,
  guessKind,
  kindOfRenewalType,
  paperFromDocument,
  paperFromRenewal,
  parseHubName,
  renewDue,
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
const group = (papers: ReturnType<typeof buildPapers>, kind: string) => groupPapers(papers, TODAY).find((g) => g.kind === kind)!;
const only = (input: Partial<Parameters<typeof buildPapers>[0]>) => buildPapers({ renewals: [], renewalFiles: new Map(), documents: [], ...input });

describe("categorising a paper", () => {
  it("reads the kind and date from the name the hub gave it", () => {
    expect(parseHubName("CAB-1234_insurance_2027-05-01.pdf")).toEqual({ kind: "insurance", date: "2027-05-01" });
    expect(parseHubName("CAB-1234_book_2014-02-13_2.jpg")).toEqual({ kind: "book", date: "2014-02-13" });
    expect(parseHubName("FAMILY-CAR_service-invoice_2026-05-01.pdf")).toEqual({ kind: "other", date: "2026-05-01" });
    expect(parseHubName("IMG_2041.jpg")).toBeNull();
    expect(parseHubName("CAB-1234_license_2026-02-31.pdf")).toBeNull();
  });

  it("guesses older files only from clear words", () => {
    expect(guessKind("Insurance 2026-2027")).toBe("insurance");
    expect(guessKind("Revenue licence")).toBe("license");
    expect(guessKind("revenue_license_scan.jpg")).toBe("license");
    expect(guessKind("Emission test certificate")).toBe("emission");
    expect(guessKind("Registration book front")).toBe("book");
    expect(guessKind("Driving licence")).toBe("other");
    expect(guessKind("License plate photo")).toBe("other");
    expect(guessKind("Book of accounts")).toBe("other");
    expect(guessKind("Tyre warranty card")).toBe("other");
  });

  it("keeps an Other upload titled like a kind as Other when its hub name says so", () => {
    expect(paperFromDocument(file("o", "CAB-1234_other-insurance_2026-01-01.pdf", { title: "Insurance" }))).toMatchObject({ kind: "other", name: "Insurance" });
  });

  it("puts a dated kind's date in `until`, a book's in `dated`, and drops a title that only repeats them", () => {
    const ins = paperFromDocument(file("a", "CAB-1234_insurance_2027-05-01.pdf", { title: "Insurance until 2027-05-01" }));
    expect(ins).toMatchObject({ kind: "insurance", until: "2027-05-01", dated: null, name: null, renewalId: null });
    const book = paperFromDocument(file("b", "CAB-1234_book_2014-02-13.pdf", { title: "Registration book" }));
    expect(book).toMatchObject({ kind: "book", until: null, dated: "2014-02-13", name: null });
    const other = paperFromDocument(file("c", "CAB-1234_service-invoice_2026-05-01.pdf", { title: "Service invoice" }));
    expect(other).toMatchObject({ kind: "other", dated: "2026-05-01", name: "Service invoice" });
  });

  it("takes the date from an older file's title when its name has none", () => {
    expect(paperFromDocument(file("t", "IMG_2041.jpg", { title: "Insurance until 2025-12-31" }))).toMatchObject({ kind: "insurance", until: "2025-12-31", name: null });
    expect(paperFromDocument(file("u", "IMG_2042.jpg", { title: "Insurance 2026-02-31" }))).toMatchObject({ kind: "insurance", until: null });
    expect(paperFromDocument(file("v", "scan.pdf", { title: "Registration book" }))).toMatchObject({ kind: "book", dated: null });
  });

  it("maps renewal types to their category", () => {
    expect(kindOfRenewalType("Revenue license")).toBe("license");
    expect(kindOfRenewalType("Insurance")).toBe("insurance");
    expect(kindOfRenewalType("Emission test")).toBe("emission");
    expect(kindOfRenewalType("Fitness certificate")).toBe("other");
    expect(paperFromRenewal(renewal("f", "Fitness certificate", null, "2027-01-01"), [])).toMatchObject({ kind: "other", name: "Fitness certificate", dated: "2027-01-01" });
  });
});

describe("renewal files in their category", () => {
  it("makes one paper per renewal with its files, including one without files yet", () => {
    const papers = only({
      renewals: [renewal("r1", "Insurance", "2025-12-24", "2026-12-23", { provider: "Sample Insurance Co." }), renewal("r2", "Emission test", "2026-03-05", "2027-03-05")],
      renewalFiles: new Map([["r1", [file("f2", "CAB-1234_insurance_2026-12-23_2.jpg", { createdAt: new Date("2026-02-01") }), file("f1", "CAB-1234_insurance_2026-12-23.jpg")]]]),
    });
    expect(papers).toHaveLength(2);
    expect(papers[0]).toMatchObject({ kind: "insurance", renewalId: "r1", name: "Sample Insurance Co.", until: "2026-12-23" });
    expect(papers[0].files.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(papers[1]).toMatchObject({ kind: "emission", files: [] });
  });

  it("joins a Documents upload only to a renewal of the same kind and valid-until", () => {
    const papers = only({
      renewals: [renewal("r1", "Revenue license", "2026-02-13", "2027-02-12")],
      documents: [file("same", "CAB-1234_license_2027-02-12.pdf"), file("date", "CAB-1234_license_2026-02-12.pdf"), file("kind", "CAB-1234_insurance_2027-02-12.pdf")],
    });
    expect(papers.find((p) => p.renewalId === "r1")?.files.map((f) => f.id)).toEqual(["same"]);
    expect(papers.find((p) => p.key === "d:date")).toMatchObject({ kind: "license", until: "2026-02-12" });
    expect(papers.find((p) => p.key === "d:kind")).toMatchObject({ kind: "insurance", until: "2027-02-12" });
  });

  it("joins the renewal in force when two renewals share the date", () => {
    const papers = only({
      renewals: [
        renewal("old", "Insurance", null, "2027-05-01", { renewedAt: new Date("2026-05-01"), createdAt: new Date("2026-01-01") }),
        renewal("new", "Insurance", null, "2027-05-01", { createdAt: new Date("2026-02-01") }),
      ],
      documents: [file("d", "CAB-1234_insurance_2027-05-01.pdf")],
    });
    expect(papers.find((p) => p.renewalId === "new")?.files.map((f) => f.id)).toEqual(["d"]);
    expect(group(papers, "insurance").current?.renewalId).toBe("new");
  });
});

describe("current versus earlier", () => {
  it("takes the renewal in force as current and keeps the rest newest first", () => {
    const papers = only({
      renewals: [
        renewal("old", "Revenue license", "2014-02-13", "2015-02-12", { renewedAt: new Date("2015-02-10") }),
        renewal("now", "Revenue license", "2026-02-13", "2027-02-12"),
        renewal("mid", "Revenue license", "2025-02-13", "2026-02-12", { renewedAt: new Date("2026-02-10") }),
      ],
    });
    const license = group(papers, "license");
    expect(license.current?.renewalId).toBe("now");
    expect(license.earlier.map((p) => p.renewalId)).toEqual(["mid", "old"]);
    expect(license.status).toEqual({ tone: "ok", days: 81 });
  });

  it("never makes a renewed renewal current: renew A, then delete the new B, and A sits under earlier", () => {
    const papers = only({ renewals: [renewal("A", "Insurance", "2025-12-01", "2026-12-01", { renewedAt: new Date("2026-11-20") })] });
    const insurance = group(papers, "insurance");
    expect(insurance.current).toBeNull();
    expect(insurance.earlier.map((p) => p.renewalId)).toEqual(["A"]);
    expect(insurance.status).toEqual({ tone: "file", count: 1 });
  });

  it("prefers a renewal not yet renewed even when a renewed one ends later", () => {
    const papers = only({
      renewals: [renewal("renewed", "Insurance", null, "2027-06-01", { renewedAt: new Date("2026-06-01") }), renewal("active", "Insurance", null, "2027-01-01")],
    });
    const insurance = group(papers, "insurance");
    expect(insurance.current?.renewalId).toBe("active");
    expect(insurance.earlier.map((p) => p.renewalId)).toEqual(["renewed"]);
  });

  it("never lets a Documents upload of a dated kind be current or change the days", () => {
    const papers = only({
      renewals: [renewal("r", "Insurance", "2025-12-01", "2026-12-01")],
      documents: [file("later", "CAB-1234_insurance_2028-01-01.pdf"), file("undated", "insurance-card.jpg", { title: "Insurance card" })],
    });
    const insurance = group(papers, "insurance");
    expect(insurance.current?.renewalId).toBe("r");
    expect(insurance.status).toEqual({ tone: "soon", days: 8 });
    expect(insurance.onFile.map((p) => p.key)).toEqual(["d:later", "d:undated"]);
    expect(insurance.earlier).toEqual([]);
  });

  it("shows uploads of a dated kind as on file, with no days, when there is no renewal", () => {
    const papers = only({ documents: [file("l", "CAB-1234_license_2027-02-12.pdf")] });
    const license = group(papers, "license");
    expect(license.current).toBeNull();
    expect(license.status).toEqual({ tone: "file", count: 1 });
    expect(license.onFile.map((p) => p.key)).toEqual(["d:l"]);
  });

  it("places an undated paper by the day it was added, so it neither sits last nor hides a newer one", () => {
    const papers = only({
      documents: [
        file("old-dated", "CAB-1234_book_2014-02-13.pdf"),
        file("undated", "Registration book.jpg", { title: "Registration book", createdAt: new Date("2025-06-01T00:00:00Z") }),
        file("new-dated", "CAB-1234_book_2026-03-01.pdf"),
      ],
    });
    const book = group(papers, "book");
    expect(book.current?.key).toBe("d:new-dated");
    expect(book.earlier.map((p) => p.key)).toEqual(["d:undated", "d:old-dated"]);
  });

  it("places an undated paper by its day in the app time zone, not the UTC day", () => {
    // 20:00 UTC on 1 June is 01:30 on 2 June in Colombo, so the undated book is newer than one printed on 1 June.
    const papers = only({
      documents: [file("printed", "CAB-1234_book_2025-06-01.pdf"), file("undated", "Registration book.jpg", { title: "Registration book", createdAt: new Date("2025-06-01T20:00:00Z") })],
    });
    expect(group(papers, "book").current?.key).toBe("d:undated");
  });

  it("keeps the newest book as current and every other paper on file", () => {
    const papers = only({
      documents: [file("b1", "CAB-1234_book_2014-02-13.pdf"), file("b2", "CAB-1234_book_2020-06-01.pdf"), file("o1", "CAB-1234_tyre-warranty_2025-01-01.pdf"), file("o2", "CAB-1234_service-invoice_2026-05-01.pdf")],
    });
    const book = group(papers, "book");
    expect(book.current?.key).toBe("d:b2");
    expect(book.earlier.map((p) => p.key)).toEqual(["d:b1"]);
    expect(book.status).toEqual({ tone: "file", count: 2 });
    const other = group(papers, "other");
    expect(other.current).toBeNull();
    expect(other.onFile.map((p) => p.key)).toEqual(["d:o2", "d:o1"]);
    expect(group(papers, "insurance").status).toEqual({ tone: "none" });
  });

  it("colours days left like the countdown ring, words them plainly and offers Renew inside 30 days", () => {
    expect([toneOfDays(31), toneOfDays(30), toneOfDays(8), toneOfDays(7), toneOfDays(-2)]).toEqual(["ok", "soon", "soon", "overdue", "overdue"]);
    expect(daysWords(81)).toBe("81 days left");
    expect(daysWords(1)).toBe("1 day left");
    expect(daysWords(0)).toBe("expires today");
    expect(daysWords(-3)).toBe("expired 3 days ago");
    expect([renewDue(31), renewDue(30), renewDue(0), renewDue(-5), renewDue(null)]).toEqual([false, true, true, true, false]);
  });
});

describe("gaps between papers", () => {
  const papers = only({
    renewals: [
      renewal("a", "Revenue license", "2026-02-13", "2027-02-12"),
      renewal("b", "Revenue license", "2025-02-13", "2026-02-12", { renewedAt: new Date() }),
      renewal("c", "Revenue license", "2022-02-13", "2025-02-12", { renewedAt: new Date() }),
      renewal("d", "Revenue license", "2014-02-13", "2015-02-12", { renewedAt: new Date() }),
    ],
  });

  it("finds the years with no license on file", () => {
    expect(group(papers, "license").timeline.map((e) => (e.type === "gap" ? `gap ${e.from}..${e.to}` : e.paper.renewalId))).toEqual(["b", "c", "gap 2015-02-13..2022-02-12", "d"]);
  });

  it("counts a break of 31 days as a late renewal and 32 days as a gap", () => {
    const older = paperFromRenewal(renewal("o", "Insurance", "2025-01-01", "2025-12-31"), []);
    // 31 days with nothing: 1 to 31 January.
    expect(gapBetween(paperFromRenewal(renewal("n31", "Insurance", "2026-02-01", "2027-01-31"), []), older)).toBeNull();
    // 32 days with nothing: 1 January to 1 February.
    expect(gapBetween(paperFromRenewal(renewal("n32", "Insurance", "2026-02-02", "2027-02-01"), []), older)).toEqual({ from: "2026-01-01", to: "2026-02-01" });
  });

  it("finds no gap between overlapping or back-to-back papers, or when the start is unknown", () => {
    const older = paperFromRenewal(renewal("o", "Insurance", "2025-01-01", "2025-12-31"), []);
    expect(gapBetween(paperFromRenewal(renewal("overlap", "Insurance", "2025-11-01", "2026-10-31"), []), older)).toBeNull();
    expect(gapBetween(paperFromRenewal(renewal("next", "Insurance", "2026-01-01", "2026-12-31"), []), older)).toBeNull();
    expect(gapBetween(paperFromRenewal(renewal("nostart", "Insurance", null, "2030-01-01"), []), older)).toBeNull();
  });
});

describe("urgency order", () => {
  it("puts the soonest expiry first, then the book, then other papers, then empty categories", () => {
    const papers = only({
      renewals: [renewal("l", "Revenue license", null, "2027-02-12"), renewal("i", "Insurance", null, "2026-12-23"), renewal("late", "Emission test", null, "2026-11-20")],
      documents: [file("b", "CAB-1234_book_2014-02-13.pdf"), file("o", "CAB-1234_service-invoice_2026-05-01.pdf")],
    });
    expect(byUrgency(groupPapers(papers, TODAY)).map((g) => g.kind)).toEqual(["emission", "insurance", "license", "book", "other"]);

    const fewer = only({ renewals: [renewal("i", "Insurance", null, "2026-12-23")] });
    expect(byUrgency(groupPapers(fewer, TODAY)).map((g) => g.kind)).toEqual(["insurance", "book", "license", "emission", "other"]);
  });

  it("puts the longest overdue first when two have run out", () => {
    const papers = only({ renewals: [renewal("i", "Insurance", null, "2026-11-21"), renewal("e", "Emission test", null, "2026-11-01")] });
    expect(byUrgency(groupPapers(papers, TODAY)).slice(0, 2).map((g) => [g.kind, g.status.tone])).toEqual([
      ["emission", "overdue"],
      ["insurance", "overdue"],
    ]);
  });

  it("ranks a dated kind with uploads only beside the book, not with the expiring ones", () => {
    const papers = only({ renewals: [renewal("i", "Insurance", null, "2027-12-23")], documents: [file("l", "CAB-1234_license_2026-12-01.pdf")] });
    expect(byUrgency(groupPapers(papers, TODAY)).map((g) => g.kind)).toEqual(["insurance", "license", "book", "emission", "other"]);
  });
});

describe("searchPapers", () => {
  const papers = only({
    renewals: [renewal("i", "Insurance", null, "2026-12-23", { provider: "Sample Insurance Co." })],
    documents: [file("o", "scan.pdf", { title: "Service invoice 2026-05-01" }), file("b", "CAB-1234_book_2014-02-13.pdf", { title: "Registration book" })],
  });

  it("matches every word against names, kinds and file names", () => {
    expect(searchPapers(papers, "sample insurance").map((p) => p.key)).toEqual(["r:i"]);
    expect(searchPapers(papers, "INVOICE").map((p) => p.key)).toEqual(["d:o"]);
    expect(searchPapers(papers, "  ")).toEqual([]);
  });

  it("matches the dates", () => {
    expect(searchPapers(papers, "2026-12").map((p) => p.key)).toEqual(["r:i"]);
    expect(searchPapers(papers, "2014").map((p) => p.key)).toEqual(["d:b"]);
  });

  it("matches the dates as the screen writes them", () => {
    const shown = (day: string) => (day === "2026-12-23" ? "Dec 23, 2026 Dec 2026" : day === "2014-02-13" ? "Feb 13, 2014 Feb 2014" : "");
    expect(searchPapers(papers, "dec 2026", shown).map((p) => p.key)).toEqual(["r:i"]);
    expect(searchPapers(papers, "Feb 2014", shown).map((p) => p.key)).toEqual(["d:b"]);
    expect(searchPapers(papers, "dec 2026").map((p) => p.key)).toEqual([]);
  });
});

describe("at-a-glance tiles (issue #211)", () => {
  const tilesOf = (input: Partial<Parameters<typeof buildPapers>[0]>) => groupPapers(only(input), TODAY);

  it("gives a tile only to categories with something in them, in the usual order", () => {
    const groups = tilesOf({ renewals: [renewal("i", "Insurance", null, "2027-05-01")], documents: [file("b", "CAB-1234_book_2014-02-13.pdf")] });
    expect(glanceGroups(groups).map((g) => g.kind)).toEqual(["book", "insurance"]);
    expect(glanceGroups(tilesOf({}))).toEqual([]);
    const all = tilesOf({
      renewals: [renewal("l", "Revenue license", null, "2027-02-12"), renewal("i", "Insurance", null, "2027-05-01"), renewal("e", "Emission test", null, "2027-03-05")],
      documents: [file("b", "CAB-1234_book_2014-02-13.pdf"), file("o", "CAB-1234_service-invoice_2026-05-01.pdf")],
    });
    expect(glanceGroups(all).map((g) => g.kind)).toEqual(["book", "license", "emission", "insurance", "other"]);
  });

  it("opens the current paper, and with none current the newest one on file", () => {
    const groups = tilesOf({
      renewals: [renewal("old", "Revenue license", null, "2026-01-31", { renewedAt: new Date("2026-01-30") })],
      documents: [
        file("b1", "CAB-1234_book_2010-01-01.pdf"),
        file("b2", "CAB-1234_book_2014-02-13.pdf"),
        file("o1", "CAB-1234_service-invoice_2026-05-01.pdf"),
        file("o2", "CAB-1234_warranty_2026-09-01.pdf"),
        file("i", "CAB-1234_insurance_2027-05-01.pdf"),
      ],
    });
    const target = (kind: string) => glanceTarget(groups.find((g) => g.kind === kind)!)?.key;
    expect(target("book")).toBe("d:b2");
    expect(target("other")).toBe("d:o2");
    expect(target("insurance")).toBe("d:i"); // only an upload: newest on file
    expect(target("license")).toBe("r:old"); // only an earlier one: the newest of those
    expect(target("emission")).toBeUndefined();

    const current = tilesOf({ renewals: [renewal("n", "Revenue license", null, "2027-02-12"), renewal("o", "Revenue license", null, "2026-02-12", { renewedAt: new Date("2026-02-01") })] });
    expect(glanceTarget(current.find((g) => g.kind === "license")!)?.key).toBe("r:n");
  });

  it("prefers a paper that has a file when the newest on file has none", () => {
    const groups = tilesOf({
      renewals: [renewal("a", "Insurance", null, "2025-12-31", { renewedAt: new Date("2025-12-30") }), renewal("b", "Insurance", null, "2026-06-30", { renewedAt: new Date("2026-06-29") })],
      renewalFiles: new Map([["a", [file("fa", "CAB-1234_insurance_2025-12-31.pdf")]]]),
    });
    expect(glanceTarget(groups.find((g) => g.kind === "insurance")!)?.key).toBe("r:a");
  });

  it("labels with real information only", () => {
    const groups = tilesOf({
      renewals: [renewal("l", "Revenue license", null, "2026-12-23"), renewal("e", "Emission test", null, "2026-11-20"), renewal("i", "Insurance", null, "2026-11-23")],
      documents: [file("b", "CAB-1234_book_2014-02-13.pdf"), file("o1", "CAB-1234_service-invoice_2026-05-01.pdf"), file("o2", "CAB-1234_warranty_2026-09-01.pdf")],
    });
    const label = (kind: string) => glanceLabel(groups.find((g) => g.kind === kind)!, TODAY);
    expect(label("license")).toEqual({ text: "30 days left", tone: "soon" });
    expect(label("emission")).toEqual({ text: "3 days late", tone: "overdue" });
    expect(label("insurance")).toEqual({ text: "Ends today", tone: "overdue" });
    expect(label("book")).toEqual({ text: "Feb 2014", tone: null });
    expect(label("other")).toEqual({ text: "2 papers", tone: null });
  });

  it("has no label for a book without a known date, and none for an empty category", () => {
    const groups = tilesOf({ documents: [file("b", "scan.pdf", { title: "Registration book" })] });
    expect(glanceLabel(groups.find((g) => g.kind === "book")!, TODAY)).toBeNull();
    expect(glanceLabel(groups.find((g) => g.kind === "license")!, TODAY)).toBeNull();
    expect(glanceLabel(tilesOf({ documents: [file("o", "scan.pdf", { title: "Warranty card" })] }).find((g) => g.kind === "other")!, TODAY)).toEqual({ text: "1 paper", tone: null });
  });

  it("says when the newest paper ends or ended for a kind with no current renewal", () => {
    const g = (iso: string) => tilesOf({ documents: [file("l", `CAB-1234_license_${iso}.pdf`)] }).find((x) => x.kind === "license")!;
    expect(glanceLabel(g("2027-02-12"), TODAY)).toEqual({ text: "Until Feb 2027", tone: null });
    expect(glanceLabel(g("2026-02-12"), TODAY)).toEqual({ text: "Ended Feb 2026", tone: null });
    const earlier = tilesOf({ renewals: [renewal("old", "Insurance", null, "2026-03-31", { renewedAt: new Date("2026-03-30") })] }).find((x) => x.kind === "insurance")!;
    expect(glanceLabel(earlier, TODAY)).toEqual({ text: "Ended Mar 2026", tone: null });
  });
});
