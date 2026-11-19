import "server-only";
import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { accessGrants, people } from "@/db/schema";
import { accessFromGrants, type Access } from "./access";

export type PersonWithAccess = { id: string; email: string; name: string | null; status: "pending" | "active" | "blocked"; lastSeenAt: Date | null; access: Access & { owner: false } };

/** Everyone the hub is shared with, with their access (Settings › People and roles, S.8). */
export async function listPeople(): Promise<PersonWithAccess[]> {
  await connection();
  const [rows, grants] = await Promise.all([db.select().from(people).orderBy(asc(people.email)), db.select().from(accessGrants)]);
  return rows.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    status: p.status,
    lastSeenAt: p.lastSeenAt,
    access: accessFromGrants(grants.filter((g) => g.personId === p.id)) as Access & { owner: false },
  }));
}
