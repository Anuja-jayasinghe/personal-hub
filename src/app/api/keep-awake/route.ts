import { count } from "drizzle-orm";
import { db } from "@/db";
import { electricityMeters } from "@/db/schema";
import { isCronRequest } from "@/lib/cron-auth";

/**
 * Keeps the free Supabase project awake (C127). Supabase pauses a free project after 7 days without
 * database activity, and the hub only queries when someone opens it. Vercel Cron calls this every 3 days
 * (vercel.json): the most apart that still survives one missed run inside the 7-day window.
 *
 * One read-only query; nothing is written, so nothing grows. Only our own cron job may call it: it needs
 * `Authorization: Bearer <CRON_SECRET>` (src/lib/cron-auth.ts), checked here because this route is not
 * behind AccessGate. The answer says nothing about the data.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Not allowed", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await db.select({ n: count() }).from(electricityMeters);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
