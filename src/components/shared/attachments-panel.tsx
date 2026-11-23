import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/shared/submit-button";
import { UploadForm } from "@/components/shared/upload-form";
import type { Attachment } from "@/db/schema";
import { deleteAttachment } from "@/features/shared/actions";
import { formatBytes } from "@/lib/format";
import type { OwnerRef } from "@/lib/owners";

/**
 * Files attached to one record. `items` are passed in (already loaded) so a list of tasks or
 * notes can fetch all their attachments in one query. Files open through /files/<id>, which
 * redirects to a short-lived signed link — the bucket itself is private.
 */
export function AttachmentsPanel({
  owner,
  items,
  nameHint,
}: {
  owner: OwnerRef;
  items: Attachment[];
  /** The name the hub will give an upload here (vehicle renewals, issue #179), shown under the picker. */
  nameHint?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((a) => {
            const Icon = a.mimeType === "application/pdf" ? FileText : ImageIcon;
            return (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <a
                  href={`/files/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                >
                  {a.fileName}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${a.fileName}`}
                    confirm={`Delete "${a.fileName}"? This cannot be undone.`}
                  >
                    <Trash2 aria-hidden />
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      )}
      <UploadForm owner={owner} nameHint={nameHint} />
    </div>
  );
}
