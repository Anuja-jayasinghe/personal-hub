import { appConfig } from "@/config/app.config";
import { describeDays, type ReminderItem } from "@/features/reminders/engine";
import { addDays, dayMonth, daysBetween } from "@/lib/dates";
import { NOTIFICATION_STEPS, dedupeKey, eventOf, stepIsDue, type Channel, type EventKey, type StepName } from "./steps";

/**
 * The notification planner (Notifications N.1, DECISIONS C139). Pure: no database, no clock, no env.
 * Given the reminder items one person may see, today ("YYYY-MM-DD" in the app time zone) and the
 * dedupe keys already used for that person, it says which notices are due and batches them into at
 * most one message per channel. Nothing new means nothing at all: no notices, no messages.
 *
 * Messages never carry an amount, a plate or a document number: they are built only from each item's
 * `notice` words (what and who), never from its `title`.
 */

export type Notice = {
  item: ReminderItem;
  event: EventKey;
  step: StepName;
  channel: Channel;
  /** `<item.id>:<step>:<dueDate>`, unique per recipient. */
  dedupeKey: string;
  dueDate: string;
  href: string;
  daysUntil: number;
  /** What this notice says on its own (the send log keeps it per row). */
  title: string;
  body: string;
};

export type Message = {
  /** Lower-cased email of the person it goes to ("" in a preview). */
  recipient: string;
  channel: Channel;
  /** The email subject, or the push title. */
  title: string;
  /** The email text, or the push body. */
  body: string;
  href: string;
  notices: Notice[];
};

export type PlanInput = {
  recipient?: string;
  items: readonly ReminderItem[];
  today: string;
  /** Dedupe keys already used for this recipient. */
  usedKeys: ReadonlySet<string>;
  /**
   * Channels that already carried a message to this recipient today (a second run on the same day).
   * Their notices are held back, to keep to one message per day per channel; the catch-up rules send
   * them on the next run if they are still timely.
   */
  channelsUsedToday?: ReadonlySet<Channel>;
};

export type Plan = {
  notices: Notice[];
  /** At most one per channel. */
  messages: Message[];
  /** Notices held back because their channel was already used today. */
  held: number;
};

const brand = appConfig.name;

function words(item: ReminderItem): { what: string; who: string | undefined } {
  return { what: item.notice?.what ?? "A reminder", who: item.notice?.who };
}

/** What one notice says by itself. */
function noticeText(item: ReminderItem, event: EventKey, step: StepName, daysUntil: number): { title: string; body: string } {
  const rule = NOTIFICATION_STEPS[event];
  const { what, who } = words(item);
  if (step === "plan") {
    const when = `${rule.verb} ${dayMonth(item.dueDate)}`;
    const title = who ? `${what} · ${who} ${when}` : `${what} ${when}`;
    return { title, body: `${title} (${describeDays(daysUntil).toLowerCase()})` };
  }
  const title = step === "act" ? `${what} ${rule.verb} ${daysUntil === 0 ? "today" : "tomorrow"}` : `${what} ${rule.past}`;
  return { title, body: who ?? rule.place };
}

const link = (href: string) => `${appConfig.siteUrl}${href}`;

/** Batches one recipient's notices for one channel into a single message. */
export function composeMessage(recipient: string, channel: Channel, notices: readonly Notice[]): Message {
  const sorted = [...notices].sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title));
  const single = sorted.length === 1 ? sorted[0] : null;
  if (channel === "email") {
    const title = single ? `${brand} · ${single.title}` : `${brand} · ${sorted.length} things coming up`;
    const lines = sorted.map((n) => `• ${n.body}\n  ${link(n.href)}`);
    const body = `${lines.join("\n\n")}\n\n${brand} writes only when something is new.`;
    return { recipient, channel, title, body, href: single ? single.href : "/reminders", notices: sorted };
  }
  if (single) return { recipient, channel, title: single.title, body: single.body, href: single.href, notices: sorted };
  return {
    recipient,
    channel,
    title: `${sorted.length} things need you`,
    body: sorted.map((n) => `${n.title} · ${n.body}`).join("\n"),
    href: "/reminders",
    notices: sorted,
  };
}

/** The notices due today for one recipient, batched into at most one message per channel. */
export function planNotifications({ recipient = "", items, today, usedKeys, channelsUsedToday }: PlanInput): Plan {
  const notices: Notice[] = [];
  const seen = new Set<string>();
  let held = 0;

  for (const item of items) {
    const event = eventOf(item);
    if (!event) continue;
    const daysUntil = daysBetween(today, item.dueDate);
    for (const rule of NOTIFICATION_STEPS[event].steps) {
      if (!stepIsDue(rule, daysUntil)) continue;
      const key = dedupeKey(item.id, rule.step, item.dueDate);
      if (usedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (channelsUsedToday?.has(rule.channel)) {
        held++;
        continue;
      }
      notices.push({
        item,
        event,
        step: rule.step,
        channel: rule.channel,
        dedupeKey: key,
        dueDate: item.dueDate,
        href: item.href,
        daysUntil,
        ...noticeText(item, event, rule.step, daysUntil),
      });
    }
  }

  const messages = (["email", "push"] as const).flatMap((channel) => {
    const forChannel = notices.filter((n) => n.channel === channel);
    return forChannel.length > 0 ? [composeMessage(recipient, channel, forChannel)] : [];
  });
  return { notices, messages, held };
}

export type PreviewDay = { date: string; messages: Message[] };

/**
 * What would go out over the next `days` days (today first), for Settings › Notifications "Coming up".
 * Assumes the items stay as they are (nothing paid, renewed or added) and that each day's run happens.
 * Only days with something to send are listed.
 */
export function previewUpcoming(items: readonly ReminderItem[], today: string, usedKeys: ReadonlySet<string>, days: number): PreviewDay[] {
  const used = new Set(usedKeys);
  const out: PreviewDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const plan = planNotifications({ items, today: date, usedKeys: used });
    for (const n of plan.notices) used.add(n.dedupeKey);
    if (plan.messages.length > 0) out.push({ date, messages: plan.messages });
  }
  return out;
}
