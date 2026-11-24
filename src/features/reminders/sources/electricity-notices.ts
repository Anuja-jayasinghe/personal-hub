import "server-only";
import { electricityEvents } from "@/features/electricity/notices";
import { listAllBills, listAllReadings, listMeters } from "@/features/electricity/queries";
import { getRules, loadRules } from "@/features/settings/queries";
import { todayInAppTz } from "@/lib/format";
import type { NoticeSource } from "../engine";

/**
 * Meters near or over their slab limit, and meter readings overdue (Notifications N.4, C142). Events,
 * not due dates: they are never shown on the Reminders page or Home, only read by the notification
 * planner (see `noticeSources`). The daily run passes the real database and the day; a page's own
 * preview passes nothing and reads through `readDb()`. Archived meters are left out.
 */
export const electricityNoticesSource: NoticeSource = {
  key: "electricity-notices",
  label: "Electricity limits and readings",
  async load(from) {
    const [meters, readings, bills, rules] = await Promise.all([
      listMeters(false, from?.db),
      listAllReadings(from?.db),
      listAllBills(from?.db),
      from ? loadRules(from.db) : getRules(),
    ]);
    return electricityEvents({ meters, readings, bills, rules, today: from?.today ?? todayInAppTz() });
  },
};
