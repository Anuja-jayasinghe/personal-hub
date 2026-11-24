import { sharedVisible } from "@/features/people/access";
import { getAccess } from "@/lib/auth";
import { Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { AddNoteSheet } from "@/components/shared/add-sheets";
import { NoteForm } from "@/components/shared/note-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Attachment, Note } from "@/db/schema";
import { deleteNote, toggleNotePinned, updateNote } from "@/features/shared/actions";
import { ownerLabels, type OwnerLabel } from "@/features/shared/owner-labels";
import { attachmentsByOwner, listNotes, type OwnerScope } from "@/features/shared/queries";
import { formatDate } from "@/lib/format";

/** Notes for any scope: standalone, one record (e.g. a vehicle), or everything. Use inside <Suspense>. */
export async function NotesPanel({
  scope,
  title = "Notes",
  quietWhenEmpty = false,
  hideWhenEmpty = false,
}: {
  scope: OwnerScope;
  title?: string;
  /** With no notes, show only a small "Add a note" link: no heading, no empty-state box. */
  quietWhenEmpty?: boolean;
  /** With no notes, show nothing at all (the vehicle page has "Add a note" in its one Add menu, V.2). */
  hideWhenEmpty?: boolean;
}) {
  // Only what this person may see (S.8, C114): Tasks & notes, and the section of an attached record.
  const access = (await getAccess()) ?? { owner: false as const, grants: {} };
  const owner0 = scope.kind === "owner" ? scope.owner : null;
  if (!sharedVisible(access, owner0?.ownerType ?? null)) return null;
  const canAdd = sharedVisible(access, owner0?.ownerType ?? null, "add");
  const list = (await listNotes(scope)).filter((x) => sharedVisible(access, x.ownerType));
  const files = await attachmentsByOwner("note", list.map((n) => n.id));
  const labels = scope.kind === "all" ? await ownerLabels(list) : new Map<string, OwnerLabel>();
  const owner = scope.kind === "owner" ? scope.owner : null;

  if (hideWhenEmpty && list.length === 0) return null;
  if (quietWhenEmpty && list.length === 0) {
    return (
      <div>
        {canAdd ? <AddNoteSheet owner={owner} quiet /> : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="notes-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 id="notes-heading" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
          {title} · {list.length}
        </h2>
        <span className="ml-auto">
          {canAdd ? <AddNoteSheet owner={owner} /> : null}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
    <li className={`rounded-2xl border bg-card p-3.5 text-card-foreground ${note.pinned ? "border-primary/45" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {note.title ? <p className="text-[15px] font-semibold">{note.title}</p> : null}
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{note.body}</p>
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
            <span className="font-mono text-[10px] text-label uppercase">Updated {formatDate(note.updatedAt)}</span>
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
