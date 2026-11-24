import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";
import { accessFromGrants, allows, allowsSourceArea, type Access, type Level, type SourceArea } from "@/features/people/access";
import { parseAllowedEmails } from "@/lib/allowed-emails";
import type { Channel } from "./steps";

/**
 * Who notifications go to (Notifications N.1, C139; people in N.5, C144). Pure.
 *
 * Owners (the ALLOWED_EMAILS addresses) hear about every source, by email and push. People the hub is
 * shared with hear only about the sections they may see, by push only (email stays the owners': it goes
 * to the owner's own mailbox setting, never to a person), and never about the owner-only events (a
 * sign-up request, N.4).
 */
export type Recipient = {
  /** Lower-cased. */
  email: string;
  access: Access;
  /** The channels this recipient may be written to. */
  channels: readonly Channel[];
};

export const OWNER_CHANNELS: readonly Channel[] = ["email", "push"];
/** People get pushes only (N.5, C144). */
export const PERSON_CHANNELS: readonly Channel[] = ["push"];

/** The owners from the raw ALLOWED_EMAILS value (the existing parser: lower-cased, invalid entries dropped). */
export function ownerRecipients(rawAllowedEmails: string | undefined): Recipient[] {
  return [...new Set(parseAllowedEmails(rawAllowedEmails))].map((email) => ({ email, access: { owner: true }, channels: OWNER_CHANNELS }));
}

/** One row of the `people` table and their grants, as the run reads them. */
export type PersonRow = { email: string; status: string; notificationsEnabled: boolean; grants: readonly { area: string; level: string }[] };

/**
 * A person as a recipient, or null when they must hear nothing: anyone not `active` (pending, blocked),
 * anyone the owner switched notifications off for, and anyone whose address is an owner's (an owner is
 * handled as an owner, never twice). Their access is built from their grants alone, so a revoked grant
 * stops its notices at the next run.
 */
export function personRecipient(person: PersonRow, ownerEmails: ReadonlySet<string>): Recipient | null {
  const email = person.email.trim().toLowerCase();
  if (person.status !== "active" || !person.notificationsEnabled || ownerEmails.has(email)) return null;
  return { email, access: accessFromGrants(person.grants), channels: PERSON_CHANNELS };
}

/** The items of the sources a recipient may see (the Reminders page's own rule: `allowsSourceArea`). */
export function itemsFor<T = ReminderItem>(recipient: Recipient, loaded: readonly { area: SourceArea; items: readonly T[] }[]): T[] {
  return loaded.filter((l) => allowsSourceArea(recipient.access, l.area)).flatMap((l) => l.items);
}

/**
 * Events that need more than seeing their section. "Reading due" goes to the people who can ADD a
 * reading (the person whose turn it is, P40), not to everyone who can only look. The slab events need
 * only See.
 */
const EVENT_LEVEL: Partial<Record<NoticeEvent["event"], Level>> = { "reading-due": "add" };

/** Events only the owners may hear about, whatever section their source was filed under (fails closed). */
const OWNER_ONLY_EVENTS: ReadonlySet<NoticeEvent["event"]> = new Set(["access-request"]);

/** The events a recipient may hear about: their section's events, at the level each event needs. */
export function eventsFor(recipient: Recipient, loaded: readonly { area: SourceArea; items: readonly NoticeEvent[] }[]): NoticeEvent[] {
  return loaded
    .filter((l) => allowsSourceArea(recipient.access, l.area))
    .flatMap((l) =>
      l.items.filter((e) => {
        if (OWNER_ONLY_EVENTS.has(e.event)) return recipient.access.owner;
        const need = EVENT_LEVEL[e.event];
        return need === undefined || l.area === "owner" || allows(recipient.access, l.area, need);
      }),
    );
}
