import { describe, expect, it } from "vitest";
import { currentRenewals, placeRenewal, renewedMoment, splitCurrentAndPast, type PlacedRow, type RenewalRow } from "./renewal-logic";

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

describe("placeRenewal (V.1b, C148)", () => {
  let k = 0;
  const row = (over: Partial<PlacedRow> & Pick<PlacedRow, "expiryDate">): PlacedRow => {
    k++;
    return { id: `p${k}`, type: "Revenue license", startDate: null, renewedAt: null, createdAt: new Date(2026, 0, 1, 0, 0, k), ...over };
  };
  const incoming = (over: Partial<{ type: string; startDate: string | null; expiryDate: string }> = {}) => ({ type: "Revenue license", startDate: "2027-03-03", expiryDate: "2028-03-02", ...over });

  it("with nothing saved the new record is simply current and nothing is renewed", () => {
    expect(placeRenewal([], incoming())).toEqual({ kind: "current", renew: [], renewedOn: "2027-03-03" });
  });

  it("a later record becomes current and the unrenewed one before it is renewed from the new start", () => {
    const old = row({ expiryDate: "2027-03-02" });
    expect(placeRenewal([old], incoming())).toEqual({ kind: "current", renew: [old], renewedOn: "2027-03-03" });
  });

  it("only unrenewed records are renewed; renewed ones stay as they are", () => {
    const history = row({ expiryDate: "2026-03-02", renewedAt: new Date(2026, 2, 3) });
    const old = row({ expiryDate: "2027-03-02" });
    const placement = placeRenewal([history, old], incoming());
    expect(placement).toMatchObject({ kind: "current", renew: [old] });
  });

  it("a record of another type is never touched", () => {
    const insurance = row({ type: "Insurance", expiryDate: "2027-03-02" });
    const license = row({ expiryDate: "2027-03-02" });
    expect(placeRenewal([insurance, license], incoming())).toMatchObject({ kind: "current", renew: [license] });
    expect(placeRenewal([insurance], incoming())).toMatchObject({ kind: "current", renew: [] });
  });

  it("matches the type ignoring case and spacing", () => {
    const old = row({ type: "  revenue   LICENSE", expiryDate: "2027-03-02" });
    expect(placeRenewal([old], incoming())).toMatchObject({ kind: "current", renew: [old] });
  });

  it("with no start date on the new record, the old one is renewed 'now' (the existing behaviour of Renew)", () => {
    const old = row({ expiryDate: "2027-03-02" });
    const placement = placeRenewal([old], incoming({ startDate: null }));
    expect(placement).toEqual({ kind: "current", renew: [old], renewedOn: null });
    const now = new Date("2026-11-24T05:00:00Z");
    expect(renewedMoment(null, now)).toBe(now);
  });

  it("an older paper is history: stored renewed, from the start of the next later record of its type", () => {
    const nearest = row({ expiryDate: "2026-03-02", startDate: "2025-03-03" });
    const newest = row({ expiryDate: "2027-03-02", startDate: "2026-03-03" });
    expect(placeRenewal([newest, nearest], incoming({ startDate: "2024-03-03", expiryDate: "2025-03-02" }))).toEqual({ kind: "history", renewedOn: "2025-03-03" });
  });

  it("history uses the next later record even when that one is already renewed, and 'now' when it has no start", () => {
    const later = row({ expiryDate: "2026-03-02", startDate: "2025-03-03", renewedAt: new Date(2026, 2, 3) });
    expect(placeRenewal([later], incoming({ expiryDate: "2025-03-02" }))).toEqual({ kind: "history", renewedOn: "2025-03-03" });
    const noStart = row({ expiryDate: "2026-03-02", startDate: null });
    expect(placeRenewal([noStart], incoming({ expiryDate: "2025-03-02" }))).toEqual({ kind: "history", renewedOn: null });
  });

  it("history ignores a later record of another type", () => {
    const other = row({ type: "Insurance", expiryDate: "2026-03-02", startDate: "2025-03-03" });
    expect(placeRenewal([other], incoming({ expiryDate: "2025-03-02" })).kind).toBe("current");
  });

  it("a record ending the same day is a twin, whether or not it was renewed", () => {
    const twin = row({ expiryDate: "2028-03-02", renewedAt: new Date(2026, 2, 3) });
    expect(placeRenewal([twin, row({ expiryDate: "2027-03-02" })], incoming())).toEqual({ kind: "twin", twins: [twin] });
  });

  it("marks renewed at 09:00 UTC on the day, which is the same calendar day in Colombo", () => {
    expect(renewedMoment("2027-03-03").toISOString()).toBe("2027-03-03T09:00:00.000Z");
  });
});
