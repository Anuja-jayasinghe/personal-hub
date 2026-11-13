import { describe, expect, it } from "vitest";
import { currentRenewals, splitCurrentAndPast, type RenewalRow } from "./renewal-logic";

let n = 0;
function ren(over: Partial<RenewalRow> & Pick<RenewalRow, "expiryDate">): RenewalRow {
  n++;
  return { id: `r${n}`, vehicleId: "v1", type: "Insurance", renewedAt: null, createdAt: new Date(2026, 0, 1, 0, 0, n), ...over };
}
const renewed = new Date(2026, 5, 1);

describe("currentRenewals", () => {
  it("the not-renewed record with the latest expiry is current", () => {
    const old = ren({ expiryDate: "2026-03-01", renewedAt: renewed });
    const now = ren({ expiryDate: "2027-03-01" });
    expect(currentRenewals([old, now]).map((r) => r.id)).toEqual([now.id]);
  });

  it("a renewed record is never current, even if it is the only one", () => {
    expect(currentRenewals([ren({ expiryDate: "2026-03-01", renewedAt: renewed })])).toEqual([]);
  });

  it("with two not-renewed records of a type the later expiry wins", () => {
    const a = ren({ expiryDate: "2026-12-01" });
    const b = ren({ expiryDate: "2027-12-01" });
    expect(currentRenewals([a, b]).map((r) => r.id)).toEqual([b.id]);
    expect(currentRenewals([b, a]).map((r) => r.id)).toEqual([b.id]);
  });

  it("on the same expiry the record entered last wins", () => {
    const a = ren({ expiryDate: "2026-12-01" });
    const b = ren({ expiryDate: "2026-12-01" });
    expect(currentRenewals([a, b])[0].id).toBe(b.id);
    expect(currentRenewals([b, a])[0].id).toBe(b.id);
  });

  it("each vehicle and type has its own current record; type compares ignoring case", () => {
    const ins = ren({ type: "Insurance", expiryDate: "2027-01-01" });
    const lic = ren({ type: "Revenue license", expiryDate: "2026-12-01" });
    const otherCar = ren({ vehicleId: "v2", type: "Insurance", expiryDate: "2026-06-01" });
    const insAgain = ren({ type: " insurance ", expiryDate: "2027-06-01" });
    const ids = currentRenewals([ins, lic, otherCar, insAgain]).map((r) => r.id).sort();
    expect(ids).toEqual([lic.id, otherCar.id, insAgain.id].sort());
  });
});

describe("splitCurrentAndPast", () => {
  it("lists current soonest-first and past newest-first", () => {
    const old1 = ren({ expiryDate: "2025-03-01", renewedAt: renewed });
    const old2 = ren({ expiryDate: "2026-03-01", renewedAt: renewed });
    const ins = ren({ type: "Insurance", expiryDate: "2027-03-01" });
    const lic = ren({ type: "Revenue license", expiryDate: "2026-12-01" });
    const { current, past } = splitCurrentAndPast([old1, ins, old2, lic]);
    expect(current.map((r) => r.id)).toEqual([lic.id, ins.id]);
    expect(past.map((r) => r.id)).toEqual([old2.id, old1.id]);
  });
});
