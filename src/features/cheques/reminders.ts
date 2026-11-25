import type { ReminderItem } from "@/features/reminders/engine";
import { daysBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { staleDate } from "./logic";

/**
 * The reminders a waiting cheque makes (issue #178, DECISIONS C158). Pure: the caller passes the rows and
 * `today`. Only a cheque that is still `waiting` reminds; once it is deposited, cleared, bounced or
 * cancelled, nothing is listed and nothing is sent.
 *
 *  1. "Deposit" (`cheque:<id>`): due on the cheque date, the earliest day it can be deposited. It shows with
 *     the app-wide lead days and stays overdue every day after until the cheque is marked deposited or
 *     cancelled.
 *  2. "Goes stale" (`cheque-stale:<id>`): due on the stale date, six calendar months after the cheque date.
 *     Once that day has passed the cheque can no longer be deposited, so the deposit reminder is dropped and
 *     this one stays, overdue, until the cheque is cancelled (or put right).
 *
 * `title` is the owner's own screen and may carry who and the amount. `notice` is what a notification may
 * say (C139): only the word "Cheque", never an amount, a name, a bank or a number.
 */

type WaitingCheque = { id: string; fromParty: string; amount: string; chequeDate: string };

export function chequeReminders(rows: readonly WaitingCheque[], today: string): ReminderItem[] {
  return rows.flatMap((c): ReminderItem[] => {
    const staleOn = staleDate(c.chequeDate);
    const detail = `${c.fromParty} · ${formatMoney(Number(c.amount))}`;
    const stale: ReminderItem = {
      id: `cheque-stale:${c.id}`,
      title: `${daysBetween(today, staleOn) < 0 ? "Cheque went stale" : "Cheque goes stale"} · ${detail}`,
      dueDate: staleOn,
      href: `/cheques#cheque-${c.id}`,
      kind: "stale cheque",
      ownerId: c.id,
      notice: { what: "Cheque" },
    };
    if (daysBetween(today, staleOn) < 0) return [stale];
    return [
      {
        id: `cheque:${c.id}`,
        title: `Deposit cheque · ${detail}`,
        dueDate: c.chequeDate,
        href: `/cheques#cheque-${c.id}`,
        kind: "cheque",
        ownerId: c.id,
        notice: { what: "Cheque" },
      },
      stale,
    ];
  });
}
