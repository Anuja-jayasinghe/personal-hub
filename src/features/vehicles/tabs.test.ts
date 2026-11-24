import { describe, expect, it } from "vitest";
import { accessFromGrants, allows } from "@/features/people/access";
import { landOnTab, neighbourTab, redirectAddress, RENEWALS_ANCHOR, SERVICES_ANCHOR, vehicleTabs } from "./tabs";

// Made-up ids only (public repo).
const ITEM = "renewal:11111111-2222-3333-4444-555555555555";

const grants = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));

describe("the two tabs", () => {
  it("are Overview and Documents, in that order", () => {
    expect(vehicleTabs(true).map((t) => t.key)).toEqual(["overview", "documents"]);
    expect(vehicleTabs(true).map((t) => t.label)).toEqual(["Overview", "Documents"]);
  });

  it("show Documents only to a person who may see Vehicle documents", () => {
    const canSee = (a: ReturnType<typeof grants> | { owner: true }) => vehicleTabs(allows(a, "vehicle_documents", "see")).map((t) => t.key);
    expect(canSee({ owner: true })).toEqual(["overview", "documents"]);
    expect(canSee(grants(["vehicles", "see"], ["vehicle_documents", "see"]))).toEqual(["overview", "documents"]);
    expect(canSee(grants(["vehicles", "see"], ["vehicle_documents", "add"]))).toEqual(["overview", "documents"]);
    expect(canSee(grants(["vehicles", "edit"]))).toEqual(["overview"]);
    expect(canSee(grants(["vehicles", "see"], ["tasks_notes", "edit"]))).toEqual(["overview"]);
  });
});

describe("old and odd addresses (every ?tab= value, C150)", () => {
  // [raw tab, who may see Documents, where it lands, the hash to scroll to]
  const table: [string | undefined, boolean, "overview" | "documents", string | null][] = [
    [undefined, true, "overview", null],
    ["", true, "overview", null],
    ["overview", true, "overview", null],
    ["Overview", false, "overview", null],
    ["documents", true, "documents", null],
    [" Documents ", true, "documents", null],
    ["documents", false, "overview", ""],
    ["services", true, "overview", `#${SERVICES_ANCHOR}`],
    ["services", false, "overview", `#${SERVICES_ANCHOR}`],
    ["Services", true, "overview", `#${SERVICES_ANCHOR}`],
    ["renewals", true, "overview", `#${RENEWALS_ANCHOR}`],
    ["renewals", false, "overview", `#${RENEWALS_ANCHOR}`],
    ["RENEWALS", true, "overview", `#${RENEWALS_ANCHOR}`],
    ["notes", true, "overview", ""],
    ["servicess", true, "overview", ""],
    ["constructor", true, "overview", ""],
    ["__proto__", true, "overview", ""],
    ["../../etc", true, "overview", ""],
  ];
  for (const [tab, canSee, lands, hash] of table) {
    it(`?tab=${JSON.stringify(tab)} (Documents ${canSee ? "visible" : "hidden"}) lands on the ${lands}${hash ? ` at ${hash}` : ""}`, () => {
      const landing = landOnTab({ tab }, canSee);
      expect(landing.tab).toBe(lands);
      if (hash === null) expect(landing.redirect).toBeNull();
      else expect(landing.redirect).toEqual({ params: {}, hash });
    });
  }

  it("never lands on a tab the person does not have", () => {
    for (const tab of [undefined, "overview", "documents", "services", "renewals", "x"]) {
      expect(vehicleTabs(false).map((t) => t.key)).toContain(landOnTab({ tab }, false).tab);
    }
  });

  it("keeps the open record's sheet through an old address, and drops the search and category that only Documents knew", () => {
    // ?tab=renewals&kind=insurance&q=policy&item=... : kind and q are not passed in at all, only the item survives.
    expect(landOnTab({ tab: "renewals", item: ITEM }, true)).toEqual({ tab: "overview", redirect: { params: { item: ITEM }, hash: `#${RENEWALS_ANCHOR}` } });
    expect(landOnTab({ tab: "services", item: "service:abc" }, true).redirect?.params).toEqual({ item: "service:abc" });
    expect(landOnTab({ tab: "nonsense", item: ITEM }, true).redirect?.params).toEqual({ item: ITEM });
    expect(landOnTab({ tab: "renewals", item: "" }, true).redirect?.params).toEqual({});
  });

  it("leaves the Overview and Documents addresses alone, so a sheet link keeps its own address", () => {
    expect(landOnTab({ item: ITEM }, true).redirect).toBeNull();
    expect(landOnTab({ tab: "documents", item: ITEM }, true).redirect).toBeNull();
  });
});

