import "server-only";
import { listWaitingCheques } from "@/features/cheques/queries";
import { chequeReminders } from "@/features/cheques/reminders";
import { todayInAppTz } from "@/lib/format";
import type { ReminderSource } from "../engine";

/**
 * Received cheques still waiting to be deposited (issue #178, C158): a reminder on the cheque date that
 * stays overdue until it is deposited or cancelled, and one for the day it goes stale (six months after).
 * Owners only: `SOURCE_AREA` files it under "owner", so nobody else is ever shown it or sent a notice
 * about it. The wording is in `chequeReminders`.
 */
export const chequesSource: ReminderSource = {
  key: "cheques",
  label: "Cheques",
  async load(from) {
    return chequeReminders(await listWaitingCheques(from?.db), from?.today ?? todayInAppTz());
  },
};
