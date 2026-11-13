import { describe, expect, it } from "vitest";
import { orderByDependencies } from "./backup-core.mjs";

describe("orderByDependencies", () => {
  it("is alphabetical when there are no foreign keys", () => {
    expect(orderByDependencies(["tasks", "notes", "attachments"], [])).toEqual(["attachments", "notes", "tasks"]);
  });

  it("puts parents before children even when the child sorts first alphabetically", () => {
    // "attachments" references "vehicles", so vehicles must come first although "a" < "v".
    const order = orderByDependencies(["attachments", "vehicles", "notes"], [{ child: "attachments", parent: "vehicles" }]);
    expect(order.indexOf("vehicles")).toBeLessThan(order.indexOf("attachments"));
    expect(order).toEqual(["notes", "vehicles", "attachments"]);
  });

  it("handles a chain and a table with two parents", () => {
    const order = orderByDependencies(
      ["c", "b", "a", "d"],
      [
        { child: "b", parent: "a" },
        { child: "c", parent: "b" },
        { child: "d", parent: "a" },
        { child: "d", parent: "c" },
      ],
    );
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores references to tables outside the list", () => {
    expect(orderByDependencies(["a", "b"], [{ child: "a", parent: "auth_users" }])).toEqual(["a", "b"]);
  });

  it("refuses a loop instead of guessing", () => {
    expect(() =>
      orderByDependencies(["a", "b"], [{ child: "a", parent: "b" }, { child: "b", parent: "a" }]),
    ).toThrow(/loop between: a, b/);
  });
});
