import { describe, expect, it } from "vitest";
import { appConfig, enabledModules, publicModules } from "@/config/app.config";
import { morePageItems, phoneBarItems, railItems } from "@/components/shell/nav";
import { OWNER_TYPES } from "@/lib/owners";
import { AREAS, accessFromGrants, isOwnerOnlyOwner, navItemVisible, needOfFile, needOfOwner, sharedVisible, type Access } from "./access";

/**
 * Cheques are owners only (issue #178, DECISIONS C158): money, so no access section covers them and nothing
 * about them can be reached through a section someone does have. A person with EVERY grant at Edit is the
 * strongest non-owner there can be.
 */
const everything: Access = accessFromGrants(AREAS.map((a) => ({ area: a.key, level: "edit" })));
const owner: Access = { owner: true };
const demo: Access = { owner: false, grants: Object.fromEntries(AREAS.map((a) => [a.key, "see"])) };

describe("the cheque owner type", () => {
  it("is known to the hub and marked owner-only", () => {
    expect(OWNER_TYPES).toContain("cheque");
    expect(isOwnerOnlyOwner("cheque")).toBe(true);
    for (const t of OWNER_TYPES.filter((t) => t !== "cheque")) expect(isOwnerOnlyOwner(t)).toBe(false);
    expect(isOwnerOnlyOwner(null)).toBe(false);
  });

  it("a file or a task or note on a cheque needs the owner, whatever else a person may do", () => {
    for (const level of ["see", "add", "edit"] as const) {
      expect(needOfFile("cheque", level)).toBe("owner");
      expect(needOfOwner("cheque", level)).toBe("owner");
    }
    // Other owner types still map to their section, as before.
    expect(needOfFile("vehicle_service", "add")).toEqual({ area: "vehicle_documents", level: "add" });
    expect(needOfOwner("bill_item", "edit")).toEqual({ area: "bills", level: "edit" });
  });

  it("a task or note attached to a cheque is visible to the owner only", () => {
    expect(sharedVisible(owner, "cheque")).toBe(true);
    expect(sharedVisible(everything, "cheque")).toBe(false);
    expect(sharedVisible(everything, "cheque", "add")).toBe(false);
    expect(sharedVisible(demo, "cheque")).toBe(false);
    expect(sharedVisible(everything, "bill_item")).toBe(true); // others unchanged
  });
});

describe("the Cheques module", () => {
  it("is registered, owner-only, and absent from the 404 page's links", () => {
    const m = appConfig.modules.find((x) => x.key === "cheques");
    expect(m).toMatchObject({ href: "/cheques", enabled: true, ownerOnly: true });
    expect(enabledModules.map((x) => x.key)).toContain("cheques");
    expect(publicModules.map((x) => x.key)).not.toContain("cheques");
    expect(publicModules.map((x) => x.key)).toEqual(expect.arrayContaining(["vehicles", "electricity", "bills"]));
  });

  it("shows in the rail and on More for the owner, never for a shared person, the demo or a signed-out visitor", () => {
    expect(navItemVisible(owner, "cheques")).toBe(true);
    expect(navItemVisible(everything, "cheques")).toBe(false);
    expect(navItemVisible(demo, "cheques")).toBe(false);
    expect(navItemVisible({ owner: false, grants: {} }, "cheques")).toBe(false);
    expect(railItems().map((i) => i.key)).toContain("cheques");
    expect(morePageItems().map((i) => i.key)).toContain("cheques");
    for (const a of [everything, demo]) {
      expect(railItems().filter((i) => navItemVisible(a, i.key)).map((i) => i.key)).not.toContain("cheques");
      expect(morePageItems().filter((i) => navItemVisible(a, i.key)).map((i) => i.key)).not.toContain("cheques");
    }
  });

  it("has no tab in the phone bar, which stays at five tabs", () => {
    expect(phoneBarItems().map((i) => i.key)).toEqual(["home", "vehicles", "electricity", "bills", "more"]);
  });

  it("is not an access area: there is nothing to grant", () => {
    expect(AREAS.map((a) => a.key)).not.toContain("cheques");
  });
});
