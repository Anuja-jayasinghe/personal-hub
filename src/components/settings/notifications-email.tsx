"use client";

import { useState, useTransition } from "react";
import { Row, RowMeta } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { sendTestEmail, setEmailEnabled, type TestEmailResult } from "@/features/notifications/email-actions";
import type { EmailStatus } from "@/features/notifications/email-settings";

/**
 * Settings › Notifications › Email (N.2, C141): the Email row of "Where to tell you". Set up = the masked
 * delivery address and the switch; not set up = the two settings it waits for (previews: they are
 * Production only). The test email and the
 * Gmail filter how-to are used once or twice, so they are tucked away under the row.
 */

const PLANS = "plans ahead: renewals 30 days before, services 14, electricity bills 7";

function EmailSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const flip = () =>
    startTransition(async () => {
      const next = !on;
      setOn(next);
      const fd = new FormData();
      fd.set("enabled", String(next));
      const res = await setEmailEnabled(fd);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Could not save.");
      } else setError(null);
    });

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {/* A 44 px tall touch target around the 44 by 26 switch (DESIGN.md). */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Send plan-ahead emails"
        disabled={pending}
        onClick={flip}
        className="group/s -mr-2 grid min-h-11 min-w-14 shrink-0 place-items-center rounded-full outline-none disabled:opacity-60"
      >
        <span
          aria-hidden
          className={`relative h-[26px] w-11 rounded-full transition-colors group-focus-visible/s:ring-2 group-focus-visible/s:ring-ring ${on ? "bg-primary" : "bg-raised ring-1 ring-border"}`}
        >
          <span
            className={`absolute top-[3px] left-[3px] size-5 rounded-full transition-transform motion-reduce:transition-none ${on ? "translate-x-[18px] bg-primary-foreground" : "bg-quiet"}`}
          />
        </span>
      </button>
      {error ? (
        <span role="alert" className="text-xs text-status-overdue">
          {error}
        </span>
      ) : null}
    </span>
  );
}

const TONE: Record<TestEmailResult["outcome"], string> = {
  sent: "text-status-ok",
  refused: "text-status-overdue",
  unknown: "text-status-soon",
  "not-allowed": "text-muted-foreground",
};

function TestEmail() {
  const [result, setResult] = useState<TestEmailResult | null>(null);
  const [pending, startTransition] = useTransition();
  const send = () =>
    startTransition(async () => {
      setResult(await sendTestEmail());
    });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={send}>
        {pending ? "Sending…" : "Send a test email"}
      </Button>
      <span role="status" className={`text-[12.5px] ${result ? TONE[result.outcome] : "text-muted-foreground"}`}>
        {result ? result.message : "subject “hub · Test”, one a minute"}
      </span>
    </div>
  );
}

/** The sender's bare address, from `appConfig.emailFrom` ("hub <notify@…>"). */
const FROM_ADDRESS = appConfig.emailFrom.match(/<([^>]+)>/)?.[1] ?? appConfig.emailFrom;

/**
 * Gmail's steps as a line of nodes (DESIGN.md: node-and-line). The filter matches the SENDER, never only
 * the tagged delivery address: anyone who guesses that address could otherwise skip the spam filter.
 */
const FILTER_STEPS: React.ReactNode[] = [
  <>Gmail → Settings → Filters → Create filter</>,
  <>
    <b className="font-semibold text-foreground">From</b>: <span className="font-mono break-all text-foreground">{FROM_ADDRESS}</span> (and, if you like, To: the
    address above)
  </>,
  <>
    Apply the label <b className="font-semibold text-foreground">hub</b>, <b className="font-semibold text-foreground">Never send it to Spam</b>,{" "}
    <b className="font-semibold text-foreground">Always mark it as important</b>
  </>,
  <>
    Leave <b className="font-semibold text-foreground">Skip the Inbox</b> off, so notices still reach the inbox
  </>,
];

function GmailFilter() {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Gmail filter</span>
      <ol className="relative flex flex-col gap-2.5">
        <span aria-hidden className="absolute top-2 bottom-2 left-[0.6rem] w-0.5 bg-border" />
        {FILTER_STEPS.map((step, i) => (
          <li key={i} className="relative flex gap-3 text-[12.5px] leading-snug text-muted-foreground">
            <span aria-hidden className="relative grid size-5 shrink-0 place-items-center rounded-full border border-border bg-card font-mono text-[10px] text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EmailRow({ status }: { status: EmailStatus }) {
  if (status.state !== "ready" || !status.maskedTo) {
    const why = status.state === "no-address" ? "set up, but your sign-in address could not be read: reload and sign in again" : "waits for RESEND_API_KEY and NOTIFY_EMAIL_TO";
    return (
      <Row
        label="Email"
        hint={
          <>
            {PLANS}
            <span className="block font-mono text-[11px]">{why}</span>
          </>
        }
        end={<RowMeta tone="quiet">{status.state === "no-address" ? "No address" : "Not set up"}</RowMeta>}
      />
    );
  }
  return (
    <div className="flex flex-col">
      <Row
        label="Email"
        hint={
          <>
            {PLANS}
            <span className="block font-mono text-[11.5px] break-all text-foreground/80">{status.maskedTo}</span>
            {status.enabled ? null : <span className="block">Switching on sends anything already inside its window, in one email.</span>}
          </>
        }
        end={<EmailSwitch initial={status.enabled} />}
      />
      <details className="group/e pb-3">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="transition-transform group-open/e:rotate-90 motion-reduce:transition-none">
            ›
          </span>
          Test it, Gmail filter
        </summary>
        <div className="flex flex-col gap-4 pt-2 pb-1">
          <TestEmail />
          <GmailFilter />
        </div>
      </details>
    </div>
  );
}
