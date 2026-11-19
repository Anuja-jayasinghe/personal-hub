"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { cleanLeadDays, mergeRules, parseSlabRules, RULES_KEY, type HubRules } from "./rules";

// Server Actions are public HTTP endpoints, so every input is validated here (S.2b, C107).

async function savedRules(): Promise<HubRules> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, RULES_KEY));
  return mergeRules(row?.value ?? null);
}

async function store(rules: HubRules) {
  await db
    .insert(appSettings)
    .values({ key: RULES_KEY, value: rules })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: rules, updatedAt: new Date() } });
}

/** Saves the slab rule, the meter-check interval and the billing cycle. */
export async function saveSlabRules(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const keys = ["lowUnits", "highUnits", "nearUnits", "checkEveryDays", "billingCycleDays"];
    const parsed = parseSlabRules(Object.fromEntries(keys.map((k) => [k, fd.get(k)])));
    if (!parsed.ok) throw new ValidationError(parsed.error);
    await store({ ...(await savedRules()), ...parsed.value });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/** Saves which days before a due date reminders start. */
export async function saveReminderDays(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const leadDays = cleanLeadDays(fd.getAll("leadDays"));
    if (leadDays.length === 0) throw new ValidationError("Pick at least one day.");
    await store({ ...(await savedRules()), leadDays });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
