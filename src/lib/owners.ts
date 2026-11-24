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
  // A vehicle renewal (insurance, licence...) can carry its document (Phase 1.3).
  "vehicle_renewal",
  // A vehicle service (V.1a, C147) can carry its invoice; its files follow the Vehicle documents section.
  "vehicle_service",
  // A bill or subscription (Phase 3.1) can carry its contract or a statement.
  "bill_item",
  // A payment of a bill or subscription can carry its receipt (Phase 3.2).
  "bill_payment",
  // A received cheque can carry its photos (front, back) (issue #178, C158). Owners only: see
  // `OWNER_ONLY_OWNER_TYPES` in src/features/people/access.ts.
  "cheque",
] as const;

export type OwnerType = (typeof OWNER_TYPES)[number];

export function isOwnerType(value: string): value is OwnerType {
  return (OWNER_TYPES as readonly string[]).includes(value);
}

/** A reference to the record something belongs to. */
export type OwnerRef = { ownerType: OwnerType; ownerId: string };
