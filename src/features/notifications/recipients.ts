import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";
import { allowsSourceArea, type Access, type SourceArea } from "@/features/people/access";
import { parseAllowedEmails } from "@/lib/allowed-emails";

/**
 * Who notifications go to (Notifications N.1, C139). For now the owners (the ALLOWED_EMAILS addresses),
 * who see every source. People the hub is shared with come in N.5: they fit the same shape, with the
 * access the owner gave them, so they only hear about the sections they may see (and never about the
 * owner-only events, like a sign-up request, N.4). Pure.
 */
export type Recipient = {
  /** Lower-cased. */
  email: string;
  access: Access;
};

/** The owners from the raw ALLOWED_EMAILS value (the existing parser: lower-cased, invalid entries dropped). */
export function ownerRecipients(rawAllowedEmails: string | undefined): Recipient[] {
  return [...new Set(parseAllowedEmails(rawAllowedEmails))].map((email) => ({ email, access: { owner: true } }));
}

/** The items (or events) of the sources a recipient may see. */
export function itemsFor<T = ReminderItem>(recipient: Recipient, loaded: readonly { area: SourceArea; items: readonly T[] }[]): T[] {
  return loaded.filter((l) => allowsSourceArea(recipient.access, l.area)).flatMap((l) => l.items);
}

/** The events a recipient may hear about. */
export const eventsFor = itemsFor<NoticeEvent>;
