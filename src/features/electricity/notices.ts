import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import type { NoticeEvent } from "@/features/reminders/engine";
import type { HubRules } from "@/features/settings/rules";
import { EVENT_WINDOW_DAYS } from "@/features/notifications/steps";
import { addDays, daysBetween } from "@/lib/dates";
import { unitsLeft } from "./limits-text";
import { electricitySnapshot } from "./snapshot";

/**
 * The electricity events a notification may carry (Notifications N.4, DECISIONS C142). Pure: rows and
 * the rules in force in, events out. Two kinds of push, owners only for now:
 *
 *  - **Slab limit.** A meter's usage since its last bill came within the near margin of its limit
 *    ("slab-near"), or crossed it ("slab-over"). The key holds the meter, the kind and the cycle's start
 *    (the last bill's reading date), so each goes once per cycle per meter and a new bill starts fresh.
 *    The state is today's: nothing is guessed about later days.
 *  - **Reading overdue.** No reading for `checkEveryDays` days ("reading-due"). The key holds the meter
 *    and its last reading's date, so it goes once, stops the moment anyone adds a reading, and starts
 *    over from the next one. A meter that has never been read has no anchor and sends nothing.
 *
 * Words: units are fine (they are not money), a meter's name is one the owner chose. Never an account
 * number, an amount or a reading's value.
 */

export const ELECTRICITY_HREF = "/electricity";

const whole = (hundredths: number) => Math.round(hundredths / 100);
// Used is rounded DOWN like "left", so the title and the body agree (119.6 units reads "119 of 120", "0 left", never "120 of 120").
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** ", 9 days to the bill" while the cycle's end is still ahead; nothing once it has passed. */
function daysToBill(sinceDate: string, cycleDays: number, today: string): string {
  const days = daysBetween(today, addDays(sinceDate, cycleDays));
  return days > 0 ? `, ${plural(days, "day")} to the bill` : "";
}

export function electricityEvents(input: {
  meters: ElectricityMeter[];
  readings: ElectricityReading[];
  bills: ElectricityBill[];
  rules: HubRules;
  today: string;
}): NoticeEvent[] {
  const { meters, readings, bills, rules, today } = input;
  const snapshot = electricitySnapshot({ meters, readings, bills, rules, today });
  const events: NoticeEvent[] = [];

  for (const meter of meters) {
    const limit = snapshot.limits.meters.find((m) => m.id === meter.id);
    const usage = snapshot.data.get(meter.id)?.usage;
    // Usage is only known once there is a bill and a reading after it.
    if (limit && limit.known && usage?.state === "ok" && (limit.state === "near" || limit.state === "over")) {
      const kind = limit.state === "near" ? "near" : "over";
      const left = unitsLeft(limit);
      const bill = daysToBill(usage.sinceDate, rules.billingCycleDays, today);
      events.push({
        event: kind === "near" ? "slab-near" : "slab-over",
        key: `slab:${meter.id}:${kind}:${usage.sinceDate}`,
        anchor: usage.sinceDate,
        from: today,
        until: today,
        href: ELECTRICITY_HREF,
        title: kind === "near" ? `${Math.floor(limit.used / 100)} of ${whole(limit.limit)} units used` : `Over the ${whole(limit.limit)} unit limit`,
        body: `${meter.name} · ${kind === "near" ? `${left} left` : `${-left} over`}${bill}`,
      });
    }

    const last = snapshot.data.get(meter.id)?.readingRows[0]?.date;
    if (last) {
      const from = addDays(last, rules.checkEveryDays);
      events.push({
        event: "reading-due",
        key: `reading-due:${meter.id}:${last}`,
        anchor: last,
        from,
        until: addDays(from, EVENT_WINDOW_DAYS),
        href: ELECTRICITY_HREF,
        title: "Meter reading due",
        body: meter.name,
      });
    }
  }
  return events;
}
