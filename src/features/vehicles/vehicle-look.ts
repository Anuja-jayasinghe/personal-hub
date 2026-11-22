/**
 * Which drawing stands in for a vehicle that has no cover photo (issue #172): the vehicle's type picks
 * the family (a car-like type gets the sedan, a scooter the scooter, a motorbike a bike), and for bikes
 * the make and model pick the kind, because a superbike, a supermoto and a commuter look nothing alike.
 * Some models also pick their own paint, where the model is known by it (the R1M is always carbon and
 * silver). Pure, so it is testable; the drawings are in src/components/vehicles/.
 */

export type BikeKind = "superbike" | "supermoto" | "commuter";
export type BikePaint = "graphite" | "carbon" | "motorsport" | "black" | "red";

export type VehicleLook =
  | { family: "car" }
  | { family: "bike"; kind: BikeKind; paint: BikePaint }
  | { family: "scooter"; paint: BikePaint }
  | { family: "icon" };

type LookInput = { vehicleType?: string | null; make?: string | null; model?: string | null };

/** Vehicle types drawn as the sedan. */
export const CAR_LIKE_TYPES: ReadonlySet<string> = new Set(["car", "suv", "van", "pickup", "other"]);

// Model names, matched as whole words in "make model" (any case).
const SUPERBIKE = /\b(s\s?1000\s?rr|m\s?1000\s?rr|hp4|yzf[\s-]?r\s?1m?|r1m?|r6|cbr\s?\d{3,4}\s?rr?|fireblade|ninja\s?zx[\s-]?\d+r?|zx[\s-]?\d+r|gsx[\s-]?r\s?\d*|panigale|rsv4|tuono|rc\s?8|f4)\b/i;
const SUPERMOTO = /\b(dorsoduro|shiver|hypermotard|smc|690\s?smc|duke|monster|street\s?triple|speed\s?triple|mt[\s-]?\d{2}|z\s?\d{3,4}|s\s?1000\s?r|xsr|scrambler|supermoto)\b/i;
const SCOOTER = /\b(dio|activa|vespa|nmax|xmax|aerox|ntorq|jupiter|pleasure|maestro|scoopy|click|ray\s?zr|fascino|access|burgman|pcx|adv)\b/i;

/** The drawing for a vehicle: decided by type first, then make and model. */
export function vehicleLook({ vehicleType, make, model }: LookInput): VehicleLook {
  const type = vehicleType ?? "car";
  const name = [make, model].filter(Boolean).join(" ");
  if (CAR_LIKE_TYPES.has(type)) return { family: "car" };
  // A scooter saved as a motorbike (a Dio, an Activa) still gets the scooter.
  if (type === "scooter" || (type === "motorbike" && SCOOTER.test(name))) return { family: "scooter", paint: "graphite" };
  if (type !== "motorbike") return { family: "icon" };
  // The superbike list needs "RR", so BMW's naked S 1000 R falls through to the supermoto list.
  if (SUPERBIKE.test(name)) return { family: "bike", kind: "superbike", paint: superbikePaint(name) };
  if (SUPERMOTO.test(name)) return { family: "bike", kind: "supermoto", paint: "graphite" };
  return { family: "bike", kind: "commuter", paint: "graphite" };
}

/** Superbikes known by their colours: the R1M (carbon and silver), BMW's RR (Motorsport white, blue, red). */
function superbikePaint(name: string): BikePaint {
  if (/\br\s?1\s?m\b|r1m/i.test(name)) return "carbon";
  if (/\b(s|m)\s?1000\s?rr\b|\bhp4\b/i.test(name)) return "motorsport";
  return "graphite";
}