describe("the address an old link moves to (redirectAddress)", () => {
  const canonical = "/vehicles/cab-1234";
  const go = (query: { tab?: string; q?: string; kind?: string; item?: string }, wrongId = false, canSee = true) => redirectAddress({ canonical, wrongId, query, landing: landOnTab(query, canSee) });

  it("sends every old combination to the Overview of the plate address", () => {
    expect(go({ tab: "services" })).toBe("/vehicles/cab-1234#services");
    expect(go({ tab: "renewals" })).toBe("/vehicles/cab-1234#renewals");
    expect(go({ tab: "renewals", kind: "insurance" })).toBe("/vehicles/cab-1234#renewals");
    expect(go({ tab: "renewals", q: "policy" })).toBe("/vehicles/cab-1234#renewals");
    expect(go({ tab: "renewals", kind: "license", q: "x y" })).toBe("/vehicles/cab-1234#renewals");
    expect(go({ tab: "services", q: "oil", kind: "x" })).toBe("/vehicles/cab-1234#services");
    expect(go({ tab: "nonsense", q: "a", kind: "b" })).toBe("/vehicles/cab-1234");
  });

  it("works through the id-to-plate move too, in one hop, keeping the sheet", () => {
    expect(go({ tab: "renewals", item: ITEM }, true)).toBe(`/vehicles/cab-1234?item=${encodeURIComponent(ITEM)}#renewals`);
    expect(go({ tab: "services" }, true)).toBe("/vehicles/cab-1234#services");
  });

  it("still keeps the whole query when only the id is old (Documents, Overview)", () => {
    expect(go({ tab: "documents", kind: "insurance", q: "a b" }, true)).toBe("/vehicles/cab-1234?tab=documents&kind=insurance&q=a+b");
    expect(go({ item: ITEM }, true)).toBe(`/vehicles/cab-1234?item=${encodeURIComponent(ITEM)}`);
    expect(go({}, true)).toBe("/vehicles/cab-1234");
  });

  it("does not move a good address", () => {
    expect(go({})).toBeNull();
    expect(go({ tab: "overview", item: ITEM })).toBeNull();
    expect(go({ tab: "documents", kind: "book", q: "z" })).toBeNull();
  });

  it("moves a person who may not see Documents off ?tab=documents, to the Overview", () => {
    expect(go({ tab: "documents", kind: "book", q: "z" }, false, false)).toBe("/vehicles/cab-1234");
  });
});

describe("the neighbour of a tab, for a sideways swipe (issue #176)", () => {
  const both = vehicleTabs(true);
  const only = vehicleTabs(false);

  it("goes from Overview to Documents on next, and back on prev", () => {
    expect(neighbourTab(both, "overview", "next")).toBe("documents");
    expect(neighbourTab(both, "documents", "prev")).toBe("overview");
  });
  it("stops at either end", () => {
    expect(neighbourTab(both, "overview", "prev")).toBeNull();
    expect(neighbourTab(both, "documents", "next")).toBeNull();
  });
  it("has no neighbour for a person who has only the Overview", () => {
    expect(neighbourTab(only, "overview", "next")).toBeNull();
    expect(neighbourTab(only, "overview", "prev")).toBeNull();
  });
  it("has none for a tab that is not in the list", () => {
    expect(neighbourTab(only, "documents", "prev")).toBeNull();
  });
});
