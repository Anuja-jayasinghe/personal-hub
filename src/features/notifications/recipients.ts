import { allows, type Access, type Area } from "@/features/people/access";
import type { ReminderItem } from "@/features/reminders/engine";
import { parseAllowedEmails } from "@/lib/allowed-emails";

/**
 * Who notifications go to (Notifications N.1, C139). For now the owners (the ALLOWED_EMAILS addresses),
 * who see every source. People the hub is shared with come in N.5: they fit the same shape, with the
 * access the owner gave them, so they only hear about the sections they may see. Pure.
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

/** The items of the sources a recipient may see. */
export function itemsFor(recipient: Recipient, loaded: readonly { area: Area; items: readonly ReminderItem[] }[]): ReminderItem[] {
  return loaded.filter((l) => allows(recipient.access, l.area, "see")).flatMap((l) => l.items);
}
