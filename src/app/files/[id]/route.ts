import { allows } from "@/features/people/access";
import { fileArea } from "@/features/people/file-area";
import { getAttachment } from "@/features/shared/queries";
import { getAuthState } from "@/lib/auth";
import { UUID_RE } from "@/features/shared/validation";
import { storageClient } from "@/lib/storage";

/**
 * Opens an attachment: looks it up, asks Supabase for a signed link that lasts 60 seconds, and
 * redirects to it. The bucket is private, so files are never reachable by a plain public URL, and
 * the link itself needs a signed-in, allowed user.
 */
export async function GET(_request: Request, ctx: RouteContext<"/files/[id]">) {
  // Documents are private: only a signed-in, allowed person may open them (C61), and only when they
  // may see the section the file belongs to (S.8, C114).
  const state = await getAuthState();
  if (state.status !== "ok") return new Response("Not allowed", { status: 403, headers: { "Cache-Control": "no-store" } });

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const attachment = await getAttachment(id);
  if (!attachment) return new Response("Not found", { status: 404 });
  if (!allows(state.access, await fileArea(attachment), "see")) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data, error } = await storageClient()
    .storage.from(attachment.bucket)
    .createSignedUrl(attachment.storagePath, 60);
  if (error || !data) return new Response("Could not open file", { status: 502 });

  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "no-store" },
  });
}
