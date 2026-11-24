import "server-only";
import { readDb } from "@/db/read";
import { loadRules } from "@/features/settings/queries";
import { dueServices, isOilChangeType } from "@/features/vehicles/service-logic";
import { listServicesOfActiveVehicles } from "@/features/vehicles/queries";
import type { ReminderSource } from "../engine";
import { serviceNoticeWord } from "../notice-words";

/**
 * Next service due dates (Phase 1.2). For each active vehicle and service type, the latest
 * record decides: if it has a next due date it reminds; a newer record without one cancels the
 * older reminder. Archived vehicles send nothing (DECISIONS C48). Date only, never by distance (C24).
 */
export const vehicleServicesSource: ReminderSource = {
  key: "vehicle-services",
  label: "Vehicle services",
  async load(from) {
    const db = from?.db ?? (await readDb());
    const rows = await listServicesOfActiveVehicles(db);
    // The oil-change types are one cycle (V.1b): the newest of them decides the marker.
    const { oilChangeTypes } = await loadRules(db);
    const nicknames = new Map(rows.map((r) => [r.vehicleId, r.nickname]));
    return dueServices(rows, oilChangeTypes).map((r) => ({
      id: `service:${r.id}`,
      // The date of a service of an oil-change type is the oil-change marker (V.1a): Home and Reminders call it that,
      // as the vehicle page does ("Oil change by 12 Dec"), whether it was an oil change or a full service.
      title: `${isOilChangeType(r.serviceType, { oilChangeTypes }) ? "Oil change" : r.serviceType} · ${nicknames.get(r.vehicleId) ?? "Vehicle"}`,
      dueDate: r.nextDueDate,
      href: `/vehicles/${r.vehicleId}?item=service:${r.id}`, // opens the record's detail sheet (V.2)
      kind: "service",
      ownerId: r.vehicleId,
      // The type is free text: only the fixed list reaches a notification, anything else says "Service".
      notice: { what: serviceNoticeWord(r.serviceType), who: nicknames.get(r.vehicleId) ?? "Vehicle" },
    }));
  },
};
