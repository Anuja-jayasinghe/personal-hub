import type { Metadata } from "next";
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

/**
 * Standalone tasks and notes (DECISIONS C35). Scope is "all": today that means standalone items;
 * as modules start attaching tasks and notes to their records, those show up here too, labelled
 * with their owner type.
 */
export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks & notes"
        description="Everything you need to do or remember, in one place. Files can be attached to any task or note."
      />
      <Suspense fallback={<PanelSkeleton />}>
        <TasksPanel scope={{ kind: "all" }} />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <NotesPanel scope={{ kind: "all" }} />
      </Suspense>
    </>
  );
}
