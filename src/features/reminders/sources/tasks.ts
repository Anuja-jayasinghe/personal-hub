import "server-only";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { tasks, vehicles } from "@/db/schema";
import type { ReminderSource } from "../engine";

/**
 * Open tasks (not done) that have a due date (DECISIONS C36). Standalone tasks link to the Tasks
 * page. A task that belongs to a vehicle is a "fix": it shows the vehicle's name, links to the
 * vehicle's Fixes tab, and stops reminding while the vehicle is archived (C48).
 */
export const tasksSource: ReminderSource = {
  key: "tasks",
  label: "Tasks",
  async load() {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        ownerType: tasks.ownerType,
        ownerId: tasks.ownerId,
        vehicleNickname: vehicles.nickname,
        vehicleArchivedAt: vehicles.archivedAt,
      })
      .from(tasks)
      .leftJoin(vehicles, and(eq(tasks.ownerType, "vehicle"), eq(tasks.ownerId, vehicles.id)))
      .where(
        and(
          ne(tasks.status, "done"),
          isNotNull(tasks.dueDate),
          // not owned by an archived vehicle (tasks of other owners, or none, are unaffected)
          or(ne(tasks.ownerType, "vehicle"), isNull(tasks.ownerType), isNull(vehicles.archivedAt)),
        ),
      );

    return rows.flatMap((r) => {
      if (!r.dueDate) return [];
      if (r.ownerType === "vehicle" && r.ownerId) {
        return [
          {
            id: `task:${r.id}`,
            title: `${r.title} · ${r.vehicleNickname ?? "Vehicle"}`,
            dueDate: r.dueDate,
            href: `/vehicles/${r.ownerId}?tab=fixes`,
            kind: "fix",
            ownerId: r.ownerId,
          },
        ];
      }
      return [{ id: `task:${r.id}`, title: r.title, dueDate: r.dueDate, href: "/tasks", kind: "task" }];
    });
  },
};
