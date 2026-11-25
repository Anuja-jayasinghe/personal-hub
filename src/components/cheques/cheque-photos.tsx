import { FileText, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/shared/submit-button";
import { UploadForm } from "@/components/shared/upload-form";
import type { Attachment } from "@/db/schema";
import { MAX_CHEQUE_PHOTOS, chequePhotoName } from "@/features/cheques/photos";
import { deleteAttachment } from "@/features/shared/actions";
import { extensionFor } from "@/features/vehicles/doc-names";

type Photo = Pick<Attachment, "id" | "fileName" | "mimeType">;

/** A browser can show these in an <img>; a PDF (or a HEIC in a browser that cannot) gets a file icon. */
const isImage = (mimeType: string) => ["image/jpeg", "image/png", "image/webp"].includes(mimeType);

/**
 * The little pictures of a cheque's front and back, always visible on its card: each opens the full photo
 * (through /files/<id>, a 60-second signed link; the bucket is private). Which side is which is the order
 * they were added.
 */
export function ChequeThumbs({ photos }: { photos: readonly Photo[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="flex gap-2">
      {photos.map((p, i) => (
        <li key={p.id}>
          <a
            href={`/files/${p.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the ${i === 0 ? "front" : "back"} of the cheque`}
            className="flex size-11 items-center justify-center overflow-hidden rounded-lg border bg-raised/60 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isImage(p.mimeType) ? (
              // A plain <img>: /files/<id> redirects to a short-lived signed link, which Next's image optimiser can't follow.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/files/${p.id}`} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <FileText className="size-5" aria-hidden />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The photos of one cheque: delete one, or add the front, then the back (at most two). Sits in the card's "More" row. */
export function ChequePhotos({ chequeId, chequeDate, photos }: { chequeId: string; chequeDate: string; photos: readonly Photo[] }) {
  const full = photos.length >= MAX_CHEQUE_PHOTOS;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {photos.map((p, i) => (
          <li key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
            <span className="w-12 shrink-0 font-mono text-[10.5px] tracking-[0.12em] text-label uppercase">{i === 0 ? "Front" : "Back"}</span>
            <a href={`/files/${p.id}`} target="_blank" rel="noreferrer" className="flex min-h-11 min-w-0 flex-1 items-center truncate font-mono text-xs underline-offset-2 hover:underline">
              {p.fileName}
            </a>
            <form action={deleteAttachment}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete the ${i === 0 ? "front" : "back"} photo`} confirm="Delete this photo? This cannot be undone.">
                <Trash2 aria-hidden />
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      {full ? (
        <p className="text-xs text-muted-foreground">A cheque keeps a front and a back. Delete one to add another.</p>
      ) : (
        <UploadForm
          owner={{ ownerType: "cheque", ownerId: chequeId }}
          nameHint={chequePhotoName(chequeDate, photos.map((p) => p.fileName), extensionFor("image/jpeg")).replace(/\.jpg$/, "")}
        />
      )}
    </div>
  );
}
