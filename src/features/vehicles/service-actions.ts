"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { vehicleServices, vehicles } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { parseService } from "./service-validate";
import { requireUser } from "@/lib/auth";

// Server Actions are public HTTP endpoints, so every input is validated here. A service's odometer is
// saved as written even when it doesn't fit the history: the timeline flags it instead (issue #181).

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["serviceDate", "serviceType", "garage", "odometerKm", "cost", "itemsDone", "nextDueDate"]) {
    const v = fd.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }
  const result = parseService(raw);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

export async function createService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "add" });
    const vehicleId = idFrom(fd, "vehicleId");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    const f = fieldsFrom(fd);
    await db.insert(vehicleServices).values({ vehicleId, ...f });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const id = idFrom(fd);
    const [existing] = await db.select().from(vehicleServices).where(eq(vehicleServices.id, id));
    if (!existing) throw new ValidationError("That service record could not be found.");
    const f = fieldsFrom(fd);
    await db.update(vehicleServices).set(f).where(eq(vehicleServices.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteService(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  await db.delete(vehicleServices).where(eq(vehicleServices.id, idFrom(fd)));
  refresh();
}
