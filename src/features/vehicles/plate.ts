/**
 * Sri Lankan number plates (S.6, C112; design board "Vehicles"). Pure.
 *
 * A registration is written like "CAB-1234", older ones with the province first ("WP CAB-1234"); new
 * registrations dropped the province. The plate is drawn from these parts, and the vehicle's address
 * uses the plate ("/vehicles/cab-1234") instead of its id when it has one (owner's item 26).
 */

const PROVINCES = new Set(["CP", "EP", "NC", "NP", "NW", "SG", "SP", "UP", "WP"]);

/** The province code (when the registration starts with one) and the rest, upper-cased. */
export function plateParts(registration: string): { province: string | null; main: string } {
  const text = registration.trim().replace(/\s+/g, " ").toUpperCase();
  const [first, ...rest] = text.split(" ");
  if (rest.length > 0 && PROVINCES.has(first)) return { province: first, main: rest.join(" ") };
  return { province: null, main: text };
}

/**
 * The pieces the government plate draws (C130): the province code, the series (two or three letters, or
 * an old numeric series) and the four digits, split at the dash. A registration that does not look like
 * that keeps its whole text as the series and no digits, so it is still drawn as typed.
 */
export function plateLayout(registration: string): { province: string | null; series: string; digits: string | null } {
  const { province, main } = plateParts(registration);
  const m = main.match(/^([A-Z]{1,3}|\d{1,3})\s*-?\s*(\d{1,4})$/);
  return m ? { province, series: m[1], digits: m[2] } : { province, series: main, digits: null };
}

/** Letters and digits only, upper-cased: two registrations are the same plate when these match. */
export function plateKey(registration: string): string {
  return registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The address form of a plate: lower case, spaces as dashes, nothing else ("wp-cab-1234"). */
export function plateSlug(registration: string): string {
  return registration
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A vehicle's page: by its plate when it has one, otherwise by its id. */
export function vehiclePath(vehicle: { id: string; registrationNumber: string | null }, rest = ""): string {
  const slug = vehicle.registrationNumber ? plateSlug(vehicle.registrationNumber) : "";
  return `/vehicles/${slug || vehicle.id}${rest}`;
}
