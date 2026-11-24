"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { accessGrants, people } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/allowed-emails";
import { requireUser } from "@/lib/auth";
import { isArea, isLevel } from "./access";
import { parsePersonEmail, parsePersonName } from "./validate";

// Settings › People and roles (S.8, C114). Owner only; every input is validated here.

/** Adds someone by email, ready to use the hub once they sign in (they see nothing until given access). */
export async function addPerson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const parsed = parsePersonEmail(String(fd.get("email") ?? ""));
    if (!parsed.ok) throw new ValidationError(parsed.error);
    if (isAllowedEmail(parsed.email, parseAllowedEmails(process.env.ALLOWED_EMAILS))) throw new ValidationError("That address is an owner already.");
    const name = parsePersonName(String(fd.get("name") ?? ""));
    const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.email, parsed.email));
    if (existing) {
      await db.update(people).set({ status: "active", ...(name ? { name } : {}) }).where(eq(people.id, existing.id));
    } else {
      await db.insert(people).values({ email: parsed.email, name, status: "active" });
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/** Approve someone who is waiting, block someone, or let a blocked person back in. */
export async function setPersonStatus(fd: FormData): Promise<void> {
  await requireUser("owner");
  const status = String(fd.get("status") ?? "");
  if (status !== "active" && status !== "blocked") throw new ValidationError("Unknown status.");
  await db.update(people).set({ status }).where(eq(people.id, idFrom(fd)));
  refresh();
}

/**
 * Switches one person's notifications on or off (N.5, C144). Off, the daily run skips them; the setting
 * is the owner's, so a person cannot change it, and it does not touch their devices or their access.
 */
export async function setPersonNotifications(fd: FormData): Promise<void> {
  await requireUser("owner");
  const enabled = String(fd.get("enabled") ?? "");
  if (enabled !== "true" && enabled !== "false") throw new ValidationError("Choose on or off.");
  await db.update(people).set({ notificationsEnabled: enabled === "true" }).where(eq(people.id, idFrom(fd)));
  refresh();
}

/** Removes a person and their access. If they sign in again they come back as waiting. */
export async function removePerson(fd: FormData): Promise<void> {
  await requireUser("owner");
  await db.delete(people).where(eq(people.id, idFrom(fd)));
  refresh();
}

/** Sets one section's level for a person; "hidden" removes the grant. */
export async function setAccess(fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const personId = idFrom(fd, "personId");
    const area = String(fd.get("area") ?? "");
    const level = String(fd.get("level") ?? "");
    if (!isArea(area)) throw new ValidationError("Unknown section.");
    if (level === "hidden") {
      await db.delete(accessGrants).where(and(eq(accessGrants.personId, personId), eq(accessGrants.area, area)));
    } else if (isLevel(level)) {
      await db
        .insert(accessGrants)
        .values({ personId, area, level })
        .onConflictDoUpdate({ target: [accessGrants.personId, accessGrants.area], set: { level, updatedAt: new Date() } });
    } else {
      throw new ValidationError("Unknown level.");
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
