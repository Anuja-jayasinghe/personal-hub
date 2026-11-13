import "server-only";
import { and, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { ReminderSource } from "../engine";

/** Open tasks (not done) that have a due date. Done tasks drop out of reminders (DECISIONS C36). */
export const tasksSource: ReminderSource = {
  key: "tasks",
  label: "Tasks",
  async load() {
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNotNull(tasks.dueDate)));

    return rows.flatMap((r) =>
      r.dueDate
        ? [{ id: `task:${r.id}`, title: r.title, dueDate: r.dueDate, href: "/tasks", kind: "task" }]
        : [],
    );
  },
};
