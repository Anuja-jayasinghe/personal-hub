import { sharedVisible } from "@/features/people/access";
import { getAccess } from "@/lib/auth";
import { Check, CircleDot, Trash2 } from "lucide-react";
import Link from "next/link";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { AddTaskSheet } from "@/components/shared/add-sheets";
import { TaskForm } from "@/components/shared/task-form";
import { Badge } from "@/components/ui/badge";
import type { Attachment, Task, TaskStatus } from "@/db/schema";
import { deleteTask, setTaskStatus, updateTask } from "@/features/shared/actions";
import { ownerLabels, type OwnerLabel } from "@/features/shared/owner-labels";
import { attachmentsByOwner, listTasks, type OwnerScope } from "@/features/shared/queries";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/**
 * Tasks for any scope: standalone, one record (e.g. a vehicle), or everything. Drop it into any
 * page inside <Suspense>; it loads its own data at request time.
 */
export async function TasksPanel({
  scope,
  title = "Tasks",
  itemName = "task",
  itemNamePlural = "tasks",
}: {
  scope: OwnerScope;
  title?: string;
  /** Wording for this context, e.g. "chore" / "chores" for a differently worded list. */
  itemName?: string;
  itemNamePlural?: string;
}) {
  // Only what this person may see (S.8, C114): Tasks & notes, and the section of an attached record.
  const access = (await getAccess()) ?? { owner: false as const, grants: {} };
  const owner0 = scope.kind === "owner" ? scope.owner : null;
  if (!sharedVisible(access, owner0?.ownerType ?? null)) return null;
  const canAdd = sharedVisible(access, owner0?.ownerType ?? null, "add");
  const list = (await listTasks(scope)).filter((x) => sharedVisible(access, x.ownerType));
  const files = await attachmentsByOwner("task", list.map((t) => t.id));
  const labels = scope.kind === "all" ? await ownerLabels(list) : new Map<string, OwnerLabel>();
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const owner = scope.kind === "owner" ? scope.owner : null;

  return (
    // A container: the task columns follow the space the panel has (a page or a vehicle tab), not the window (#159).
    <section aria-labelledby="tasks-heading" className="@container flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 id="tasks-heading" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
          {title} · {list.filter((t) => t.status !== "done").length} open
        </h2>
        <span className="ml-auto">
          {canAdd ? <AddTaskSheet owner={owner} itemName={itemName} /> : null}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No {itemNamePlural} yet.
        </p>
      ) : (
        <ul className="grid items-start gap-2.5 @4xl:grid-cols-2 @[110rem]:grid-cols-3">
          {list.map((task) => (
            <TaskItem key={task.id} task={task} files={files.get(task.id) ?? []} today={today} ownerLabel={task.ownerType && task.ownerId ? labels.get(`${task.ownerType}:${task.ownerId}`) : undefined} showOwner={scope.kind === "all"} />
          ))}
        </ul>
      )}
    </section>
  );
}

const priorityLabel = { low: "Low", normal: "Normal", high: "High" } as const;

/** The round tick on the left of a task: ticks it done, or reopens it when it already is. */
function TickForm({ id, done, title }: { id: string; done: boolean; title: string }) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={done ? "todo" : "done"} />
      <button
        type="submit"
        aria-label={done ? `Reopen "${title}"` : `Mark "${title}" done`}
        className={`hit-44 flex size-7 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          done ? "bg-status-ok text-background" : "ring-[1.5px] ring-quiet hover:ring-primary"
        }`}
      >
        {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
      </button>
    </form>
  );
}

function StatusForm({ id, status, label, icon }: { id: string; status: TaskStatus; label: string; icon: React.ReactNode }) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant="outline" size="sm">
        {icon} {label}
      </SubmitButton>
    </form>
  );
}

function TaskItem({ task, files, today, ownerLabel, showOwner }: { task: Task; files: Attachment[]; today: string; ownerLabel?: OwnerLabel; showOwner: boolean }) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;

  return (
    <li className={`rounded-2xl border bg-card p-3.5 text-card-foreground ${done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <TickForm id={task.id} done={done} title={task.title} />
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] ${done ? "text-muted-foreground line-through" : "font-semibold"}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={task.priority === "high" ? "default" : "secondary"}>{priorityLabel[task.priority]}</Badge>
            {task.status === "doing" ? <Badge variant="outline">In progress</Badge> : null}
            {task.dueDate ? (
              <span className={`font-mono text-[10.5px] uppercase ${overdue ? "font-medium text-status-overdue" : "text-label"}`}>
                {overdue ? "Late · " : "Due "}
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task.estimatedCost || task.actualCost ? (
              <span className="text-muted-foreground">
                {task.estimatedCost ? `Est. ${formatMoney(Number(task.estimatedCost))}` : null}
                {task.estimatedCost && task.actualCost ? " · " : null}
                {task.actualCost ? `Actual ${formatMoney(Number(task.actualCost))}` : null}
              </span>
            ) : null}
            {showOwner && task.ownerType ? (
              ownerLabel ? (
                <Link href={ownerLabel.href} className="hit-44 rounded-full">
                  <Badge variant="outline">{ownerLabel.label}</Badge>
                </Link>
              ) : (
                <Badge variant="outline">{task.ownerType}</Badge>
              )
            ) : null}
          </div>
          {task.details ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.details}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {task.status === "todo" ? <StatusForm id={task.id} status="doing" label="Start" icon={<CircleDot aria-hidden />} /> : null}
          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <SubmitButton
              variant="ghost"
              size="icon"
              aria-label={`Delete task ${task.title}`}
              confirm={`Delete "${task.title}" and its files? This cannot be undone.`}
            >
              <Trash2 aria-hidden />
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
          <div className="border-t p-3">
            <TaskForm action={updateTask} task={task} />
          </div>
        </details>
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Files ({files.length})</summary>
          <div className="border-t p-3">
            <AttachmentsPanel owner={{ ownerType: "task", ownerId: task.id }} items={files} />
          </div>
        </details>
      </div>
    </li>
  );
}
