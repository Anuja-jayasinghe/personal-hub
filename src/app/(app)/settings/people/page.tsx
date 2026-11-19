import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessGrid, AddPersonForm } from "@/components/settings/people";
import { SettingsSection } from "@/components/settings/settings-ui";
import { SubmitButton } from "@/components/shared/submit-button";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { removePerson, setPersonStatus } from "@/features/people/actions";
import { listPeople, type PersonWithAccess } from "@/features/people/queries";
import { formatDate } from "@/lib/format";
import { parseAllowedEmails } from "@/lib/allowed-emails";

export const metadata: Metadata = { title: "People and roles" };

function StatusForm({ id, status, label, variant = "outline" }: { id: string; status: "active" | "blocked"; label: string; variant?: "outline" | "default" | "ghost" }) {
  return (
    <form action={setPersonStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}

function RemoveForm({ person }: { person: PersonWithAccess }) {
  return (
    <form action={removePerson}>
      <input type="hidden" name="id" value={person.id} />
      <SubmitButton variant="ghost" size="sm" className="text-status-overdue" confirm={`Remove ${person.name ?? person.email} and their access? If they sign in again they will be waiting for approval.`}>
        Remove
      </SubmitButton>
    </form>
  );
}

function Who({ person }: { person: PersonWithAccess }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-[15px] font-semibold">{person.name ?? person.email}</span>
      <span className="truncate text-xs text-muted-foreground">
        {person.name ? `${person.email} · ` : ""}
        {person.lastSeenAt ? `last here ${formatDate(person.lastSeenAt)}` : "has not signed in yet"}
      </span>
    </span>
  );
}

async function PeopleLists() {
  const all = await listPeople();
  const waiting = all.filter((p) => p.status === "pending");
  const active = all.filter((p) => p.status === "active");
  const blocked = all.filter((p) => p.status === "blocked");
  const owners = parseAllowedEmails(process.env.ALLOWED_EMAILS);

  return (
    <>
      {waiting.length > 0 ? (
        <SettingsSection label={`Waiting for you · ${waiting.length}`} note="They signed in by themselves. Approve to give them a place here, then choose what they see.">
          <div className="flex flex-col divide-y divide-raised rounded-2xl border border-status-soon-mark/40 bg-card px-4">
            {waiting.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Who person={p} />
                <StatusForm id={p.id} status="active" label="Approve" variant="default" />
                <StatusForm id={p.id} status="blocked" label="Block" />
              </div>
            ))}
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection label="People with access">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">You</span>
              <span className="truncate text-xs text-muted-foreground">{owners.join(", ")}</span>
            </span>
            <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-primary-foreground">OWNER</span>
          </div>
          {active.length === 0 ? <p className="text-sm text-muted-foreground">Nobody else yet. Add someone below.</p> : null}
          {active.map((p) => (
            <details key={p.id} className="group rounded-2xl border bg-card px-4">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Who person={p} />
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-label uppercase">
                  {Object.keys(p.access.grants).length === 0 ? "sees nothing yet" : `${Object.keys(p.access.grants).length} of 7 sections`}
                </span>
                <span className="text-sm font-medium text-primary group-open:hidden">Access</span>
                <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Close</span>
              </summary>
              <div className="flex flex-col gap-3 pb-4">
                <AccessGrid personId={p.id} grants={p.access.grants} />
                <div className="flex flex-wrap gap-2 border-t border-raised pt-3">
                  <StatusForm id={p.id} status="blocked" label="Block" />
                  <RemoveForm person={p} />
                </div>
              </div>
            </details>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection label="Add someone">
        <AddPersonForm />
      </SettingsSection>

      {blocked.length > 0 ? (
        <details className="rounded-2xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground">Blocked ({blocked.length})</summary>
          <div className="flex flex-col divide-y divide-raised border-t px-4">
            {blocked.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Who person={p} />
                <StatusForm id={p.id} status="active" label="Let back in" />
                <RemoveForm person={p} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/**
 * Settings › People and roles (S.8, C114; board HAdmin): who the hub is shared with and what each person
 * may see and do, section by section. Owner only (the Settings layout checks). Someone who signs in by
 * themselves waits here for approval; a demo for them comes later.
 */
export default function PeoplePage() {
  return (
    <>
      <PageHeader title="People and roles" parent={{ href: "/settings", label: "Settings" }} />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <PeopleLists />
      </Suspense>
    </>
  );
}
