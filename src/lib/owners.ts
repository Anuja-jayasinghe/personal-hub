/**
 * Things that can own shared tasks, notes and attachments (PLAN.md step 0.7).
 *
 * Owners are polymorphic: rows store `owner_type` + `owner_id` with no foreign key, so adding a
 * module only means adding a name here — no database migration. The flip side: when an owner is
 * deleted, its tasks, notes and attachments must be deleted in application code.
 */
export const OWNER_TYPES = [
  "vehicle",
  "meter",
  "bill",
  "subscription",
  // Attachments can hang off a task or a note too (e.g. a photo on a standalone note).
  "task",
  "note",
] as const;

export type OwnerType = (typeof OWNER_TYPES)[number];

export function isOwnerType(value: string): value is OwnerType {
  return (OWNER_TYPES as readonly string[]).includes(value);
}

/** A reference to the record something belongs to. */
export type OwnerRef = { ownerType: OwnerType; ownerId: string };
