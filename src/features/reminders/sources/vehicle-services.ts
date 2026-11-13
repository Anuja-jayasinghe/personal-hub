import "server-only";
import { dueServices } from "@/features/vehicles/service-logic";
import { listServicesOfActiveVehicles } from "@/features/vehicles/queries";
import type { ReminderSource } from "../engine";

/**
 * Next service due dates (Phase 1.2). For each active vehicle and service type, the latest
 * record decides: if it has a next due date it reminds; a newer record without one cancels the
 * older reminder. Archived vehicles send nothing (DECISIONS C48). Date only, never by distance (C24).
 */
export const vehicleServicesSource: ReminderSource = {
  key: "vehicle-services",
  label: "Vehicle services",
  async load() {
    const rows = await listServicesOfActiveVehicles();
    const nicknames = new Map(rows.map((r) => [r.vehicleId, r.nickname]));
    return dueServices(rows).map((r) => ({
      id: `service:${r.id}`,
      title: `${r.serviceType} · ${nicknames.get(r.vehicleId) ?? "Vehicle"}`,
      dueDate: r.nextDueDate,
      href: `/vehicles/${r.vehicleId}?tab=services`,
      kind: "service",
    }));
  },
};
