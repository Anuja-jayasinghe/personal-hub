import { isOwnerType, type OwnerRef } from "@/lib/owners";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown for bad user input; the message is safe to show in the UI. */
export class ValidationError extends Error {}

function raw(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function requiredText(fd: FormData, key: string, label: string, max: number): string {
  const v = raw(fd, key);
  if (!v) throw new ValidationError(`${label} is required.`);
  if (v.length > max) throw new ValidationError(`${label} must be at most ${max} characters.`);
  return v;
}

export function optionalText(fd: FormData, key: string, label: string, max: number): string | null {
  const v = raw(fd, key);
  if (!v) return null;
  if (v.length > max) throw new ValidationError(`${label} must be at most ${max} characters.`);
  return v;
}

/** Amount as a decimal string with up to 2 decimals, e.g. "1250" or "1250.50". Empty = null. */
export function optionalMoney(fd: FormData, key: string, label: string): string | null {
  const v = raw(fd, key).replace(/,/g, "");
  if (!v) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) {
    throw new ValidationError(`${label} must be a number like 1250 or 1250.50.`);
  }
  return v;
}

/** Calendar date "YYYY-MM-DD". Empty = null. */
export function optionalDate(fd: FormData, key: string, label: string): string | null {
  const v = raw(fd, key);
  if (!v) return null;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  if (!valid) throw new ValidationError(`${label} must be a valid date.`);
  return v;
}

export function oneOf<T extends string>(fd: FormData, key: string, label: string, allowed: readonly T[]): T {
  const v = raw(fd, key);
  if (!(allowed as readonly string[]).includes(v)) throw new ValidationError(`${label} is not valid.`);
  return v as T;
}

export function idFrom(fd: FormData, key = "id"): string {
  const v = raw(fd, key);
  if (!UUID_RE.test(v)) throw new ValidationError("That item could not be found.");
  return v;
}

/** Owner pair from hidden inputs. Both empty = standalone (null); half-filled or unknown = error. */
export function optionalOwner(fd: FormData): OwnerRef | null {
  const ownerType = raw(fd, "ownerType");
  const ownerId = raw(fd, "ownerId");
  if (!ownerType && !ownerId) return null;
  if (!isOwnerType(ownerType) || !UUID_RE.test(ownerId)) {
    throw new ValidationError("That item could not be found.");
  }
  return { ownerType, ownerId };
}

export function requiredOwner(fd: FormData): OwnerRef {
  const owner = optionalOwner(fd);
  if (!owner) throw new ValidationError("That item could not be found.");
  return owner;
}
