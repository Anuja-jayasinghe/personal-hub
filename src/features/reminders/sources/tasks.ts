import "server-only";
import { and, isNotNull, isNull, ne } from "drizzle-orm";
import { readDb } from "@/db/read";
import { tasks } from "@/db/schema";
import type { ReminderSource } from "../engine";

/**
 * Open standalone tasks (not done) that have a due date (DECISIONS C36), linking to the Tasks page.
 * Vehicles no longer have fixes (C71), so tasks that belong to a record are not reminded here.
 */
export const tasksSource: ReminderSource = {
  key: "tasks",
  label: "Tasks",
  async load() {
    const db = await readDb();
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNotNull(tasks.dueDate), isNull(tasks.ownerType)));

    return rows.flatMap((r) =>
      r.dueDate ? [{ id: `task:${r.id}`, title: r.title, dueDate: r.dueDate, href: "/tasks", kind: "task" }] : [],
    );
  },
};
