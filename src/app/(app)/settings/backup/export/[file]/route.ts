import { buildExport, isExportKey } from "@/features/settings/exports";
import { getAuthState } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";

/**
 * A CSV download from Settings › Data and backup (S.7, C113): /settings/backup/export/<kind>. The
 * address has no ".csv" on purpose: the proxy skips paths that end in a file extension, and this one
 * must go through login; the saved file still gets its .csv name from Content-Disposition.
 * Holds real data, so only a signed-in, allowed person gets it (C61), and it is never cached.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ file: string }> }) {
  if ((await getAuthState()).status !== "ok") return new Response("Not allowed", { status: 403, headers: { "Cache-Control": "no-store" } });

  const { file } = await ctx.params;
  const key = file;
  if (!isExportKey(key)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const csv = await buildExport(key);
  // A byte-order mark so Excel reads the file as UTF-8 (names with Sinhala or Tamil letters stay readable).
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hub-${key}-${todayInAppTz()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
