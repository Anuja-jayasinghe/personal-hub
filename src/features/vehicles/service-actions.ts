"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { vehicleServices, vehicles } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { parseService } from "./service-validate";

// Server Actions are public HTTP endpoints, so every input is validated here.

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
    const vehicleId = idFrom(fd, "vehicleId");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    await db.insert(vehicleServices).values({ vehicleId, ...fieldsFrom(fd) });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await db.update(vehicleServices).set(fieldsFrom(fd)).where(eq(vehicleServices.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteService(fd: FormData): Promise<void> {
  await db.delete(vehicleServices).where(eq(vehicleServices.id, idFrom(fd)));
  refresh();
}
