"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { vehicleOdometerReadings, vehicles } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { todayInAppTz } from "@/lib/format";
import { checkFits } from "./odometer";
import { parseOdometerReading } from "./odometer-validate";
import { loadOdometerPoints } from "./odometer-points";
import { requireUser } from "@/lib/auth";

// Server Actions are public HTTP endpoints, so every input is validated here.

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["readingDate", "km", "note"]) {
    const v = fd.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }
  const result = parseOdometerReading(raw, todayInAppTz());
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

export async function addOdometerReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "add" });
    const vehicleId = idFrom(fd, "vehicleId");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    const f = fieldsFrom(fd);
    const fit = checkFits(await loadOdometerPoints(vehicleId), { date: f.readingDate, km: f.km });
    if (!fit.ok) throw new ValidationError(fit.error);
    await db.insert(vehicleOdometerReadings).values({ vehicleId, ...f });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateOdometerReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const id = idFrom(fd);
    const [existing] = await db.select().from(vehicleOdometerReadings).where(eq(vehicleOdometerReadings.id, id));
    if (!existing) throw new ValidationError("That reading could not be found.");
    const f = fieldsFrom(fd);
    const fit = checkFits(await loadOdometerPoints(existing.vehicleId, { readingId: id }), { date: f.readingDate, km: f.km });
    if (!fit.ok) throw new ValidationError(fit.error);
    await db.update(vehicleOdometerReadings).set(f).where(eq(vehicleOdometerReadings.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteOdometerReading(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  await db.delete(vehicleOdometerReadings).where(eq(vehicleOdometerReadings.id, idFrom(fd)));
  refresh();
}
