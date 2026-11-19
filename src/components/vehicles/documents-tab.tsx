import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { DocumentRenameForm } from "@/components/vehicles/document-forms";
import { AddDocumentSheet } from "@/components/vehicles/vehicle-sheets";
import { deleteAttachment } from "@/features/shared/actions";
import { attachmentsByOwner } from "@/features/shared/queries";
import { docLabel, DOC_SORTS, parseDocSort, searchAndSortDocs } from "@/features/vehicles/documents";
import { formatBytes, formatDate } from "@/lib/format";
import { selectClass } from "@/components/shared/form-styles";
import { Input } from "@/components/ui/input";

/**
 * A vehicle's documents (registration book, licence, insurance, emission test…): each has a title
 * the owner typed. Search and sort show up only once there are a few, so a new vehicle's tab stays
 * clean. The cover photo is managed on the Overview, so it is left out. Use inside <Suspense>.
 */
export async function DocumentsTab({
  vehicleId,
  vehicleName,
  coverAttachmentId,
  query,
  sort,
}: {
  vehicleId: string;
  vehicleName: string;
  coverAttachmentId: string | null;
  query: string;
  sort: string | undefined;
}) {
  const all = ((await attachmentsByOwner("vehicle", [vehicleId])).get(vehicleId) ?? []).filter(
    (a) => a.id !== coverAttachmentId,
  );
  const sortKey = parseDocSort(sort);
  const shown = searchAndSortDocs(all, query, sortKey);
  const searching = query.trim() !== "";

  return (
    <section aria-label="Documents" className="flex flex-col gap-4">
      <div>
        <AddDocumentSheet vehicleId={vehicleId} vehicleName={vehicleName} />
      </div>
      {all.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No documents yet. Add the vehicle book, the licence and the insurance, each with a title you can search for.
        </p>
      ) : null}

      {all.length > 2 ? (
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="documents" />
          <Input type="search" name="q" defaultValue={query} placeholder="Search documents" aria-label="Search documents" className="max-w-xs" />
          <select name="sort" defaultValue={sortKey} aria-label="Sort documents" className={`${selectClass} w-auto`}>
            {DOC_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Search
          </button>
          {searching ? (
            <Link href={`/vehicles/${vehicleId}?tab=documents`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      ) : null}

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {shown.map((d) => {
            const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
            const label = docLabel(d);
            return (
              <li key={d.id} className="rounded-lg border bg-card p-3 text-card-foreground">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <a href={`/files/${d.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium underline-offset-2 hover:underline">
                      {label}
                    </a>
                    <p className="truncate text-xs text-muted-foreground">
                      {[d.title ? d.fileName : null, formatBytes(d.sizeBytes), `Added ${formatDate(d.createdAt)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <form action={deleteAttachment}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} confirm={`Delete "${label}"? This cannot be undone.`}>
                      <Trash2 aria-hidden />
                    </SubmitButton>
                  </form>
                </div>
                <details className="mt-2 rounded-md border">
                  <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Rename</summary>
                  <div className="border-t p-3">
                    <DocumentRenameForm id={d.id} title={d.title ?? ""} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : all.length > 0 ? (
        <p className="text-sm text-muted-foreground">No document matches “{query}”.</p>
      ) : null}
    </section>
  );
}
