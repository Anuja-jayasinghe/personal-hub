/**
 * The vehicle page's two tabs and the old addresses that still arrive (V.3, C150).
 *
 * The page has an Overview and, for people who may see Vehicle documents, a Documents tab. It used to have two more,
 * Services and Renewals, and those addresses live on in sent emails, pushes, bookmarks and the owner's habits, so
 * they are accepted forever: `?tab=services` and `?tab=renewals` (with or without `kind` and `q`) land on the Overview,
 * scrolled to the Services card or to the renewal cards, and any other `?tab=` value lands on the Overview too.
 * Pure, so the whole table is testable; the page does the redirect.
 */

export type VehicleTab = "overview" | "documents";

export const VEHICLE_TABS: readonly { key: VehicleTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
];

/** The tabs this person gets: Documents only for people who may see Vehicle documents (S.8, C114). */
export function vehicleTabs(canSeeDocuments: boolean): readonly { key: VehicleTab; label: string }[] {
  return VEHICLE_TABS.filter((t) => t.key !== "documents" || canSeeDocuments);
}

/**
 * The tab next to `current` for a sideways swipe (issue #176, C156): "next" is the one after it, "prev" the one
 * before, null at either end or when the person has only one tab (no swipe at all then).
 */
export function neighbourTab(tabs: readonly { key: VehicleTab }[], current: VehicleTab, direction: "prev" | "next"): VehicleTab | null {
  if (tabs.length < 2) return null;
  const at = tabs.findIndex((t) => t.key === current);
  if (at < 0) return null;
  return tabs[direction === "next" ? at + 1 : at - 1]?.key ?? null;
}

/** The ids of the Overview's cards an old link points at: the Services card and the row of renewal cards. */
export const SERVICES_ANCHOR = "services";
export const RENEWALS_ANCHOR = "renewals";

/** What the old tab names scroll to; any other name scrolls nowhere. */
const OLD_ANCHORS: Readonly<Record<string, string>> = { services: SERVICES_ANCHOR, renewals: RENEWALS_ANCHOR };

export type TabLanding = {
  /** The tab to show. */
  tab: VehicleTab;
  /**
   * Set when the address should become a cleaner one: the query to keep (`item` only, for an old or unknown tab) and
   * the `#anchor` to scroll to. Null when the address is already right and nothing needs to move.
   */
  redirect: { params: Record<string, string>; hash: string } | null;
};

/**
 * Where an address lands. `tab` is the raw `?tab=` value, `item` the raw `?item=` (kept through every redirect, so a
 * sheet link keeps working); `q` and `kind` only mean something on Documents and are dropped when the old tab goes.
 */
export function landOnTab(input: { tab?: string; item?: string }, canSeeDocuments: boolean): TabLanding {
  const raw = (input.tab ?? "").trim().toLowerCase();
  if (raw === "" || raw === "overview") return { tab: "overview", redirect: null };
  if (raw === "documents" && canSeeDocuments) return { tab: "documents", redirect: null };
  // Everything else is on the Overview: the old Services and Renewals tabs, a person who may not see Documents,
  // and any value nobody ever used.
  return {
    tab: "overview",
    redirect: {
      params: typeof input.item === "string" && input.item !== "" ? { item: input.item } : {},
      hash: Object.hasOwn(OLD_ANCHORS, raw) ? `#${OLD_ANCHORS[raw]}` : "",
    },
  };
}

/**
 * The address to redirect to, or null when the one asked for is right. `canonical` is the vehicle's own address
 * (`/vehicles/cab-1234`), `wrongId` says the request used the id instead (S.6: old links by id move to the plate and
 * keep every part of the query), `query` is what arrived. An old or unknown tab gets the cleaner address of its landing.
 */
export function redirectAddress(input: { canonical: string; wrongId: boolean; query: { tab?: string; q?: string; kind?: string; item?: string }; landing: TabLanding }): string | null {
  const { canonical, wrongId, query, landing } = input;
  if (!wrongId && !landing.redirect) return null;
  const params = new URLSearchParams(
    landing.redirect ? landing.redirect.params : Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"),
  ).toString();
  return `${canonical}${params ? `?${params}` : ""}${landing.redirect?.hash ?? ""}`;
}
