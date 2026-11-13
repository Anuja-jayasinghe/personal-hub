import "server-only";
import { appConfig } from "@/config/app.config";
import { currentRenewals } from "@/features/vehicles/renewal-logic";
import { listRenewalsOfActiveVehicles } from "@/features/vehicles/queries";
import type { ReminderSource } from "../engine";

/**
 * Expiring renewals (Phase 1.3): revenue license, insurance, emission test. Only the CURRENT
 * renewal of each vehicle and type reminds (not renewed, latest expiry: DECISIONS C46), and
 * archived vehicles send nothing (C48). A type can warn earlier than the app-wide lead times by
 * setting `leadDays` for it in app.config.ts.
 */
export const vehicleRenewalsSource: ReminderSource = {
  key: "vehicle-renewals",
  label: "Vehicle renewals",
  async load() {
    const rows = await listRenewalsOfActiveVehicles();
    const nicknames = new Map(rows.map((r) => [r.vehicleId, r.nickname]));
    const leadsByType = new Map(appConfig.vehicles.renewalTypes.map((t) => [t.label, t.leadDays]));
    return currentRenewals(rows).map((r) => ({
      id: `renewal:${r.id}`,
      title: `${r.type} · ${nicknames.get(r.vehicleId) ?? "Vehicle"}`,
      dueDate: r.expiryDate,
      href: `/vehicles/${r.vehicleId}?tab=renewals`,
      kind: "renewal",
      leadDays: leadsByType.get(r.type),
    }));
  },
};
