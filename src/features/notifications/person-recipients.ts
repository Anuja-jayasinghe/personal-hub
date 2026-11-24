import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/read";
import { accessGrants, people, pushSubscriptions } from "@/db/schema";
import { personRecipient, type PersonRow, type Recipient } from "./recipients";

/**
 * The shared people the daily run writes to (Notifications N.5, DECISIONS C144), from the database it
 * is given (the run's explicit real handle, never `readDb()`). Who qualifies, all of it:
 *  - status `active` (never pending, never blocked);
 *  - the owner has not switched their notifications off (`people.notifications_enabled`);
 *  - at least one live push subscription (a device not marked gone);
 *  - not an owner's address (owners are recipients already).
 * Their access is built from their grants at this moment, so a grant the owner revoked, or a person the
 * owner blocked, stops getting notices at the very next run.
 */
export async function loadPersonRecipients(db: Db, ownerEmails: ReadonlySet<string>): Promise<Recipient[]> {
  const active = await db
    .select({ id: people.id, email: people.email, status: people.status, notificationsEnabled: people.notificationsEnabled })
    .from(people)
    .where(and(eq(people.status, "active"), eq(people.notificationsEnabled, true)));
  if (active.length === 0) return [];

  const [devices, grants] = await Promise.all([
    db
      .selectDistinct({ recipient: pushSubscriptions.recipient })
      .from(pushSubscriptions)
      .where(and(inArray(pushSubscriptions.recipient, active.map((p) => p.email)), isNull(pushSubscriptions.goneAt))),
    db
      .select({ personId: accessGrants.personId, area: accessGrants.area, level: accessGrants.level })
      .from(accessGrants)
      .where(inArray(accessGrants.personId, active.map((p) => p.id))),
  ]);
  const withDevice = new Set(devices.map((d) => d.recipient));

  return active.flatMap((p) => {
    if (!withDevice.has(p.email)) return [];
    const row: PersonRow = { email: p.email, status: p.status, notificationsEnabled: p.notificationsEnabled, grants: grants.filter((g) => g.personId === p.id) };
    const recipient = personRecipient(row, ownerEmails);
    return recipient ? [recipient] : [];
  });
}
