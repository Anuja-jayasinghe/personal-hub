/**
 * Where each electricity thing is handled (S.2a, C106: one home per action). Bills are paid and edited
 * on the Bills page; meters are set up in Settings.
 */

/** A bill's row on the Bills page. */
export function electricityBillHref(billId: string): string {
  return `/bills#electricity-bill-${billId}`;
}

/** The meters and rules page in Settings. */
export const METERS_SETTINGS_HREF = "/settings/meters";
