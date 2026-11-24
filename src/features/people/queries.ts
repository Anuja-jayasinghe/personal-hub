import "server-only";
import { asc, isNull } from "drizzle-orm";
import { connection } from "next/server";
import { readDb } from "@/db/read";
import { accessGrants, people, pushSubscriptions } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { accessFromGrants, type Access } from "./access";

export type PersonWithAccess = {
  id: string;
  email: string;
  name: string | null;
  status: "pending" | "active" | "blocked";
  lastSeenAt: Date | null;
  access: Access & { owner: false };
  /** The owner's switch for this person's notifications (N.5, C144). */
  notificationsEnabled: boolean;
  /** Devices of theirs that can take a push (not marked gone). */
  devices: number;
};

/**
 * Everyone the hub is shared with, with their access (Settings › People and roles, S.8) and whether
 * their notifications are on (N.5, C144). Owner only, checked here as well as by the page: it reads the
 * real database and counts a person's devices.
 */
export async function listPeople(): Promise<PersonWithAccess[]> {
  await connection();
  await requirePage("owner");
  const db = await readDb();
  const [rows, grants, devices] = await Promise.all([
    db.select().from(people).orderBy(asc(people.email)),
    db.select().from(accessGrants),
    db.select({ recipient: pushSubscriptions.recipient }).from(pushSubscriptions).where(isNull(pushSubscriptions.goneAt)),
  ]);
  return rows.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    status: p.status,
    lastSeenAt: p.lastSeenAt,
    access: accessFromGrants(grants.filter((g) => g.personId === p.id)) as Access & { owner: false },
    notificationsEnabled: p.notificationsEnabled,
    devices: devices.filter((d) => d.recipient === p.email).length,
  }));
}
