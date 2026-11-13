import { Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { NoteForm } from "@/components/shared/note-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Attachment, Note } from "@/db/schema";
import { createNote, deleteNote, toggleNotePinned, updateNote } from "@/features/shared/actions";
import { ownerLabels, type OwnerLabel } from "@/features/shared/owner-labels";
import { attachmentsByOwner, listNotes, type OwnerScope } from "@/features/shared/queries";
import { formatDate } from "@/lib/format";

/** Notes for any scope: standalone, one record (e.g. a vehicle), or everything. Use inside <Suspense>. */
export async function NotesPanel({ scope, title = "Notes" }: { scope: OwnerScope; title?: string }) {
  const list = await listNotes(scope);
  const files = await attachmentsByOwner("note", list.map((n) => n.id));
  const labels = scope.kind === "all" ? await ownerLabels(list) : new Map<string, OwnerLabel>();
  const owner = scope.kind === "owner" ? scope.owner : null;

  return (
    <section aria-labelledby="notes-heading" className="flex flex-col gap-4">
      <h2 id="notes-heading" className="text-lg font-medium">
        {title}
      </h2>

      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a note</summary>
        <div className="border-t p-4">
          <NoteForm action={createNote} owner={owner} />
        </div>
      </details>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((note) => (
            <NoteItem key={note.id} note={note} files={files.get(note.id) ?? []} ownerLabel={note.ownerType && note.ownerId ? labels.get(`${note.ownerType}:${note.ownerId}`) : undefined} showOwner={scope.kind === "all"} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteItem({ note, files, ownerLabel, showOwner }: { note: Note; files: Attachment[]; ownerLabel?: OwnerLabel; showOwner: boolean }) {
  return (
    <li className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {note.title ? <p className="font-medium">{note.title}</p> : null}
          <p className="whitespace-pre-wrap text-sm">{note.body}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {note.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
            {showOwner && note.ownerType ? (
              ownerLabel ? (
                <Link href={ownerLabel.href}>
                  <Badge variant="outline">{ownerLabel.label}</Badge>
                </Link>
              ) : (
                <Badge variant="outline">{note.ownerType}</Badge>
              )
            ) : null}
            <span>Updated {formatDate(note.updatedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <form action={toggleNotePinned}>
            <input type="hidden" name="id" value={note.id} />
            <input type="hidden" name="pinned" value={note.pinned ? "false" : "true"} />
            <SubmitButton variant="ghost" size="icon" aria-label={note.pinned ? "Unpin note" : "Pin note"}>
              {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            </SubmitButton>
          </form>
          <form action={deleteNote}>
            <input type="hidden" name="id" value={note.id} />
            <SubmitButton
              variant="ghost"
              size="icon"
              aria-label="Delete note"
              confirm="Delete this note and its files? This cannot be undone."
            >
              <Trash2 aria-hidden />
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
          <div className="border-t p-3">
            <NoteForm action={updateNote} note={note} />
          </div>
        </details>
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Files ({files.length})</summary>
          <div className="border-t p-3">
            <AttachmentsPanel owner={{ ownerType: "note", ownerId: note.id }} items={files} />
          </div>
        </details>
      </div>
    </li>
  );
}
