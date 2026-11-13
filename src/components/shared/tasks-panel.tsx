import { Check, CircleDot, RotateCcw, Trash2 } from "lucide-react";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { TaskForm } from "@/components/shared/task-form";
import { Badge } from "@/components/ui/badge";
import type { Attachment, Task, TaskStatus } from "@/db/schema";
import { createTask, deleteTask, setTaskStatus, updateTask } from "@/features/shared/actions";
import { attachmentsByOwner, listTasks, type OwnerScope } from "@/features/shared/queries";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/**
 * Tasks for any scope: standalone, one record (e.g. a vehicle), or everything. Drop it into any
 * page inside <Suspense>; it loads its own data at request time.
 */
export async function TasksPanel({ scope, title = "Tasks" }: { scope: OwnerScope; title?: string }) {
  const list = await listTasks(scope);
  const files = await attachmentsByOwner("task", list.map((t) => t.id));
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const owner = scope.kind === "owner" ? scope.owner : null;

  return (
    <section aria-labelledby="tasks-heading" className="flex flex-col gap-4">
      <h2 id="tasks-heading" className="text-lg font-medium">
        {title}
      </h2>

      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a task</summary>
        <div className="border-t p-4">
          <TaskForm action={createTask} owner={owner} />
        </div>
      </details>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tasks yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((task) => (
            <TaskItem key={task.id} task={task} files={files.get(task.id) ?? []} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}

const priorityLabel = { low: "Low", normal: "Normal", high: "High" } as const;

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

function TaskItem({ task, files, today }: { task: Task; files: Attachment[]; today: string }) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;

  return (
    <li className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={done ? "text-muted-foreground line-through" : "font-medium"}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={task.priority === "high" ? "default" : "secondary"}>{priorityLabel[task.priority]}</Badge>
            {task.status === "doing" ? <Badge variant="outline">In progress</Badge> : null}
            {task.dueDate ? (
              <span className={overdue ? "font-medium text-status-overdue" : "text-muted-foreground"}>
                {overdue ? "Overdue · " : "Due "}
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
            {task.ownerType ? <Badge variant="outline">{task.ownerType}</Badge> : null}
          </div>
          {task.details ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.details}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {task.status === "todo" ? <StatusForm id={task.id} status="doing" label="Start" icon={<CircleDot aria-hidden />} /> : null}
          {!done ? <StatusForm id={task.id} status="done" label="Done" icon={<Check aria-hidden />} /> : null}
          {done ? <StatusForm id={task.id} status="todo" label="Reopen" icon={<RotateCcw aria-hidden />} /> : null}
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
        <details className="rounded-md border">
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
