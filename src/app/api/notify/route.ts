import { notifyGate } from "@/features/notifications/gate";
import { runNotifications } from "@/features/notifications/run";
import { safeErrorSummary } from "@/lib/errors";

const noStore = { "Cache-Control": "no-store" };

/**
 * The silent daily run (Notifications N.1, DECISIONS C139). Vercel Cron calls it once a day
 * (`0 2 * * *` UTC = 07:30 to 08:29 in Colombo, vercel.json). It runs the notification planner over the
 * reminders and writes the send log; nothing is sent until a channel is built and switched on.
 *
 * Only our own cron job may call it (`Authorization: Bearer <CRON_SECRET>`, src/lib/cron-auth.ts),
 * checked here because this route is not behind AccessGate, and only production runs it: previews use
 * real data and must never notify. Its daily read also keeps the free Supabase project awake (C127).
 * The answer is counts only, never data.
 */
export async function GET(request: Request) {
  const gate = notifyGate(request.headers.get("authorization"), { CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV });
  if (gate === "unauthorized") return new Response("Not allowed", { status: 401, headers: noStore });
  if (gate === "skipped") return Response.json({ ok: true, skipped: "not production" }, { headers: noStore });

  try {
    const report = await runNotifications();
    return Response.json({ ok: true, ...report }, { headers: noStore });
  } catch (err) {
    // Name and code only, never the error itself: a failed query carries its parameters (emails, titles).
    console.error(`Notification run failed: ${safeErrorSummary(err)}`);
    return Response.json({ ok: false }, { status: 500, headers: noStore });
  }
}
