import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotesPanel } from "@/components/shared/notes-panel";
import { TasksPanel } from "@/components/shared/tasks-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Tasks & notes" };

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

const VIEWS = [
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "notes", label: "Notes", href: "/tasks?view=notes" },
] as const;

async function TasksContent({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const current = view === "notes" ? "notes" : "tasks";
  // The title says where you are (S.1, owner's list item 36); the switcher below changes it.
  return (
    <>
      <PageHeader
        title={current === "notes" ? "Notes" : "Tasks"}
        description={current === "notes" ? "Things to remember. Files can be attached to any note." : "Things to do. Files can be attached to any task."}
      />
      <nav aria-label="Tasks or notes" className="grid grid-cols-2 gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border sm:w-80">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.href}
            aria-current={v.key === current ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center rounded-[10px] text-sm transition-colors ${
              v.key === current ? "bg-accent font-semibold text-foreground ring-1 ring-primary/45" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<PanelSkeleton />}>{current === "notes" ? <NotesPanel scope={{ kind: "all" }} /> : <TasksPanel scope={{ kind: "all" }} />}</Suspense>
    </>
  );
}

/**
 * Standalone tasks and notes (DECISIONS C35; R.5b, board HTasksNotes): one switcher, then either list.
 * Scope is "all": standalone items plus anything attached to a record, labelled with its owner.
 */
export default function TasksPage(props: PageProps<"/tasks">) {
  return (
    <>
      <Suspense fallback={<PanelSkeleton />}>
        <TasksContent searchParams={props.searchParams as Promise<{ view?: string }>} />
      </Suspense>
    </>
  );
}
